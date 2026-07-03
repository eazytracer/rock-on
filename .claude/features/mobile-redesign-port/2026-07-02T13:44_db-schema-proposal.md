---
feature: mobile-redesign-port
doc: DB schema proposal for review (Notifications · Friends · Events)
created: 2026-07-02T13:44
status: FOR REVIEW — no migration written or applied yet
based-on: 2026-07-02T04:55_research.md §7 (DB research)
---

# DB Schema Proposal — Notifications, Friends, Events

> **Nothing here has been applied.** This is the design for your review. On approval I'll turn
> each section into one incremental migration, apply it to **local Supabase only**
> (`supabase db reset` + pgTAP + `npm run lint:migrations`), and hold for your review before
> anything touches remote/prod. Ship order: **Notifications → Friends → Events**.

## Conventions (all three migrations follow these — per CLAUDE.md Migration Policy)

- One incremental migration file per feature; idempotent (`CREATE TABLE IF NOT EXISTS`,
  `ADD COLUMN IF NOT EXISTS`, `DROP POLICY IF EXISTS` before `CREATE POLICY`, `DO $$ … EXCEPTION
WHEN duplicate_object` for constraints/publication adds).
- Enums as `CHECK` constraints (project style) — **the CHECK values must match the TS union
  exactly** (enum drift is runtime-fatal; flagged in open-jam research).
- Explicit `GRANT SELECT, INSERT, UPDATE, DELETE ON <table> TO authenticated;` **and**
  `... TO service_role;` for every new table (snapshot-grant rule).
- RLS enabled on every table; `TO authenticated`, `USING ((select auth.uid()) = …)`; cross-row
  checks via `SECURITY DEFINER` helper functions (owned by postgres) to avoid recursion — mirrors
  `is_jam_participant` in the jam migration.
- Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE …` + `REPLICA IDENTITY FULL` for tables
  the client subscribes to.
- DB is snake_case; app models camelCase (RemoteRepository mappers translate).
- **All three are Supabase-only + Realtime — NOT added to the local-first band sync engine**
  (same decision as the jam tables; they're user/host-scoped, not band-scoped, and want realtime
  more than offline caching).

## Decisions baked in (defaulted while you were away — change any and I'll adjust)

- **Friendships = one canonical row** (`user_a < user_b`) rather than two mirrored rows — avoids
  the half-friendship dual-write bug. Trade-off: "my friends" query unions two columns.
- **Release notes = one shared row per version**, gated per-user by `users.last_seen_release_version`
  — avoids an N×users notification fan-out.
- **Event lineup `source`** is author-declared on the row (`mine|band|public|external`) with
  `owner_id`; `external` has no `song_id` and relies on the frozen `display_title/display_artist`
  tuple (JamSetlistItem pattern). It is NOT auto-derived from the song's visibility.
- **Notifications INSERT = service_role only** (minted server-side; never client-authored).
- **Unlisted event access + friend-code lookup + friend-request policy = edge functions**, not
  broad RLS (broad RLS would leak rows). See each section.

---

## 1. NOTIFICATIONS — `<ts>_notifications.sql`

```sql
-- ── Tables ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, -- recipient
  kind         TEXT NOT NULL CHECK (kind IN ('release','activity','event','friend')),
  title        TEXT NOT NULL,
  body         TEXT,
  link         TEXT,                                   -- in-app deep link target
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,     -- typed per kind (event_id, friend_request_id, version…)
  read_at      TIMESTAMPTZ,                            -- NULL = unread (drives unread count)
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.release_notes (
  version      TEXT PRIMARY KEY,                       -- semver, e.g. '0.4.0'
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,                          -- markdown (MarkdownRenderer already exists)
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_seen_release_version TEXT;  -- per-user "what's new" gate

-- ── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, created_date DESC) WHERE read_at IS NULL;   -- unread count + feed
CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON public.notifications (user_id, created_date DESC);

-- ── Grants ──────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.release_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.release_notes TO service_role;

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS notifications_update_own ON public.notifications;   -- mark read / dismiss
CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS notifications_delete_own ON public.notifications;
CREATE POLICY notifications_delete_own ON public.notifications
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);
-- INSERT: service_role only (no authenticated INSERT policy) — minted server-side.

DROP POLICY IF EXISTS release_notes_select_all ON public.release_notes;
CREATE POLICY release_notes_select_all ON public.release_notes
  FOR SELECT TO authenticated USING (true);                 -- global content
-- INSERT/UPDATE/DELETE: service_role only.

