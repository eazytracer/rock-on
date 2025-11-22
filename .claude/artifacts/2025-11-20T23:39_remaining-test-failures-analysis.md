---
created: 2025-11-20T23:39
prompt: "Analyze remaining 16 test failures after configuration fixes reduced failures from 64 to 16"
---

# Remaining Test Failures Analysis - Rock-On

## Executive Summary

**Major Success:** Configuration fixes reduced test failures by 75%!

| Metric | Before Fixes | After Fixes | Improvement |
|--------|-------------|-------------|-------------|
| **Failing Tests** | 64 | 16 | ⬇️ 75% reduction |
| **Failing Files** | 8 | 2 | ⬇️ 75% reduction |
| **Passing Tests** | 491 | 539 | ⬆️ 48 more passing |
| **Passing Files** | 25 | 31 | ⬆️ 6 more passing |

**Test Files:** 2 failed | 31 passed (33 total)
**Tests:** 16 failed | 539 passed (555 total)

---

## What Got Fixed (48 tests) ✅

### 1. Journey Tests - ALL 4 FILES PASSING (34 tests)
**Files:**
- `tests/journeys/auth-journeys.test.ts` (8 tests) ✅
- `tests/journeys/error-recovery-journeys.test.ts` (9 tests) ✅
- `tests/journeys/realtime-sync-journeys.test.ts` (10 tests) ✅
- `tests/journeys/sync-journeys.test.ts` (7 tests) ✅

**Previous Error:**
```
Error: Supabase client should only be used when Supabase auth is enabled
```

**Fix Applied:**
- Updated `vite.config.ts` to load `.env.test`
- Removed `VITE_MOCK_AUTH=true` from `.env.test`
- Journey tests now successfully connect to Supabase

### 2. SupabaseAuthService Logout Tests (4 tests) ✅
**File:** `tests/unit/services/auth/SupabaseAuthService.logout.test.ts`

**Previous Errors:**
- localStorage mock issues
- Supabase client mock problems

**Status:** All passing now (appears to have been fixed by environment configuration)

### 3. Additional Tests (10 tests) ✅
Various other tests that were failing due to missing environment configuration are now passing.

---

## What's Still Failing (16 tests) ❌

### Category 1: BandMembershipService - Outdated Mocks (13 failures)

**File:** `tests/unit/services/BandMembershipService.test.ts`
**Lines:** 6-53 (mock setup)

#### Root Cause

The mock repository is **missing invite code methods** that were added to `SyncRepository` after these tests were written.

**Current Mock (lines 14-20):**
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

**Actual SyncRepository Methods (src/services/data/SyncRepository.ts):**
```typescript
class SyncRepository {
  // Existing methods (mocked) ✅
  getBandMemberships()
  getUserMemberships()
  addBandMembership()
  updateBandMembership()
  deleteBandMembership()

  // NEW methods (NOT mocked) ❌
  getInviteCodes()         // Line 378
  getInviteCode()          // Line 385
  getInviteCodeByCode()    // Line 397
  addInviteCode()          // Needs verification
  updateInviteCode()       // Needs verification
  deleteInviteCode()       // Line 470
}
```

#### Failing Tests

1. `createInviteCode > should create invite code via database (not yet in repository)`
   - **Error:** `TypeError: repository.getInviteCodeByCode is not a function`
   - **Why:** Mock missing `getInviteCodeByCode()`

2. `createInviteCode > should retry if generated code already exists`
   - **Error:** `TypeError: repository.getInviteCodeByCode is not a function`
   - **Why:** Mock missing `getInviteCodeByCode()`

3. `createInviteCode > should use default maxUses of 10 if not provided`
   - **Error:** `TypeError: repository.getInviteCodeByCode is not a function`
   - **Why:** Mock missing `getInviteCodeByCode()`

4. `getBandInviteCodes > should get all invite codes for a band via database`
   - **Error:** `TypeError: repository.getInviteCodes is not a function`
   - **Why:** Mock missing `getInviteCodes()`

