import { Page, expect } from '@playwright/test'
import { getSupabaseAdmin } from './supabase'

export interface TestUser {
  email: string
  password: string
  name: string
  id?: string
}

/**
 * Generate a unique test user
 */
export function createTestUser(overrides?: Partial<TestUser>): TestUser {
  const timestamp = Date.now()
  const randomSuffix = Math.random().toString(36).substring(2, 8)

  return {
    name: `Test User ${timestamp}`,
    // Use example.com - reserved domain per RFC 2606, accepted by Supabase GoTrue
    email: `test.user.${timestamp}.${randomSuffix}@example.com`,
    password: 'TestPassword123!',
    ...overrides,
  }
}

/**
 * Create a test user directly in Supabase (bypassing UI)
 * Returns the user object with ID populated
 */
export async function createTestUserInDB(
  user: TestUser
): Promise<TestUser & { id: string }> {
  const supabase = await getSupabaseAdmin()

  // Create user in auth.users using admin client
  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true, // Auto-confirm email for testing
      user_metadata: {
        name: user.name,
      },
    })

  if (authError) {
    throw new Error(`Failed to create user in auth: ${authError.message}`)
  }

  if (!authData.user) {
    throw new Error('User created but no user data returned')
  }

  // The trigger should create the user in public.users table
  // Wait a moment for trigger to execute
  await new Promise(resolve => setTimeout(resolve, 500))

  // Verify user exists in public.users
  const { data: publicUser, error: publicError } = await supabase
    .from('users')
    .select('*')
    .eq('id', authData.user.id)
    .single()

  if (publicError) {
    throw new Error(
      `User created in auth but not in public.users: ${publicError.message}`
    )
  }

  return {
    ...user,
    id: authData.user.id,
  }
}

/**
 * Sign up a new user via the UI
 * Navigates to /auth and completes the signup form
 */
export async function signUpViaUI(page: Page, user: TestUser): Promise<void> {
  await page.goto('/auth')

  // Wait for page to load
  await expect(page).toHaveURL('/auth')

  // Wait for auth page to fully load by checking for either login or signup form
  await page.waitForSelector(
    'button:has-text("Log In"), button:has-text("Create Account")',
    {
      state: 'visible',
      timeout: 10000,
    }
  )

  // If we see "Log In" button, we need to switch to signup form
  const logInButton = page.locator('button:has-text("Log In")')
  const isLoginForm = await logInButton.isVisible()

  if (isLoginForm) {
    // Click the "Sign up" link to switch to signup form
    // Use full button text for Firefox compatibility
    await page.click('button:has-text("Don\'t have an account")')

    // Wait for signup form to appear
    await page.waitForSelector('[data-testid="signup-name-input"]', {
      state: 'visible',
      timeout: 5000,
    })
  }

  // Fill in the signup form (with realistic delays)
  await page.fill('[data-testid="signup-name-input"]', user.name)
  await page.waitForTimeout(100)
  await page.fill('[data-testid="signup-email-input"]', user.email)
  await page.waitForTimeout(100)
  await page.fill('[data-testid="signup-password-input"]', user.password)
  await page.waitForTimeout(100)

  // Fill confirm password if it exists
  const confirmPasswordField = page.locator(
    '[data-testid="signup-confirm-password-input"]'
  )
  if (await confirmPasswordField.isVisible()) {
    await confirmPasswordField.fill(user.password)
    await page.waitForTimeout(100)
  }

  // Submit the form
  // Use specific selector to avoid clicking Google sign-up button
  await page.click('button[type="submit"]:has-text("Create Account")')

  // Small delay after click to allow UI state to update
  await page.waitForTimeout(200)

  // Wait for redirect (either to /get-started or /songs)
  await page.waitForURL(/\/(get-started|songs)/, { timeout: 10000 })
}

/**
 * Log in an existing user via the UI
 */
export async function loginViaUI(page: Page, user: TestUser): Promise<void> {
  await page.goto('/auth')

  // Wait for page to load
  await expect(page).toHaveURL('/auth')

  // If we see "Sign Up" form, click to switch to login
  const hasSignUpButton = await page
    .locator('button:has-text("Sign Up"), button:has-text("Create Account")')
    .isVisible()
  if (hasSignUpButton) {
    const switchToLogin = page.locator(
      'button:has-text("Sign In"), a:has-text("Sign In")'
    )
    await switchToLogin.click()
  }

  // Fill in the login form
  await page.fill('[data-testid="login-email-input"]', user.email)
  await page.fill('[data-testid="login-password-input"]', user.password)

  // Submit the form
  // Use specific selector to avoid clicking Google sign-in button
  await page.click('button[type="submit"]:has-text("Log In")')

  // Wait for redirect to songs page or band selector
  await page.waitForURL(/\/(songs|bands|get-started)/, { timeout: 10000 })
}

/**
 * Delete a test user from Supabase
 */
export async function deleteTestUser(userId: string): Promise<void> {
  const supabase = await getSupabaseAdmin()

  try {
    // Delete from auth.users (should cascade to public.users via trigger)
    const { error } = await supabase.auth.admin.deleteUser(userId)

    if (error) {
      console.warn(`Failed to delete user ${userId}: ${error.message}`)
    }
  } catch (error) {
    console.warn(`Error deleting user ${userId}:`, error)
  }
}

/**
 * Log out the current user via UI
 */
export async function logoutViaUI(page: Page): Promise<void> {
  // Click logout button using data-testid
  await page.click('[data-testid="logout-button"]')

  // Wait for redirect to auth page
  await page.waitForURL('/auth', { timeout: 5000 })
}

/**
 * Check if user is logged in by checking for auth state
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  // Check if we're on a protected page (not /auth)
  const url = page.url()
  if (url.includes('/auth')) {
    return false
  }

  // Check for user menu or other authenticated UI elements
  const userMenu = page.locator('[data-testid="user-menu"]')
  return await userMenu.isVisible()
}
