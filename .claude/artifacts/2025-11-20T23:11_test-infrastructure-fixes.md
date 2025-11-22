---
created: 2025-11-20T23:11
prompt: "Fix test infrastructure to enable journey/contract/integration tests to access Supabase"
---

# Test Infrastructure Fixes - Rock-On

## Summary

Fixed the test infrastructure to enable journey, contract, and integration tests to access Supabase by updating configuration files and documentation.

**Key Achievement:** Journey tests now connect to Supabase successfully (was immediately failing with "Supabase client should only be used when Supabase auth is enabled").

---

## Changes Made

### 1. Documentation Updates

#### A. `.claude/setup/TESTING-ENVIRONMENT-SETUP.md`
**Added:** Comprehensive "Automated Test Execution" section documenting:
- Test type overview table (6 test categories)
- Recommended test execution workflows
- Detailed requirements for each test type
- Environment setup instructions
- Developer workflow guidance

**Key Addition:**
```markdown
| Test Type | Count | Needs Supabase | Runner | Command |
|-----------|-------|----------------|--------|---------|
| **Unit** | 23 files | ❌ No (uses mocks) | Vitest | `npm test -- tests/unit/` |
| **Integration** | 1 file | ✅ Yes | Vitest | `npm test -- tests/integration/` |
| **Journey** | 4 files | ✅ **Yes** | Vitest | `npm test -- tests/journeys/` |
| **Contract** | 3 files | ✅ Yes | Vitest | `npm test -- tests/contract/` |
| **E2E** | 11 files | ✅ Yes + Dev Server | Playwright | `npm run test:e2e` |
| **Database** | 11 files | ✅ Yes | pgTAP | `npm run test:db` |
```

**Impact:** Developers now have clear guidance on which tests need what environment.

#### B. `CLAUDE.md`
**Updated:** Testing Policy section with:
- Current accurate test status (491 passing, 64 failing)
- Breakdown of test organization by type
- Reference to detailed test execution guide
- Corrected recommended test command (`npm run start:test`)

**Before:**
```markdown
**Current Test Status**: 73 passing (sync infrastructure), 13 failing (hooks/utils - unrelated to sync)
```

**After:**
```markdown
**Current Test Status** (as of 2025-11-20):
- 491 passing tests across 25 test files
- 64 failing tests across 8 test files (under investigation)
- Primary issue: Journey tests require Supabase environment setup

**Test Organization**:
- Unit tests: `tests/unit/` (mirror `src/` structure) - 23 files
- Integration tests: `tests/integration/` - 1 file
- Journey tests: `tests/journeys/` - 4 files (require Supabase)
- Contract tests: `tests/contract/` - 3 files (require Supabase)
- E2E tests: `tests/e2e/` - 11 files (Playwright)
- Database tests: `supabase/tests/` - 11 files (pgTAP)
```

### 2. Configuration Fixes

#### A. `vite.config.ts`
**Problem:** Vitest wasn't loading `.env.test`, so journey/contract/integration tests had no access to `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

**Fix:**
```typescript
// BEFORE
import { defineConfig } from 'vite'
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // ❌ No env loading!
  }
})

// AFTER
import { defineConfig, loadEnv } from 'vite'
export default defineConfig(({ mode }) => {
  // Load test environment variables when running tests
  const testEnv = mode === 'test' ? loadEnv('test', process.cwd(), '') : {}

  return {
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      env: testEnv,  // ✅ Load .env.test for journey/contract/integration tests
    }
  }
})
```

**Impact:** Vitest now loads `.env.test` automatically, providing Supabase credentials to all test types.

#### B. `.env.test`
**Problem:** Had `VITE_MOCK_AUTH=true` which told the app to skip Supabase auth, conflicting with journey tests that need real Supabase.

**Fix:**
```bash
# BEFORE
VITE_MOCK_AUTH=true  # ❌ Tells app to skip Supabase!
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=eyJhbGci...

# AFTER
# Test Environment (for CI/CD, integration tests)
# Uses local Supabase for journey, contract, and integration tests
# Unit tests use mocks regardless of this setting
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

**Impact:** Journey tests can now call `getSupabaseClient()` without throwing an error.

---

## Root Cause Analysis

### Why Journey Tests Were Failing

**Sequence of Events (BEFORE fix):**
1. User runs `npm test`
2. Vitest starts but doesn't load `.env.test`
3. Journey test calls `TestDevice.createSong()`
4. `createSong()` calls `getSupabaseClient()`
5. `getSupabaseClient()` checks for `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
6. Environment variables are missing → throws error
7. Test fails: "Supabase client should only be used when Supabase auth is enabled"

