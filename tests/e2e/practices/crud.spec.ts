/**
 * E2E Tests: Practice Sessions CRUD Operations
 *
 * Tests User Flow 14:
 * - Flow 14: Schedule and manage practice sessions
 *
 * Updated 2026-01: Tests use new page-based flow (PracticeViewPage)
 * instead of the old modal-based workflow.
 *
 * The PracticeViewPage uses InlineEditableField components which require
 * clicking to enter edit mode before filling values.
 *
 * Updated 2026-10: the standalone /practices list was retired (it redirects to
 * /calendar?filter=practices). Listing, deleting and cross-member visibility
 * are asserted on the calendar agenda and its per-row kebab menu.
 *
 * @see /workspaces/rock-on/.claude/plans/02-create-e2e-tests.md
 * @see /workspaces/rock-on/.claude/specifications/testing-overview-and-strategy.md
 */

import { test, expect } from '@playwright/test'
import { signUpViaUI, createTestUser } from '../../fixtures/auth'
import {
  createBandViaUI,
  getInviteCodeViaUI,
  joinBandViaUI,
} from '../../fixtures/bands'
import {
  fillInlineEditableField,
  fillMarkdownField,
  clickToEdit,
  clickButtonReliably,
  closeBrowseSongsDrawer,
} from '../../helpers/inlineEditable'

