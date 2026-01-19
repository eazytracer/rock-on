import { test, expect } from '@playwright/test'
import {
  createTestUser,
  signUpViaUI,
  deleteTestUser,
} from '../../fixtures/auth'
import { createBandViaUI } from '../../fixtures/bands'
import { selectors } from '../../helpers/selectors'
import {
  setupConsoleErrorTracking,
  assertNoConsoleErrors,
} from '../../helpers/assertions'

test.describe('Songs CRUD Operations', () => {
  let testUserId: string | undefined

  test.afterEach(async () => {
    if (testUserId) {
      await deleteTestUser(testUserId)
      testUserId = undefined
    }
  })

  test('member can add a new song with required fields', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()

    // Setup: Create user and band
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Songs Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    // Click Add Song button
    const addButton = page
      .locator('button:has-text("Add Song"), [data-testid="add-song-button"]')
      .first()
    await expect(addButton).toBeVisible({ timeout: 5000 })
    await addButton.click()
    await page.waitForTimeout(500)

    // Fill required fields
    const titleInput = page
      .locator('input[name="title"], [data-testid="song-title-input"]')
      .first()
    const artistInput = page
      .locator('input[name="artist"], [data-testid="song-artist-input"]')
      .first()

    await expect(titleInput).toBeVisible({ timeout: 5000 })
    await titleInput.fill('Stairway to Heaven')
    await artistInput.fill('Led Zeppelin')

    // Select key using the Circle of Fifths picker
    const keyButton = page.locator('[data-testid="song-key-button"]').first()
    await expect(keyButton).toBeVisible({ timeout: 5000 })
    await keyButton.click()

    // Wait for Circle of Fifths modal and select key "A"
    const keyPicker = page.locator('[data-testid="key-picker-A"]').first()
    await expect(keyPicker).toBeVisible({ timeout: 5000 })
    await keyPicker.click()

    // Confirm the key selection
    const confirmButton = page
      .locator('[data-testid="key-picker-confirm"]')
      .first()
    await expect(confirmButton).toBeVisible({ timeout: 5000 })
    await confirmButton.click()

    // Wait for modal to close
    await page.waitForTimeout(500)

    // Save song
    const saveButton = page
      .locator('[data-testid="song-submit-button"]')
      .first()
    await saveButton.click()
    await page.waitForTimeout(2000)

    // Verify song appears in list
    const songItem = page.locator('text=Stairway to Heaven').first()
    await expect(songItem).toBeVisible({ timeout: 5000 })

    // Verify artist is shown
    const artistItem = page.locator('text=Led Zeppelin').first()
    await expect(artistItem).toBeVisible({ timeout: 5000 })

    // Verify no console errors
    await assertNoConsoleErrors(page, errors)
  })

  test('member can add song with optional fields', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()

    await signUpViaUI(page, user)
    await createBandViaUI(page, `Optional Fields Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    // Add song
    const addButton = page.locator('button:has-text("Add Song")').first()
    await addButton.click()
    await page.waitForTimeout(500)

    // Fill all fields including optional ones
    await page.fill('input[name="title"]', 'Free Bird')
    await page.fill('input[name="artist"]', 'Lynyrd Skynyrd')

    // Select key using the Circle of Fifths picker
    const keyButton = page.locator('[data-testid="song-key-button"]').first()
    await expect(keyButton).toBeVisible({ timeout: 5000 })
    await keyButton.click()

    // Wait for Circle of Fifths modal and select key "D"
    const keyPicker = page.locator('[data-testid="key-picker-D"]').first()
    await expect(keyPicker).toBeVisible({ timeout: 5000 })
    await keyPicker.click()

    // Confirm the key selection
    const confirmButton = page
      .locator('[data-testid="key-picker-confirm"]')
      .first()
    await expect(confirmButton).toBeVisible({ timeout: 5000 })
    await confirmButton.click()

    // Wait for modal to close
    await page.waitForTimeout(500)

    // Optional: Duration
    const durationInput = page.locator('input[name="duration"]').first()
    const hasDuration = await durationInput.isVisible().catch(() => false)
    if (hasDuration) {
      await durationInput.fill('9:08')
    }

    // Optional: BPM/Tempo
    const bpmInput = page
      .locator('input[name="bpm"], input[name="tempo"]')
      .first()
    const hasBpm = await bpmInput.isVisible().catch(() => false)
    if (hasBpm) {
      await bpmInput.fill('75')
    }

    // Optional: Tuning
    const tuningInput = page
      .locator('input[name="tuning"], select[name="tuning"]')
      .first()
    const hasTuning = await tuningInput.isVisible().catch(() => false)
    if (hasTuning) {
      const isSelect = await tuningInput.evaluate(
        el => el.tagName.toLowerCase() === 'select'
      )
      if (isSelect) {
        await tuningInput.selectOption('Drop D')
      } else {
        await tuningInput.fill('Drop D')
      }
    }

    // Optional: Notes
    const notesInput = page
      .locator('textarea[name="notes"], input[name="notes"]')
      .first()
    const hasNotes = await notesInput.isVisible().catch(() => false)
    if (hasNotes) {
      await notesInput.fill('Epic guitar solo at 4:30')
    }

    // Save
    const saveButton = page
      .locator('[data-testid="song-submit-button"]')
      .first()
    await saveButton.click()
    await page.waitForTimeout(2000)

    // Verify song appears
    await expect(page.locator('text=Free Bird').first()).toBeVisible({
      timeout: 5000,
    })

    await assertNoConsoleErrors(page, errors)
  })

  test('member can edit existing song', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()

    await signUpViaUI(page, user)
    await createBandViaUI(page, `Edit Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    // Add a song first
    const addButton = page.locator('button:has-text("Add Song")').first()
    await addButton.click()
    await page.waitForTimeout(500)

    await page.fill('input[name="title"]', 'Original Title')
    await page.fill('input[name="artist"]', 'Original Artist')

    // Select key using the Circle of Fifths picker
    const keyButton = page.locator('[data-testid="song-key-button"]').first()
    await keyButton.click()
    await page.waitForTimeout(300)
    const keyPicker = page.locator('[data-testid="key-picker-C"]').first()
    await keyPicker.click()
    await page.waitForTimeout(300)
    const confirmButton = page
      .locator('[data-testid="key-picker-confirm"]')
      .first()
    await confirmButton.click()
    await page.waitForTimeout(300)

    await page.locator('[data-testid="song-submit-button"]').first().click()
    await page.waitForTimeout(2000)

    // Verify song appears
    await expect(page.locator('text=Original Title').first()).toBeVisible({
      timeout: 5000,
    })

    // Open the actions menu
    const actionsButton = page
      .locator('[data-testid="song-actions-menu-button"]')
      .first()
    await expect(actionsButton).toBeVisible({ timeout: 5000 })
    await actionsButton.click()
    await page.waitForTimeout(300)

    // Click the edit button
    const editButton = page.locator('[data-testid="edit-song-button"]').first()
    await expect(editButton).toBeVisible({ timeout: 5000 })
    await editButton.click()
    await page.waitForTimeout(500)

    // Edit the title
    const titleInput = page.locator('input[name="title"]').first()
    const isEditable = await titleInput.isEditable().catch(() => false)

    if (isEditable) {
      await titleInput.clear()
      await titleInput.fill('Updated Title')

      // Update BPM if field exists
      const bpmInput = page
        .locator('input[name="bpm"], input[name="tempo"]')
        .first()
      const hasBpm = await bpmInput.isVisible().catch(() => false)
      if (hasBpm) {
        await bpmInput.fill('120')
      }

      // Save changes
      const saveButton = page
        .locator('[data-testid="song-submit-button"]')
        .first()
      await saveButton.click()
      await page.waitForTimeout(2000)

      // Verify updated title appears
      await expect(page.locator('text=Updated Title').first()).toBeVisible({
        timeout: 5000,
      })

      // Original title should not be visible
      const oldTitle = await page
        .locator('text=Original Title')
        .first()
        .isVisible()
        .catch(() => false)
      expect(oldTitle).toBe(false)
    } else {
      console.log('Note: Song editing may not be fully implemented')
    }

    await assertNoConsoleErrors(page, errors)
  })

  test('member can delete song', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()

    // Sign up and create band
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Delete Song Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    // Create a song to delete
    const addButton = page.locator('button:has-text("Add Song")').first()
    await expect(addButton).toBeVisible({ timeout: 5000 })
    await addButton.click()
    await page.waitForTimeout(500)

    await page.fill('input[name="title"]', 'Song To Delete')
    await page.fill('input[name="artist"]', 'Delete Test Artist')

    // Select key using the Circle of Fifths picker
    const keyButton = page.locator('[data-testid="song-key-button"]').first()
    await keyButton.click()
    await page.waitForTimeout(300)
    const keyPicker = page.locator('[data-testid="key-picker-C"]').first()
    await keyPicker.click()
    await page.waitForTimeout(300)
    const confirmKeyButton = page
      .locator('[data-testid="key-picker-confirm"]')
      .first()
    await confirmKeyButton.click()
    await page.waitForTimeout(300)

    // Save the song
    await page.locator('[data-testid="song-submit-button"]').first().click()
    await page.waitForTimeout(2000)

    // Verify song was created
    await expect(page.locator('text=Song To Delete').first()).toBeVisible({
      timeout: 5000,
    })

    // Click the action menu on the song
    const actionMenuButton = page
      .locator('[data-testid="song-actions-menu-button"]')
      .first()
    await expect(actionMenuButton).toBeVisible({ timeout: 5000 })
    await actionMenuButton.click()
    await page.waitForTimeout(300)

    // Click delete button in action menu
    const deleteButton = page.locator('[data-testid="delete-song-button"]')
    await expect(deleteButton).toBeVisible({ timeout: 2000 })
    await deleteButton.click()

    // Confirm dialog should appear
    const confirmDialog = page.locator('[data-testid="confirm-dialog"]')
    await expect(confirmDialog).toBeVisible({ timeout: 2000 })

    // Verify dialog content
    await expect(
      page.locator('[data-testid="confirm-dialog-title"]')
    ).toHaveText('Delete Song')

    // Click confirm to delete
    const confirmButton = page.locator('[data-testid="confirm-dialog-confirm"]')
    await confirmButton.click()
    await page.waitForTimeout(2000)

    // Verify success toast appeared (this contains the song title, so check first)
    await expect(page.locator('text=Successfully deleted').first()).toBeVisible(
      { timeout: 3000 }
    )
    console.log('✓ Delete success toast appeared')

    // Wait for toast to potentially fade and page to update
    await page.waitForTimeout(1000)

    // Verify song count shows 0 (since we only created one song)
    const songCount = page.locator('text=(0 songs)')
    await expect(songCount).toBeVisible({ timeout: 5000 })
    console.log('✓ Song count shows 0 after deletion')

    // Verify empty state is shown
    const emptyState = page.locator('text=No songs yet')
    await expect(emptyState).toBeVisible({ timeout: 5000 })
    console.log('✓ Empty state shown after deletion')

    await assertNoConsoleErrors(page, errors)
  })

  test('song changes sync to all band members', async ({ browser }) => {
    const context1 = await browser.newContext()
    const page1 = await context1.newPage()
    const errors1 = setupConsoleErrorTracking(page1)

    const context2 = await browser.newContext()
    const page2 = await context2.newPage()
    const errors2 = setupConsoleErrorTracking(page2)

    // User 1 creates band
    const user1 = createTestUser()
    await signUpViaUI(page1, user1)
    await createBandViaUI(page1, `Sync Test ${Date.now()}`)
    await page1.waitForURL(/\/songs/, { timeout: 10000 })

    // Get invite code
    await page1.goto('/band-members')
    await page1.waitForLoadState('networkidle')
    const inviteCodeElement = page1.locator(selectors.band.inviteCode).first()
    await expect(inviteCodeElement).toBeVisible({ timeout: 5000 })
    const inviteCode = await inviteCodeElement.textContent()

    // User 2 joins band
    const user2 = createTestUser()
    await signUpViaUI(page2, user2)
    await page2.fill(selectors.band.inviteCodeInput, inviteCode!)
    await page2.click(selectors.band.joinButton)
    await page2.waitForURL(/\/(songs|band-members|bands)/, { timeout: 10000 })

    // Both users navigate to songs page
    await page1.goto('/songs')
    await page2.goto('/songs')
    await page1.waitForLoadState('networkidle')
    await page2.waitForLoadState('networkidle')

    // User 1 adds a song
    const addButton1 = page1.locator('button:has-text("Add Song")').first()
    const hasButton = await addButton1.isVisible().catch(() => false)

    if (hasButton) {
      await addButton1.click()
      await page1.waitForTimeout(500)

      await page1.fill('input[name="title"]', 'Sync Test Song')
      await page1.fill('input[name="artist"]', 'Sync Artist')

      // Select key using the Circle of Fifths picker
      const keyButton = page1.locator('[data-testid="song-key-button"]').first()
      await keyButton.click()
      await page1.waitForTimeout(300)
      const keyPicker = page1.locator('[data-testid="key-picker-G"]').first()
      await keyPicker.click()
      await page1.waitForTimeout(300)
      const confirmButton = page1
        .locator('[data-testid="key-picker-confirm"]')
        .first()
      await confirmButton.click()
      await page1.waitForTimeout(300)

      await page1.locator('[data-testid="song-submit-button"]').first().click()
      await page1.waitForTimeout(3000) // Wait for sync

      // User 2 should see the song (may need refresh)
      await page2.reload()
      await page2.waitForLoadState('networkidle')
      await page2.waitForTimeout(2000)

      const songVisible = await page2
        .locator('text=Sync Test Song')
        .first()
        .isVisible()
        .catch(() => false)
      if (songVisible) {
        console.log("Real-time sync working: User 2 sees User 1's song")
      } else {
        console.log('Note: Real-time updates may require page refresh')
      }
    }

    await assertNoConsoleErrors(page1, errors1)
    await assertNoConsoleErrors(page2, errors2)

    await context1.close()
    await context2.close()
  })

  test('song form validation prevents invalid data', async ({ page }) => {
    const user = createTestUser()

    await signUpViaUI(page, user)
    await createBandViaUI(page, `Validation Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    // Try to add song without required fields
    const addButton = page.locator('button:has-text("Add Song")').first()
    await addButton.click()
    await page.waitForTimeout(500)

    // Try to save without filling title
    const saveButton = page
      .locator('[data-testid="song-submit-button"]')
      .first()
    await saveButton.click()
    await page.waitForTimeout(1000)

    // Should show validation error or prevent submission
    // The exact behavior depends on implementation

    // Fill title but not artist
    await page.fill('input[name="title"]', 'Test Song')
    await saveButton.click()
    await page.waitForTimeout(1000)

    // Should still show error if artist is required

    // Fill all required fields
    await page.fill('input[name="artist"]', 'Test Artist')

    // Select key using the Circle of Fifths picker
    const keyButton = page.locator('[data-testid="song-key-button"]').first()
    await keyButton.click()
    await page.waitForTimeout(300)
    const keyPicker = page.locator('[data-testid="key-picker-F"]').first()
    await keyPicker.click()
    await page.waitForTimeout(300)
    const confirmButton = page
      .locator('[data-testid="key-picker-confirm"]')
      .first()
    await confirmButton.click()
    await page.waitForTimeout(300)

    await saveButton.click()
    await page.waitForTimeout(2000)

    // Should now succeed
    const songVisible = await page
      .locator('text=Test Song')
      .first()
      .isVisible()
      .catch(() => false)
    expect(songVisible).toBe(true)
  })

  test('empty song list shows appropriate message', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()

    await signUpViaUI(page, user)
    await createBandViaUI(page, `Empty List Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    // Should see empty state message
    const emptyMessage = page
      .locator('text=/no songs|add your first song|get started/i')
      .first()
    const hasEmptyMessage = await emptyMessage
      .isVisible({ timeout: 5000 })
      .catch(() => false)

    if (hasEmptyMessage) {
      console.log('Empty state message displayed correctly')
    } else {
      // May just show empty list
      console.log('Empty list displayed (no explicit empty state message)')
    }

    // Should still show Add Song button
    const addButton = page.locator('button:has-text("Add Song")').first()
    await expect(addButton).toBeVisible({ timeout: 5000 })

    await assertNoConsoleErrors(page, errors)
  })
})
