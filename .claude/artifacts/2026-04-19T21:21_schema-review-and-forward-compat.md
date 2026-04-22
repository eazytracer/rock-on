---
title: Schema Review — Social Catalog, Multi-Band, Anonymous Jam, Song Sharing
created: 2026-04-19T21:21
prompt: Step back and look at the schema before making changes for the user_profiles RLS bug. Review what's in place vs what's coming (multi-band, anonymous jam users, song sharing/copying), identify RLS gaps, redundancies, and forward-compat issues.
status: Review — pending decisions before changes
related:
  - .claude/specifications/unified-database-schema.md
  - .claude/artifacts/2026-04-03T00:50_jam-user-goals-and-scenarios.md
  - .claude/artifacts/2026-04-02T20:34_jam-session-user-flows.md
  - .claude/artifacts/future/2025-10-27T00:37_song-archiving-and-fork-tracking-schema.md
  - supabase/migrations/20251106000000_baseline_schema.sql
---

# Schema Review — Social Catalog & Forward-Compat

## TL;DR

The current schema **handles today's working jam-session feature reasonably well**. The structures for multi-band, song-context, setlist forking, and jam matching all exist. But there are **6 concrete RLS gaps**, **3 schema redundancies**, and **5 missing pieces** required by the next batch of planned features (anonymous jam participation, in-session setlist builder, nomination queue, song copying, broadcast view).

The recommendation is to fix the RLS gaps and one redundancy now (small, safe), and decide on the missing pieces before building the next features so we don't pay double the migration cost later.

---

## Schema Drift From Spec

The unified schema spec (`.claude/specifications/unified-database-schema.md`, last updated 2026-03-15) is mostly accurate. Drift found:

| Item                                      | Spec says                                    | Reality                                                                                                                                                                                                                          | Action                                                                         |
| ----------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `users.last_active_at`                    | Not documented                               | Column exists, indexed                                                                                                                                                                                                           | Add to spec                                                                    |
| 7 tables with RLS-no-policies             | Not flagged                                  | `assignment_roles`, `casting_templates`, `member_capabilities`, `song_assignments`, `song_castings`, `song_groups`, `song_group_memberships` have RLS enabled but **zero policies** = deny-all to everything except service_role | Document; only matters when these tables get used (currently dead in app code) |
| `songs.context_id` type                   | "TEXT in Supabase"                           | TEXT confirmed (no FK)                                                                                                                                                                                                           | Spec accurate, see redundancy R1 below                                         |
| `setlists.context_id`                     | "string"                                     | TEXT (no FK)                                                                                                                                                                                                                     | Same as R1                                                                     |
| `setlists.band_id` + `context_id`         | Spec calls this out as nullable + dual-keyed | Confirmed                                                                                                                                                                                                                        | See redundancy R2 below                                                        |
| `songs_select_jam_coparticipant`          | Not in spec                                  | Exists (added 2026-04-03)                                                                                                                                                                                                        | Add to spec                                                                    |
| `users_select_authenticated USING (true)` | Not flagged                                  | Confirmed — every authenticated user can read every other user's row, including email                                                                                                                                            | Flag as RLS-1 below                                                            |

---

## RLS Issues (in priority order)

### RLS-1 — `user_profiles_select_own` blocks jam co-participant display names (CURRENT BUG)

**Symptom:** "Could not find a relationship between 'jam_participants' and 'user_profiles'" — actually two stacked problems: PostgREST can't infer the join, AND the RLS would block it even if it could.

**Pattern to mirror:** `songs_select_jam_coparticipant` already uses `are_jam_coparticipants(p_caller, p_song_owner)` — same shape works for profiles.

**Fix:**

```sql
CREATE POLICY user_profiles_select_jam_coparticipant ON user_profiles
  FOR SELECT TO authenticated
  USING (are_jam_coparticipants((SELECT auth.uid()), user_id));
```

Plus drop the embed in `RemoteRepository.ts:1645` and use a parallel `.in('user_id', [...])` lookup. PostgREST embeds need a real FK; both tables FK to `users.id` independently, so the embed will never auto-resolve no matter how many policies we add.

