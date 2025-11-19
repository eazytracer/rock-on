# Testing & Quality Improvement Plan

**Date:** 2025-11-02T03:02
**Purpose:** Prevent regression bugs and improve code quality
**Status:** 📋 Proposed - Awaiting Approval

---

## Problem Statement

### Recent Issues That Slipped Through

1. **Duplicate Band Subscriptions** (2025-11-02)
   - No test for calling `subscribeToUserBands()` twice
   - No test for idempotency
   - No integration test for AuthContext subscription lifecycle

2. **React Duplicate Keys** (2025-11-02)
   - No test for deduplication in hooks
   - No component rendering tests
   - No integration test for data flow from repository → hook → component

3. **Previous Issues:**
   - Seed file misconfiguration (2025-11-01)
   - Session expiry handling gaps
   - Realtime auth token issues (2025-10-30)

### Root Causes

1. **Testing Gaps:**
   - Unit tests don't cover edge cases (duplicate calls, race conditions)
   - No integration tests for critical flows (auth, subscriptions, sync)
   - No contract tests for repository interfaces
   - No E2E tests for real-time collaboration

2. **Specification Gaps:**
   - Specs don't define error handling requirements
   - Specs don't define idempotency requirements
   - Specs don't define testing requirements
   - Specs don't define invariants (e.g., "only one subscription per band")

3. **Development Process Gaps:**
   - No "test-first" requirement for new features
   - No checklist for what tests are required
   - No guidelines for when integration vs unit tests are needed
   - No automated checks for test coverage on critical paths

---

## Proposed Solution: Multi-Layered Testing Strategy

### Layer 1: Enhanced Unit Tests (Fast, Isolated)

**Purpose:** Catch logic errors, edge cases, and regressions early

**Requirements for Critical Modules:**

1. **RealtimeManager**
   - ✅ Basic subscription (exists)
   - ✅ Multiple bands (exists)
   - ✅ Event emission (exists)
   - ❌ **MISSING: Duplicate subscription prevention**
   - ❌ **MISSING: Idempotency tests**
   - ❌ **MISSING: Concurrent subscription calls**
   - ❌ **MISSING: Subscription cleanup on duplicate**

2. **AuthContext**
   - ❌ **MISSING: All tests!**
   - Need: Session restoration behavior
   - Need: Duplicate effect execution
   - Need: RealtimeManager lifecycle
   - Need: Subscription cleanup on unmount

3. **Repository Layer**
   - ✅ Basic CRUD (exists)
   - ✅ Sync operations (exists)
   - ❌ **MISSING: Duplicate data handling**
   - ❌ **MISSING: Concurrent operations**
   - ❌ **MISSING: Race condition handling**

4. **Hooks (useBands, useSongs, etc.)**
   - ❌ **MISSING: All hook tests!**
   - Need: Data deduplication
   - Need: Refetch behavior
   - Need: Event listener cleanup
   - Need: Concurrent fetch handling

**Example: Missing RealtimeManager Test**

```typescript
describe('RealtimeManager - Idempotency', () => {
  it('should not create duplicate subscriptions when called twice with same bands', async () => {
    const userId = 'user-1'
    const bandIds = ['band-1']

    // Call twice
    await manager.subscribeToUserBands(userId, bandIds)
    await manager.subscribeToUserBands(userId, bandIds)

    // Should only create ONE channel per band
    const channelCalls = mockSupabase.channel.mock.calls
    const auditChannels = channelCalls.filter(call => call[0].startsWith('audit-'))
    expect(auditChannels.length).toBe(1)
  })

  it('should handle concurrent subscription calls gracefully', async () => {
    const userId = 'user-1'
    const bandIds = ['band-1', 'band-2']

    // Call concurrently
    await Promise.all([
      manager.subscribeToUserBands(userId, bandIds),
      manager.subscribeToUserBands(userId, bandIds)
    ])

    // Should only create 2 channels (one per band)
    const channelCalls = mockSupabase.channel.mock.calls
    const auditChannels = channelCalls.filter(call => call[0].startsWith('audit-'))
    expect(auditChannels.length).toBe(2)
  })
})
```

---

### Layer 2: Integration Tests (Medium Speed, Multi-Component)

**Purpose:** Test interactions between components (hooks, context, services)

**Critical Integration Test Suites Needed:**

#### 1. Auth Flow Integration Tests

