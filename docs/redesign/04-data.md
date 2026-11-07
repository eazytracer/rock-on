# 04 · Data: what the design needs, against this schema

Source: `design_handoff_rock_on_refresh/DATA-IMPLICATIONS.md` and `source/CHART-DATA-MODEL.md` in the design project,
diffed against `supabase/migrations/` and `src/models/` on `main` (v0.5.0). Schema of record:
`.claude/specifications/unified-database-schema.md`; update it in the same PR as any change below.

**exists** = no schema work · **change** = alter an existing table / type · **new** = new table or column.
Every new table needs explicit `GRANT`s for `authenticated` and `service_role`, RLS, an IndexedDB mirror if it
must work offline, and a repository method (never `db.*` directly). One migration per release (see 05-plan).

## Users and preferences

| Design needs | Status | Notes |
|---|---|---|
| Display name, photo, instruments | exists | `user_profiles.display_name`, `avatar_url`, `instruments TEXT[]` |
| Instruments as an **ordered** list, **no primary** | change | Order of `instruments[]` is the display order. Stop reading / writing `primary_instrument` (leave the column; drop later). `User.ts`: remove `primaryInstrument` from forms |
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
| Roles **owner / admin / member**, exactly one owner, transfer | change | `membership_role_check` allows `admin, member, viewer` only, while some functions already test `role IN ('admin','owner')` (baseline line ~1021). Add `'owner'` to the check, backfill the creator (`bands.created_by`) as owner, add a partial unique index `(band_id) WHERE role='owner'`, and a `transfer_band_ownership(band_id, to_user)` SECURITY DEFINER function (owner → admin, target → owner, one transaction) |
| Invite code + link, regenerable (old stops working), preview before join | exists | `invite_codes.is_active`. Regenerate = deactivate + insert. Preview needs a read of band name / mark / member first names / song count by code before joining: add an RPC `band_preview_by_code(code)` |
| Leave; delete band (typed, owner only) | exists / change | Delete is a soft `bands.is_active=false`; confirm the RLS path for owner-only |

## Songs, notes, charts, tunings

| Design needs | Status | Notes |
|---|---|---|
| Title, artist, album, key, BPM, duration, tuning (built-in or custom), links, context, created_by | exists | `songs.*`, `tuning_id` → `tunings`, `reference_links` |
| Link types tabs / audio / video / lyrics / cloud / link + order | change | Normalise `reference_links[].type` to these six (`utils/linkDetection.ts`); order = array order |
| Band notes (shared, Markdown, edited_by / edited_at) and My notes (private) | exists | `song_note_entries` (band, visibility) + `song_personal_notes`. The design shows **one** band note per song with its last editor, not a feed: render the latest band entry, or collapse to one row — decide in the Songs phase |
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
| Confirmed (bool) and Cancelled (kept, struck through, undo) | change | Both live in `shows.status` today (`scheduled / confirmed / completed / cancelled`). A cancelled show that was confirmed loses that fact on Undo. Add `confirmed BOOLEAN` and keep `status` for scheduled / cancelled / completed, or accept the loss — small; decide in the Calendar phase |
| **Set = a copy** of setlist items (`copied_from_setlist_id`, `copied_at`, Re-copy) | change | `setlists.show_id` and `source_setlist_id` exist (Version 5/6). Model the show's set as its own setlist row with `show_id` set and `source_setlist_id` pointing at the original; add `copied_at TIMESTAMPTZ`. `shows.setlist_id` then points at the copy |
| RSVP per member on shows **and practices** (going / maybe / can't) | new | `calendar_rsvps (id, item_type 'show'|'practice', item_id, user_id, rsvp, updated_date)` unique `(item_type, item_id, user_id)`. Events already have `event_participants.rsvp`; same values. Drawn now, ships after launch (DECISIONS) — table can wait for that release |
| Practice: start, duration, location, focus, songs with a per-practice note | exists | `practice_sessions` (`duration`, `notes` = focus, `songs JSONB` with `notes`) |
| Session / history: started / ended, elapsed, songs reached with time, skipped, wrap-up notes, attendance | exists / change | `start_time`, `end_time`, `wrapup_notes`, `songs[].timeSpent`, `songs[].status`, `attendees`. Add `skipped` to the song status enum if absent. Practice history is a query, not a table |
| One calendar of three types (show, practice, jam) | exists | Union in `useEvents` / calendar service; jam source depends on 06 |

## Jams — depends on the Events vs Jam decision (06)

What the design needs, and where it could live:

| Design needs | Events tables (0.4) | Jam tables (0.3) |
|---|---|---|
| Host(s), venue, start, join code, QR / link, web view without an account | `events` (`host_user_id`, `venue`, `scheduled_date`, `short_code`, `view_token`) ✓ | `jam_sessions` (`short_code`, `view_token`) ✓ |
| Status **planned → live → ended** | change: `events.status` has scheduled / confirmed / completed / cancelled; add `live` | change: `active / expired / saved` |
| Who can join; song requests on; approve myself; group-set length | `visibility`, `allow_suggestions`, `auto_approve` ✓; add `group_size SMALLINT` | `settings JSONB` |
| People: accounts, **walk-ups by name only**, web guests, kiosk entries, house players | change: `event_participants.user_id` is NOT NULL → add `guest_name`, make `user_id` nullable, add `via` ('app','web','walkup','kiosk') and `is_house` | `jam_participants` (accounts only) |
| Pitches / requests: song, pitched by, parts needed with who fills each | `event_lineup_requests` + `event_lineup_items` ✓ (parts via `band_roles` / casting) | `jam_song_matches` (no parts) |
| Hands: person, song, part(s) | `event_hands (lineup_item, role_key, user_id, status)` ✓ | — |
| Queue: ordered groups with state queued / up next / on stage / played / left / removed | change: add `event_lineup_items.state` + keep `position` | — |
| Guest's shared songs (for "who knows your songs") | `source` + `owner_id` on lineup items; sharing choice per guest is new | `jam_participants.shared_contexts` ✓ |
| Live updates in-app (realtime), TV shows first names and parts only | realtime on `event_*` | realtime on `jam_*` |

The Events tables already model most of the jam design (lineup, requests, hands per part, RSVP, codes). That's
input for the decision in 06, not a decision.

## Notifications

| Design needs | Status | Notes |
|---|---|---|
| Activity: actor, verb, object, context (band or none), read_at; never your own actions | exists / change | `notifications (kind, title, body, link, payload, read_at)`. Put actor / object / band in `payload`; filter own actions at write time |
| App updates with seen state | exists | `release_notes` + `users.last_seen_release_version` |
| Push (small set) | later | Preferences now (`user_preferences.push`); delivery in a later phase |

## Parked

Band history / restore (`audit_log` exists; no UI), public band profile (fields above leave room), casting as a Pro feature (tables exist; see 06).