---

### RLS-2 — `users_select_authenticated USING (true)` is too broad

**Today:** Any authenticated user can `SELECT * FROM users` — including everyone's email address. This is a privacy/scraping issue.

**What we actually need it for:** Showing display names in band member lists, jam participant lists, audit log entries.

**Recommended replacement:** Two scoped policies (replace the blanket one):

```sql
-- Self
CREATE POLICY users_select_self ON users FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

-- Co-band-members (members of any shared band)
CREATE POLICY users_select_band_member ON users FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM band_memberships bm1
    JOIN band_memberships bm2 ON bm1.band_id = bm2.band_id
    WHERE bm1.user_id = (SELECT auth.uid())
      AND bm2.user_id = users.id
      AND bm1.status = 'active' AND bm2.status = 'active'
  ));

-- Jam co-participants
CREATE POLICY users_select_jam_coparticipant ON users FOR SELECT TO authenticated
  USING (are_jam_coparticipants((SELECT auth.uid()), users.id));
```

**Even safer:** Don't expose `users.email` to non-self at all. Move display data to `user_profiles` and never `SELECT *` from `users`.

---

### RLS-3 — 7 tables with RLS but no policies

**Tables:** `assignment_roles`, `casting_templates`, `member_capabilities`, `song_assignments`, `song_castings`, `song_groups`, `song_group_memberships`

**Effect today:** Deny-all to everything except service_role. Currently fine because none of these are queried in app code (only referenced in `src/pages/DevDashboard/diagrams/generated/erDiagram.ts` as ER-diagram seed data).

**Risk:** First time anyone tries to use casting or song-grouping features, every query silently returns nothing. No error — just empty arrays.

**Recommendation:** Either add minimal SELECT policies (for queries to work when needed), or **drop the tables** if these features aren't on the roadmap. Pre-1.0, dropping is the cleaner choice — they can be re-added when the casting feature is actually built.

---

### RLS-4 — `audit_log` invisible for personal records

`audit_log_select_if_member` requires `band_id` to match a band you're in. When a personal song changes, `band_id` is NULL → no policy matches → nobody can see the audit entry.

**Question for product:** Should personal-song history be visible to the song owner? If yes, add:

```sql
USING (... existing band check ... OR user_id = (SELECT auth.uid()))
```

If no (audit is band-only by design), this is fine — but should be called out in the spec.

---

### RLS-5 — `bands_insert_any_authenticated` has no tier check

Free-tier users can create unlimited bands. There's a `users.account_tier` column but no enforcement.

**Not urgent** (no paying tier yet) but worth a `CHECK_band_count_for_tier()` SECURITY DEFINER function so the limit lives in one place when we turn it on.

---

### RLS-6 — `jam_song_matches_insert_participant` allows participants to recompute matches

This was added intentionally (per session summary, recompute is client-side). But it means a malicious participant can spam-insert fake matches. Tradeoff: simplicity vs. trust. Acceptable for now; flag it for the future post-1.0 hardening pass.

---

## Schema Redundancies

### R1 — `context_id` stored as TEXT instead of UUID, no FK

**Tables affected:** `songs.context_id`, `setlists.context_id`

**Why it exists:** Polymorphic — `context_id` is either a `band_id` or a `user_id` depending on `context_type`. PostgreSQL doesn't natively do polymorphic FKs.

**Problems:**

- No referential integrity. Delete a band → orphaned songs/setlists. Delete a user → orphaned personal songs.
- Every join requires casting (`band_id::text = context_id`).
- Every RLS policy joining bands/users to context is more complex and slower.

**Options:**

1. **Status quo + cleanup trigger** — keep TEXT, add `AFTER DELETE` triggers on `bands` and `users` to clean up `songs WHERE context_id = OLD.id::text`. Fast to add, no schema churn.
2. **Two columns** — `band_context_id UUID REFERENCES bands(id) ON DELETE CASCADE` and `personal_context_id UUID REFERENCES users(id) ON DELETE CASCADE`, plus a `CHECK (num_nonnulls(band_context_id, personal_context_id) = 1)`. Real FKs, simpler RLS, but a bigger migration.
3. **Drop `context_type`+`context_id`, just use `band_id NULL OR personal_owner_id NULL`.** Same as option 2 but more explicit.

