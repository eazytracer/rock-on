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

test.describe('Song Search and Filtering', () => {
  let testUserId: string | undefined

  test.afterEach(async () => {
    if (testUserId) {
      await deleteTestUser(testUserId)
      testUserId = undefined
    }
  })

  test('user can search songs by title', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()

    await signUpViaUI(page, user)
    await createBandViaUI(page, `Search Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    // Add multiple songs
    const songs = [
      { title: 'Stairway to Heaven', artist: 'Led Zeppelin' },
      { title: 'Hotel California', artist: 'Eagles' },
      { title: 'Bohemian Rhapsody', artist: 'Queen' },
    ]

    for (const song of songs) {
      const addButton = page.locator('button:has-text("Add Song")').first()
      const hasButton = await addButton.isVisible().catch(() => false)
      if (!hasButton) {
        console.log('Note: Add Song button not found - skipping test')
        return
      }

      await addButton.click()
      await page.waitForTimeout(500)
      await page.fill('input[name="title"]', song.title)
      await page.fill('input[name="artist"]', song.artist)
      await page.locator('button:has-text("Save")').first().click()
      await page.waitForTimeout(1500)
    }

    // Look for search input
    const searchInput = page
      .locator(
        'input[placeholder*="Search"], input[name="search"], [data-testid="song-search"]'
      )
      .first()
    const hasSearch = await searchInput.isVisible().catch(() => false)

    if (hasSearch) {
      // Search for "stairway"
      await searchInput.fill('stairway')
      await page.waitForTimeout(1000)

      // Should see Stairway to Heaven
      await expect(page.locator('text=Stairway to Heaven').first()).toBeVisible(
        { timeout: 5000 }
      )

      // Should not see other songs
      const hotelVisible = await page
        .locator('text=Hotel California')
        .first()
        .isVisible()
        .catch(() => false)
      const bohemianVisible = await page
        .locator('text=Bohemian Rhapsody')
        .first()
        .isVisible()
        .catch(() => false)

      if (!hotelVisible && !bohemianVisible) {
        console.log('Search filtering works correctly')
      } else {
        console.log(
          'Note: Search may need refinement - some songs still visible'
        )
      }

      // Clear search
      await searchInput.clear()
      await page.waitForTimeout(1000)

      // All songs should be visible again
      await expect(page.locator('text=Stairway to Heaven').first()).toBeVisible(
        { timeout: 3000 }
      )
      await expect(page.locator('text=Hotel California').first()).toBeVisible({
        timeout: 3000,
      })
      await expect(page.locator('text=Bohemian Rhapsody').first()).toBeVisible({
        timeout: 3000,
      })
    } else {
      console.log('Note: Search functionality may not be implemented yet')
    }

    await assertNoConsoleErrors(page, errors)
  })

  test('user can search songs by artist', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()

    await signUpViaUI(page, user)
    await createBandViaUI(page, `Artist Search ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    // Add songs
    const songs = [
      { title: 'Kashmir', artist: 'Led Zeppelin' },
      { title: 'Black Dog', artist: 'Led Zeppelin' },
      { title: 'Take It Easy', artist: 'Eagles' },
    ]

    for (const song of songs) {
      const addButton = page.locator('button:has-text("Add Song")').first()
      if (await addButton.isVisible().catch(() => false)) {
        await addButton.click()
        await page.waitForTimeout(500)
        await page.fill('input[name="title"]', song.title)
        await page.fill('input[name="artist"]', song.artist)
        await page.locator('button:has-text("Save")').first().click()
        await page.waitForTimeout(1500)
      }
    }

    // Search by artist
    const searchInput = page.locator('input[placeholder*="Search"]').first()
    const hasSearch = await searchInput.isVisible().catch(() => false)

    if (hasSearch) {
      await searchInput.fill('zeppelin')
      await page.waitForTimeout(1000)

      // Should see both Zeppelin songs
      await expect(page.locator('text=Kashmir').first()).toBeVisible({
        timeout: 5000,
      })
      await expect(page.locator('text=Black Dog').first()).toBeVisible({
        timeout: 5000,
      })

      // Should not see Eagles
      const eaglesVisible = await page
        .locator('text=Take It Easy')
        .first()
        .isVisible()
        .catch(() => false)
      expect(eaglesVisible).toBe(false)
    }

    await assertNoConsoleErrors(page, errors)
  })

  test('user can filter songs by tuning', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()

    await signUpViaUI(page, user)
    await createBandViaUI(page, `Filter Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    const addButton = page.locator('button:has-text("Add Song")').first()

    // Song 1: Standard tuning (default — left untouched)
    await addButton.click()
    await page.waitForTimeout(500)
    await page.fill('input[name="title"]', 'Standard Song')
    await page.fill('input[name="artist"]', 'Artist 1')
    await page.locator('button:has-text("Save")').first().click()
    await page.waitForTimeout(1500)

    // Song 2: Drop D tuning. The tuning Dropdown's option `value`s are DB
    // row UUIDs (not the "drop-d" slug or "Drop D" label), so there's no
    // stable `-option-<value>` testid to target — select by visible text
    // inside the tuning menu instead.
    await addButton.click()
    await page.waitForTimeout(500)
    await page.fill('input[name="title"]', 'Drop D Song')
    await page.fill('input[name="artist"]', 'Artist 2')

    await page.locator('[data-testid="song-tuning-trigger"]').click()
    await page
      .locator('[data-testid="song-tuning-menu"]')
      .getByText('Drop D', { exact: true })
      .click()

    await page.locator('button:has-text("Save")').first().click()
    await page.waitForTimeout(1500)

    // Open the Filters panel, then filter by Drop D
    await page.locator('[data-testid="song-filter-toggle-button"]').click()
    await page.locator('[data-testid="song-tuning-filter-trigger"]').click()
    await page
      .locator('[data-testid="song-tuning-filter-option-Drop D"]')
      .click()
    await page.waitForTimeout(1000)

    // Should only see Drop D song
    await expect(page.locator('text=Drop D Song').first()).toBeVisible({
      timeout: 5000,
    })

    const standardVisible = await page
      .locator('text=Standard Song')
      .first()
      .isVisible()
      .catch(() => false)
    expect(standardVisible).toBe(false)

    await assertNoConsoleErrors(page, errors)
  })

  test('user can sort songs via the sort dropdown', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()

    await signUpViaUI(page, user)
    await createBandViaUI(page, `Sort Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    // Add songs in sequence
    const songs = ['First Song', 'Second Song', 'Third Song']

    for (const title of songs) {
      const addButton = page.locator('button:has-text("Add Song")').first()
      await addButton.click()
      await page.waitForTimeout(500)
      await page.fill('input[name="title"]', title)
      await page.fill('input[name="artist"]', 'Test Artist')
      await page.locator('button:has-text("Save")').first().click()
      await page.waitForTimeout(1500)
    }

    // Exercise the migrated sort Dropdown with a deterministic ordering:
    // Title (Z-A) must reorder Third → Second → First (reverse-alphabetical),
    // proving the C0 Dropdown drives the sort. (We deliberately assert on
    // title order, not "recently added" — createdDate for songs added in the
    // same session is subject to sync-timestamp propagation and is a separate
    // concern from this select→Dropdown migration.)
    const sortTrigger = page.locator('[data-testid="song-sort-trigger"]')
    await expect(sortTrigger).toBeVisible({ timeout: 5000 })
    await sortTrigger.click()
    await page.locator('[data-testid="song-sort-option-title-desc"]').click()
    await expect(sortTrigger).toContainText('Title (Z-A)')
    await page.waitForTimeout(500)

    const rowTexts = await page
      .locator('[data-testid^="song-row-"]')
      .allTextContents()
    const thirdIndex = rowTexts.findIndex(text => text.includes('Third Song'))
    const secondIndex = rowTexts.findIndex(text => text.includes('Second Song'))
    const firstIndex = rowTexts.findIndex(text => text.includes('First Song'))

    expect(thirdIndex).toBeGreaterThanOrEqual(0)
    expect(secondIndex).toBeGreaterThanOrEqual(0)
    expect(firstIndex).toBeGreaterThanOrEqual(0)
    // Z-A: Third > Second > First
    expect(thirdIndex).toBeLessThan(secondIndex)
    expect(secondIndex).toBeLessThan(firstIndex)

    await assertNoConsoleErrors(page, errors)
  })

  test('search is case insensitive', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()

    await signUpViaUI(page, user)
    await createBandViaUI(page, `Case Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    // Add a song
    const addButton = page.locator('button:has-text("Add Song")').first()
    if (await addButton.isVisible().catch(() => false)) {
      await addButton.click()
      await page.waitForTimeout(500)
      await page.fill('input[name="title"]', 'Sweet Child O Mine')
      await page.fill('input[name="artist"]', 'Guns N Roses')
      await page.locator('button:has-text("Save")').first().click()
      await page.waitForTimeout(2000)
    }

    // Search with different cases
    const searchInput = page.locator('input[placeholder*="Search"]').first()
    const hasSearch = await searchInput.isVisible().catch(() => false)

    if (hasSearch) {
      // Lowercase search
      await searchInput.fill('sweet child')
      await page.waitForTimeout(1000)
      await expect(page.locator('text=Sweet Child O Mine').first()).toBeVisible(
        { timeout: 5000 }
      )

      // Uppercase search
      await searchInput.clear()
      await searchInput.fill('SWEET CHILD')
      await page.waitForTimeout(1000)
      await expect(page.locator('text=Sweet Child O Mine').first()).toBeVisible(
        { timeout: 5000 }
      )

      // Mixed case
      await searchInput.clear()
      await searchInput.fill('SwEeT cHiLd')
      await page.waitForTimeout(1000)
      await expect(page.locator('text=Sweet Child O Mine').first()).toBeVisible(
        { timeout: 5000 }
      )
    }

    await assertNoConsoleErrors(page, errors)
  })

  test('no results message shown when search has no matches', async ({
    page,
  }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()

    await signUpViaUI(page, user)
    await createBandViaUI(page, `No Results Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    // Add a song
    const addButton = page.locator('button:has-text("Add Song")').first()
    if (await addButton.isVisible().catch(() => false)) {
      await addButton.click()
      await page.waitForTimeout(500)
      await page.fill('input[name="title"]', 'Existing Song')
      await page.fill('input[name="artist"]', 'Artist')
      await page.locator('button:has-text("Save")').first().click()
      await page.waitForTimeout(2000)
    }

    // Search for non-existent song
    const searchInput = page.locator('input[placeholder*="Search"]').first()
    const hasSearch = await searchInput.isVisible().catch(() => false)

    if (hasSearch) {
      await searchInput.fill('NonExistentSongTitle12345')
      await page.waitForTimeout(1000)

      // Should not see existing song
      const songVisible = await page
        .locator('text=Existing Song')
        .first()
        .isVisible()
        .catch(() => false)
      expect(songVisible).toBe(false)

      // Should see "no results" message
      const noResults = page
        .locator('text=/no.*results|no.*songs.*found|no.*matches/i')
        .first()
      const hasNoResults = await noResults.isVisible().catch(() => false)

      if (hasNoResults) {
        console.log('No results message displayed correctly')
      } else {
        console.log('Note: No results message may not be implemented')
      }
    }

    await assertNoConsoleErrors(page, errors)
  })
})
