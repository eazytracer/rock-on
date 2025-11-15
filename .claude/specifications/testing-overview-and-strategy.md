---
created: 2025-11-10T17:23
type: specification
status: active
priority: critical
version: 1.0
---

# Rock-On Testing Overview and Strategy

## Executive Summary

This document provides a comprehensive overview of the testing strategy for the Rock-On band management application. It defines the testing pyramid, coverage goals, tools, and best practices to ensure application quality, catch bugs before production, and maintain confidence during rapid development.

**Key Testing Objectives:**
1. Prevent production incidents through comprehensive test coverage
2. Catch integration bugs that unit tests miss
3. Validate security (RLS policies) through real user workflows
4. Enable confident refactoring and feature development
5. Provide fast feedback during development

---

## Testing Pyramid

Rock-On follows a balanced testing pyramid approach:

```
                    /\
                   /  \
                  / E2E \          25 critical user flows (Playwright)
                 /______\
                /        \
               / Integration\      Journey tests, API contracts
              /____________\
             /              \
            /  Unit Tests    \     Isolated component/function tests
           /__________________\

       Foundation: Database Tests   336 pgTAP tests (schema, RLS, triggers)
```

### Test Distribution (Target)

| Layer | Count | Tool | Purpose | Speed |
|-------|-------|------|---------|-------|
| **Database** | 336 | pgTAP | Schema validation, RLS policies | Fast (~30s) |
| **Unit** | 73+ | Vitest | Component logic, services | Very Fast (<10s) |
| **Integration** | 20+ | Vitest | Multi-component interactions | Medium (~2m) |
| **E2E** | 25+ | Playwright | Full user workflows | Slow (~10m) |

**Total Coverage Goal:** 450+ automated tests

---

## Test Layer Details

### 1. Database Tests (Foundation Layer)

**Tool:** pgTAP (PostgreSQL testing framework)
**Location:** `supabase/tests/*.test.sql`
**Current Status:** 336 passing tests

#### Coverage Areas

| Test Suite | File | Tests | Purpose |
|------------|------|-------|---------|
| Table Structure | `001-schema-tables.test.sql` | 17 | Validate all tables exist |
| Column Validation | `002-schema-columns.test.sql` | 81 | Verify column types, nullability |
| Indexes | `003-schema-indexes.test.sql` | 29 | Check performance indexes |
| Constraints | `004-schema-constraints.test.sql` | 42 | Foreign keys, check constraints |
| Functions/Triggers | `005-functions-triggers.test.sql` | 29 | Version tracking, audit logging |
| RLS Policies | `006-rls-policies.test.sql` | 71 | Security policy existence |
| RLS Behavior | `007-011` | 67 | Policy enforcement, band isolation |

#### Running Database Tests

```bash
# Run database tests only
npm run test:db

# Direct command
supabase test db

# Reset and test
supabase db reset && npm run test:db
```

#### Key Validations

**Schema Integrity:**
- ✅ All 17 tables exist with correct structure
- ✅ 81 columns with correct types and constraints
- ✅ 29 indexes for query performance
- ✅ 42 foreign key and check constraints

