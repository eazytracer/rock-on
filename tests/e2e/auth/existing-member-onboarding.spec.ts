/**
 * E2E — An existing band member with a cold local cache is NOT forced into
 * new-user onboarding.
 *
 * Regression lock for the production lockout: pre-update members (or anyone on a
 * fresh browser/device) carried stale localStorage (`currentUserId`,
 * `currentBandId`, `last_full_sync`) but an EMPTY IndexedDB. A recent
 * `last_full_sync` makes the initial sync skip, so the local membership store is
 * never refilled — and `loadUserData` used to read that empty cache, downgrade
 * the member to Personal, wipe `currentBandId`, and route them to the
 * "join solo / join a band" screen. Entering their own code then errored
 * "already a member" (the join path reads membership cloud-first). This test
 * reproduces the exact stale-cache condition and asserts the member lands back
 * in their band.
 */
import { test, expect } from '@playwright/test'
import {
  createTestUser,
  signUpViaUI,
  deleteTestUser,
} from '../../fixtures/auth'
import { createBandViaUI } from '../../fixtures/bands'

test.describe('Existing member — cold cache does not force onboarding', () => {
  let testUserId: string | undefined

  test.afterEach(async ({ page }) => {
    if (!testUserId) {
      testUserId =
        (await page.evaluate(() => localStorage.getItem('currentUserId'))) ??
        undefined
    }
    if (testUserId) {
      await deleteTestUser(testUserId)
      testUserId = undefined
    }
  })

  test('a member with empty IndexedDB but stale localStorage stays in their band', async ({
    page,
  }) => {
    // Establish a real member: sign up + create a band (server-side membership).
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Cold Cache Band ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })
    testUserId =
      (await page.evaluate(() => localStorage.getItem('currentUserId'))) ??
      undefined

    const bandIdBefore = await page.evaluate(() =>
      localStorage.getItem('currentBandId')
    )
    expect(bandIdBefore).toBeTruthy()

    // Simulate the pre-update stale-cache state: wipe IndexedDB but keep the
    // localStorage auth keys, and mark a recent full sync so the initial sync is
    // skipped (leaving the local membership store empty on reload).
    await page.evaluate(async () => {
      localStorage.setItem('last_full_sync', new Date().toISOString())
      await new Promise<void>(resolve => {
        const req = indexedDB.deleteDatabase('RockOnDB')
        req.onsuccess = () => resolve()
        req.onerror = () => resolve()
        req.onblocked = () => resolve()
      })
    })

    await page.reload()

    // Must NOT be bounced to onboarding/auth, and the band context must survive.
    await page.waitForURL(url => !url.pathname.startsWith('/auth'), {
      timeout: 10000,
    })
    await expect(page).not.toHaveURL(/\/get-started/, { timeout: 10000 })

    // The persisted band context is preserved (the bug wiped it).
    await expect
      .poll(
        async () => page.evaluate(() => localStorage.getItem('currentBandId')),
        { timeout: 10000 }
      )
      .toBeTruthy()

    // Home shows the in-band experience, not the band-less "create a band" CTA.
    await page.goto('/')
    await expect(page.getByTestId('home-page')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('home-create-band')).toHaveCount(0)
  })
})
