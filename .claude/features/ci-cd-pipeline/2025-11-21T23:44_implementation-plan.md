---
created: 2025-11-21T23:44
feature: CI/CD Testing Pipeline
prompt: "Create detailed implementation plan for CI/CD pipeline"
status: ready-for-implementation
---

# CI/CD Testing Pipeline - Implementation Plan

## Executive Summary

This document provides a complete, step-by-step implementation plan for establishing a production-grade CI/CD testing pipeline for the rock-on project.

**Current State:**
- 555 tests across 63 files (491 passing, 64 failing)
- No CI/CD pipeline
- No pre-commit hooks
- Manual test execution required

**Target State:**
- Automated pre-commit validation (< 30s)
- Full CI pipeline on every PR/push
- Branch protection requiring all checks to pass
- Coverage reports and test artifacts
- ~5 minute total CI time with parallelization

**Estimated Effort:** 12-17 hours (~2.5 days full-time or 6 days part-time)

---

## Architecture Overview

### Pipeline Stages

```
┌─────────────────────────────────────────────────────────────────┐
│                      LOCAL DEVELOPMENT                           │
├─────────────────────────────────────────────────────────────────┤
│  Pre-Commit Hook (< 30s)                                        │
│  ├─ Lint staged files (lint-staged)                             │
│  ├─ Type check (tsc --noEmit)                                   │
│  └─ Fast unit tests (no Supabase dependencies)                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    GITHUB ACTIONS CI PIPELINE                    │
├─────────────────────────────────────────────────────────────────┤
│  Stage 1: Validate (parallel)                    ~1 min         │
│  ├─ Lint all files                                              │
│  ├─ Type check                                                   │
│  └─ Format check                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Stage 2: Unit Tests (parallel)                  ~30s           │
│  ├─ Run all unit tests                                          │
│  ├─ Generate coverage report                                    │
│  └─ Upload to Codecov                                           │
├─────────────────────────────────────────────────────────────────┤
│  Stage 3: Integration Tests (sequential)         ~1-2 min       │
│  ├─ Start Supabase (Docker)                                     │
│  ├─ Run journey tests                                           │
│  ├─ Run contract tests                                          │
│  ├─ Run database tests (pgTAP)                                  │
│  └─ Stop Supabase                                               │
├─────────────────────────────────────────────────────────────────┤
│  Stage 4: E2E Tests (4-shard parallel)           ~2 min         │
│  ├─ Start Supabase (Docker)                                     │
│  ├─ Shard 1: auth tests                                         │
│  ├─ Shard 2: bands/songs tests                                  │
│  ├─ Shard 3: setlists tests                                     │
│  ├─ Shard 4: shows tests                                        │
│  ├─ Collect artifacts (screenshots, videos)                     │
│  └─ Stop Supabase                                               │
├─────────────────────────────────────────────────────────────────┤
│  Stage 5: Report (on completion)                                │
│  ├─ Merge coverage reports                                      │
│  ├─ Generate GitHub Actions summary                             │
│  └─ Comment on PR with results                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Pre-Commit Validation

**Goal:** Fast local feedback loop with automated quality checks

**Duration:** ~2 hours
**Risk:** Low

### Task 1.1: Install Dependencies

```bash
# Install husky and lint-staged
npm install --save-dev husky lint-staged

# Add prepare script
npm pkg set scripts.prepare="husky install"

# Initialize husky
npm run prepare
```

### Task 1.2: Create Pre-Commit Hook

**File:** `.husky/pre-commit`

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🔍 Running pre-commit checks..."

# Run lint-staged for staged file checks
npx lint-staged

# Run type check (fast, catches type errors early)
echo "📝 Type checking..."
npm run type-check

# Run fast unit tests (no Supabase dependencies)
echo "🧪 Running fast unit tests..."
npm run test:unit:fast

echo "✅ Pre-commit checks passed!"
```

**Commands:**
```bash
cat > .husky/pre-commit << 'EOF'
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🔍 Running pre-commit checks..."
npx lint-staged
echo "📝 Type checking..."
npm run type-check
echo "🧪 Running fast unit tests..."
npm run test:unit:fast
echo "✅ Pre-commit checks passed!"
EOF

chmod +x .husky/pre-commit
```

### Task 1.3: Configure lint-staged

