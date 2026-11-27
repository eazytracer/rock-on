import { Page } from '@playwright/test'

/**
 * Custom assertions for E2E tests
 */

/**
 * Assert that there are no console errors on the page
 */
export async function assertNoConsoleErrors(
  page: Page,
  errors: string[]
): Promise<void> {
  if (errors.length > 0) {
    console.error('Console errors found:', errors)
    throw new Error(
      `Found ${errors.length} console error(s):\n${errors.join('\n')}`
    )
  }
}

/**
 * Non-critical warnings that shouldn't fail tests
 * These are logged as errors but don't indicate test failures
 */
const NON_CRITICAL_WARNINGS = [
  // Profile upsert after sign-in; the app continues if it fails
  'Failed to sync user to Supabase',
  // Network transient errors during auth
  'TypeError: Failed to fetch',
  // Duplicate key errors - expected in parallel test runs
  'duplicate key value violates unique constraint',
  '409 (Conflict)',
]

/**
 * Setup console error tracking for a page
 * Returns an array that will be populated with console errors
 */
export function setupConsoleErrorTracking(page: Page): string[] {
  const errors: string[] = []

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text()
      // Filter out non-critical warnings
      const isNonCritical = NON_CRITICAL_WARNINGS.some(warning =>
        text.includes(warning)
      )
      // The song editor looks titles up on Spotify as you type. Local and CI
      // stacks have no Spotify credentials, so that call fails (500) by design;
      // the editor hides the matches and saving still works.
      const isSpotifyLookup = msg
        .location()
        .url.includes('/functions/v1/spotify-search')
      if (!isNonCritical && !isSpotifyLookup) {
        errors.push(text)
      }
    }
  })

  page.on('pageerror', error => {
    errors.push(error.message)
  })

  return errors
}

/**
 * Setup comprehensive console logging for a page
 * Captures ALL console messages (log, warn, error, info) and outputs them to test console
 */
export function setupConsoleLogging(page: Page): void {
  page.on('console', msg => {
    const type = msg.type()
    const text = msg.text()
    // Relay browser console logs to test console
    console.log(`[Browser ${type.toUpperCase()}]`, text)
  })

  page.on('pageerror', error => {
    console.error('[Browser PAGE ERROR]', error.message)
  })
}
