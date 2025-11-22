# Bug Report: 6 Failing SyncEngine Tests in CI

**Date**: 2025-11-22
**Severity**: Medium
**Component**: Unit Tests - SyncEngine
**Environment**: GitHub Actions CI (and local test runs)
**Status**: Open

## Summary

6 integration tests in `tests/unit/services/data/SyncEngine.test.ts` are failing with `TypeError: data.map is not a function`. The tests pass 436/442 (98.6% pass rate) but these specific tests are failing due to incomplete Supabase mocking.

## Failing Tests

### Initial Sync Tests (2 failures)
1. `SyncEngine - Initial Sync (Cloud → Local) > should download all data on initial sync`
2. `SyncEngine - Initial Sync (Cloud → Local) > should set last full sync timestamp`

**Error Location**: `RemoteRepository.getInviteCodes` at line 750

### Pull from Remote Tests (4 failures)
3. `SyncEngine - Pull from Remote (Incremental Sync) > should update existing records with newer remote versions`
4. `SyncEngine - Pull from Remote (Incremental Sync) > should insert new records from remote`
5. `SyncEngine - Pull from Remote (Incremental Sync) > should not overwrite local records that are newer`
6. `SyncEngine - Pull from Remote (Incremental Sync) > should update sync metadata after pull`

**Error Location**: `RemoteRepository.getShows` at line 537

## Error Details

```
TypeError: data.map is not a function
 ❯ RemoteRepository.getInviteCodes src/services/data/RemoteRepository.ts:750:17
    748|     if (error) throw error
    749|
    750|     return data.map(row => this.mapInviteCodeFromSupabase(row))
       |                 ^
    751|   }
```

```
TypeError: data.map is not a function
 ❯ RemoteRepository.getShows src/services/data/RemoteRepository.ts:537:17
    535|     if (error) throw error
    536|
    537|     return data.map(row => this.mapShowFromSupabase(row))
       |                 ^
    538|   }
```

## Root Cause Analysis

### Current Mocking Setup

**Global Fetch Mock** (`src/test/setup.ts:12-31`):
```typescript
global.fetch = vi.fn((url, options) => {
  if (typeof url === 'string' && url.includes('supabase')) {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({ data: [], error: null }),
      // ...
    }
    return Promise.resolve(mockResponse as Response)
  }
  return Promise.reject(new Error(`Unmocked fetch call to ${url}`))
}) as any
```

**Test-Specific Mocks** (`tests/unit/services/data/SyncEngine.test.ts:278-302`):
```typescript
beforeEach(async () => {
  // Mocks these RemoteRepository methods:
  vi.spyOn(remoteRepo, 'getUserMemberships').mockResolvedValue([...])
  vi.spyOn(remoteRepo, 'getBand').mockResolvedValue({...})
  vi.spyOn(remoteRepo, 'getBandMemberships').mockResolvedValue([])
  vi.spyOn(remoteRepo, 'getSongs').mockResolvedValue([...])
  vi.spyOn(remoteRepo, 'getSetlists').mockResolvedValue([...])
  vi.spyOn(remoteRepo, 'getPracticeSessions').mockResolvedValue([...])
  vi.spyOn(remoteRepo, 'getShows').mockResolvedValue([])

  syncEngine = new SyncEngine(localRepo, remoteRepo)
})
```

### The Problem

1. **Missing Mock for `getInviteCodes`**: The Initial Sync tests fail because `SyncEngine.performInitialSync()` calls `remoteRepo.getInviteCodes()` at line 469, but this method is NOT mocked in the test setup.

2. **Mock Not Working for `getShows`**: The Pull from Remote tests fail even though `getShows` IS mocked. This suggests either:
   - The mock is not being applied correctly
   - The SyncEngine is using a different RemoteRepository instance
   - The vi.spyOn mock is being bypassed somehow

3. **Data Type Mismatch**: When RemoteRepository methods call Supabase, they expect the Supabase client to return data directly, but the global fetch mock returns the full response object `{ data: [], error: null }`.

## Why Other Supabase Tests Pass

**SupabaseAuthService tests** (8/8 passing):
- These tests directly mock the Supabase client instance on the service
- Example from `SupabaseAuthService.logout.test.ts:31-36`:
  ```typescript
  ;(authService as any).supabase = {
    auth: {
      signOut: mockSupabaseSignOut,
      onAuthStateChange: vi.fn(...)
    }
  }
  ```
- This approach bypasses the fetch layer entirely

**Other SyncEngine tests** (15/21 passing in same file):
- Tests that don't call unmocked RemoteRepository methods pass
- Tests that use mocked methods (getSongs, getSetlists, etc.) work correctly

## Investigation Questions

1. **Is the remoteRepo instance being shared correctly?**
   - Check if `SyncEngine` constructor stores the passed `remoteRepo`
   - Verify it's not creating a new RemoteRepository internally

2. **Why doesn't the getShows mock work?**
   - The mock is set up at line 302
   - But tests still call the real RemoteRepository.getShows code
   - Is there a timing issue with the mock setup?

3. **Should we mock at a different layer?**
   - Mock the Supabase client directly on RemoteRepository?
   - Mock at the fetch level more comprehensively?
   - Use different test fixtures?

## Potential Fix Strategies

