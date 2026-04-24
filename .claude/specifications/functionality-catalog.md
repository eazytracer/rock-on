---
title: Rock-On Functionality Catalog
created: 2026-04-22
updated: 2026-04-22
status: Living document — update when features land, deprecate, or change shape
purpose: Single-file plain-English index of everything the app does, with a line to each test that covers it. Not a spec; not Gherkin. A map for anyone asking "does X get tested? where?"
---

# Rock-On Functionality Catalog

This file is the master index of what the app does and where it's tested. Organized by domain. Each entry names a user-visible capability in one or two sentences, then lists tests that exercise it. Keep entries short; point to the test file for detail.

## How to use this document

- **Looking for coverage gaps?** Scroll the domain you care about. Entries with `(no tests)` or missing categories are candidates.
- **Adding a new capability?** Add a new entry in the right domain. Reference any new tests by relative path. If the capability covers multiple domains (e.g. "jam setlist-saving creates a personal setlist"), pick the primary domain and cross-link in the body.
- **Deleting a capability?** Delete the entry. Dangling test references point to retired tests. Don't leave "deprecated" entries — use git history.

## Entry template

Every capability entry should answer three questions: who is allowed, who is NOT allowed, and how we prove both. Copy this template when adding a new entry:

```markdown
### Capability name

One-sentence description of what this capability does from the user's
perspective.

**Who can:** `<role or condition>` — what they can do.
**Who cannot:** `<role or condition>` — what they should be blocked from;
expected error surface (403 / 404 / empty list / "unauthorized" toast).

**Tests:**

- Positive (allowed): `<path/to/test>`
- Negative (denied): `<path/to/test>`
- Role grants (db): `supabase/tests/008-role-grants.test.sql` — if any new tables
- RLS policy (db): `supabase/tests/006-rls-policies.test.sql` — if scoped by RLS
```

**Role vocabulary** (standard terms used throughout the catalog):

- `anonymous` — unauthenticated caller (no JWT)
- `authenticated` — any signed-in user
- `self` — the user performing the action on their own resource
- `band member` — user with `band_memberships.status = 'active'` for the target band
- `band admin` — user with role `admin` or `owner` on the target band
- `jam host` — user whose id matches `jam_sessions.host_user_id`
- `jam participant` — user with `jam_participants.status = 'active'` in the target session
- `jam co-participant` — both the caller and the owner of the resource are active participants in the same active jam session

Negative-test paths are as important as positive. A missing grant or a drifting RLS policy is caught by a negative test that asserts "X cannot do Y" — the positive tests don't catch the regression where X gains access unintentionally.

## Test categories

| Category    | Path                        | When it runs                                                        |
| ----------- | --------------------------- | ------------------------------------------------------------------- |
| unit        | `tests/unit/`               | `npm test` / `npm run test:quick`                                   |
| integration | `tests/integration/`        | `npm test`                                                          |
| journey     | `tests/journeys/`           | `npm test` (requires local Supabase)                                |
| contract    | `tests/contract/`           | `npm test` (requires local Supabase)                                |
| e2e         | `tests/e2e/`                | `npm run test:e2e`                                                  |
| db          | `supabase/tests/*.test.sql` | `npm run test:db`                                                   |
| harness     | `scripts/test-harness/`     | Manual CLI (`npm run harness -- ...`); drives real multi-user flows |

---

## 1. Authentication & Session

### Email/password signup

A new user can create an account with email + password and is brought into the app post-signup.

- e2e: `tests/e2e/auth/signup.spec.ts`, `tests/e2e/auth/signup-debug.spec.ts`

### Email/password login

An existing user can log in and is routed into the last active band.

- e2e: `tests/e2e/auth/login-smoke.spec.ts`

### Google OAuth login

Users can sign in via Google; tokens persist in the browser session.

- (no tests — covered manually; gap)

### Protected routes

Unauthenticated users redirected to `/auth` with reason indicators (`session-expired`, `session-invalid`, `no-band`).

- e2e: `tests/e2e/auth/protected-routes.spec.ts`
- unit: `tests/unit/hooks/useAuthCheck.test.tsx`

### Session expiry + grace period

Expired sessions get a 1.5-hour grace; stale-session cleanup on expiry. Same-tab sign-out propagates without reload.

- e2e: `tests/e2e/auth/session-expiry.spec.ts`
- journey: `tests/journeys/auth-journeys.test.ts`

### Persistent layout

Sidebar + navbar stay mounted across route changes; no white flicker.

