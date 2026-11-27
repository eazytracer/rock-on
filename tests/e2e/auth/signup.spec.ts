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

test.describe('User Signup and Band Creation', () => {
  test.describe.configure({ mode: 'serial' }) // Run tests in order

  let testUserId: string | undefined

  test.afterEach(async () => {
    // Clean up test user if created
    if (testUserId) {
      await deleteTestUser(testUserId)
      testUserId = undefined
    }
  })

  test('new user can sign up and create first band', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()

    // Step 1: Sign up
    await signUpViaUI(page, user)

    // Should redirect to get-started page
    await expect(page).toHaveURL(/\/get-started/, { timeout: 10000 })

    // Step 2: Create a band (Get started row → New band)
    const bandName = `Test Band ${Date.now()}`
    await page.getByTestId('get-started-create-band').click()
    await expect(page).toHaveURL(/\/band\/new/)
    await createBandViaUI(page, bandName)

    // Step 3: createBandViaUI ends on Songs
    await expect(page).toHaveURL(/\/songs/)

    // Step 4: Verify band name is in the DOM (may be hidden on mobile)
    const sidebarBandName = page.locator(selectors.band.sidebarBandName).first()
    await expect(sidebarBandName).toBeAttached({ timeout: 5000 })
    await expect(sidebarBandName).toHaveText(bandName)

    // Step 5: No console errors (especially no RLS errors)
    await assertNoConsoleErrors(page, errors)
  })

  test('band creation handles RLS policies correctly', async ({ page }) => {
    const user = createTestUser()

    // Track console for RLS errors (only errors, not info/log messages)
    const rlsErrors: string[] = []
    page.on('console', msg => {
      // Only capture error-type messages that indicate RLS failures
      if (msg.type() === 'error') {
        const text = msg.text()
        // Look for actual RLS policy violations, not just log messages
        if (
          text.toLowerCase().includes('rls') ||
          text.toLowerCase().includes('row-level security') ||
          text.includes('policy violation') ||
          (text.includes('permission denied') && !text.includes('permissions:'))
        ) {
          rlsErrors.push(text)
        }
      }
    })

    // Sign up
    await signUpViaUI(page, user)
    await expect(page).toHaveURL(/\/get-started/, { timeout: 10000 })

    // Create band
    await createBandViaUI(page, `RLS Test Band ${Date.now()}`)

    // Verify no RLS errors
    expect(rlsErrors).toHaveLength(0)

    // Verify we can interact with the page (no permission issues)
    const pageContent = await page.textContent('body')
    expect(pageContent).toBeTruthy()
  })

  test('new user sees correct onboarding flow', async ({ page }) => {
    const user = createTestUser()

    // Navigate to auth page
    await page.goto('/auth')

    // Switch to signup
    const switchButton = page.locator(selectors.auth.switchToSignUp)
    await switchButton.click()

    // Fill signup form: one password field, no confirm
    await expect(page).toHaveURL(/\/auth\/signup/)
    await page.fill(selectors.auth.nameInput, user.name)
    await page.fill(selectors.auth.signupEmailInput, user.email)
    await page.fill(selectors.auth.signupPasswordInput, user.password)

    // Submit
    await page.click(selectors.auth.signUpButton)

    // Should go to get-started, with its four paths
    await expect(page).toHaveURL(/\/get-started/, { timeout: 10000 })
    for (const id of [
      'get-started-create-band',
      'get-started-join-band',
      'get-started-jam-code',
      'personal-account-button',
    ]) {
      await expect(page.getByTestId(id)).toBeVisible()
    }
  })
})