### Option 1: Add Missing Mocks (Quick Fix)
**Location**: `tests/unit/services/data/SyncEngine.test.ts:278-302`

Add to beforeEach:
```typescript
vi.spyOn(remoteRepo, 'getInviteCodes').mockResolvedValue([])
```

Investigate why `getShows` mock isn't working:
- Check if SyncEngine stores the remoteRepo reference correctly
- Verify mock is called: `expect(remoteRepo.getShows).toHaveBeenCalled()`
- Add debug logging to see if real method or mock is executing

### Option 2: Mock Supabase Client on RemoteRepository (Better)
**Location**: Same beforeEach block

```typescript
// Mock the Supabase client directly
;(remoteRepo as any).supabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        data: [],
        error: null
      }))
    }))
  }))
}
```

**Pros**: More comprehensive, matches SupabaseAuthService pattern
**Cons**: More complex, brittle if Supabase API changes

### Option 3: Improve Global Fetch Mock (Most Robust)
**Location**: `src/test/setup.ts:12-31`

Make the fetch mock smarter about different endpoints:
```typescript
global.fetch = vi.fn((url, options) => {
  if (typeof url === 'string' && url.includes('supabase')) {
    // Parse the URL to determine the endpoint
    const isRPC = url.includes('/rpc/')
    const isRest = url.includes('/rest/')

    // Determine response based on endpoint
    let responseData = []
    if (url.includes('invite_codes')) responseData = []
    if (url.includes('shows')) responseData = []
    // ... etc

    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ data: responseData, error: null }),
      // ...
    } as Response)
  }
  return Promise.reject(new Error(`Unmocked fetch call to ${url}`))
}) as any
```

**Pros**: Works for all tests, maintainable
**Cons**: Requires understanding Supabase REST API structure

### Option 4: Use Test Fixtures/Builders (Most Maintainable)
**Location**: `tests/helpers/testFixtures.ts` + test files

Create a RemoteRepository factory that returns a fully mocked instance:
```typescript
// tests/helpers/mockRemoteRepository.ts
export function createMockedRemoteRepository(testIds: TestIds) {
  const repo = new RemoteRepository()

  vi.spyOn(repo, 'getUserMemberships').mockResolvedValue([createTestMembership(testIds)])
  vi.spyOn(repo, 'getBand').mockResolvedValue(createTestBand(testIds))
  vi.spyOn(repo, 'getBandMemberships').mockResolvedValue([])
  vi.spyOn(repo, 'getSongs').mockResolvedValue([createSupabaseSong(testIds)])
  vi.spyOn(repo, 'getSetlists').mockResolvedValue([createTestSetlist(testIds)])
  vi.spyOn(repo, 'getPracticeSessions').mockResolvedValue([createTestPractice(testIds)])
  vi.spyOn(repo, 'getShows').mockResolvedValue([])
  vi.spyOn(repo, 'getInviteCodes').mockResolvedValue([])  // ← Missing!

  return repo
}
```

Usage in test:
```typescript
beforeEach(async () => {
  localRepo = new LocalRepository()
  remoteRepo = createMockedRemoteRepository(testIds)  // ← Use factory
  syncEngine = new SyncEngine(localRepo, remoteRepo)
})
```

**Pros**: Centralized, reusable, easy to maintain
**Cons**: Requires refactoring existing tests

## Recommended Approach

**Immediate**: Use **Option 1** to unblock CI
1. Add `getInviteCodes` mock to fix Initial Sync tests
2. Debug why `getShows` mock isn't working
3. Possibly add more debug logging

**Short-term**: Implement **Option 4**
- Create a `createMockedRemoteRepository` helper
- Ensures all methods are mocked consistently
- Makes tests more maintainable

**Long-term**: Consider **Option 3** if tests frequently break
- Improves global fetch mock to handle all Supabase endpoints
- Reduces need for test-specific mocking
- More resilient to codebase changes

## Files to Investigate

1. **`src/services/data/SyncEngine.ts`**
   - Line 445: `performInitialSync` - calls getBand
   - Line 469: calls `getInviteCodes` (unmocked!)
   - Line 653: `pullFromRemote` - calls pullShows
   - Line 787: `pullShows` - calls `remoteRepo.getShows()`

2. **`src/services/data/RemoteRepository.ts`**
   - Line 537: `getShows` - where error occurs
   - Line 750: `getInviteCodes` - where error occurs
   - Check how these methods use the Supabase client

3. **`tests/unit/services/data/SyncEngine.test.ts`**
   - Lines 257-307: Initial Sync test setup
   - Lines 376-?: Pull from Remote test setup
   - Verify remoteRepo is used correctly

4. **`src/test/setup.ts`**
   - Lines 12-31: Global fetch mock
   - May need enhancement for Supabase responses

## Success Criteria

- All 442 tests pass (100%)
- Tests run successfully in both local and CI environments
- Mocking strategy is maintainable and doesn't break with Supabase client updates
- Clear documentation of mocking approach for future developers

## Additional Context

- Current test pass rate: 436/442 (98.6%)
- All SupabaseAuthService tests pass (8/8)
- Only SyncEngine integration tests fail
- Tests work locally with similar results to CI
- vitest.config.ts provides mock Supabase credentials
- Global fetch mock handles basic Supabase calls