- e2e: `tests/e2e/layout/persistent-layout.spec.ts`

### Join band via invite

A user can accept a band invite and be added as an active member.

- e2e: `tests/e2e/auth/join-band.spec.ts`

---

## 2. Bands & Membership

### Create a band

Authenticated user creates a band and becomes its first active member (owner role).

- unit: `tests/unit/services/BandService.test.ts`, `tests/unit/services/BandMembershipService.test.ts`
- e2e: `tests/e2e/bands/create-band.spec.ts`

### Switch current band

User with multiple memberships can switch context; `currentBandId` in localStorage drives page data.

- unit: `tests/unit/hooks/useBands.test.ts`
- e2e: `tests/e2e/bands/band-isolation.spec.ts`

### Manage members (invite, remove, role change)

Owners/admins can invite, remove, or change roles of members.

- unit: `tests/unit/hooks/useBands.test.ts`
- e2e: `tests/e2e/bands/manage-members.spec.ts`, `tests/e2e/permissions/rbac.spec.ts`

### Band data isolation (RLS)

User in band A cannot read songs, setlists, shows, practices of band B.

- db: `supabase/tests/006-rls-policies.test.sql`, `supabase/tests/007-rls-band-isolation.test.sql`
- e2e: `tests/e2e/bands/band-isolation.spec.ts`

---

## 3. Songs & Catalog

### Create / edit / delete song in band catalog

Users create songs tied to a band (`context_type='band'`) with title, artist, key, tempo, difficulty, tuning, notes.

- unit: `tests/unit/services/SongService.test.ts`
- contract: `tests/contract/songs-api.test.ts`
- e2e: `tests/e2e/songs/crud.spec.ts`

### Personal songs catalog

Users keep a personal catalog (`context_type='personal'`) separate from any band. Only the owner can see/edit their personal songs unless shared via a jam session.

- unit: `tests/unit/hooks/usePersonalSongs.test.ts`
- e2e: `tests/e2e/songs/personal-songs.spec.ts`

### Search / filter songs

Full-text search by title or artist; filter by key, tempo range, difficulty, tuning.

- e2e: `tests/e2e/songs/search-filter.spec.ts`

### Reference links on songs

Songs can carry external reference URLs (YouTube, Spotify, chord charts, etc.). Detection auto-labels known hosts.

- unit: `tests/unit/utils/linkDetection.test.ts`
- integration: `tests/integration/RemoteRepository.links.test.ts`
- e2e: `tests/e2e/songs/reference-links.spec.ts`

### Spotify song search (edge function)

A deployed `spotify-search` Edge Function performs Spotify metadata lookup.

- (no tests; covered manually)

### Copy band song to personal

A user can clone a band song into their own personal catalog (deep copy, no provenance link per current product decision).

- unit: inside `tests/unit/hooks/usePersonalSongs.test.ts` and `tests/unit/services/SongService.test.ts`

### Sync queue guardrail

Direct `db.*` writes outside the storage layer are rejected; new violations fail the build.

- unit: `tests/unit/guardrails/db-direct-write.test.ts`

---

## 4. Setlists

### Create band setlist

Users create setlists scoped to a band, composed of song references + break/section items in JSONB.

- unit: `tests/unit/services/SetlistService.test.ts`, `tests/unit/pages/SetlistsPage.test.tsx`
- contract: `tests/contract/setlists-api.test.ts`

### Personal setlists

Users create setlists tied to their personal catalog (not to any band).

- unit: `tests/unit/hooks/usePersonalSetlists.test.ts`
- e2e: `tests/e2e/setlists/personal-setlists.spec.ts`

### Reorder setlist items

Drag-to-reorder songs, breaks, and section headers.

- e2e: covered in `tests/e2e/setlists/personal-setlists.spec.ts`

### View setlist

Read-only presentation at `/setlists/:id`.

- unit: covered by `tests/unit/pages/SetlistsPage.test.tsx`

### Setlist + show sync

Editing a setlist that's referenced by a show updates the show's displayed setlist live.

- e2e: `tests/e2e/sync/setlist-show-sync.spec.ts`

---

## 5. Shows (Gigs)

### Create / edit show

A show is a date-bound event referencing one or more setlists and a venue.

- (no dedicated unit test — gap)
- e2e: partial coverage in `tests/e2e/sync/setlist-show-sync.spec.ts`

### View show

Read-only show detail at `/shows/:id`.

- (no dedicated test — gap)

---

## 6. Practice Sessions

### Create practice session

Users plan practices tied to a band, optionally based on a setlist or custom song picks.

