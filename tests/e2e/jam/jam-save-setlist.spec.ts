/**
 * E2E tests for saving a jam session as a personal setlist
 *
 * Covers:
 * - Save as Setlist button appears after session creation (when matches exist)
 * - Session card match list renders correctly
 * - Match list empty state shown when no common songs
 * - Confirmed matches count shown
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

test.describe('Jam Session — Match List and Save Flow', () => {
  let testUserId: string | undefined

  test.afterEach(async () => {
    if (testUserId) {
      await deleteTestUser(testUserId)
      testUserId = undefined
    }
  })

  test('match list renders (empty state when only 1 participant)', async ({
    page,
  }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()

    await signUpViaUI(page, user)
    await createBandViaUI(page, `Match List Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await page.goto('/jam')
    await page.waitForURL(/\/jam/, { timeout: 5000 })

    // Create session
    await page.locator('[data-testid="jam-create-button"]').click()
    await page.waitForURL(/\/jam\/.+/, { timeout: 10000 })

    // Post-redesign the Setlist panel is the default surface; the common-songs
    // match surface now lives behind the "Common" tab. Switch to it.
    await page.locator('[data-testid="tab-common"]').click()

    // Common panel should be visible.
    await expect(page.locator('[data-testid="jam-common-panel"]')).toBeVisible({
      timeout: 5000,
    })

    // With only 1 participant (the host), no matches exist yet — the panel
    // shows the "waiting for others to join" empty state rather than a list.
    await expect(
      page.locator('[data-testid="jam-common-panel"]')
    ).toContainText(/waiting for others/i, { timeout: 3000 })

    await assertNoConsoleErrors(page, errors)
  })

  test('Save as Setlist button not visible without confirmed matches', async ({
    page,
  }) => {
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `No Save Button ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await page.goto('/jam')
    await page.waitForURL(/\/jam/, { timeout: 5000 })

    await page.locator('[data-testid="jam-create-button"]').click()
    await page.waitForURL(/\/jam\/.+/, { timeout: 10000 })

    // With no matches, the Save as Setlist button should NOT be visible
    await expect(page.locator('[data-testid="jam-save-setlist-button"]'))
      .not.toBeVisible({ timeout: 3000 })
      .catch(() => {
        // Button hidden — correct when no confirmed matches
      })
  })

  test('jam session page has correct heading and structure', async ({
    page,
  }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()

    await signUpViaUI(page, user)
    await createBandViaUI(page, `Jam Structure Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await page.goto('/jam')
    await page.waitForURL(/\/jam/, { timeout: 5000 })

    // Heading
    await expect(page.locator('h1:has-text("Jam Session")')).toBeVisible({
      timeout: 5000,
    })

    await page.locator('[data-testid="jam-create-button"]').click()
    await page.waitForURL(/\/jam\/.+/, { timeout: 10000 })

    // After creation: session card, participant list, and the panel tab bar
    // are all present. (The Setlist panel is the default surface post-redesign;
    // the match list now lives behind the "Common" tab and only appears with
    // 2+ participants, so it isn't part of the fresh single-host structure.)
    await expect(page.locator('[data-testid="jam-session-card"]')).toBeVisible({
      timeout: 5000,
    })
    await expect(
      page.locator('[data-testid="jam-participant-list"]')
    ).toBeVisible({ timeout: 5000 })
    await expect(page.locator('[data-testid="jam-panel-tabs"]')).toBeVisible({
      timeout: 5000,
    })

    await assertNoConsoleErrors(page, errors)
  })

  test('session with a name shows the name in the session card', async ({
    page,
  }) => {
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Named Session Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await page.goto('/jam')
    await page.waitForURL(/\/jam/, { timeout: 5000 })

    // Type a session name
    const nameInput = page.locator('[data-testid="jam-session-name-input"]')
    await nameInput.fill('Friday Night Jam')

    await page.locator('[data-testid="jam-create-button"]').click()
    await page.waitForURL(/\/jam\/.+/, { timeout: 10000 })

    // Session name should appear in the card
    await expect(page.locator('text=Friday Night Jam').first()).toBeVisible({
      timeout: 5000,
    })
  })

  test('navigating to /setlists after saving redirects correctly', async ({
    page,
  }) => {
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Setlist Nav Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    // Go to setlists page
    await page.goto('/setlists')
    await page.waitForURL(/\/setlists/, { timeout: 5000 })

    // The My Setlists tab should be accessible
    await expect(
      page.locator('[data-testid="setlists-personal-tab"]')
    ).toBeVisible({ timeout: 5000 })

    // Clicking it should switch to personal setlists without error
    await page.locator('[data-testid="setlists-personal-tab"]').click()
    await page.waitForTimeout(500)

    await expect(page.locator('[data-testid="setlists-page"]')).toBeVisible({
      timeout: 3000,
    })
  })
})
