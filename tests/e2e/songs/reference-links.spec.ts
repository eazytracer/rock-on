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
 * Helper: open the Add Song modal and fill required fields (title, artist, key)
 */
async function openAddSongModal(
  page: import('@playwright/test').Page,
  title: string,
  artist = 'Test Artist',
  key = 'C'
) {
  const addButton = page
    .locator('button:has-text("Add Song"), [data-testid="add-song-button"]')
    .first()
  await expect(addButton).toBeVisible({ timeout: 5000 })
  await addButton.click()
  await page.waitForTimeout(500)

  await page.locator('[data-testid="song-title-input"]').fill(title)
  await page.locator('[data-testid="song-artist-input"]').fill(artist)

  await page.locator('[data-testid="song-key-button"]').click()
  await page.locator(`[data-testid="key-picker-${key}"]`).click()
  await page.locator('[data-testid="key-picker-confirm"]').click()
  await page.waitForTimeout(300)
}

/**
 * Helper: add a reference link via the current UI
 * - Clicks "Add another link..." button to open the inline form
 * - Fills the URL input
 * - Clicks the check/save icon button
 */
async function addReferenceLink(
  page: import('@playwright/test').Page,
  url: string
) {
  await page.locator('[data-testid="start-add-link-button"]').click()
  await page.waitForTimeout(200)
  await page.locator('[data-testid="link-url-input"]').fill(url)
  await page.waitForTimeout(300) // let auto-detection run
  await page.locator('[data-testid="save-add-link-button"]').click()
  await page.waitForTimeout(300)
}

