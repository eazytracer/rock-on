# Changelog

All notable changes to Rock-On will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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

| Version | Date        | Highlights                         |
| ------- | ----------- | ---------------------------------- |
| 0.1.0   | 2026-01-18  | Auth flow, sync-on-load, E2E tests |
| 0.0.x   | Pre-release | Initial development                |