**File:** `.lintstagedrc.json`

```json
{
  "*.{ts,tsx}": [
    "eslint --max-warnings 0 --fix",
    "prettier --write"
  ],
  "*.{js,jsx,cjs,mjs}": [
    "eslint --max-warnings 0 --fix",
    "prettier --write"
  ],
  "*.{json,md,yml,yaml}": [
    "prettier --write"
  ],
  "*.{css,scss}": [
    "prettier --write"
  ]
}
```

### Task 1.4: Update package.json Scripts

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "prepare": "husky install",
    "test:unit:fast": "vitest run tests/unit/ --reporter=dot",
    "lint:staged": "eslint --max-warnings 0"
  }
}
```

### Validation

```bash
# Test the hook
echo "export const TEST = 'test'" > src/test.ts
git add src/test.ts
git commit -m "test: verify pre-commit hook"
# Should run all checks before allowing commit
rm src/test.ts
git reset --soft HEAD~1
```

**Success Criteria:**
- ✅ Pre-commit hook runs automatically
- ✅ Lint-staged formats staged files
- ✅ Type check catches errors
- ✅ Fast unit tests complete < 30s
- ✅ Can bypass with `--no-verify`

---

## Phase 2: GitHub Actions Core Pipeline

**Goal:** Establish basic CI with validation and unit tests

**Duration:** ~3 hours
**Risk:** Low

### Task 2.1: Create GitHub Actions Workflow

**File:** `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  validate:
    name: Validate Code
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint code
        run: npm run lint

      - name: Check formatting
        run: npm run format:check

      - name: Type check
        run: npm run type-check

  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    timeout-minutes: 5
    needs: validate

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit -- --coverage --reporter=verbose

      - name: Upload coverage artifact
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-unit
          path: coverage/
          retention-days: 7
```

### Task 2.2: Update Vitest Configuration

**File:** `vite.config.ts` (update test section)

Add coverage configuration:

```typescript
test: {
  // ... existing config ...
  coverage: {
    provider: 'v8',
    reporter: ['text', 'json', 'html', 'lcov'],
    exclude: [
      'node_modules/',
      'src/test/',
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.config.ts',
      '**/types.ts',
    ],
    thresholds: {
      lines: 60,
      functions: 60,
      branches: 60,
      statements: 60,
    },
  },
}
```

### Validation

```bash
# Create test branch
git checkout -b test/ci-validation
git add .github/workflows/ci.yml vite.config.ts
git commit -m "feat: add CI pipeline phase 2"
git push origin test/ci-validation

# Create PR on GitHub and verify:
# - Validate job runs and passes
# - Unit Tests job runs and passes
# - Total time < 2 minutes
```

**Success Criteria:**
- ✅ Workflow runs on PR
- ✅ Validate stage passes
- ✅ Unit tests pass with coverage
- ✅ Total time < 2 minutes

---

## Phase 3: Supabase Integration & Advanced Testing

**Goal:** Add integration, journey, contract, and database tests

**Duration:** ~4 hours
**Risk:** Medium

### Task 3.1: Add Integration Tests to Workflow

Add to `.github/workflows/ci.yml` after unit-tests job:

```yaml
  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    timeout-minutes: 10
    needs: unit-tests

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Start Supabase
        run: |
          echo "🚀 Starting Supabase..."
          supabase start
          supabase status

      - name: Wait for Supabase
        run: |
          timeout 60 bash -c 'until curl -sf http://127.0.0.1:54321/health; do sleep 2; done'
          echo "✅ Supabase is ready"

      - name: Run integration tests
        run: npm test -- tests/integration/ --reporter=verbose
        env:
          VITE_SUPABASE_URL: http://127.0.0.1:54321
          VITE_SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0

      - name: Run journey tests
        run: npm test -- tests/journeys/ --reporter=verbose
        env:
          VITE_SUPABASE_URL: http://127.0.0.1:54321
          VITE_SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0

      - name: Run contract tests
        run: npm test -- tests/contract/ --reporter=verbose
        env:
          VITE_SUPABASE_URL: http://127.0.0.1:54321
          VITE_SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0

      - name: Run database tests
        run: npm run test:db

      - name: Stop Supabase
        if: always()
        run: supabase stop --no-backup
