---
created: 2025-11-20T22:52
prompt: "Compare test failures with existing Supabase docs and design automated test environment setup script"
---

# Test Environment Automation Design

## Executive Summary

**You're 100% correct** - the existing documentation already has the solution to the test failures, but it's not integrated into the test workflow. The Supabase environment variable instructions in `SUPABASE-LOCAL-SETUP.md` are the exact fix needed for the 34+ failing journey tests.

**The Gap:**
- ✅ Docs show how to get Supabase env vars (`.env.local`, `supabase status | grep "anon key"`)
- ✅ Docs show how to reset database (`./scripts/reset_local_db.sh`)
- ❌ Docs DON'T show how to export these vars for test execution
- ❌ No unified script to prepare test environment
- ❌ No CI/CD integration

---

## Current Documentation Analysis

### What Works (Already Documented)

**From `SUPABASE-LOCAL-SETUP.md`:**

1. **Getting Supabase Credentials** (Lines 111-123)
   ```bash
   # Start Supabase
   npx supabase start

   # Get anon key
   npx supabase status | grep "anon key"

   # Use in .env.local
   VITE_SUPABASE_URL=http://localhost:54321
   VITE_SUPABASE_ANON_KEY=eyJhbGc...
   ```

2. **Common Commands** (Lines 143-167)
   - `npx supabase start` - Start Supabase
   - `npx supabase stop` - Stop (keeps data)
   - `npx supabase db reset` - Reset database (wipes data, re-runs migrations)
   - `npx supabase status` - Check status

**From `TESTING-ENVIRONMENT-SETUP.md`:**

1. **Database Reset Script** (Lines 57-96)
   ```bash
   ./scripts/reset_local_db.sh
   ```
   - Drops existing tables
   - Creates fresh schema
   - Seeds test data
   - Verifies setup

2. **Environment Variables Section** (Lines 428-442)
   ```bash
   # .env.local.dev
   VITE_SUPABASE_URL=http://localhost:54321
   VITE_SUPABASE_ANON_KEY=<your-local-anon-key>

   # Get anon key:
   npx supabase status | grep "anon key"
   ```

### What's Missing (The Gap)

**Test Execution Integration:**
- ❌ No `.env.test` file documented
- ❌ No instructions to export env vars before running tests
- ❌ No unified test setup script
- ❌ Test commands in `package.json` don't ensure Supabase is running
- ❌ Tests don't have access to Supabase credentials

**Result:** Tests fail with "Supabase client should only be used when Supabase auth is enabled"

---

## Root Cause Analysis

### Why Tests Fail

**Journey tests** (34 failures) check `src/services/supabase/client.ts:9`:

```typescript
export function getSupabaseClient() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Supabase client should only be used when Supabase auth is enabled')
  }

  return createClient(url, key)
}
```

**Current test execution:**
```bash
npm test
# Vitest runs WITHOUT Supabase env vars
# import.meta.env.VITE_SUPABASE_URL = undefined
# import.meta.env.VITE_SUPABASE_ANON_KEY = undefined
# ❌ Tests throw error
```

**What tests need:**
```bash
# Export env vars BEFORE running tests
export VITE_SUPABASE_URL=http://localhost:54321
export VITE_SUPABASE_ANON_KEY=eyJhbGc...

npm test
# ✅ Tests can create Supabase client
```

---

## Solution: Automated Test Environment Script

### Design Specification

**Script Name:** `scripts/setup-test-env.sh`

**Purpose:** Create consistent, repeatable test environment from scratch

**Responsibilities:**
1. ✅ Stop existing Supabase (clean slate)
2. ✅ Remove old containers (avoid conflicts)
3. ✅ Start fresh Supabase instance
4. ✅ Export environment variables for current shell
5. ✅ Verify Supabase is healthy
6. ✅ Apply migrations (via `supabase db reset`)
7. ✅ Seed test data
8. ✅ Verify database setup (table count, RLS policies)
9. ✅ Print success message with next steps

**NOT Responsible For:**
- Running tests (user does this)
- Managing test results
- CI/CD pipeline logic

---

## Script Design

### Phase 1: Cleanup

**Goal:** Remove any existing Supabase state

```bash
#!/bin/bash
set -e  # Exit on any error

echo "===================================="
echo "Rock On - Test Environment Setup"
echo "===================================="
echo ""

echo "🧹 Phase 1: Cleanup"
echo "-----------------------------------"

# Stop existing Supabase (if running)
echo "Stopping existing Supabase..."
npx supabase stop --no-backup 2>/dev/null || echo "  (no instance to stop)"

# Remove Supabase containers (ensures clean state)
echo "Removing old containers..."
docker ps -a --filter "name=supabase" --format "{{.Names}}" | xargs -r docker rm -f 2>/dev/null || echo "  (no containers to remove)"

echo "✅ Cleanup complete"
echo ""
```

