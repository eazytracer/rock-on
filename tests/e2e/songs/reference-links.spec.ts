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

      // Setup: Create user and band
      await signUpViaUI(page, user)
      await createBandViaUI(page, `Links Test ${Date.now()}`)
      await page.waitForURL(/\/songs/, { timeout: 10000 })

      // Add a song first
      const addButton = page
        .locator('button:has-text("Add Song"), [data-testid="add-song-button"]')
        .first()
      await expect(addButton).toBeVisible({ timeout: 5000 })
      await addButton.click()
      await page.waitForTimeout(500)

      // Fill required fields
      await page.locator('[data-testid="song-title-input"]').fill('Test Song')
      await page
        .locator('[data-testid="song-artist-input"]')
        .fill('Test Artist')

      // Select key
      await page.locator('[data-testid="song-key-button"]').click()
      await page.locator('[data-testid="key-picker-C"]').click()
      await page.locator('[data-testid="key-picker-confirm"]').click()
      await page.waitForTimeout(300)

      // Add a YouTube link
      // First, find the link type dropdown and select YouTube
      const linkTypeSelect = page
        .locator('select')
        .filter({ hasText: 'YouTube' })
        .first()
      await linkTypeSelect.selectOption('youtube')

      // Enter URL - should auto-detect type
      const urlInput = page.locator('input[type="url"]').first()
      await urlInput.fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ')

      // Click Add Link
      await page.locator('button:has-text("Add Link")').first().click()
      await page.waitForTimeout(300)

      // Verify link appears in the list
      const linkItem = page.locator('text=YouTube Video').first()
      await expect(linkItem).toBeVisible({ timeout: 3000 })

      // Save the song
      await page.locator('[data-testid="song-submit-button"]').click()
      await page.waitForTimeout(2000)

      // Verify song is saved
      await expect(page.locator('text=Test Song')).toBeVisible({
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

      // Add a song
      await page
        .locator('button:has-text("Add Song"), [data-testid="add-song-button"]')
        .first()
        .click()
      await page.waitForTimeout(500)

      // Fill required fields
      await page
        .locator('[data-testid="song-title-input"]')
        .fill('Detection Test')
      await page
        .locator('[data-testid="song-artist-input"]')
        .fill('Test Artist')

      // Select key
      await page.locator('[data-testid="song-key-button"]').click()
      await page.locator('[data-testid="key-picker-E"]').click()
      await page.locator('[data-testid="key-picker-confirm"]').click()
      await page.waitForTimeout(300)

      // Enter a Spotify URL
      const urlInput = page.locator('input[type="url"]').first()
      await urlInput.fill(
        'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh'
      )
      await page.waitForTimeout(200)

      // The dropdown should have automatically switched to Spotify
      const linkTypeSelect = page
        .locator('select')
        .filter({ hasText: 'Spotify' })
        .first()
      await expect(linkTypeSelect).toHaveValue('spotify')

      // Add the link
      await page.locator('button:has-text("Add Link")').first().click()
      await page.waitForTimeout(300)

      // Verify Spotify link appears
      await expect(page.locator('text=Spotify Track')).toBeVisible({
        timeout: 3000,
      })

      await assertNoConsoleErrors(page, errors)
    })

    test('can edit an existing reference link', async ({ page }) => {
      const errors = setupConsoleErrorTracking(page)
      const user = createTestUser()

      await signUpViaUI(page, user)
      await createBandViaUI(page, `Edit Link Test ${Date.now()}`)
      await page.waitForURL(/\/songs/, { timeout: 10000 })

      // Add a song
      await page
        .locator('button:has-text("Add Song"), [data-testid="add-song-button"]')
        .first()
        .click()
      await page.waitForTimeout(500)

      // Fill required fields
      await page
        .locator('[data-testid="song-title-input"]')
        .fill('Edit Link Test')
      await page
        .locator('[data-testid="song-artist-input"]')
        .fill('Test Artist')

      // Select key
      await page.locator('[data-testid="song-key-button"]').click()
      await page.locator('[data-testid="key-picker-G"]').click()
      await page.locator('[data-testid="key-picker-confirm"]').click()
      await page.waitForTimeout(300)

      // Add a link
      await page
        .locator('input[type="url"]')
        .first()
        .fill('https://youtube.com/watch?v=abc')
      await page.locator('button:has-text("Add Link")').first().click()
      await page.waitForTimeout(300)

      // Find and click the edit button on the link
      const editButton = page.locator('button[title="Edit link"]').first()
      await expect(editButton).toBeVisible({ timeout: 3000 })
      await editButton.click()

      // Update the URL
      const urlInput = page.locator('input[type="url"]').first()
      await urlInput.clear()
      await urlInput.fill('https://youtube.com/watch?v=xyz')

      // Button should now say "Update Link"
      await expect(page.locator('button:has-text("Update Link")')).toBeVisible()
      await page.locator('button:has-text("Update Link")').click()
      await page.waitForTimeout(300)

      await assertNoConsoleErrors(page, errors)
    })

    test('can delete a reference link', async ({ page }) => {
      const errors = setupConsoleErrorTracking(page)
      const user = createTestUser()

      await signUpViaUI(page, user)
      await createBandViaUI(page, `Delete Link Test ${Date.now()}`)
      await page.waitForURL(/\/songs/, { timeout: 10000 })

      // Add a song
      await page
        .locator('button:has-text("Add Song"), [data-testid="add-song-button"]')
        .first()
        .click()
      await page.waitForTimeout(500)

      // Fill required fields
      await page
        .locator('[data-testid="song-title-input"]')
        .fill('Delete Link Test')
      await page
        .locator('[data-testid="song-artist-input"]')
        .fill('Test Artist')

      // Select key
      await page.locator('[data-testid="song-key-button"]').click()
      await page.locator('[data-testid="key-picker-D"]').click()
      await page.locator('[data-testid="key-picker-confirm"]').click()
      await page.waitForTimeout(300)

      // Add a link
      await page
        .locator('input[type="url"]')
        .first()
        .fill('https://ultimate-guitar.com/tabs/song')
      await page.locator('button:has-text("Add Link")').first().click()
      await page.waitForTimeout(300)

      // Verify link exists
      await expect(page.locator('text=Tabs')).toBeVisible({ timeout: 3000 })

      // Delete the link
      const deleteButton = page.locator('button[title="Delete link"]').first()
      await deleteButton.click()
      await page.waitForTimeout(300)

      // Verify link is gone and "No links added yet" appears
      await expect(page.locator('text=No links added yet')).toBeVisible({
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

      // Add a song
      await page
        .locator('button:has-text("Add Song"), [data-testid="add-song-button"]')
        .first()
        .click()
      await page.waitForTimeout(500)

      // Fill required fields
      await page
        .locator('[data-testid="song-title-input"]')
        .fill('Multi Links Test')
      await page
        .locator('[data-testid="song-artist-input"]')
        .fill('Test Artist')

      // Select key
      await page.locator('[data-testid="song-key-button"]').click()
      await page.locator('[data-testid="key-picker-B"]').click()
      await page.locator('[data-testid="key-picker-confirm"]').click()
      await page.waitForTimeout(300)

      // Add YouTube link
      await page
        .locator('input[type="url"]')
        .first()
        .fill('https://youtube.com/watch?v=123')
      await page.locator('button:has-text("Add Link")').first().click()
      await page.waitForTimeout(300)

      // Add Spotify link
      await page
        .locator('input[type="url"]')
        .first()
        .fill('https://open.spotify.com/track/456')
      await page.locator('button:has-text("Add Link")').first().click()
      await page.waitForTimeout(300)

      // Add Tabs link
      await page
        .locator('input[type="url"]')
        .first()
        .fill('https://ultimate-guitar.com/tab/789')
      await page.locator('button:has-text("Add Link")').first().click()
      await page.waitForTimeout(300)

      // Verify all three links exist
      await expect(page.locator('text=YouTube Video')).toBeVisible({
        timeout: 3000,
      })
      await expect(page.locator('text=Spotify Track')).toBeVisible({
        timeout: 3000,
      })
      await expect(page.locator('text=Tabs')).toBeVisible({ timeout: 3000 })

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