```typescript
describe('Auth Flow Integration', () => {
  it('should restore session and initialize realtime without duplicates', async () => {
    // Setup: Store session in localStorage
    // Mount AuthContext
    // Verify:
    // - RealtimeManager created once
    // - Subscriptions created once per band
    // - No duplicate channels
  })

  it('should handle fresh login without creating duplicate subscriptions', async () => {
    // Setup: No stored session
    // Trigger login
    // Verify:
    // - RealtimeManager created once
    // - Subscriptions created once per band
    // - Auth state change doesn't duplicate subscriptions
  })

  it('should cleanup subscriptions on logout', async () => {
    // Login → Verify subscriptions exist → Logout → Verify cleanup
  })
})
```

#### 2. Real-Time Sync Integration Tests

```typescript
describe('Real-Time Sync Integration', () => {
  it('should sync data from audit_log to IndexedDB and emit events', async () => {
    // Setup: Subscribe to band
    // Simulate audit_log INSERT from Supabase
    // Verify:
    // - IndexedDB updated
    // - Event emitted
    // - Hooks receive update
    // - No duplicate updates
  })

  it('should deduplicate rapid changes from same user', async () => {
    // Simulate 5 rapid changes
    // Verify only 1 toast shown
  })
})
```

#### 3. Data Flow Integration Tests

```typescript
describe('Repository → Hook → Component Data Flow', () => {
  it('should deduplicate members when repository returns duplicates', async () => {
    // Mock repository to return duplicate memberships
    // Call useBandMembers hook
    // Verify hook deduplicates
    // Render component
    // Verify no React key warnings
  })
})
```

---

### Layer 3: Contract Tests (Fast, Interface Verification)

**Purpose:** Ensure repository implementations adhere to interface contracts

**What to Test:**

```typescript
describe('IDataRepository Contract Tests', () => {
  // Test BOTH LocalRepository AND RemoteRepository
  const repositories = [
    { name: 'LocalRepository', repo: new LocalRepository() },
    { name: 'RemoteRepository', repo: new RemoteRepository(supabase) }
  ]

  repositories.forEach(({ name, repo }) => {
    describe(`${name} Contract`, () => {
      it('should not return duplicate band memberships for same user', async () => {
        // Add same membership twice
        // Call getBandMemberships
        // Verify only unique memberships returned
      })

      it('should handle concurrent writes without corruption', async () => {
        // Concurrent addSong calls
        // Verify both songs exist
        // Verify no duplicates
      })
    })
  })
})
```

---

### Layer 4: E2E Tests (Slow, Full System)

**Purpose:** Test critical user flows end-to-end

**Critical E2E Tests Needed:**

```typescript
describe('E2E: Real-Time Collaboration', () => {
  it('should show real-time updates between two users', async () => {
    // Open two browser contexts
    // User 1: Create song
    // User 2: Verify song appears
    // User 2: Verify toast appears
    // Verify no duplicate toasts
    // Verify no console errors
  })

  it('should handle session restoration without errors', async () => {
    // Login
    // Close tab
    // Reopen tab
    // Verify session restored
    // Verify no duplicate subscriptions
    // Verify data loads correctly
  })
})
```

---

## Specification Improvements

### Current Spec Gaps

Looking at `.claude/specifications/unified-database-schema.md`:
- ✅ Defines schema structure
- ✅ Defines field mappings
- ❌ **MISSING: Error handling requirements**
- ❌ **MISSING: Idempotency requirements**
- ❌ **MISSING: Concurrency handling**
- ❌ **MISSING: Testing requirements**
- ❌ **MISSING: Invariants and constraints**

### Proposed Spec Enhancements

#### 1. Add "Behavioral Requirements" Section

```markdown
## Behavioral Requirements

### Idempotency
- All repository methods MUST be idempotent
- Calling the same method twice with same params MUST produce same result
- Examples:
  - `addSong(song)` called twice → song exists once
  - `subscribeToUserBands(userId, bands)` called twice → one subscription per band

### Concurrency
- All repository methods MUST handle concurrent calls safely
- No race conditions allowed in data updates
- Lock-free operations preferred, optimistic locking where needed

### Error Handling
- All async methods MUST handle errors gracefully
- Network failures MUST be logged and retried (configurable)
- Data corruption MUST be detected and reported
- Fallbacks MUST be provided for non-critical operations

### Data Integrity
- No duplicate records allowed for entities with unique constraints
- Foreign key relationships MUST be maintained
- Soft deletes preferred over hard deletes for audit trail
```

