# Changelog

All notable changes to Rock-On will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
INSERT, UPDATE, DELETE ... TO authenticated` statement**, because the
  baseline's "GRANT ON ALL TABLES" is a snapshot, not a default-privilege
  rule.

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