**Why:**
- Ensures no stale state from previous runs
- Prevents port conflicts
- Guarantees fresh database every time

---

### Phase 2: Start Supabase

**Goal:** Launch fresh local Supabase instance

```bash
echo "🚀 Phase 2: Start Supabase"
echo "-----------------------------------"

# Start Supabase
echo "Starting Supabase..."
npx supabase start

# Verify it started
if ! docker ps | grep -q "supabase_db"; then
  echo "❌ ERROR: Supabase failed to start"
  exit 1
fi

echo "✅ Supabase started"
echo ""
```

**Why:**
- `supabase start` automatically:
  - Pulls Docker images (first time only)
  - Starts PostgreSQL, PostgREST, Auth, Storage
  - Applies migrations from `supabase/migrations/`
  - Displays connection details

---

### Phase 3: Extract & Export Environment Variables

**Goal:** Make Supabase credentials available to tests

```bash
echo "🔧 Phase 3: Export Environment Variables"
echo "-----------------------------------"

# Get Supabase status output
STATUS_OUTPUT=$(npx supabase status)

# Extract anon key
ANON_KEY=$(echo "$STATUS_OUTPUT" | grep "anon key" | awk '{print $3}')

# Extract API URL (already known, but good to verify)
API_URL=$(echo "$STATUS_OUTPUT" | grep "API URL" | awk '{print $3}')

# Verify we got the values
if [ -z "$ANON_KEY" ]; then
  echo "❌ ERROR: Failed to extract anon key from Supabase"
  exit 1
fi

# Export for current shell AND create .env.test file
export VITE_SUPABASE_URL="$API_URL"
export VITE_SUPABASE_ANON_KEY="$ANON_KEY"

# Create .env.test for vitest to load
cat > .env.test <<EOF
# Auto-generated by setup-test-env.sh
# DO NOT EDIT MANUALLY - Will be overwritten on next test run

VITE_SUPABASE_URL=$API_URL
VITE_SUPABASE_ANON_KEY=$ANON_KEY
EOF

echo "✅ Environment variables exported:"
echo "   VITE_SUPABASE_URL=$VITE_SUPABASE_URL"
echo "   VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY:0:20}..."
echo "   Saved to: .env.test"
echo ""
```

**Why:**
- Tests need these env vars to create Supabase client
- `.env.test` persists values for vitest config
- Export in current shell for immediate use
- Truncate anon key in output (security)

---

### Phase 4: Database Setup

**Goal:** Reset database to known state with test data

```bash
echo "💾 Phase 4: Database Setup"
echo "-----------------------------------"

# Reset database (applies migrations + seed data)
echo "Resetting database to fresh state..."
npx supabase db reset --db-url "postgresql://postgres:postgres@localhost:54322/postgres"

# Alternative: Use existing reset script (if preferred)
# ./scripts/reset_local_db.sh

echo "✅ Database reset complete"
echo ""
```

**Why:**
- `supabase db reset`:
  - Drops all tables
  - Re-applies all migrations from `supabase/migrations/`
  - Runs `supabase/seed.sql` (if exists)
- Ensures consistent starting state every time
- E2E tests get fresh data (per user requirement)

---

### Phase 5: Verification

**Goal:** Confirm everything is ready for testing

```bash
echo "✅ Phase 5: Verification"
echo "-----------------------------------"

# Check Supabase is responsive
if ! curl -s http://localhost:54321/rest/v1/ > /dev/null; then
  echo "❌ ERROR: Supabase API not responding"
  exit 1
fi

# Verify database has expected tables
TABLE_COUNT=$(docker exec supabase_db_rock-on psql -U postgres -d postgres -t -c "
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = 'public'
")

echo "Database tables created: $TABLE_COUNT"

if [ "$TABLE_COUNT" -lt 15 ]; then
  echo "⚠️  WARNING: Expected at least 15 tables, found $TABLE_COUNT"
  echo "   Database may not be fully initialized"
fi

echo ""
echo "===================================="
echo "✅ Test Environment Ready!"
echo "===================================="
echo ""
echo "Next steps:"
echo "  1. Run unit tests:        npm test"
echo "  2. Run E2E tests:         npm run test:e2e"
echo "  3. Run all tests:         npm run test:all"
echo "  4. Open Supabase Studio:  http://localhost:54323"
echo ""
echo "Environment variables are exported for this shell session."
echo "To use in a new shell, run: source .env.test"
echo ""
```