-- ── Realtime (bell live-updates) ────────────────────────────────────────────
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
```

**Digest ("while you were away")** = computed at read time from `notifications WHERE user_id =
auth.uid() AND created_date > users.last_login`, grouped by `kind` in `NotificationService` — no
extra table. `users.last_login` already exists (baseline).

**Retention: 90-day prune — APPROVED (user, 2026-07-02).** 🚨 **Critical invariant:** pruning only
ever deletes rows from `public.notifications`. It must NEVER touch `friend_requests`. A "friend
request" **notification** (a `kind='friend'` row in `notifications`, a transient alert) is a
SEPARATE thing from the **friend request** itself (a `pending` row in `public.friend_requests`).
The Friends screen reads `friend_requests` directly (§2), so a pending request stays visible and
actionable on the Friends screen indefinitely, even after its 90-day-old notification alert is
pruned. The prune job's `DELETE` is scoped to `notifications` only — it has no join to, and never
references, `friend_requests`.

---

## 2. FRIENDS — `<ts>_friends.sql`

```sql
-- ── user_profiles additions (Discord-style hidden-by-default) ────────────────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS discoverable BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS friend_code TEXT;              -- stable per-user handle; backfilled below
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS friend_request_policy TEXT NOT NULL DEFAULT 'everyone'
    CHECK (friend_request_policy IN ('everyone','friends_of_friends','code_only'));

-- Backfill friend_code for existing rows using the jam short-code alphabet, THEN add UNIQUE.
-- (Generation done in the migration via a DO block calling a gen helper; omitted here for brevity.)
DO $$ BEGIN
  ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_friend_code_key UNIQUE (friend_code);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Directed friend requests ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  addressee_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','accepted','declined','cancelled')),
  created_date   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_date TIMESTAMPTZ,
  CHECK (requester_id <> addressee_id),
  UNIQUE (requester_id, addressee_id)
);

-- ── Mutual friend graph — ONE canonical row per friendship (user_a < user_b) ─
CREATE TABLE IF NOT EXISTS public.friendships (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_b       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (user_a < user_b),
  UNIQUE (user_a, user_b)
);

-- ── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_friend_requests_addressee
  ON public.friend_requests (addressee_id) WHERE status = 'pending';   -- incoming badge
CREATE INDEX IF NOT EXISTS idx_friend_requests_requester ON public.friend_requests (requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user_a ON public.friendships (user_a);
CREATE INDEX IF NOT EXISTS idx_friendships_user_b ON public.friendships (user_b);
CREATE INDEX IF NOT EXISTS idx_user_profiles_friend_code
  ON public.user_profiles (friend_code) WHERE friend_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_profiles_discoverable
  ON public.user_profiles (id) WHERE discoverable;

-- ── Helper (SECURITY DEFINER) ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.are_friends(u1 UUID, u2 UUID) RETURNS BOOLEAN
  LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE user_a = LEAST(u1,u2) AND user_b = GREATEST(u1,u2)
  );
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friend_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friend_requests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO service_role;

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS friend_requests_select_party ON public.friend_requests;
CREATE POLICY friend_requests_select_party ON public.friend_requests
  FOR SELECT TO authenticated
  USING ((select auth.uid()) IN (requester_id, addressee_id));