- unit: `tests/unit/services/PracticeSessionService.test.ts`
- contract: `tests/contract/practice-sessions-api.test.ts`
- e2e: `tests/e2e/practices/crud.spec.ts`

### Run an active practice session

Active practice view with song-by-song navigation and notes.

- e2e: `tests/e2e/practices/session.spec.ts`

### Audit log + real-time sync of practice changes

Practice edits create audit entries; other band members see updates live.

- journey: `tests/journeys/realtime-sync-journeys.test.ts`

---

## 7. Jam Sessions (Social Catalog)

### Create jam session

A host creates a short-lived jam (24h free tier) with a 6-char `short_code` join key, a hashed view token for anonymous-read sharing, and an empty participant list.

**Who can:** any `authenticated` user, becoming the `jam host` of the new row (`jam_sessions.host_user_id = auth.uid()`).
**Who cannot:** `anonymous` — no JWT → 401 at gateway. An authenticated user trying to create a session with `host_user_id` set to someone else → 403 from `jam_sessions_insert` policy (`WITH CHECK (host_user_id = auth.uid())`).

**Tests:**

- Positive (allowed): `tests/unit/services/JamSessionService.test.ts`
- Positive (harness): `scripts/test-harness/commands/create-jam.ts`
- Negative (RLS denies foreign host_user_id): `supabase/tests/006-rls-policies.test.sql` (policy existence + WITH CHECK shape)
- Role grants (db): `supabase/tests/008-role-grants.test.sql`

### Join jam by short code

An authenticated user looks up a session by `short_code` and inserts themselves into `jam_participants`, sharing their personal catalog contexts by default.

**Who can:** any `authenticated` user (session row is visible via `jam_sessions_select_by_code` policy since status='active'; insert into `jam_participants` requires `user_id = auth.uid()`).
**Who cannot:** `anonymous` — 401. Authenticated user trying to insert a jam_participants row with a different user_id → 403 from `jam_participants_insert_self` policy.

**Tests:**

- Positive (allowed): `tests/unit/hooks/useJamSession.test.ts`, `scripts/test-harness/commands/join-jam.ts`
- Negative (RLS denies foreign user_id insert): `supabase/tests/006-rls-policies.test.sql`
- Role grants (db): `supabase/tests/008-role-grants.test.sql`

### Resume active jam

`/jam` landing shows "return to active jam" cards for sessions the user hosts or participates in.

**Who can:** `authenticated` user — sees sessions where they are `jam host` OR `jam participant` (active).
**Who cannot:** `anonymous`; authenticated users who are not host or participant — their list is empty (not an error).

**Tests:**

- Positive: `tests/unit/hooks/useJamSession.test.ts`

### Cross-user personal-song reads (RLS)

Participants in the same active jam can read each other's personal songs via `songs_select_jam_coparticipant`. Other personal songs remain hidden.

**Who can:** `jam co-participant` — both caller and song owner are active participants in the same active jam session.
**Who cannot:** `authenticated` users not in a shared jam — 0 rows returned (RLS filter). `anonymous` — 401. Even a co-participant cannot read the owner's band-scoped songs through this policy (only `context_type = 'personal'`).

**Tests:**

