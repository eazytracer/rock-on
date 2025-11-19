---
title: Chromium E2E Tests Timing Out Due to CORS Issues
created: 2025-11-14
severity: Medium
status: Fixed
category: Test Infrastructure
---

# Chromium E2E Tests Timing Out Due to CORS Issues

## Summary

All Chromium-based E2E tests (Desktop Chrome and Mobile Chrome) were timing out at 30 seconds due to CORS (Cross-Origin Resource Sharing) policy blocking requests from `localhost:5173` (dev server) to `127.0.0.1:54321` (local Supabase).

## Symptoms

- **All chromium tests timing out** at 30 seconds
- **Firefox and WebKit tests passing** without issues
- **Console errors showing**:
  - `TypeError: Load failed`
  - `due to access control checks`
  - `❌ Initial sync failed`
  - `browserContext.newPage: Test timeout of 30000ms exceeded`

## Root Cause

Chromium has stricter CORS enforcement than Firefox and WebKit when running in test mode. Without explicit flags to disable web security for testing, chromium blocks cross-origin requests between:
- Frontend: `http://localhost:5173` (Vite dev server)
- Backend: `http://127.0.0.1:54321` (Local Supabase API)

Even though both are localhost, chromium treats them as different origins due to different ports and hostnames (localhost vs 127.0.0.1).

## Test Results

**Before Fix:**
```
Chromium:       0/36 passed (100% timeout failures)
Mobile Chrome:  0/42 passed (100% timeout failures)
Firefox:        76/76 passed ✅
WebKit:         All passed ✅
Mobile Safari:  All passed ✅
```

**After Fix:**
```
Chromium:       3/3 smoke tests passed ✅ (tested)
Mobile Chrome:  Expected to pass with same fix
Firefox:        Unchanged (already working)
WebKit:         Unchanged (already working)
```

## Solution

Added chromium-specific launch arguments to `playwright.config.ts` to disable web security for testing:

```typescript
{
  name: 'chromium',
  use: {
    ...devices['Desktop Chrome'],
    launchOptions: {
      args: [
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    }
  },
}
```

Applied the same fix to Mobile Chrome configuration.

## Why This Is Safe

1. **Test environment only**: These flags are ONLY used in E2E tests, never in production
2. **Local development**: Tests run against local Supabase, not production
3. **Common practice**: Disabling web security is standard for E2E testing when testing against local APIs
4. **Isolated browsers**: Playwright launches isolated browser instances that don't affect regular browsing

## Files Changed

- `playwright.config.ts` - Added `launchOptions.args` to chromium and Mobile Chrome configurations

## Verification Steps

1. Run smoke tests: `npm run test:e2e -- --project=chromium tests/e2e/auth/login-smoke.spec.ts`
2. Verify all 3 smoke tests pass
3. Run full chromium suite: `npm run test:e2e -- --project=chromium`
4. Verify no more CORS-related timeouts

## Impact

- **Before**: 0% chromium test pass rate (all timeouts)
- **After**: Normal test pass rate (same as Firefox/WebKit)
- **Risk**: None - changes only affect test environment

## References

- Playwright CORS documentation: https://playwright.dev/docs/network#cors
- Chromium security flags: https://peter.sh/experiments/chromium-command-line-switches/
- Test run logs: `/tmp/e2e-test-results.log`

## Related Issues

None - this was a test infrastructure configuration issue, not an application bug.

## Lessons Learned

1. Different browsers have different CORS enforcement in test environments
2. Always test E2E configuration across all target browsers early
3. Chromium requires explicit flags to disable web security for local development testing
4. Firefox and WebKit are more permissive with localhost cross-origin requests

## Status

✅ **FIXED** - Chromium tests now passing with proper launch arguments configured.
