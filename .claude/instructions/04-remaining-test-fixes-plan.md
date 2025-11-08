---
title: Phase 3 - Remaining Test Fixes Implementation Plan
created: 2025-10-30T01:56
status: In Progress
phase: Phase 3
current_pass_rate: 98.2% (447/455)
target: 100% (455/455)
---

# Phase 3 - Remaining Test Fixes Implementation Plan

## Current Status

**Unit Test Pass Rate:** 98.2% (447/455 passing)

### Passing ✅
- **SyncEngine:** 21/21 (100%)
- **RemoteRepository:** 13/13 (100%)
- **LocalRepository:** All passing
- **Other sync infrastructure:** All passing

### Failing ❌
- **useSongs.test.ts:** 2 failures (sync event listening)
- **PracticesPage.test.tsx:** 6 failures (hook integration)

**Total Failures:** 8 tests across 2 files

---

## Failing Tests Analysis

### 1. tests/unit/hooks/useSongs.test.ts (2 failures)

#### Test 1: "should refetch when sync status changes"
**Location:** `tests/unit/hooks/useSongs.test.ts`

**Failure Reason:** Likely related to sync status event subscription/mock setup

**Expected Behavior:**
- Hook should listen to sync status changes
- When sync status changes, refetch songs
- Use mock sync service to trigger status change

**Fix Strategy:**
1. Check if sync service is properly mocked
2. Verify event emitter/listener pattern
3. Ensure mock triggers correct event type
4. Validate refetch is called after status change

**Files to Check:**
- `src/hooks/useSongs.ts` - Hook implementation
- `src/services/SyncService.ts` - Sync status events
- Test setup/teardown for event listeners

#### Test 2: "should clear error on successful refetch"
**Location:** `tests/unit/hooks/useSongs.test.ts`

**Failure Reason:** Error state management in hook

**Expected Behavior:**
- Hook should set error state on failed fetch
- On successful refetch, error should be cleared
- Mock should simulate error → success sequence

**Fix Strategy:**
1. Verify error state management in useSongs hook
2. Check if refetch properly clears error
3. Ensure mock can simulate both error and success
4. Validate error state transitions

---

### 2. tests/unit/pages/PracticesPage.test.tsx (6 failures)

#### Common Pattern
All 6 failures are "hook integration" tests that verify the page uses correct hooks.

**Tests:**
1. "should display practices from useUpcomingPractices hook"
2. "should display songs using useSongs hook data (not direct queries)"
3. "should use createPractice hook (verified by import)"
4. "should use updatePractice hook (verified by import)"
5. "should use deletePractice hook (verified by import)"
6. "should use useSongs hook for song data (verified by import)"

**Failure Pattern:** Tests verify imports and hook usage through React Testing Library

**Likely Causes:**
1. Mock setup for hooks incomplete
2. Test utilities need hook context providers
3. Import verification strategy may be flawed
4. Hook return values not properly mocked

**Fix Strategy:**
1. Add proper React Query/hook context providers to test setup
2. Mock all hooks with realistic return values
3. Verify component actually renders with mocked data
4. Check if tests should use integration approach instead

---

## Implementation Plan

### Step 1: Fix useSongs.test.ts (Est: 30-45 min)

**Actions:**
1. Read `tests/unit/hooks/useSongs.test.ts` completely
2. Read `src/hooks/useSongs.ts` implementation
3. Identify sync event subscription pattern
4. Update test setup to properly mock sync service
5. Add event emitter test utilities if needed
6. Run tests: `npm test -- tests/unit/hooks/useSongs.test.ts`
7. Verify both tests pass

**Success Criteria:**
- ✅ Both sync event tests passing
- ✅ No new test failures introduced
- ✅ Mock setup documented in test file

---

### Step 2: Fix PracticesPage.test.tsx (Est: 45-60 min)

**Decision Point:** Determine if these should be unit or integration tests

**Option A: Keep as Unit Tests**
- Mock all hooks completely
- Add proper test providers
- Verify component renders with mocked data

**Option B: Convert to Integration Tests**
- Move to `tests/integration/`
- Use real hooks with test database
- More realistic but slower

**Recommended: Option A** (Keep as unit tests with better mocks)

**Actions:**
1. Read `tests/unit/pages/PracticesPage.test.tsx` completely
2. Read `src/pages/NewLayout/PracticesPage.tsx` implementation
3. Identify all hooks used by component
4. Create comprehensive mock setup for all hooks
5. Add React Query provider wrapper if needed
6. Verify component renders with mocked data
7. Run tests: `npm test -- tests/unit/pages/PracticesPage.test.tsx`
8. Verify all 6 tests pass

**Success Criteria:**
- ✅ All 6 hook integration tests passing
- ✅ Component renders in test environment
- ✅ Hook usage properly verified
- ✅ No new test failures introduced

---

## Integration Tests (Not Urgent)

### tests/integration/optimistic-updates.test.ts

**Status:** Failing (exact count TBD)

**Fix Strategy:**
1. Apply shared fixture pattern from SyncEngine tests
2. Use `createTestIds()`, `createTestSong()`, etc.
3. Replace all hardcoded IDs with UUIDs
4. Ensure proper cleanup in afterEach

**Files to Update:**
- `tests/integration/optimistic-updates.test.ts`
- Use fixtures from `tests/helpers/testFixtures.ts`

**Estimated Time:** 30-45 min

---

### tests/integration/cloud-first-reads.test.ts

**Status:** Failing (exact count TBD)

**Fix Strategy:**
Same as optimistic-updates.test.ts

