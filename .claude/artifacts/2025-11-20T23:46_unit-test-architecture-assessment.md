---
created: 2025-11-20T23:46
prompt: "Assess whether failing unit tests still make sense in the current architecture after repository pattern migration"
---

# Unit Test Architecture Assessment

## Executive Summary

**Verdict:** ✅ **All 16 failing tests ARE still relevant** - they just need mocks updated to match the current implementation.

**Key Finding:** Tests were written for **OLD architecture** (direct database access) but code has been **migrated to repository pattern**. Tests are testing the right behaviors, just using outdated mocks.

---

## Architecture Evolution

### What Changed

**Before (Old Architecture):**
```typescript
// BandMembershipService directly accessed database
const inviteCode = await db.inviteCodes.where('code').equals(code).first()
```

**After (Current Architecture):**
```typescript
// BandMembershipService uses repository pattern
const inviteCode = await repository.getInviteCodeByCode(code)
```

**Migration Status:** ✅ Complete
- All invite code operations migrated to repository
- Methods exist in SyncRepository (verified)
- Tests still testing OLD implementation

---

## Test File 1: BandMembershipService.test.ts

### Current Mock Setup (OUTDATED)

**Lines 28-29:**
```typescript
// Mock the database module for invite codes (not yet in repository)  ← OUTDATED COMMENT!
vi.mock('../../../src/services/database', () => {
  // Mocking direct database access
})
```

**Reality:** Invite codes **ARE** in repository now!

### What the Tests Are Testing

**13 Failing Tests:**
1-3. `createInviteCode` tests (3 tests)
   - ✅ **Valid**: Tests code generation, retry logic, defaults
   - Uses: `repository.getInviteCodeByCode()`, `repository.addInviteCode()`

4. `getBandInviteCodes` test (1 test)
   - ✅ **Valid**: Tests fetching invite codes for a band
   - Uses: `repository.getInviteCodes(bandId)`

5-9. `validateInviteCode` tests (5 tests)
   - ✅ **Valid**: Tests validation logic (expired, max uses, inactive, etc.)
   - Uses: `repository.getInviteCodeByCode()`

10-12. `joinBandWithCode` tests (3 tests)
   - ⚠️ **COMPLEX**: Uses `RemoteRepository` directly + `repository.pullFromRemote()`
   - **Recommendation:** Keep as unit tests BUT also cover in E2E/integration tests
   - These test business logic (validation, existing member check), not infrastructure

13. `deleteInviteCode` test (1 test)
   - ✅ **Valid**: Tests delete operation
   - Uses: `repository.deleteInviteCode()`

### Actual Implementation (Current Code)

**From BandMembershipService.ts:**

```typescript
// All these methods USE repository now:
static async createInviteCode(request)           → repository.getInviteCodeByCode(), repository.addInviteCode()
static async getBandInviteCodes(bandId)          → repository.getInviteCodes(bandId)
static async validateInviteCode(code)            → repository.getInviteCodeByCode()
static async deleteInviteCode(inviteCodeId)      → repository.deleteInviteCode()

// Special case (uses RemoteRepository directly):
static async joinBandWithCode(userId, code)      → RemoteRepository().addBandMembership()
                                                    repository.getUserMemberships()
                                                    repository.incrementInviteCodeUsage()
                                                    repository.pullFromRemote()
```

### SyncRepository Methods (Confirmed to Exist)

```typescript
// src/services/data/SyncRepository.ts
async getInviteCodes(bandId: string)                → Line 378 ✅
async getInviteCodeByCode(code: string)             → Line 397 ✅
async addInviteCode(inviteCode: InviteCode)         → Line 411 ✅
async incrementInviteCodeUsage(id: string)          → Line 457 ✅
async deleteInviteCode(id: string)                  → Line 470 ✅
async pullFromRemote(userId: string)                → (exists) ✅
```

### Assessment: BandMembershipService Tests

**Verdict:** ✅ **Keep all 13 tests** - Update mocks to match current architecture

**Rationale:**
1. Tests are testing **valid business logic** (validation, generation, cleanup)
2. Repository pattern is the **current architecture** (not a temporary state)
3. Tests provide value by ensuring:
   - Invite codes are generated uniquely
   - Validation rules work correctly
   - Edge cases handled (expired, max uses, duplicates)
4. These are **true unit tests** - testing service logic in isolation

