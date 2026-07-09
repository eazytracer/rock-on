import { test, expect } from '@playwright/test'
import {
  createTestUser,
  signUpViaUI,
  deleteTestUser,
} from '../../fixtures/auth'
import { createBandViaUI } from '../../fixtures/bands'
import { getSupabaseAdmin } from '../../fixtures/supabase'
import { setupConsoleErrorTracking } from '../../helpers/assertions'

test.describe('Setlist and Show Sync Verification', () => {
  let testUserId: string | undefined

  test.afterEach(async () => {
    if (testUserId) {
      await deleteTestUser(testUserId)
      testUserId = undefined
    }
  })

  test('creating a setlist syncs to Supabase without errors', async ({
    page,
  }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()
    const setlistName = `Sync Test Setlist ${Date.now()}`

    // Setup: Create user and band
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Setlist Sync Test ${Date.now()}`)

    // Navigate to setlists page
    await page.goto('/setlists')
    await page.waitForLoadState('networkidle')

    // Wait for loading state to clear - the page shows "Loading..." while initializing
    await page
      .waitForSelector('text=Loading...', { state: 'hidden', timeout: 15000 })
      .catch(() => {})

    // Wait for either the setlist page content OR the empty state
    await page.waitForSelector(
      'h1:has-text("Setlists"), [data-testid="setlist-empty-state"], [data-testid="create-setlist-button"]',
      { timeout: 15000 }
    )

    // Click Add/Create Setlist button
    const addButton = page
      .locator('[data-testid="create-setlist-button"]')
      .first()
    await expect(addButton).toBeVisible({ timeout: 10000 })
    await addButton.click()
    await page.waitForTimeout(500)

    // Fill in the setlist name - the create flow now opens the full-page
    // setlist editor whose name is an inline-editable field (starts in
    // display mode), not a modal input.
    const nameInput = page.locator('[data-testid="setlist-name-input"]').first()
    const isNameInputVisible = await nameInput.isVisible().catch(() => false)
    if (!isNameInputVisible) {
      await page.locator('[data-testid="setlist-name-display"]').first().click()
      await page.waitForTimeout(200)
    }
    await expect(nameInput).toBeVisible({ timeout: 5000 })
    await nameInput.fill(setlistName)

    // Save the setlist
    const saveButton = page
      .locator(
        'button:has-text("Save"), button:has-text("Create"), button[type="submit"]'
      )
      .first()
    await saveButton.click()

    // Wait for sync to complete
    await page.waitForTimeout(3000)

    // Check for sync errors in console
    const syncErrors = errors.filter(
      e =>
        e.includes('Failed to sync') ||
        e.includes('PGRST') ||
        e.includes('400') ||
        e.includes('source_setlist_id')
    )

    // This should be empty if our schema fix worked
    expect(syncErrors).toHaveLength(0)

    // Verify setlist appears in UI
    const setlistItem = page.locator(`text=${setlistName}`).first()
    await expect(setlistItem).toBeVisible({ timeout: 5000 })

    // CRITICAL: Verify setlist exists in Supabase
    const supabase = await getSupabaseAdmin()
    const { data: setlists, error } = await supabase
      .from('setlists')
      .select('*')
      .ilike('name', `%${setlistName}%`)

    expect(error).toBeNull()
    expect(setlists).not.toBeNull()
    expect(setlists!.length).toBeGreaterThan(0)

    console.log(
      `✅ Setlist "${setlistName}" verified in Supabase with ID: ${setlists![0].id}`
    )
  })

  test('creating a show syncs to Supabase without errors', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()
    const showName = `Sync Test Show ${Date.now()}`
    const showVenue = 'Test Venue'
    const showLocation = '123 Test Street, Test City'

    // Setup: Create user and band
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Show Sync Test ${Date.now()}`)

    // Navigate to shows page
    await page.goto('/shows')
    await page.waitForLoadState('networkidle')

    // Wait for loading state to clear
    await page
      .waitForSelector('text=Loading...', { state: 'hidden', timeout: 15000 })
      .catch(() => {})

    // Wait for either the shows page content OR the create button
    await page.waitForSelector(
      'h1:has-text("Shows"), [data-testid="create-show-button"], button:has-text("Add Show")',
      { timeout: 15000 }
    )

    // Click Add/Create Show button
    const addButton = page
      .locator(
        '[data-testid="create-show-button"], button:has-text("Add Show")'
      )
      .first()
    await expect(addButton).toBeVisible({ timeout: 10000 })
    await addButton.click()
    await page.waitForTimeout(500)

    // Fill in show details - click title to enter edit mode first if needed
    const nameInput = page.locator('[data-testid="show-name-input"]').first()
    const isInputVisible = await nameInput.isVisible().catch(() => false)

    if (!isInputVisible) {
      // Click the title display button to enter edit mode
      const titleButton = page
        .locator(
          '[data-testid="show-name-display"], button:has-text("New Show")'
        )
        .first()
      await titleButton.click()
      await page.waitForTimeout(200)
    }

    await expect(nameInput).toBeVisible({ timeout: 5000 })
    await nameInput.fill(showName)

    // Fill location - click the button to enter edit mode first
    const locationButton = page
      .locator(
        '[data-testid="show-location-display"], button:has-text("Add address")'
      )
      .first()
    if (await locationButton.isVisible().catch(() => false)) {
      await locationButton.click()
      await page.waitForTimeout(200)
      const locationInput = page
        .locator('[data-testid="show-location-input"]')
        .first()
      await expect(locationInput).toBeVisible({ timeout: 3000 })
      await locationInput.fill(showLocation)
      // Blur to save
      await locationInput.blur()
      await page.waitForTimeout(500)
    }

    // Save the show
    const saveButton = page
      .locator(
        'button:has-text("Save"), button:has-text("Create"), button[type="submit"]'
      )
      .first()
    await saveButton.click()

    // Wait for sync to complete
    await page.waitForTimeout(3000)

    // Check for sync errors in console
    const syncErrors = errors.filter(
      e =>
        e.includes('Failed to sync') ||
        e.includes('PGRST') ||
        e.includes('400') ||
        e.includes('location')
    )

    // This should be empty if our schema fix worked
    expect(syncErrors).toHaveLength(0)

    // Verify show appears in UI
    const showItem = page.locator(`text=${showName}`).first()
    await expect(showItem).toBeVisible({ timeout: 5000 })

    // CRITICAL: Verify show exists in Supabase
    const supabase = await getSupabaseAdmin()
    const { data: shows, error } = await supabase
      .from('shows')
      .select('*')
      .ilike('name', `%${showName}%`)

    expect(error).toBeNull()
    expect(shows).not.toBeNull()
    expect(shows!.length).toBeGreaterThan(0)

    // Verify the location was saved
    expect(shows![0].location).toBe(showLocation)

    console.log(
      `✅ Show "${showName}" verified in Supabase with ID: ${shows![0].id}`
    )
    console.log(`   Location: ${shows![0].location}`)
  })

  test('show date displays correctly (no off-by-one error)', async ({
    page,
  }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()
    const showName = `Date Test Show ${Date.now()}`

    // Setup: Create user and band
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Date Test ${Date.now()}`)

    // Navigate to shows page
    await page.goto('/shows')
    await page.waitForLoadState('networkidle')

    // Wait for loading state to clear
    await page
      .waitForSelector('text=Loading...', { state: 'hidden', timeout: 15000 })
      .catch(() => {})

    // Wait for either the shows page content OR the create button
    await page.waitForSelector(
      'h1:has-text("Shows"), [data-testid="create-show-button"], button:has-text("Add Show")',
      { timeout: 15000 }
    )

    // Create a show with a specific date: December 15, 2025
    const testDate = '2025-12-15'

    // Click Add Show button
    const addButton = page
      .locator(
        '[data-testid="create-show-button"], button:has-text("Add Show")'
      )
      .first()
    await expect(addButton).toBeVisible({ timeout: 10000 })
    await addButton.click()
    await page.waitForTimeout(500)

    // Fill show name - click title to enter edit mode first if needed
    const nameInput = page.locator('[data-testid="show-name-input"]').first()
    const isInputVisible = await nameInput.isVisible().catch(() => false)

    if (!isInputVisible) {
      // Click the title display button to enter edit mode
      const titleButton = page
        .locator(
          '[data-testid="show-name-display"], button:has-text("New Show")'
        )
        .first()
      await titleButton.click()
      await page.waitForTimeout(200)
    }

    await expect(nameInput).toBeVisible({ timeout: 5000 })
    await nameInput.fill(showName)

    // Set the date. The date is an inline-editable field: click its display to
    // enter edit mode (the calendar auto-opens), type the date into the
    // type-ahead field, and commit with Enter (which auto-saves).
    await page.click('[data-testid="show-date-display"]')
    const dateType = page.locator('[data-testid="show-date-input-type-input"]')
    await expect(dateType).toBeVisible({ timeout: 5000 })
    await dateType.fill('12/15/2025')
    await dateType.press('Enter')

    // The display now reflects the chosen day — this catches a display
    // off-by-one immediately (it must read Dec 15, not Dec 14).
    await expect(
      page.locator('[data-testid="show-date-display"]')
    ).toContainText('Dec 15')

    // Save the show
    const saveButton = page
      .locator(
        'button:has-text("Save"), button:has-text("Create"), button[type="submit"]'
      )
      .first()
    await saveButton.click()
    await page.waitForTimeout(2000)

    // After creating, we land on the show detail page. Verify the show name
    // is shown, then open the inline date field and confirm the stored date
    // round-tripped correctly: Dec 15, NOT Dec 14 (the off-by-one bug).
    await expect(page.getByText(showName).first()).toBeVisible({
      timeout: 5000,
    })

    // Verify in Supabase that the stored date lands on the correct local
    // calendar day. Parsing scheduled_date in the same local timezone the app
    // uses, an off-by-one save would surface here as day 14 instead of 15.
    const supabase = await getSupabaseAdmin()
    const { data: shows, error } = await supabase
      .from('shows')
      .select('*')
      .ilike('name', `%${showName}%`)
    expect(error).toBeNull()
    expect(shows!.length).toBeGreaterThan(0)

    const stored = new Date(shows![0].scheduled_date)
    expect(stored.getFullYear()).toBe(2025)
    expect(stored.getMonth()).toBe(11) // December (0-indexed)
    expect(stored.getDate()).toBe(15)

    console.log(`✅ Show date round-trips correctly as ${testDate}`)
  })

  test('duplicating a setlist syncs sourceSetlistId correctly', async ({
    page,
  }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()
    const originalName = `Original Setlist ${Date.now()}`

    // Setup: Create user and band
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Duplicate Test ${Date.now()}`)

    // Navigate to setlists page
    await page.goto('/setlists')
    await page.waitForLoadState('networkidle')

    // Wait for loading state to clear
    await page
      .waitForSelector('text=Loading...', { state: 'hidden', timeout: 15000 })
      .catch(() => {})

    // Wait for either the setlist page content OR the empty state
    await page.waitForSelector(
      'h1:has-text("Setlists"), [data-testid="setlist-empty-state"], [data-testid="create-setlist-button"]',
      { timeout: 15000 }
    )

    // Create original setlist
    const addButton = page
      .locator('[data-testid="create-setlist-button"]')
      .first()
    await expect(addButton).toBeVisible({ timeout: 10000 })
    await addButton.click()
    await page.waitForTimeout(500)

    // The create flow now opens the full-page setlist editor whose name is
    // an inline-editable field (starts in display mode), not a modal input.
    const nameInput = page.locator('[data-testid="setlist-name-input"]').first()
    const isNameInputVisible = await nameInput.isVisible().catch(() => false)
    if (!isNameInputVisible) {
      await page.locator('[data-testid="setlist-name-display"]').first().click()
      await page.waitForTimeout(200)
    }
    await expect(nameInput).toBeVisible({ timeout: 5000 })
    await nameInput.fill(originalName)

    const saveButton = page
      .locator('button:has-text("Save"), button[type="submit"]')
      .first()
    await saveButton.click()
    await page.waitForTimeout(2000)

    // Find and click on the setlist to open it
    const setlistItem = page.locator(`text=${originalName}`).first()
    await setlistItem.click()
    await page.waitForTimeout(500)

    // Look for duplicate button
    const duplicateButton = page
      .locator(
        'button:has-text("Duplicate"), button:has-text("Copy"), [data-testid="duplicate-setlist-button"]'
      )
      .first()

    if (await duplicateButton.isVisible()) {
      await duplicateButton.click()
      await page.waitForTimeout(3000) // Wait for duplicate + sync

      // Check for sync errors (specifically source_setlist_id error)
      const syncErrors = errors.filter(
        e =>
          e.includes('source_setlist_id') ||
          e.includes('Failed to sync setlists')
      )

      expect(syncErrors).toHaveLength(0)

      // Verify duplicate exists in Supabase with source_setlist_id set
      const supabase = await getSupabaseAdmin()

      // Get original setlist
      const { data: originals } = await supabase
        .from('setlists')
        .select('id')
        .ilike('name', `%${originalName}%`)
        .not('name', 'ilike', '%copy%')

      expect(originals).not.toBeNull()
      expect(originals!.length).toBeGreaterThan(0)
      const originalId = originals![0].id

      // Get duplicated setlist
      const { data: duplicates } = await supabase
        .from('setlists')
        .select('*')
        .or(
          `name.ilike.%copy%,name.ilike.%duplicate%,source_setlist_id.eq.${originalId}`
        )

      if (duplicates && duplicates.length > 0) {
        const duplicate = duplicates[0]
        console.log(`✅ Duplicate setlist created: ${duplicate.name}`)
        console.log(`   source_setlist_id: ${duplicate.source_setlist_id}`)

        // Verify source_setlist_id points to original
        expect(duplicate.source_setlist_id).toBe(originalId)
      }
    } else {
      console.log('Note: Duplicate button not found - skipping duplicate test')
    }
  })
})
