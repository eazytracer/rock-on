# Changelog

All notable changes to Rock-On will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] - 2026-04-25

### Anonymous jam-view rebuild + jam UX overhaul

The v0.3.1 hotfix unblocked the jam feature in production but left the
anonymous viewer experience in poor shape (per the v0.3.1 post-mortem):
guests landed on a "Common Songs" list they couldn't contribute to, never
saw the host's actual setlist, and the host page itself felt like a
crowded dashboard on mobile. v0.4.0 rebuilds the anon view around its
real product intent and tightens the host page accordingly.

**No database changes.** No migrations, no schema changes, no RLS
changes. Anonymous-viewer presence is implemented entirely on Supabase
Realtime presence channels, which run in-memory at the realtime server
and don't persist to Postgres. Edge-function `jam-view` ships a new
response shape and must be redeployed.

### Added

- **Anonymous viewer presence (Supabase Realtime)** — guests on the
  `/jam/view/<code>` page can introduce themselves with a name and
  show up live in the host's "Watching" sidebar. Implementation uses
  presence channels (in-memory at the Realtime server, no DB writes,
  auto-cleanup on disconnect) so anonymous clients are first-class
  participants without needing auth or a watcher table.
  - `src/hooks/useJamPresence.ts` — shared presence hook with watcher
    - listener modes
  - `src/components/jam/JamWatcherList.tsx` — host-side watcher list
    with eye icon
  - Channel key `jam:presence:<shortCode>`. Per-tab key in
    sessionStorage so refreshes rejoin with a fresh entry and
    multiple tabs on the same device all show up individually.
- **End Session flow on the host page** — host can deliberately end an
  active jam from a kebab menu item. If there's a curated setlist /
  queue / matches, the dialog offers Save & End / End without saving /
  Cancel; on an empty session the dialog collapses to End / Cancel.
  `JamSessionService.expireSession` (status='expired') is the
  underlying transition; status='saved' (terminal alongside
  'expired') is the alternate path when Save & End is chosen.
- **Live-update polling on the anonymous view** — the page polls the
  edge function every 5s and shows a visible "Live · updated Ns ago"
  indicator next to the session title. Cache-buster query param +
  `cache: 'no-store'` ensures no intermediate cache returns stale
  setlist data.
- **Idempotent save-as-setlist** — clicking Save twice (or retrying
  after a previous failed attempt) returns the existing setlist
  rather than creating a duplicate. Reconciliation branch flips the
  session status to 'saved' if a prior attempt orphaned the link.
- **Compensating rollback on save failure** — if `updateJamSession`
  fails after `addSetlist` succeeded, the new setlist is deleted to
  prevent orphan zombie rows in the user's personal setlists.
- **`SyncEngine.flushPendingWrites()`** — new public method that
  awaits any in-flight sync and then pushes the pending queue. Used
  by `JamSessionService.saveAsSetlist` to guarantee a setlist row
  has reached Supabase before the FK-bearing `jam_sessions` update
  runs.
- **`KebabMenu` items support `data-testid`** — stable E2E selectors
  for individual menu items across the whole app.
- New E2E specs (closing P1 from the v0.3.1 handoff):
  - `tests/e2e/jam/jam-share-url-persistence.spec.ts` — guards the
    v0.3.1 localStorage rehydration + graceful-disable path
  - `tests/e2e/auth/post-signup-profile-state.spec.ts` — pins the
    `users.name` fallback when no `user_profiles` row exists
  - Expanded `tests/e2e/jam/jam-view-anon.spec.ts` with live-session
    coverage (real session seeded via admin client, exercises the
    edge function end-to-end)

### Changed

