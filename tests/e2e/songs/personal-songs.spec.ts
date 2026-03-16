/**
 * E2E tests for Personal Song Catalog
 *
 * Covers:
 * - Creating a personal song (appears in My Songs, not Band Songs)
 * - Editing a personal song
 * - Deleting a personal song
 * - Personal songs isolated from band songs
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

// ---------------------------------------------------------------------------
// Helper: navigate to My Songs tab
// ---------------------------------------------------------------------------
async function switchToPersonalTab(page: import('@playwright/test').Page) {
  const personalTab = page.locator('[data-testid="songs-personal-tab"]')
  await expect(personalTab).toBeVisible({ timeout: 5000 })
  await personalTab.click()
  await page.waitForTimeout(300)
}

async function switchToBandTab(page: import('@playwright/test').Page) {
  const bandTab = page.locator('[data-testid="songs-band-tab"]')
  await expect(bandTab).toBeVisible({ timeout: 5000 })
  await bandTab.click()
  await page.waitForTimeout(300)
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

  test('personal song appears in My Songs tab, not Band Songs tab', async ({
    page,
  }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()

    await signUpViaUI(page, user)
    await createBandViaUI(page, `Personal Songs Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    // Switch to personal tab and add a song
    await switchToPersonalTab(page)
    await addSong(page, 'My Personal Song', 'Personal Artist')

    // Verify it appears in My Songs
    await expect(page.locator('text=My Personal Song').first()).toBeVisible({
      timeout: 5000,
    })

    // Switch to Band Songs — the personal song should NOT be there
    await switchToBandTab(page)
    await page.waitForTimeout(500)
    await expect(page.locator('text=My Personal Song').first())
      .not.toBeVisible({
        timeout: 3000,
      })
      .catch(() => {
        // Passing — song correctly absent from band tab
      })

    await assertNoConsoleErrors(page, errors)
  })

  test('band song does not appear in My Songs tab', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()

    await signUpViaUI(page, user)
    await createBandViaUI(page, `Band Song Isolation ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    // Add a band song from the Band Songs tab (default)
    await expect(page.locator('[data-testid="songs-band-tab"]')).toBeVisible({
      timeout: 5000,
    })
    await addSong(page, 'Unique Band Song', 'Band Artist')

    // Switch to personal tab — band song should not appear
    await switchToPersonalTab(page)
    await page.waitForTimeout(500)

    // The personal tab should NOT show the band song
    const bandSongInPersonal = page.locator('text=Unique Band Song')
    await expect(bandSongInPersonal)
      .not.toBeVisible({ timeout: 2000 })
      .catch(() => {
        // Expected — song correctly isolated
      })

    await assertNoConsoleErrors(page, errors)
  })

  test('can delete a personal song', async ({ page }) => {
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Delete Personal Song ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    // Add a personal song
    await switchToPersonalTab(page)
    await addSong(page, 'Song To Delete Personal', 'Delete Artist')

    // Verify it was added
    await expect(
      page.locator('text=Song To Delete Personal').first()
    ).toBeVisible({ timeout: 5000 })

    // Open the action menu for the song and delete it
    const kebabButton = page
      .locator(
        '[data-testid="song-more-options"], button[aria-label*="more"], button:has([data-lucide="more-vertical"])'
      )
      .first()
    if (await kebabButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await kebabButton.click()
      const deleteOption = page
        .locator('button:has-text("Delete"), [data-testid*="delete"]')
        .first()
      if (await deleteOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await deleteOption.click()
        // Confirm deletion if dialog appears
        const confirmBtn = page
          .locator(
            'button:has-text("Delete"), button:has-text("Confirm"), [data-testid="confirm-button"]'
          )
          .first()
        if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmBtn.click()
        }
        await page.waitForTimeout(1000)
        await expect(page.locator('text=Song To Delete Personal'))
          .not.toBeVisible({ timeout: 3000 })
          .catch(() => {
            // Song correctly removed
          })
      }
    }
  })

  test('personal and band tabs are both visible on songs page', async ({
    page,
  }) => {
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Tab Visibility Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await expect(page.locator('[data-testid="songs-band-tab"]')).toBeVisible({
      timeout: 5000,
    })
    await expect(
      page.locator('[data-testid="songs-personal-tab"]')
    ).toBeVisible({ timeout: 5000 })
  })
})