**Recommendation:** Pre-1.0, do option 2 or 3 in the baseline. Post-1.0 it'd be expensive to do.

---

### R2 — `setlists.band_id` AND `setlists.context_id` are both stored

Today a band setlist has BOTH `band_id = '<uuid>'` AND `context_id = '<uuid as text>'`. Two sources of truth → drift. The check constraint enforces presence but not equality.

**If we adopt R1's option 2/3, this dissolves automatically** (drop `context_id`, keep `band_id` nullable, use a `personal_owner_id UUID` for personal setlists).

---

### R3 — `bands.memberIds` array (IndexedDB-only legacy)

Per spec, IndexedDB still carries a `memberIds` array on bands while Supabase uses `band_memberships`. The IndexedDB side is stale; band membership changes don't always update the local cached array. Probably not actively breaking but worth removing — local `memberIds` should be derived from `bandMemberships` queries.

---

## Forward-Compat Gaps for Planned Features

These are gaps where the schema **doesn't yet support** functionality the artifacts say we're going to build.

### G1 — Anonymous participants in jams

**Goal docs say:** "the app works before signup, works better with it" — anon users on jam view should see content and ideally suggest songs.

**Schema today:** `jam_participants.user_id` is `NOT NULL` and FKs to `users.id`. Anonymous users cannot become participants — only viewers via Edge Function.

**To enable anon contributions** (any of: nominate songs, mark "I know this one", chat):

- Either: relax `jam_participants.user_id` to nullable, add `display_name TEXT`, `client_id TEXT` (browser fingerprint/local UUID)
- Or: separate `jam_anonymous_participants` table

**Decision needed before coding:**

- Is anonymous contribution in scope at all? If just "view → CTA to sign up", no schema change needed.
- If yes, what can anon do? (Suggest from existing match list? Search & add new songs? Join the chat?)

This affects RLS shape on `jam_participants`, `jam_song_matches`, and the Edge Function payload.

---

### G2 — Multi-band: persistent "current band" preference

**Today:** `currentBandId` lives in `localStorage` only. Switch devices → lose your last-active band, default to first one.

**Symptoms:** When user logs in on phone, the app might pick a different "current" band than on their laptop. Confusing.

**Fix:** Add `users.preferred_band_id UUID REFERENCES bands(id) ON DELETE SET NULL`. Sync on band switch. Read on login.

---

### G3 — Multi-band: cross-band catalog sharing in a jam

**`jam_participants.shared_contexts`** is JSONB shaped as `[{type:'personal', id:'...'}]` — already designed for multiple contexts per participant. But:

- Today the matching engine only considers `personal` context.
- `songs_select_jam_coparticipant` only allows reading other users' personal songs.

**To support "share my Indigo Refugee band's catalog into the jam":**

- Widen the matching engine to read songs by any `(type, id)` in `shared_contexts`
- Widen the songs RLS policy: `songs_select_jam_coparticipant` becomes `songs_select_jam_shared` and checks `EXISTS (SELECT 1 FROM jam_participants WHERE shared_contexts @> ...)`
- Add UI to pick which contexts to share when joining

**Not breaking** — the JSONB field is already there. Just unused complexity right now. Decide: ship the multi-context feature now, or simplify the JSONB to `personal_only` boolean and add it back later?

---

### G4 — Copying songs between users (provenance)

**User mentioned:** "copying others songs to your setlist".

**Today:** `SongLinkingService.copyBandSongToPersonal()` copies a band song into a user's personal catalog (no provenance tracking — just a deep copy). Songs have `song_groups` for variant grouping but no "this is a copy of song X" link.

**Question — what does "copy" mean for the user?**

