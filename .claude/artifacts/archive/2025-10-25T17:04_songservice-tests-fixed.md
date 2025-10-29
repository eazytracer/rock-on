# SongService Unit Tests - Fixed

**Timestamp**: 2025-10-25T17:04
**Original Prompt**: Fix failing SongService unit tests with mocking issues for RepositoryFactory

## Summary

Successfully fixed the mocking setup for SongService unit tests. The issue was with how `vi.mock()` hoisting works in Vitest - mock functions need to be created inside the factory function to avoid initialization errors.

## Problem Identified

The tests were failing with "expected 'spy' to be called 1 times, but got 0 times" errors because:

1. Mock functions were defined at module scope before `vi.mock()`
2. Vitest hoists `vi.mock()` calls to the top of the file
3. This caused a "Cannot access before initialization" error
4. The mocks weren't being properly connected to the repository instance

## Solution Applied

**File Modified**: `/workspaces/rock-on/tests/unit/services/SongService.test.ts`

### Key Changes:

1. **Mock Setup**: Created mock functions inside the `vi.mock()` factory function to avoid hoisting issues
2. **Mock Extraction**: After importing, extracted the mock functions from the mocked repository instance
3. **Consistent References**: Ensured all mock function calls use the same references throughout the tests
4. **Removed Type Casting**: Cleaned up unnecessary type casting syntax (`;(mockFn as any)` → `mockFn`)

### Mock Structure:

```typescript
// Mock the RepositoryFactory module BEFORE importing SongService
vi.mock('../../../src/services/data/RepositoryFactory', () => {
  // Create mock functions inside the factory to avoid hoisting issues
  const mockGetSongs = vi.fn()
  const mockAddSong = vi.fn()
  const mockUpdateSong = vi.fn()
  const mockDeleteSong = vi.fn()

  const mockRepository = {
    getSongs: mockGetSongs,
    addSong: mockAddSong,
    updateSong: mockUpdateSong,
    deleteSong: mockDeleteSong,
  }

  return {
    repository: mockRepository,
    createRepository: () => mockRepository,
  }
})

// Import SongService AFTER the mock is set up
import { SongService } from '../../../src/services/SongService'
// Import the mocked repository to get access to the mock functions
import { repository } from '../../../src/services/data/RepositoryFactory'

// Extract mock functions for test assertions
const mockGetSongs = repository.getSongs as ReturnType<typeof vi.fn>
const mockAddSong = repository.addSong as ReturnType<typeof vi.fn>
const mockUpdateSong = repository.updateSong as ReturnType<typeof vi.fn>
const mockDeleteSong = repository.deleteSong as ReturnType<typeof vi.fn>
```

## Test Results

### Before Fix:
- All 18 SongService tests were failing
- Mock functions were not being called
- Tests showed 0 calls when expecting 1

### After Fix:
```
✓ 18 tests passed in tests/unit/services/SongService.test.ts
  ✓ getAllSongs (6 tests)
  ✓ getPersonalSongs (1 test)
  ✓ getBandSongs (1 test)
  ✓ createSong (4 tests)
  ✓ getSongById (2 tests)
  ✓ updateSong (2 tests)
  ✓ deleteSong (2 tests)
```

**Test Suite Status**:
- Test Files: 10 passed, 9 failed (unrelated to SongService)
- Tests: 232 passed, 20 failed (all failures in utils.test.ts - unrelated)
- **SongService**: 18/18 tests passing ✓

## Key Learnings

1. **Vitest Mock Hoisting**: `vi.mock()` is hoisted to the top of the file, so any variables referenced inside must be defined within the factory function
2. **Mock Function References**: Must extract mock functions from the mocked module after import to ensure the same references are used
3. **Import Order**: Critical to mock before importing the module that depends on the mocked module

## Verification

All SongService tests now properly verify that:
- ✓ `repository.getSongs()` is called with correct filters
- ✓ `repository.addSong()` is called when creating songs
- ✓ `repository.updateSong()` is called when updating songs
- ✓ `repository.deleteSong()` is called when deleting songs
- ✓ Client-side filtering works correctly (search, key, difficulty, tags)
- ✓ Validation errors are thrown appropriately
- ✓ Edge cases are handled (non-existent songs, invalid data)
