---
title: "CI/CD Testing Plan for Rock-On"
created: 2025-11-20T13:46
status: Implementation Plan
prompt: "Design a ci/cd testing plan that lays out what it will take to set up this process so we can ensure a consistent and proper test environment for all of our testing"
---

# CI/CD Testing Plan for Rock-On

## Executive Summary

This plan establishes a comprehensive testing pipeline with:
- ⚡ **Fast pre-commit checks** (< 30s) for immediate feedback
- 🔄 **Automated PR validation** with full test suite
- 🎯 **Consistent test environments** across local, CI, and production
- 📊 **Clear pass/fail criteria** with actionable error reports

## Current Test Inventory

### Unit Tests (`npm test`)
- **Runtime:** ~8s
- **Status:** 491 passing, 64 failing (known issues with hooks/utils - unrelated to sync)
- **Coverage:** Sync infrastructure, repositories, services
- **Dependencies:** None (mocked)

### Database Tests (`npm run test:db`)
- **Runtime:** ~3s
- **Status:** 269 tests (schema validation passing, some RLS issues)
- **Coverage:** Schema, RLS policies, triggers, constraints
- **Dependencies:** Local Supabase instance

### E2E Tests (`npm run test:e2e`)
- **Runtime:** ~2-5 min per browser
- **Status:** Flaky due to environment setup
- **Coverage:** User workflows, authentication, multi-user scenarios
- **Dependencies:** Local Supabase + dev server + Playwright browsers

### Static Analysis
- **Type Check** (`npm run type-check`): ~5s
- **Linting** (`npm run lint`): ~3s
- **Dependencies:** None

---

## Three-Tier Testing Strategy

### Tier 1: Pre-Commit Validation (Local)
**Goal:** Catch obvious errors before commit (< 30s total)

**What Runs:**
- ✅ Lint staged files only (`eslint --cache`)
- ✅ Type check (`tsc --noEmit`)
- ✅ Unit tests for changed files only (via `--changed` flag)
- ❌ NO database tests (requires Supabase)
- ❌ NO E2E tests (too slow)

**Tools:**
- Husky (git hooks)
- lint-staged (run on staged files only)

**Expected Time:** 15-30s

---

### Tier 2: PR Validation (GitHub Actions)
**Goal:** Full validation before merge (5-10 min)

**What Runs:**
- ✅ Full lint + type check
- ✅ ALL unit tests
- ✅ Database tests (with Supabase local)
- ✅ E2E tests (chromium only, critical paths)
- ✅ Build check (`npm run build`)

**Matrix:**
- Single OS: Ubuntu latest (for speed)
- Single Node version: 20.x LTS
- Single browser for E2E: Chromium (fastest)

**Expected Time:** 5-10 minutes

---

### Tier 3: Full Validation (Nightly/Manual)
**Goal:** Comprehensive testing before release

**What Runs:**
- ✅ All Tier 2 tests
- ✅ E2E tests across ALL browsers (chromium, firefox, webkit, mobile)
- ✅ Database tests with seed data variations
- ✅ Performance benchmarks
- ✅ Accessibility tests

**Matrix:**
- Multiple browsers: chromium, firefox, webkit, mobile chrome, mobile safari
- Multiple Node versions: 18.x, 20.x, 22.x (if desired)

**Expected Time:** 20-30 minutes

---

## Test Environment Setup

### Problem: E2E Tests Require Consistent Database State

**Issue Discovered:**
- E2E tests fail with "Could not find table" errors
- Supabase schema not reliably loaded between test runs
- No automated schema reset in test pipeline

**Root Causes:**
1. Tests assume Supabase schema is already loaded
2. No explicit database setup in test setup hooks
3. Seed data from previous runs contaminates tests

### Solution: Automated Test Database Management

#### **Playwright Global Setup** (New File)

Create `tests/global-setup.ts`:

```typescript
import { chromium, FullConfig } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function globalSetup(config: FullConfig) {
  console.log('🔧 Setting up test environment...');

  // 1. Check if Supabase is running
  try {
    const { stdout } = await execAsync('supabase status');
    if (!stdout.includes('running')) {
      console.error('❌ Supabase is not running. Start with: supabase start');
      process.exit(1);
    }
    console.log('✅ Supabase is running');
  } catch (error) {
    console.error('❌ Supabase CLI not found or not running');
    process.exit(1);
  }

  // 2. Reset database to clean state
  console.log('🔄 Resetting database...');
  await execAsync('supabase db reset --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres');
  console.log('✅ Database reset complete');

  // 3. Wait for database to be ready
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 4. Verify schema is loaded
  const { stdout: tables } = await execAsync(
    'psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = \'public\';"'
  );

  const tableCount = parseInt(tables.match(/\d+/)?.[0] || '0');
  if (tableCount < 15) {
    console.error(`❌ Expected at least 15 tables, found ${tableCount}`);
    process.exit(1);
  }
  console.log(`✅ Schema verified: ${tableCount} tables loaded`);

  console.log('🎉 Test environment ready!');
}

export default globalSetup;
```