DROP POLICY IF EXISTS friend_requests_update_party ON public.friend_requests; -- accept/decline/cancel
CREATE POLICY friend_requests_update_party ON public.friend_requests
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) IN (requester_id, addressee_id));
-- INSERT: goes through the send-friend-request edge fn (enforces addressee's policy) → service_role.
-- friendships INSERT/DELETE: service_role only (atomic on accept). SELECT below:
DROP POLICY IF EXISTS friendships_select_member ON public.friendships;
CREATE POLICY friendships_select_member ON public.friendships
  FOR SELECT TO authenticated USING ((select auth.uid()) IN (user_a, user_b));

-- user_profiles visibility: ADD friend + discoverable SELECT policies (do NOT re-open global
-- enumeration; existing users_select_band_member / _jam_coparticipant stay). e.g.:
DROP POLICY IF EXISTS user_profiles_select_friend ON public.user_profiles;
CREATE POLICY user_profiles_select_friend ON public.user_profiles
  FOR SELECT TO authenticated USING (public.are_friends((select auth.uid()), id));
DROP POLICY IF EXISTS user_profiles_select_discoverable ON public.user_profiles;
CREATE POLICY user_profiles_select_discoverable ON public.user_profiles
  FOR SELECT TO authenticated USING (discoverable);

-- ── Realtime (incoming-request badge) ───────────────────────────────────────
ALTER TABLE public.friend_requests REPLICA IDENTITY FULL;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
```

**Edge functions (auth-verified; privileged writes via service_role):**

- `resolve-friend-code` — resolve a code → user for hidden users (can't be a `friend_code=?` RLS
  policy: that still needs the row selectable).
- `send-friend-request` — enforces the addressee's `friend_request_policy` (+ friends-of-friends
  via `are_friends`) before inserting; can't live in a WITH CHECK without leaking policy.
- `accept-friend-request` — flips request → accepted AND writes the canonical `friendships` row
  atomically; emits a `kind='friend'` notification.
  QR/code UI reuses `qrcode.react` / the existing `JamInviteQR`.

---

## 3. EVENTS — `<ts>_events.sql`

```sql
-- ── Event (durable, calendar-bound, RSVP-able; distinct from ephemeral jam_sessions) ─
CREATE TABLE IF NOT EXISTS public.events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  band_id           UUID REFERENCES public.bands(id) ON DELETE SET NULL,   -- nullable: personal-hosted
  name              TEXT NOT NULL,
  description       TEXT,
  venue             TEXT,
  location          TEXT,
  scheduled_date    TIMESTAMPTZ NOT NULL,
  end_time          TIMESTAMPTZ,
  timezone          TEXT NOT NULL DEFAULT 'America/New_York',
  visibility        TEXT NOT NULL DEFAULT 'private'
                      CHECK (visibility IN ('private','unlisted','public')),
  status            TEXT NOT NULL DEFAULT 'scheduled'
                      CHECK (status IN ('scheduled','confirmed','completed','cancelled')),
  short_code        TEXT UNIQUE,                          -- reuse jam alphabet; NULL until join enabled
  view_token        TEXT UNIQUE,                          -- unlisted access (mirrors jam_sessions)
  view_token_expires_at TIMESTAMPTZ,
  setlist_id        UUID REFERENCES public.setlists(id) ON DELETE SET NULL,
  calendar_uid      UUID DEFAULT gen_random_uuid(),       -- future .ics (calendar-events spec)
  calendar_sequence INTEGER NOT NULL DEFAULT 0,
  created_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version           INTEGER NOT NULL DEFAULT 1,
  last_modified_by  UUID REFERENCES public.users(id)
);

-- ── Per-event access control (the net-new ACL) + RSVP ───────────────────────
CREATE TABLE IF NOT EXISTS public.event_participants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  access_tier TEXT NOT NULL DEFAULT 'guest'
                CHECK (access_tier IN ('host','cohost','guest','viewer')),
  rsvp        TEXT NOT NULL DEFAULT 'pending'
                CHECK (rsvp IN ('pending','going','maybe','declined')),
  joined_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

-- ── Confirmed lineup (host-slotted songs, with provenance) ──────────────────
CREATE TABLE IF NOT EXISTS public.event_lineup_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  position       INTEGER NOT NULL DEFAULT 0,
  source         TEXT NOT NULL CHECK (source IN ('mine','band','public','external')),
  owner_id       UUID REFERENCES public.users(id) ON DELETE SET NULL,   -- who contributed
  song_id        UUID REFERENCES public.songs(id) ON DELETE SET NULL,   -- NULL for external
  display_title  TEXT NOT NULL,                          -- frozen display tuple (JamSetlistItem pattern)
  display_artist TEXT NOT NULL,
  created_date   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Sign-up requests (unresolved until host approves) ───────────────────────