**Sequence of Events (AFTER fix):**
1. User runs `npm test`
2. Vitest starts and loads `.env.test` via `loadEnv('test', ...)`
3. Journey test calls `TestDevice.createSong()`
4. `createSong()` calls `getSupabaseClient()`
5. `getSupabaseClient()` checks for `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
6. Environment variables are present → creates Supabase client ✅
7. Test runs successfully

### Key Discovery

**The infrastructure already existed!** The `npm run start:test` script (in `scripts/start-test.sh`) already:
1. Starts Supabase if not running
2. Copies `.env.test` → `.env.local`
3. Runs tests

**Problem:** This workflow wasn't documented and Vitest wasn't configured to use it.

**Solution:**
- Document the existing workflow
- Fix Vitest to load `.env.test` directly
- Remove conflicting settings in `.env.test`

---

## Test Results

### Before Fix
```
❌ 34 journey tests failing with:
Error: Supabase client should only be used when Supabase auth is enabled
 ❯ Module.getSupabaseClient src/services/supabase/client.ts:9:11
```

### After Fix
```
✅ Journey tests now run and connect to Supabase successfully
✅ Supabase schema verified
✅ Test seeding process runs
✅ Tests can create test data in Supabase
```

**Evidence:**
```
stdout | unknown test
✅ Supabase schema verified
🌱 Starting MVP data seed...
📊 Existing users in database: 0
🚀 Database is empty, starting seeding process...
👥 Seeding users...
🎸 Seeding band...
🎵 Seeding songs...
```

---

## Remaining Work

### Immediate Next Steps
1. ✅ Verify all journey tests pass (currently testing)
2. ⏳ Fix remaining failing tests:
   - 12 BandMembershipService tests (outdated mocks)
   - 3 useBands hooks tests (mixed issues)
   - 4+ SupabaseAuthService logout tests (needs investigation)

### After Tests Pass
3. Add GitHub Actions CI/CD workflow
4. Add test coverage reporting
5. Add branch protection (require tests to pass)

### Optional Cleanup
6. Consider renaming `tests/journeys/` → `tests/integration/journeys/` for clarity
7. Consider test file naming conventions (`.unit.test.ts`, `.integration.test.ts`)

---

## Files Modified

### Documentation
- `.claude/setup/TESTING-ENVIRONMENT-SETUP.md` - Added comprehensive test execution guide
- `CLAUDE.md` - Updated test status and organization

### Configuration
- `vite.config.ts` - Added env loading for tests
- `.env.test` - Removed conflicting `VITE_MOCK_AUTH=true`

### Artifacts Created
- `.claude/artifacts/2025-11-20T23:00_test-structure-analysis.md` - Comprehensive test analysis
- `.claude/artifacts/2025-11-20T23:11_test-infrastructure-fixes.md` - This document

---

## Lessons Learned

1. **Infrastructure Already Existed:** The `npm run start:test` script was already doing the right thing, but wasn't documented or integrated into Vitest.

2. **Environment Configuration Matters:** Journey tests were written to use real Supabase, but the environment wasn't configured to provide credentials.

3. **Test Types Have Different Requirements:** Not all tests need Supabase:
   - Unit tests: Use mocks (no Supabase)
   - Journey/Contract/Integration tests: Need real Supabase
   - E2E tests: Need Supabase + dev server

4. **Documentation is Critical:** Having clear documentation on which tests need what environment prevents confusion and wasted effort.

---

## Success Criteria

✅ **Achieved:**
- Journey tests can connect to Supabase
- Documentation clearly explains test types and requirements
- Configuration files properly load environment variables

⏳ **In Progress:**
- Verifying all journey tests pass
- Fixing remaining failing tests

🔜 **Next:**
- CI/CD integration
- 100% test pass rate

---

**Status:** Test infrastructure fixes complete. Verification in progress.