**Why:**
- Catches setup failures early
- Provides clear feedback
- Guides user on next steps
- Shows what's available (Studio URL)

---

## Integration Points

### 1. Update `vitest.config.ts`

**Add env file loading:**

```typescript
import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // Load .env.test for test environment
    env: loadEnv('test', process.cwd(), ''),

    // Existing config
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
})
```

**Why:**
- Vitest automatically loads env vars from `.env.test`
- Tests can access `import.meta.env.VITE_SUPABASE_URL`
- No manual env export needed when using vitest

---

### 2. Update `package.json` Scripts

**Add test preparation scripts:**

```json
{
  "scripts": {
    "test:setup": "./scripts/setup-test-env.sh",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:db": "npx supabase test db",

    "test:all": "npm run test:setup && npm test && npm run test:e2e && npm run test:db",
    "test:ci": "./scripts/setup-test-env.sh && npm test && npm run test:e2e"
  }
}
```

**Usage:**
```bash
# One-time setup, then run tests manually
npm run test:setup
npm test

# Or run everything (setup + all tests)
npm run test:all

# CI/CD usage
npm run test:ci
```

---

### 3. Create `.env.test.example`

**Template for team members:**

```bash
# Test Environment Configuration
# Auto-generated by ./scripts/setup-test-env.sh
#
# To set up your test environment:
#   npm run test:setup
#
# This file shows the expected format but should NOT be edited manually.

VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<will-be-generated>
```

**Add to `.gitignore`:**
```
# Test environment (auto-generated)
.env.test
```

**Why:**
- Shows developers what's expected
- Prevents committing actual keys
- Documents auto-generation

---

## CI/CD Pipeline Integration

### GitHub Actions Example

**`.github/workflows/test.yml`:**

```yaml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Setup test environment
        run: npm run test:setup

      - name: Run unit & integration tests
        run: npm test

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Run database tests
        run: npm run test:db

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: |
            test-results/
            playwright-report/
```

**Why:**
- Ensures tests run in clean environment
- Catches integration issues before merge
- Blocks PRs with failing tests
- Provides test artifacts for debugging

---

## Documentation Updates Needed

### 1. Update `TESTING-ENVIRONMENT-SETUP.md`

**Add new section after "Quick Start" (around line 22):**

```markdown
## Running Tests

### Automated Test Setup (Recommended)

The easiest way to run tests with a fresh environment:

```bash
# Setup test environment (one time)
npm run test:setup

# Run tests
npm test                 # Unit + integration tests
npm run test:e2e         # E2E tests (Playwright)
npm run test:db          # Database tests (pgTAP)
npm run test:all         # All tests

# Or do everything at once
npm run test:all
```

### What `test:setup` Does

The `./scripts/setup-test-env.sh` script:
1. ✅ Stops any existing Supabase instance
2. ✅ Removes old containers (clean slate)
3. ✅ Starts fresh local Supabase
4. ✅ Exports environment variables
5. ✅ Resets database with migrations + seed data
6. ✅ Verifies everything is ready

**Expected Output:**
```
====================================
Rock On - Test Environment Setup
====================================

🧹 Phase 1: Cleanup
-----------------------------------
Stopping existing Supabase...
✅ Cleanup complete

🚀 Phase 2: Start Supabase
-----------------------------------
Starting Supabase...
✅ Supabase started

🔧 Phase 3: Export Environment Variables
-----------------------------------
✅ Environment variables exported

💾 Phase 4: Database Setup
-----------------------------------
Resetting database to fresh state...
✅ Database reset complete

✅ Phase 5: Verification
-----------------------------------
Database tables created: 17
====================================
✅ Test Environment Ready!
====================================
```

### Manual Test Setup (Advanced)

If you need more control:

```bash
# 1. Start Supabase
npx supabase start

# 2. Export environment variables
export VITE_SUPABASE_URL=http://localhost:54321
export VITE_SUPABASE_ANON_KEY=$(npx supabase status | grep "anon key" | awk '{print $3}')

# 3. Reset database
npx supabase db reset

# 4. Run tests
npm test
```
```

---

### 2. Update `SUPABASE-LOCAL-SETUP.md`

**Add note in "Step 5: Update Local Environment" (after line 123):**

```markdown
### For Testing

Tests use a separate `.env.test` file that is auto-generated. To set up your test environment:

```bash
npm run test:setup
```

This creates `.env.test` with the correct local Supabase credentials.

**Note:** `.env.test` is in `.gitignore` and will be recreated each time you run test setup.
```

---

## Benefits of This Approach

### Developer Experience

✅ **One Command Setup**
   - `npm run test:setup` → Ready to test
   - No manual env var copying
   - No "it works on my machine"