CREATE TABLE IF NOT EXISTS public.event_lineup_requests (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id               UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  requester_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source                 TEXT NOT NULL CHECK (source IN ('mine','band','public','external')),
  owner_id               UUID REFERENCES public.users(id) ON DELETE SET NULL,
  song_id                UUID REFERENCES public.songs(id) ON DELETE SET NULL,
  display_title          TEXT NOT NULL,
  display_artist         TEXT NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','approved','rejected')),
  resolved_lineup_item_id UUID REFERENCES public.event_lineup_items(id) ON DELETE SET NULL,
  created_date           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_events_host           ON public.events (host_user_id);
CREATE INDEX IF NOT EXISTS idx_events_band           ON public.events (band_id);
CREATE INDEX IF NOT EXISTS idx_events_scheduled_date ON public.events (scheduled_date);
CREATE INDEX IF NOT EXISTS idx_events_short_code     ON public.events (short_code) WHERE short_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_view_token     ON public.events (view_token) WHERE view_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_participants_event ON public.event_participants (event_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_user  ON public.event_participants (user_id);
CREATE INDEX IF NOT EXISTS idx_event_lineup_items_event ON public.event_lineup_items (event_id);
CREATE INDEX IF NOT EXISTS idx_event_lineup_requests_pending
  ON public.event_lineup_requests (event_id) WHERE status = 'pending';

-- ── Helpers (SECURITY DEFINER — avoid RLS recursion, mirror is_jam_participant) ─
CREATE OR REPLACE FUNCTION public.is_event_participant(p_event UUID, p_user UUID) RETURNS BOOLEAN
  LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.event_participants
                 WHERE event_id = p_event AND user_id = p_user);
$$;
CREATE OR REPLACE FUNCTION public.event_access_tier(p_event UUID, p_user UUID) RETURNS TEXT
  LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT access_tier FROM public.event_participants
  WHERE event_id = p_event AND user_id = p_user;
$$;

-- ── Grants (all four tables, both roles) ────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events                 TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_participants     TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_lineup_items     TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_lineup_requests  TO authenticated, service_role;

-- ── RLS (summary — full policies written in the migration) ──────────────────
-- events         SELECT: host OR is_event_participant(id,uid) OR visibility='public'.
--                        (unlisted access via view_token EDGE FN, NOT a broad RLS clause — a
--                         visibility='unlisted' USING would leak every unlisted event.)
--                INSERT: host_user_id = uid.  UPDATE/DELETE: host, UPDATE also cohost.
-- event_participants SELECT: same-event participant. INSERT self as guest/viewer (join).
--                        rsvp self-update; access_tier changes host/cohost only (via edge fn).
--                        DELETE self (leave) or host (remove).
-- event_lineup_items SELECT: participant. INSERT/UPDATE/DELETE: host/cohost only.
-- event_lineup_requests SELECT: requester or host/cohost. INSERT: requester_id = uid AND
--                        participant. UPDATE (approve/reject): host/cohost only.

-- ── Realtime (host console live updates) ────────────────────────────────────
ALTER TABLE public.event_participants     REPLICA IDENTITY FULL;
ALTER TABLE public.event_lineup_requests  REPLICA IDENTITY FULL;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.event_participants;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.event_lineup_requests;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
```

**Edge function:** unlisted-event access by `view_token` (jam-view precedent); tier-setting writes.
**Calendar integration:** `CalendarPage` gains a third source (events, green) reading
`events.scheduled_date` alongside shows/practices.

---

## App-model mappings (camelCase ↔ snake_case, added to RemoteRepository)

- `notifications`: `userId, kind, title, body, link, payload, readAt, createdDate`.
- `release_notes`: `version, title, body, publishedAt`; `users.lastSeenReleaseVersion`.
- `user_profiles`: `+ discoverable, friendCode, friendRequestPolicy`.
- `friend_requests`: `requesterId, addresseeId, status, createdDate, respondedDate`.
- `friendships`: `userA, userB, createdDate`.
- `events`: full set incl. `hostUserId, bandId, scheduledDate, endTime, visibility, status,
shortCode, viewToken, setlistId, calendarUid, calendarSequence, version, lastModifiedBy`.
- `event_participants`: `eventId, userId, accessTier, rsvp, joinedDate`.
- `event_lineup_items` / `event_lineup_requests`: `eventId, position, source, ownerId, songId,
displayTitle, displayArtist, …`.

## New service classes (mirror JamSessionService)

`NotificationService` (list, unreadCount, markRead, digest) · `FriendService` (send/accept/decline,
resolveCode, search) · `EventService` (create, joinByCode, rsvp, lineup request/approve).
RealtimeManager channels: `notifications`, `friend_requests`, `event_participants`,
`event_lineup_requests`. Edge fns added to `supabase/functions/FUNCTIONS.md` + smoke.

## Open questions for you (⭐ = would change the DDL above)

1. ⭐ **Friendships single canonical row vs. two mirrored rows?** (I defaulted single-row.)
2. ⭐ **`event_participants.access_tier` naming** — keep 4 tiers host/cohost/guest/viewer, or fold
   cohost into a boolean? (I kept 4.)
3. ⭐ **Event `source` author-declared vs derived from song visibility?** (I defaulted author-declared.)
4. ✅ **Notification retention — DECIDED: 90-day prune** (scoped to `notifications` only; friend
   requests persist on the Friends screen — see §1 critical invariant).
5. **`friend_request_policy` default** — `everyone` (current) vs `friends_of_friends`?
6. **Timezone default** `America/New_York` (matches calendar-events spec) — right default for you?
7. **Events on the offline calendar?** Default no (Supabase-only). Yes → Events must also join the
   band sync engine (larger change).
