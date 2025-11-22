---
created: 2025-11-20T22:45
prompt: "Analyze all failing tests and document root causes with recommended fixes"
---

# Test Failure Analysis - Rock-On

## Summary

**Total Failures:** 64 tests across 8 test files
**Total Passing:** 491 tests across 25 test files
**Pass Rate:** 88.5% (not acceptable for production)

## Failure Categories

### Category 1: Journey Tests - Supabase Configuration (34 failures) 🔴 HIGH PRIORITY

**Files:**
- `tests/journeys/auth-journeys.test.ts` (8 failures)
- `tests/journeys/error-recovery-journeys.test.ts` (9 failures)
- `tests/journeys/realtime-sync-journeys.test.ts` (10 failures)
- `tests/journeys/sync-journeys.test.ts` (7 failures)

**Error Message:**
```
Error: Supabase client should only be used when Supabase auth is enabled
 ❯ Module.getSupabaseClient src/services/supabase/client.ts:9:11
```

**Root Cause:**
These integration tests require Supabase environment variables to be set during test execution. The Supabase client check (`src/services/supabase/client.ts:9`) throws an error when `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` are not present.

**Files Affected:**
- `tests/journeys/auth-journeys.test.ts` - All 8 tests
- `tests/journeys/error-recovery-journeys.test.ts` - All 9 tests
- `tests/journeys/realtime-sync-journeys.test.ts` - All 10 tests
- `tests/journeys/sync-journeys.test.ts` - All 7 tests

**Recommended Fix:**

**Option A: Configure Test Environment (RECOMMENDED)**
1. Create `.env.test` file with local Supabase credentials:
   ```bash
   VITE_SUPABASE_URL=http://127.0.0.1:54321
   VITE_SUPABASE_ANON_KEY=<local_anon_key>
   ```
2. Update `vitest.config.ts` to load test environment variables:
   ```typescript
   import { defineConfig } from 'vitest/config'
   import { loadEnv } from 'vite'

   export default defineConfig({
     test: {
       env: loadEnv('test', process.cwd(), ''),
       setupFiles: ['./tests/setup.ts'],
     },
   })
   ```
3. Ensure local Supabase is running before tests: `supabase start`
4. Add to test scripts in `package.json`:
   ```json
   "test": "supabase start && vitest run",
   "test:watch": "vitest"
   ```

**Option B: Mock Supabase Client**
- Mock `getSupabaseClient()` in test setup
- Not recommended for integration tests (defeats purpose)

**Test Setup Documentation:**
- Reference: `.claude/setup/TESTING-ENVIRONMENT-SETUP.md`
- User instruction: E2E tests should start from fresh local Supabase each time

**Implementation Priority:** HIGH (blocks 34 tests)

---

### Category 2: BandMembershipService - Outdated Test Mocks (12 failures) 🟡 MEDIUM PRIORITY

**File:** `tests/unit/services/BandMembershipService.test.ts`

**Error Message:**
```
TypeError: repository.getInviteCodeByCode is not a function
 ❯ Function.createInviteCode src/services/BandMembershipService.ts:32:43
```

**Failing Tests:**
1. `createInviteCode > should create invite code via database (not yet in repository)`
2. `createInviteCode > should retry if generated code already exists`
3. `createInviteCode > should use default maxUses of 10 if not provided`
4. `getBandInviteCodes > should get all invite codes for a band via database`
5. `validateInviteCode > should validate a valid invite code`
6. `validateInviteCode > should reject invalid invite code`
7. `validateInviteCode > should reject expired invite code`
8. `validateInviteCode > should reject invite code at max uses`
9. `validateInviteCode > should convert code to uppercase`
10. `joinBandWithCode > should join band with valid code via repository`
11. `joinBandWithCode > should reject if code is invalid`
12. `joinBandWithCode > should reject if user is already a member`
13. `deleteInviteCode > should delete invite code via database`

**Root Cause:**
The test mock for `RepositoryFactory` is outdated. The comment on line 28 says "Mock the database module for invite codes (not yet in repository)" but these methods ARE now implemented in `SyncRepository`:
- `getInviteCodeByCode()` exists at line 397
- `getInviteCodes()` exists at line 378
- `deleteInviteCode()` exists at line 470
- `getInviteCode()` exists at line 385
- `addInviteCode()` exists (needs verification)
- `updateInviteCode()` exists (needs verification)

