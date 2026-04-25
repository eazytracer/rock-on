/**
 * E2E test for post-signup display-name fallback behaviour.
 *
 * v0.3.1 background: signup creates a row in `users` (via auth.users →
 * public.users trigger), but does NOT create a row in `user_profiles`.
 * Several list-rendering code paths originally read ONLY
 * `user_profiles.display_name`, which meant freshly-signed-up users
 * showed up as literal strings like "User abc123" or "Host" because
 * their profile row didn't exist yet.
 *
 * The fix (`RemoteRepository.getJamParticipants` + `jam-view` edge
 * function) is a two-tier fallback:
 *
 *   1. `user_profiles.display_name` if set
 *   2. `users.name` (populated at signup by the trigger) otherwise
 *   3. literal "User <id-prefix>" only as a last resort
 *
 * This test guards tier 2 — a user who has NEVER written to
 * `user_profiles` should still see their `users.name` in any UI surface
 * that renders other users' names.
 *
 * The jam participant list is the canonical surface for this check
 * because (a) it's the code path that was actually broken in v0.3.0 and
 * (b) the test can create a self-only jam (host auto-joins as a
 * participant) without needing a second user, keeping the test fast.
 */
import { test, expect } from '@playwright/test'
import {
  createTestUser,
  signUpViaUI,
  deleteTestUser,
} from '../../fixtures/auth'
import { createBandViaUI } from '../../fixtures/bands'
import { getSupabaseAdmin } from '../../fixtures/supabase'

test.describe('Post-signup profile state — display name fallback', () => {
  let testUserId: string | undefined

  test.afterEach(async () => {
    if (testUserId) {
      await deleteTestUser(testUserId).catch(() => {})
      testUserId = undefined
    }
  })

  test('freshly-signed-up user with no user_profiles row still shows their name in the jam participant list', async ({
    page,
  }) => {
    // Sign up via UI — this runs the auth.users → public.users trigger
    // but does NOT create a user_profiles row.
    const user = createTestUser({
      name: `Tyler Signup ${Date.now()}`,
    })
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Profile Fallback Band ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    // Look up the fresh user's id from public.users so we can assert the
    // absence of a user_profiles row (proving the fallback path is
    // actually being exercised, not shadowed by an accidental profile
    // insert somewhere else in the signup pipeline).
    const supabase = await getSupabaseAdmin()
    const { data: publicUser } = await supabase
      .from('users')
      .select('id, name')
      .eq('email', user.email)
      .maybeSingle()

    expect(publicUser).toBeTruthy()
    expect(publicUser!.name).toBe(user.name)
    testUserId = publicUser!.id

    // Hard pin: no user_profiles row exists for this user yet.
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('user_id', publicUser!.id)
      .maybeSingle()
    expect(profile).toBeNull()

    // Create a jam session — the host auto-joins as a participant, so
    // the participant list renders exactly one row: this user.
    await page.goto('/jam')
    await page.waitForURL(/\/jam/, { timeout: 5000 })
    await page.locator('[data-testid="jam-create-button"]').click()
    await page.waitForURL(/\/jam\/.+/, { timeout: 10000 })

    const participantList = page.locator('[data-testid="jam-participant-list"]')
    await expect(participantList).toBeVisible({ timeout: 5000 })

    // The participant row should contain the user's name (from
    // `users.name`) — NOT the "User abc123" stub and NOT the literal
    // "Host" sentinel.
    await expect(participantList).toContainText(user.name, { timeout: 5000 })
    await expect(participantList).not.toContainText(/^User [a-f0-9]{6}$/, {
      timeout: 1000,
    })
  })
})