#### **Playwright Config Update**

Update `playwright.config.ts`:

```typescript
export default defineConfig({
  // ... existing config

  // Global setup runs ONCE before all tests
  globalSetup: require.resolve('./tests/global-setup'),

  // Timeout for global setup
  globalTimeout: 120000, // 2 minutes

  // Projects configuration
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // ... other browsers
  ],

  // Webserver configuration (ensure dev server is running)
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    timeout: 120000,
    reuseExistingServer: !process.env.CI, // Start fresh in CI
  },
});
```

#### **Test Cleanup Hook** (Per-Test)

Create `tests/hooks/database-cleanup.ts`:

```typescript
import { test as base } from '@playwright/test';

// Extend base test with cleanup hook
export const test = base.extend({
  // Cleanup after each test
  page: async ({ page }, use) => {
    await use(page);

    // Optional: Clean up test data after each test
    // (Only needed if tests create data that pollutes other tests)
    // Note: Global setup resets entire DB, so this may be unnecessary
  },
});

export { expect } from '@playwright/test';
```

---

## Implementation Plan

### Phase 1: Pre-Commit Hooks (Week 1)

#### Step 1.1: Install Husky and lint-staged

```bash
npm install --save-dev husky lint-staged
npx husky init
```

#### Step 1.2: Configure package.json

Add to `package.json`:

```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --cache --fix",
      "prettier --write"
    ],
    "*.{json,md,yml}": [
      "prettier --write"
    ]
  },
  "scripts": {
    "prepare": "husky",
    "test:staged": "vitest run --changed --passWithNoTests"
  }
}
```

#### Step 1.3: Create pre-commit hook

Create `.husky/pre-commit`:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🔍 Running pre-commit checks..."

# Run lint-staged (lint + prettier on staged files)
npx lint-staged

# Type check
echo "📘 Type checking..."
npm run type-check

# Unit tests for changed files (optional - can be slow)
# echo "🧪 Running unit tests..."
# npm run test:staged

echo "✅ Pre-commit checks passed!"
```

#### Step 1.4: Make hook executable

```bash
chmod +x .husky/pre-commit
```

#### Step 1.5: Test the hook

```bash
# Make a change and try to commit
git add .
git commit -m "test: verify pre-commit hook"
# Should run lint, type-check, and tests before allowing commit
```

---

### Phase 2: GitHub Actions - PR Validation (Week 1-2)

#### Step 2.1: Create PR Workflow

Create `.github/workflows/pr-validation.yml`:

```yaml
name: PR Validation

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]

# Cancel in-progress runs when new commit is pushed
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # Job 1: Fast checks (lint, type, build)
  static-analysis:
    name: Static Analysis
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run type-check

      - name: Build check
        run: npm run build

  # Job 2: Unit tests
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm test -- --run

      - name: Upload coverage
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: unit-test-coverage
          path: coverage/

  # Job 3: Database tests
  database-tests:
    name: Database Tests
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Start Supabase local
        run: supabase start

      - name: Run database tests
        run: npm run test:db

      - name: Stop Supabase
        if: always()
        run: supabase stop

  # Job 4: E2E tests (chromium only for speed)
  e2e-tests:
    name: E2E Tests (Chromium)
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Start Supabase local
        run: supabase start

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests (chromium only)
        run: npm run test:e2e -- --project=chromium

      - name: Upload test results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-test-results
          path: test-results/

      - name: Stop Supabase
        if: always()
        run: supabase stop

  # Summary job (required for branch protection)
  test-summary:
    name: Test Summary
    runs-on: ubuntu-latest
    needs: [static-analysis, unit-tests, database-tests, e2e-tests]
    if: always()

    steps:
      - name: Check test results
        run: |
          if [ "${{ needs.static-analysis.result }}" != "success" ] || \
             [ "${{ needs.unit-tests.result }}" != "success" ] || \
             [ "${{ needs.database-tests.result }}" != "success" ] || \
             [ "${{ needs.e2e-tests.result }}" != "success" ]; then
            echo "❌ One or more test jobs failed"
            exit 1
          fi
          echo "✅ All tests passed!"
