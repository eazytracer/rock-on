/**
 * E2E — Friends request → accept round trip.
 *
 * User A sends a friend request to a discoverable user B; B logs in, sees the
 * incoming request, accepts it, and both then appear in each other's friends
 * list. Complements find-by-name (search + send) with the recipient side.
 */

import { test, expect } from '@playwright/test'
import {
  createTestUser,
  createTestUserInDB,
  deleteTestUser,
  signUpViaUI,
  logoutViaUI,
} from '../../fixtures/auth'
import { createBandViaUI } from '../../fixtures/bands'
import { clearTestData } from '../../fixtures/database'
import { getSupabaseAdmin } from '../../fixtures/supabase'

test.describe('Friends — request and accept', () => {
  let userB: { email: string; password: string; name: string; id: string }
  let userBName: string

  test.beforeEach(async () => {
    await clearTestData()

    // Seed the recipient (User B) as a discoverable account.
    userBName = `Bianca Recipient ${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`
    userB = await createTestUserInDB(createTestUser({ name: userBName }))
    const admin = await getSupabaseAdmin()
    const { error } = await admin
      .from('user_profiles')
      .upsert(
        { user_id: userB.id, display_name: userBName, discoverable: true },
        { onConflict: 'user_id' }
      )
    if (error) throw new Error(`seed profile failed: ${error.message}`)
  })

  test.afterEach(async () => {
    if (userB?.id) await deleteTestUser(userB.id)
  })

  test("B accepts A's request and both become friends", async ({ page }) => {
    // User A signs up via UI (a band gets them into the app).
    const userA = createTestUser()
    await signUpViaUI(page, userA)
    await createBandViaUI(page, `Friends Accept Band ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    // A finds B by name and sends a request.
    await page.goto('/friends')
    await page.fill('[data-testid="friends-search-input"]', userBName)
    const result = page.getByTestId(`friend-search-${userB.id}`)
    await expect(result).toBeVisible({ timeout: 5000 })
    await page.click(`[data-testid="friend-search-add-${userB.id}"]`)
    await expect(page.getByTestId('friends-outgoing')).toContainText(userBName)

    // Switch to User B. B is band-less (seeded), so they land on the home
    // route ("/") after login — loginViaUI assumes a band, so log in inline
    // and just wait to leave the auth page.
    await logoutViaUI(page)
    await page.goto('/auth')
    await page.waitForSelector('[data-testid="login-email-input"]', {
      state: 'visible',
      timeout: 10000,
    })
    await page.fill('[data-testid="login-email-input"]', userB.email)
    await page.fill('[data-testid="login-password-input"]', userB.password)
    await page.click('button[type="submit"]:has-text("Log In")')
    await page.waitForURL(url => !url.pathname.startsWith('/auth'), {
      timeout: 10000,
    })

    // B sees the incoming request and accepts it.
    await page.goto('/friends')
    const incoming = page.getByTestId('friends-incoming')
    await expect(incoming).toContainText(userA.name, { timeout: 5000 })
    await incoming.locator('[data-testid^="friend-accept-"]').first().click()

    // A now appears in B's friends list.
    await expect(page.getByTestId('friends-list')).toContainText(userA.name, {
      timeout: 5000,
    })
  })
})
