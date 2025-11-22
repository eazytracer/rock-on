---
created: 2025-11-20T23:00
prompt: "Comprehensive analysis of current test structure, requirements, and execution strategy before implementing automation"
---

# Rock-On Test Structure Analysis

## Executive Summary

After reviewing the codebase, I've discovered:

✅ **Good News:**
- Well-structured test organization (39 test files, 5 categories)
- Test helpers and fixtures already exist
- Environment setup scripts already created (`npm run start:test`)
- `.env.test` file already exists with Supabase credentials

❌ **Problems:**
- Tests have **conflicting requirements** (some need Supabase, some use mocks)
- `.env.test` has `VITE_MOCK_AUTH=true` which **disables Supabase**
- Vitest config **doesn't load** `.env.test`
- No clear documentation on **which tests need what**
- Existing test setup code **calls `getSupabaseClient()`** which throws when env vars missing

**Root Cause:** Tests were designed to work with Supabase but environment isn't configured for unit test execution.

---

## Current Test Structure

### Test Categories (39 files total)

**1. Unit Tests** (`tests/unit/`) - 23 files
- **Purpose:** Test individual functions/components in isolation
- **Dependencies:** Mocks, fake-indexeddb
- **Supabase:** Should use mocks (doesn't need real Supabase)
- **Examples:**
  - `services/BandService.test.ts` - Mocked repository
  - `services/SongService.test.ts` - Mocked repository
  - `hooks/useSyncStatus.test.ts` - Unit hooks
  - `components/SyncStatusIndicator.test.tsx` - UI components

**2. Integration Tests** (`tests/integration/`) - 1 file
- **Purpose:** Test multiple components working together
- **Dependencies:** May need real database interactions
- **Supabase:** Needs real Supabase
- **Examples:**
  - `template.test.ts` - Template for integration tests

**3. Journey Tests** (`tests/journeys/`) - 4 files ⚠️ **CURRENTLY FAILING**
- **Purpose:** Test complete user workflows (offline sync, real-time, auth)
- **Dependencies:** **REQUIRES real Supabase** (calls `getSupabaseClient()`)
- **Examples:**
  - `sync-journeys.test.ts` - Offline/online sync scenarios
  - `realtime-sync-journeys.test.ts` - Multi-device sync
  - `auth-journeys.test.ts` - Session timeout, multi-tab
  - `error-recovery-journeys.test.ts` - Network failures, corruption

**4. Contract Tests** (`tests/contract/`) - 3 files
- **Purpose:** Verify API contracts match expectations
- **Dependencies:** **Needs real Supabase**
- **Examples:**
  - `songs-api.test.ts` - Songs API contract
  - `setlists-api.test.ts` - Setlists API contract
  - `practice-sessions-api.test.ts` - Practice sessions API

**5. E2E Tests** (`tests/e2e/`) - 11 files
- **Purpose:** Test complete user flows in real browser
- **Dependencies:** **Needs real Supabase + running dev server**
- **Runner:** Playwright (separate from Vitest)
- **Examples:**
  - `auth/login-smoke.spec.ts` - Login flow
  - `bands/create-band.spec.ts` - Band creation
  - `songs/crud.spec.ts` - Song management

**6. Performance Tests** (`tests/performance/`) - 1 file
- **Purpose:** Measure load times and performance
- **Dependencies:** Real app environment

---

## Test Execution Analysis

### Current Commands

```json
{
  "test": "vitest",                    // ❌ No env vars loaded
  "test:e2e": "playwright test",       // ✅ Starts dev server (loads .env.local)
  "test:db": "supabase test db",       // ✅ Direct database tests (pgTAP)
  "test:all": "npm run test && npm run test:db",  // ❌ Missing E2E
  "start:test": "./scripts/start-test.sh"  // ✅ Correct workflow!
}
```

### What `start:test` Does (CORRECT WAY)

```bash
#!/bin/bash
# 1. Check if Supabase running
if ! supabase status &> /dev/null; then
    supabase start  # Start Supabase
fi

# 2. Copy .env.test → .env.local
./scripts/env-setup.sh test

# 3. Run tests
npm run test:all
```

**This is the right approach!** But it's not documented.

---

## Environment Configuration Analysis

### Current .env Files

| File | Purpose | Supabase | Mock Auth |
|------|---------|----------|-----------|
| `.env.local` | Active environment | ✅ Real | ❌ No |
| `.env.development` | Dev mode | ✅ Local | ❌ No |
| `.env.test` | Testing | ✅ Local | ⚠️ **YES!** |
| `.env.production` | Production | ✅ Remote | ❌ No |

### Problem: `.env.test` Conflict

```bash
# .env.test (line 3)
VITE_MOCK_AUTH=true  # ⚠️ This bypasses Supabase!
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=eyJhbGc...  # Credentials present but ignored?
```

**Question:** Why have Supabase credentials if `VITE_MOCK_AUTH=true`?

**Answer:** Likely historical - tests were written to use real Supabase but `.env.test` was configured for mock auth.

---

## Test Requirements Matrix

| Test Type | Needs Supabase | Needs Mock Auth | Runs In | Config File |
|-----------|----------------|-----------------|---------|-------------|
| **Unit** | ❌ No (mocks) | ✅ Yes | Vitest | .env.test? |
| **Integration** | ✅ Yes | ❌ No | Vitest | .env.test |
| **Journey** | ✅ **YES** | ❌ No | Vitest | .env.test |
| **Contract** | ✅ Yes | ❌ No | Vitest | .env.test |
| **E2E** | ✅ Yes | ❌ No | Playwright | .env.local |
| **Performance** | ✅ Yes | ❌ No | Vitest | .env.test |

### Critical Finding

**Journey tests REQUIRE real Supabase** because:

1. They import `getSupabaseClient()` from `tests/journeys/helpers/testSetup.ts`
2. `TestDevice.createSong()` calls `getSupabaseClient()` directly (line 62)
3. `getSupabaseClient()` checks for `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
4. If missing, throws: "Supabase client should only be used when Supabase auth is enabled"

**These are NOT unit tests** - they're integration/journey tests that need real Supabase.

---

## Test Setup Files Analysis

### 1. Global Setup (`src/test/setup.ts`)

**Used by:** All Vitest tests (configured in vite.config.ts line 29)

**What it does:**
```typescript
beforeAll(async () => {
  // 1. Verify Supabase schema (if available)
  if (process.env.VITE_SUPABASE_URL && await isSupabaseAvailable()) {
    await verifySupabaseSchema()  // ⚠️ Requires env vars!
  }

  // 2. Initialize IndexedDB
  await db.open()
  await resetTestDatabase()
})
```

**Key Point:** It tries to verify Supabase schema if env vars present, but **doesn't fail** if missing.

### 2. Journey Test Setup (`tests/journeys/helpers/testSetup.ts`)

**Used by:** Journey tests only

**What it does:**
- `TestDevice` class simulates user devices
- `createSong()` **directly calls** `getSupabaseClient()`
- **No fallback** - requires Supabase

**This is why journey tests fail:** They're hardcoded to use real Supabase.

### 3. Supabase Test Helpers (`tests/helpers/testSupabase.ts`)

**Provides:**
- `getTestSupabaseClient()` - Creates client with service key
- `resetSupabaseTestData()` - Clears test data
- `verifySupabaseSchema()` - Validates schema
- `isSupabaseAvailable()` - Checks if Supabase running

**Environment Check:**
```typescript
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321'
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseKey) {
  throw new Error('SUPABASE_SERVICE_KEY or VITE_SUPABASE_ANON_KEY must be set')
}
```

**Defaults to local Supabase** but still needs env var.

---

## Root Cause Analysis

### Why Journey Tests Fail

**1. Vitest doesn't load `.env.test`**

Current `vite.config.ts`:
```typescript
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: './src/test/setup.ts',
  // ❌ NO env file loading!
}
```

**2. `.env.test` has conflicting settings**

```bash
VITE_MOCK_AUTH=true  # Tells app to skip Supabase
VITE_SUPABASE_URL=http://127.0.0.1:54321  # But provides URL?
```

**3. Tests call `getSupabaseClient()` which throws**

From `src/services/supabase/client.ts`:
```typescript
export function getSupabaseClient() {
  if (!url || !key) {
    throw new Error('Supabase client should only be used when Supabase auth is enabled')
  }
}
```

**Sequence:**
1. `npm test` runs Vitest
2. Vitest doesn't load `.env.test`
3. Journey test calls `TestDevice.createSong()`
4. `createSong()` calls `getSupabaseClient()`
5. No env vars → throws error
6. Test fails ❌

---

## Solution Strategy

### Option A: Fix Environment Loading (RECOMMENDED)

**Make Vitest load `.env.test`:**

```typescript
// vite.config.ts
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv('test', process.cwd(), '')

  return {
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      env,  // ✅ Load .env.test
    }
  }
})
```

**Fix `.env.test`:**

```bash
# .env.test
# Remove or set to false:
VITE_MOCK_AUTH=false  # ✅ Use real Supabase for journey tests

VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<local-anon-key>
```

**Document the workflow:**

```bash
# Run tests with Supabase
npm run start:test  # Uses existing script

# Or manually:
supabase start
npm run env:test  # Copies .env.test → .env.local
npm test
```

### Option B: Split Test Environments

**Create separate env files:**

```bash
.env.test.unit      # Mock auth for unit tests
.env.test.integration  # Real Supabase for journey/contract tests
```

**Update package.json:**

```json
{
  "test:unit": "vitest --config vitest.config.unit.ts",
  "test:integration": "vitest --config vitest.config.integration.ts"
}
```

**Pros:** Clear separation
**Cons:** More complexity, more maintenance

---

## Proposed Documentation

### Test Execution Guide

**Quick Start:**

```bash
# All tests (recommended)
npm run start:test

# Unit tests only (fast, no Supabase needed)
npm test -- tests/unit/

# Integration + journey tests (requires Supabase)
supabase start
npm run env:test
npm test -- tests/journeys/ tests/contract/

# E2E tests (requires Supabase + dev server)
npm run test:e2e

# Database schema tests
npm run test:db
```

**Prerequisites:**

| Test Type | Requires | How to Setup |
|-----------|----------|--------------|
| Unit | None | Just run `npm test -- tests/unit/` |
| Journey/Contract | Supabase | `npm run start:test` |
| E2E | Supabase + Server | `npm run test:e2e` |
| Database | Supabase | `npm run test:db` |

### Environment Setup

**Development:**
```bash
npm run env:dev
npm run dev
```

**Testing:**
```bash
npm run start:test  # Starts Supabase + sets env + runs tests
```

**CI/CD:**
```bash
# GitHub Actions
- name: Setup test environment
  run: |
    supabase start
    npm run env:test
    npm test
