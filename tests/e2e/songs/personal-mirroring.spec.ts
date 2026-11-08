/**
 * E2E tests for personal-catalog mirroring features.
 *
 * My Songs is the Personal context (redesign: the Band / My Songs tabs became
 * the context switcher).
 *
 * Covers:
 * - Personal banner: "N songs in your bands aren't in My Songs · Copy all"
 * - "Also add to My Songs" in the song editor's add mode (band only)
 * - Chain-icon indicator on linked songs (band side after mirror,
 *   personal side after copy-to-personal)
 *
 * Copies go through the copy_band_songs_to_personal RPC, which links the two
 * records via linked_from_song_id.
 */
import { test, expect, Page } from '@playwright/test'
import {
  createTestUser,
  signUpViaUI,
  deleteTestUser,
} from '../../fixtures/auth'
import { createBandViaUI, switchContextViaUI } from '../../fixtures/bands'
import {
  setupConsoleErrorTracking,
  assertNoConsoleErrors,
} from '../../helpers/assertions'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function switchToPersonal(page: Page) {
  await switchContextViaUI(page, 'personal')
  await expect(page.locator('[data-testid="songs-title"]')).toContainText(
    'My Songs'
  )
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

test.describe('Personal banner', () => {
  let testUserId: string | undefined

  test.afterEach(async () => {
    if (testUserId) {
      await deleteTestUser(testUserId)
      testUserId = undefined
    }
  })

  test('Copy all brings band songs into My Songs', async ({ page }) => {
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Banner Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await addBandSong(page, 'Banner Song One')
    await addBandSong(page, 'Banner Song Two')

    await switchToPersonal(page)
    const banner = page.locator('[data-testid="songs-personal-banner"]')
    await expect(banner).toContainText(
      "2 songs in your bands aren't in My Songs"
    )

    await page.locator('[data-testid="songs-copy-all"]').click()
    await expect(banner).toHaveCount(0, { timeout: 5000 })
    await expect(
      page.locator('[data-testid^="song-row-"]', { hasText: 'Banner Song' })
    ).toHaveCount(2)
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

  test('checkbox is shown when adding a band song but not a personal one', async ({
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
    await switchToPersonal(page)
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
    await switchToPersonal(page)
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
    await switchToPersonal(page)
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
    await switchToPersonal(page)
    await expect(visibleLinkIcons).toHaveCount(1, { timeout: 5000 })
  })

  test('chain icon appears after "Add to My Songs" from the song menu', async ({
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

    // Right-click the row, choose "Add to My Songs".
    await page
      .locator('[data-testid^="song-row-"]')
      .first()
      .click({ button: 'right' })
    await page
      .locator('[data-testid="copy-to-personal-button"]')
      .first()
      .click()

    // Chain icon appears on the band-tab row now that it has a personal copy.
    await expect(visibleLinkIcons).toHaveCount(1, { timeout: 5000 })
  })
})
