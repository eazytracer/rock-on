# 04 · Data: what the design needs, against this schema

Source: `design_handoff_rock_on_refresh/DATA-IMPLICATIONS.md` and `source/CHART-DATA-MODEL.md` in the design project,
diffed against `supabase/migrations/` and `src/models/` on `main` (v0.5.0). Schema of record:
`.claude/specifications/unified-database-schema.md`; update it in the same PR as any change below.

**exists** = no schema work · **change** = alter an existing table / type · **new** = new table or column.
Every new table needs explicit `GRANT`s for `authenticated` and `service_role`, RLS, and a repository method.
The app is online-only (Part A · 3): no local mirror. The operations each table serves are in `design/OPERATIONS.md`. One migration per release (see 05-plan).

## Users and preferences

| Design needs | Status | Notes |
|---|---|---|
| Display name, photo, instruments | exists | `user_profiles.display_name`, `avatar_url`, `instruments TEXT[]` |
| Instruments as an **ordered** list, **no primary** | change | **Decided (Part A · 5).** Order of `instruments[]` is the display order. Migration moves today's `primary_instrument` to the front of the array, then the app stops reading / writing it (drop the column later). `User.ts`: remove `primaryInstrument` from forms |
| Personal context colour (user-pickable, default indigo) | new | `user_profiles.personal_color TEXT` (hex) |
| Theme (system / light / dark) | new | `user_preferences` (below) |
| Song list view per list (density + fields) and sort (field + direction) | new | `user_preferences.list_views JSONB` keyed by list id (`songs:<contextId>`, `setlist:<id>`) |
| Setlist timeline mode, chart text size + chord labels, metronome settings | new | `user_preferences` JSONB columns: `timeline`, `chart`, `metronome` |
| Push: master switch, per type, per-band mute, quiet hours | new | `user_preferences.push JSONB`. Delivery itself is a later phase |
| Friend code, discoverable, who can send requests | exists | `friend_requests`, `friendships`, friend code + policy (0.4) |

```sql
-- sketch: one row per user, synced
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id     UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  theme       TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('system','light','dark')),
  list_views  JSONB NOT NULL DEFAULT '{}'::jsonb,
  timeline    JSONB NOT NULL DEFAULT '{}'::jsonb,
  chart       JSONB NOT NULL DEFAULT '{}'::jsonb,
  metronome   JSONB NOT NULL DEFAULT '{}'::jsonb,
  push        JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version     INTEGER NOT NULL DEFAULT 1
);
-- RLS: own row only. GRANT … TO authenticated, service_role.
```

## Bands and membership

| Design needs | Status | Notes |
|---|---|---|
| Name, description | exists | `bands.name`, `description` |
| Band mark `{kind: initials | symbol | photo, initials, lettering, symbol, colour, image_url}` | new | `bands.mark JSONB` (default initials from the name, orange) |
| City, region, country, genres[], links[], visibility | new | `bands.city`, `region`, `country`, `genres TEXT[]`, `links JSONB`, `visibility TEXT DEFAULT 'private'` (public profile later) |
| Roles **owner / admin / member**, exactly one owner, transfer | change | **Decided (Part A · 4).** Today owner is a flag: `'owner' = ANY(band_memberships.permissions)`. Add `'owner'` to `membership_role_check`; backfill flag holders as `role='owner'` (several → earliest joined wins, the rest become admin; none → `bands.created_by`, or the earliest admin if the creator left); drop the flag checks from functions and policies; add a partial unique index `(band_id) WHERE role='owner'`, and a `transfer_band_ownership(band_id, to_user)` SECURITY DEFINER function (owner → admin, target → owner, one transaction) |
| Invite code + link, regenerable (old stops working), preview before join | exists | `invite_codes.is_active`. Regenerate = deactivate + insert. Preview needs a read of band name / mark / member first names / song count by code before joining: add an RPC `band_preview_by_code(code)` |
| Leave; delete band (typed, owner only) | exists / change | Delete is a soft `bands.is_active=false`; confirm the RLS path for owner-only |

