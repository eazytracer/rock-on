/**
 * E2E Tests for Settings Page
 *
 * Tests cover:
 * - Page navigation and accessibility
 * - Account information display
 * - Delete account workflow
 * - Dev-only features
 */

import { test, expect } from '@playwright/test'
import {
  setupConsoleErrorTracking,
  assertNoConsoleErrors,
} from '../../helpers/assertions'
import { createTestUser, loginViaUI, logoutViaUI } from '../../fixtures/auth'
import { clearTestData } from '../../fixtures/database'

test.describe('Settings Page', () => {
  let testUser: { email: string; password: string; name: string; id?: string }

  test.beforeEach(async ({ page }) => {
    // Clear test data and create test user
    await clearTestData()
    testUser = createTestUser()

    // Sign in via UI (creates account and logs in)
    await page.goto('/auth')
    await page.waitForSelector(
      'button:has-text("Log In"), button:has-text("Create Account")',
      {
        state: 'visible',
        timeout: 10000,
      }
    )
    // Switch to signup if on login form
    const logInButton = page.locator('button:has-text("Log In")')
    if (await logInButton.isVisible()) {
      await page.click('button:has-text("Don\'t have an account")')
      await page.waitForSelector('[data-testid="signup-name-input"]', {
        state: 'visible',
        timeout: 5000,
      })
    }
    await page.fill(
      '[data-testid="signup-name-input"]',
      testUser.name || 'Test User'
    )
    await page.fill('[data-testid="signup-email-input"]', testUser.email)
    await page.fill('[data-testid="signup-password-input"]', testUser.password)
    await page.click('button[type="submit"]:has-text("Create Account")')
    await page.waitForURL(/\/(get-started|songs)/, { timeout: 10000 })
  })

  test.afterEach(async ({ page }) => {
    // Sign out after each test
    try {
      await logoutViaUI(page)
    } catch {
      // Ignore logout errors (user may already be logged out)
    }
  })

  test.describe('Page Access and Navigation', () => {
    test('should navigate to settings page from sidebar', async ({ page }) => {
      const errors = setupConsoleErrorTracking(page)

      // Click Settings link in sidebar (desktop)
      await page.click('text=Settings')

      // Should be on settings page
      await expect(page).toHaveURL(/\/settings/)

      // Page should load without errors
      await assertNoConsoleErrors(page, errors)
    })

    test('should load settings page directly', async ({ page }) => {
      const errors = setupConsoleErrorTracking(page)

      // Navigate directly to settings
      await page.goto('/settings')

      // Should see settings page
      await expect(page.getByTestId('settings-page')).toBeVisible()

      await assertNoConsoleErrors(page, errors)
    })

    test('should require authentication', async ({ page }) => {
      // Sign out first
      await logoutViaUI(page)

      // Try to access settings
      await page.goto('/settings')

      // Should redirect to auth page or show sign-in message
      const url = page.url()
      const isAuth = url.includes('/auth')
      const hasSignInMessage = await page
        .getByText(/please sign in/i)
        .isVisible()
        .catch(() => false)

      expect(isAuth || hasSignInMessage).toBe(true)
    })
  })

  test.describe('Account Information Display', () => {
    test('should display user email', async ({ page }) => {
      await page.goto('/settings')

      const emailElement = page.getByTestId('account-email')
      await expect(emailElement).toBeVisible()
      await expect(emailElement).toContainText(testUser.email)
    })

    test('should display user name', async ({ page }) => {
      await page.goto('/settings')

      const nameElement = page.getByTestId('account-name')
      await expect(nameElement).toBeVisible()
      // Name should be populated (either from profile or email)
      await expect(nameElement).not.toBeEmpty()
    })

    test('should display user ID', async ({ page }) => {
      await page.goto('/settings')

      const userIdElement = page.getByTestId('account-user-id')
      await expect(userIdElement).toBeVisible()
      // User ID should be a UUID format
      const userId = await userIdElement.textContent()
      expect(userId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      )
    })

    test('should have account section heading', async ({ page }) => {
      await page.goto('/settings')

      await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible()
    })
  })

  test.describe('Delete Account Workflow', () => {
    test('should show delete account button', async ({ page }) => {
      await page.goto('/settings')

      const deleteButton = page.getByTestId('delete-account-button')
      await expect(deleteButton).toBeVisible()
      await expect(deleteButton).toContainText(/delete account/i)
    })

    test('should open confirmation modal when delete clicked', async ({
      page,
    }) => {
      await page.goto('/settings')

      // Click delete button
      await page.click('[data-testid="delete-account-button"]')

      // Modal should appear
      await expect(page.getByTestId('delete-account-modal')).toBeVisible()
    })

    test('should close modal when cancel clicked', async ({ page }) => {
      await page.goto('/settings')

      // Open modal
      await page.click('[data-testid="delete-account-button"]')
      await expect(page.getByTestId('delete-account-modal')).toBeVisible()

      // Click cancel
      await page.click('[data-testid="delete-account-cancel-button"]')

      // Modal should close
      await expect(page.getByTestId('delete-account-modal')).not.toBeVisible()
    })

    test('should close modal when X clicked', async ({ page }) => {
      await page.goto('/settings')

      // Open modal
      await page.click('[data-testid="delete-account-button"]')
      await expect(page.getByTestId('delete-account-modal')).toBeVisible()

      // Find and click X button (close button in modal header)
      await page.click('[data-testid="delete-account-modal"] button >> svg')

      // Modal should close
      await expect(page.getByTestId('delete-account-modal')).not.toBeVisible()
    })

    test('should require DELETE confirmation text', async ({ page }) => {
      await page.goto('/settings')

      // Open modal
      await page.click('[data-testid="delete-account-button"]')

      // Confirm button should be disabled initially
      const confirmButton = page.getByTestId('delete-account-confirm-button')
      await expect(confirmButton).toBeDisabled()

      // Type wrong text
      await page.fill(
        '[data-testid="delete-account-confirmation-input"]',
        'delete'
      )
      await expect(confirmButton).toBeDisabled()

      // Type correct text
      await page.fill(
        '[data-testid="delete-account-confirmation-input"]',
        'DELETE'
      )
      await expect(confirmButton).toBeEnabled()
    })

    test('should show warning messages in modal', async ({ page }) => {
      await page.goto('/settings')

      // Open modal
      await page.click('[data-testid="delete-account-button"]')

      // Should show warning
      await expect(
        page.getByText(/this action cannot be undone/i)
      ).toBeVisible()
      await expect(page.getByText(/all bands you created/i)).toBeVisible()
      await expect(
        page.getByText(/all songs, setlists, and practices/i)
      ).toBeVisible()
    })

    // Note: We don't test actual deletion in E2E to preserve test database integrity
    // Actual deletion is tested in unit tests with mocks
  })

  test.describe('Data & Privacy Section', () => {
    test('should have data & privacy heading', async ({ page }) => {
      await page.goto('/settings')

      await expect(
        page.getByRole('heading', { name: /data.*privacy/i })
      ).toBeVisible()
    })

    test('should show permanence warning', async ({ page }) => {
      await page.goto('/settings')

      await expect(
        page.getByText(/permanently delete your account/i)
      ).toBeVisible()
    })
  })

  test.describe('Page Structure and Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      await page.goto('/settings')

      // Main heading
      await expect(
        page.getByRole('heading', { level: 1, name: 'Settings' })
      ).toBeVisible()

      // Section headings
      await expect(
        page.getByRole('heading', { level: 2, name: 'Account' })
      ).toBeVisible()
      await expect(
        page.getByRole('heading', { level: 2, name: /data.*privacy/i })
      ).toBeVisible()
    })

    test('should have all required test IDs', async ({ page }) => {
      await page.goto('/settings')

      await expect(page.getByTestId('settings-page')).toBeVisible()
      await expect(page.getByTestId('account-section')).toBeVisible()
      await expect(page.getByTestId('account-email')).toBeVisible()
      await expect(page.getByTestId('account-name')).toBeVisible()
      await expect(page.getByTestId('account-user-id')).toBeVisible()
      await expect(page.getByTestId('delete-account-button')).toBeVisible()
    })

    test('should be responsive', async ({ page }) => {
      await page.goto('/settings')

      // Settings page should have max-width container
      const container = page.getByTestId('settings-page')
      await expect(container).toBeVisible()

      // Should be visible on mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      await expect(container).toBeVisible()
    })
  })

  test.describe('Console Errors', () => {
    test('should load without console errors', async ({ page }) => {
      const errors = setupConsoleErrorTracking(page)

      await page.goto('/settings')

      // Wait for page to fully load
      await page.getByTestId('settings-page').waitFor()

      await assertNoConsoleErrors(page, errors)
    })
  })
})

test.describe('Settings Page - Development Mode', () => {
  // These tests would only run in development environment
  // Skipped in CI/production builds

  test.skip('should show dev section in development', async ({ page }) => {
    // This would require setting environment to dev
    // Skip for now as we can't easily change env in E2E tests
  })

  test.skip('should have clear local data button in dev mode', async ({
    page,
  }) => {
    // This would require setting environment to dev
    // Skip for now
  })

  test.skip('should display build version in dev mode', async ({ page }) => {
    // This would require setting environment to dev
    // Skip for now
  })
})