5. `validateInviteCode > should validate a valid invite code`
   - **Error:** `TypeError: repository.getInviteCodeByCode is not a function`
   - **Why:** Mock missing `getInviteCodeByCode()`

6. `validateInviteCode > should reject invalid invite code`
   - **Error:** `TypeError: repository.getInviteCodeByCode is not a function`
   - **Why:** Mock missing `getInviteCodeByCode()`

7. `validateInviteCode > should reject expired invite code`
   - **Error:** `TypeError: repository.getInviteCodeByCode is not a function`
   - **Why:** Mock missing `getInviteCodeByCode()`

8. `validateInviteCode > should reject invite code at max uses`
   - **Error:** `TypeError: repository.getInviteCodeByCode is not a function`
   - **Why:** Mock missing `getInviteCodeByCode()`

9. `validateInviteCode > should convert code to uppercase`
   - **Error:** `TypeError: repository.getInviteCodeByCode is not a function`
   - **Why:** Mock missing `getInviteCodeByCode()`

10. `joinBandWithCode > should join band with valid code via repository`
    - **Error:** `TypeError: repository.getInviteCodeByCode is not a function`
    - **Why:** Mock missing `getInviteCodeByCode()`

11. `joinBandWithCode > should reject if code is invalid`
    - **Error:** `TypeError: repository.getInviteCodeByCode is not a function`
    - **Why:** Mock missing `getInviteCodeByCode()`

12. `joinBandWithCode > should reject if user is already a member`
    - **Error:** `TypeError: repository.getInviteCodeByCode is not a function`
    - **Why:** Mock missing `getInviteCodeByCode()`

13. `deleteInviteCode > should delete invite code via database`
    - **Error:** `TypeError: repository.deleteInviteCode is not a function`
    - **Why:** Mock missing `deleteInviteCode()`

#### Fix Strategy

**Add invite code methods to mock repository:**

