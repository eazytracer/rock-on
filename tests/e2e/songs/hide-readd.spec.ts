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
 * behind a "Hidden (N)" toggle, and can be re-added. Backed by the Supabase
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
    await expect(
      page.locator('[data-testid="songs-show-hidden-toggle"]')
    ).toHaveCount(0)

    // Hide the song via its action menu.
    await page
      .locator('[data-testid="song-actions-menu-button"]')
      .first()
      .click()
    await page.waitForTimeout(300)
    await page.locator('[data-testid="song-hide-button"]').first().click()
    await page.waitForTimeout(1000)

    // It leaves the default catalog; the Hidden (1) toggle appears.
    await expect(page.locator(`text=${title}`)).toHaveCount(0)
    const toggle = page.locator('[data-testid="songs-show-hidden-toggle"]')
    await expect(toggle).toBeVisible({ timeout: 5000 })
    await expect(toggle).toContainText('Hidden (1)')

    // Show hidden → the song is back in view, with a Re-add action (no Hide).
    await toggle.click()
    await page.waitForTimeout(500)
    await expect(page.locator(`text=${title}`).first()).toBeVisible({
      timeout: 5000,
    })
    await page
      .locator('[data-testid="song-actions-menu-button"]')
      .first()
      .click()
    await page.waitForTimeout(300)
    await expect(
      page.locator('[data-testid="song-readd-button"]').first()
    ).toBeVisible({ timeout: 2000 })
    await expect(page.locator('[data-testid="song-hide-button"]')).toHaveCount(
      0
    )

    // Re-add it.
    await page.locator('[data-testid="song-readd-button"]').first().click()
    await page.waitForTimeout(1000)

    // Back in the normal catalog; the Hidden toggle is gone (nothing hidden).
    await expect(toggle).toContainText('Hidden (0)')
    await toggle.click()
    await page.waitForTimeout(500)
    await expect(page.locator(`text=${title}`).first()).toBeVisible({
      timeout: 5000,
    })
    await expect(
      page.locator('[data-testid="songs-show-hidden-toggle"]')
    ).toHaveCount(0)

    await assertNoConsoleErrors(page, errors)
  })
})
