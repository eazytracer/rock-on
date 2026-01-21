# Feature: Enforce no-console ESLint Rule

**Created:** 2026-01-20
**Status:** Backlog
**Priority:** Low (code quality improvement)

## Overview

Add ESLint's `no-console` rule to enforce use of the logging utility (`src/utils/logger.ts`) instead of direct `console.*` calls. This ensures consistent, environment-aware logging across the codebase.

## Background

The codebase has a logging utility that filters output by environment:

- **Development:** All logs (debug, info, warn, error)
- **Test:** Info, warn, error (no debug)
- **Production:** Error only

However, direct `console.*` calls bypass this filtering and appear in production.

## Current State

**ESLint Config:** `/workspaces/rock-on/.eslintrc.cjs`

**Logging Utility:** `src/utils/logger.ts`

- `logger.debug()`, `logger.info()`, `logger.warn()`, `logger.error()`
- `createLogger(namespace)` for namespaced logging

**Specification:** `.claude/specifications/logging.md`

## Scope of Work

### Violations Found (as of 2026-01-20)

```
Total: 456 occurrences across 44 files
```

**Breakdown by file (count):**

| File                                    | Count | Notes               |
| --------------------------------------- | ----- | ------------------- |
| `src/services/data/RealtimeManager.ts`  | 47    | Heavy debug logging |
| `src/utils/debugSync.ts`                | 38    | Debug utility       |
| `src/contexts/AuthContext.tsx`          | 35    | Auth flow logging   |
| `src/utils/resetDatabase.ts`            | 28    | DB reset utility    |
| `src/utils/testSupabaseConnection.ts`   | 26    | Test utility        |
| `src/database/seedMvpData.ts`           | 21    | Seed script         |
| `src/utils/debugRealtime.ts`            | 18    | Debug utility       |
| `src/services/data/SyncEngine.ts`       | 17    | Sync logging        |
| `src/hooks/useSongs.ts`                 | 16    | Hook logging        |
| `src/utils/performance.ts`              | 14    | Perf monitoring     |
| `src/services/data/LocalRepository.ts`  | 14    | Data layer          |
| `src/services/BandMembershipService.ts` | 14    | Service logging     |
| `src/pages/auth/AuthCallback.tsx`       | 15    | Auth callback       |
| `src/pages/AuthPages.tsx`               | 14    | Auth pages          |
| `src/services/data/SyncRepository.ts`   | 12    | Sync repo           |
| `src/services/SyncService.ts`           | 10    | Sync service        |
| Other files (29)                        | ~137  | Various             |

### Files Requiring Special Handling

1. **`src/utils/logger.ts`** - Must use console.\* (it's the wrapper)
   - Add `// eslint-disable-line no-console` to each console call

2. **Debug utilities** - May intentionally bypass logger for verbose output
   - `src/utils/debugSync.ts`
   - `src/utils/debugRealtime.ts`
   - Consider: Keep as-is with eslint-disable, or refactor to use logger

3. **Test utilities** - May need console for test output
   - `src/test/setup.ts`
   - `src/utils/testSupabaseConnection.ts`

4. **Seed scripts** - CLI output during seeding
   - `src/database/seedMvpData.ts`
   - `src/database/seedData.ts`

## Implementation Plan

### Phase 1: Add Rule as Warning

```javascript
// .eslintrc.cjs
rules: {
  // ... existing rules
  'no-console': 'warn',
}
```

This allows gradual migration without breaking builds.

### Phase 2: Fix Critical Files

Priority order:

1. Services (`src/services/**`) - Most important for production
2. Hooks (`src/hooks/**`) - Used throughout app
3. Pages (`src/pages/**`) - UI layer
4. Contexts (`src/contexts/**`) - App-wide state

### Phase 3: Handle Special Cases

Add eslint-disable comments for legitimate console use:

```typescript
// src/utils/logger.ts
export const logger: Logger = {
  // eslint-disable-next-line no-console
  debug: createLogFunction('debug', console.debug),
  // ... etc
}
```

### Phase 4: Escalate to Error

```javascript
// .eslintrc.cjs
rules: {
  'no-console': 'error',
}
```

## Migration Pattern

For each file:

```typescript
// Before
console.log('User logged in', { userId })
console.error('Failed to sync', error)

// After
import { createLogger } from '../utils/logger'
const log = createLogger('MyService')

log.info('User logged in', { userId })
log.error('Failed to sync', error)
```

## Estimated Effort

- **Phase 1:** 5 minutes (add warn rule)
- **Phase 2:** 2-4 hours (fix ~400 violations across 40 files)
- **Phase 3:** 30 minutes (special case handling)
- **Phase 4:** 5 minutes (escalate to error)

## Acceptance Criteria

- [ ] `no-console` rule enabled as `error` in `.eslintrc.cjs`
- [ ] `npm run lint` passes with zero console violations
- [ ] `src/utils/logger.ts` has appropriate eslint-disable comments
- [ ] Debug utilities documented with rationale for any remaining console use
- [ ] No `console.log` calls remain in production code paths

## Commands

```bash
# Check current violations
npm run lint 2>&1 | grep "no-console" | wc -l

# Run lint to see all violations
npm run lint

# Fix a specific file and verify
npm run lint -- src/services/data/SyncEngine.ts
```

## Related

- Logging specification: `.claude/specifications/logging.md`
- Logger utility: `src/utils/logger.ts`
