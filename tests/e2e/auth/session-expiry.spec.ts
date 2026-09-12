import { test, expect, Page } from '@playwright/test'
import {
  createTestUser,
  signUpViaUI,
  deleteTestUser,
} from '../../fixtures/auth'

/**
 * Session Expiry E2E Tests (Phase 1 — Supabase-as-source-of-truth)
 *
 * After the Phase 1 auth simplification, the app no longer keeps a hand-rolled
 * `rock_on_session` mirror. The Supabase SDK session (the `sb-*` localStorage
 * keys) is the single source of truth, and `useAuthCheck` validates via
 * `authService.getSession()`.
 *
 * These tests simulate sign-out / stale state by clearing the Supabase tokens
 * and assert the new redirect + messaging behavior:
 *   - signed-out   → /auth?reason=signed-out   ("You've been signed out…")
 *   - session-error→ /auth?reason=session-error ("There was a problem…")
 * The old SessionExpiredModal is gone; the app redirects, never modals.
 */

/**
 * Helper to sign out by removing the Supabase session tokens.
 * With Phase 1, getSession() will then return null → 'signed-out'.
 */
async function clearSupabaseSession(page: Page): Promise<void> {
  await page.evaluate(() => {
    const keys = Object.keys(localStorage)
    for (const key of keys) {
      if (key.startsWith('sb-')) {
        localStorage.removeItem(key)
      }
    }
  })
}

/**
 * Helper to check if the app's identity keys are present in localStorage.
 */
async function hasIdentityKeys(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    return !!localStorage.getItem('currentUserId')
  })
}

/**
 * Shared setup: sign up a fresh user, create a band, land on /songs.
 * Returns the created user's id (for cleanup).
 */
async function signUpAndCreateBand(page: Page): Promise<string | undefined> {
  const user = createTestUser()
  await signUpViaUI(page, user)
  await expect(page).toHaveURL(/\/get-started/, { timeout: 10000 })

  const bandName = `Test Band ${Date.now()}`
  await page.fill('[data-testid="create-band-name-input"]', bandName)
  await page.click('[data-testid="create-band-button"]')
  await page.waitForURL(/\/songs/, { timeout: 10000 })

  return (
    (await page.evaluate(() => localStorage.getItem('currentUserId'))) ??
    undefined
  )
}

