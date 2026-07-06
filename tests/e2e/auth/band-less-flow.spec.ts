/**
 * E2E tests for the band-less user flow — Phase 2.
 *
 * Covers:
 * - Event-code join at signup (the "I have an event code" path → join as guest)
 * - Invalid event code shows an error (no navigation)
 * - Band-less users get a "create or join a band" prompt on the band-only pages
 *   (Setlists / Shows / Practices) instead of the feature
 * - Band-less Home hides band-only quick actions + shows the create-band prompt
 * - Upgrade path: a band-less user who creates a band gets the full experience
 *
 * Depends on the seeded event "Backyard Summer Jam" (code JAM4567).
 */
import { test, expect } from '@playwright/test'
import {
  createTestUser,
  signUpViaUI,
  deleteTestUser,
} from '../../fixtures/auth'
import { createBandViaUI } from '../../fixtures/bands'
import {
  setupConsoleErrorTracking,
  assertNoConsoleErrors,
} from '../../helpers/assertions'

const SEED_EVENT_CODE = 'JAM4567'
const SEED_EVENT_NAME = 'Backyard Summer Jam'

test.describe('Band-less user flow (Phase 2)', () => {
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

  test('event code at signup joins the event as a guest', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()

    await signUpViaUI(page, user)
    await expect(page).toHaveURL(/\/get-started/, { timeout: 10000 })
    testUserId =
      (await page.evaluate(() => localStorage.getItem('currentUserId'))) ??
      undefined

    await page.fill('[data-testid="join-event-code-input"]', SEED_EVENT_CODE)
    await page.click('[data-testid="join-event-button"]')

    // Lands on the event detail with no band required.
    await page.waitForURL(/\/events\/[0-9a-f-]+/, { timeout: 10000 })
    await expect(page.getByText(SEED_EVENT_NAME)).toBeVisible({ timeout: 5000 })
    // Band-less: sidebar shows the personal-account header, not a band name.
    expect(
      await page.evaluate(() => localStorage.getItem('currentBandId'))
    ).toBeNull()

    await assertNoConsoleErrors(page, errors)
  })

  test('an invalid event code shows an error and does not navigate', async ({
    page,
  }) => {
    const user = createTestUser()
    await signUpViaUI(page, user)
    await expect(page).toHaveURL(/\/get-started/, { timeout: 10000 })
    testUserId =
      (await page.evaluate(() => localStorage.getItem('currentUserId'))) ??
      undefined

    await page.fill('[data-testid="join-event-code-input"]', 'ZZZZ0000')
    await page.click('[data-testid="join-event-button"]')

    // Stays on get-started with an error; no event navigation.
    await expect(page).toHaveURL(/\/get-started/)
    await expect(page.getByText(/No event found for that code/i)).toBeVisible({
      timeout: 5000,
    })
  })

  test('band-only pages show a create/join-a-band prompt when band-less', async ({
    page,
  }) => {
    const errors = setupConsoleErrorTracking(page)
    const user = createTestUser()

    await signUpViaUI(page, user)
    await expect(page).toHaveURL(/\/get-started/, { timeout: 10000 })
    testUserId =
      (await page.evaluate(() => localStorage.getItem('currentUserId'))) ??
      undefined

    // Choose a personal account (no band).
    await page.click('[data-testid="personal-account-button"]')
    await page.waitForURL(/\/$/, { timeout: 5000 })

    // Setlists is now personal-capable — a band-less user reaches the
    // personal ("My Setlists") view instead of a band-required prompt.
    await page.goto('/setlists')
    await expect(page.locator('[data-testid="setlists-page"]')).toBeVisible({
      timeout: 5000,
    })
    await expect(
      page.locator('[data-testid="setlists-band-required"]')
    ).toHaveCount(0)

    // Shows and Practices remain band-only.
    for (const [path, testid] of [
      ['/shows', 'shows-band-required'],
      ['/practices', 'practices-band-required'],
    ] as const) {
      await page.goto(path)
      await expect(page.locator(`[data-testid="${testid}"]`)).toBeVisible({
        timeout: 5000,
      })
      await expect(
        page.locator('[data-testid="band-required-cta"]')
      ).toBeVisible()
    }

    await assertNoConsoleErrors(page, errors)
  })

  test('band-less Home hides band-only actions and shows the create-band prompt', async ({
    page,
  }) => {
    const user = createTestUser()
    await signUpViaUI(page, user)
    await expect(page).toHaveURL(/\/get-started/, { timeout: 10000 })
    testUserId =
      (await page.evaluate(() => localStorage.getItem('currentUserId'))) ??
      undefined

    await page.click('[data-testid="personal-account-button"]')
    await page.waitForURL(/\/$/, { timeout: 5000 })
    await page.goto('/')

    await expect(page.locator('[data-testid="home-page"]')).toBeVisible({
      timeout: 5000,
    })
    await expect(page.locator('[data-testid="home-create-band"]')).toBeVisible()
    // Personal actions present; band-only actions hidden.
    await expect(page.locator('[data-testid="home-action-song"]')).toBeVisible()
    await expect(
      page.locator('[data-testid="home-action-setlist"]')
    ).toHaveCount(0)
    await expect(
      page.locator('[data-testid="home-action-practice"]')
    ).toHaveCount(0)
    await expect(page.locator('[data-testid="home-action-show"]')).toHaveCount(
      0
    )
  })

  test('upgrade path: creating a band unlocks the band-only pages', async ({
    page,
  }) => {
    const user = createTestUser()
    await signUpViaUI(page, user)
    await expect(page).toHaveURL(/\/get-started/, { timeout: 10000 })
    testUserId =
      (await page.evaluate(() => localStorage.getItem('currentUserId'))) ??
      undefined

    // Start band-less. Setlists is personal-capable (reachable band-less);
    // Shows is band-only (gated) — that's the page the upgrade unlocks.
    await page.click('[data-testid="personal-account-button"]')
    await page.waitForURL(/\/$/, { timeout: 5000 })
    await page.goto('/setlists')
    await expect(page.locator('[data-testid="setlists-page"]')).toBeVisible({
      timeout: 5000,
    })
    await page.goto('/shows')
    await expect(
      page.locator('[data-testid="shows-band-required"]')
    ).toBeVisible({ timeout: 5000 })

    await createBandViaUI(page, `Upgrade Band ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    // The band-only Shows page now renders the real feature (no prompt).
    await page.goto('/shows')
    await expect(page.locator('[data-testid="shows-page"]')).toBeVisible({
      timeout: 5000,
    })
    await expect(
      page.locator('[data-testid="shows-band-required"]')
    ).toHaveCount(0)
  })
})