```

### Validation

```bash
# Test locally
supabase start
npm test -- tests/integration/ tests/journeys/ tests/contract/
npm run test:db
supabase stop --no-backup

# Push and verify in CI
git add .github/workflows/ci.yml
git commit -m "feat: add integration test stage"
git push
```

**Success Criteria:**
- ✅ Supabase starts in CI (< 30s)
- ✅ All test types pass
- ✅ Stage completes < 2 minutes

---

## Phase 4: E2E Test Sharding & Optimization

**Goal:** Reduce CI time through parallelization

**Duration:** ~3 hours
**Risk:** Low

### Task 4.1: Add E2E Test Sharding

Add to `.github/workflows/ci.yml` after integration-tests:

```yaml
  e2e-tests:
    name: E2E Tests (Shard ${{ matrix.shard }})
    runs-on: ubuntu-latest
    timeout-minutes: 15
    needs: integration-tests
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3, 4]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Cache Playwright browsers
        uses: actions/cache@v4
        id: playwright-cache
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}

      - name: Install Playwright
        if: steps.playwright-cache.outputs.cache-hit != 'true'
        run: npx playwright install --with-deps chromium

      - name: Setup Supabase
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Start Supabase
        run: |
          supabase start
          timeout 60 bash -c 'until curl -sf http://127.0.0.1:54321/health; do sleep 2; done'

      - name: Run E2E tests
        run: npx playwright test --shard=${{ matrix.shard }}/4
        env:
          VITE_SUPABASE_URL: http://127.0.0.1:54321
          VITE_SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report-shard-${{ matrix.shard }}
          path: playwright-report/
          retention-days: 7

      - name: Stop Supabase
        if: always()
        run: supabase stop --no-backup
