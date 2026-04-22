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

A host creates a short-lived jam (24h free tier) with a 6-char `short_code` join key.

- unit: `tests/unit/services/JamSessionService.test.ts`
- harness: `scripts/test-harness/commands/create-jam.ts`

### Join jam by short code

Any authenticated user joins via the short code; default shares their personal catalog.

- unit: `tests/unit/hooks/useJamSession.test.ts`
- harness: `scripts/test-harness/commands/join-jam.ts`

### Resume active jam

`/jam` landing shows "return to active jam" cards for sessions the user hosts or participates in.

- unit: covered in `tests/unit/hooks/useJamSession.test.ts`

### Cross-user personal-song reads (RLS)

Participants in the same active jam can read each other's personal songs via `songs_select_jam_coparticipant`. Other personal songs remain hidden.

- db: `supabase/tests/006-rls-policies.test.sql` (policies exist)
- harness: end-to-end flow proves reads succeed (`seed-songs alice; seed-songs bob; create-jam alice; join-jam bob; recompute`)
- unit: `tests/unit/utils/songMatcher.test.ts` (matcher logic, no RLS)

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

`jam-view` Edge Function serves a public, read-only payload that includes the host-curated broadcast setlist (`setlist[]`) alongside the match list. Anonymous visitors see what the host is queuing in real time without needing an account.

- e2e: `tests/e2e/jam/jam-view-anon.spec.ts` (broadcast-setlist render + page surface)

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
- Jam anonymous view auto-refresh — the `jam-view` payload now includes the host's broadcast setlist (covered by `jam-view-anon.spec.ts`), but the page itself fetches once on mount. A realtime/poll loop so anon viewers see setlist edits without a page refresh is still a gap.
- Personal song → setlist drag coverage (separate from jam flow)
- Billing/tier transitions (no paying tier yet, but placeholder `account_tier` exists)

---

**Maintenance rule:** when adding or modifying tests, update the relevant catalog entry in the same commit. The catalog drifting silently is worse than having no catalog.
