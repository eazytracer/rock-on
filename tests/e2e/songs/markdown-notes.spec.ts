/**
 * E2E tests for song notes on the song page (docs/redesign/10 · 1.4): each
 * note layer edits in place with Write / Preview and Done.
 *
 * Covers:
 * - Song page (band note + my notes), opened by tapping a song row
 * - The Add song form carries no notes field (notes live on the song page)
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

/** Add a song on the Add song page. Leaves the user on /songs. */
async function addSong(page: Page, title: string, artist = 'Test Artist') {
  const addButton = page
    .locator('button:has-text("Add Song"), [data-testid="add-song-button"]')
    .first()
  await expect(addButton).toBeVisible({ timeout: 5000 })
  await addButton.click()
  await page.waitForTimeout(400)

  await page.locator('[data-testid="song-title-input"]').fill(title)
  await page.locator('[data-testid="song-artist-input"]').fill(artist)

  // Pick key C
  await page.locator('[data-testid="song-key-button"]').click()
  await page.locator('[data-testid="key-picker-C"]').click()
  await page.locator('[data-testid="key-picker-confirm"]').click()
  await page.waitForTimeout(300)

  await page.locator('[data-testid="song-submit-button"]').click()
  await page.waitForTimeout(1500)
}

/** Open the song by tapping the first row (below 1440 px: the song page). */
async function openSongView(page: Page) {
  await page.locator('[data-testid^="song-row-"]').first().click()
  await expect(page.locator('[data-testid="song-note-band"]')).toBeVisible({
    timeout: 5000,
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Song notes on the song page', () => {
  let testUserId: string | undefined

  test.afterEach(async () => {
    if (testUserId) {
      await deleteTestUser(testUserId)
      testUserId = undefined
    }
  })

  test('Song page shows the band note and my notes', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Markdown Notes Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await addSong(page, 'Markdown Test Song')
    await openSongView(page)

    await expect(page.locator('[data-testid="song-note-band"]')).toBeVisible()
    await expect(page.locator('[data-testid="song-note-mine"]')).toBeVisible()

    // Read-only until Edit: no textarea yet.
    await expect(page.locator('[data-testid="markdown-textarea"]')).toHaveCount(
      0
    )

    await assertNoConsoleErrors(page, errors)
  })

  test('Band note: Done saves and persists', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Autosave Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await addSong(page, 'Autosave Song')
    await openSongView(page)

    await page.locator('[data-testid="song-note-band-edit"]').click()

    // Type some markdown into the textarea.
    const textarea = page.locator('[data-testid="markdown-textarea"]')
    await expect(textarea).toBeVisible({ timeout: 3000 })
    await textarea.fill('# Pre-show notes\n\n- Bring capo\n- **Loud** intro')

    const saved = page.waitForResponse(r =>
      r.url().includes('/rpc/set_band_note')
    )
    await page.locator('[data-testid="song-note-done"]').click()
    expect((await saved).ok()).toBe(true)
    await expect(textarea).toHaveCount(0)

    // Reload the song page; the rendered markdown shows the saved value.
    await page.reload()
    const band = page.locator('[data-testid="song-note-band-view"]')
    await expect(band).toContainText('Pre-show notes', { timeout: 5000 })
    await expect(band).toContainText('Bring capo')

    await assertNoConsoleErrors(page, errors)
  })

  test('Song editor in add mode does NOT render a notes field', async ({
    page,
  }) => {
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Add Mode Notes Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    // Open the Add song page but do NOT submit yet.
    const addButton = page
      .locator('button:has-text("Add Song"), [data-testid="add-song-button"]')
      .first()
    await addButton.click()
    await page.waitForTimeout(400)

    // The notes field should be absent in add mode.
    await expect(page.locator('[data-testid="song-notes-field"]')).toHaveCount(
      0
    )

    // Verify all other expected fields ARE present so we know the form
    // rendered correctly.
    await expect(page.locator('[data-testid="song-title-input"]')).toBeVisible()
    await expect(
      page.locator('[data-testid="song-artist-input"]')
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="song-tuning-select"]')
    ).toBeVisible()
  })
})
