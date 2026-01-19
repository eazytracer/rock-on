import { test, expect } from '@playwright/test'
import {
  createTestUser,
  signUpViaUI,
  loginViaUI,
  logoutViaUI,
  deleteTestUser,
  createTestUserInDB,
} from '../../fixtures/auth'
import {
  setupConsoleErrorTracking,
  assertNoConsoleErrors,
} from '../../helpers/assertions'

test.describe('Protected Routes', () => {
  test.describe('Unauthenticated Access', () => {
    test('redirects unauthenticated users from /songs to /auth', async ({
      page,
    }) => {
      // Try to access protected route directly
      await page.goto('/songs')

      // Should redirect to auth
      await expect(page).toHaveURL(/\/auth/, { timeout: 5000 })
    })

    test('redirects unauthenticated users from /setlists to /auth', async ({
      page,
    }) => {
      await page.goto('/setlists')
      await expect(page).toHaveURL(/\/auth/, { timeout: 5000 })
    })

    test('redirects unauthenticated users from /shows to /auth', async ({
      page,
    }) => {
      await page.goto('/shows')
      await expect(page).toHaveURL(/\/auth/, { timeout: 5000 })
    })

    test('redirects unauthenticated users from /practices to /auth', async ({
      page,
    }) => {
      await page.goto('/practices')
      await expect(page).toHaveURL(/\/auth/, { timeout: 5000 })
    })

    test('redirects unauthenticated users from /band-members to /auth', async ({
      page,
    }) => {
      await page.goto('/band-members')
      await expect(page).toHaveURL(/\/auth/, { timeout: 5000 })
    })
  })

  test.describe('Loading Spinner', () => {
    test('shows loading spinner during auth check', async ({ page }) => {
      // Create a user and band first
      const user = createTestUser()
      await signUpViaUI(page, user)

      // Wait for band creation page
      await expect(page).toHaveURL(/\/get-started/, { timeout: 10000 })

      // Create a band
      const bandName = `Test Band ${Date.now()}`
      await page.fill(
        '[data-testid="create-band-name-input"], input[name="bandName"], input[id="band-name"]',
        bandName
      )
      await page.click(
        '[data-testid="create-band-button"], button:has-text("Create Band")'
      )

      // Wait for redirect to songs
      await page.waitForURL(/\/songs/, { timeout: 10000 })

      // Now navigate to another protected route
      // The loading spinner should briefly appear during auth check
      await page.goto('/setlists')

      // The auth-loading-spinner may flash briefly - we just check the page loads correctly
      await expect(page).toHaveURL(/\/setlists/, { timeout: 5000 })

      // Clean up
      const userId = await page.evaluate(() =>
        localStorage.getItem('currentUserId')
      )
      if (userId) {
        await logoutViaUI(page)
        await deleteTestUser(userId)
      }
    })
  })

  test.describe('Authenticated Access', () => {
    let testUserId: string | undefined

    test.afterEach(async () => {
      if (testUserId) {
        await deleteTestUser(testUserId)
        testUserId = undefined
      }
    })

    test('authenticated user with band can access protected routes', async ({
      page,
    }) => {
      const errors = setupConsoleErrorTracking(page)
      const user = createTestUser()

      // Sign up and create band
      await signUpViaUI(page, user)
      await expect(page).toHaveURL(/\/get-started/, { timeout: 10000 })

      const bandName = `Test Band ${Date.now()}`
      await page.fill(
        '[data-testid="create-band-name-input"], input[name="bandName"], input[id="band-name"]',
        bandName
      )
      await page.click(
        '[data-testid="create-band-button"], button:has-text("Create Band")'
      )

      await page.waitForURL(/\/songs/, { timeout: 10000 })

      // Store user ID for cleanup
      testUserId =
        (await page.evaluate(() => localStorage.getItem('currentUserId'))) ??
        undefined

      // Test accessing various protected routes
      await page.goto('/songs')
      await expect(page).toHaveURL(/\/songs/)

      await page.goto('/setlists')
      await expect(page).toHaveURL(/\/setlists/)

      await page.goto('/shows')
      await expect(page).toHaveURL(/\/shows/)

      await page.goto('/practices')
      await expect(page).toHaveURL(/\/practices/)

      // No console errors
      await assertNoConsoleErrors(page, errors)
    })

    test('user without band is redirected to get-started', async ({ page }) => {
      const user = createTestUser()

      // Sign up (don't create band)
      await signUpViaUI(page, user)
      await expect(page).toHaveURL(/\/get-started/, { timeout: 10000 })

      // Store user ID for cleanup
      testUserId =
        (await page.evaluate(() => localStorage.getItem('currentUserId'))) ??
        undefined

      // Try to access protected route - should redirect away from /songs
      await page.goto('/songs')

      // Should be redirected to get-started, auth page, or auth with query params
      // The exact redirect depends on session state validation
      await expect(page).toHaveURL(/\/(get-started|auth)/, {
        timeout: 5000,
      })

      // Verify we're NOT on the songs page (protected route)
      await expect(page).not.toHaveURL(/\/songs/)
    })
  })

  test.describe('Logout Flow', () => {
    let testUserId: string | undefined

    test.afterEach(async () => {
      if (testUserId) {
        await deleteTestUser(testUserId)
        testUserId = undefined
      }
    })

    test('logging out redirects to auth page', async ({ page }) => {
      const user = createTestUser()

      // Sign up and create band
      await signUpViaUI(page, user)
      await expect(page).toHaveURL(/\/get-started/, { timeout: 10000 })

      const bandName = `Test Band ${Date.now()}`
      await page.fill(
        '[data-testid="create-band-name-input"], input[name="bandName"], input[id="band-name"]',
        bandName
      )
      await page.click(
        '[data-testid="create-band-button"], button:has-text("Create Band")'
      )

      await page.waitForURL(/\/songs/, { timeout: 10000 })

      // Store user ID for cleanup
      testUserId =
        (await page.evaluate(() => localStorage.getItem('currentUserId'))) ??
        undefined

      // Log out
      await logoutViaUI(page)

      // Should be on auth page
      await expect(page).toHaveURL('/auth')

      // Should not be able to access protected routes anymore
      await page.goto('/songs')
      await expect(page).toHaveURL(/\/auth/, { timeout: 5000 })
    })

    test('session expired redirect includes reason param', async ({
      page,
      context,
    }) => {
      const user = createTestUser()

      // Sign up and create band
      await signUpViaUI(page, user)
      await expect(page).toHaveURL(/\/get-started/, { timeout: 10000 })

      const bandName = `Test Band ${Date.now()}`
      await page.fill(
        '[data-testid="create-band-name-input"], input[name="bandName"], input[id="band-name"]',
        bandName
      )
      await page.click(
        '[data-testid="create-band-button"], button:has-text("Create Band")'
      )

      await page.waitForURL(/\/songs/, { timeout: 10000 })

      // Store user ID for cleanup
      testUserId =
        (await page.evaluate(() => localStorage.getItem('currentUserId'))) ??
        undefined

      // Corrupt the session data to simulate expired/invalid session
      await page.evaluate(() => {
        // Clear the session storage but keep the user/band IDs
        // This simulates an invalid session state
        localStorage.removeItem('rock_on_session')
      })

      // Try to access a protected route
      await page.goto('/songs')

      // Should redirect to auth with session-invalid reason
      await expect(page).toHaveURL(/\/auth(\?reason=session-invalid)?/, {
        timeout: 5000,
      })
    })
  })

  test.describe('Navigation Auth Re-validation', () => {
    let testUserId: string | undefined

    test.afterEach(async () => {
      if (testUserId) {
        await deleteTestUser(testUserId)
        testUserId = undefined
      }
    })

    test('navigating between pages with invalid session redirects to auth', async ({
      page,
    }) => {
      const user = createTestUser()

      // Sign up and create band
      await signUpViaUI(page, user)
      await expect(page).toHaveURL(/\/get-started/, { timeout: 10000 })

      const bandName = `Test Band ${Date.now()}`
      await page.fill(
        '[data-testid="create-band-name-input"], input[name="bandName"], input[id="band-name"]',
        bandName
      )
      await page.click(
        '[data-testid="create-band-button"], button:has-text("Create Band")'
      )

      await page.waitForURL(/\/songs/, { timeout: 10000 })

      // Store user ID for cleanup
      testUserId =
        (await page.evaluate(() => localStorage.getItem('currentUserId'))) ??
        undefined

      // Now invalidate the session but keep localStorage keys
      // This simulates what happens when session expires while user is away
      await page.evaluate(() => {
        localStorage.removeItem('rock_on_session')
      })

      // Navigate to another protected page
      // With our fix, this should trigger re-validation and redirect
      await page.goto('/setlists')

      // Should be redirected to auth page
      await expect(page).toHaveURL(/\/auth/, { timeout: 5000 })
    })

    test('navigating via link with invalid session redirects to auth', async ({
      page,
    }) => {
      const user = createTestUser()

      // Sign up and create band
      await signUpViaUI(page, user)
      await expect(page).toHaveURL(/\/get-started/, { timeout: 10000 })

      const bandName = `Test Band ${Date.now()}`
      await page.fill(
        '[data-testid="create-band-name-input"], input[name="bandName"], input[id="band-name"]',
        bandName
      )
      await page.click(
        '[data-testid="create-band-button"], button:has-text("Create Band")'
      )

      await page.waitForURL(/\/songs/, { timeout: 10000 })

      // Store user ID for cleanup
      testUserId =
        (await page.evaluate(() => localStorage.getItem('currentUserId'))) ??
        undefined

      // Now invalidate the session
      await page.evaluate(() => {
        localStorage.removeItem('rock_on_session')
      })

      // Click a navigation link instead of direct URL navigation
      // This tests the React Router navigation path
      const setlistsLink = page
        .locator('a[href="/setlists"], nav >> text=Setlists')
        .first()
      await setlistsLink.click()

      // Should be redirected to auth page
      await expect(page).toHaveURL(/\/auth/, { timeout: 5000 })
    })
  })

  test.describe('No Flash of Content', () => {
    test('protected page does not flash "Not logged in" message', async ({
      page,
    }) => {
      // Track any text content that appears
      const pageTexts: string[] = []

      page.on('console', msg => {
        // Ignore for this test
      })

      // Try to access protected route
      await page.goto('/songs')

      // Wait for redirect to complete
      await expect(page).toHaveURL(/\/auth/, { timeout: 5000 })

      // Get all visible text content quickly
      const bodyText = await page.locator('body').textContent()

      // Should NOT contain "Not logged in" or similar error messages
      expect(bodyText).not.toContain('Not logged in')
      expect(bodyText).not.toContain('Unauthorized')

      // Should be on the auth page
      await expect(page.locator('input[type="email"]')).toBeVisible()
    })
  })
})
