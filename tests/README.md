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

Rock-On is a naive online Supabase client (Phase 2 data-layer simplification):
there is no local IndexedDB mirror and no sync engine. Reads/writes go straight
to Supabase via `RemoteRepository`; TanStack Query is the ephemeral in-memory
cache, and the `audit_log` change-feed (Supabase Realtime) drives freshness.

Testing layers:

- **Unit Tests** - Fast, isolated tests for components, hooks, services, and the
  repository (Supabase client mocked).
- **Integration Tests** - Exercise `RemoteRepository` against a mocked/real
  Supabase surface.
- **E2E Tests** - Browser-based tests using Playwright (full stack).
- **Contract Tests** - API contract validation.
- **Database Tests** - Schema + trigger validation using pgTAP.

**Key Principle:** Mock at the boundary (the Supabase client), not internally.

---

## Test Types

### Unit Tests (`tests/unit/`)

**Purpose:** Test individual units of code in isolation
**Speed:** ⚡ Very Fast (< 1s per test)
**Isolation:** Complete - dependencies mocked (repository or Supabase client)
**Use When:** Testing business logic, hooks, transformations, repository mapping

**Structure:**

```
tests/unit/
├── config/          # Configuration tests
├── hooks/           # React hooks tests
├── services/        # Service layer tests
│   ├── data/        # RemoteRepository & RealtimeManager tests
│   └── auth/        # Authentication tests
└── utils.test.ts    # Utility function tests
```

### Integration Tests (`tests/integration/`)

**Purpose:** Test `RemoteRepository` behavior against Supabase
**Speed:** 🐢 Slower
**Use When:** Testing query shaping, field mapping, and RLS-facing paths

### E2E Tests (`tests/e2e/`)

**Purpose:** Browser-based UI testing
**Speed:** 🐌 Very Slow
**Isolation:** None - full stack with real browser
**Use When:** Testing UI interactions, multi-member live flows, visual checks

### Database Tests (`supabase/tests/`, pgTAP)

**Purpose:** Validate schema, RLS policies, and triggers (incl. `audit_log`
change-feed coverage)
**Run:** `supabase db reset && npm run test:db`

---

## Mock Patterns

### Pattern 1: Service Layer Tests (Most Common)

**What to Mock:** Repository layer (`RepositoryFactory`)
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

### Pattern 2: Repository Layer Tests (`RemoteRepository`)

**What to Mock:** The Supabase client (`services/supabase/client`)
**What NOT to Mock:** `RemoteRepository`'s query shaping / field mapping

`RemoteRepository` is the only repository — it talks directly to Supabase. Mock
the Supabase client's fluent query builder and assert the repository maps
snake_case rows to camelCase models (and shapes writes correctly).

```typescript
// ✅ CORRECT: tests/unit/services/data/RemoteRepository.test.ts

vi.mock('../../../../src/services/supabase/client', () => {
  const mockSingle = vi.fn()
  const mockEq = vi.fn(() => ({ single: mockSingle, maybeSingle: mockSingle }))
  const mockSelect = vi.fn(() => ({ eq: mockEq }))
  const mockFrom = vi.fn(() => ({ select: mockSelect }))

  return {
    supabase: { from: mockFrom },
    getSupabaseClient: vi.fn(() => ({
      from: mockFrom,
      _mockSingle: mockSingle,
    })),
  }
})

import { RemoteRepository } from '../../../../src/services/data/RemoteRepository'

describe('RemoteRepository', () => {
  it('maps a Supabase row to the Song model', async () => {
    // Arrange the mocked query result, then:
    const repo = new RemoteRepository()
    const song = await repo.getSong('song-1')
    // Assert camelCase mapping, e.g. expect(song?.createdDate).toBeInstanceOf(Date)
  })
})
```

### Pattern 3: React Hooks Tests

**What to Mock:** Services, the repository, and/or the Supabase client
**What NOT to Mock:** React hooks logic, React Testing Library

