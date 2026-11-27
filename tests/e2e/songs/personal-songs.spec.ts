/**
 * E2E tests for Personal Song Catalog
 *
 * My Songs is the Personal context's catalog (redesign: the Band / My Songs
 * tabs became the context switcher).
 *
 * Covers:
 * - Creating a personal song (appears in Personal, not the band)
 * - Deleting a personal song
 * - Personal songs isolated from band songs
 */
import { test, expect } from '@playwright/test'
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

async function switchToPersonal(page: import('@playwright/test').Page) {
  await switchContextViaUI(page, 'personal')
  await expect(page.locator('[data-testid="songs-title"]')).toContainText(
    'My Songs'
  )
}

async function switchToBand(page: import('@playwright/test').Page) {
  await switchContextViaUI(page, 'band')
}

// ---------------------------------------------------------------------------
// Helper: add a song in current context
// ---------------------------------------------------------------------------
async function addSong(
  page: import('@playwright/test').Page,
  title: string,
  artist = 'Test Artist'
) {
  const addButton = page
    .locator('button:has-text("Add Song"), [data-testid="add-song-button"]')
    .first()
  await expect(addButton).toBeVisible({ timeout: 5000 })
  await addButton.click()
  await page.waitForTimeout(400)

  await page.locator('[data-testid="song-title-input"]').fill(title)
  await page.locator('[data-testid="song-artist-input"]').fill(artist)

  // Select key C
  await page.locator('[data-testid="song-key-button"]').click()
  await page.locator('[data-testid="key-picker-C"]').click()
  await page.locator('[data-testid="key-picker-confirm"]').click()
  await page.waitForTimeout(300)

  await page.locator('[data-testid="song-submit-button"]').click()
  await page.waitForTimeout(1500)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Personal Song Catalog', () => {
  let testUserId: string | undefined

  test.afterEach(async () => {
    if (testUserId) {
      await deleteTestUser(testUserId)
      testUserId = undefined
    }
  })

  test('personal song appears in My Songs, not in the band', async ({
    page,
  }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()

    await signUpViaUI(page, user)
    await createBandViaUI(page, `Personal Songs Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    // Switch to Personal and add a song
    await switchToPersonal(page)
    await addSong(page, 'My Personal Song', 'Personal Artist')

    // Verify it appears in My Songs
    await expect(page.locator('text=My Personal Song').first()).toBeVisible({
      timeout: 5000,
    })

    // Back in the band, the personal song is not there
    await switchToBand(page)
    await expect(page.locator('[data-testid="songs-page"]')).toBeVisible()
    await expect(page.locator('text=My Personal Song')).toHaveCount(0)

    await assertNoConsoleErrors(page, errors)
  })

  test('band song does not appear in My Songs', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()

    await signUpViaUI(page, user)
    await createBandViaUI(page, `Band Song Isolation ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    // Add a band song (the new band is the current context)
    await addSong(page, 'Unique Band Song', 'Band Artist')

    // In Personal the band song is not in the list (the "not in My Songs"
    // banner may name it, so look in the rows only)
    await switchToPersonal(page)
    await expect(
      page.locator('[data-testid^="song-row-"]', {
        hasText: 'Unique Band Song',
      })
    ).toHaveCount(0)

    await assertNoConsoleErrors(page, errors)
  })

  test('can delete a personal song', async ({ page }) => {
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Delete Personal Song ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    // Add a personal song
    await switchToPersonal(page)
    await addSong(page, 'Song To Delete Personal', 'Delete Artist')

    // Verify it was added
    await expect(
      page.locator('text=Song To Delete Personal').first()
    ).toBeVisible({ timeout: 5000 })

    // Right-click → Delete… → confirm
    await page
      .locator('[data-testid^="song-row-"]', {
        hasText: 'Song To Delete Personal',
      })
      .click({ button: 'right' })
    await page.locator('[data-testid="delete-song-button"]').click()
    await page.locator('[data-testid="confirm-dialog-confirm"]').click()
    await expect(
      page.locator('[data-testid^="song-row-"]', {
        hasText: 'Song To Delete Personal',
      })
    ).toHaveCount(0, { timeout: 5000 })
  })
})