## Songs, notes, charts, tunings

| Design needs | Status | Notes |
|---|---|---|
| Title, artist, album, key, BPM, duration, tuning (built-in or custom), links, context, created_by | exists | `songs.*`, `tuning_id` → `tunings`, `reference_links` |
| Link types tabs / audio / video / lyrics / cloud / link + order | change | Normalise `reference_links[].type` to these six (`utils/linkDetection.ts`); order = array order |
| Band note (one per song, shared, Markdown, last editor + when) and My notes (private) | change | **Decided (Part A · 7).** The band note is `songs.notes`; add `notes_edited_by UUID` and `notes_edited_at TIMESTAMPTZ` if the audit trail isn't enough. `song_note_entries` stay as the **practice log** (a "Practice log · N" link on the song view). `song_personal_notes` = My notes |
| Hidden per user | exists | `song_hidden` |
| Copy into a band / linked copies ("from ‹band›") | exists | `linked_from_song_id`, `song_groups` |
| **Chart** (ChordPro text) + **starting note** (MIDI) | new | `song_charts (song_id PK/FK, chordpro TEXT, starting_note SMALLINT, updated_by, updated_date, version)` per `CHART-DATA-MODEL.md`. Separate table so the songs row stays light and sync can skip it. Transpose and size are view state (`user_preferences.chart`) |
| BPM written back from the metronome | exists | normal `updateSong` |
| Custom tunings: name, instrument, string count, pitches, colour; duplicate check | exists | `tunings` (0.4). Duplicate check is client-side on `pitches`; enforce with a unique index `(context_id, instrument, string_count, pitches)` |
| C Standard and the 7-string / 5-string built-ins | change | Seed rows in `tunings` (is_builtin) |

## Setlists

| Design needs | Status | Notes |
|---|---|---|
| Name, context, notes, items (song / break with minutes + note / section), per-set song note | exists | `setlists.items` (`SetlistItem.type`, `breakDuration`, `breakNotes`, `sectionTitle`, `notes`) |
| Sort by Next show / Name / Updated | exists | `show_id` / `show_date`, `name`, `last_modified` |
| Totals, retunes, start times | derived | Don't store |

## Calendar

