/**
 * E2E — Events: host creates an event, and a second user joins it by code.
 *
 * Basic happy-path coverage for the events workflow (mobile-redesign-port).
 * The band-less signup join-by-code path is covered in auth/band-less-flow;
 * this covers the logged-in host-create + logged-in join-by-code flows.
 */

import { test, expect } from '@playwright/test'
import { createTestUser, signUpViaUI, logoutViaUI } from '../../fixtures/auth'
import { createBandViaUI } from '../../fixtures/bands'
import { clearTestData } from '../../fixtures/database'

/** Sign up a fresh user via the UI and give them a band (reaches protected UI). */
async function signUpWithBand(page: import('@playwright/test').Page) {
  const user = createTestUser()
  await signUpViaUI(page, user)
  await createBandViaUI(page, `Events Test Band ${Date.now()}`)
  await page.waitForURL(/\/songs/, { timeout: 10000 })
  return user
}

/** Create an event via the UI and return its detail URL + join code. */
async function createEventViaUI(
  page: import('@playwright/test').Page,
  name: string
): Promise<{ eventId: string; code: string }> {
  await page.goto('/events')
  await expect(page.getByTestId('events-page')).toBeVisible()
  await page.click('[data-testid="events-new-button"]')

  await expect(page.getByTestId('event-create-page')).toBeVisible()
  await page.fill('[data-testid="event-create-name"]', name)
  await page.fill('[data-testid="event-create-venue"]', 'The Test Venue')
  await page.click('[data-testid="event-create-submit"]')

  // Lands on the new event's detail page.
  await page.waitForURL(/\/events\/[0-9a-f-]+$/, { timeout: 10000 })
  await expect(page.getByTestId('event-detail-page')).toBeVisible()
  await expect(page.getByTestId('event-name')).toContainText(name)

  const eventId = page.url().split('/events/')[1]

  // The host-only Access tab reveals the shareable join code.
  await page.click('[data-testid="event-tab-access"]')
  const codeEl = page.getByTestId('access-join-code')
  await expect(codeEl).toBeVisible()
  const code = ((await codeEl.textContent()) ?? '').trim()
  expect(code.length).toBeGreaterThan(0)

  return { eventId, code }
}

test.describe('Events — create and join', () => {
  test.beforeEach(async () => {
    await clearTestData()
  })

  test('host can create an event and see it listed with a join code', async ({
    page,
  }) => {
    await signUpWithBand(page)

    const name = `Backyard Jam ${Date.now()}`
    const { eventId } = await createEventViaUI(page, name)

    // The new event shows up in the host's Events list.
    await page.goto('/events')
    await expect(page.getByTestId('events-list')).toBeVisible()
    await expect(page.getByTestId(`event-${eventId}`)).toContainText(name)
  })

  test('a logged-in user can join an event by its code', async ({ page }) => {
    // Host A creates the event and grabs the code.
    await signUpWithBand(page)
    const name = `Joinable Show ${Date.now()}`
    const { eventId, code } = await createEventViaUI(page, name)

    // Switch to a brand-new user B.
    await logoutViaUI(page)
    await signUpWithBand(page)

    // B joins by code from the Calendar view's join form (Events filter tab).
    await page.goto('/calendar')
    await page.click('[data-testid="calendar-filter-events"]')
    await page.fill('[data-testid="events-join-input"]', code)
    await page.click('[data-testid="events-join-button"]')

    // B lands on the same event's detail page.
    await page.waitForURL(new RegExp(`/events/${eventId}$`), { timeout: 10000 })
    await expect(page.getByTestId('event-name')).toContainText(name)
  })
})
