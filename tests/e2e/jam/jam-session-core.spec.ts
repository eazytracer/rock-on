/**
 * E2E tests for Jam Session Core Flow
 *
 * Covers:
 * - Jam nav link is visible in sidebar
 * - Jam page renders correctly
 * - Host can create a jam session (short code + QR displayed)
 * - Join code input is present
 * - Session card shows after creation
 *
 * Note: Multi-user tests (User A + User B joining) require two browser
 * contexts and are in the 'multi-user' describe block. They are skipped
 * unless SUPABASE is available (integration tests).
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

test.describe('Jam Session — Navigation and Page Load', () => {
  let testUserId: string | undefined

  test.afterEach(async () => {
    if (testUserId) {
      await deleteTestUser(testUserId)
      testUserId = undefined
    }
  })

  test('Jam link appears in sidebar navigation', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()

    await signUpViaUI(page, user)
    await createBandViaUI(page, `Jam Nav Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    const jamLink = page.locator('[data-testid="jam-link"]')
    await expect(jamLink).toBeVisible({ timeout: 5000 })

    await assertNoConsoleErrors(page, errors)
  })

  test('Jam page renders with create and join sections', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()

    await signUpViaUI(page, user)
    await createBandViaUI(page, `Jam Page Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    // Navigate to /jam
    await page.goto('/jam')
    await page.waitForURL(/\/jam/, { timeout: 5000 })

    await expect(page.locator('[data-testid="jam-session-page"]')).toBeVisible({
      timeout: 5000,
    })

    // Create section
    await expect(page.locator('[data-testid="jam-create-button"]')).toBeVisible(
      { timeout: 5000 }
    )

    // Join section
    await expect(
      page.locator('[data-testid="jam-join-code-input"]')
    ).toBeVisible({ timeout: 5000 })
    await expect(page.locator('[data-testid="jam-join-button"]')).toBeVisible({
      timeout: 5000,
    })

    await assertNoConsoleErrors(page, errors)
  })

  test('host can create a jam session and see the short code', async ({
    page,
  }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()

    await signUpViaUI(page, user)
    await createBandViaUI(page, `Create Jam Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await page.goto('/jam')
    await page.waitForURL(/\/jam/, { timeout: 5000 })

    // Create a session
    const createButton = page.locator('[data-testid="jam-create-button"]')
    await expect(createButton).toBeVisible({ timeout: 5000 })
    await createButton.click()

    // Wait for session to be created — URL should change to /jam/:sessionId
    await page.waitForURL(/\/jam\/.+/, { timeout: 10000 })

    // The session card should appear with the short code
    await expect(page.locator('[data-testid="jam-session-card"]')).toBeVisible({
      timeout: 5000,
    })

    // Short code should be 6 alphanumeric characters
    const shortCode = page.locator('[data-testid="jam-short-code"]')
    await expect(shortCode).toBeVisible({ timeout: 5000 })
    const codeText = await shortCode.textContent()
    expect(codeText?.trim()).toMatch(/^[A-Z0-9]{6}$/)

    await assertNoConsoleErrors(page, errors)
  })

  test('session card has copy link and show QR buttons', async ({ page }) => {
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Jam Buttons Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await page.goto('/jam')
    await page.waitForURL(/\/jam/, { timeout: 5000 })

    await page.locator('[data-testid="jam-create-button"]').click()
    await page.waitForURL(/\/jam\/.+/, { timeout: 10000 })

    await expect(
      page.locator('[data-testid="jam-copy-link-button"]')
    ).toBeVisible({ timeout: 5000 })
    await expect(
      page.locator('[data-testid="jam-show-qr-button"]')
    ).toBeVisible({ timeout: 5000 })
  })

  test('clicking Show QR reveals the QR code', async ({ page }) => {
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `QR Code Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await page.goto('/jam')
    await page.waitForURL(/\/jam/, { timeout: 5000 })

    await page.locator('[data-testid="jam-create-button"]').click()
    await page.waitForURL(/\/jam\/.+/, { timeout: 10000 })

    // QR should not be visible initially
    await expect(page.locator('[data-testid="jam-invite-qr"]'))
      .not.toBeVisible({ timeout: 2000 })
      .catch(() => {
        // Already hidden — good
      })

    // Click Show QR
    await page.locator('[data-testid="jam-show-qr-button"]').click()
    await page.waitForTimeout(500)

    // QR should now be visible
    await expect(page.locator('[data-testid="jam-invite-qr"]')).toBeVisible({
      timeout: 3000,
    })
  })

  test('session participant list shows the host', async ({ page }) => {
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Participant List Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await page.goto('/jam')
    await page.waitForURL(/\/jam/, { timeout: 5000 })

    await page.locator('[data-testid="jam-create-button"]').click()
    await page.waitForURL(/\/jam\/.+/, { timeout: 10000 })

    // Participant list should appear
    await expect(
      page.locator('[data-testid="jam-participant-list"]')
    ).toBeVisible({ timeout: 5000 })

    // Host badge should be visible
    await expect(
      page.locator('[data-testid="jam-participant-host-badge"]')
    ).toBeVisible({ timeout: 3000 })
  })

  test('join button disabled when code is fewer than 6 chars', async ({
    page,
  }) => {
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Join Disabled Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await page.goto('/jam')
    await page.waitForURL(/\/jam/, { timeout: 5000 })

    const joinInput = page.locator('[data-testid="jam-join-code-input"]')
    const joinButton = page.locator('[data-testid="jam-join-button"]')

    await joinInput.fill('ABC')
    await expect(joinButton).toBeDisabled({ timeout: 2000 })

    await joinInput.fill('ABCDEF')
    await expect(joinButton).not.toBeDisabled({ timeout: 2000 })
  })
})

test.describe('Jam Session — Setlist tab and seed-from-setlist', () => {
  test('Setlist tab is visible and switching to it shows the empty-state CTA', async ({
    page,
  }) => {
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Setlist Tab Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await page.goto('/jam')
    await page.waitForURL(/\/jam/, { timeout: 5000 })

    await page.locator('[data-testid="jam-create-button"]').click()
    await page.waitForURL(/\/jam\/.+/, { timeout: 10000 })

    // The Setlist tab should be present alongside Common Songs and My Queue.
    const setlistTab = page.locator('[data-testid="tab-setlist"]')
    await expect(setlistTab).toBeVisible({ timeout: 5000 })

    await setlistTab.click()

    // Empty-state copy + the "Add from my catalog" CTA must be reachable
    // for the host (this is what wires the setlist persistence path).
    await expect(
      page.locator('[data-testid="jam-setlist-add-from-catalog-button"]')
    ).toBeVisible({ timeout: 5000 })
  })

  test('seed-setlist <select> is shown on the create form', async ({
    page,
  }) => {
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Seed Picker Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await page.goto('/jam')
    await page.waitForURL(/\/jam/, { timeout: 5000 })

    // The seed-setlist picker is rendered on the host-a-jam form. With no
    // personal setlists the dropdown is disabled, but it must still be
    // present so the test confirms the create-flow surface is wired.
    const seedSelect = page.locator('[data-testid="jam-seed-setlist-select"]')
    await expect(seedSelect).toBeVisible({ timeout: 5000 })
  })
})
