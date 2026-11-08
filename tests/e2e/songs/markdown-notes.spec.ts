/**
 * E2E tests for the unified MarkdownField (pencil-to-edit, click-out save)
 * across every surface that edits markdown-typed notes.
 *
 * Covers:
 * - Song view (band notes + my notes), opened by tapping a song row
 * - The song editor carries no notes field (redesign: notes live in the view)
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

/** Add a song using the EditSongModal in add mode. Leaves the user on /songs. */
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

/** Open the song view by tapping the first row (desktop: the side pane). */
async function openSongView(page: Page) {
  await page.locator('[data-testid^="song-row-"]').first().click()
  await expect(
    page.locator('[data-testid="song-notes-band-field"]')
  ).toBeVisible({ timeout: 5000 })
}

/** Right-click the first song row and choose Edit. */
async function openEditSong(page: Page) {
  await page
    .locator('[data-testid^="song-row-"]')
    .first()
    .click({ button: 'right' })
  await page.locator('[data-testid="edit-song-button"]').click()
  await page.waitForTimeout(400)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('MarkdownField rollout — song notes surfaces', () => {
  let testUserId: string | undefined

  test.afterEach(async () => {
    if (testUserId) {
      await deleteTestUser(testUserId)
      testUserId = undefined
    }
  })

  test('Song view renders MarkdownField for both band and personal notes', async ({
    page,
  }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Markdown Notes Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await addSong(page, 'Markdown Test Song')
    await openSongView(page)

    // Both MarkdownField instances render with the new dedicated test ids.
    await expect(
      page.locator('[data-testid="song-notes-band-field"]')
    ).toBeVisible({ timeout: 5000 })
    await expect(
      page.locator('[data-testid="song-notes-personal-field"]')
    ).toBeVisible({ timeout: 5000 })

    // Legacy raw textareas must not be present anymore.
    await expect(
      page.locator('[data-testid="song-notes-band-textarea"]')
    ).toHaveCount(0)
    await expect(
      page.locator('[data-testid="song-notes-personal-textarea"]')
    ).toHaveCount(0)

    await assertNoConsoleErrors(page, errors)
  })

  test('Song view: typing in band notes and saving persists', async ({
    page,
  }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Autosave Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await addSong(page, 'Autosave Song')
    await openSongView(page)

    // Click the pencil icon inside the band-notes field to enter edit mode.
    const bandField = page.locator('[data-testid="song-notes-band-field"]')
    await expect(bandField).toBeVisible({ timeout: 5000 })
    await bandField
      .locator('[data-testid="markdown-field-edit-button"]')
      .click()

    // Type some markdown into the textarea.
    const textarea = bandField.locator('[data-testid="markdown-textarea"]')
    await expect(textarea).toBeVisible({ timeout: 3000 })
    await textarea.fill('# Pre-show notes\n\n- Bring capo\n- **Loud** intro')

    // Click the explicit save check icon (more reliable than click-out
    // detection in headless modes).
    const saved = page.waitForResponse(r =>
      r.url().includes('/rpc/set_band_note')
    )
    await bandField.locator('[data-testid="markdown-save"]').click()
    expect((await saved).ok()).toBe(true)

    // Toast confirms the save.
    await expect(
      bandField.locator('[data-testid="markdown-saved-toast"]')
    ).toBeVisible({ timeout: 3000 })

    // Reload and reopen the song; the rendered markdown shows the saved value.
    await page.reload()
    await openSongView(page)
    const reopenedBand = page.locator('[data-testid="song-notes-band-field"]')
    await expect(reopenedBand).toContainText('Pre-show notes', {
      timeout: 5000,
    })
    await expect(reopenedBand).toContainText('Bring capo')

    await assertNoConsoleErrors(page, errors)
  })

  test('Song editor has no notes field in edit mode', async ({ page }) => {
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Edit Notes Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await addSong(page, 'Edit Modal Song')
    await openEditSong(page)

    await expect(page.locator('[data-testid="song-title-input"]')).toHaveValue(
      'Edit Modal Song'
    )
    await expect(page.locator('[data-testid="song-notes-field"]')).toHaveCount(
      0
    )
  })

  test('Song editor in add mode does NOT render a notes field', async ({
    page,
  }) => {
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Add Mode Notes Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    // Open add modal but do NOT submit yet.
    const addButton = page
      .locator('button:has-text("Add Song"), [data-testid="add-song-button"]')
      .first()
    await addButton.click()
    await page.waitForTimeout(400)

    // The notes field should be absent in add mode.
    await expect(page.locator('[data-testid="song-notes-field"]')).toHaveCount(
      0
    )

    // Verify all other expected fields ARE present so we know the modal
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