```typescript
// tests/unit/services/BandMembershipService.test.ts (lines 6-26)
vi.mock('../../../src/services/data/RepositoryFactory', () => {
  // Existing mocks
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

**Then extract mock references (after line 53):**
```typescript
const mockGetInviteCodes = repository.getInviteCodes as ReturnType<typeof vi.fn>
const mockGetInviteCode = repository.getInviteCode as ReturnType<typeof vi.fn>
const mockGetInviteCodeByCode = repository.getInviteCodeByCode as ReturnType<typeof vi.fn>
const mockAddInviteCode = repository.addInviteCode as ReturnType<typeof vi.fn>
const mockUpdateInviteCode = repository.updateInviteCode as ReturnType<typeof vi.fn>
const mockDeleteInviteCode = repository.deleteInviteCode as ReturnType<typeof vi.fn>
```

**Priority:** HIGH (13 tests, clear fix, well-understood)

---

### Category 2: useBands Hooks - Missing Repository Mocks (3 failures)

**File:** `tests/unit/hooks/useBands.test.ts`
**Lines:** 23-45 (SyncRepository mock setup)

#### Root Cause

The `SyncRepository` mock only includes `on`, `off`, and internal trigger methods. It's **missing repository data methods** that the hooks need.

**Current Mock (lines 26-37):**
```typescript
const mockRepo = {
  on: vi.fn((event: string, callback: () => void) => {
    mockCallbacks.add(callback)
  }),
  off: vi.fn((event: string, callback: () => void) => {
    mockCallbacks.delete(callback)
  }),
  _triggerChange: () => {
    mockCallbacks.forEach(cb => cb())
  },
  _clearMockCallbacks: () => mockCallbacks.clear(),
  // ❌ MISSING: All data access methods!
}
```

#### Failing Tests

1. **`useBandMembers > should fetch members with profiles`**
   - **Error:** `TypeError: repo2.getUser is not a function`
   - **Location:** `src/hooks/useBands.ts:246:37`
   - **Why:** Mock missing `getUser()` method
   - **Test Expectation:** Fetch 1 band member
   - **Actual Result:** Empty array (can't fetch without `getUser()`)

2. **`useCreateBand > should create band using BandService`**
   - **Error:** `Error: Failed to create band: new row violates row-level security policy for table "bands"`
   - **Why:** Test is creating a real band in Supabase but test user has no permission
   - **Note:** This might actually be a BandService issue, not a mock issue

3. **`useCreateBand > should handle creation errors`**
   - **Error:** `AssertionError: expected Error: Failed to create band: new row vio… to deeply equal Error: Failed to create band`
   - **Expected:** Generic "Failed to create band" error
   - **Received:** Detailed RLS policy violation error
   - **Why:** Same as #2 - real Supabase call instead of mock

#### Fix Strategy

**Option A: Add Missing Mock Methods (Unit Test Approach)**

Add data access methods to mock:
```typescript
const mockRepo = {
  // Existing event handlers
  on: vi.fn(...),
  off: vi.fn(...),

  // ADD: Data access methods
  getUser: vi.fn(),
  getBand: vi.fn(),
  getBandMemberships: vi.fn(),
  getBandMembers: vi.fn(),
  createBand: vi.fn(),
  // ... etc
}
```

**Option B: Mock BandService Instead (Service Layer Approach)**

The hooks use `BandService`, which is already mocked (line 21). The issue might be that `BandService` methods aren't properly mocked to return expected values.

Check if `BandService.createBand()` is mocked to return success/failure appropriately.

**Recommendation:**
- For `useBandMembers` test: Add `getUser()` to repository mock
- For `useCreateBand` tests: Ensure `BandService.createBand()` is mocked (don't call real Supabase in unit tests)

**Priority:** MEDIUM (3 tests, needs investigation)

---

## Summary

### Fixed by Configuration Changes (48 tests) ✅
- **Journey tests:** 34 tests (all 4 files)
- **SupabaseAuthService logout:** 4 tests
- **Other:** 10 tests

### Remaining Work (16 tests) ❌
- **BandMembershipService:** 13 tests - Add invite code methods to mocks
- **useBands hooks:** 3 tests - Add repository methods to mocks / fix service mocks

### Impact Analysis

**Before Configuration Fixes:**
```
Test Files  8 failed | 25 passed (33)
Tests       64 failed | 491 passed (555)
Success Rate: 88.5%
```

**After Configuration Fixes:**
```
Test Files  2 failed | 31 passed (33)
Tests       16 failed | 539 passed (555)
Success Rate: 97.1%
```

**Improvement:** +8.6 percentage points, 75% fewer failures!

---

## Next Steps

### Immediate (Fix Remaining Tests)

1. **Fix BandMembershipService mocks** (HIGH priority)
   - Add invite code methods to mock repository
   - Update test setup to use repository mocks
   - Expected outcome: 13 tests fixed

2. **Fix useBands hooks mocks** (MEDIUM priority)
   - Add `getUser()` to SyncRepository mock
   - Ensure BandService mocks properly configured
   - Expected outcome: 3 tests fixed

3. **Verify 100% pass rate**
   - Run full test suite
   - Confirm 555/555 tests passing

### After Tests Pass

4. **Add CI/CD pipeline**
   - GitHub Actions workflow
   - Run tests on every push/PR
   - Branch protection

5. **Add test coverage reporting**
   - Vitest coverage plugin
   - Set coverage thresholds

---

## Files to Modify

1. **`tests/unit/services/BandMembershipService.test.ts`**
   - Lines 6-26: Add invite code methods to mock
   - After line 53: Extract invite code mock references
   - Update test implementations to use repository mocks

2. **`tests/unit/hooks/useBands.test.ts`**
   - Lines 23-45: Add data access methods to SyncRepository mock
   - Verify BandService mock configuration (line 21)
   - Update test expectations if needed

---

**Status:** 75% of test failures resolved. 16 failures remaining, all mock-related with clear fix paths.