#### 2. Add "Testing Requirements" Section

```markdown
## Testing Requirements

### Required Test Coverage for Each Feature

When implementing a new feature, you MUST provide:

1. **Unit Tests** (Required)
   - Happy path
   - Error cases
   - Edge cases (null, undefined, empty arrays)
   - Idempotency (calling same function twice)
   - Concurrent calls (if applicable)

2. **Integration Tests** (Required for critical paths)
   - Auth flow changes
   - Data sync operations
   - Real-time subscription changes
   - Multi-component interactions

3. **Contract Tests** (Required for repository changes)
   - Interface compliance
   - Behavior consistency across implementations

4. **E2E Tests** (Required for user-facing features)
   - Critical user flows
   - Real-time collaboration
   - Session management

### Test Naming Convention

```typescript
describe('[Component/Service Name]', () => {
  describe('[Feature/Method Name]', () => {
    it('should [expected behavior] when [condition]', () => {
      // Test
    })

    it('should NOT [unwanted behavior] when [condition]', () => {
      // Negative test
    })
  })
})
```

### Coverage Requirements

- Critical paths: 90%+ coverage
- Repository layer: 85%+ coverage
- Service layer: 80%+ coverage
- UI components: 70%+ coverage
```

#### 3. Add "Invariants" Section

```markdown
## System Invariants

These properties MUST ALWAYS be true:

### Subscription Invariants
- One RealtimeManager instance per app instance
- One subscription channel per (band, table) pair
- Subscriptions cleaned up on logout
- No orphaned subscriptions

### Data Invariants
- One BandMembership per (userId, bandId) pair
- One active invite code per band
- Audit log entries are append-only
- Version numbers are monotonically increasing

### Auth Invariants
- User authenticated → currentUser exists in IndexedDB
- User has currentBandId → band exists in IndexedDB
- Session token → RealtimeManager has auth set
```

---

## Development Process Improvements

### 1. Test-First Development Checklist

Before writing ANY code, ask:

- [ ] What invariants must hold?
- [ ] What edge cases exist?
- [ ] Can this be called twice? Should it be idempotent?
- [ ] Can this be called concurrently? How to handle?
- [ ] What errors can occur? How to handle each?
- [ ] What integration points exist?
- [ ] Is this a critical path? (auth, sync, payments, etc.)

### 2. PR/Commit Checklist

Before committing code:

- [ ] Unit tests written for new code
- [ ] Edge case tests written (duplicates, concurrent, null/undefined)
- [ ] Integration tests written if touching critical path
- [ ] Contract tests updated if changing interface
- [ ] E2E test updated if changing user flow
- [ ] Specs updated with new requirements
- [ ] All tests passing (`npm test`)
- [ ] Type checking passing (`npm run type-check`)
- [ ] Linting passing (`npm run lint`)

### 3. Critical Path Identification

Mark critical paths in code with comments:

```typescript
/**
 * CRITICAL PATH: Auth Flow
 *
 * Testing requirements:
 * - Unit: Session restoration, logout cleanup
 * - Integration: RealtimeManager lifecycle, duplicate subscriptions
 * - E2E: Login flow, session persistence
 *
 * Invariants:
 * - Only one RealtimeManager instance
 * - Only one subscription per band
 * - Subscriptions cleaned up on logout
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ ... }) => {
```

---

## Implementation Plan

### Phase 1: Stop the Bleeding (Week 1)

**Goal:** Add tests for recent bugs to prevent regression

1. **Add RealtimeManager idempotency tests**
   - Test duplicate subscription prevention
   - Test concurrent subscription calls
   - Test cleanup on duplicate

2. **Add BandMembersPage deduplication tests**
   - Test hook deduplication
   - Test component rendering with duplicates

3. **Add AuthContext integration tests**
   - Test session restoration
   - Test RealtimeManager lifecycle
   - Test subscription cleanup

**Deliverables:**
- 15-20 new tests covering recent bugs
- All tests passing
- Coverage report showing critical path coverage

---

### Phase 2: Fill Critical Gaps (Week 2-3)

**Goal:** Achieve 80%+ coverage on critical paths

1. **Auth Flow Tests**
   - Unit: AuthContext hooks
   - Integration: Session → Realtime → Sync
   - E2E: Login → Use app → Logout → Login again

2. **Real-Time Sync Tests**
   - Unit: Event emission, data updates
   - Integration: Audit log → IndexedDB → UI
   - Contract: Repository interface compliance

