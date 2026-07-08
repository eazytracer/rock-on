/**
 * E2E — Friends find-by-name search (mobile-redesign-port, spec 19 / FLOW 10)
 *
 * A discoverable person is surfaced by a name search and can be sent a request;
 * the row then reflects the pending state. Hidden profiles never appear.
 */

import { test, expect } from '@playwright/test'
import {
  createTestUser,
  createTestUserInDB,
  deleteTestUser,
} from '../../fixtures/auth'
import { clearTestData } from '../../fixtures/database'
import { getSupabaseAdmin } from '../../fixtures/supabase'

test.describe('Friends — find by name', () => {
  let target: { email: string; password: string; name: string; id: string }
  // Unique per test so a prior test's (or run's) leftover discoverable user
  // can never collide with this test's exact-name search.
  let targetName: string

  test.beforeEach(async ({ page }) => {
    await clearTestData()

    // Seed a second user and make them discoverable by name.
    targetName = `Zoe Searchtarget ${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`
    const seed = createTestUser({ name: targetName })
    target = await createTestUserInDB(seed)
    const admin = await getSupabaseAdmin()
    const { error } = await admin.from('user_profiles').upsert(
      {
        user_id: target.id,
        display_name: targetName,
        discoverable: true,
      },
      { onConflict: 'user_id' }
    )
    if (error) throw new Error(`seed profile failed: ${error.message}`)

    // Sign up the primary user via UI and create a band to reach protected pages.
    const me = createTestUser()
    await page.goto('/auth')
    await page.waitForSelector(
      'button:has-text("Log In"), button:has-text("Create Account")',
      { state: 'visible', timeout: 10000 }
    )
    const logInButton = page.locator('button:has-text("Log In")')
    if (await logInButton.isVisible()) {
      await page.click('button:has-text("Don\'t have an account")')
      await page.waitForSelector('[data-testid="signup-name-input"]', {
        state: 'visible',
        timeout: 5000,
      })
    }
    await page.fill('[data-testid="signup-name-input"]', me.name)
    await page.fill('[data-testid="signup-email-input"]', me.email)
    await page.fill('[data-testid="signup-password-input"]', me.password)
    await page.fill(
      '[data-testid="signup-confirm-password-input"]',
      me.password
    )
    await page.click('button[type="submit"]:has-text("Create Account")')
    await page.waitForURL(/\/get-started/, { timeout: 10000 })
    await page.fill(
      '[data-testid="create-band-name-input"]',
      `Friends Test Band ${Date.now()}`
    )
    await page.click('[data-testid="create-band-button"]')
    await page.waitForURL(/\/songs/, { timeout: 10000 })
  })

  test.afterEach(async () => {
    if (target?.id) await deleteTestUser(target.id)
  })

  test('finds a discoverable person by name and sends a request', async ({
    page,
  }) => {
    await page.goto('/friends')
    await expect(page.getByTestId('friends-page')).toBeVisible()

    // Type a name fragment; the debounced search surfaces the discoverable user.
    await page.fill('[data-testid="friends-search-input"]', targetName)
    const result = page.getByTestId(`friend-search-${target.id}`)
    await expect(result).toBeVisible({ timeout: 5000 })
    await expect(result).toContainText(targetName)

    // Send the request → the row flips to "Sent" and a success toast appears.
    await page.click(`[data-testid="friend-search-add-${target.id}"]`)
    await expect(result).toContainText('Sent', { timeout: 5000 })
    await expect(page.getByTestId('friends-outgoing')).toContainText(targetName)
  })

  test('a short query shows no results panel', async ({ page }) => {
    await page.goto('/friends')
    await page.fill('[data-testid="friends-search-input"]', 'Z')
    await expect(page.getByTestId('friends-search-results')).toHaveCount(0)
  })

  test('a non-discoverable name is not found', async ({ page }) => {
    // Hide the target, then search — nothing should surface.
    const admin = await getSupabaseAdmin()
    await admin
      .from('user_profiles')
      .update({ discoverable: false })
      .eq('user_id', target.id)

    await page.goto('/friends')
    await page.fill('[data-testid="friends-search-input"]', targetName)
    await expect(page.getByTestId('friends-search-results')).toContainText(
      'No discoverable people found.',
      { timeout: 5000 }
    )
  })
})
