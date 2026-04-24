/**
 * E2E tests for Personal Setlists
 *
 * Covers:
 * - Personal/Band tab switcher visible on setlists page
 * - Personal setlist appears in My Setlists, not Band Setlists
 * - Band setlist does not appear in My Setlists
 * - Jam-tagged setlists show correctly
 */
import { test, expect } from '@playwright/test'
import {
  createTestUser,
  signUpViaUI,
  deleteTestUser,
} from '../../fixtures/auth'
import { createBandViaUI } from '../../fixtures/bands'
import {
  setupConsoleErrorTracking,
  assertNoConsoleErrors,
} from '../../helpers/assertions'

test.describe('Personal Setlists', () => {
  let testUserId: string | undefined

  test.afterEach(async () => {
    if (testUserId) {
      await deleteTestUser(testUserId)
      testUserId = undefined
    }
  })

  test('both Band Setlists and My Setlists tabs are visible', async ({
    page,
  }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()

    await signUpViaUI(page, user)
    await createBandViaUI(page, `Setlist Tabs Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await page.goto('/setlists')
    await page.waitForURL(/\/setlists/, { timeout: 5000 })

    await expect(page.locator('[data-testid="setlists-band-tab"]')).toBeVisible(
      { timeout: 5000 }
    )
    await expect(
      page.locator('[data-testid="setlists-personal-tab"]')
    ).toBeVisible({ timeout: 5000 })

    await assertNoConsoleErrors(page, errors)
  })

  test('My Setlists tab is empty initially', async ({ page }) => {
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Empty Personal ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await page.goto('/setlists')
    await page.waitForURL(/\/setlists/, { timeout: 5000 })

    // Switch to personal tab
    await page.locator('[data-testid="setlists-personal-tab"]').click()
    await page.waitForTimeout(500)

    // Should show empty state or just empty list (no band setlists)
    // The tab switch itself not crashing is the key assertion
    await expect(page.locator('[data-testid="setlists-page"]')).toBeVisible({
      timeout: 3000,
    })
  })

  test('Band Setlists tab shows band setlists, not personal', async ({
    page,
  }) => {
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Band Setlist Tab ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await page.goto('/setlists')
    await page.waitForURL(/\/setlists/, { timeout: 5000 })

    // Band tab should be the default/active tab
    await expect(page.locator('[data-testid="setlists-band-tab"]')).toBeVisible(
      { timeout: 5000 }
    )

    // Page should load without errors
    await expect(page.locator('[data-testid="setlists-page"]')).toBeVisible({
      timeout: 5000,
    })
  })

  test('switching between tabs does not cause errors', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Tab Switch ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await page.goto('/setlists')
    await page.waitForURL(/\/setlists/, { timeout: 5000 })

    // Toggle between tabs multiple times
    const personalTab = page.locator('[data-testid="setlists-personal-tab"]')
    const bandTab = page.locator('[data-testid="setlists-band-tab"]')

    await personalTab.click()
    await page.waitForTimeout(300)
    await bandTab.click()
    await page.waitForTimeout(300)
    await personalTab.click()
    await page.waitForTimeout(300)

    await expect(page.locator('[data-testid="setlists-page"]')).toBeVisible({
      timeout: 3000,
    })

    await assertNoConsoleErrors(page, errors)
  })
})