```

#### Step 2.2: Configure Branch Protection

**GitHub Repository Settings → Branches → Add Rule:**

- Branch name pattern: `main`
- ✅ Require status checks to pass before merging
  - ✅ Require branches to be up to date before merging
  - Required checks:
    - `Test Summary`
    - `Static Analysis`
    - `Unit Tests`
    - `Database Tests`
    - `E2E Tests (Chromium)`
- ✅ Require linear history (optional, recommended)
- ✅ Include administrators (enforce rules for everyone)

---

### Phase 3: Full Test Suite - Nightly (Week 2)

#### Step 3.1: Create Nightly Workflow

Create `.github/workflows/nightly-tests.yml`:

```yaml
name: Nightly Full Test Suite

on:
  schedule:
    # Run every night at 2 AM UTC
    - cron: '0 2 * * *'
  workflow_dispatch: # Allow manual trigger

jobs:
  # Full E2E test matrix (all browsers)
  e2e-full-matrix:
    name: E2E Tests - ${{ matrix.browser }}
    runs-on: ubuntu-latest
    timeout-minutes: 30

    strategy:
      fail-fast: false # Continue testing other browsers if one fails
      matrix:
        browser:
          - chromium
          - firefox
          - webkit
          - Mobile Chrome
          - Mobile Safari

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Start Supabase local
        run: supabase start

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Run E2E tests - ${{ matrix.browser }}
        run: npm run test:e2e -- --project="${{ matrix.browser }}"

      - name: Upload test results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-results-${{ matrix.browser }}
          path: test-results/

      - name: Stop Supabase
        if: always()
        run: supabase stop

  # Notify on failure
  notify-failure:
    name: Notify on Failure
    runs-on: ubuntu-latest
    needs: [e2e-full-matrix]
    if: failure()

    steps:
      - name: Send failure notification
        run: |
          echo "❌ Nightly tests failed!"
          # Add Slack/Discord/Email notification here
```

#### Step 3.2: Add Manual Trigger Script

Add to `package.json`:

```json
{
  "scripts": {
    "test:full": "npm run lint && npm run type-check && npm test -- --run && npm run test:db && npm run test:e2e",
    "test:ci": "echo 'See .github/workflows for CI tests'"
  }
}
```

---

## Test Data Management

### Problem: Seed Data Contamination

**Issue:**
- Test users from seed data (eric@ipodshuffle.com, etc.) interfere with tests
- Tests create data that persists between runs
- No isolation between test runs

### Solution: Test-Specific Data Strategy

#### **Option A: Clean State Per Test (Current)**

**Pros:**
- Simple: `supabase db reset` before test suite
- Fast: No per-test cleanup
- Reliable: Fresh DB every time

**Cons:**
- Loses seed data (test users, sample band)
- Slow for large test suites (one reset for all tests)

**Implementation:**
```typescript
// tests/global-setup.ts
await execAsync('supabase db reset --db-url ...');
```

#### **Option B: Isolated Test Data (Recommended)**

**Pros:**
- Seed data available for manual testing
- Tests create own data with unique IDs
- No conflicts between tests

**Cons:**
- Tests must create all needed data
- Slightly slower (more setup per test)

**Implementation:**
```typescript
// tests/fixtures/auth.ts
export function createTestUser(suffix?: string): TestUser {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return {
    email: `test-${timestamp}-${random}@test.com`,
    password: 'test-password-123',
    name: `Test User ${suffix || random}`,
  };
}

// Tests use unique emails every time
const user1 = createTestUser('user1');
const user2 = createTestUser('user2');
```

#### **Option C: Hybrid (Best of Both)**

**Pros:**
- Seed data for manual testing
- Clean state for automated tests
- Fast E2E tests (no per-test cleanup)

**Cons:**
- Requires two databases or conditional seed

**Implementation:**
```bash
# Use different database URLs for tests vs development
# .env.test
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=...

# .env.development
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=...

# Tests reset DB, dev keeps seed data
```

**Recommendation:** Use **Option B (Isolated Test Data)** for now, migrate to **Option C (Hybrid)** if needed.

---

## Caching Strategy

### NPM Dependencies

```yaml
# .github/workflows/*.yml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20.x'
    cache: 'npm' # ← Automatic npm caching
```

**Benefit:** ~30s saved per workflow run

### Playwright Browsers

```yaml
# Cache Playwright browsers (large downloads)
- name: Cache Playwright browsers
  uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: ${{ runner.os }}-playwright-${{ hashFiles('package-lock.json') }}

- name: Install Playwright browsers
  run: npx playwright install --with-deps chromium
```

**Benefit:** ~1-2 min saved per E2E job

### Supabase CLI

```yaml
# Supabase CLI is lightweight, no caching needed
- name: Setup Supabase CLI
  uses: supabase/setup-cli@v1
  with:
    version: latest
```

---

## Local Development Workflow

### Quick Reference Commands

```bash
# Pre-commit check (manual)
npm run lint && npm run type-check

# Unit tests only
npm test

# Unit tests with coverage
npm test -- --coverage

