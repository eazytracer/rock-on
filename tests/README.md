# Rock-On Test Suite Documentation

## Table of Contents
1. [Test Strategy Overview](#test-strategy-overview)
2. [Test Types](#test-types)
3. [Mock Patterns](#mock-patterns)
4. [Architecture Layers](#architecture-layers)
5. [Common Pitfalls](#common-pitfalls)
6. [Examples](#examples)

---

## Test Strategy Overview

Rock-On uses a multi-layered testing strategy to ensure code quality, reliability, and maintainability:

- **Unit Tests** - Fast, isolated tests for individual components
- **Integration Tests** - Test interactions with real Supabase database
- **Journey Tests** - End-to-end user workflow tests with real infrastructure
- **E2E Tests** - Browser-based tests using Playwright
- **Contract Tests** - API contract validation tests
- **Database Tests** - Schema validation using pgTAP

**Key Principle:** Mock at the boundary, not internally.

---

## Test Types

### Unit Tests (`tests/unit/`)

**Purpose:** Test individual units of code in isolation
**Speed:** ⚡ Very Fast (< 1s per test)
**Isolation:** Complete - all dependencies mocked
**Use When:** Testing business logic, calculations, transformations

**Structure:**
```
tests/unit/
├── config/          # Configuration tests
├── hooks/           # React hooks tests
├── services/        # Service layer tests
│   ├── data/        # Repository & sync tests
│   └── auth/        # Authentication tests
└── utils.test.ts    # Utility function tests
```

### Integration Tests (`tests/integration/`)

**Purpose:** Test component interactions with real database
**Speed:** 🐢 Slow (2-10s per test)
**Isolation:** Partial - uses real Supabase, mocked UI
**Use When:** Testing database operations, sync flows

### Journey Tests (`tests/journeys/`)

**Purpose:** Test complete user workflows
**Speed:** 🐌 Very Slow (10-60s per journey)
**Isolation:** None - uses real infrastructure
**Use When:** Testing critical user paths, multi-step flows

### E2E Tests (`tests/e2e/`)

**Purpose:** Browser-based UI testing
**Speed:** 🐌 Very Slow (10-120s per test)
**Isolation:** None - full stack with real browser
**Use When:** Testing UI interactions, visual regressions

---

## Mock Patterns

### Pattern 1: Service Layer Tests (Most Common)

**What to Mock:** Repository layer
**What NOT to Mock:** Business logic within the service

```typescript
// ✅ CORRECT: tests/unit/services/SongService.test.ts

// 1. Mock the RepositoryFactory BEFORE importing the service
vi.mock('../../../src/services/data/RepositoryFactory', () => {
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

// 2. Import service AFTER mock setup
import { SongService } from '../../../src/services/SongService'
import { repository } from '../../../src/services/data/RepositoryFactory'

// 3. Extract mock functions for assertions
const mockGetSongs = repository.getSongs as ReturnType<typeof vi.fn>
const mockAddSong = repository.addSong as ReturnType<typeof vi.fn>

// 4. Use in tests
describe('SongService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should get all songs', async () => {
    // Arrange
    const mockSongs = [{ id: '1', title: 'Test Song' }]
    mockGetSongs.mockResolvedValue(mockSongs)

    // Act
    const result = await SongService.getAllSongs()

    // Assert
    expect(mockGetSongs).toHaveBeenCalled()
    expect(result).toEqual(mockSongs)
  })
})
```

**Why This Pattern?**
- ✅ Tests business logic in isolation
- ✅ Fast execution (no real database calls)
- ✅ Predictable, deterministic results
- ✅ Easy to test error conditions

### Pattern 2: Repository Layer Tests

**What to Mock:** LocalRepository, RemoteRepository, SyncEngine
**What NOT to Mock:** SyncRepository logic

```typescript
// ✅ CORRECT: tests/unit/services/data/SyncRepository.test.ts

vi.mock('../../../../src/services/data/LocalRepository')
vi.mock('../../../../src/services/data/RemoteRepository')
vi.mock('../../../../src/services/data/SyncEngine')

import { SyncRepository } from '../../../../src/services/data/SyncRepository'
import { LocalRepository } from '../../../../src/services/data/LocalRepository'
import { RemoteRepository } from '../../../../src/services/data/RemoteRepository'

describe('SyncRepository', () => {
  let syncRepository: SyncRepository
  let mockLocal: any
  let mockRemote: any

  beforeEach(() => {
    mockLocal = {
      getSongs: vi.fn(),
      addSong: vi.fn(),
      // ... other methods
    }
    mockRemote = {
      getSongs: vi.fn(),
      addSong: vi.fn(),
      // ... other methods
    }

    vi.mocked(LocalRepository).mockImplementation(() => mockLocal)
    vi.mocked(RemoteRepository).mockImplementation(() => mockRemote)

    syncRepository = new SyncRepository('test-user-id')
  })

  it('should delegate to LocalRepository when offline', async () => {
    // Arrange
    Object.defineProperty(navigator, 'onLine', { value: false })
    mockLocal.getSongs.mockResolvedValue([])

    // Act
    await syncRepository.getSongs('band-1')

    // Assert
    expect(mockLocal.getSongs).toHaveBeenCalled()
    expect(mockRemote.getSongs).not.toHaveBeenCalled()
  })
})
```

### Pattern 3: React Hooks Tests

**What to Mock:** Services, Repositories, Supabase client
**What NOT to Mock:** React hooks logic, React Testing Library

```typescript
// ✅ CORRECT: tests/unit/hooks/useBands.test.ts

// 1. Mock Supabase client
vi.mock('../../../src/services/supabase/client', () => {
  const mockInsert = vi.fn()
  const mockSelect = vi.fn()
  const mockSingle = vi.fn()
  const mockFrom = vi.fn(() => ({
    insert: mockInsert.mockReturnValue({
      select: mockSelect.mockReturnValue({
        single: mockSingle
      })
    })
  }))

  return {
    getSupabaseClient: vi.fn(() => ({
      from: mockFrom,
      _mockSingle: mockSingle, // Expose for test setup
    }))
  }
})

// 2. Mock services
vi.mock('../../../src/services/BandService')
vi.mock('../../../src/services/BandMembershipService')

// 3. Mock repository
vi.mock('../../../src/services/data/SyncRepository', () => {
  const mockRepo = {
    on: vi.fn(),
    off: vi.fn(),
    getUser: vi.fn(),
    getBand: vi.fn(),
    // ... other data methods
  }

  return {
    getSyncRepository: vi.fn(() => mockRepo),
  }
})

import { renderHook, act } from '@testing-library/react'
import { useCreateBand } from '../../../src/hooks/useBands'
import { getSupabaseClient } from '../../../src/services/supabase/client'

describe('useBands Hooks', () => {
  it('should create band using Supabase', async () => {
    // Arrange
    const mockSupabaseClient = getSupabaseClient() as any
    mockSupabaseClient._mockSingle.mockResolvedValue({
      data: { id: 'band-1', name: 'Test Band' },
      error: null
    })

    // Act
    const { result } = renderHook(() => useCreateBand())
    await act(async () => {
      await result.current.createBand({ name: 'Test Band' }, 'user-1')
    })

    // Assert
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })
})
```

### Pattern 4: Integration Tests (NO Mocks)

**What to Mock:** Nothing - use real Supabase
**What to Setup:** Test database with seed data

```typescript
// ✅ CORRECT: tests/integration/template.test.ts

import { describe, it, expect, beforeEach } from 'vitest'
import { resetTestDatabase } from '../helpers/testDatabase'

describe('Integration Test', () => {
  beforeEach(async () => {
    // Real database reset - no mocks!
    await resetTestDatabase()
  })

  it('should perform real database operations', async () => {
    // Use real services, real repository, real Supabase
    // No mocks - this tests the full integration
  })
})
```

---

## Architecture Layers

### Application Architecture

```
┌─────────────────────────────────────────┐
│          UI Components (React)          │ ← E2E/Journey Tests
├─────────────────────────────────────────┤
│        React Hooks (useBands)           │ ← Mock: Services, Repository
├─────────────────────────────────────────┤
│   Services (BandService, SongService)   │ ← Mock: Repository
├─────────────────────────────────────────┤
│      RepositoryFactory (Singleton)      │
├─────────────────────────────────────────┤
│      SyncRepository (Orchestrator)      │ ← Mock: Local, Remote, Engine
├─────┬───────────────────────────┬───────┤
│Local│    SyncEngine (Queue)     │Remote │ ← Mock: Supabase, Dexie
├─────┴───────────────────────────┴───────┤
│   Dexie (IndexedDB)   Supabase Client  │ ← Integration Tests (real)
└─────────────────────────────────────────┘
```

### What to Mock at Each Layer

| Layer | Test Type | Mock This | Keep Real |
|-------|-----------|-----------|-----------|
| **Services** | Unit | Repository | Business logic |
| **Hooks** | Unit | Services, Repository, Supabase | Hook logic, React |
| **Repository** | Unit | Local, Remote, Engine | Orchestration logic |
| **Data Access** | Unit | Supabase client, Dexie | Transformation logic |
| **Integration** | Integration | Nothing | Everything |
| **Journey** | Journey | Nothing | Everything |

---

## Common Pitfalls

### ❌ Anti-Pattern 1: Mocking Too Deep

```typescript
// ❌ WRONG: Don't mock implementation details
vi.mock('../../../src/services/SongService', () => ({
  SongService: {
    getAllSongs: vi.fn(),
    addSong: vi.fn(),
  }
}))

// Test becomes useless - you're testing the mock, not the code!
```

**Why It's Wrong:** You're testing your mock, not your actual code.

**✅ Fix:** Mock the dependency (repository), not the thing being tested (service).

### ❌ Anti-Pattern 2: Mixing Old and New Mock Patterns

```typescript
// ❌ WRONG: Mixing database mocks with repository mocks
vi.mock('../../../src/services/data/RepositoryFactory', () => ({
  repository: { getInviteCodes: vi.fn() }
}))

// Then later in test:
mockInviteCodesWhere.mockReturnValue({ ... }) // This doesn't exist!
```

**Why It's Wrong:** Test setup and implementation use different mocking strategies.

**✅ Fix:** Use repository mocks consistently:

```typescript
// Mock setup
const mockGetInviteCodeByCode = vi.fn()

// Test
mockGetInviteCodeByCode.mockResolvedValue(mockInviteCode)
```

### ❌ Anti-Pattern 3: Not Clearing Mocks Between Tests

```typescript
// ❌ WRONG: Mocks retain state from previous tests
describe('Service Tests', () => {
  it('test 1', async () => {
    mockGetSongs.mockResolvedValue([song1])
    // ... test
  })

  it('test 2', async () => {
    // mockGetSongs still has previous config!
    // This test may pass/fail unpredictably
  })
})
```

**✅ Fix:** Always clear mocks in beforeEach:

```typescript
beforeEach(() => {
  vi.clearAllMocks()
})
```

### ❌ Anti-Pattern 4: Testing Implementation, Not Behavior

```typescript
// ❌ WRONG: Testing how something is done
it('should call repository.getSongs with correct params', async () => {
  await SongService.getAllSongs('band-1')
  expect(mockGetSongs).toHaveBeenCalledWith('band-1')
})

// ✅ BETTER: Test what the result is
it('should return all songs for band', async () => {
  mockGetSongs.mockResolvedValue([song1, song2])
  const result = await SongService.getAllSongs('band-1')
  expect(result).toEqual([song1, song2])
})
```

---

## Examples

### Example 1: Service Test with Repository Mock

**File:** `tests/unit/services/BandMembershipService.test.ts`

```typescript
// 1. Setup mocks BEFORE imports
vi.mock('../../../src/services/data/RepositoryFactory', () => {
  const mockGetInviteCodeByCode = vi.fn()
  const mockAddInviteCode = vi.fn()
  const mockDeleteInviteCode = vi.fn()

  const mockRepository = {
    getInviteCodeByCode: mockGetInviteCodeByCode,
    addInviteCode: mockAddInviteCode,
    deleteInviteCode: mockDeleteInviteCode,
  }

  return {
    repository: mockRepository,
    createRepository: () => mockRepository,
  }
})

// 2. Import service
import { BandMembershipService } from '../../../src/services/BandMembershipService'
import { repository } from '../../../src/services/data/RepositoryFactory'

// 3. Extract mocks
const mockGetInviteCodeByCode = repository.getInviteCodeByCode as ReturnType<typeof vi.fn>
const mockAddInviteCode = repository.addInviteCode as ReturnType<typeof vi.fn>

// 4. Write tests
describe('BandMembershipService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should validate invite code', async () => {
    // Arrange
    const mockCode = {
      id: '1',
      code: 'ABC123',
      isActive: true,
      maxUses: 10,
      currentUses: 5
    }
    mockGetInviteCodeByCode.mockResolvedValue(mockCode)

    // Act
    const result = await BandMembershipService.validateInviteCode('ABC123')

    // Assert
    expect(result.valid).toBe(true)
    expect(mockGetInviteCodeByCode).toHaveBeenCalledWith('ABC123')
  })

  it('should reject invalid invite code', async () => {
    // Arrange
    mockGetInviteCodeByCode.mockResolvedValue(null)

    // Act
    const result = await BandMembershipService.validateInviteCode('INVALID')

    // Assert
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Invalid invite code')
  })
})
```

### Example 2: Repository Test with Lower-Level Mocks

**File:** `tests/unit/services/data/SyncRepository.test.ts`

```typescript
// 1. Mock dependencies
vi.mock('../../../../src/services/data/LocalRepository')
vi.mock('../../../../src/services/data/RemoteRepository')
vi.mock('../../../../src/services/data/SyncEngine')

// 2. Import classes
import { SyncRepository } from '../../../../src/services/data/SyncRepository'
import { LocalRepository } from '../../../../src/services/data/LocalRepository'
import { RemoteRepository } from '../../../../src/services/data/RemoteRepository'

// 3. Setup test
describe('SyncRepository', () => {
  let syncRepo: SyncRepository
  let mockLocal: any
  let mockRemote: any

  beforeEach(() => {
    mockLocal = {
      getSongs: vi.fn(),
      addSong: vi.fn(),
    }
    mockRemote = {
      getSongs: vi.fn(),
      addSong: vi.fn(),
    }

    vi.mocked(LocalRepository).mockImplementation(() => mockLocal)
    vi.mocked(RemoteRepository).mockImplementation(() => mockRemote)

    syncRepo = new SyncRepository('user-1')
  })

  it('should use LocalRepository when offline', async () => {
    // Arrange
    Object.defineProperty(navigator, 'onLine', { value: false })
    mockLocal.getSongs.mockResolvedValue([])

    // Act
    await syncRepo.getSongs('band-1')

    // Assert
    expect(mockLocal.getSongs).toHaveBeenCalled()
    expect(mockRemote.getSongs).not.toHaveBeenCalled()
  })
})
```

### Example 3: Hook Test with Multiple Mocks

**File:** `tests/unit/hooks/useBands.test.ts`

```typescript
// 1. Mock Supabase client
vi.mock('../../../src/services/supabase/client', () => {
  const mockSingle = vi.fn()
  const mockSelect = vi.fn(() => ({ single: mockSingle }))
  const mockInsert = vi.fn(() => ({ select: mockSelect }))
  const mockFrom = vi.fn(() => ({ insert: mockInsert }))

  return {
    getSupabaseClient: vi.fn(() => ({
      from: mockFrom,
      _mockSingle: mockSingle,
    }))
  }
})

// 2. Mock repository
vi.mock('../../../src/services/data/SyncRepository', () => ({
  getSyncRepository: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    getUser: vi.fn(),
    getBand: vi.fn(),
  }))
}))

// 3. Import and test
import { renderHook, act } from '@testing-library/react'
import { useCreateBand } from '../../../src/hooks/useBands'
import { getSupabaseClient } from '../../../src/services/supabase/client'

describe('useCreateBand', () => {
  it('should create band successfully', async () => {
    // Arrange
    const mockClient = getSupabaseClient() as any
    mockClient._mockSingle.mockResolvedValue({
      data: { id: 'band-1', name: 'Test' },
      error: null
    })

    // Act
    const { result } = renderHook(() => useCreateBand())
    await act(async () => {
      await result.current.createBand({ name: 'Test' }, 'user-1')
    })

    // Assert
    expect(result.current.error).toBeNull()
  })
})
```

---

## Quick Reference

### When to Use Which Pattern

| You're Testing | Mock This | Example File |
|----------------|-----------|--------------|
| Service (BandService) | Repository | `tests/unit/services/BandService.test.ts` |
| Service (SongService) | Repository | `tests/unit/services/SongService.test.ts` |
| Repository (SyncRepository) | Local, Remote, Engine | `tests/unit/services/data/SyncRepository.test.ts` |
| Hook (useBands) | Services, Repository, Supabase | `tests/unit/hooks/useBands.test.ts` |
| Integration Flow | Nothing (real deps) | `tests/integration/template.test.ts` |
| User Journey | Nothing (real deps) | `tests/journeys/sync-journeys.test.ts` |

### Mock Setup Checklist

- [ ] Mocks defined BEFORE imports
- [ ] Service imported AFTER mocks
- [ ] Mock functions extracted with proper types
- [ ] `vi.clearAllMocks()` in `beforeEach()`
- [ ] Mock returns match real data structures
- [ ] All mock methods used in tests are defined

### Test Writing Checklist

- [ ] Follows Arrange-Act-Assert pattern
- [ ] Descriptive test name (what, when, expected)
- [ ] Mocks configured for specific test case
- [ ] Assertions test behavior, not implementation
- [ ] Error cases tested
- [ ] Edge cases covered

---

## Resources

- **Vitest Documentation:** https://vitest.dev
- **React Testing Library:** https://testing-library.com/react
- **Playwright (E2E):** https://playwright.dev
- **Rock-On Test Helpers:** `tests/helpers/`

---

**Last Updated:** 2025-11-21
**Maintainer:** Rock-On Development Team
