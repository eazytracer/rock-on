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

/**
 * #3 Catalog provenance / Source filter — Hide / Re-add.
 * A song hidden from the catalog is removed from the default list, surfaced
 * behind View → Show hidden songs, and can be shown again. Backed by the Supabase
 * `song_hidden` table (own-rows-only RLS).
 */
test.describe('Songs — Hide / Re-add', () => {
  let testUserId: string | undefined

  test.afterEach(async () => {
    if (testUserId) {
      await deleteTestUser(testUserId)
      testUserId = undefined
    }
  })

  const addSong = async (
    page: import('@playwright/test').Page,
    title: string
  ) => {
    await page.locator('button:has-text("Add Song")').first().click()
    await page.waitForTimeout(500)
    await page.fill('input[name="title"]', title)
    await page.fill('input[name="artist"]', 'Hide Test Artist')
    // Key via the Circle of Fifths picker (required field).
    await page.locator('[data-testid="song-key-button"]').first().click()
    await page.waitForTimeout(300)
    await page.locator('[data-testid="key-picker-C"]').first().click()
    await page.waitForTimeout(300)
    await page.locator('[data-testid="key-picker-confirm"]').first().click()
    await page.waitForTimeout(300)
    await page.locator('[data-testid="song-submit-button"]').first().click()
    await page.waitForTimeout(2000)
  }

  test('a hidden song leaves the catalog and can be re-added', async ({
    page,
  }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()

    await signUpViaUI(page, user)
    await createBandViaUI(page, `Hide Songs ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    const title = 'Hide Me Song'
    await addSong(page, title)
    await expect(page.locator(`text=${title}`).first()).toBeVisible({
      timeout: 5000,
    })

    // No hidden songs yet → the Hidden toggle is not rendered.
    const row = () =>
      page.locator('[data-testid^="song-row-"]', { hasText: title }).first()
    const viewButton = page.locator('[data-testid="songs-view-button"]')
    await expect(viewButton).not.toContainText('hidden')

    // Hide it from the row menu (right-click; no ⋯ in the redesign).
    await row().click({ button: 'right' })
    await page.locator('[data-testid="song-hide-button"]').click()
    await page.waitForTimeout(1000)

    await expect(row()).toHaveCount(0)
    await expect(viewButton).toContainText('1 hidden')

    // View → Show hidden songs brings it back, dimmed, with "Show again".
    await viewButton.click()
    await page.locator('[data-testid="songs-view-show-hidden"]').click()
    await page.keyboard.press('Escape')
    await expect(row()).toBeVisible({ timeout: 5000 })
    await row().click({ button: 'right' })
    await expect(page.locator('[data-testid="song-readd-button"]')).toBeVisible(
      { timeout: 2000 }
    )
    await expect(page.locator('[data-testid="song-hide-button"]')).toHaveCount(
      0
    )

    await page.locator('[data-testid="song-readd-button"]').click()
    await page.waitForTimeout(1000)
    await expect(viewButton).not.toContainText('hidden')

    // Turn Show hidden off again: the song stays, it's no longer hidden.
    await viewButton.click()
    await page.locator('[data-testid="songs-view-show-hidden"]').click()
    await page.keyboard.press('Escape')
    await expect(row()).toBeVisible({ timeout: 5000 })

    await assertNoConsoleErrors(page, errors)
  })
})
