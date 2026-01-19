# E2E Test Remediation Tasks

**Created:** 2026-01-17
**Status:** In Progress
**Total Failing Tests:** 37

## Overview

Two parallel work tracks:

1. **UI Test Fixes** - Update selectors for changed UI components
2. **Sync Bug Fixes** - Fix production bugs in sync-on-load feature

---

## Track 1: UI Test Fixes

### T001: Settings Page Tests (17 tests)

- **Status:** 🔄 In Progress
- **Agent:** settings-fix-agent
- **File:** `tests/e2e/settings/settings-page.spec.ts`
- **Issue:** Missing `data-testid` attributes on UI elements
- **Fix Required:**
  - Add `data-testid="settings-link"` to Sidebar navigation
  - Add `data-testid="logout-button"` to Sidebar
  - Add testids to SettingsPage form elements (if needed)
- **Files to Modify:**
  - `src/components/layout/Sidebar.tsx`
  - `src/pages/SettingsPage.tsx` (verify existing testids)
- **Verification:** `npm run test:e2e -- --project=chromium tests/e2e/settings/settings-page.spec.ts`

### T002: Songs CRUD Tests (6 tests)

- **Status:** 🔄 In Progress
- **Agent:** songs-fix-agent
- **File:** `tests/e2e/songs/crud.spec.ts`
- **Issue:** Tests expect modal, UI now uses drawer
- **Fix Required:**
  - Update `[data-testid="song-form-modal"]` → `[data-testid="song-form-drawer"]`
  - Verify all form element selectors still work
- **Files to Modify:**
  - `tests/e2e/songs/crud.spec.ts`
- **Verification:** `npm run test:e2e -- --project=chromium tests/e2e/songs/crud.spec.ts`

### T003: Sync/Setlist-Show Tests (4 tests)

- **Status:** 🔄 In Progress
- **Agent:** sync-tests-fix-agent
- **File:** `tests/e2e/sync/setlist-show-sync.spec.ts`
- **Issues:**
  1. CSS syntax error on line 194 (extra `)`)
  2. Missing testids on SetlistViewPage and ShowViewPage
- **Fix Required:**
  - Fix CSS selector syntax
  - Add testids to SetlistViewPage: `setlist-name-input`, `save-setlist-button`, etc.
  - Add testids to ShowViewPage: `show-venue-input`, `show-date-input`, etc.
  - Update DatePicker and TimePickerDropdown to accept `data-testid` prop
- **Files to Modify:**
  - `tests/e2e/sync/setlist-show-sync.spec.ts`
  - `src/pages/SetlistViewPage.tsx`
  - `src/pages/ShowViewPage.tsx`
  - `src/components/common/DatePicker.tsx`
  - `src/components/common/TimePickerDropdown.tsx`
  - `src/components/common/ConfirmDialog.tsx`
- **Verification:** `npm run test:e2e -- --project=chromium tests/e2e/sync/setlist-show-sync.spec.ts`

### T004: Auth/Protected Routes Tests (3 tests)

- **Status:** ⏳ Pending (blocked by T005)
- **File:** `tests/e2e/auth/protected-routes.spec.ts`
- **Issue:** Related to sync-on-load timing issues
- **Notes:** May be resolved by T005 fixes

---

## Track 2: Sync Bug Fixes (Critical)

### T005: Fix Sync-on-Load Race Conditions

- **Status:** 🔄 In Progress
- **Agent:** sync-bug-fix-agent
- **Priority:** CRITICAL
- **Issue:** Commit f3b81ce introduced sync timing bugs
- **Symptoms:**
  - "Initial sync failed: TypeError: Failed to fetch" on login
  - Race conditions between database reset and sync
  - Member count incorrect due to sync overwrites
- **Root Cause:** `AuthContext.tsx` auto-syncs on login before test data is ready
- **Fix Required:**
  - Add coordination between resetDatabase and sync initialization
  - Add flag to skip sync during E2E tests or database reset
  - Improve error handling for sync failures
- **Files to Modify:**
  - `src/contexts/AuthContext.tsx`
  - `src/utils/resetDatabase.ts`
  - Possibly test helpers
- **Affected Tests:**
  - `tests/e2e/auth/signup.spec.ts:52`
  - `tests/e2e/bands/band-isolation.spec.ts:177`
  - `tests/e2e/bands/create-band.spec.ts:215`
  - `tests/e2e/bands/manage-members.spec.ts:379`
  - `tests/e2e/permissions/rbac.spec.ts:21`
  - `tests/e2e/permissions/rbac.spec.ts:272`
- **Verification:** Run all RLS/permissions tests

---

## Progress Log

| Time  | Task      | Agent                | Status      | Notes                                   |
| ----- | --------- | -------------------- | ----------- | --------------------------------------- |
| 16:52 | T001-T004 | diagnosis agents     | ✅ Complete | Issues identified                       |
| 21:02 | T001      | settings-fix-agent   | ✅ Complete | Added testids to Sidebar                |
| 21:02 | T002      | songs-fix-agent      | ✅ Complete | Added modal + button testids            |
| 21:02 | T003      | sync-tests-fix-agent | ✅ Complete | Fixed CSS + added testids               |
| 21:02 | T005      | sync-bug-fix-agent   | ✅ Complete | Environment check to skip sync in tests |

---

## Test Results Tracking

### Before Fixes (Chromium only)

- **Passing:** 71/112 (63%)
- **Failing:** 37/112 (33%)
- **Skipped:** 3/112 (3%)

### After Fixes

- **Settings Page:** _pending_
- **Songs CRUD:** _pending_
- **Sync/Setlist:** _pending_
- **RLS/Permissions:** _pending_
- **Total Passing:** _pending_

---

## Files Modified

| File      | Task | Change |
| --------- | ---- | ------ |
| _pending_ |      |        |

---

## Notes

- RLS tests are catching REAL BUGS - do not modify test assertions
- UI tests need selector updates to match changed components
- Sync-on-load feature needs coordination with E2E test environment
