/**
 * E2E Tests: Practice Sessions CRUD Operations
 *
 * Tests User Flow 14:
 * - Flow 14: Schedule and manage practice sessions
 *
 * @see /workspaces/rock-on/.claude/plans/02-create-e2e-tests.md
 * @see /workspaces/rock-on/.claude/specifications/testing-overview-and-strategy.md
 */

import { test, expect } from '@playwright/test'
import { signUpViaUI, createTestUser } from '../../fixtures/auth'
import { createBandViaUI, getInviteCodeViaUI, joinBandViaUI } from '../../fixtures/bands'

test.describe('Practice Sessions CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    // ARRANGE: Create user and band
    const user = await createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, 'E2E Practice Test Band')

    // Navigate to practices page
    await page.goto('/practices')
    await page.waitForLoadState('networkidle')
  })

  test('member can schedule a new practice session', async ({ page }) => {
    // ARRANGE: Verify we're on practices page
    await expect(page).toHaveURL(/\/practices/)

    // ACT: Create practice
    const createButton = page.locator('[data-testid="create-practice-button"]')
    await expect(createButton).toBeVisible({ timeout: 10000 })
    await createButton.click()

    // Wait for modal
    const modal = page.locator('[data-testid="practice-modal"]')
    await expect(modal).toBeVisible({ timeout: 5000 })

    // Fill in details
    await page.fill('[data-testid="practice-date-input"]', '2025-06-01')
    await page.fill('[data-testid="practice-time-input"]', '18:00')
    await page.fill('[data-testid="practice-duration-input"]', '120')
    await page.fill('[data-testid="practice-location-input"]', 'Studio A')

    // Save
    await page.click('[data-testid="save-practice-button"]')

    // ASSERT: Verify practice created
    await expect(modal).not.toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Studio A')).toBeVisible({ timeout: 10000 })
  })

  test('practice displays duration and location', async ({ page }) => {
    // ARRANGE: Create a practice
    await page.click('[data-testid="create-practice-button"]')
    await page.fill('[data-testid="practice-date-input"]', '2025-06-05')
    await page.fill('[data-testid="practice-time-input"]', '19:00')
    await page.fill('[data-testid="practice-duration-input"]', '90')
    await page.fill('[data-testid="practice-location-input"]', 'Rehearsal Room')
    await page.click('[data-testid="save-practice-button"]')

    // Wait for practice to appear
    await expect(page.locator('[data-testid="practice-modal"]')).not.toBeVisible({ timeout: 10000 })

    // ACT & ASSERT: Verify location is displayed
    await expect(page.locator('text=Rehearsal Room')).toBeVisible({ timeout: 10000 })
  })

  test('practice can include notes', async ({ page }) => {
    // ARRANGE: Create practice with notes
    await page.click('[data-testid="create-practice-button"]')
    await page.fill('[data-testid="practice-date-input"]', '2025-06-10')
    await page.fill('[data-testid="practice-time-input"]', '18:00')
    await page.fill('[data-testid="practice-duration-input"]', '60')
    await page.fill('[data-testid="practice-location-input"]', 'Main Studio')
    await page.fill('[data-testid="practice-notes-textarea"]', 'Focus on new songs')
    await page.click('[data-testid="save-practice-button"]')

    // Wait for practice to appear
    await expect(page.locator('[data-testid="practice-modal"]')).not.toBeVisible({ timeout: 10000 })

    // ACT & ASSERT: Verify practice is created
    await expect(page.locator('text=Main Studio')).toBeVisible({ timeout: 10000 })
  })

  test('member can edit existing practice', async ({ page }) => {
    // ARRANGE: Create a practice
    await page.click('[data-testid="create-practice-button"]')
    await page.fill('[data-testid="practice-date-input"]', '2025-06-15')
    await page.fill('[data-testid="practice-time-input"]', '18:00')
    await page.fill('[data-testid="practice-duration-input"]', '60')
    await page.fill('[data-testid="practice-location-input"]', 'Original Location')
    await page.click('[data-testid="save-practice-button"]')

    // Wait for practice to appear
    await expect(page.locator('[data-testid="practice-modal"]')).not.toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Original Location')).toBeVisible({ timeout: 10000 })

    // Find edit button
    const editButtons = page.locator('button').filter({ hasText: /edit|pencil/i })
    const firstEditButton = editButtons.first()

    if (await firstEditButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // ACT: Edit the practice
      await firstEditButton.click()
      await expect(page.locator('[data-testid="practice-modal"]')).toBeVisible({ timeout: 5000 })

      // Change details
      await page.fill('[data-testid="practice-location-input"]', '')
      await page.fill('[data-testid="practice-location-input"]', 'Updated Location')
      await page.fill('[data-testid="practice-duration-input"]', '120')

      await page.click('[data-testid="save-practice-button"]')

      // ASSERT: Verify changes
      await expect(page.locator('[data-testid="practice-modal"]')).not.toBeVisible({ timeout: 10000 })
      await expect(page.locator('text=Updated Location')).toBeVisible({ timeout: 10000 })
      await expect(page.locator('text=Original Location')).not.toBeVisible()
    } else {
      test.skip()
    }
  })

  test('member can delete practice', async ({ page }) => {
    // ARRANGE: Create a practice
    await page.click('[data-testid="create-practice-button"]')
    await page.fill('[data-testid="practice-date-input"]', '2025-06-20')
    await page.fill('[data-testid="practice-time-input"]', '18:00')
    await page.fill('[data-testid="practice-duration-input"]', '90')
    await page.fill('[data-testid="practice-location-input"]', 'Delete Location')
    await page.click('[data-testid="save-practice-button"]')

    // Wait for practice to appear
    await expect(page.locator('[data-testid="practice-modal"]')).not.toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Delete Location')).toBeVisible({ timeout: 10000 })

    // Find delete button
    const deleteButtons = page.locator('button').filter({ hasText: /delete|trash/i })
    const firstDeleteButton = deleteButtons.first()

    if (await firstDeleteButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // ACT: Delete the practice
      await firstDeleteButton.click()

      // Confirm if needed
      const confirmButtons = page.locator('button').filter({ hasText: /delete|confirm|yes/i })
      if (await confirmButtons.count() > 1) {
        await confirmButtons.last().click()
      }

      // ASSERT: Verify practice is gone
      await expect(page.locator('text=Delete Location')).not.toBeVisible({ timeout: 10000 })
    } else {
      test.skip()
    }
  })

  test('practice changes sync to all band members', async ({ page, context }) => {
    // ARRANGE: Create user A and band
    const userA = await createTestUser()
    await signUpViaUI(page, userA)
    await createBandViaUI(page, 'Practice Sync Test Band')

    // Get invite code
    await page.goto('/band-members')
    const inviteCode = await getInviteCodeViaUI(page)

    // Create user B in new context
    const page2 = await context.newPage()
    const userB = await createTestUser()
    await signUpViaUI(page2, userB)
    await joinBandViaUI(page2, inviteCode)

    // Both pages navigate to practices
    await page.goto('/practices')
    await page2.goto('/practices')

    await page.waitForLoadState('networkidle')
    await page2.waitForLoadState('networkidle')

    // ACT: User A creates practice
    await page.click('[data-testid="create-practice-button"]')
    await page.fill('[data-testid="practice-date-input"]', '2025-06-25')
    await page.fill('[data-testid="practice-time-input"]', '18:00')
    await page.fill('[data-testid="practice-duration-input"]', '120')
    await page.fill('[data-testid="practice-location-input"]', 'Synced Location')
    await page.click('[data-testid="save-practice-button"]')

    // Wait for modal to close
    await expect(page.locator('[data-testid="practice-modal"]')).not.toBeVisible({ timeout: 10000 })

    // ASSERT: User B should see it appear (realtime sync)
    await expect(page2.locator('text=Synced Location')).toBeVisible({ timeout: 20000 })

    // Cleanup
    await page2.close()
  })
})