test.describe('Practice Sessions CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    // ARRANGE: Create user and band
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, 'E2E Practice Test Band')

    // Practices live on the calendar agenda
    await page.goto('/calendar?filter=practices')
    await expect(page.locator('[data-testid="calendar-page"]')).toBeVisible({
      timeout: 10000,
    })
  })

  test('member can schedule a new practice session', async ({ page }) => {
    // ARRANGE: Verify we're on the practices calendar
    await expect(page).toHaveURL(/\/calendar\?filter=practices/)

    // ACT: With the practices filter active, "New" goes straight to the builder
    const createButton = page.locator('[data-testid="calendar-new-button"]')
    await expect(createButton).toBeVisible({ timeout: 10000 })
    await createButton.click()

    // Wait for navigation to /practices/new
    await page.waitForURL(/\/practices\/new/, { timeout: 10000 })

    // Wait for the page to fully load (Details section should be visible)
    await expect(page.locator('text=Details')).toBeVisible({ timeout: 10000 })

    // Fill in location using InlineEditableField helper
    await fillInlineEditableField(page, 'practice-location', 'Studio A')

    // Close the Browse Songs drawer if open (it auto-opens on new practice)
    await closeBrowseSongsDrawer(page)

    // Save by clicking Create Practice button (use reliable JS click)
    await clickButtonReliably(page, '[data-testid="create-practice-button"]')

    // ASSERT: Verify we navigate to the created practice
    await page.waitForURL(/\/practices\/(?!new)[^/]+$/, { timeout: 10000 })

    // Verify location is shown (appears in header and details)
    await expect(page.locator('text=Studio A').first()).toBeVisible({
      timeout: 5000,
    })
  })

  test('practice displays duration and location', async ({ page }) => {
    // ARRANGE: Create a practice
    await page.locator('button:has-text("Schedule Practice")').first().click()
    await page.waitForURL(/\/practices\/new/, { timeout: 10000 })
    await expect(page.locator('text=Details')).toBeVisible({ timeout: 10000 })

    // Set location using InlineEditableField helper
    await fillInlineEditableField(page, 'practice-location', 'Rehearsal Room')

    // Close the Browse Songs drawer if open
    await closeBrowseSongsDrawer(page)

    // Save the practice (use reliable JS click)
    await clickButtonReliably(page, '[data-testid="create-practice-button"]')

    // Wait for navigation to the created practice
    await page.waitForURL(/\/practices\/(?!new)[^/]+$/, { timeout: 10000 })

    // ACT & ASSERT: Verify location is displayed
    await expect(page.locator('text=Rehearsal Room').first()).toBeVisible({
      timeout: 10000,
    })

    // Verify duration is displayed (default is 2h)
    await expect(page.locator('text=2h')).toBeVisible({ timeout: 5000 })
  })

  test('practice can include notes', async ({ page }) => {
    // ARRANGE: Create practice with notes
    await page.locator('button:has-text("Schedule Practice")').first().click()
    await page.waitForURL(/\/practices\/new/, { timeout: 10000 })
    await expect(page.locator('text=Details')).toBeVisible({ timeout: 10000 })

    // Set location using InlineEditableField helper
    await fillInlineEditableField(page, 'practice-location', 'Main Studio')

    // Set notes — the notes field is a MarkdownField (not an InlineEditableField).
    await fillMarkdownField(page, 'practice-notes', 'Focus on new songs')

    // Close the Browse Songs drawer if open
    await closeBrowseSongsDrawer(page)

    // Save the practice (use reliable JS click)
    await clickButtonReliably(page, '[data-testid="create-practice-button"]')

    // Wait for navigation
    await page.waitForURL(/\/practices\/(?!new)[^/]+$/, { timeout: 10000 })

    // ACT & ASSERT: Verify practice was created with location
    await expect(page.locator('text=Main Studio').first()).toBeVisible({
      timeout: 10000,
    })
  })

  test('member can edit existing practice', async ({ page }) => {
    // ARRANGE: Create a practice first
    await page.locator('button:has-text("Schedule Practice")').first().click()
    await page.waitForURL(/\/practices\/new/, { timeout: 10000 })
    await expect(page.locator('text=Details')).toBeVisible({ timeout: 10000 })

    // Set initial location
    await fillInlineEditableField(
      page,
      'practice-location',
      'Original Location'
    )

    // Close the Browse Songs drawer if open
    await closeBrowseSongsDrawer(page)

    // Save the practice (use reliable JS click)
    await clickButtonReliably(page, '[data-testid="create-practice-button"]')
    await page.waitForURL(/\/practices\/(?!new)[^/]+$/, { timeout: 10000 })

    // Verify original location
    await expect(page.locator('text=Original Location').first()).toBeVisible({
      timeout: 10000,
    })

    // ACT: Edit the location (inline editing)
    await fillInlineEditableField(page, 'practice-location', 'Updated Location')

    // ASSERT: Verify changes
    await expect(page.locator('text=Updated Location').first()).toBeVisible({
      timeout: 10000,
    })
    await expect(page.locator('text=Original Location')).not.toBeVisible()
  })

  test('member can delete practice', async ({ page }) => {
    // ARRANGE: Create a practice
    await page.locator('button:has-text("Schedule Practice")').first().click()
    await page.waitForURL(/\/practices\/new/, { timeout: 10000 })
    await expect(page.locator('text=Details')).toBeVisible({ timeout: 10000 })

    // Set location
    await fillInlineEditableField(
      page,
      'practice-location',
      'Delete Test Location'
    )

    // Close the Browse Songs drawer if open
    await closeBrowseSongsDrawer(page)

    // Save the practice (use reliable JS click)
    await clickButtonReliably(page, '[data-testid="create-practice-button"]')
    await page.waitForURL(/\/practices\/(?!new)[^/]+$/, { timeout: 10000 })

    // Verify practice was created
    await expect(page.locator('text=Delete Test Location').first()).toBeVisible(
      { timeout: 10000 }
    )

    // Go back to the calendar (upcoming + past are both listed)
    await page.goto('/calendar?filter=practices')

    const practiceRow = page
      .locator('[data-testid^="calendar-item-practice-"]')
      .filter({ hasText: 'Delete Test Location' })
    await expect(practiceRow).toBeVisible({ timeout: 10000 })

    // ACT: Delete via the row's kebab menu + confirmation dialog
    await practiceRow.locator('[data-testid^="calendar-item-kebab-"]').click()
    await page.locator('[data-testid^="calendar-item-delete-"]').click()
    await page.locator('[data-testid="confirm-dialog-confirm"]').click()

    // ASSERT: Verify practice is gone
    await expect(practiceRow).toHaveCount(0, { timeout: 10000 })
  })

  test('practice changes sync to all band members', async ({
    page,
    context,
  }) => {
    // ARRANGE: Create user A and band
    const userA = createTestUser()
    await signUpViaUI(page, userA)
    await createBandViaUI(page, 'Practice Sync Test Band')

    // Get invite code
    await page.goto('/band-members')
    const inviteCode = await getInviteCodeViaUI(page)

    // Create user B in new context
    const page2 = await context.newPage()
    const userB = createTestUser()
    await signUpViaUI(page2, userB)
    await joinBandViaUI(page2, inviteCode)

    // Both pages navigate to the practices calendar
    await page.goto('/calendar?filter=practices')
    await page2.goto('/calendar?filter=practices')

    // ACT: User A creates practice using new page-based flow
    await page.locator('[data-testid="calendar-new-button"]').click()
    await page.waitForURL(/\/practices\/new/, { timeout: 10000 })
    await expect(page.locator('text=Details')).toBeVisible({ timeout: 10000 })

    // Set location using InlineEditableField helper
    await fillInlineEditableField(page, 'practice-location', 'Synced Location')

    // Close the Browse Songs drawer if open
    await closeBrowseSongsDrawer(page)

    // Save the practice (use reliable JS click)
    await clickButtonReliably(page, '[data-testid="create-practice-button"]')
    await page.waitForURL(/\/practices\/(?!new)[^/]+$/, { timeout: 10000 })

    // User A goes back to the calendar
    await page.goto('/calendar?filter=practices')

    // Verify User A sees the practice
    await expect(page.locator('text=Synced Location').first()).toBeVisible({
      timeout: 10000,
    })

    // ASSERT: User B should see it appear (realtime sync or after refresh)
    await page2.reload()

    await expect(page2.locator('text=Synced Location').first()).toBeVisible({
      timeout: 20000,
    })

    // Cleanup
    await page2.close()
  })
})