| Design needs | Status | Notes |
|---|---|---|
| Show: start, load-in, soundcheck, slot length, venue (name, address), pay, contacts, notes | exists | `shows.*` (`duration` = slot length, `payment` in cents) |
| Confirmed (bool) and Cancelled (kept, struck through, undo) | change | **Decided (Part A · 6).** Add `shows.confirmed BOOLEAN NOT NULL DEFAULT false`; `status` keeps scheduled / cancelled / completed. Backfill `status='confirmed'` → `confirmed=true, status='scheduled'`, then drop `confirmed` from the status check. Undo of Cancelled restores the previous `status` and leaves `confirmed` alone |
| **Set = a copy** of setlist items (`copied_from_setlist_id`, `copied_at`, Re-copy) | change | `setlists.show_id` and `source_setlist_id` exist (Version 5/6). Model the show's set as its own setlist row with `show_id` set and `source_setlist_id` pointing at the original; add `copied_at TIMESTAMPTZ`. `shows.setlist_id` then points at the copy |
| RSVP per member on shows **and practices** (going / maybe / can't) | new | `calendar_rsvps (id, item_type 'show'|'practice', item_id, user_id, rsvp, updated_date)` unique `(item_type, item_id, user_id)`. Events already have `event_participants.rsvp`; same values. Drawn now, ships after launch (DECISIONS) — table can wait for that release |
| Practice: start, duration, location, focus, songs with a per-practice note | exists | `practice_sessions` (`duration`, `notes` = focus, `songs JSONB` with `notes`) |
| Session / history: started / ended, elapsed, songs reached with time, skipped, wrap-up notes, attendance | exists / change | `start_time`, `end_time`, `wrapup_notes`, `songs[].timeSpent`, `songs[].status`, `attendees`. Add `skipped` to the song status enum if absent. Practice history (a query, not a table) is **deferred** (Part A · 8), but keep recording the data |
| One calendar of three types (show, practice, jam) | exists | Union in `useEvents` / calendar service; jams come from `events` (option A) |

## Jams — option A: on the Events tables (Part A · 2)

| Design needs | Status | Change |
|---|---|---|
| Host(s), venue, start, join code, QR / link, web view without an account | exists | `events` (`host_user_id`, `venue`, `scheduled_date`, `short_code`, `view_token`); co-hosts via `event_participants.access_tier` |
| Status **planned → live → ended** | change | `events.status` today: scheduled / confirmed / completed / cancelled. Add `live`; the UI maps scheduled = planned, completed = ended |
| Who can join; requests on; approve myself; group size; lock joining | change | `visibility`, `allow_suggestions`, `auto_approve` exist. Add `group_size SMALLINT` (0, 1–5) and `joining_locked BOOLEAN DEFAULT false` |
| People: accounts, walk-ups, kiosk entries, web guests, house players | change | `event_participants.user_id` is NOT NULL → make it nullable; add `guest_name TEXT` (≤ 40), `via TEXT CHECK (via IN ('app','web','walkup','kiosk'))`, `is_house BOOLEAN DEFAULT false`, `parts TEXT[]`; CHECK `user_id IS NOT NULL OR guest_name IS NOT NULL` |
| Web-guest token, scoped to one jam, ends with it | new | `event_guest_tokens (token_hash PK, event_id, participant_id, created_at, revoked_at)`. Issued by a `join_jam_as_web_guest` RPC or edge function (anonymous, rate-limited per IP); every guest write checks the hash, the event and `revoked_at`. Store only the hash. GRANTs to `service_role` (and `authenticated` only if RPCs run as the caller) |
| Pitches: song (catalog or free text), pitched by, parts needed | exists / change | `event_lineup_requests` + `event_lineup_items`; add `parts_needed TEXT[]` and `pitched_by_participant UUID` (so a web guest can pitch) |
| Hands: person, song, part | change | `event_hands (lineup_item, role_key, user_id, status)` → add `participant_id` (nullable `user_id`, as above) |
| Queue: order and state queued / up next / on stage / played / left / removed | change | Add `event_lineup_items.state` with that CHECK; keep `position` |
| "Who knows your songs" (guests' shared catalogs) | new | `event_participants.shared_contexts UUID[]` (the 0.3 `jam_participants.shared_contexts` idea); the read is `who_knows_your_songs` in OPERATIONS §13. Replaces `jam_song_matches` |
| End: delete walk-up, kiosk and web-guest names | rule | `end_jam` nulls `guest_name` (or deletes those participants) and revokes tokens in one transaction |
| Live updates, TV shows first names and parts only | exists | Realtime on `event_*`; the TV feed is a narrow read (`jam_tv_feed`) |
| Casting | kept, hidden | `band_roles` / `casting_*` stay; UI behind `CASTING` |
| 0.3 jam sessions | retire | `jam_sessions`, `jam_participants`, `jam_song_matches`: stop writing in the Jam phase; drop in a later release after checking prod has nothing worth migrating |

## Notifications

| Design needs | Status | Notes |
|---|---|---|
| Activity: actor, verb, object, context (band or none), read_at; never your own actions | exists / change | `notifications (kind, title, body, link, payload, read_at)`. Put actor / object / band in `payload`; filter own actions at write time |
| App updates with seen state | exists | `release_notes` + `users.last_seen_release_version` |
| Push (small set) | later | Preferences now (`user_preferences.push`); delivery in a later phase |

## Parked

Band history / restore (`audit_log` exists; no UI), public band profile (fields above leave room), casting as a Pro feature (tables exist; see 06).