- Positive (allowed): `scripts/test-harness/commands/recompute.ts` (full flow `seed-songs alice; seed-songs bob; create-jam alice; join-jam bob; recompute` succeeds only if the RLS policy permits bob's catalog read for alice during recompute)
- Negative (denied outside shared session): covered by harness state — before `join-jam`, recompute returns no matches because alice can't see bob's songs
- RLS policy (db): `supabase/tests/006-rls-policies.test.sql`
- Matcher logic (unit, no RLS): `tests/unit/utils/songMatcher.test.ts`

### Anonymous view via short-code link

Host shares `/jam/view/<short_code>?t=<raw_token>`. Anonymous viewers hit the `jam-view` edge function which verifies the SHA-256 hash of the raw token against `jam_sessions.view_token` and returns a scrubbed payload (no emails, no user IDs, no raw catalog data). The payload is the host's curated broadcast setlist (`setlist[]` from `jam_sessions.settings.setlistItems`) plus session metadata (host display name, participant count) — intentionally NOT the common-songs match list (dropped in v0.3.2: anon viewers have no personal catalog so the match set is irrelevant to them).

**Who can:** `anonymous` with a valid `short_code + raw_token` pair. Host is identified in the payload only by their display name (preferring `user_profiles.display_name`, falling back to `users.name`).
**Who cannot:** `anonymous` without token or with mismatched token → 400 (missing params) / 404 (hash doesn't match). Expired sessions → 410 Gone. Sessions with `status != 'active'` → 410 Gone.

**Tests:**

- Positive (edge fn smoke): `scripts/smoke-edge-functions.sh` (returns 400 on missing params, proving JWT gate is off and function is reachable)
- Positive (page surface): `tests/e2e/jam/jam-view-anon.spec.ts` renders `jam-view-setlist` and empty-state, asserts no `Songs in Common` UI
- Negative (wrong token → 404): `tests/e2e/jam/jam-view-anon.spec.ts`
- Live refresh: `tests/e2e/jam/jam-view-anon.spec.ts` (polling surfaces host setlist edits without page refresh)
- Role grants (db) — `jam-view` calls via `service_role`, requires grants on `jam_sessions`, `jam_participants`, `user_profiles`, `users`, `songs` (and `jam_song_matches` for legacy-only fallback): `supabase/tests/008-role-grants.test.sql`
- Edge function auth mode: `supabase/functions/FUNCTIONS.md` (manifest) + `scripts/smoke-edge-functions.sh` (runtime check)

### Jam session schema integrity

Indexes on `jam_sessions` (short_code, view_token, host, status), FK on-delete actions (CASCADE for participants/matches, SET NULL for seed/saved setlist refs), check constraints on the status / match_confidence enums, and the functional cascade behavior when a jam session is deleted.

- db: `supabase/tests/013-jam-sessions.test.sql`
- db: `supabase/tests/002-schema-columns.test.sql` (column existence including `seed_setlist_id`, `settings`, `view_token_expires_at`)
- db: `supabase/tests/010-realtime-config.test.sql` (realtime publication + REPLICA IDENTITY FULL)

### Participant display names

Participant list shows each user's `display_name` from `user_profiles`, gated by `user_profiles_select_jam_coparticipant`.

- harness: visible in `dump-session` output (labels use display_name)

### Common-song matching (recompute)

`jam-recompute` Edge Function reads all participants' shared catalogs server-side and writes matches atomically via `replace_jam_matches()`. Exact + fuzzy (Jaro-Winkler) modes.

- unit: `tests/unit/utils/songMatcher.test.ts`
- harness: `scripts/test-harness/commands/recompute.ts`

### Host curated queue / setlist

Host picks songs from the match list (or directly from their personal catalog) into an ordered, drag-reorderable broadcast setlist. Persisted as `jam_sessions.settings.setlistItems` (objects with `id` + `displayTitle` + `displayArtist` so participants and anon viewers don't need to resolve song IDs against the host's catalog). Other participants receive updates live via the existing `jam_sessions` postgres_changes subscription.

- unit: `tests/unit/services/JamSessionService.test.ts` (`updateSetlistItems` group)
- e2e: `tests/e2e/jam/jam-session-core.spec.ts` (Setlist tab visibility + add-from-catalog CTA)
- harness: `dump-session` prints `setlistItems:` block — use after host edits to verify

### Save jam → personal setlist

Host saves the jam's working setlist as a personal setlist after the jam.

- e2e: `tests/e2e/jam/jam-save-setlist.spec.ts`

### Anonymous view via link

`jam-view` Edge Function serves a public, read-only payload whose primary content is the host-curated broadcast setlist (`setlist[]`). The page polls the edge function every 10s so anon visitors see setlist edits from the host without refreshing. No user IDs, emails, or raw catalog data in the payload; no common-songs section (intentionally excluded — see `JamViewPublicPayload` docstring).

- e2e: `tests/e2e/jam/jam-view-anon.spec.ts` (broadcast-setlist render, empty state, polled refresh, absence of common-songs UI, share-URL token persistence)

### Jam session E2E happy path

Create → participants join → matches surface → save setlist.

- e2e: `tests/e2e/jam/jam-session-core.spec.ts`

### Seed jam from a personal setlist

Host can start a new jam pre-seeded with songs from one of their personal setlists. The picker is shown on the create-jam form; on submission the chosen setlist's songs are projected into `settings.setlistItems` and the source setlist is recorded on `jam_sessions.seed_setlist_id`. Ownership is enforced — only the host's own personal setlists are accepted (band setlists are out of scope).

- unit: `tests/unit/services/JamSessionService.test.ts` (`createSession > with seedSetlistId` group)
- e2e: `tests/e2e/jam/jam-session-core.spec.ts` (seed-picker surface)
- harness: `scripts/test-harness/commands/seed-setlist.ts` + `create-jam --seed-from=<id>`

---

## 8. Sync & Offline

### Local repository cache

IndexedDB acts as a cache for own-band/own-personal data. Other-user personal data reads straight from Supabase (never cached locally).

- unit: indirectly via `tests/unit/hooks/useSyncStatus.test.ts`, `tests/unit/hooks/useItemSyncStatus.test.tsx`
- journey: `tests/journeys/sync-journeys.test.ts`

### Audit-log-based incremental sync

On reconnect, client pulls diffs from `audit_log` instead of a full refetch.

- journey: `tests/journeys/sync-journeys.test.ts`
- db: `supabase/tests/009-audit-logging.test.sql`

### Realtime subscriptions

Bands, songs, setlists, shows, practices, jam_sessions/participants/matches emit postgres_changes; clients apply deltas live.

- journey: `tests/journeys/realtime-sync-journeys.test.ts`
- db: `supabase/tests/010-realtime-config.test.sql`
- harness: `scripts/test-harness/commands/watch.ts`

### Offline indicator

UI signals when the app detects a lost connection.

- unit: `tests/unit/components/OfflineIndicator.test.tsx`
- unit: `tests/unit/components/SyncStatusIndicator.test.tsx`

### Last-active timestamp

`users.last_active_at` updates on session activity.

- unit: `tests/unit/hooks/useLastActiveTime.test.ts`

### Error recovery flows

Transient failures, session expiry during writes, and concurrent-edit collisions.

- journey: `tests/journeys/error-recovery-journeys.test.ts`

---

## 9. Settings

### Profile edit (display name)

User edits `user_profiles.display_name`.

- e2e: `tests/e2e/settings/settings-page.spec.ts`

### Account deletion / sign-out

Sign-out clears session. (Delete account not yet implemented.)

- e2e: partial in `tests/e2e/settings/settings-page.spec.ts`

---

## 10. Schema, RLS, Triggers (Database)

### Schema integrity

All expected tables, columns, indexes, and constraints exist.

- db: `supabase/tests/001-schema-tables.test.sql`, `002-schema-columns.test.sql`, `003-schema-indexes.test.sql`, `004-schema-constraints.test.sql`

### Functions + triggers

Version bump triggers, `update_last_modified`, audit-log writers, `are_jam_coparticipants`, `replace_jam_matches`.

- db: `supabase/tests/005-functions-triggers.test.sql`, `012-trigger-column-compatibility.test.sql`

### RLS policies exist

Every security-relevant policy is present.

- db: `supabase/tests/006-rls-policies.test.sql`

### Band isolation (behavior)

Band-scoped tables enforce isolation at the RLS layer.

- db: `supabase/tests/007-rls-band-isolation.test.sql`

### Audit logging

Mutations write audit rows with user + band attribution.

- db: `supabase/tests/009-audit-logging.test.sql`

### Realtime publication

Right tables are in the realtime publication with `REPLICA IDENTITY FULL`.

- db: `supabase/tests/010-realtime-config.test.sql`

### Data integrity

FK cascades, unique constraints, enum checks.

- db: `supabase/tests/011-data-integrity.test.sql`

---

## 11. Infrastructure & Dev Tooling

### Repository sync-queue guardrail

ESLint rule + ratchet test prevent new direct `db.*` writes outside the storage layer.

- unit: `tests/unit/guardrails/db-direct-write.test.ts`
- lint: `.eslintrc.cjs`

### Application mode detection (dev / staging / prod)

`src/config/appMode.ts` branches behavior based on env.

- unit: `tests/unit/config/appMode.test.ts`

### ER diagram freshness

Pre-commit hook regenerates `src/pages/DevDashboard/diagrams/generated/erDiagram.ts` if schema changed.

- script: `scripts/generate-er-diagram.ts`
- husky hook: `.husky/pre-commit`

### Multi-user harness

CLI personas, song seeding, jam orchestration, realtime watch.

- harness: `scripts/test-harness/README.md`

---

## Known gaps (not yet covered anywhere)

These exist in the app but don't have tests. Good candidates for the next coverage sweep — if you work in any of these areas, write the test.

- Google OAuth login path
- Show CRUD beyond the setlist-show-sync scenario
- Delete account + data purge
- Personal song → setlist drag coverage (separate from jam flow)
- Billing/tier transitions (no paying tier yet, but placeholder `account_tier` exists)

---

**Maintenance rule:** when adding or modifying tests, update the relevant catalog entry in the same commit. The catalog drifting silently is worse than having no catalog.
