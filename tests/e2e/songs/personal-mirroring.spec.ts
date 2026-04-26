/**
 * E2E tests for personal-catalog mirroring features.
 *
 * Covers:
 * - Tab explainer text under the Band Songs / My Songs switcher
 * - "Also save to my personal catalog" checkbox in EditSongModal add mode
 *   (band tab only — personal songs already live in the personal catalog)
 * - Chain-icon indicator on linked songs (band side after mirror,
 *   personal side after copy-to-personal)
 *
 * Underlying data flow goes through SongLinkingService.copyBandSongToPersonal,
 * which links the two records via songGroupId + linkedFromSongId.
 */
import { test, expect, Page } from '@playwright/test'
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function switchToPersonalTab(page: Page) {
  const tab = page.locator('[data-testid="songs-personal-tab"]')
  await expect(tab).toBeVisible({ timeout: 5000 })
  await tab.click()
  await page.waitForTimeout(300)
}

async function switchToBandTab(page: Page) {
  const tab = page.locator('[data-testid="songs-band-tab"]')
  await expect(tab).toBeVisible({ timeout: 5000 })
  await tab.click()
  await page.waitForTimeout(300)
}

/**
 * Create a band song via the modal. Optionally tick the "also save to my
 * personal catalog" checkbox before submitting. Waits for the modal to
 * actually close (the also-save-to-personal flow takes longer than a
 * fixed timeout reliably covers).
 */
async function addBandSong(
  page: Page,
  title: string,
  options: { artist?: string; alsoSaveToPersonal?: boolean } = {}
) {
  const { artist = 'Test Artist', alsoSaveToPersonal = false } = options

  const addButton = page
    .locator('button:has-text("Add Song"), [data-testid="add-song-button"]')
    .first()
  await expect(addButton).toBeVisible({ timeout: 5000 })
  await addButton.click()
  await expect(page.locator('[data-testid="song-title-input"]')).toBeVisible({
    timeout: 5000,
  })

  await page.locator('[data-testid="song-title-input"]').fill(title)
  await page.locator('[data-testid="song-artist-input"]').fill(artist)

  await page.locator('[data-testid="song-key-button"]').click()
  await page.locator('[data-testid="key-picker-C"]').click()
  await page.locator('[data-testid="key-picker-confirm"]').click()
  // Key picker modal closes; wait for the song form to be interactive again.
  await expect(page.locator('[data-testid="song-key-button"]')).toBeVisible({
    timeout: 3000,
  })

  if (alsoSaveToPersonal) {
    await page
      .locator('[data-testid="song-also-save-personal-checkbox"]')
      .check()
  }

  await page.locator('[data-testid="song-submit-button"]').click()

  // Wait for the modal to close (signals the save+mirror flow completed).
  // The mirror flow is async (createSong → copyBandSongToPersonal →
  // refetch x2), so a fixed timeout can race; assert disappearance.
  await expect(page.locator('[data-testid="song-title-input"]')).toHaveCount(
    0,
    { timeout: 10000 }
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Tab explainer caption', () => {
  let testUserId: string | undefined

  test.afterEach(async () => {
    if (testUserId) {
      await deleteTestUser(testUserId)
      testUserId = undefined
    }
  })

  test('explainer text changes when switching between Band Songs and My Songs', async ({
    page,
  }) => {
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Explainer Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    const explainer = page.locator('[data-testid="songs-tab-explainer"]')
    await expect(explainer).toBeVisible({ timeout: 5000 })

    // Default = Band tab.
    await expect(explainer).toContainText(/shared with your band/i)

    // Switch to personal — caption updates.
    await switchToPersonalTab(page)
    await expect(explainer).toContainText(/visible only to you/i)

    // Back to band — original caption returns.
    await switchToBandTab(page)
    await expect(explainer).toContainText(/shared with your band/i)
  })
})