**Estimated Time:** 30-45 min

---

### tests/integration/immediate-sync.test.ts

**Status:** Failing (exact count TBD)

**Fix Strategy:**
Same as optimistic-updates.test.ts

**Estimated Time:** 30-45 min

---

## Timeline

### Priority 1: Unit Tests (Target: 100% unit test pass rate)
- [ ] useSongs.test.ts fixes (30-45 min)
- [ ] PracticesPage.test.tsx fixes (45-60 min)

**Total Time:** ~1.5-2 hours
**Target:** 455/455 unit tests passing (100%)

### Priority 2: Integration Tests (Can be done separately)
- [ ] optimistic-updates.test.ts (30-45 min)
- [ ] cloud-first-reads.test.ts (30-45 min)
- [ ] immediate-sync.test.ts (30-45 min)

**Total Time:** ~1.5-2 hours
**Target:** All integration tests passing

---

## Validation Process

### After Each Test File Fix

1. **Run the specific test file:**
   ```bash
   npm test -- path/to/test.test.ts
   ```

2. **Verify no regressions:**
   ```bash
   npm test -- tests/unit/
   ```

3. **Check TypeScript:**
   ```bash
   npx tsc --noEmit
   ```

4. **Update progress in this document**

### After All Fixes Complete

1. **Run full test suite:**
   ```bash
   npm test
   ```

2. **Verify final pass rate:**
   - Target: 455/455 unit tests (100%)
   - Integration tests: All passing

3. **Create completion report:**
   - Document in `.claude/artifacts/`
   - Update roadmap percentage to 90%

4. **Update roadmap:**
   - Mark Phase 3 as 90% complete
   - Link completion report

---

## Common Patterns Discovered

### From SyncEngine Test Fixes

1. **UUID Generation:**
   ```typescript
   const testIds = createTestIds()
   // Use testIds.band1, testIds.song1, etc.
   ```

2. **Test Data Creation:**
   ```typescript
   const song = createTestSong(testIds, {
     title: 'Custom Title',
     // override other fields
   })
   ```

3. **Supabase Format:**
   ```typescript
   const supabaseSong = createSupabaseSong(testIds, {
     // Uses snake_case fields
   })
   ```

4. **Database Hooks:**
   - Check if hooks override provided values
   - Add conditional logic: `if (!obj.field) obj.field = defaultValue`

5. **Field Names:**
   - Application: camelCase (bpm, createdDate)
   - Supabase: snake_case (tempo, created_date)
   - Use mapping functions when needed

---

## Next Agent Instructions

### To Fix Unit Tests

1. **Start here:**
   ```bash
   npm test -- tests/unit/hooks/useSongs.test.ts
   ```

2. **Read these files first:**
   - `tests/unit/hooks/useSongs.test.ts`
   - `src/hooks/useSongs.ts`
   - `src/services/SyncService.ts` (for event pattern)

3. **Apply fixes from this document**

4. **Move to PracticesPage tests:**
   ```bash
   npm test -- tests/unit/pages/PracticesPage.test.tsx
   ```

5. **Document your findings:**
   - Update this file with discovered issues
   - Note any pattern changes
   - Link to completion report

### To Fix Integration Tests

1. **Apply fixture pattern:**
   - Import from `tests/helpers/testFixtures.ts`
   - Replace hardcoded IDs with `createTestIds()`
   - Use `createTestSong()`, etc.

2. **Run each file separately:**
   ```bash
   npm test -- tests/integration/optimistic-updates.test.ts
   npm test -- tests/integration/cloud-first-reads.test.ts
   npm test -- tests/integration/immediate-sync.test.ts
   ```

3. **Verify no breaking changes:**
   ```bash
   npm test
   ```

---

## Success Metrics

### Phase 3 Completion Criteria

- ✅ **SyncEngine:** 21/21 tests (100%) - **COMPLETE**
- ✅ **Test Fixtures:** Created and documented - **COMPLETE**
- ✅ **Dexie Hook Fix:** Timestamps preserved - **COMPLETE**
- [ ] **Unit Tests:** 455/455 passing (100%) - **8 remaining**
- [ ] **Integration Tests:** All passing - **TBD count**
- [ ] **Chrome MCP Validation:** Screenshots captured - **Pending**
- [ ] **Cloud-First Reads:** Implementation complete - **40% remaining**

**Current:** 85% Phase 3 Complete
**Target:** 95% Phase 3 Complete (after unit test fixes)
**Final:** 100% Phase 3 Complete (after all items above)

---

## Resources

### Test Files
- `tests/helpers/testFixtures.ts` - Shared test data
- `tests/helpers/testDatabase.ts` - Database utilities
- `tests/unit/services/data/SyncEngine.test.ts` - Reference for fixture usage

### Documentation
- `.claude/specifications/unified-database-schema.md` - Schema reference
- `.claude/artifacts/2025-10-30T01:15_syncengine-uuid-fixes-completion.md` - Previous fixes
- `.claude/artifacts/2025-10-29T16:15_unified-implementation-roadmap.md` - Overall plan

### Commands
```bash
# Run specific test file
npm test -- path/to/test.test.ts

# Run all unit tests
npm test -- tests/unit/

# Run all integration tests
npm test -- tests/integration/

# Type check
npx tsc --noEmit

# Full test suite
npm test
```

---

**Document Status:** Ready for implementation
**Next Step:** Fix `tests/unit/hooks/useSongs.test.ts`
**Estimated Total Time:** 3-4 hours to 100% test passing