```typescript
// ✅ CORRECT: tests/unit/hooks/useBands.test.ts

// 1. Mock Supabase client
vi.mock('../../../src/services/supabase/client', () => {
  const mockSingle = vi.fn()
  const mockSelect = vi.fn(() => ({ single: mockSingle }))
  const mockInsert = vi.fn(() => ({ select: mockSelect }))
  const mockFrom = vi.fn(() => ({ insert: mockInsert }))

  return {
    getSupabaseClient: vi.fn(() => ({
      from: mockFrom,
      _mockSingle: mockSingle, // Expose for test setup
    })),
  }
})

// 2. Mock the repository (RepositoryFactory)
vi.mock('../../../src/services/data/RepositoryFactory', () => ({
  repository: {
    getUser: vi.fn(),
    getBand: vi.fn(),
    getUserMemberships: vi.fn(),
    // ... other data methods
  },
}))

import { renderHook, act } from '@testing-library/react'
import { useCreateBand } from '../../../src/hooks/useBands'
import { getSupabaseClient } from '../../../src/services/supabase/client'

describe('useBands Hooks', () => {
  it('should create band using Supabase', async () => {
    // Arrange
    const mockSupabaseClient = getSupabaseClient() as any
    mockSupabaseClient._mockSingle.mockResolvedValue({
      data: { id: 'band-1', name: 'Test Band' },
      error: null,
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

> **TanStack Query note:** hooks that use `useQuery`/`useMutation` need a
> `QueryClientProvider` wrapper in `renderHook`. Create a fresh `QueryClient`
> per test (with retries disabled) so cache state doesn't leak between tests.

### Pattern 4: RealtimeManager Tests

`RealtimeManager` is a pure change-notifier: it subscribes to the `audit_log`
Realtime channel and emits `{entity}:changed` events plus batched toasts. It no
longer writes to any local store. Mock the Supabase Realtime channel and assert
the emitted events, not any data application.

See `tests/unit/services/data/RealtimeManager.test.ts` for the current pattern.

---

## Architecture Layers

### Application Architecture

```
┌─────────────────────────────────────────┐
│          UI Components (React)          │ ← E2E Tests
├─────────────────────────────────────────┤
│  React Hooks (useBands, TanStack Query) │ ← Mock: Services, Repository, Supabase
├─────────────────────────────────────────┤
│   Services (BandService, SongService)   │ ← Mock: Repository
├─────────────────────────────────────────┤
│      RepositoryFactory (Singleton)      │
├─────────────────────────────────────────┤
│   RemoteRepository (direct Supabase)    │ ← Mock: Supabase client
├─────────────────────────────────────────┤
│            Supabase Client              │ ← Integration/E2E (real)
└─────────────────────────────────────────┘

Freshness: RealtimeManager subscribes to audit_log (Supabase Realtime) and
emits *:changed events → hooks invalidate TanStack Query caches.
```

### What to Mock at Each Layer

| Layer               | Test Type   | Mock This                      | Keep Real                     |
| ------------------- | ----------- | ------------------------------ | ----------------------------- |
| **Services**        | Unit        | Repository                     | Business logic                |
| **Hooks**           | Unit        | Services, Repository, Supabase | Hook logic, React, TanStack   |
| **Repository**      | Unit        | Supabase client                | Query shaping / field mapping |
| **RealtimeManager** | Unit        | Supabase Realtime channel      | Event emission / batching     |
| **Integration**     | Integration | (minimal)                      | RemoteRepository + Supabase   |
| **E2E**             | E2E         | Nothing                        | Everything                    |

---

## Common Pitfalls

### ❌ Anti-Pattern 1: Mocking Too Deep

```typescript
// ❌ WRONG: Don't mock the thing you're testing
vi.mock('../../../src/services/SongService', () => ({
  SongService: {
    getAllSongs: vi.fn(),
    addSong: vi.fn(),
  },
}))