The mock repository (lines 14-20) only includes:
```typescript
const mockRepository = {
  getBandMemberships: mockGetBandMemberships,
  getUserMemberships: mockGetUserMemberships,
  addBandMembership: mockAddBandMembership,
  updateBandMembership: mockUpdateBandMembership,
  deleteBandMembership: mockDeleteBandMembership,
  // ❌ MISSING: Invite code methods!
}
```

**Recommended Fix:**

Update the mock repository in `tests/unit/services/BandMembershipService.test.ts` (lines 6-26):

```typescript
vi.mock('../../../src/services/data/RepositoryFactory', () => {
  // Create mock functions inside the factory to avoid hoisting issues
  const mockGetBandMemberships = vi.fn()
  const mockGetUserMemberships = vi.fn()
  const mockAddBandMembership = vi.fn()
  const mockUpdateBandMembership = vi.fn()
  const mockDeleteBandMembership = vi.fn()
  // ADD: Invite code mocks
  const mockGetInviteCodes = vi.fn()
  const mockGetInviteCode = vi.fn()
  const mockGetInviteCodeByCode = vi.fn()
  const mockAddInviteCode = vi.fn()
  const mockUpdateInviteCode = vi.fn()
  const mockDeleteInviteCode = vi.fn()

  const mockRepository = {
    getBandMemberships: mockGetBandMemberships,
    getUserMemberships: mockGetUserMemberships,
    addBandMembership: mockAddBandMembership,
    updateBandMembership: mockUpdateBandMembership,
    deleteBandMembership: mockDeleteBandMembership,
    // ADD: Invite code methods
    getInviteCodes: mockGetInviteCodes,
    getInviteCode: mockGetInviteCode,
    getInviteCodeByCode: mockGetInviteCodeByCode,
    addInviteCode: mockAddInviteCode,
    updateInviteCode: mockUpdateInviteCode,
    deleteInviteCode: mockDeleteInviteCode,
  }

  return {
    repository: mockRepository,
    createRepository: () => mockRepository,
  }
})
```

Also extract the mock functions after import (after line 53):
```typescript
const mockGetInviteCodes = repository.getInviteCodes as ReturnType<typeof vi.fn>
const mockGetInviteCode = repository.getInviteCode as ReturnType<typeof vi.fn>
const mockGetInviteCodeByCode = repository.getInviteCodeByCode as ReturnType<typeof vi.fn>
const mockAddInviteCode = repository.addInviteCode as ReturnType<typeof vi.fn>
const mockUpdateInviteCode = repository.updateInviteCode as ReturnType<typeof vi.fn>
const mockDeleteInviteCode = repository.deleteInviteCode as ReturnType<typeof vi.fn>
```

Then update each test to use the repository mocks instead of the database mocks.

**Example test update:**
```typescript
// BEFORE (using database mock):
mockInviteCodesWhere.mockResolvedValue([])

// AFTER (using repository mock):
mockGetInviteCodeByCode.mockResolvedValue(null)
mockAddInviteCode.mockResolvedValue(inviteCode)
```

**Implementation Priority:** MEDIUM (12 tests, clear fix)

---

### Category 3: useBands Hooks - Multiple Issues (3 failures) 🟡 MEDIUM PRIORITY

**File:** `tests/unit/hooks/useBands.test.ts`

**Failures:**

**1. `useBandMembers > should fetch members with profiles`**
```
AssertionError: expected [] to have a length of 1 but got +0
```
- Expected 1 band member, got empty array
- Possible mock issue or hook logic error
- Needs investigation

**2. `useCreateBand > should create band using BandService`**
```
Error: Supabase client should only be used when Supabase auth is enabled
 ❯ Module.getSupabaseClient src/services/supabase/client.ts:9:11
```
- Same Supabase configuration issue as Category 1
- Fix: Configure test environment with Supabase credentials

**3. `useCreateBand > should handle creation errors`**
```
AssertionError: expected Error: Supabase client should only be use… to deeply equal Error: Failed to create band
```
- Error message mismatch
- Expected: `"Failed to create band"`
- Received: `"Supabase client should only be used when Supabase auth is enabled"`
- Related to Supabase configuration issue

**Recommended Fix:**
1. Fix Supabase configuration (same as Category 1)
2. Investigate `useBandMembers` mock setup
3. Verify BandService error handling once Supabase is configured

**Implementation Priority:** MEDIUM (3 tests, depends on Category 1 fix)

---

### Category 4: SupabaseAuthService Logout - Test Truncated (4+ failures) 🟡 MEDIUM PRIORITY

**File:** `tests/unit/services/auth/SupabaseAuthService.logout.test.ts`

