import { test, expect } from '@playwright/test'
import {
  createTestUser,
  signUpViaUI,
  deleteTestUser,
} from '../../fixtures/auth'
import { createBandViaUI } from '../../fixtures/bands'

/**
 * Key is optional on songs (mobile-redesign-port).
 *
 * A user adding a song quickly — e.g. signing up to play it at an event — should not
 * have to look up the musical key first. Only title + artist are required.
 */
test.describe('Songs — optional key', () => {
  let testUserId: string | undefined

  test.afterEach(async () => {
    if (testUserId) {
      await deleteTestUser(testUserId)
      testUserId = undefined
    }
  })

  test('can create a song with no key (title + artist only)', async ({
    page,
  }) => {
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Optional Key ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })
    testUserId =
      (await page.evaluate(() => localStorage.getItem('currentUserId'))) ??
      undefined

    // Open Add Song modal
    const addButton = page
      .locator('button:has-text("Add Song"), [data-testid="add-song-button"]')
      .first()
    await expect(addButton).toBeVisible({ timeout: 5000 })
    await addButton.click()
    await page.waitForTimeout(500)

    // Fill ONLY title + artist — deliberately leave key untouched
    const title = `Keyless Song ${Date.now()}`
    await page.locator('[data-testid="song-title-input"]').fill(title)
    await page
      .locator('[data-testid="song-artist-input"]')
      .fill('No Key Artist')

    // The key field should read "Optional" (no required asterisk / no key selected)
    await expect(page.locator('[data-testid="song-key-button"]')).toContainText(
      'Optional'
    )

    // Save — should succeed despite no key
    await page.locator('[data-testid="song-submit-button"]').click()
    await page.waitForTimeout(2000)

    // The song appears in the list (modal closed, save succeeded)
    await expect(page.locator(`text=${title}`).first()).toBeVisible({
      timeout: 5000,
    })
    // Modal is gone
    await expect(
      page.locator('[data-testid="song-submit-button"]')
    ).toBeHidden()
  })
})
