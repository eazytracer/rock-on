# E2E Test Remediation Plan

**Created:** 2026-01-17
**Trigger:** UI overhaul from enhanced-practice-workflow feature broke 37/112 E2E tests

## Executive Summary

- **Total Tests:** 112 (Chromium only)
- **Passing:** 71 (63%)
- **Failing:** 37 (33%)
- **Skipped:** 3 (3%)
- **Did not run:** 1

## Root Cause Analysis

The enhanced-practice-workflow feature (completed 2026-01-12) made significant UI changes:

1. **Page Relocations**: Pages moved from `NewLayout/` to `pages/`
2. **Component Replacements**: `TimePicker.tsx` → `TimePickerDropdown.tsx`, new `DatePicker.tsx`
3. **Flow Changes**: Practice creation changed from modal to full-page builder
4. **New Components**: `BrowseSongsDrawer`, `ExpandableSongNotes`, `SlideOutTray`, etc.

Tests were not updated to match these UI changes.

## Failure Categories

### Category 1: Settings Page (17 tests) - HIGHEST PRIORITY

**File:** `tests/e2e/settings/settings-page.spec.ts`
**Failure Type:** `page.waitForURL: Timeout 10000ms exceeded`
**Root Cause:** Navigation to settings page timing out - likely route or sidebar issue

| Line | Test Name                                   | Error              |
| ---- | ------------------------------------------- | ------------------ |
| 65   | navigate to settings page from sidebar      | waitForURL timeout |
| 78   | load settings page directly                 | waitForURL timeout |
| 90   | require authentication                      | waitForURL timeout |
| 110  | display user email                          | waitForURL timeout |
| 118  | display user name                           | waitForURL timeout |
| 127  | display user ID                             | waitForURL timeout |
| 139  | have account section heading                | waitForURL timeout |
| 147  | show delete account button                  | waitForURL timeout |
| 155  | open confirmation modal when delete clicked | waitForURL timeout |
| 167  | close modal when cancel clicked             | waitForURL timeout |
| 181  | close modal when X clicked                  | waitForURL timeout |
| 195  | require DELETE confirmation text            | waitForURL timeout |
| 220  | show warning messages in modal              | waitForURL timeout |
| 241  | have data & privacy heading                 | waitForURL timeout |
| 249  | show permanence warning                     | waitForURL timeout |
| 259  | have proper heading hierarchy               | waitForURL timeout |
| 276  | have all required test IDs                  | waitForURL timeout |
| 287  | be responsive                               | waitForURL timeout |
| 301  | load without console errors                 | waitForURL timeout |

**Investigation Steps:**

1. Check if `/settings` route exists and is properly configured
2. Check if sidebar settings link exists with correct `data-testid`
3. Verify test fixture `loginAndNavigateToSettings` helper

---

### Category 2: Songs CRUD (6 tests)

**File:** `tests/e2e/songs/crud.spec.ts`
**Failure Type:** `locator.click: Test timeout exceeded` or element not found
**Root Cause:** Song form UI changed, element selectors outdated

| Line | Test Name                                  | Error             |
| ---- | ------------------------------------------ | ----------------- |
| 75   | add song with optional fields              | element not found |
| 136  | edit existing song                         | timeout           |
| 201  | delete song                                | timeout           |
| 254  | song changes sync to all band members      | timeout           |
| 322  | song form validation prevents invalid data | timeout           |

**Investigation Steps:**

1. Compare old vs new song form selectors
2. Check for modal vs drawer changes
3. Verify `data-testid` attributes on song form elements

---

### Category 3: Sync/Setlist-Show (4 tests)

**File:** `tests/e2e/sync/setlist-show-sync.spec.ts`
**Failure Type:** CSS selector syntax errors, element not found
**Root Cause:** Invalid selectors and changed UI for setlist/show creation

| Line | Test Name                                             | Error                       |
| ---- | ----------------------------------------------------- | --------------------------- |
| 17   | creating a setlist syncs to Supabase                  | element not found           |
| 83   | creating a show syncs to Supabase                     | element not found           |
| 177  | show date displays correctly                          | Invalid CSS selector syntax |
| 267  | duplicating a setlist syncs sourceSetlistId correctly | timeout waiting for input   |

**Investigation Steps:**

1. Fix CSS selector syntax (line 194 has invalid selector)
2. Check setlist/show creation flow (modal vs full-page)
3. Verify input selectors for setlist name field

---

### Category 4: Auth/Protected Routes (3 tests)

**File:** `tests/e2e/auth/protected-routes.spec.ts`
**Failure Type:** Click timeouts, wrong URL expectations
**Root Cause:** Sidebar navigation changed, URL patterns different

| Line | Test Name                                      | Error         |
| ---- | ---------------------------------------------- | ------------- |
| 57   | shows loading spinner during auth check        | click timeout |
| 149  | user without band is redirected to get-started | wrong URL     |
| 181  | logging out redirects to auth page             | click timeout |

**Investigation Steps:**

1. Check sidebar logout button selector
2. Verify get-started route path
3. Check loading spinner selector

