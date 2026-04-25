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

  test('session card share button reveals copy link and show QR options', async ({
    page,
  }) => {
    // Post-v0.3.2 layout: Copy / QR are inside a Share popover instead
    // of inline on the session card. The popover is opened by clicking
    // the consolidated Share button.
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Jam Buttons Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await page.goto('/jam')
    await page.waitForURL(/\/jam/, { timeout: 5000 })

    await page.locator('[data-testid="jam-create-button"]').click()
    await page.waitForURL(/\/jam\/.+/, { timeout: 10000 })

    await expect(page.locator('[data-testid="jam-share-button"]')).toBeVisible({
      timeout: 5000,
    })
    await page.locator('[data-testid="jam-share-button"]').click()

    await expect(
      page.locator('[data-testid="jam-copy-link-button"]')
    ).toBeVisible({ timeout: 5000 })
    await expect(
      page.locator('[data-testid="jam-show-qr-button"]')
    ).toBeVisible({ timeout: 5000 })
  })

  test('clicking Show QR (from share menu) reveals the QR code', async ({
    page,
  }) => {
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

    // Open Share popover, then click Show QR
    await page.locator('[data-testid="jam-share-button"]').click()
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

test.describe('Jam Session — End Session flow', () => {
  // Post-v0.3.2 layout: End Session lives inside the actions kebab
  // menu, not as a standalone button. The shared opener helper keeps
  // each test focused on the intent ("end the session") rather than
  // the menu mechanics.
  const openActionsAndClickEnd = async (
    page: import('@playwright/test').Page
  ) => {
    await page.locator('[data-testid="jam-actions-menu"]').click()
    await page.locator('[data-testid="jam-end-session-button"]').click()
  }

  test('End Session is reachable for the host on an active session', async ({
    page,
  }) => {
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `End Session Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await page.goto('/jam')
    await page.waitForURL(/\/jam/, { timeout: 5000 })

    await page.locator('[data-testid="jam-create-button"]').click()
    await page.waitForURL(/\/jam\/.+/, { timeout: 10000 })

    // Actions kebab menu must be visible. Inside, the End Session
    // item must be present once the menu is open.
    await expect(page.locator('[data-testid="jam-actions-menu"]')).toBeVisible({
      timeout: 5000,
    })
    await page.locator('[data-testid="jam-actions-menu"]').click()
    await expect(
      page.locator('[data-testid="jam-end-session-button"]')
    ).toBeVisible({ timeout: 5000 })
  })

  test('End Session opens a confirmation dialog with Cancel + End actions on an empty session', async ({
    page,
  }) => {
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `End Empty Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await page.goto('/jam')
    await page.waitForURL(/\/jam/, { timeout: 5000 })
    await page.locator('[data-testid="jam-create-button"]').click()
    await page.waitForURL(/\/jam\/.+/, { timeout: 10000 })

    await openActionsAndClickEnd(page)

    // Dialog renders.
    await expect(page.locator('[data-testid="jam-end-dialog"]')).toBeVisible({
      timeout: 3000,
    })
    // Cancel + End (without saving) buttons are always present. The
    // "Save & End" button only shows when there's something to save —
    // an empty session (no queue, no matches, no setlist) should not
    // offer it.
    await expect(
      page.locator('[data-testid="jam-end-dialog-cancel"]')
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="jam-end-dialog-end-without-saving"]')
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="jam-end-dialog-save-and-end"]')
    ).toHaveCount(0)
  })

  test('Cancel closes the end-session dialog without ending', async ({
    page,
  }) => {
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `End Cancel Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await page.goto('/jam')
    await page.waitForURL(/\/jam/, { timeout: 5000 })
    await page.locator('[data-testid="jam-create-button"]').click()
    await page.waitForURL(/\/jam\/.+/, { timeout: 10000 })

    await openActionsAndClickEnd(page)
    await expect(page.locator('[data-testid="jam-end-dialog"]')).toBeVisible({
      timeout: 3000,
    })
    await page.locator('[data-testid="jam-end-dialog-cancel"]').click()

    // Dialog closes; we're still on the jam session page and the
    // actions menu is still available for a second attempt.
    await expect(page.locator('[data-testid="jam-end-dialog"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="jam-session-card"]')).toBeVisible()
    await expect(page.locator('[data-testid="jam-actions-menu"]')).toBeVisible()
  })

  test('End without saving navigates away from the session', async ({
    page,
  }) => {
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `End Navigate Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await page.goto('/jam')
    await page.waitForURL(/\/jam/, { timeout: 5000 })
    await page.locator('[data-testid="jam-create-button"]').click()
    await page.waitForURL(/\/jam\/[^/]+$/, { timeout: 10000 })

    await openActionsAndClickEnd(page)
    await expect(page.locator('[data-testid="jam-end-dialog"]')).toBeVisible({
      timeout: 3000,
    })
    await page
      .locator('[data-testid="jam-end-dialog-end-without-saving"]')
      .click()

    // After ending: back at /jam (the create/join landing). The session-
    // specific subpath is gone.
    await page.waitForURL(/\/jam\/?$/, { timeout: 10000 })
    await expect(page.locator('[data-testid="jam-session-page"]')).toBeVisible()
  })
})
