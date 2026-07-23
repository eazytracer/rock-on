/**
 * E2E — Sign out works even when the network sign-out hangs.
 *
 * Regression lock for the production "stuck, must purge cache" state: a hung
 * `supabase.auth.signOut()` used to leave the user trapped because the local
 * session clear was gated behind the network call. signOut now clears local
 * state first and dispatches `auth-logout`, so the route guard redirects to
 * /auth regardless of the network. Here we stall the Supabase logout endpoint
 * and assert the user still lands on /auth.
 *
 * Forces a desktop-width viewport so the sidebar Sign Out control (hidden below
 * the md breakpoint) is present across projects.
 */
import { test, expect } from '@playwright/test'
import {
  createTestUser,
  signUpViaUI,
  deleteTestUser,
} from '../../fixtures/auth'
import { createBandViaUI } from '../../fixtures/bands'

test.use({ viewport: { width: 1280, height: 800 } })

test.describe('Sign out — recovery under a dead network', () => {
  let testUserId: string | undefined

  test.afterEach(async ({ page }) => {
    if (!testUserId) {
      testUserId =
        (await page.evaluate(() => localStorage.getItem('currentUserId'))) ??
        undefined
    }
    if (testUserId) {
      await deleteTestUser(testUserId)
      testUserId = undefined
    }
  })

  test('signing out redirects to /auth even when the logout request hangs', async ({
    page,
  }) => {
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Signout Recovery Band ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })
    testUserId =
      (await page.evaluate(() => localStorage.getItem('currentUserId'))) ??
      undefined

    // Stall the Supabase sign-out endpoint indefinitely — models a degraded
    // network. The handler never fulfills, so the request stays pending.
    await page.route('**/auth/v1/logout**', () => {
      /* intentionally never resolved */
    })

    await page.click('[data-testid="logout-button"]')

    // Local-first sign-out must redirect to /auth without waiting on the network.
    await page.waitForURL(/\/auth/, { timeout: 8000 })
    expect(
      await page.evaluate(() => localStorage.getItem('currentUserId'))
    ).toBeNull()
  })
})