```

### Task 4.2: Update Playwright Config

**File:** `playwright.config.ts`

Add CI-specific configuration:

```typescript
export default defineConfig({
  // ... existing config ...

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  reporter: process.env.CI
    ? [['html'], ['github'], ['list']]
    : [['html'], ['list']],

  use: {
    trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'retain-on-failure' : 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
```

### Validation

```bash
# Test sharding locally
npx playwright test --shard=1/4
npx playwright test --shard=2/4
npx playwright test --shard=3/4
npx playwright test --shard=4/4
```

**Success Criteria:**
- ✅ E2E tests run across 4 shards
- ✅ Each shard completes < 5 minutes
- ✅ Total E2E time ~2 minutes
- ✅ Artifacts uploaded per shard

---

## Phase 5: Reporting & Documentation

**Goal:** Add comprehensive reporting and guides

**Duration:** ~3 hours
**Risk:** Low

### Task 5.1: Add PR Comment Reporter

Add to `.github/workflows/ci.yml`:

```yaml
  report:
    name: Test Report
    runs-on: ubuntu-latest
    needs: [validate, unit-tests, integration-tests, e2e-tests]
    if: always() && github.event_name == 'pull_request'
    permissions:
      pull-requests: write

    steps:
      - name: Comment PR
        uses: actions/github-script@v7
        with:
          script: |
            const comment = `## 🤖 CI Test Results

            ### ✅ Validation
            - Lint: Passed
            - Type Check: Passed
            - Format: Passed

            ### 🧪 Tests
            - Unit Tests: Passed
            - Integration Tests: Passed
            - E2E Tests (4 shards): Passed

            ---
            *All checks passed! ✨*`;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
```

### Task 5.2: Update CLAUDE.md

Add CI/CD section to `CLAUDE.md`:

```markdown
## CI/CD Pipeline

Rock-On uses GitHub Actions for continuous integration.

### Pipeline Stages

1. **Validate** (~1 min) - Lint, type check, format
2. **Unit Tests** (~30s) - All unit tests with coverage
3. **Integration Tests** (~1-2 min) - Journey, contract, database tests
4. **E2E Tests** (~2 min) - Playwright tests across 4 shards
5. **Report** - PR comments with results

**Total Time:** ~5 minutes

### Pre-Commit Hooks

Runs automatically on `git commit`:
- Lint staged files
- Type check
- Fast unit tests (~30s)

**Bypass:** `git commit --no-verify` (emergencies only)

### Branch Protection

Main branch requires:
- ✅ All CI checks pass
- ✅ Branch up to date
- ✅ 1 approval (recommended)
```

### Task 5.3: Create Troubleshooting Guide

**File:** `.claude/guides/ci-cd-troubleshooting.md`

See full content in research document.

### Task 5.4: Create Developer Workflow Guide

**File:** `.claude/guides/developer-workflow.md`

See full content in research document.

**Success Criteria:**
- ✅ PR comments show test results
- ✅ CLAUDE.md updated
- ✅ Troubleshooting guide created
- ✅ Developer guide created

---

## Phase 6: Launch & Branch Protection

**Goal:** Enable branch protection and train team

**Duration:** ~2 hours
**Risk:** Very Low

### Task 6.1: Enable Branch Protection

**Steps:**
1. Navigate to Settings → Branches
2. Add branch protection rule for `main`
3. Configure:
   - ✅ Require pull request
   - ✅ Require 1 approval
   - ✅ Require status checks:
     - `Validate Code`
     - `Unit Tests`
     - `Integration Tests`
     - `E2E Tests (Shard 1-4)`
   - ✅ Require branch up to date
   - ✅ Require conversation resolution

### Task 6.2: Create PR Template

**File:** `.github/PULL_REQUEST_TEMPLATE.md`

```markdown
## Description
<!-- Describe your changes -->

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation

## Testing
- [ ] Unit tests pass (`npm run test:unit`)
- [ ] E2E tests pass (`npm run test:e2e`)
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-reviewed code
- [ ] Added tests for changes
- [ ] Documentation updated
```

### Task 6.3: Team Training

**Topics to cover:**
1. Pre-commit hooks
2. CI pipeline stages
3. How to read CI results
4. How to debug failures
5. When/how to bypass hooks

**Success Criteria:**
- ✅ Branch protection enabled
- ✅ PR template created
- ✅ Team trained
- ✅ All documentation complete

---

## Complete File Checklist

### Files to Create

- [ ] `.husky/pre-commit`
- [ ] `.lintstagedrc.json`
- [ ] `.github/workflows/ci.yml`
- [ ] `.github/PULL_REQUEST_TEMPLATE.md`
- [ ] `.claude/guides/ci-cd-troubleshooting.md`
- [ ] `.claude/guides/developer-workflow.md`

### Files to Modify

- [ ] `package.json` (add scripts, dependencies)
- [ ] `vite.config.ts` (add coverage config)
- [ ] `playwright.config.ts` (add CI config)
- [ ] `CLAUDE.md` (add CI/CD section)

---

## Timeline & Dependencies

```
Phase 1 (Pre-Commit) - 2 hrs
    ↓
Phase 2 (Core Pipeline) - 3 hrs
    ↓
Phase 3 (Supabase Integration) - 4 hrs
    ↓
Phase 4 (E2E Sharding) - 3 hrs
    ↓
Phase 5 (Reporting) - 3 hrs
    ↓
Phase 6 (Launch) - 2 hrs
```

**Total:** 17 hours (~2.5 days full-time or 6 days part-time)

---

## Success Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Pre-commit time | < 30s | TBD |
| Validate stage | < 1 min | TBD |
| Unit test stage | < 30s | TBD |
| Integration stage | < 2 min | TBD |
| E2E stage (total) | < 2 min | TBD |
| Total CI time | < 5 min | TBD |
| Flaky test rate | < 5% | TBD |

---

## Rollback Procedures

### Emergency Rollback

If CI breaks everything:

```bash
# Disable workflow
git mv .github/workflows/ci.yml .github/workflows/ci.yml.disabled
git commit -m "chore: disable CI temporarily"
git push

# Disable branch protection (GitHub UI)
# Settings → Branches → Delete rule

# Fix issue, test, re-enable
```

### Phase-Specific Rollback

**Phase 1 (Pre-commit):**
```bash
rm -rf .husky .lintstagedrc.json
npm uninstall husky lint-staged
```

**Phase 2-6:**
```bash
rm .github/workflows/ci.yml
git checkout vite.config.ts playwright.config.ts
```

---

## Next Steps

1. **Review** this plan
2. **Answer open questions** from research
3. **Begin Phase 1** implementation
4. **Test thoroughly** at each phase
5. **Document learnings** and adjust plan as needed

---

**Ready for Implementation:** ✅ Yes