// Test becomes useless - you're testing the mock, not the code!
```

**Why It's Wrong:** You're testing your mock, not your actual code.

**✅ Fix:** Mock the dependency (repository), not the thing being tested (service).

### ❌ Anti-Pattern 2: Mixing Old and New Mock Patterns

```typescript
// ❌ WRONG: reaching for a Dexie-style fluent chain that no longer exists
vi.mock('../../../src/services/data/RepositoryFactory', () => ({
  repository: { getInviteCodeByCode: vi.fn() }
}))

// Then later in test:
mockInviteCodesWhere.mockReturnValue({ ... }) // db.* no longer exists!
```

**Why It's Wrong:** There is no `db.*` / Dexie layer anymore. Everything goes
through `repository.*` (or, one level down, the mocked Supabase client).

**✅ Fix:** Use repository mocks consistently:

```typescript
const mockGetInviteCodeByCode = vi.fn()
mockGetInviteCodeByCode.mockResolvedValue(mockInviteCode)
```

### ❌ Anti-Pattern 3: Not Clearing Mocks Between Tests

```typescript
// ✅ Fix: Always clear mocks in beforeEach
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
const mockGetInviteCodeByCode = repository.getInviteCodeByCode as ReturnType<
  typeof vi.fn
>

// 4. Write tests
describe('BandMembershipService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should validate invite code', async () => {
    const mockCode = {
      id: '1',
      code: 'ABC123',
      isActive: true,
      maxUses: 10,
      currentUses: 5,
    }
    mockGetInviteCodeByCode.mockResolvedValue(mockCode)

    const result = await BandMembershipService.validateInviteCode('ABC123')

    expect(result.valid).toBe(true)
    expect(mockGetInviteCodeByCode).toHaveBeenCalledWith('ABC123')
  })

  it('should reject invalid invite code', async () => {
    mockGetInviteCodeByCode.mockResolvedValue(null)

    const result = await BandMembershipService.validateInviteCode('INVALID')

    expect(result.valid).toBe(false)
    expect(result.error).toBe('Invalid invite code')
  })
})
```

### Example 2: RealtimeManager Test (event emission)

**File:** `tests/unit/services/data/RealtimeManager.test.ts`

Mock the Supabase Realtime channel, feed a synthetic `audit_log` change, and
assert a `{entity}:changed` event is emitted (and that own-changes don't toast).
No data-application assertions — the manager only notifies.

---

## Quick Reference

### When to Use Which Pattern

| You're Testing                | Mock This                      | Example File                                        |
| ----------------------------- | ------------------------------ | --------------------------------------------------- |
| Service (BandService)         | Repository                     | `tests/unit/services/BandService.test.ts`           |
| Service (SongService)         | Repository                     | `tests/unit/services/SongService.test.ts`           |
| Repository (RemoteRepository) | Supabase client                | `tests/unit/services/data/RemoteRepository.test.ts` |
| Hook (useBands)               | Services, Repository, Supabase | `tests/unit/hooks/useBands.test.ts`                 |
| RealtimeManager               | Supabase Realtime channel      | `tests/unit/services/data/RealtimeManager.test.ts`  |
| DB schema / triggers / RLS    | Nothing (pgTAP)                | `supabase/tests/*.test.sql`                         |

### Mock Setup Checklist

- [ ] Mocks defined BEFORE imports
- [ ] Service imported AFTER mocks
- [ ] Mock functions extracted with proper types
- [ ] `vi.clearAllMocks()` in `beforeEach()`
- [ ] Mock returns match real data structures
- [ ] All mock methods used in tests are defined
- [ ] TanStack-Query hooks wrapped in a fresh `QueryClientProvider`

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
- **TanStack Query:** https://tanstack.com/query
- **Playwright (E2E):** https://playwright.dev
- **pgTAP:** https://pgtap.org

---

**Last Updated:** 2026-09-15
**Maintainer:** Rock-On Development Team
