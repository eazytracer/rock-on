/**
 * E2E tests for jam-share URL persistence across remounts.
 *
 * The raw view token (the `?t=...` part of `/jam/view/<code>?t=<token>`) is
 * only known to the client that created the session — Supabase stores only
 * a SHA-256 hash, so the server cannot regenerate it. v0.3.1 fixed the
 * "Copy/QR button disabled after refresh" bug by persisting the raw token
 * to localStorage keyed by session id and rehydrating it in
 * `JamSessionPage` when the component remounts.
 *
 * These tests guard that plumbing:
 *
 *   - After creating a session, the copy-link button is enabled.
 *   - After a full page reload, the copy-link button is STILL enabled.
 *   - Clearing localStorage (simulating a different device / incognito
 *     tab) disables the copy-link button — the graceful-disable path.
 *
 * We assert against the enabled/disabled state of the button rather than
 * parsing its click behaviour (which requires clipboard permissions and
 * is flaky). The `disabled` attribute on `[data-testid="jam-copy-link-button"]`
 * is driven directly by `!shareUrl`, so it's a reliable proxy for the
 * URL's availability.
 */
import { test, expect } from '@playwright/test'
import {
  createTestUser,
  signUpViaUI,
  deleteTestUser,
} from '../../fixtures/auth'
import { createBandViaUI } from '../../fixtures/bands'

test.describe('Jam Session — share URL persistence', () => {
  let testUserId: string | undefined

  test.afterEach(async () => {
    if (testUserId) {
      await deleteTestUser(testUserId).catch(() => {})
      testUserId = undefined
    }
  })

  // Post-v0.3.2 layout: Copy / QR live inside a Share popover. The
  // Share button itself is what's `disabled={!shareUrl}`, so it's the
  // most direct signal of "share URL is in state". Some tests still
  // open the popover to exercise the QR rendering path end-to-end.
  test('share URL is available immediately after session creation', async ({
    page,
  }) => {
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Share URL Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await page.goto('/jam')
    await page.waitForURL(/\/jam/, { timeout: 5000 })

    await page.locator('[data-testid="jam-create-button"]').click()
    await page.waitForURL(/\/jam\/.+/, { timeout: 10000 })

    const shareButton = page.locator('[data-testid="jam-share-button"]')
    await expect(shareButton).toBeVisible({ timeout: 5000 })
    // !shareUrl → disabled. Enabled means the raw token is in state.
    await expect(shareButton).not.toBeDisabled({ timeout: 5000 })
  })

  test('share URL survives a full page reload (localStorage rehydration)', async ({
    page,
  }) => {
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Reload Share URL ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await page.goto('/jam')
    await page.waitForURL(/\/jam/, { timeout: 5000 })

    await page.locator('[data-testid="jam-create-button"]').click()
    await page.waitForURL(/\/jam\/.+/, { timeout: 10000 })

    // Confirm URL is initially available.
    const shareButton = page.locator('[data-testid="jam-share-button"]')
    await expect(shareButton).not.toBeDisabled({ timeout: 5000 })

    // Verify the raw token landed in localStorage under the expected key
    // shape. This is belt-and-braces on top of the button assertion — if
    // someone ever changes the storage key, the follow-up reload
    // assertion would break silently without this.
    const storageKeys = await page.evaluate(() => {
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('rockon:jam:viewToken:')) keys.push(k)
      }
      return keys
    })
    expect(storageKeys.length).toBeGreaterThan(0)

    // Full page reload — component remounts, shareUrl state resets.
    await page.reload()
    await page.waitForURL(/\/jam\/.+/, { timeout: 10000 })

    // Rehydration should have re-populated shareUrl from localStorage so
    // the share button is still enabled.
    await expect(shareButton).toBeVisible({ timeout: 5000 })
    await expect(shareButton).not.toBeDisabled({ timeout: 5000 })
  })

  test('QR code can be shown after reload (proves URL is present)', async ({
    page,
  }) => {
    // Redundant check from a different angle: the QR renderer reads the
    // same shareUrl, so if it renders after reload the URL round-tripped
    // through localStorage rehydration.
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `QR Reload ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await page.goto('/jam')
    await page.waitForURL(/\/jam/, { timeout: 5000 })

    await page.locator('[data-testid="jam-create-button"]').click()
    await page.waitForURL(/\/jam\/.+/, { timeout: 10000 })

    // Reload first, then open Share popover, then click Show QR —
    // exercises the post-reload path.
    await page.reload()
    await page.waitForURL(/\/jam\/.+/, { timeout: 10000 })

    await expect(page.locator('[data-testid="jam-share-button"]')).toBeVisible({
      timeout: 5000,
    })
    await page.locator('[data-testid="jam-share-button"]').click()

    await expect(
      page.locator('[data-testid="jam-show-qr-button"]')
    ).toBeVisible({ timeout: 5000 })
    await page.locator('[data-testid="jam-show-qr-button"]').click()
    await expect(page.locator('[data-testid="jam-invite-qr"]')).toBeVisible({
      timeout: 5000,
    })
  })

  test('graceful disable when localStorage is missing the raw token', async ({
    page,
  }) => {
    // Simulates "host opened the session URL on a second device". The
    // raw token isn't anywhere in local storage → Share button (and
    // therefore Copy / QR) should be disabled rather than falling back
    // to a broken URL (which the edge function would 400 on).
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Cross-Device Share ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    await page.goto('/jam')
    await page.waitForURL(/\/jam/, { timeout: 5000 })

    await page.locator('[data-testid="jam-create-button"]').click()
    await page.waitForURL(/\/jam\/.+/, { timeout: 10000 })

    const sessionUrl = page.url()

    // Wipe the viewToken entries from localStorage, then reload.
    await page.evaluate(() => {
      const toRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('rockon:jam:viewToken:')) toRemove.push(k)
      }
      for (const k of toRemove) localStorage.removeItem(k)
    })

    await page.goto(sessionUrl)
    await page.waitForURL(/\/jam\/.+/, { timeout: 10000 })

    const shareButton = page.locator('[data-testid="jam-share-button"]')
    await expect(shareButton).toBeVisible({ timeout: 5000 })
    // No token → disabled. Documented graceful-disable path.
    await expect(shareButton).toBeDisabled({ timeout: 5000 })
  })
})
