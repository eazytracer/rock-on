# Setlist Sync Bypass Bug Fix - Implementation Tasks

**Feature**: setlist-sync-bypass (bugfix)
**Status**: Ready for implementation
**Branch**: bugfix/setlist-sync-bypass

---

## Phase 1: SetlistViewPage.tsx (Critical)

- [ ] T1.1: Add `getSyncRepository` import to SetlistViewPage.tsx
  - Files: `src/pages/SetlistViewPage.tsx`
  - Acceptance: Import statement added

- [ ] T1.2: Fix `createSetlist()` to use `repo.addSetlist()`
  - Files: `src/pages/SetlistViewPage.tsx`
  - Acceptance: New setlists sync to Supabase

- [ ] T1.3: Fix `saveField()` to use `repo.updateSetlist()`
  - Files: `src/pages/SetlistViewPage.tsx`
  - Acceptance: Field edits sync to Supabase

- [ ] T1.4: Fix `saveItems()` to use `repo.updateSetlist()`
  - Files: `src/pages/SetlistViewPage.tsx`
  - Acceptance: Item reordering syncs to Supabase

- [ ] T1.5: Fix `addBreak()` to use `repo.updateSetlist()`
  - Files: `src/pages/SetlistViewPage.tsx`
  - Acceptance: Adding breaks syncs to Supabase

- [ ] T1.6: Fix `addSection()` to use `repo.updateSetlist()`
  - Files: `src/pages/SetlistViewPage.tsx`
  - Acceptance: Adding sections syncs to Supabase

- [ ] T1.7: Fix `EditSongModal onSave` to use `repo.updateSong()`
  - Files: `src/pages/SetlistViewPage.tsx`
  - Acceptance: Song edits from setlist view sync to Supabase

- [ ] T1.8: Run existing tests to verify no regressions
  - Command: `npm test`
  - Acceptance: All existing tests pass

---

## Phase 2: ShowViewPage.tsx (High Priority)

- [ ] T2.1: Add `getSyncRepository` import to ShowViewPage.tsx
  - Files: `src/pages/ShowViewPage.tsx`
  - Acceptance: Import statement added

- [ ] T2.2: Fix `saveField()` to use `repo.updateShow()`
  - Files: `src/pages/ShowViewPage.tsx`
  - Acceptance: Show field edits sync to Supabase

- [ ] T2.3: Fix `saveDateTime()` to use `repo.updateShow()`
  - Files: `src/pages/ShowViewPage.tsx`
  - Acceptance: DateTime changes sync to Supabase

- [ ] T2.4: Fix `saveContacts()` to use `repo.updateShow()`
  - Files: `src/pages/ShowViewPage.tsx`
  - Acceptance: Contact changes sync to Supabase

- [ ] T2.5: Fix setlist fork to use `repo.addSetlist()`
  - Files: `src/pages/ShowViewPage.tsx`
  - Acceptance: Forked setlists sync to Supabase

- [ ] T2.6: Fix `handleCreateNewSetlist()` to use `repo.addSetlist()`
  - Files: `src/pages/ShowViewPage.tsx`
  - Acceptance: New setlists from show sync to Supabase

- [ ] T2.7: Fix `createShow()` to use `repo.addShow()`
  - Files: `src/pages/ShowViewPage.tsx`
  - Acceptance: New shows sync to Supabase

---

## Phase 3: SetlistsPage.tsx (Low Priority)

- [ ] T3.1: Fix `handleDelete()` practice session update
  - Files: `src/pages/SetlistsPage.tsx`
  - Acceptance: Practice session updates sync to Supabase

- [ ] T3.2: Fix `handleSave()` practice session update
  - Files: `src/pages/SetlistsPage.tsx`
  - Acceptance: Practice session saves sync to Supabase

---

## Phase 4: E2E Test Infrastructure

- [ ] T4.1: Create `tests/helpers/databaseVerification.ts` with helper functions
  - Files: `tests/helpers/databaseVerification.ts`
  - Acceptance: Helper functions compile and export correctly

- [ ] T4.2: Create `tests/e2e/sync/database-sync-verification.spec.ts`
  - Files: `tests/e2e/sync/database-sync-verification.spec.ts`
  - Acceptance: Test file structure created

- [ ] T4.3: [P] Add `data-testid` attributes to SetlistViewPage elements (if missing)
  - Files: `src/pages/SetlistViewPage.tsx`
  - Acceptance: Key elements have testable IDs

- [ ] T4.4: [P] Add `data-testid` attributes to ShowViewPage elements (if missing)
  - Files: `src/pages/ShowViewPage.tsx`
  - Acceptance: Key elements have testable IDs

---

## Phase 5: E2E Tests - Positive Cases

- [ ] T5.1: Test: New setlist syncs to Supabase
  - Files: `tests/e2e/sync/database-sync-verification.spec.ts`
  - Acceptance: Test passes, verifies data in Supabase

- [ ] T5.2: [P] Test: Setlist field updates sync to Supabase
  - Files: `tests/e2e/sync/database-sync-verification.spec.ts`
  - Acceptance: Test passes, verifies updated data in Supabase

- [ ] T5.3: [P] Test: Adding breaks/sections syncs to Supabase
  - Files: `tests/e2e/sync/database-sync-verification.spec.ts`
  - Acceptance: Test passes, verifies items in Supabase

- [ ] T5.4: [P] Test: New show syncs to Supabase
  - Files: `tests/e2e/sync/database-sync-verification.spec.ts`
  - Acceptance: Test passes, verifies show in Supabase

---

## Phase 6: E2E Tests - Offline/Online

- [ ] T6.1: Test: Offline edits show pending sync status
  - Files: `tests/e2e/sync/database-sync-verification.spec.ts`
  - Acceptance: Sync icon shows pending when offline

- [ ] T6.2: Test: Offline edits sync when connection restored
  - Files: `tests/e2e/sync/database-sync-verification.spec.ts`
  - Acceptance: Data syncs after going back online

---

## Phase 7: Verification

- [ ] T7.1: Run full test suite
  - Command: `npm test && npm run test:e2e`
  - Acceptance: All tests pass

- [ ] T7.2: Manual verification in Supabase Studio
  - Acceptance: Created setlists/shows appear in database

---

## Task Summary

**Total Tasks**: 25
**Critical Path**: Phase 1 (T1.1-T1.8) → Phase 2 (T2.1-T2.7) → Phase 4-6 (Tests)
**Parallelizable**: T4.3, T4.4, T5.2, T5.3, T5.4 (marked with [P])
