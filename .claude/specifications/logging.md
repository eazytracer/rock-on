# Logging Specification

**Created:** 2026-01-20
**File:** `src/utils/logger.ts`

## Overview

Rock-On uses an environment-aware logging utility that controls what gets logged based on the runtime environment. This prevents debug noise in production while providing full visibility during development.

## Log Levels by Environment

| Level   | Development | Test | Production |
| ------- | ----------- | ---- | ---------- |
| `debug` | ✅          | ❌   | ❌         |
| `info`  | ✅          | ✅   | ❌         |
| `warn`  | ✅          | ✅   | ❌         |
| `error` | ✅          | ✅   | ✅         |

## Usage

### Basic Logger

For simple one-off logging:

```typescript
import { logger } from '../utils/logger'

logger.debug('Detailed debugging info') // Only in dev
logger.info('General information') // Dev + test
logger.warn('Warning message') // Dev + test
logger.error('Error occurred', error) // Always logged
```

### Namespaced Logger (Recommended)

For module-specific logging with automatic prefixes:

```typescript
import { createLogger } from '../utils/logger'

const log = createLogger('MyComponent')

log.debug('Processing started') // [MyComponent] Processing started
log.info('User action', { id: 1 }) // [MyComponent] User action { id: 1 }
log.warn('Deprecation notice') // [MyComponent] Deprecation notice
log.error('Failed to load', error) // [MyComponent] Failed to load Error: ...
```

## When to Use Each Level

| Level   | Use Case                                                             |
| ------- | -------------------------------------------------------------------- |
| `debug` | Detailed internal state, loop iterations, query results, timing info |
| `info`  | Significant events: user actions, state changes, API calls           |
| `warn`  | Recoverable issues, deprecations, fallback behavior triggered        |
| `error` | Failures that affect functionality, caught exceptions                |

## Best Practices

### DO:

```typescript
// Use namespaced loggers for identifiable output
const log = createLogger('SyncEngine')
log.debug('Processing queue', { itemCount: 5 })

// Include relevant context
log.error('Sync failed', { itemId, error: err.message })

// Use appropriate levels
log.debug('Cache hit for', key) // Verbose, dev-only
log.info('User logged in', { userId }) // Important event
log.warn('Session near expiry') // Actionable warning
log.error('Database connection lost') // Critical failure
```

### DON'T:

```typescript
// ❌ Don't use console.log directly
console.log('Debug info') // Will show in production!

// ❌ Don't use logger.error for non-errors
logger.error('User clicked button') // Wrong level

// ❌ Don't log sensitive data
log.debug('User credentials', { password }) // Security risk

// ❌ Don't use isDev checks manually
if (isDev) {
  console.log('Debug') // Use logger.debug instead
}
```

## Implementation Details

The logger is configured via environment detection from `src/config/environment.ts`:

- `isProd`: `NODE_ENV === 'production'`
- `isTest`: `NODE_ENV === 'test'`
- Development: Neither prod nor test

## Adding Logging to Existing Code

When adding logging to a module:

1. Import `createLogger` at the top of the file
2. Create a namespaced logger with a descriptive name
3. Replace any existing `console.*` calls with appropriate log levels
4. Add debug logging for troubleshooting complex flows

```typescript
// At top of file
import { createLogger } from '../utils/logger'
const log =
  createLogger('MyService') -
  // Replace console calls
  console.log('Processing:', data) +
  log.debug('Processing:', data) -
  console.error('Failed:', error) +
  log.error('Failed:', error)
```

## Testing Considerations

- In tests, `debug` logs are suppressed to reduce noise
- `info`, `warn`, and `error` still appear to help diagnose test failures
- Mock the logger if testing log output specifically

```typescript
vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))
```