✅ **Fresh State Every Time**
   - E2E tests get clean database
   - No data pollution between runs
   - Reproducible failures

✅ **Clear Feedback**
   - Script shows exactly what it's doing
   - Verification step catches setup issues
   - Helpful error messages

### CI/CD Integration

✅ **Automated Pipeline**
   - Same setup script for local and CI
   - No environment-specific configs
   - Consistent results

✅ **Fast Feedback**
   - Parallel test execution possible
   - Early failure detection
   - Test results in PR

### Maintenance

✅ **Single Source of Truth**
   - Script documents the process
   - Easy to update when requirements change
   - Self-documenting

✅ **Version Controlled**
   - Script committed with code
   - Changes tracked in git
   - Team always has latest

---

## Migration Path

### Immediate (Phase 0)

1. ✅ Create `scripts/setup-test-env.sh` (following design above)
2. ✅ Update `vitest.config.ts` to load `.env.test`
3. ✅ Update `package.json` with new scripts
4. ✅ Add `.env.test` to `.gitignore`
5. ✅ Create `.env.test.example`

**Result:** 34+ journey tests will pass

### Short Term (After Phase 0)

6. ✅ Fix BandMembershipService test mocks (12 tests)
7. ✅ Investigate remaining test failures
8. ✅ Update documentation

**Result:** All 64 tests pass

### Long Term (CI/CD)

9. ✅ Create GitHub Actions workflow
10. ✅ Add test result reporting
11. ✅ Add branch protection rules (require tests to pass)

**Result:** Automated quality gates

---

## Estimated Impact

### Test Fixes

| Category | Tests | Fix Method | Effort |
|----------|-------|------------|--------|
| Journey tests | 34 | Script setup | 1 hour |
| BandMembership | 12 | Mock update | 30 min |
| useBands hooks | 3 | Depends on #1 | 15 min |
| SupabaseAuth | 4+ | Investigation | 30 min |
| **TOTAL** | **53+** | | **2-3 hours** |

### Documentation

- Update TESTING-ENVIRONMENT-SETUP.md: 30 min
- Update SUPABASE-LOCAL-SETUP.md: 15 min
- Create .env.test.example: 5 min

### CI/CD

- Create GitHub Actions workflow: 1 hour
- Test and debug pipeline: 1 hour

**Total Effort:** 1 day to fix all tests + documentation + CI/CD

---

## Open Questions

1. **Seed Data:** Should we use `supabase/seed.sql` or `scripts/seed_test_data.sql`?
   - Current: `scripts/reset_local_db.sh` uses custom SQL
   - Supabase: `supabase db reset` uses `supabase/seed.sql`
   - **Recommendation:** Consolidate to `supabase/seed.sql` for consistency

2. **E2E Test Isolation:** Should each E2E test file get its own fresh DB?
   - Current: Manual reset between test suites
   - Playwright: Global setup can run script once
   - **Recommendation:** Fresh DB per test file (slower but safer)

3. **Test Data Management:** How to handle test-specific data needs?
   - Current: One shared seed file
   - Alternative: Test-specific seed files
   - **Recommendation:** Shared seed + test setup/teardown for specific cases

---

## Success Criteria

✅ **Script runs successfully**
   - No manual intervention needed
   - All phases complete without errors
   - Verification passes

✅ **Tests can run**
   - `npm test` passes with Supabase available
   - Journey tests (34) now passing
   - No "Supabase client should only be used..." errors

✅ **Documentation is clear**
   - Developer can set up test env in < 5 minutes
   - CI/CD team can integrate easily
   - New team members can onboard quickly

✅ **Repeatable**
   - Running script twice gives same result
   - No manual cleanup needed between runs
   - Works on any machine with Docker

---

## Next Steps

1. **Create the script** (`scripts/setup-test-env.sh`)
2. **Test it locally** (does it work?)
3. **Run tests** (do they pass?)
4. **Update docs** (TESTING-ENVIRONMENT-SETUP.md)
5. **Commit** (script + docs + package.json)
6. **CI/CD integration** (GitHub Actions)

---

## Appendix: Full Script

See implementation in `scripts/setup-test-env.sh` (to be created)

**Script will be ~150 lines including:**
- Comments explaining each step
- Error handling
- Progress indicators
- Verification steps
- Helpful output

**Usage:**
```bash
# Make executable (one time)
chmod +x scripts/setup-test-env.sh

# Run
./scripts/setup-test-env.sh

# Or via npm
npm run test:setup
```

---

**Conclusion:** You identified the exact issue - we have all the pieces documented (Supabase setup, env vars, database reset) but they're not connected into a cohesive test workflow. The automated script bridges that gap and ensures every test run starts from a known-good state.