test.describe('Also save to my personal catalog (add mode)', () => {
  let testUserId: string | undefined

  test.afterEach(async () => {
    if (testUserId) {
      await deleteTestUser(testUserId)
      testUserId = undefined
    }
  })

  test('checkbox is shown in band-tab add mode but hidden in personal-tab add mode', async ({
    page,
  }) => {
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Checkbox Visibility Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    // Band tab — open add modal, checkbox should be present.
    const addButton = page
      .locator('button:has-text("Add Song"), [data-testid="add-song-button"]')
      .first()
    await addButton.click()
    await expect(page.locator('[data-testid="song-title-input"]')).toBeVisible({
      timeout: 5000,
    })
    await expect(
      page.locator('[data-testid="song-also-save-personal-checkbox"]')
    ).toBeVisible({ timeout: 3000 })

    // Close the modal explicitly via its close button.
    await page.locator('[data-testid="edit-song-modal-close"]').click()
    await expect(page.locator('[data-testid="song-title-input"]')).toHaveCount(
      0,
      { timeout: 5000 }
    )

    // Switch to personal tab and reopen — checkbox must NOT be present.
    await switchToPersonalTab(page)
    await page.locator('[data-testid="add-song-button"]').first().click()
    await expect(page.locator('[data-testid="song-title-input"]')).toBeVisible({
      timeout: 5000,
    })
    await expect(
      page.locator('[data-testid="song-also-save-personal-checkbox"]')
    ).toHaveCount(0)
  })

  test('checking the box creates a linked copy in the personal catalog', async ({
    page,
  }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Mirror Add Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    const songTitle = `Mirrored Song ${Date.now()}`
    await addBandSong(page, songTitle, {
      artist: 'Mirror Band',
      alsoSaveToPersonal: true,
    })

    // Verify the song shows up on the band tab AND has the chain icon.
    await expect(page.locator(`text=${songTitle}`).first()).toBeVisible({
      timeout: 5000,
    })

    // Switch to personal tab — the mirrored copy should be there.
    await switchToPersonalTab(page)
    await expect(page.locator(`text=${songTitle}`).first()).toBeVisible({
      timeout: 5000,
    })

    await assertNoConsoleErrors(page, errors)
  })

  test('leaving the box unchecked does NOT create a personal copy', async ({
    page,
  }) => {
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `No Mirror Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    const songTitle = `Solo Band Song ${Date.now()}`
    await addBandSong(page, songTitle, {
      artist: 'Solo Band',
      alsoSaveToPersonal: false,
    })

    // Band tab has the song.
    await expect(page.locator(`text=${songTitle}`).first()).toBeVisible({
      timeout: 5000,
    })

    // Personal tab does not.
    await switchToPersonalTab(page)
    await expect(page.locator(`text=${songTitle}`)).toHaveCount(0)
  })
})

test.describe('Chain-icon indicator on linked songs', () => {
  let testUserId: string | undefined

  test.afterEach(async () => {
    if (testUserId) {
      await deleteTestUser(testUserId)
      testUserId = undefined
    }
  })

  test('mirrored band song shows chain icon on the band tab AND on the personal tab', async ({
    page,
  }) => {
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Chain Icon Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    // Use :visible to scope counts to the active responsive view —
    // SongRow (desktop) and SongCard (mobile) both render in the DOM
    // with CSS display rules, so a raw count would always double.
    const visibleLinkIcons = page.locator(
      '[data-testid="song-linked-indicator"]:visible'
    )

    // Add an UNMIRRORED song first — should NOT show the chain icon.
    await addBandSong(page, 'Unmirrored Song', {
      artist: 'Solo Artist',
      alsoSaveToPersonal: false,
    })
    await expect(visibleLinkIcons).toHaveCount(0)

    // Now add a mirrored song — chain icon should appear on the band side.
    await addBandSong(page, 'Mirrored Song', {
      artist: 'Mirrored Artist',
      alsoSaveToPersonal: true,
    })

    // Exactly one chain icon visible (the mirrored band song).
    await expect(visibleLinkIcons).toHaveCount(1, { timeout: 5000 })

    // Switch to personal tab — the personal copy also gets the chain icon.
    await switchToPersonalTab(page)
    await expect(visibleLinkIcons).toHaveCount(1, { timeout: 5000 })
  })

  test('chain icon appears after using "Copy to My Songs" from the band kebab menu', async ({
    page,
  }) => {
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Copy Action Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    const visibleLinkIcons = page.locator(
      '[data-testid="song-linked-indicator"]:visible'
    )

    // Create a band song with the checkbox unchecked.
    await addBandSong(page, 'Copy Target Song', {
      artist: 'Target Artist',
      alsoSaveToPersonal: false,
    })

    // Initially no chain icon.
    await expect(visibleLinkIcons).toHaveCount(0)

    // Open kebab menu, click "Copy to My Songs".
    await page
      .locator('[data-testid="song-actions-menu-button"]')
      .first()
      .click()
    await page
      .locator('[data-testid="copy-to-personal-button"]')
      .first()
      .click()

    // Chain icon appears on the band-tab row now that it has a personal copy.
    await expect(visibleLinkIcons).toHaveCount(1, { timeout: 5000 })
  })
})