---

### Category 5: RLS/Permissions (6 tests)

**Files:** Multiple (`signup.spec.ts`, `band-isolation.spec.ts`, `create-band.spec.ts`, `manage-members.spec.ts`, `rbac.spec.ts`)
**Failure Type:** Assertion failures (`toHaveLength`, `toBe`), console errors
**Root Cause:** Logic/data issues, not purely UI - may indicate actual bugs

| File:Line                  | Test Name                                         | Error                        |
| -------------------------- | ------------------------------------------------- | ---------------------------- |
| signup.spec.ts:52          | band creation handles RLS policies correctly      | toHaveLength mismatch        |
| band-isolation.spec.ts:177 | RLS policies prevent unauthorized database access | toHaveLength mismatch        |
| create-band.spec.ts:215    | band creation does not violate RLS policies       | toHaveLength mismatch        |
| manage-members.spec.ts:379 | member count updates correctly                    | toBe mismatch                |
| rbac.spec.ts:21            | admin has full access to all band features        | Console errors (sync failed) |
| rbac.spec.ts:272           | all members can add and edit songs                | click timeout (test ended)   |

**Investigation Steps:**

1. These may be actual bugs, not just UI changes
2. Check console for "Initial sync failed: TypeError: Failed to fetch"
3. Investigate RLS policy assertions - may need to verify expected vs actual behavior

---

## Agent Assignment Strategy

### Agent 1: Settings Page Fix Agent

**Priority:** HIGH (17 tests, likely single root cause)
**Scope:** `tests/e2e/settings/settings-page.spec.ts`
**Task:**

1. Navigate to app manually and verify settings page exists
2. Check sidebar for settings link and capture selector
3. Update test fixture and all dependent tests

### Agent 2: Songs CRUD Fix Agent

**Priority:** MEDIUM (6 tests)
**Scope:** `tests/e2e/songs/crud.spec.ts`
**Task:**

1. Manually test song creation/edit/delete flow
2. Capture current UI selectors for song form
3. Update tests to match new selectors

### Agent 3: Sync/Setlist-Show Fix Agent

**Priority:** MEDIUM (4 tests)
**Scope:** `tests/e2e/sync/setlist-show-sync.spec.ts`
**Task:**

1. Fix CSS selector syntax error on line 194
2. Manually test setlist/show creation flow
3. Update selectors for new UI

### Agent 4: Auth Flow Fix Agent

**Priority:** LOW (3 tests)
**Scope:** `tests/e2e/auth/protected-routes.spec.ts`
**Task:**

1. Check sidebar logout button selector
2. Verify get-started redirect behavior
3. Update loading spinner test

### Agent 5: RLS/Permissions Investigation Agent

**Priority:** CRITICAL - INVESTIGATE BEFORE FIXING
**Scope:** Multiple files
**Task:**

1. Investigate if these are actual bugs or test issues
2. Check Supabase console for RLS errors
3. Verify sync is working correctly
4. Report findings before making changes

---

## Verification Process

After each agent completes fixes:

1. Run affected test file: `npm run test:e2e -- --project=chromium tests/e2e/<file>.spec.ts`
2. If passing, run full suite on chromium: `npm run test:e2e -- --project=chromium`
3. Final verification: `npm run test:e2e` (all browsers)

---

## Files Modified by Enhanced Practice Workflow

Reference for understanding what changed:

| Page                      | Changes                                               |
| ------------------------- | ----------------------------------------------------- |
| `PracticesPage.tsx`       | Removed inline modal, uses navigation to builder page |
| `PracticeBuilderPage.tsx` | NEW - Full-page practice creation/editing             |
| `PracticeSessionPage.tsx` | NEW - Live practice session runner                    |
| `PracticeViewPage.tsx`    | NEW - View/edit practice details                      |
| `SetlistViewPage.tsx`     | NEW - View/edit setlist details                       |
| `ShowViewPage.tsx`        | NEW - View/edit show details                          |
| `ShowsPage.tsx`           | Added DatePicker, TimePickerDropdown components       |
| `SetlistsPage.tsx`        | Added BrowseSongsDrawer, useToast integration         |
| `SongsPage.tsx`           | Added ExpandableSongNotes component                   |

---

## Test-to-Page Mapping (for future reference)

| Test File               | Primary Pages Tested                                                |
| ----------------------- | ------------------------------------------------------------------- |
| `auth/*.spec.ts`        | AuthPages.tsx, ProtectedRoute.tsx                                   |
| `bands/*.spec.ts`       | BandMembersPage.tsx, GetStartedPage.tsx                             |
| `practices/*.spec.ts`   | PracticesPage.tsx, PracticeBuilderPage.tsx, PracticeSessionPage.tsx |
| `songs/*.spec.ts`       | SongsPage.tsx                                                       |
| `settings/*.spec.ts`    | SettingsPage.tsx                                                    |
| `sync/*.spec.ts`        | SetlistsPage.tsx, ShowsPage.tsx                                     |
| `permissions/*.spec.ts` | Various (cross-cutting)                                             |