test.describe('Session Expiry', () => {
  test.describe('Signed Out on Page Load', () => {
    let testUserId: string | undefined

    test.afterEach(async () => {
      if (testUserId) {
        await deleteTestUser(testUserId)
        testUserId = undefined
      }
    })

    test('redirects to /auth when the Supabase session is removed', async ({
      page,
    }) => {
      testUserId = await signUpAndCreateBand(page)

      // Remove the Supabase session (simulates sign-out / expiry beyond refresh)
      await clearSupabaseSession(page)

      // Navigate to a protected route
      await page.goto('/setlists')

      // Should redirect to auth with the signed-out reason
      await expect(page).toHaveURL(/\/auth/, { timeout: 5000 })
      await expect(page.locator('input[type="email"]')).toBeVisible()
    })

    test('shows the signed-out reason param when session is gone', async ({
      page,
    }) => {
      testUserId = await signUpAndCreateBand(page)

      await clearSupabaseSession(page)
      await page.goto('/shows')

      // Redirect should carry reason=signed-out
      await expect(page).toHaveURL(/reason=signed-out/, { timeout: 5000 })
    })

    test('clears stale identity keys after redirect to auth', async ({
      page,
    }) => {
      testUserId = await signUpAndCreateBand(page)

      expect(await hasIdentityKeys(page)).toBe(true)

      await clearSupabaseSession(page)
      await page.goto('/songs')

      await expect(page).toHaveURL(/\/auth/, { timeout: 5000 })
      await expect(page.locator('input[type="email"]')).toBeVisible()
    })
  })

  test.describe('No Modal on Protected Pages', () => {
    let testUserId: string | undefined

    test.afterEach(async () => {
      if (testUserId) {
        await deleteTestUser(testUserId)
        testUserId = undefined
      }
    })

    test('does NOT show a modal on protected pages - redirects instead', async ({
      page,
    }) => {
      testUserId = await signUpAndCreateBand(page)

      await clearSupabaseSession(page)
      await page.goto('/songs')

      // Wait briefly for any modal to (not) appear
      await page.waitForTimeout(500)

      // The old SessionExpiredModal is deleted — no overlay should exist
      const modalOverlay = page.locator('.fixed.inset-0.bg-black\\/80')
      await expect(modalOverlay).not.toBeVisible()

      // Redirect to the auth page instead of showing a modal
      await expect(page).toHaveURL(/\/auth/, { timeout: 5000 })
      await expect(
        page.locator(
          '[data-testid="login-email-input"], input[id="login-email"]'
        )
      ).toBeVisible()
    })
  })

  test.describe('Navigation While Signed Out', () => {
    let testUserId: string | undefined

    test.afterEach(async () => {
      if (testUserId) {
        await deleteTestUser(testUserId)
        testUserId = undefined
      }
    })

    test('clicking a nav link while signed out redirects to auth', async ({
      page,
    }, testInfo) => {
      // Skip on mobile browsers - they use a different nav (hamburger menu)
      if (testInfo.project.name.includes('Mobile')) {
        test.skip()
      }

      testUserId = await signUpAndCreateBand(page)

      await clearSupabaseSession(page)

      // Click a nav button to another protected route (nav uses buttons)
      const setlistsButton = page.locator('button:has-text("Setlists")').first()
      await setlistsButton.click()

      await expect(page).toHaveURL(/\/auth/, { timeout: 5000 })
    })

    test('navigating via URL while signed out redirects to auth', async ({
      page,
    }) => {
      testUserId = await signUpAndCreateBand(page)

      await clearSupabaseSession(page)

      // Navigate via URL (works on all browsers including mobile)
      await page.goto('/setlists')

      await expect(page).toHaveURL(/\/auth/, { timeout: 5000 })
    })
  })

  test.describe('Session Messaging on Auth Page', () => {
    test('shows info toast when redirected with signed-out reason', async ({
      page,
    }) => {
      await page.goto('/auth?reason=signed-out')

      // Copy: "You've been signed out. Please sign in again."
      await expect(page.locator('text=/signed out/i').first()).toBeVisible({
        timeout: 3000,
      })
    })

    test('shows info toast when redirected with session-error reason', async ({
      page,
    }) => {
      await page.goto('/auth?reason=session-error')

      // Copy: "There was a problem with your session. Please sign in again."
      await expect(
        page.locator('text=/problem with your session/i').first()
      ).toBeVisible({ timeout: 3000 })
    })

    test('does NOT show the old "session invalid" wording for inactivity', async ({
      page,
    }) => {
      await page.goto('/auth?reason=signed-out')

      // The signed-out (inactivity) case must NOT say "invalid"
      const invalidWording = page.locator('text=/session.*invalid/i')
      await expect(invalidWording).not.toBeVisible()
    })

    test('no toast shown for regular auth page visit', async ({ page }) => {
      await page.goto('/auth')
      await page.waitForTimeout(500)

      const sessionToast = page.locator(
        'text=/(signed out|problem with your session)/i'
      )
      await expect(sessionToast).not.toBeVisible()
    })
  })

  test.describe('Protected Route Shows Loading Then Redirects', () => {
    test('redirects to auth when accessing a protected route with no session', async ({
      page,
    }) => {
      await page.goto('/songs')

      await expect(page).toHaveURL(/\/auth/, { timeout: 5000 })
      await expect(page.locator('input[type="email"]')).toBeVisible()
    })

    test('does not flash protected content before redirect', async ({
      page,
    }) => {
      await page.goto('/songs')

      await expect(page).toHaveURL(/\/auth/, { timeout: 5000 })

      const bodyText = await page.locator('body').textContent()
      expect(bodyText).not.toContain('No songs yet')
      expect(bodyText).not.toContain('Add your first song')
    })
  })
})
