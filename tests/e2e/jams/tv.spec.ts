/**
 * The bar TV (`/j/:code/tv`, desktop only): on stage with its parts, up
 * next, the code and QR; it follows the host live; refusals are neutral.
 */
import { test, expect } from '@playwright/test'
import { freshJam, rpc, type LiveJam } from './liveSetup'
import { TV, resetRateLimits, tidy } from './guestSetup'

test.use({ viewport: TV })

test.describe('Bar TV', () => {
  let jam: LiveJam | undefined
  test.beforeEach(() => resetRateLimits())
  test.afterEach(async () => {
    await tidy(jam)
    jam = undefined
  })

  test('shows on stage and up next, and follows the host', async ({ page }) => {
    jam = await freshJam({ live: true, songs: ['Plush', 'Zombie', 'Creep'] })
    await rpc(jam.eric, 'call_up', { p_item: jam.items.Plush })

    await page.goto(`/j/${jam.code.toLowerCase()}/tv`)
    await expect(page.getByTestId('jam-tv-stage-title')).toHaveText('Plush')
    await expect(page.getByTestId('jam-tv-up-next-title')).toHaveText('Zombie')
    const shown = `${jam.code.slice(0, 4)}-${jam.code.slice(4)}`
    await expect(page.getByTestId('jam-tv-code')).toHaveText(shown)
    await expect(page.getByTestId('jam-tv-qr')).toHaveAttribute(
      'data-value',
      new RegExp(`/j/${jam.code}$`)
    )
    // Nothing private: no app chrome, no emails.
    await expect(page.getByTestId('jam-tv-page')).not.toContainText('@')

    // The host calls the next song; the TV catches up (realtime, else the
    // poll; the stage slide comes round every few seconds).
    await rpc(jam.eric, 'call_up', { p_item: jam.items.Zombie })
    await expect(page.getByTestId('jam-tv-stage-title')).toHaveText('Zombie', {
      timeout: 30000,
    })
    await expect(page.getByTestId('jam-tv-up-next-title')).toHaveText('Creep')

    // Ending the jam: the TV says so.
    await rpc(jam.eric, 'end_jam', { p_event: jam.id })
    await expect(page.getByTestId('jam-tv-ended')).toBeVisible({
      timeout: 30000,
    })
  })

  test('with nothing on stage it rotates to Come play', async ({ page }) => {
    jam = await freshJam({ live: true, songs: ['Black'] })
    await page.goto(`/j/${jam.code}/tv`)
    await expect(page.getByTestId('jam-tv-name')).toHaveText(/Live test/)
    await expect(page.getByTestId('jam-tv-stage')).toHaveCount(0)
    await expect(
      page.locator(
        '[data-testid="jam-tv-join"], [data-testid="jam-tv-looking-for"]'
      )
    ).toBeVisible()
  })

  test('refusals are neutral', async ({ page }) => {
    await page.goto('/j/ZZZZ-ZZZZ/tv')
    await expect(page.getByTestId('jam-tv-invalid')).toContainText(
      "That code isn't valid."
    )
    await page.goto('/j/MKBD6JAM/tv')
    await expect(page.getByTestId('jam-tv-invite-only')).toContainText(
      'This jam is invite only.'
    )
    await expect(page.getByText('Band Rehearsal Jam')).toHaveCount(0)
  })
})