- **Anonymous jam-view payload — `matches` and `matchCount` removed.**
  The anon page no longer surfaces "common songs" (a guest has no
  catalog and can't contribute to or benefit from the match set).
  Setlist is now the primary content and the only field besides
  session metadata. **Edge function `jam-view` redeploy required**
  before clients on v0.4.0 hit production. Old clients (v0.3.x) will
  see the trimmed payload as `matches=undefined` and degrade
  gracefully.
- **Setlist is the default tab on the host page**, replacing the
  previous default of "Common Songs" (which was empty until a second
  participant joined).
- **"My Queue" tab removed.** Its only function — pre-staging songs
  from the host's personal catalog — is already covered by the
  Setlist tab's "Add from my catalog" CTA. Single source of truth.
  `queuedSongs` state is preserved so older sessions with
  `settings.hostSongIds` still feed `saveAsSetlist`'s auto-merge
  fallback.
- **Action buttons (Save / Refresh / End) consolidated into a kebab
  menu** next to the tab bar. Eliminates the wrapping-to-three-lines
  bug on mobile. testids `jam-save-setlist-button`,
  `jam-refresh-matches-button`, `jam-end-session-button` move to the
  menu items but keep the same names so existing tests need only an
  `openMenu()` step, not testid renames.
- **JamSessionCard compacted from ~150px to ~50px on mobile.** Layout
  is now a single row: session name + expiry on the left, labelled
  "Join code ABC123" chip in the middle, single Share button on the
  right. Copy / QR moved into a popover behind the Share button.
- **Mobile participants section is a self-contained collapsible
  card**, defaulting to collapsed. One-line summary
  ("3 participants · 1 watching") doubles as the toggle header;
  expanded body is the same card's body with an internal divider so
  the relationship between toggle and content is visually
  unambiguous. Desktop sidebar layout unchanged.
- **Brand palette alignment.** Replaced off-palette `bg-blue-600`
  syncing banner, `bg-surface` (`#F5F5F5`) light wrapper, blue
  `LoadingSpinner.primary`, and `amber-500` accents in jam UI with
  the canonical `bg-[#0a0a0a]` dark surface and `text-primary`
  (`#FE4401`) brand orange. Eliminates the "white screen with blue
  text" flash during Suspense / auth checks.

### Fixed

- **FK race in save-as-setlist.** `addSetlist` writes go through the
  offline-safe sync queue (local first, async push to Supabase) but
  `updateJamSession` writes directly to Supabase (no local cache for
  ephemeral sessions). The direct UPDATE could beat the queued
  INSERT to the server, so `jam_sessions.saved_setlist_id`
  referenced a row that didn't exist yet → FK violation. Fixed via
  `flushPendingWrites()` between the two writes.
- **Personal-setlist delete didn't update the UI** until navigation
  or a realtime DELETE event landed. `SetlistsPage.handleDelete`
  was filtering only `uiSetlists` (band scope), missing
  `personalUISetlists`. Now filters both lists optimistically.
- **Anonymous jam-view spinner stuck forever in dev** under React
  StrictMode. A cross-mount ref guard meant the second mount's
  fetch early-returned because the first mount's was still
  "in-flight," and the first mount's `cancelled` closure prevented
  it from clearing the loading state. Removed the ref guard;
  per-effect `cancelled` flag is sufficient.
- **Kebab menu click was swallowed by dnd-kit's pointer listeners**
  on `SortableQueueSongRow`. Spreading `{...listeners}` on the row's
  outer wrapper made the drag sensor capture every pointer event,
  including clicks on the kebab. Listeners now attach only to the
  grip handle (the dnd-kit-recommended pattern). Also added
  `touch-none` so mobile drags don't fight scroll gestures.
- **`LoadingSpinner.primary` was hardcoded to `text-blue-600`** and
  `FullPageSpinner` used `bg-white` — the combination produced
  "blue text on a white screen" during every Suspense fallback.
  Now uses `text-primary` (`#FE4401`) on a dark backdrop.
- **`bg-surface` (`#F5F5F5`) at `App.tsx:154`** caused a light-gray
  flash to show through on every route-level Suspense fallback.
  Replaced with `bg-[#0a0a0a]` to match `ModernLayout`.
- **Off-palette syncing banner** — the "Syncing your data from
  cloud..." header was `bg-blue-600`. Re-themed to dark surface
  with brand-orange spinner.

### Edge functions

- `jam-view` requires redeploy: response shape changed (`matches`
  and `matchCount` removed; `setlist` now always present, possibly
  empty). The legacy `jam_song_matches` table read is now
  fallback-only for pre-`setlistItems` sessions. Documented in
  `supabase/functions/FUNCTIONS.md`.

### Migration / deploy notes

| Asset                    | Action                                                                |
| ------------------------ | --------------------------------------------------------------------- |
| Postgres schema          | None                                                                  |
| Migrations               | None                                                                  |
| RLS policies             | None                                                                  |
| Realtime publication     | None (presence is in-memory, not postgres_changes)                    |
| `jam-view` edge function | **Redeploy required** (`./scripts/deploy-edge-functions.sh jam-view`) |
| Frontend bundle          | Standard deploy                                                       |

## [0.3.1] - 2026-04-24

### Fixed

- **Hotfix:** 403 errors on all jam session operations in production. The
  v0.3.0 incremental migration created the `jam_sessions`,
  `jam_participants`, and `jam_song_matches` tables with RLS policies but
  never granted DML privileges to the `authenticated` role. PostgREST
  rejected every SELECT/INSERT/UPDATE/DELETE with 403 despite valid JWTs,
  breaking the entire jam session flow. Fixed by migration
  `20260424000000_hotfix_grant_jam_tables.sql` which explicitly grants
  SELECT/INSERT/UPDATE/DELETE on the three jam tables to `authenticated`.
  Local development Supabase defaults are more permissive, so this didn't
  surface in pre-deploy testing.
- Jam session participant list showed `User abc123` instead of the real
  name for users who had never set an extended profile. The
  `getJamParticipants` query in `RemoteRepository` only read
  `user_profiles.display_name`, but that row is only created when a user
  explicitly visits profile settings — `users.name` (populated at signup)
  is the more reliable source. Now queries both and prefers
  `user_profiles.display_name` when set, falling back to `users.name`.
- Anonymous jam-view page (`/jam/view/:shortCode`) returned 401 because
  the `jam-view` edge function was deployed without `--no-verify-jwt`,
  causing the Supabase gateway to reject unauthenticated requests before
  the function ran. Redeployed with the flag.
- Share URL for a jam session reset to a broken fallback
  (`/jam/view/<code>` with no `?t=` token) after page remount / refresh.
  The raw view token is only known at session creation (DB stores a
  hash), so the host page couldn't rebuild it from server data. Now the
  raw token is persisted to localStorage keyed by session id, rehydrated
  on remount, and the JamSessionCard copy/QR buttons gracefully disable
  themselves when the token isn't available (e.g. shared on a device
  other than the one that created the session) with an explanatory
  tooltip instead of handing out a URL that will 400.