```

---

## Action Items

### Immediate (Fix Test Failures)

1. ✅ **Update `vite.config.ts`** to load `.env.test`
2. ✅ **Fix `.env.test`** - Remove or set `VITE_MOCK_AUTH=false`
3. ✅ **Update anon key** in `.env.test` (get from `supabase status`)
4. ✅ **Test:** Run `npm run start:test` and verify journey tests pass

### Documentation

5. ✅ **Create test execution guide** (this document → CLAUDE.md)
6. ✅ **Update TESTING-ENVIRONMENT-SETUP.md** with:
   - Clear test type categories
   - Prerequisites for each type
   - When to use `npm test` vs `npm run start:test`
7. ✅ **Document in README** (if exists)

### Cleanup (Optional)

8. ⚠️ **Rename journey tests?**
   - Current: `tests/journeys/` (confusing - are they unit or integration?)
   - Better: `tests/integration/journeys/` (makes it clear they need Supabase)
9. ⚠️ **Add test categories to file names?**
   - `*.unit.test.ts` - Pure unit tests
   - `*.integration.test.ts` - Needs Supabase
   - `*.e2e.spec.ts` - Playwright tests (already using .spec.ts)

### CI/CD

10. ✅ **Add GitHub Actions workflow** (after tests pass locally)
11. ✅ **Add test coverage reporting**
12. ✅ **Add branch protection** (require tests to pass)

---

## Recommended Workflow

### For Developers

**1. Before Coding:**
```bash
# Check current environment
npm run env:status

# Set development environment
npm run env:dev
```

**2. During Development:**
```bash
# Run unit tests (fast feedback)
npm test -- tests/unit/services/BandService.test.ts --watch

# Run related journey tests (slower but comprehensive)
npm run start:test
```

**3. Before Committing:**
```bash
# Run all tests
npm run start:test

# Check types
npm run type-check

# Lint
npm run lint
```

### For CI/CD

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run start:test  # Uses existing script!
```

---

## Open Questions

1. **Should unit tests use mocks or real Supabase?**
   - Current: Mix of both (inconsistent)
   - Recommendation: Unit tests → mocks, Journey tests → real Supabase

2. **Is `VITE_MOCK_AUTH=true` still needed?**
   - Used by: Unknown (need to search codebase)
   - Recommendation: Audit usage, remove if unused

3. **Should we split `.env.test` into unit vs integration?**
   - Pro: Clear separation
   - Con: More files, more complexity
   - Recommendation: Start with single `.env.test`, split if needed

4. **Do E2E tests need fresh database each time?**
   - User said: "e2e tests you should be starting from a fresh local supabase instance each time"
   - Current: Reuses database
   - Recommendation: Add `supabase db reset` to E2E setup

---

## Success Criteria

✅ **Phase 0 Complete When:**
- [ ] All journey tests pass (34 tests)
- [ ] All contract tests pass
- [ ] All E2E tests pass
- [ ] Documentation updated
- [ ] Team can run tests locally without issues

✅ **CI/CD Ready When:**
- [ ] GitHub Actions workflow runs tests
- [ ] Tests run in < 5 minutes
- [ ] Coverage reports generated
- [ ] Branch protection enabled

---

## Next Steps

**Before writing ANY new scripts:**

1. ✅ Update `vite.config.ts` to load `.env.test`
2. ✅ Fix `.env.test` (remove/disable `VITE_MOCK_AUTH`)
3. ✅ Run `npm run start:test` and see if journey tests pass
4. ✅ If tests pass → document the workflow
5. ✅ If tests still fail → investigate further (but likely will pass)

**Then document:**

6. ✅ Update CLAUDE.md with test execution guide
7. ✅ Update TESTING-ENVIRONMENT-SETUP.md with prerequisites
8. ✅ Create `.claude/how-to/RUN-TESTS.md` cheat sheet

**Finally automate:**

9. ✅ Add GitHub Actions workflow
10. ✅ Add to CONTRIBUTING.md (if exists)

---

**Conclusion:** The infrastructure is already there (`npm run start:test`), but it's not wired up correctly and not documented. Fix the Vitest config, clarify the `.env.test` purpose, and document the workflow before creating new scripts.
