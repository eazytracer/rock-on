import { test, expect } from '@playwright/test'
import {
  createTestUser,
  signUpViaUI,
  deleteTestUser,
} from '../../fixtures/auth'
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

    // Step 2: Create band
    const bandName = `Test Band ${Date.now()}`
    const bandNameInput = page.locator(selectors.band.nameInput)
    await expect(bandNameInput).toBeVisible()

    await bandNameInput.fill(bandName)

    const createButton = page.locator(selectors.band.createButton)
    await createButton.click()

    // Step 3: Verify redirect to songs page
    await page.waitForURL(/\/songs/, { timeout: 10000 })
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
    const bandName = `RLS Test Band ${Date.now()}`
    await page.fill(selectors.band.nameInput, bandName)
    await page.click(selectors.band.createButton)

    // Wait for redirect
    await page.waitForURL(/\/songs/, { timeout: 10000 })

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

    // Fill signup form
    await page.fill(selectors.auth.nameInput, user.name)
    await page.fill(selectors.auth.signupEmailInput, user.email)
    await page.fill(selectors.auth.signupPasswordInput, user.password)
    await page.fill(selectors.auth.confirmPasswordInput, user.password)

    // Submit
    await page.click(selectors.auth.signUpButton)

    // Should go to get-started
    await expect(page).toHaveURL(/\/get-started/, { timeout: 10000 })

    // Should see both options: Create Band and Join Band
    await expect(
      page.locator('text=Create Your First Band').first()
    ).toBeVisible()
    await expect(
      page.locator('text=Join an Existing Band').first()
    ).toBeVisible()

    // Should see band name input
    await expect(page.locator(selectors.band.nameInput)).toBeVisible()

    // Should see invite code input
    await expect(page.locator(selectors.band.inviteCodeInput)).toBeVisible()
  })
})
