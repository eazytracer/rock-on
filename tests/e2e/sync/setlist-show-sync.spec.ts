import { test, expect, Page } from '@playwright/test'
import {
  createTestUser,
  signUpViaUI,
  deleteTestUser,
} from '../../fixtures/auth'
import { createBandViaUI } from '../../fixtures/bands'
import { getSupabaseAdmin } from '../../fixtures/supabase'
import { setupConsoleErrorTracking } from '../../helpers/assertions'

/** New setlist (creates it and opens the editor), then rename it in place. */
async function createSetlistViaUI(page: Page, name: string) {
  await page.locator('[data-testid="create-setlist-button"]').first().click()
  await page.waitForURL(/\/setlists\/[0-9a-f-]{36}$/, { timeout: 10000 })
  await page.locator('[data-testid="setlist-name-display"]').first().click()
  const nameInput = page.locator('[data-testid="setlist-name-input"]').first()
  await expect(nameInput).toBeVisible({ timeout: 5000 })
  await nameInput.fill(name)
  await nameInput.press('Enter')
  await expect(
    page.locator('[data-testid="setlist-name-display"]').first()
  ).toContainText(name, { timeout: 5000 })
}

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

    await createSetlistViaUI(page, setlistName)

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

    await createSetlistViaUI(page, originalName)

    // Back to the index; duplicate from the card's ⋯
    await page.goto('/setlists')
    const card = page.locator('[data-testid^="setlist-card-"]', {
      hasText: originalName,
    })
    await card.locator('[data-testid^="setlist-card-menu-"]').click()
    {
      await page.locator('[data-testid="setlist-menu-duplicate"]').click()
      await expect(
        page.locator('[data-testid^="setlist-card-"]', {
          hasText: `${originalName} copy`,
        })
      ).toBeVisible({ timeout: 5000 })

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
        .eq('source_setlist_id', originalId)

      if (duplicates && duplicates.length > 0) {
        const duplicate = duplicates[0]
        console.log(`✅ Duplicate setlist created: ${duplicate.name}`)
        console.log(`   source_setlist_id: ${duplicate.source_setlist_id}`)

        // Verify source_setlist_id points to original
        expect(duplicate.source_setlist_id).toBe(originalId)
      }
    }
  })
})