- Anonymous jam-view page returned 404 even with a valid
  `/jam/view/<code>?t=<token>` URL. The `jam-view` edge function queries
  `jam_sessions` via service_role, but the v0.3.0 migration granted DML
  to `authenticated` only. Although `service_role` has `rolbypassrls =
true`, BYPASSRLS does not confer table-level privileges — so every
  service_role read returned "permission denied" and surfaced as 404.
  Audit revealed ALL 19 public tables were missing service_role grants
  (a gap in the original baseline migration, not just the jam tables).
  Fixed by migration `20260424020000_grant_all_public_tables_to_service_role.sql`
  which grants service_role DML on every existing public table AND sets
  default privileges so future tables inherit the grant automatically.
  Preceding migration `20260424013000_grant_jam_tables_to_service_role.sql`
  first grants just the jam tables (kept for history).
- Anonymous jam-view showed `Host` as the session host's display name
  because the edge function only read `user_profiles.display_name`
  (which is empty for users who never set an extended profile). Now
  falls back to `users.name` (populated at signup).

### Changed

- Migration-authoring checklist in `CLAUDE.md` now includes: **any new
  table in an incremental migration needs an explicit `GRANT SELECT,
INSERT, UPDATE, DELETE ... TO authenticated` AND `... TO service_role`
  statement**, because the baseline's "GRANT ON ALL TABLES" is a
  snapshot, not a default-privilege rule.