3. **Repository Layer Tests**
   - Contract tests for all interface methods
   - Concurrency tests for critical operations
   - Deduplication tests for all get methods

**Deliverables:**
- 50-75 new tests
- 80%+ coverage on auth, sync, repository layers
- Test documentation

---

### Phase 3: Harden Specifications (Week 3-4)

**Goal:** Prevent future bugs through better specs

1. **Update Database Schema Spec**
   - Add behavioral requirements section
   - Add testing requirements section
   - Add invariants section

2. **Create Service Contracts Spec**
   - Define interface contracts
   - Define error handling requirements
   - Define concurrency requirements

3. **Create Testing Guidelines Doc**
   - When to write unit vs integration tests
   - How to write effective tests
   - Test naming conventions
   - Coverage requirements

**Deliverables:**
- Updated specifications
- New testing guidelines document
- Examples for each test type

---

### Phase 4: Automate Quality Gates (Week 4)

**Goal:** Prevent merging code without proper tests

1. **Add Pre-Commit Hooks**
   ```bash
   # .husky/pre-commit
   npm test -- --run --changed
   npm run type-check
   npm run lint
   ```

2. **Add CI/CD Quality Gates**
   ```yaml
   # .github/workflows/quality.yml
   - name: Test
     run: npm test -- --coverage
   - name: Coverage Check
     run: |
       coverage=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
       if (( $(echo "$coverage < 75" | bc -l) )); then
         echo "Coverage too low: $coverage%"
         exit 1
       fi
   ```

3. **Add Coverage Tracking**
   - Track coverage trends over time
   - Prevent decreases in coverage
   - Require 80%+ for critical modules

**Deliverables:**
- Pre-commit hooks configured
- CI/CD pipeline with quality gates
- Coverage tracking dashboard

---

## Metrics to Track

### Code Quality Metrics
- Test coverage % (overall)
- Test coverage % (critical paths)
- Number of failing tests
- Number of flaky tests
- Test execution time

### Bug Metrics
- Bugs found in development
- Bugs found in production
- Regression bugs (same bug twice)
- Time to detect bugs
- Time to fix bugs

### Process Metrics
- % of PRs with tests
- % of specs updated with features
- % of features with integration tests
- Test review time

---

## Quick Wins (Do These First!)

### 1. Add Missing RealtimeManager Tests (1 hour)

```typescript
// tests/unit/services/data/RealtimeManager.test.ts

describe('Idempotency and Deduplication', () => {
  it('should prevent duplicate subscriptions when called twice', async () => {
    const userId = 'user-1'
    const bandIds = ['band-1']

    await manager.subscribeToUserBands(userId, bandIds)
    await manager.subscribeToUserBands(userId, bandIds)

    const channelCalls = mockSupabase.channel.mock.calls
    const auditChannels = channelCalls.filter(call => call[0].startsWith('audit-'))
    expect(auditChannels.length).toBe(1)
  })

  it('should handle concurrent calls without creating duplicates', async () => {
    const userId = 'user-1'
    const bandIds = ['band-1']

    await Promise.all([
      manager.subscribeToUserBands(userId, bandIds),
      manager.subscribeToUserBands(userId, bandIds)
    ])

    const channelCalls = mockSupabase.channel.mock.calls
    const auditChannels = channelCalls.filter(call => call[0].startsWith('audit-'))
    expect(auditChannels.length).toBe(1)
  })
})
```

### 2. Add Pre-Commit Type Checking (15 minutes)

```bash
# Install husky
npm install -D husky

# Setup husky
npx husky init

# Add pre-commit hook
echo "npm run type-check" > .husky/pre-commit
```

### 3. Create Critical Path Inventory (30 minutes)

List all critical paths in `.claude/specifications/critical-paths.md`:

```markdown
# Critical Paths Inventory

## Auth Flows
1. Login → Session creation → RealtimeManager init → Data sync
2. Session restoration → Auth check → RealtimeManager restore
3. Logout → Cleanup subscriptions → Clear data

## Real-Time Sync Flows
1. Remote change → Audit log → IndexedDB update → Event emission → UI update
2. Local change → IndexedDB update → Supabase sync → Audit log
3. Conflict detection → Resolution → Update

## Data Flows
1. Repository → Hook → Component → Render
2. User action → Optimistic update → Sync → Confirmation
3. Network failure → Retry → Fallback

## Invariants
- One RealtimeManager per app
- One subscription per (band, table)
- No duplicate data in IndexedDB
- Auth token set before subscriptions
```