**Action Required:**
- Add repository methods to mock (lines 6-26)
- Remove database mock (lines 28-48) - no longer used
- Update test implementations to use repository mocks

---

## Test File 2: useBands.test.ts

### Current Mock Setup

**Lines 23-45:**
```typescript
vi.mock('../../../src/services/data/SyncRepository', () => {
  const mockRepo = {
    on: vi.fn(),
    off: vi.fn(),
    _triggerChange: () => {...},
    // ❌ MISSING: All data access methods!
  }
  return { getSyncRepository: () => mockRepo }
})
```

### What the Tests Are Testing

**3 Failing Tests:**

1. **`useBandMembers > should fetch members with profiles`**
   - **Error:** `TypeError: repo2.getUser is not a function`
   - **Test Intent:** Verify hook fetches band members and their user profiles
   - **Verdict:** ✅ **Valid test** - just missing `getUser()` mock

2. **`useCreateBand > should create band using BandService`**
   - **Error:** `Error: Failed to create band: new row violates row-level security policy`
   - **Test Intent:** Verify hook calls BandService.createBand()
   - **Issue:** Test calling real Supabase instead of mocked BandService
   - **Verdict:** ✅ **Valid test** - BandService mock not configured properly

3. **`useCreateBand > should handle creation errors`**
   - **Error:** Error message mismatch (RLS error vs generic error)
   - **Test Intent:** Verify hook handles BandService errors
   - **Issue:** Same as #2 - hitting real Supabase
   - **Verdict:** ✅ **Valid test** - BandService mock needs fixing

### Assessment: useBands Tests

**Verdict:** ✅ **Keep all 3 tests** - Fix mocks for proper isolation

**Rationale:**
1. These are testing **React hooks** - important UI logic
2. Tests verify hooks correctly:
   - Call repository/service methods
   - Handle loading states
   - Handle errors
   - Transform data for UI
3. Tests should use mocks (this is a **unit test file**, not integration)

**Action Required:**
- Add `getUser()` to SyncRepository mock
- Ensure BandService mock is properly configured (line 21)
- Verify tests use mocks instead of real Supabase

---

## Special Case: joinBandWithCode Flow

### Current Implementation (BandMembershipService.ts:95-175)

```typescript
static async joinBandWithCode(userId: string, code: string) {
  // 1. Validate invite code (via repository)
  const validation = await this.validateInviteCode(code)

  // 2. Check existing membership (via repository)
  const userMemberships = await repository.getUserMemberships(userId)

  // 3. Create membership DIRECTLY in Supabase (bypass queue)
  const remote = new RemoteRepository()
  await remote.addBandMembership(membership)  // ← Direct Supabase write

  // 4. Increment usage (via repository, uses Postgres function)
  await repository.incrementInviteCodeUsage(inviteCode.id)

  // 5. Pull band data from remote
  await repository.pullFromRemote(userId)

  return { success: true, membership }
}
```

### Why This Flow is Complex

**Direct Supabase Write:**
- **Purpose:** Ensures membership exists in Supabase before subsequent queries
- **Reason:** Avoids race conditions with sync queue
- **Comment:** "We DON'T add to LocalRepository here to avoid duplicates when pullFromRemote runs"

**This is an integration concern, not a unit test concern**

### Testing Strategy for joinBandWithCode

**Recommendation:** Multi-layer testing approach

1. **Unit Tests** (in BandMembershipService.test.ts)
   - ✅ Test business logic:
     - Validation (code invalid/expired/maxed)
     - Existing membership check
     - Error handling
   - **Mock:** RemoteRepository, repository methods
   - **Don't test:** Actual Supabase write/sync behavior

2. **E2E Tests** (already exist!)
   - **File:** `tests/e2e/auth/join-band.spec.ts`
   - ✅ Test full flow with real Supabase
   - Verify end-to-end behavior works

**Current State:**
- ✅ E2E test exists and is passing!
- ❌ Unit test using outdated mocks

**Verdict:** ✅ **Keep unit tests** AND rely on E2E for integration verification

---

## Recommendations

### 1. Update BandMembershipService.test.ts (13 tests)