### Infrastructure (post-mortem from v0.3.0 → v0.3.1)

- `scripts/lint-migrations.mjs` (wired as `npm run lint:migrations`) —
  static analysis of migration SQL text. For every `CREATE TABLE`,
  verifies an explicit `GRANT` for both `authenticated` and `service_role`
  exists in the same or a later migration (or a covering broad grant, or
  prior default-privilege configuration). Runs at the SQL-text level, so
  local Supabase's permissive default privileges cannot mask missing
  grants. Red/green verified: removing the hotfix migrations reports 29
  violations; restoring passes cleanly.
- `supabase/tests/008-role-grants.test.sql` — pgTAP suite (181 tests)
  asserting `has_table_privilege()` for authenticated + service_role on
  every public table × every DML operation. Complements the linter by
  catching runtime drift; stronger when run against hosted Supabase.
- `supabase/functions/FUNCTIONS.md` — manifest of every edge function
  with auth mode, role context, and expected smoke status. Eliminates
  the "forgot `--no-verify-jwt`" class of bug.
- `scripts/deploy-edge-functions.sh` — deploy wrapper that reads the
  manifest and applies the correct auth flag per function. Never deploy
  via ad-hoc `supabase functions deploy <name>`.
- `scripts/smoke-edge-functions.sh` — post-deploy smoke verifying each
  function returns its expected unauthenticated-GET status from the
  manifest.
- `.claude/process/pre-deploy-checklist.md` — required pre-merge and
  pre-deploy gates, each item tied to a specific v0.3.1 production
  failure.
- Functionality catalog template extended — every capability now
  documents "Who can / Who cannot / Tests (positive) / Tests (negative)"
  plus role-grant and RLS-policy pointers. Jam session domain fully
  backfilled as exemplar; remaining domains to follow incrementally.

## [0.3.0] - 2026-04-23

This release ships the social catalog + jam sessions feature set alongside a
comprehensive UI unification pass. It also marks the transition from the
pre-1.0 "modify baseline directly" schema policy to per-feature incremental
migrations now that production data exists.

### Added

#### Social catalog + jam sessions

- Personal song catalogs — songs can now be owned by a user directly (not
  just a band) via `context_type = 'personal'`
- Personal setlists — same treatment, scoped to the owning user
- Jam sessions: ephemeral multi-user sessions for finding common songs
  across participants' personal catalogs. Host creates a session, others
  join via 6-char short code; matches are computed server-side and
  broadcast to all participants via Realtime.
- Anonymous read-only jam view via `jam-view` edge function — attendees
  can follow along with a view-only link without signing in
- `jam-recompute` edge function + atomic `replace_jam_matches()` RPC for
  server-side match computation
- Host in-session setlist mutator + "seed jam from personal setlist" flow
- Test harness CLI (`scripts/test-harness/`) for multi-user jam testing
  with alice/bob/carol personas driving real RLS paths
- pgTAP coverage for jam sessions + RLS policy drift detection (suite
  `supabase/tests/013-jam-sessions.test.sql`)

#### UI unification

- `<MetaPill>` + helpers (`KeyPill` / `BpmPill` / `DurationPill` /
  `TuningPill`) — unified metadata chip used across song lists, detail
  views, and the practice session viewer
- `<SectionCard>` — shared container for the "dark card with section
  heading + optional actions slot" pattern; adopted in PracticeView,
  SetlistView, ShowView
- `<MarkdownField>` — render-first notes editing surface with
  pencil-to-edit, click-out auto-save + green "Notes saved" flash, discard
  confirm on dirty cancel. Adopted for band notes in EditSongModal and for
  notes fields in Practice/Setlist/Show view pages.