---

## Cost-Benefit Analysis

### Investment
- **Time:** 4 weeks initial investment
- **Effort:** ~80-120 hours total
- **Cost:** Slower initial feature development

### Payoff
- **Bug Prevention:** 70-90% reduction in production bugs
- **Development Speed:** 30-50% faster after initial investment
- **Confidence:** Can refactor without fear
- **Onboarding:** New developers have clear guidelines
- **Maintenance:** Less time debugging, more time building

### Break-Even Point
- Estimated: 6-8 weeks
- After break-even: Net productivity gain

---

## Recommendations

### Immediate Actions (This Week)

1. ✅ **Add RealtimeManager idempotency tests** (1 hour)
2. ✅ **Add BandMembersPage deduplication tests** (1 hour)
3. ✅ **Setup pre-commit type checking** (15 min)
4. ✅ **Create critical paths inventory** (30 min)

**Total Time:** ~3 hours
**Impact:** Prevent immediate regressions

### Short-Term Actions (Next 2 Weeks)

1. ✅ **Add auth flow integration tests** (4 hours)
2. ✅ **Add repository contract tests** (4 hours)
3. ✅ **Update specifications with invariants** (2 hours)
4. ✅ **Add testing requirements to specs** (2 hours)

**Total Time:** ~12 hours
**Impact:** Cover 80% of critical paths

### Long-Term Actions (Next Month)

1. ✅ **Achieve 80% coverage on critical modules** (20 hours)
2. ✅ **Setup CI/CD quality gates** (4 hours)
3. ✅ **Create testing guidelines doc** (4 hours)
4. ✅ **Add E2E tests for critical flows** (8 hours)

**Total Time:** ~36 hours
**Impact:** Prevent 90% of future bugs

---

## Success Criteria

### After Phase 1 (Week 1)
- [ ] No regressions of recent bugs
- [ ] 15+ new tests added
- [ ] Pre-commit hooks prevent bad commits

### After Phase 2 (Week 3)
- [ ] 80%+ coverage on auth, sync, repository
- [ ] Integration tests cover critical flows
- [ ] Contract tests validate interfaces

### After Phase 3 (Week 4)
- [ ] Specs include behavioral requirements
- [ ] Specs include testing requirements
- [ ] Testing guidelines document exists

### After Phase 4 (Week 4+)
- [ ] CI/CD prevents low-quality merges
- [ ] Coverage tracked and maintained
- [ ] Quality metrics dashboard live

---

## Example Test Template

Use this template for ALL new features:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('[Component/Service Name]', () => {
  beforeEach(() => {
    // Setup
  })

  afterEach(() => {
    // Cleanup
  })

  describe('[Feature/Method Name]', () => {
    describe('Happy Path', () => {
      it('should [do something] when [condition]', () => {
        // Arrange
        // Act
        // Assert
      })
    })

    describe('Edge Cases', () => {
      it('should handle null/undefined input gracefully', () => {
        // Test
      })

      it('should handle empty arrays gracefully', () => {
        // Test
      })

      it('should be idempotent when called multiple times', () => {
        // Test
      })

      it('should handle concurrent calls without corruption', () => {
        // Test
      })
    })

    describe('Error Cases', () => {
      it('should throw [ErrorType] when [error condition]', () => {
        // Test
      })

      it('should handle network failures gracefully', () => {
        // Test
      })
    })

    describe('Invariants', () => {
      it('should maintain [invariant] after [operation]', () => {
        // Test
      })
    })
  })
})
```

---

## Conclusion

The recent bugs (duplicate subscriptions, React key warnings) happened because:

1. **Missing Tests:** No tests for idempotency or concurrent calls
2. **Incomplete Specs:** No requirements for deduplication or error handling
3. **No Quality Gates:** Code merged without proper test coverage

**The Solution:**

- Add comprehensive test coverage (unit, integration, contract, E2E)
- Update specs with behavioral requirements and testing requirements
- Implement quality gates (pre-commit hooks, CI/CD checks)
- Create testing guidelines for future development

**Start with Quick Wins:**
- Add idempotency tests (1 hour)
- Setup pre-commit hooks (15 min)
- Create critical paths inventory (30 min)

**Then build from there over the next month.**

This investment will pay for itself in 6-8 weeks through reduced debugging time and increased confidence in refactoring.