**Add to repository mock (lines 6-26):**
```typescript
vi.mock('../../../src/services/data/RepositoryFactory', () => {
  const mockGetBandMemberships = vi.fn()
  const mockGetUserMemberships = vi.fn()
  const mockAddBandMembership = vi.fn()
  const mockUpdateBandMembership = vi.fn()
  const mockDeleteBandMembership = vi.fn()

  // ADD: Invite code methods
  const mockGetInviteCodes = vi.fn()
  const mockGetInviteCode = vi.fn()
  const mockGetInviteCodeByCode = vi.fn()
  const mockAddInviteCode = vi.fn()
  const mockUpdateInviteCode = vi.fn()
  const mockDeleteInviteCode = vi.fn()
  const mockIncrementInviteCodeUsage = vi.fn()
  const mockPullFromRemote = vi.fn()

  const mockRepository = {
    getBandMemberships: mockGetBandMemberships,
    getUserMemberships: mockGetUserMemberships,
    addBandMembership: mockAddBandMembership,
    updateBandMembership: mockUpdateBandMembership,
    deleteBandMembership: mockDeleteBandMembership,
    getInviteCodes: mockGetInviteCodes,
    getInviteCode: mockGetInviteCode,
    getInviteCodeByCode: mockGetInviteCodeByCode,
    addInviteCode: mockAddInviteCode,
    updateInviteCode: mockUpdateInviteCode,
    deleteInviteCode: mockDeleteInviteCode,
    incrementInviteCodeUsage: mockIncrementInviteCodeUsage,
    pullFromRemote: mockPullFromRemote,
  }

  return {
    repository: mockRepository,
    createRepository: () => mockRepository,
  }
})
```

**Remove database mock (lines 28-48):**
- No longer needed - invite codes use repository now

**Mock RemoteRepository for joinBandWithCode tests:**
```typescript
vi.mock('../../../src/services/data/RemoteRepository', () => {
  return {
    RemoteRepository: vi.fn().mockImplementation(() => ({
      addBandMembership: vi.fn().mockResolvedValue(undefined),
    })),
  }
})
```

### 2. Update useBands.test.ts (3 tests)

**Add to SyncRepository mock (lines 26-37):**
```typescript
const mockRepo = {
  on: vi.fn(),
  off: vi.fn(),
  _triggerChange: () => {...},

  // ADD: Data access methods
  getUser: vi.fn(),
  getBand: vi.fn(),
  getBandMemberships: vi.fn(),
  getBandMembers: vi.fn(),
  createBand: vi.fn(),
}
```

**Verify BandService mock (line 21):**
```typescript
vi.mock('../../../src/services/BandService')

// In tests, ensure:
const mockCreateBand = BandService.createBand as ReturnType<typeof vi.fn>
mockCreateBand.mockResolvedValue(mockBand)  // or mockRejectedValue for error tests
```

---

## Summary

### Tests to Keep: All 16 ✅

| File | Tests | Verdict | Reason |
|------|-------|---------|--------|
| BandMembershipService.test.ts | 13 | ✅ Keep | Valid business logic tests, just outdated mocks |
| useBands.test.ts | 3 | ✅ Keep | Valid React hook tests, missing mock methods |

### Tests to Delete: None ❌

**No tests should be deleted.** All tests are:
- Testing current functionality
- Testing valid business logic
- Following proper unit test patterns
- Just using outdated mocks from before repository migration

### Why These Tests Matter

1. **Regression Prevention:** Catch bugs in invite code validation, generation, usage tracking
2. **Documentation:** Show how services/hooks should be used
3. **Refactoring Safety:** Allow confident code changes
4. **Fast Feedback:** Unit tests run in seconds (vs E2E in minutes)

### E2E Coverage

The join band flow IS also covered by E2E tests:
- **File:** `tests/e2e/auth/join-band.spec.ts`
- **Status:** ✅ Passing
- **Coverage:** Full flow with real Supabase

This gives us:
- **Unit tests:** Fast feedback on business logic
- **E2E tests:** Confidence in end-to-end flow

---

## Action Plan

1. ✅ **Update BandMembershipService.test.ts mocks** (~20 min)
   - Add invite code methods to repository mock
   - Remove database mock
   - Mock RemoteRepository

2. ✅ **Update useBands.test.ts mocks** (~10 min)
   - Add data access methods to SyncRepository mock
   - Verify BandService mock configuration

3. ✅ **Run tests** (~2 min)
   - Verify all 16 tests pass
   - Confirm 100% test pass rate (555/555)

**Total Estimated Time:** ~35 minutes

**Expected Outcome:** All tests passing, validating current architecture

---

**Conclusion:** Keep all tests, update mocks to match current repository pattern architecture.