**Security (RLS):**
- ✅ 71 RLS policies exist for all tables
- ✅ Band isolation (users only see their band's data)
- ✅ Role-based permissions (owner > admin > member)
- ✅ Personal songs support (user-scoped content)

**Audit & Versioning:**
- ✅ Version tracking on all versioned tables
- ✅ Audit log records all changes
- ✅ Triggers fire on INSERT/UPDATE/DELETE

**Realtime:**
- ✅ 5 tables enabled for realtime (songs, bands, setlists, band_memberships, practice_sessions)

---

### 2. Unit Tests

**Tool:** Vitest
**Location:** `tests/unit/**/*.test.ts`
**Current Status:** 73 passing (sync infrastructure), 13 failing (hooks/utils - non-blocking)

#### Coverage Areas

**Services (Business Logic):**
- `SyncEngine.test.ts` - Bidirectional sync logic
- `SyncRepository.test.ts` - Data repository pattern
- `LocalRepository.test.ts` - IndexedDB operations
- `RemoteRepository.test.ts` - Supabase operations
- `RealtimeManager.test.ts` - Real-time subscriptions
- `BandService.test.ts` - Band CRUD
- `SongService.test.ts` - Song CRUD
- `SetlistService.test.ts` - Setlist CRUD
- `PracticeSessionService.test.ts` - Practice CRUD

**Configuration:**
- `appMode.test.ts` - Mode detection (local/remote)

**Hooks (React):**
- `useBands.test.ts` - Band selection hook
- `useSyncStatus.test.ts` - Sync status hook

#### Running Unit Tests

```bash
# Run all unit tests
npm test

# Run specific test file
npm test -- tests/unit/services/data/SyncEngine.test.ts

# Run tests in directory
npm test -- tests/unit/services/

# Watch mode (for development)
npm test -- --watch

# Coverage report
npm test -- --coverage
```

#### Unit Test Philosophy

**What to Test:**
- ✅ Business logic in isolation
- ✅ Edge cases and error handling
- ✅ Data transformations
- ✅ Service methods

**What NOT to Test:**
- ❌ React component rendering (use E2E instead)
- ❌ CSS styles
- ❌ Third-party library internals
- ❌ Simple getters/setters with no logic

**Best Practices:**
```typescript
// ✅ Good - isolated, fast, clear intent
test('SyncEngine syncs pending changes on connect', async () => {
  const mockRepository = createMockRepository()
  const engine = new SyncEngine(mockRepository)

  await engine.connect()

  expect(mockRepository.syncPendingChanges).toHaveBeenCalled()
})

// ❌ Bad - tests implementation details, fragile
test('button has correct className', () => {
  const button = render(<Button />)
  expect(button.className).toBe('btn-primary')
})
```

---

### 3. Integration Tests (Journey Tests)

**Tool:** Vitest
**Location:** `tests/journeys/*.test.ts`, `tests/integration/*.test.ts`
**Current Status:** Limited coverage, needs expansion

#### Coverage Areas

**Current Integration Tests:**
- `sync-journeys.test.ts` - End-to-end sync workflows
- `realtime-sync-journeys.test.ts` - Multi-user sync scenarios
- `error-recovery-journeys.test.ts` - Offline/error handling
- `auth-journeys.test.ts` - Authentication flows

**Planned Integration Tests:**
- Band creation → Member addition → Content sharing
- Song creation → Setlist creation → Show assignment
- Multi-user collaboration scenarios
- Offline-online sync workflows

#### Running Integration Tests

```bash
# Run all integration tests
npm test -- tests/journeys/

# Run specific journey
npm test -- tests/journeys/sync-journeys.test.ts
```

#### Integration Test Philosophy

**Purpose:**
Test multiple components working together without full UI

**Example:**
```typescript
test('User creates band and invites member', async () => {
  // Setup
  const user1 = await createTestUser()
  const user2 = await createTestUser()

  // User 1 creates band
  const band = await bandService.createBand('Test Band', user1.id)
  const inviteCode = band.inviteCode

  // User 2 joins band
  await bandService.joinBand(inviteCode, user2.id)

  // Assertions
  const members = await bandMembershipService.getMembers(band.id)
  expect(members).toHaveLength(2)
  expect(members[0].role).toBe('owner')
  expect(members[1].role).toBe('member')
})
```

---

### 4. End-to-End Tests (User Workflows)

**Tool:** Playwright
**Location:** `tests/e2e/**/*.spec.ts` (to be created)
**Current Status:** NOT IMPLEMENTED (critical gap)

#### Coverage Areas (25 Critical Flows)

**Priority 1: Authentication & Band Creation**
1. Flow 1: Sign up → Create first band (CRITICAL - caught production bug)
2. Flow 2: Sign up → Join existing band via invite code
3. Flow 3: Login → Band selection

**Priority 2: Band Management**
4. Flow 4-6: Admin manages members (invite, edit, remove)

**Priority 3: Songs**
7. Flow 7-9: Song CRUD operations
10. Flow 10: Search and filtering

**Priority 4: Setlists**
11. Flow 11-12: Setlist CRUD operations
12. Flow 13: Link setlist to show

**Priority 5: Shows & Practices**
14. Flow 14: Schedule practice session
15. Flow 15-16: Schedule show, assign setlist

**Priority 6: Multi-User**
17. Flow 17: Real-time collaboration
18. Flow 18: Offline-online sync
19. Flow 19: Conflict resolution

**Priority 7: Security**
20. Flow 20: Band isolation (RLS validation)
21. Flow 21-22: Role-based permissions

**Priority 8: Error Handling**
23. Flow 23: Network error recovery
24. Flow 24: Session expiration
25. Flow 25: Validation errors

#### Running E2E Tests (After Implementation)

```bash
# Run all E2E tests
npx playwright test

# Run specific test file
npx playwright test tests/e2e/auth/signup.spec.ts

# Run in UI mode (debugging)
npx playwright test --ui

# Run with trace
npx playwright test --trace on

# Run against different environments
PLAYWRIGHT_BASE_URL=http://localhost:5173 npx playwright test
```

#### E2E Test Philosophy

**What to Test:**
- ✅ Complete user workflows from start to finish
- ✅ Real browser interactions (click, type, drag)
- ✅ Real authentication flow
- ✅ Real Supabase backend (local or staging)
- ✅ Visual elements and user feedback
- ✅ Error messages and edge cases

**What NOT to Mock:**
- ❌ Supabase backend (test against real instance)
- ❌ IndexedDB storage
- ❌ React components
- ❌ Authentication

**When to Mock:**
- ✅ External APIs (Spotify, YouTube)
- ✅ Third-party services (email, SMS)

**Best Practices:**
```typescript
// ✅ Good - tests real user workflow
test('new user can sign up and create first band', async ({ page }) => {
  await page.goto('/auth')
  await page.fill('[name="email"]', 'user@test.com')
  await page.fill('[name="password"]', 'Test123!')
  await page.click('button:has-text("Sign Up")')

  await page.waitForURL('/get-started')

  await page.fill('[name="bandName"]', 'My Band')
  await page.click('button:has-text("Create Band")')

  await page.waitForURL('/songs')
  await expect(page.locator('[data-testid="band-name"]')).toHaveText('My Band')
})

// ❌ Bad - tests implementation details
test('signup button calls handleSignup function', async ({ page }) => {
  // Don't test internal functions, test user-visible behavior
})
```

---

## Test Execution Strategy

### Local Development Workflow

```bash
# 1. Start local Supabase (if not running)
npm run supabase:start

# 2. Run quick feedback loop (unit tests)
npm test -- --watch

# 3. Before committing: Run all tests
npm run test:all      # Unit + database tests
npx playwright test   # E2E tests (after implementation)
```

### Pre-Commit Checklist

- [ ] All unit tests pass (`npm test`)
- [ ] All database tests pass (`npm run test:db`)
- [ ] All E2E tests pass (`npx playwright test`) (after implementation)
- [ ] No console errors in E2E tests
- [ ] TypeScript type-check passes (`npm run type-check`)
- [ ] Linter passes (`npm run lint`)

### CI/CD Pipeline (Future)

```yaml
# .github/workflows/test.yml (example)
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3

      # Start Supabase
      - name: Start Supabase
        run: |
          npx supabase start
          npx supabase db reset

      # Run tests in parallel
      - name: Unit Tests
        run: npm test

      - name: Database Tests
        run: npm run test:db

      - name: E2E Tests
        run: npx playwright test

      # Upload reports
      - name: Upload Playwright Report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

---

## Coverage Goals

### Current Status

| Layer | Current | Target | Status |
|-------|---------|--------|--------|
| Database | 336 tests | 350 tests | ✅ 96% |
| Unit | 73 tests | 100 tests | 🟡 73% |
| Integration | ~10 tests | 30 tests | 🟡 33% |
| E2E | 0 tests | 25 tests | ❌ 0% |

### Coverage Targets

**By Feature:**
- ✅ Authentication: 100% (E2E critical)
- ✅ Band Creation: 100% (E2E critical - production bug)
- ✅ Song Management: 90%+ (unit + E2E)
- ✅ Setlist Management: 90%+ (unit + E2E)
- ✅ Show/Practice Scheduling: 80%+
- ✅ Real-time Sync: 90%+ (integration + E2E)
- ✅ Offline Sync: 90%+ (integration + E2E)
- ✅ RLS Security: 100% (database + E2E)

**By User Role:**
- ✅ Owner: 100% (all permissions tested)
- ✅ Admin: 100% (admin-specific actions)
- ✅ Member: 100% (member-level access)

**By Platform:**
- ✅ Desktop (Chrome): 100%
- ✅ Desktop (Firefox): 100%
- ✅ Desktop (Safari/WebKit): 100%
- ✅ Mobile (iOS): 80%+
- ✅ Mobile (Android): 80%+

---

## Quality Gates

### Definition of Done for Features

A feature is NOT complete until:

1. **Unit Tests Written:**
   - [ ] Core business logic has unit tests
   - [ ] Edge cases covered
   - [ ] Error handling tested

2. **Integration Tests Written (if applicable):**
   - [ ] Multi-component workflows tested
   - [ ] Service interactions validated

3. **E2E Tests Written:**
   - [ ] Critical user workflow has E2E test
   - [ ] Test passes against local Supabase
   - [ ] Test passes against staging Supabase

4. **All Tests Pass:**
   - [ ] `npm test` (unit tests)
   - [ ] `npm run test:db` (database tests)
   - [ ] `npx playwright test` (E2E tests)

5. **No Regressions:**
   - [ ] No new console errors
   - [ ] No breaking changes to existing tests
   - [ ] No performance degradation

### Merge Blockers (CI/CD)

Pull requests CANNOT be merged if:

- ❌ Any unit test fails
- ❌ Any database test fails
- ❌ Any E2E test fails
- ❌ TypeScript type-check fails
- ❌ Linter errors exist
- ❌ Coverage drops below threshold (future)

---

## Testing Tools & Libraries

### Current Stack

| Tool | Purpose | Docs |
|------|---------|------|
| **Vitest** | Unit & integration testing | [vitest.dev](https://vitest.dev) |
| **pgTAP** | Database testing | [pgtap.org](https://pgtap.org) |
| **Playwright** | E2E testing (to be added) | [playwright.dev](https://playwright.dev) |
| **@testing-library/react** | React component testing | [testing-library.com](https://testing-library.com/react) |
| **fake-indexeddb** | IndexedDB mocking | [npm](https://www.npmjs.com/package/fake-indexeddb) |
| **jsdom** | DOM environment for tests | [github.com/jsdom/jsdom](https://github.com/jsdom/jsdom) |

### Why These Tools?

**Vitest:**
- ✅ Vite-native (same config as build)
- ✅ Fast (ESM-first, parallel execution)
- ✅ Compatible with Jest API
- ✅ Great TypeScript support

**pgTAP:**
- ✅ Industry standard for PostgreSQL testing
- ✅ TAP output (Test Anything Protocol)
- ✅ Comprehensive assertion library
- ✅ Runs directly in database

**Playwright:**
- ✅ Multi-browser support (Chromium, Firefox, WebKit)
- ✅ Auto-waiting (no manual sleeps)
- ✅ Parallel execution
- ✅ Trace viewer for debugging
- ✅ TypeScript-first
- ✅ Better Safari support than Cypress

---

## Test Data Management

### Test Users

All test users follow convention:
```
test.user.{timestamp}@rockontesting.com
```

Example:
```typescript
const user = {
  email: `test.user.${Date.now()}@rockontesting.com`,
  password: 'TestPassword123!',
  name: `Test User ${Date.now()}`
}
```

### Test Bands

All test bands follow convention:
```
Test Band {timestamp}
```

### Database Isolation

**Local Testing:**
- `supabase db reset` before each test suite
- Fresh migrations applied
- Seed data loaded

**Remote Testing (Staging):**
- Use dedicated staging Supabase project
- Clean up test data after tests
- Never test against production

---

## Debugging Tests

### Unit Tests (Vitest)

```bash
# Debug specific test
npm test -- tests/unit/services/SyncEngine.test.ts --reporter=verbose

# Run single test
npm test -- -t "SyncEngine syncs pending changes"

# Debug in VS Code
# Add breakpoint, press F5 with "Vitest" launch config
```

### Database Tests (pgTAP)

```bash
# Run tests with verbose output
supabase test db --verbose

# Run specific test file
psql postgres://postgres:postgres@127.0.0.1:54322/postgres \
  -f supabase/tests/001-schema-tables.test.sql

# Check Supabase logs
supabase logs
```

### E2E Tests (Playwright) (After Implementation)

```bash
# Debug mode (step through test)
npx playwright test --debug

# UI mode (visual test runner)
npx playwright test --ui

# Generate trace
npx playwright test --trace on
npx playwright show-trace trace.zip

# Show report (after test run)
npx playwright show-report

# View screenshots/videos
open playwright-report/
```

---

## Common Testing Patterns

### Pattern 1: Test User Creation

```typescript
// tests/helpers/testFixtures.ts
export async function createTestUser(overrides?: Partial<TestUser>) {
  const timestamp = Date.now()
  return {
    email: `test.user.${timestamp}@rockontesting.com`,
    password: 'TestPassword123!',
    name: `Test User ${timestamp}`,
    ...overrides
  }
}
```

### Pattern 2: Database Reset

```typescript
// tests/helpers/testDatabase.ts
export async function resetDatabase() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cannot reset production database!')
  }

  await execAsync('supabase db reset --local')
}
```

### Pattern 3: Async Test Helpers

```typescript
// tests/helpers/assertions.ts
export async function waitForSync(timeout = 5000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await syncEngine.isSynced()) return
    await sleep(100)
  }
  throw new Error('Sync timeout')
}
```

### Pattern 4: E2E Fixtures

```typescript
// tests/e2e/fixtures/auth.ts
export async function signUpViaUI(page: Page, user: TestUser) {
  await page.goto('/auth')
  await page.fill('[name="email"]', user.email)
  await page.fill('[name="password"]', user.password)
  await page.click('button:has-text("Sign Up")')
  await page.waitForURL('/get-started')
}
```

---

## Testing Anti-Patterns (Avoid These)

### ❌ Don't: Test Implementation Details

```typescript
// ❌ Bad
test('button has className "btn-primary"', () => {
  const button = screen.getByRole('button')
  expect(button.className).toContain('btn-primary')
})