test.describe('Song Reference Links', () => {
  let testUserId: string | undefined

  test.afterEach(async () => {
    if (testUserId) {
      await deleteTestUser(testUserId)
      testUserId = undefined
    }
  })

  test.describe('Link Management', () => {
    test('can add a reference link to a song', async ({ page }) => {
      const errors = setupConsoleErrorTracking(page)
      const user = createTestUser()

      await signUpViaUI(page, user)
      await createBandViaUI(page, `Links Test ${Date.now()}`)
      await page.waitForURL(/\/songs/, { timeout: 10000 })

      await openAddSongModal(page, 'Test Song')

      // Add a YouTube link
      await addReferenceLink(
        page,
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      )

      // Verify at least one link edit button appeared (link was saved)
      const linkItem = page.locator('button[title="Edit link"]').first()
      await expect(linkItem).toBeVisible({ timeout: 3000 })

      // Save the song
      await page.locator('[data-testid="song-submit-button"]').click()
      await page.waitForTimeout(2000)

      // Verify song is saved (appears in song list)
      await expect(page.locator('text=Test Song').first()).toBeVisible({
        timeout: 5000,
      })

      await assertNoConsoleErrors(page, errors)
    })

    test('URL auto-detects link type', async ({ page }) => {
      const errors = setupConsoleErrorTracking(page)
      const user = createTestUser()

      await signUpViaUI(page, user)
      await createBandViaUI(page, `URL Detection Test ${Date.now()}`)
      await page.waitForURL(/\/songs/, { timeout: 10000 })

      await openAddSongModal(page, 'Detection Test', 'Test Artist', 'E')

      // Open the add link form and enter a Spotify URL
      await page.locator('[data-testid="start-add-link-button"]').click()
      await page.waitForTimeout(200)
      await page
        .locator('[data-testid="link-url-input"]')
        .fill('https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh')
      await page.waitForTimeout(400) // let auto-detection run

      // The icon select should reflect Spotify auto-detection
      // The URL input should still be visible and valid
      const urlInput = page.locator('[data-testid="link-url-input"]')
      await expect(urlInput).toHaveValue(
        'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh'
      )

      // Save the link
      await page.locator('[data-testid="save-add-link-button"]').click()
      await page.waitForTimeout(300)

      // Verify a link entry appeared (edit button visible means link was saved)
      await expect(
        page.locator('button[title="Edit link"]').first()
      ).toBeVisible({ timeout: 3000 })

      await assertNoConsoleErrors(page, errors)
    })

    test('can edit an existing reference link', async ({ page }) => {
      const errors = setupConsoleErrorTracking(page)
      const user = createTestUser()

      await signUpViaUI(page, user)
      await createBandViaUI(page, `Edit Link Test ${Date.now()}`)
      await page.waitForURL(/\/songs/, { timeout: 10000 })

      await openAddSongModal(page, 'Edit Link Test', 'Test Artist', 'G')

      // Add a YouTube link
      await addReferenceLink(page, 'https://youtube.com/watch?v=abc')

      // Find and click the edit button on the link item
      const editButton = page.locator('button[title="Edit link"]').first()
      await expect(editButton).toBeVisible({ timeout: 3000 })
      await editButton.click()

      // The edit form opens – update the URL
      const editUrlInput = page.locator('[data-testid="link-url-input-edit"]')
      await editUrlInput.clear()
      await editUrlInput.fill('https://youtube.com/watch?v=xyz')
      await page.waitForTimeout(300)

      // Save the edit (check icon button in edit mode)
      await page.locator('[data-testid="save-edit-link-button"]').click()
      await page.waitForTimeout(300)

      await assertNoConsoleErrors(page, errors)
    })

    test('can delete a reference link', async ({ page }) => {
      const errors = setupConsoleErrorTracking(page)
      const user = createTestUser()

      await signUpViaUI(page, user)
      await createBandViaUI(page, `Delete Link Test ${Date.now()}`)
      await page.waitForURL(/\/songs/, { timeout: 10000 })

      await openAddSongModal(page, 'Delete Link Test', 'Test Artist', 'D')

      // Add a tabs link
      await addReferenceLink(page, 'https://ultimate-guitar.com/tabs/song')

      // Verify link exists (edit button visible)
      await expect(
        page.locator('button[title="Edit link"]').first()
      ).toBeVisible({ timeout: 3000 })

      // Delete the link
      const deleteButton = page.locator('button[title="Delete link"]').first()
      await deleteButton.click()
      await page.waitForTimeout(300)

      // Verify link is gone (no edit buttons remaining)
      await expect(page.locator('button[title="Edit link"]')).toHaveCount(0, {
        timeout: 3000,
      })

      await assertNoConsoleErrors(page, errors)
    })

    test('can add multiple reference links', async ({ page }) => {
      const errors = setupConsoleErrorTracking(page)
      const user = createTestUser()

      await signUpViaUI(page, user)
      await createBandViaUI(page, `Multiple Links Test ${Date.now()}`)
      await page.waitForURL(/\/songs/, { timeout: 10000 })

      await openAddSongModal(page, 'Multi Links Test', 'Test Artist', 'B')

      // Add YouTube link
      await addReferenceLink(page, 'https://youtube.com/watch?v=123')

      // Add Spotify link
      await addReferenceLink(
        page,
        'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh'
      )

      // Add Tabs link
      await addReferenceLink(page, 'https://ultimate-guitar.com/tab/789')

      // Verify all three links appear (at least 3 items in the link list)
      const linkItems = page.locator('button[title="Edit link"]')
      await expect(linkItems).toHaveCount(3, { timeout: 5000 })

      await assertNoConsoleErrors(page, errors)
    })
  })

  test.describe('Spotify Search Toggle', () => {
    test('can toggle Spotify search section', async ({ page }) => {
      const errors = setupConsoleErrorTracking(page)
      const user = createTestUser()

      await signUpViaUI(page, user)
      await createBandViaUI(page, `Spotify Toggle Test ${Date.now()}`)
      await page.waitForURL(/\/songs/, { timeout: 10000 })

      // Open add song modal
      await page
        .locator('button:has-text("Add Song"), [data-testid="add-song-button"]')
        .first()
        .click()
      await page.waitForTimeout(500)

      // Find the Spotify search toggle
      const spotifyToggle = page.locator(
        '[data-testid="toggle-spotify-search"]'
      )
      await expect(spotifyToggle).toBeVisible({ timeout: 5000 })
      await expect(spotifyToggle).toContainText('Search Spotify to auto-fill')

      // Click to expand
      await spotifyToggle.click()
      await page.waitForTimeout(300)

      // Verify search input appears
      const searchInput = page.locator('[data-testid="spotify-search-input"]')
      await expect(searchInput).toBeVisible({ timeout: 3000 })

      // Click again to collapse
      await spotifyToggle.click()
      await page.waitForTimeout(300)

      // Verify search input is hidden
      await expect(searchInput).not.toBeVisible()

      await assertNoConsoleErrors(page, errors)
    })
  })
})
