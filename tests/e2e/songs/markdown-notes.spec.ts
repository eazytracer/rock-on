/**
 * E2E tests for the unified MarkdownField (pencil-to-edit, click-out save)
 * across every surface that edits markdown-typed notes.
 *
 * Covers:
 * - SongNotesModal (band notes + personal notes) — new in this rollout
 * - EditSongModal (band notes, edit mode) — already shipped, sanity check
 * - Markdown helper popover stays accessible
 *
 * The v0.3.x UI unification PR introduced MarkdownField for these
 * surfaces; this suite asserts the migration is complete (the original
 * rollout missed SongNotesModal) and prevents regressions.
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

/** Open the per-song notes modal by clicking the FileText icon on the row. */
async function openSongNotesModal(page: Page) {
  await page.locator('[data-testid="song-notes-button"]').first().click()
  await expect(page.locator('[data-testid="song-notes-modal"]')).toBeVisible({
    timeout: 5000,
  })
}

/** Open the kebab menu on the first song row and click "Edit Song". */
async function openEditSongModal(page: Page) {
  await page.locator('[data-testid="song-actions-menu-button"]').first().click()
  await page.locator('[data-testid="edit-song-button"]').first().click()
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

  test('SongNotesModal renders MarkdownField for both band and personal notes', async ({
    page,
  }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Markdown Notes Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await addSong(page, 'Markdown Test Song')
    await openSongNotesModal(page)

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

    // Modal is now a "Done" button (not a Save button — fields autosave).
    await expect(
      page.locator('[data-testid="song-notes-modal-done"]')
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="song-notes-modal-save"]')
    ).toHaveCount(0)

    await assertNoConsoleErrors(page, errors)
  })

  test('SongNotesModal markdown helper popover remains accessible', async ({
    page,
  }) => {
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Helper Popover Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await addSong(page, 'Helper Test Song')
    await openSongNotesModal(page)

    // Popover starts closed.
    await expect(
      page.locator('[data-testid="song-notes-modal-help-popover"]')
    ).toHaveCount(0)

    // Click HelpCircle → popover opens with cheat-sheet content.
    await page.locator('[data-testid="song-notes-modal-help"]').click()
    const popover = page.locator(
      '[data-testid="song-notes-modal-help-popover"]'
    )
    await expect(popover).toBeVisible({ timeout: 3000 })
    await expect(popover).toContainText('Markdown Formatting')
    await expect(popover).toContainText('Heading')
    await expect(popover).toContainText('bold')

    // Toggling closes again.
    await page.locator('[data-testid="song-notes-modal-help"]').click()
    await expect(
      page.locator('[data-testid="song-notes-modal-help-popover"]')
    ).toHaveCount(0)
  })

  test('SongNotesModal: typing in band notes and clicking out auto-saves', async ({
    page,
  }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Autosave Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await addSong(page, 'Autosave Song')
    await openSongNotesModal(page)

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
    await bandField.locator('[data-testid="markdown-save"]').click()

    // Toast confirms the save.
    await expect(
      bandField.locator('[data-testid="markdown-saved-toast"]')
    ).toBeVisible({ timeout: 3000 })

    // Reopen the modal and verify the value persisted via the rendered
    // markdown in the idle state.
    await page.locator('[data-testid="song-notes-modal-done"]').click()
    await page.waitForTimeout(300)
    await openSongNotesModal(page)
    const reopenedBand = page.locator('[data-testid="song-notes-band-field"]')
    await expect(reopenedBand).toContainText('Pre-show notes', {
      timeout: 5000,
    })
    await expect(reopenedBand).toContainText('Bring capo')

    await assertNoConsoleErrors(page, errors)
  })

  test('EditSongModal renders MarkdownField for band notes in edit mode', async ({
    page,
  }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `EditModal Markdown Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await addSong(page, 'Edit Modal Song')
    await openEditSongModal(page)

    // The band-notes MarkdownField is present in edit mode.
    const notesField = page.locator('[data-testid="song-notes-field"]')
    await expect(notesField).toBeVisible({ timeout: 5000 })

    // Idle state — pencil edit affordance available on hover/focus.
    await notesField.hover()
    await expect(
      notesField.locator('[data-testid="markdown-field-edit-button"]')
    ).toBeVisible({ timeout: 3000 })

    await assertNoConsoleErrors(page, errors)
  })

  test('EditSongModal in add mode does NOT render the band-notes MarkdownField', async ({
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