| Mode                                                                                       | Schema impact                                                                                                                               |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Deep copy, no link** (current)                                                        | None                                                                                                                                        |
| **B. Deep copy + provenance** ("forked from")                                              | Add `songs.forked_from_song_id UUID NULL REFERENCES songs(id) ON DELETE SET NULL`                                                           |
| **C. Reference, not copy** ("I share access to your song")                                 | Major — needs a `song_subscribers` table with RLS rewrite                                                                                   |
| **D. "Add to setlist by reference"** (setlist points to other user's song without copying) | The setlist `items` JSONB just stores a `songId` — already works, but RLS forbids reading other users' personal songs unless co-participant |

The user's specific phrasing "copying others songs to your setlist" suggests B or D. **D is appealing** because it avoids data duplication, but it means a setlist becomes "broken" if the source user deletes the song. B is safer.

**Recommendation:** Discuss with user. If B: tiny migration. If D: bigger RLS change to allow "songs visible if referenced in a setlist I own."

---

### G5 — In-session setlist builder + broadcast (Priority 1 from goals doc)

**Goal:** Host builds an ordered, reorderable setlist live during the jam. Participants and anon viewers see updates in real time.

**Today:**

- `jam_sessions.settings` JSONB has a vague `hostSongIds` field used as a flat array (no explicit ordering, no breaks/sections).
- Only saved to `setlists.items` at the very end via `saveAsSetlist`.
- Edge Function public payload doesn't include the working setlist.

**What's needed:**

1. **Either** promote the working setlist to a column on `jam_sessions`:

   ```sql
   ALTER TABLE jam_sessions ADD COLUMN working_setlist_items JSONB NOT NULL DEFAULT '[]';
   ```

   Realtime updates already work for jam_sessions. Easy. Same JSONB shape as `setlists.items`.

2. **Or** allow drafting an actual `setlists` row mid-session linked to `jam_sessions.id`, and just build it in place. More normalized but adds a "draft setlist that's not really a setlist yet" state.

**Recommendation:** Option 1 for now. Promote to a real setlist on save (already happens via `saveAsSetlist`). One JSONB field, one source of truth, realtime works out of the box.

---

### G6 — Participant nomination queue (Priority 3 from goals doc)

**Goal:** Participants tap a song → "nominate" → host sees a queue → accepts (moves to setlist) or skips.

**Schema needed:** New table.

```sql
CREATE TABLE jam_song_nominations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jam_session_id UUID NOT NULL REFERENCES jam_sessions(id) ON DELETE CASCADE,
  nominated_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Either an existing match or an external song
  match_id UUID REFERENCES jam_song_matches(id) ON DELETE CASCADE,
  external_title TEXT,
  external_artist TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'skipped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id),
  CHECK (match_id IS NOT NULL OR (external_title IS NOT NULL AND external_artist IS NOT NULL))
);
```

Trivial table. RLS: participants can insert + see; host can update status.

**Decide now or when we build it?** Easy to add later. Defer unless we want it as a stretch goal alongside Priority 1.

---

### G7 — Tier limits live in code, not data

`users.account_tier` exists ('free' or 'pro'). Per the plan: free = 24h sessions / unlimited participants; pro = 7-day sessions.

**Today:** No table holds these limits. Hard-coded in `JamSessionService.create()` (probably).

**Forward-compat:** When a third tier or a custom-band tier is added, every limit needs a code change.

```sql
CREATE TABLE tier_limits (
  tier TEXT PRIMARY KEY,
  max_jam_session_hours INTEGER NOT NULL,
  max_concurrent_jams INTEGER,
  max_bands_per_user INTEGER,
  ...
);
```

Cheap to add. Defer until we have a second tier. Worth noting now so we don't sprinkle magic numbers.

---

## Recommendations: Three Phases

### Phase A — Fix now (small, safe, unblocks current work)

1. **RLS-1** — Add `user_profiles_select_jam_coparticipant` policy. Drop the PostgREST embed in `RemoteRepository.getJamParticipants`, use parallel `.in('user_id', [...])` query.
2. **RLS-2** — Tighten `users_select_authenticated`. Replace with self + band-co-member + jam-co-participant policies. (Privacy fix.)
3. **Schema doc** — Add the drift items: `last_active_at`, the 7 policy-less RLS tables, `songs_select_jam_coparticipant`.

**Total: ~30 minutes including `supabase db reset` and re-running tests.**

### Phase B — Decide before next feature work

Before building the in-session setlist builder, the user has to decide:

| Decision                                                 | Options                                                         | Default if no answer       |
| -------------------------------------------------------- | --------------------------------------------------------------- | -------------------------- |
| Anonymous contribution? (G1)                             | (a) view-only forever (b) nominate-only (c) full participant    | (a) view-only              |
| Multi-band catalog sharing in jams? (G3)                 | (a) personal-only forever (b) any context                       | (a) personal-only          |
| What does "copy a song to my catalog/setlist" mean? (G4) | (a) deep copy, no link (b) deep copy + provenance (c) reference | (b) deep copy + provenance |
| Working setlist live in session? (G5)                    | (a) JSONB on jam_sessions (recommended) (b) draft setlist row   | (a)                        |
| Nomination queue in this batch? (G6)                     | (a) yes (b) defer                                               | (b) defer                  |

### Phase C — Pre-1.0 cleanup (do once, before production data exists)

1. **R1** — Replace polymorphic `context_type`+`context_id` TEXT with real FKs (`band_id UUID NULL` + `personal_owner_id UUID NULL` + `CHECK exactly_one`). Updates RLS policies. Bigger churn but eliminates a class of bugs and orphan data.
2. **R3** — Drop `bands.memberIds` from IndexedDB schema. Derive from `bandMemberships`.
3. **G2** — Add `users.preferred_band_id` for cross-device "current band" persistence.
4. **G7** — Add `tier_limits` table when we add a second tier.
5. **RLS-3** — Either drop the 7 unused tables (cleaner) or add minimal SELECT policies (preserves them for future use).

---

## Open Questions for Product

1. **Anonymous interaction depth.** What can a non-signed-in person do in a jam beyond viewing? (Drives G1 + G3 + the entire next set of RLS rewrites.)
   I think just viewing for now makes sense--maybe after we get it fully ironed out they could just type in a song name and band name as text fields (not an actual song with key, time, etc unless they make an account)--but showing manual entered songs versus app songs could get messy.
2. **Song copy semantics.** When a participant "saves" a jam-session output to their own catalog/setlist, are they copying songs or referencing them? Does the copy break if the original deletes their song? (Drives G4.)
   Let's do a full copy of the song to their own catalog--no need to link it back to the original users.
3. **Multi-band UX.** Today the app forces exactly one "current band" before showing most pages. Do we want an "all my bands" or "no band" state? (Affects how Personal context works alongside band context, and whether `currentBandId` should ever be null.)
   I think in terms of setlists, shows, and practices you should have to be in one specific band (displayed in the top left menu). However, I could see a use-case for having the master song catalog have an option to show all songs across all bands--if we can find a way to signify a song is from a bands setlist vs personal or something to that effect.
4. **Setlist as a fork target.** Should saving a jam setlist let you target a band's catalog (so the songs become available to that band), not just personal? Today `saveAsSetlist` makes a personal setlist only.
   I think jam sessions should remain personal setlists at this point, someone should also be able to start a jam and refer to a personal setlist to build the jam playlist.
5. **Tier limits.** When are we turning Pro on, and what's the differentiator? (Affects whether to invest in `tier_limits` now.)
   I think the limits for jam session will be one active jam session at a time for free. Pro users could keep long-running jam sessions for recurring events with the same people, as sort of a lightweight-band.

---

## What I'd Do Next (recommendation)

1. You answer the 5 product questions (or pick the defaults from the table above).
2. I refresh `unified-database-schema.md` with drift fixes + new policies + answers from #1.
3. I apply Phase A as a single baseline-migration edit + targeted code changes + `supabase db reset`.
4. I write a short follow-up artifact for whichever Phase B / C items are now decided, so the work is queued for the next session.

This way we don't accidentally migrate the same area three times in three weeks.
