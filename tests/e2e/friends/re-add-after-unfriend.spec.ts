/**
 * E2E — Friend can be re-added after unfriending.
 *
 * Regression lock for the production bug where removing a friend and adding them
 * again dead-ended on "You're already friends": accepting left a stale
 * `accepted` friend_requests row that unfriend never cleared, so the UNIQUE
 * (requester, addressee) slot stayed occupied. The AFTER DELETE trigger on
 * `friendships` now clears it (and the send path self-heals orphans), so the
 * second add must succeed.
 */

import { test, expect } from '@playwright/test'
import {
  createTestUser,
  createTestUserInDB,
  deleteTestUser,
  signUpViaUI,
  logoutViaUI,
} from '../../fixtures/auth'
import { createBandViaUI } from '../../fixtures/bands'
import { clearTestData } from '../../fixtures/database'
import { getSupabaseAdmin } from '../../fixtures/supabase'

test.describe('Friends — re-add after unfriend', () => {
  let userB: { email: string; password: string; name: string; id: string }
  let userBName: string

  test.beforeEach(async () => {
    await clearTestData()
    userBName = `Rita Readd ${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`
    userB = await createTestUserInDB(createTestUser({ name: userBName }))
    const admin = await getSupabaseAdmin()
    const { error } = await admin
      .from('user_profiles')
      .upsert(
        { user_id: userB.id, display_name: userBName, discoverable: true },
        { onConflict: 'user_id' }
      )
    if (error) throw new Error(`seed profile failed: ${error.message}`)
  })

  test.afterEach(async () => {
    if (userB?.id) await deleteTestUser(userB.id)
  })

  const loginInline = async (
    page: import('@playwright/test').Page,
    email: string,
    password: string
  ) => {
    await page.goto('/auth')
    await page.waitForSelector('[data-testid="login-email-input"]', {
      state: 'visible',
      timeout: 10000,
    })
    await page.fill('[data-testid="login-email-input"]', email)
    await page.fill('[data-testid="login-password-input"]', password)
    await page.click('button[type="submit"]:has-text("Log In")')
    await page.waitForURL(url => !url.pathname.startsWith('/auth'), {
      timeout: 10000,
    })
  }

  test('unfriend then re-add succeeds (no "already friends" dead-end)', async ({
    page,
  }) => {
    // A signs up, creates a band, sends B a friend request.
    const userA = createTestUser()
    await signUpViaUI(page, userA)
    await createBandViaUI(page, `Re-add Band ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await page.goto('/friends')
    await page.fill('[data-testid="friends-search-input"]', userBName)
    await expect(page.getByTestId(`friend-search-${userB.id}`)).toBeVisible({
      timeout: 5000,
    })
    await page.click(`[data-testid="friend-search-add-${userB.id}"]`)
    await expect(page.getByTestId('friends-outgoing')).toContainText(userBName)

    // B logs in and accepts.
    await logoutViaUI(page)
    await loginInline(page, userB.email, userB.password)
    await page.goto('/friends')
    const incoming = page.getByTestId('friends-incoming')
    await expect(incoming).toContainText(userA.name, { timeout: 5000 })
    await incoming.locator('[data-testid^="friend-accept-"]').first().click()
    await expect(page.getByTestId('friends-list')).toContainText(userA.name, {
      timeout: 5000,
    })

    // A logs back in, confirms B is a friend, then unfriends B.
    await logoutViaUI(page)
    await loginInline(page, userA.email, userA.password)
    await page.goto('/friends')
    const list = page.getByTestId('friends-list')
    await expect(list).toContainText(userBName, { timeout: 5000 })
    // Click remove and wait for the DELETE to actually complete — otherwise a
    // reload/navigation could abort the in-flight request.
    await Promise.all([
      page.waitForResponse(
        r => /\/friendships/.test(r.url()) && r.request().method() === 'DELETE',
        { timeout: 8000 }
      ),
      list.locator('[data-testid^="friend-remove-"]').first().click(),
    ])

    // Reload to assert the removal persisted server-side (independent of any
    // client-side list refresh), then confirm B is gone. With no friends left
    // the list collapses to an empty state, so assert B's name is absent
    // outright (a friendless page renders no `friends-list`).
    await page.reload()
    await page.waitForURL(/\/friends/, { timeout: 10000 })
    await expect(page.getByTestId('friends-page')).toBeVisible({
      timeout: 10000,
    })
    await expect(page.getByText(userBName, { exact: false })).toHaveCount(0)

    // The key assertion: A can re-add B — the request goes through instead of
    // erroring "You're already friends".
    await page.fill('[data-testid="friends-search-input"]', userBName)
    await expect(page.getByTestId(`friend-search-${userB.id}`)).toBeVisible({
      timeout: 5000,
    })
    await page.click(`[data-testid="friend-search-add-${userB.id}"]`)
    await expect(page.getByTestId('friends-outgoing')).toContainText(
      userBName,
      {
        timeout: 5000,
      }
    )
  })
})
