# Persistent Layout - Feature Summary

**Branch:** `feature/persistent-layout`
**Base Commit:** `9953b87` (main)
**Completed Date:** 2026-01-19

## Overview

Implemented persistent layout architecture to eliminate white screen flicker during navigation between protected routes. The sidebar and navbar now stay mounted while only the content area updates, providing a true SPA experience.

## Problem Solved

Before this feature, navigating between pages caused:

- Full-page remount of ModernLayout
- Brief white screen flash on each navigation
- Loading spinner covering entire viewport
- Poor user experience resembling page reloads

## Solution

Hoisted `ModernLayout` to wrap all protected routes using React Router's layout route pattern:

```tsx
<Route element={<ProtectedLayoutRoute />}>
  <Route path="/songs" element={<SongsPage />} />
  <Route path="/setlists" element={<SetlistsPage />} />
  {/* ... other protected routes */}
</Route>
```

## Components Created

| Component               | Purpose                                                  |
| ----------------------- | -------------------------------------------------------- |
| `ProtectedLayoutRoute`  | Auth check + persistent layout wrapper with `<Outlet />` |
| `ContentLoadingSpinner` | Content-area-only loading spinner for individual pages   |

## Key Changes

### App.tsx

- Imported `ProtectedLayoutRoute`
- Created layout route wrapping all protected routes
- Removed individual route wrappers

### useAuthCheck Hook

- Added `isInitialCheck` state to track first load
- Only shows loading spinner on initial mount
- Subsequent route changes validate auth without spinner

### Pages Updated (11 total)

- SongsPage, SetlistsPage, SetlistViewPage
- ShowsPage, ShowViewPage
- PracticesPage, PracticeViewPage, PracticeBuilderPage, PracticeSessionPage
- BandMembersPage, SettingsPage

Each page:

- Removed `ModernLayout` import and wrapper
- Added `ContentLoadingSpinner` for loading states
- Added `data-testid` for E2E testing

## Files Deleted

- `src/components/ProtectedRoute.tsx` - Replaced by `ProtectedLayoutRoute`

## Bug Fixes

### Delete Song Sync Issue

During implementation, discovered and fixed a bug where deleted songs would reappear:

- **Root cause:** `SyncRepository.deleteSong()` called `syncNow()` which pulls from remote first
- **Fix:** Removed `syncNow()` call since `queueDelete()` already handles push-only sync

## Tests Added

### Unit Tests

- `tests/unit/components/layout/ProtectedLayoutRoute.test.tsx` - 5 tests
- `tests/unit/components/common/ContentLoadingSpinner.test.tsx` - 3 tests

### E2E Tests

- `tests/e2e/layout/persistent-layout.spec.ts` - 10 tests covering:
  - Navbar persistence during navigation
  - Sidebar persistence during navigation
  - Rapid navigation stability
  - Content loading spinner behavior
  - No white screen flicker
  - Auth redirect before layout renders
  - Page testid attributes

## Test Results

- **Unit tests:** 169 passing
- **E2E layout tests:** 10 passing
- **TypeScript:** Compiles without errors
- **ESLint:** No warnings or errors

## Key Commits

| Commit    | Description                                               |
| --------- | --------------------------------------------------------- |
| `56cfacf` | feat: Persistent layout to eliminate white screen flicker |
| `a50fb9c` | fix: Prevent white screen flicker on route changes        |

## Archive Contents

The following files were archived to `archive.tar`:

- `2026-01-19T20:22_research.md` - Initial research and diagnosis
- `2026-01-19T20:39_plan.md` - Implementation plan
- `tasks.md` - Task breakdown and execution tracking