// ✅ Good
test('user can create band by clicking button', async () => {
  const button = screen.getByRole('button', { name: 'Create Band' })
  await user.click(button)
  expect(screen.getByText('Band created successfully')).toBeInTheDocument()
})
```

### ❌ Don't: Use Arbitrary Timeouts

```typescript
// ❌ Bad
await page.waitForTimeout(2000)  // Why 2000? Race condition waiting to happen

// ✅ Good
await page.waitForSelector('[data-testid="song-list"]')
await page.waitForURL('/songs')
```

### ❌ Don't: Mock Everything

```typescript
// ❌ Bad - defeats purpose of integration tests
vi.mock('@supabase/supabase-js')
vi.mock('dexie')
vi.mock('./SyncEngine')

// ✅ Good - test real integrations
// Only mock external services (APIs you don't control)
vi.mock('node-fetch')  // Mock Spotify API, etc.
```

### ❌ Don't: Write Brittle Selectors

```typescript
// ❌ Bad - breaks if structure changes
await page.click('div > div > button:nth-child(2)')

// ✅ Good - semantic, stable
await page.click('[data-testid="create-band-button"]')
await page.click('button:has-text("Create Band")')
await page.getByRole('button', { name: 'Create Band' }).click()
```

---

## Test Maintenance

### When Tests Fail

1. **Don't Skip or Disable Immediately**
   - Understand WHY the test failed
   - Is it a real bug? (Good!)
   - Is the test wrong? (Update test)
   - Is the test flaky? (Fix race condition)

2. **Fix the Root Cause**
   - If source code bug: Fix the code
   - If test is outdated: Update the test
   - If test is flaky: Add proper waits/assertions

3. **Document Known Issues**
   - Add `test.skip()` with detailed comment
   - Create GitHub issue linked to test
   - Set deadline for fix

### Keeping Tests Fast

**Unit Tests:** < 10 seconds total
- Use mocks for slow operations
- Avoid real network calls
- Use in-memory databases

**Integration Tests:** < 2 minutes total
- Use real local services
- Parallelize where possible
- Clean up efficiently

**E2E Tests:** < 10 minutes total
- Run in parallel (4+ workers)
- Use fixtures for setup
- Only test critical paths

### Refactoring Tests

When refactoring:
1. **Extract common setup to fixtures**
2. **Share test helpers across files**
3. **Use descriptive test names**
4. **Group related tests with `describe()`**
5. **Keep tests focused (one assertion per concept)**

---

## Resources

### Documentation

- **Vitest Docs:** https://vitest.dev
- **Playwright Docs:** https://playwright.dev
- **pgTAP Docs:** https://pgtap.org
- **Testing Library Docs:** https://testing-library.com

### Internal Docs

- **E2E Implementation Plan:** `.claude/artifacts/2025-11-10T17:17_e2e-testing-implementation-plan.md`
- **MVP Spec:** `.claude/specifications/2025-10-22T22:59_functional-mvp-spec.md`
- **Database Schema:** `.claude/specifications/unified-database-schema.md`
- **Sync Spec:** `.claude/specifications/2025-10-30T13:25_bidirectional-sync-specification.md`

### Test Files

- **Unit Tests:** `tests/unit/**/*.test.ts`
- **Integration Tests:** `tests/journeys/**/*.test.ts`
- **Database Tests:** `supabase/tests/*.test.sql`
- **E2E Tests:** `tests/e2e/**/*.spec.ts` (to be created)

---

## Next Steps

### Immediate (This Week)

1. **Review this strategy document** with team
2. **Install Playwright** (`npm install -D @playwright/test`)
3. **Begin Phase 1 implementation** (see implementation plan)
4. **Write first critical E2E test** (Flow 1: Sign up → Create band)
5. **Validate against production Supabase** (catch RLS issues)

### Short-term (Next 2 Weeks)

1. **Complete Phase 2** (5 critical user flows)
2. **Set up CI/CD pipeline** (GitHub Actions)
3. **Add test coverage reporting**
4. **Document testing best practices for team**

### Long-term (Next Month)

1. **Complete all 25 E2E flows**
2. **Add visual regression testing**
3. **Add performance testing** (Lighthouse)
4. **Achieve 90%+ overall coverage**
5. **Zero production incidents from untested code**

---

## Success Metrics

### Coverage

- ✅ 25 critical user workflows covered
- ✅ 100% of MVP features tested end-to-end
- ✅ 100% of RLS policies validated
- ✅ 90%+ unit test coverage for business logic

### Quality

- ✅ Zero production incidents from untested code
- ✅ < 2% test flakiness rate
- ✅ < 10 minutes full test suite execution
- ✅ All tests pass before every merge

### Team Impact

- ✅ Confident refactoring without fear
- ✅ Fast feedback during development
- ✅ Reduced debugging time
- ✅ Fewer production hotfixes

---

**Status:** Active
**Version:** 1.0
**Last Updated:** 2025-11-10
**Owner:** Development Team
**Next Review:** After Phase 1 completion