**Visible Failures:**
1. `Clearing Supabase localStorage keys > should remove all keys starting with "sb-"`
2. `Clearing Supabase localStorage keys > should log each removed localStorage key`
3. `Clearing Supabase localStorage keys > should handle case with no Supabase keys gracefully`
4. `Supabase auth.signOut() integration > should call` (truncated)

**Root Cause:**
Test output was truncated - need to run this specific test file to see full error messages.

**Recommended Investigation:**
```bash
npm test -- tests/unit/services/auth/SupabaseAuthService.logout.test.ts
```

Likely issues:
- localStorage mock not working in test environment
- Supabase client mock issues
- Need to verify the actual errors

**Implementation Priority:** MEDIUM (4+ tests, needs investigation)

---

## Execution Plan

### Phase 1: Configure Test Environment (HIGH PRIORITY)
**Impact:** Fixes 34+ journey tests + 3 useBands tests = ~37 tests

**Steps:**
1. Check if local Supabase is running:
   ```bash
   supabase status
   ```
2. Get local Supabase credentials:
   ```bash
   supabase status | grep "anon key"
   ```
3. Create `.env.test` with local credentials
4. Update `vitest.config.ts` to load test env variables
5. Update test scripts to ensure Supabase is running
6. Run journey tests to verify fix:
   ```bash
   npm test -- tests/journeys/
   ```

**Estimated Time:** 30 minutes
**Risk:** Low (configuration only)

---

### Phase 2: Fix BandMembershipService Tests (MEDIUM PRIORITY)
**Impact:** Fixes 12 tests

**Steps:**
1. Update mock repository to include invite code methods
2. Update test assertions to use repository mocks
3. Remove obsolete database mocks for invite codes
4. Run tests to verify:
   ```bash
   npm test -- tests/unit/services/BandMembershipService.test.ts
   ```

**Estimated Time:** 45 minutes
**Risk:** Low (clear fix, well-understood)

---

### Phase 3: Investigate & Fix Remaining Tests (MEDIUM PRIORITY)
**Impact:** Fixes 7+ tests

**Steps:**
1. Run SupabaseAuthService tests in isolation:
   ```bash
   npm test -- tests/unit/services/auth/SupabaseAuthService.logout.test.ts
   ```
2. Analyze full error messages
3. Fix localStorage mock issues
4. Investigate `useBandMembers` empty array issue
5. Verify all fixes with full test suite:
   ```bash
   npm test
   ```

**Estimated Time:** 1-2 hours
**Risk:** Medium (needs investigation)

---

## Success Criteria

- ✅ All 64 failing tests now pass
- ✅ No new test failures introduced
- ✅ Test suite runs cleanly: `npm test` shows 100% pass rate
- ✅ E2E tests pass with fresh Supabase instance each run
- ✅ Documentation updated: `.claude/setup/TESTING-ENVIRONMENT-SETUP.md`

---

## E2E Testing Notes

Per user instruction:
> "when doing e2e tests you should be starting from a fresh local supabase instance each time"

**Implementation:**
1. E2E test setup should include:
   ```bash
   supabase db reset --db-url <local_db_url>
   ```
2. Update `.claude/setup/TESTING-ENVIRONMENT-SETUP.md` with this requirement
3. Consider adding to `playwright.config.ts` global setup:
   ```typescript
   globalSetup: './tests/global-setup.ts'
   ```

**File to check/update:** `.claude/setup/TESTING-ENVIRONMENT-SETUP.md`

---

## Files to Modify

1. **`.env.test`** (CREATE) - Test environment variables
2. **`vitest.config.ts`** (UPDATE) - Load test env
3. **`package.json`** (UPDATE) - Test scripts with Supabase start
4. **`tests/unit/services/BandMembershipService.test.ts`** (UPDATE) - Fix mocks
5. **`tests/unit/hooks/useBands.test.ts`** (INVESTIGATE) - Fix useBandMembers
6. **`tests/unit/services/auth/SupabaseAuthService.logout.test.ts`** (INVESTIGATE) - Fix localStorage mocks
7. **`.claude/setup/TESTING-ENVIRONMENT-SETUP.md`** (UPDATE) - Document E2E fresh DB requirement

---

## Next Steps

1. **User Decision:** Review this analysis and approve execution plan
2. **Implementation:** Follow Phase 1 → 2 → 3 in order
3. **Verification:** Run full test suite after each phase
4. **Documentation:** Update TESTING-ENVIRONMENT-SETUP.md
5. **Snapshot:** Create clean baseline with 100% passing tests

**Blocked By:** User approval to proceed with fixes