- `<UnsavedChangesDialog>` + `useUnsavedChanges()` hook — blocking
  three-button (Keep / Discard / Save) confirm dialog for forms with
  unsaved changes. Wired into EditSongModal.
- Tuning color registry (`src/utils/tunings.ts`) with 9 canonical tunings
  in Palette A; colored left-border stripe + colored Guitar icon on
  `SongListItem` for at-a-glance tuning-change spotting
- Practice session viewer — four responsive layouts (TV / tablet
  landscape / tablet portrait / mobile) auto-detected by viewport aspect
  ratio, with a manual override toggle persisted to localStorage
- Font-size S/M/L toggle in the session header (persisted to localStorage)
- Kindle-style full-width top/bottom tap zones on the notes panel for
  page-by-page scrolling; keyboard + BT foot-pedal shortcuts (PageUp /
  PageDown / Space / Shift+Space)
- Full-screen practice session on all viewports — sidebar hidden during
  an active session
- `<FooterNextPreview>` — shared next-song preview block for the session
  footer across tablet/mobile layouts
- `<ScrollableNotes>` — markdown notes panel with tap-zone scroll controls
  (extracted from the practice session viewer for reuse)
- `/dev/ui-preview` dev route — design sandbox with 5 tabs for reviewing
  proposed patterns (practice layouts, tuning colors, markdown field,
  unsaved changes, section card). Not linked from main nav.
- `.claude/specifications/functionality-catalog.md` — plain-English index
  of all app capabilities with test references across 11 domains

### Changed

- `MarkdownRenderer` migrated off legacy color tokens (`steel-gray`,
  `energy-orange`, `smoke-white`, `electric-yellow`) to the modern hex
  palette (`#f17827ff`, `#d4d4d4`, `#1f1f1f`, etc.)
- Migration policy — now one consolidated incremental migration per
  release/feature, not per-commit. Baseline is frozen for production
  parity; new schema changes go into dated incremental files with
  `IF NOT EXISTS` / `DROP POLICY IF EXISTS` / exception-handler guards
  for idempotency. See `CLAUDE.md` "Migration Policy" section.
- RLS policies hardened:
  - `users_select_authenticated` (permissive) replaced with three scoped
    policies: `users_select_self`, `users_select_band_member`,
    `users_select_jam_coparticipant`
  - Songs and setlists split into `*_personal_*` and `*_band_members`
    policy variants to support per-catalog ownership
  - New `is_jam_participant()` + `are_jam_coparticipants()` helper
    functions (SECURITY DEFINER) to prevent RLS recursion
- Practice session viewer completely rebuilt for the four-layout design;
  previous single-column layout removed
- Guitar tuning strings canonicalized via `canonicalTuningId()` —
  `"Standard (EADGBE)"` and `"Standard"` now resolve to the same registry
  entry; the modal dropdown shows one consistent list
- Supabase production access procedure — documented in `CLAUDE.md` with
  strict secret-handling rules (no byte dumps, no appends to the env
  file, length/prefix checks only)

### Removed

- `src/components/songs/NewSongModal.tsx` — orphaned (unused, legacy blue
  accent, `console.log` submit). `EditSongModal` handles both add and
  edit modes.
- Band Notes field in `EditSongModal` add-mode — users create the song
  first, then add notes from the song detail view
- Pre-1.0 "modify baseline migration directly" policy

### Fixed

- Tuning vocabulary drift between `NewSongModal` and `EditSongModal`
  (`"Standard (EADGBE)"` vs `"Standard"`, `"Half Step Down"` vs
  `"Half-step down"`) — both now source from
  `src/utils/tunings.ts::builtInTuningLabels()`
- Mobile metadata row left-justified instead of centered
- Exit affordance redundancy on the TV layout — back arrow in the
  top-left is now the sole exit

### Infrastructure

- Incremental migration
  `supabase/migrations/20260422220000_social_catalog_and_jam_sessions.sql`
  brings existing production databases up to parity with the
  social-catalog baseline changes. Fully idempotent.
