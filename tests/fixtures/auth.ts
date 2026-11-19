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
 * Sign up a new user via the UI (`/auth/signup`). With email confirmations
 * off (local), it lands on Get started.
 */
export async function signUpViaUI(page: Page, user: TestUser): Promise<void> {
  await page.goto('/auth/signup')
  await page.fill('[data-testid="signup-name-input"]', user.name)
  await page.fill('[data-testid="signup-email-input"]', user.email)
  await page.fill('[data-testid="signup-password-input"]', user.password)
  await page.click('[data-testid="signup-submit-button"]')
  await page.waitForURL(/\/(get-started|songs)/, { timeout: 10000 })
}

/**
 * Log in an existing user via the UI
 */
export async function loginViaUI(page: Page, user: TestUser): Promise<void> {
  await page.goto('/auth')
  await page.fill('[data-testid="login-email-input"]', user.email)
  await page.fill('[data-testid="login-password-input"]', user.password)
  await page.click('[data-testid="sign-in-button"]')
  await page.waitForURL(url => !url.pathname.startsWith('/auth'), {
    timeout: 10000,
  })
}

/**
 * The signed-in user's id (from the app's `currentUserId`). Member rows are
 * keyed by user id, since other users' emails aren't visible to non-admins.
 */
export async function getCurrentUserId(page: Page): Promise<string> {
  const handle = await page.waitForFunction(() =>
    localStorage.getItem('currentUserId')
  )
  return (await handle.jsonValue()) as string
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
  // Sign out lives in the account menu at the foot of the sidebar
  await page.click('[data-testid="sidebar-account-button"]')
  await page.click('[data-testid="logout-button"]')

  // Wait for redirect to the auth page. The protected-route guard preserves a
  // `?returnTo=` param on the redirect (deep-link preservation), so match the
  // /auth path rather than the bare string.
  await page.waitForURL(/\/auth/, { timeout: 5000 })
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