# Database tests (requires Supabase)
supabase start
npm run test:db

# E2E tests (single browser)
supabase start
npm run dev &
npm run test:e2e -- --project=chromium

# E2E tests (all browsers)
npm run test:e2e

# Full local validation (mimics CI)
supabase start
npm run lint && npm run type-check && npm test -- --run && npm run test:db && npm run test:e2e -- --project=chromium

# Reset test environment
supabase db reset
```

### New Developer Setup

**Required Steps:**

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Install Supabase CLI:**
   ```bash
   brew install supabase/tap/supabase  # macOS
   # OR
   scoop install supabase             # Windows
   # OR
   npm install -g supabase             # npm
   ```

3. **Start Supabase:**
   ```bash
   supabase start
   ```

4. **Run tests:**
   ```bash
   npm test                  # Unit tests
   npm run test:db           # Database tests
   npm run test:e2e          # E2E tests (requires dev server)
   ```

5. **Install Playwright browsers (first time only):**
   ```bash
   npx playwright install --with-deps
   ```

---

## Test Quality Metrics

### Success Criteria

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Unit tests passing | > 95% | 88% (491/555) | 🟡 Needs work |
| Database tests passing | 100% | 80% (RLS issues) | 🟡 Needs work |
| E2E tests passing | 100% | 0% (env issues) | 🔴 Critical |
| Pre-commit time | < 30s | N/A (not set up) | ⚪ Not implemented |
| PR validation time | < 10m | N/A (not set up) | ⚪ Not implemented |
| Test coverage | > 70% | Unknown | ⚪ Not measured |

### Action Items to Reach 100%

**Unit Tests:**
- ✅ 491 passing (sync infrastructure) - GOOD
- ❌ 64 failing (hooks/utils) - Fix or document as known issues

**Database Tests:**
- ✅ Schema tests passing (001-005)
- ❌ RLS tests failing (006-011) - Seed data + audit_log FK issues

**E2E Tests:**
- ❌ Environment setup (Supabase schema) - Fixed by global setup
- ❌ Band creation flow - Needs investigation
- ❌ Invite code tests - Blocked by band creation

---

## Rollout Timeline

### Week 1: Foundation
- ✅ Install Husky + lint-staged
- ✅ Configure pre-commit hooks
- ✅ Test pre-commit hooks locally
- ✅ Create PR validation workflow
- ✅ Test workflow with sample PR

### Week 2: Stabilization
- ✅ Implement Playwright global setup
- ✅ Fix E2E environment issues
- ✅ Add database tests to CI
- ✅ Configure branch protection rules
- ✅ Document setup in CONTRIBUTING.md

### Week 3: Full Suite
- ✅ Create nightly test workflow
- ✅ Add test quality dashboard
- ✅ Set up failure notifications
- ✅ Add coverage reporting
- ✅ Retrospective and refinement

---

## Cost Considerations

### GitHub Actions Minutes

**Free Tier:** 2,000 minutes/month for private repos

**Estimated Usage:**
- PR validation: ~10 min/PR × 20 PRs/month = **200 minutes**
- Nightly tests: ~30 min/night × 30 nights = **900 minutes**
- **Total:** ~1,100 minutes/month (within free tier ✅)

**If Needed:** GitHub Pro ($4/user/month) = 3,000 minutes/month

---

## Success Metrics (3 Months)

After 3 months of CI/CD, measure:

1. **Reduction in bugs reaching production:** Target 50% reduction
2. **Faster PR review time:** Target < 1 day (was < 3 days)
3. **Increased confidence:** Team feels safe merging PRs
4. **Test reliability:** < 5% flaky test rate
5. **Developer satisfaction:** Survey team on CI/CD experience

---

## Quick Start Checklist

**Phase 1: Pre-Commit (This Week)**

- [ ] Install Husky: `npm install --save-dev husky lint-staged && npx husky init`
- [ ] Configure lint-staged in package.json
- [ ] Create `.husky/pre-commit` hook
- [ ] Test: Make a commit and verify hook runs
- [ ] Document in CONTRIBUTING.md

**Phase 2: GitHub Actions (Next Week)**

- [ ] Create `.github/workflows/pr-validation.yml`
- [ ] Test workflow with a draft PR
- [ ] Verify all jobs pass
- [ ] Configure branch protection rules
- [ ] Notify team of new requirements

**Phase 3: E2E Stabilization (Week 3)**

- [ ] Create `tests/global-setup.ts`
- [ ] Update `playwright.config.ts`
- [ ] Run E2E tests locally to verify
- [ ] Update E2E tests to use global setup
- [ ] Verify E2E tests pass in CI

---

**Status:** Ready for implementation
**Next Steps:** Begin Phase 1 (Pre-Commit Hooks) this week