- `.devcontainer/setup.sh` now installs the GitHub CLI (`gh`) for PR and
  release management

## [0.2.2] - 2026-01-22

### Fixed

- Practice session notes (wrapupNotes) not saving or syncing to other devices
- Song reorder in practices not syncing to other users despite toast notifications
- Song session notes being stripped when updating practice
- Partial updates wiping unrelated fields due to `?? []` converting undefined to empty arrays
- Scroll position lost during real-time sync updates on practice view page
- Race condition in `useRealtimeSync` where inline array dependencies caused effect re-runs

### Changed

- `useRealtimeSync` now uses stable event key via `useMemo` and executes pending sync on cleanup
- `RemoteRepository` mappers only include fields that are actually present in update objects
- `PracticeViewPage` only shows loading spinner on initial load, not on realtime-triggered refetches

## [0.2.1] - 2026-01-21

### Added

- Feature flag system for toggling experimental features (`src/config/featureFlags.ts`)
- Shared audit log mappers for consistent JSONB to model conversions (`src/services/data/auditMappers.ts`)
- Audit log-based incremental sync (behind feature flag `SYNC_USE_AUDIT_LOG`)
- Docker configuration for mobile browser testing (`Dockerfile`, `docker-compose.yml`, `start-docker.sh`)

### Fixed

- Song updates not syncing to other devices - incremental sync was comparing `createdDate` which never changes after creation, now uses `audit_log` table (#8)

### Changed

- `RealtimeManager` now uses shared audit mappers for consistency with `SyncEngine`
- Incremental sync can use `audit_log` table instead of per-record timestamps (feature flagged)

## [0.2.0] - 2026-01-21

### Added

- **External Links & Spotify Integration** (#7)
  - Reference links for songs (Spotify, YouTube, tabs, lyrics, other)
  - URL auto-detection when pasting/typing links
  - Link icons in song lists with one-click access
  - Spotify search with album art and metadata auto-fill
  - Edge Function proxy for Spotify API authentication
- Persistent layout architecture - sidebar/navbar stay mounted during navigation, eliminating white screen flicker (#6)
- `ContentLoadingSpinner` component for content-area-only loading states
- `ProtectedLayoutRoute` component combining auth check with persistent layout

### Fixed

- Delete song sync issue - songs no longer reappear after deletion
- Navigation flicker - removed loading spinner flash on route changes

### Changed

- Replaced `ProtectedRoute` with `ProtectedLayoutRoute` for all protected routes
- All page components now use `ContentLoadingSpinner` instead of wrapping with `ModernLayout`

## [0.1.0] - 2026-01-18

### Added

- **Improved Auth Flow**
  - Unified auth validation with `useAuthCheck` hook
  - 1.5-hour grace period for expired sessions (supports offline gigs/practices)
  - Automatic cleanup of stale localStorage keys
  - Session expiry detection and redirect

- **Sync-on-Load**
  - Incremental sync on every app load
  - Conflict detection for concurrent edits
  - Cross-device sync improvements

- **E2E Testing**
  - 53 new session expiry E2E tests
  - Test suite remediation (108 tests passing)
  - Test performance optimization with parallel execution
  - Split test scripts (`test:quick`, `test:unit`, `test:services`)

- **Enhanced Practice Workflow**
  - Practice session management
  - Practice builder page
  - Practice view improvements

### Fixed

- Cross-device sync now processes same-user changes correctly
- Sync-on-load performs full sync when no timestamp exists
- `useSongs` hook checking wrong sync status field

### Infrastructure

- pgTAP database test suite (269 tests)
- Consolidated migrations into single baseline schema
- Improved CI/CD pipeline configuration

---

## Version History

| Version | Date        | Highlights                          |
| ------- | ----------- | ----------------------------------- |
| 0.2.0   | 2026-01-21  | External links, Spotify integration |
| 0.1.0   | 2026-01-18  | Auth flow, sync-on-load, E2E tests  |
| 0.0.x   | Pre-release | Initial development                 |
