/**
 * The web guest: a fresh browser with no account joins from `/j/:code`,
 * raises a hand and pitches a song; the host (signed in, second context) sees
 * both; the host ends the jam and the guest sees the ended state with no name
 * left. A token from one jam is refused on another (the page stays neutral).
 */
import { test, expect } from '@playwright/test'
import { freshJam, loginAs, rpc, SEED, type LiveJam } from './liveSetup'
import { PHONE, resetRateLimits, tidy } from './guestSetup'

test.describe('Web guest', () => {
  const jams: LiveJam[] = []
  test.beforeEach(() => resetRateLimits())
  test.afterEach(async () => {
    for (const j of jams.splice(0)) await tidy(j)
  })

  test('joins without an account, raises a hand, pitches; the host sees it; ending clears it', async ({
    browser,
  }) => {
    const jam = await freshJam({ live: true, songs: ['Plush', 'Zombie'] })
    jams.push(jam)

    const guestCtx = await browser.newContext({ viewport: PHONE })
    const guest = await guestCtx.newPage()
    await guest.goto(
      `/j/${jam.code.slice(0, 4)}-${jam.code.slice(4).toLowerCase()}`
    )
    await expect(guest.getByTestId('web-guest-arriving')).toBeVisible()
    await guest.getByTestId('web-guest-name-input').fill('Dana')
    await guest.getByTestId('web-guest-parts-bass').click()
    await guest.getByTestId('web-guest-join-button').click()
    await expect(guest.getByTestId('web-guest-me')).toContainText("You're Dana")
    await expect(guest.getByTestId('web-guest-me')).toContainText('Bass')
    // The token stays on the device, never in the URL.
    expect(guest.url()).not.toContain('token')
    const stored = await guest.evaluate(
      c => localStorage.getItem(`rockon.jam.${c}`),
      jam.code
    )
    expect(stored).toBeTruthy()

    // Raise a hand for bass on Zombie, then lower and raise again.
    const zombie = guest.locator(
      `[data-testid="guest-song-${jam.items.Zombie}-hand-bass"]`
    )
    await zombie.click()
    await expect(zombie).toHaveText(/Hand up · Bass/)
    await zombie.click()
    await expect(zombie).toHaveText(/Raise · Bass/)
    await zombie.click()
    await expect(zombie).toHaveText(/Hand up · Bass/)

    // Pitch a song (pending: approval is on by default).
    await guest.getByTestId('web-guest-request-button').click()
    await guest.getByTestId('web-guest-pitch-title-input').fill('Gimme Shelter')
    await guest
      .getByTestId('web-guest-pitch-artist-input')
      .fill('The Rolling Stones')
    await guest.getByTestId('web-guest-pitch-send').click()
    const pitched = guest.locator('[data-title="Gimme Shelter"]')
    await expect(pitched).toBeVisible()
    await expect(pitched.getByText('Pending')).toBeVisible()

    // Change name and parts.
    await guest.getByTestId('web-guest-change').click()
    await guest.getByTestId('web-guest-edit-name-input').fill('Dani')
    await guest.getByTestId('web-guest-edit-parts-vox').click()
    await guest.getByTestId('web-guest-edit-save').click()
    await expect(guest.getByTestId('web-guest-me')).toContainText(
      "You're Dani · Bass, Vocals"
    )

    // The host, signed in elsewhere, sees the guest, the hand and the pitch.
    const hostCtx = await browser.newContext()
    const host = await hostCtx.newPage()
    await loginAs(host, SEED.eric)
    await host.goto(`/jam/${jam.id}/live`)
    await expect(host.getByText('Gimme Shelter').first()).toBeVisible({
      timeout: 15000,
    })
    const st = await rpc<{
      people: { name: string; via: string }[]
      items: { id: string; hands: { name: string; key: string }[] }[]
    }>(jam.eric, 'jam_state', { p_event: jam.id })
    expect(st.people).toContainEqual(
      expect.objectContaining({ name: 'Dani', via: 'web' })
    )
    const hands = st.items.find(i => i.id === jam.items.Zombie)!.hands
    expect(hands).toContainEqual(
      expect.objectContaining({ name: 'Dani', key: 'bass' })
    )

    // The host ends the jam: the guest's page says so and no name remains.
    await rpc(jam.eric, 'end_jam', { p_event: jam.id })
    await expect(guest.getByTestId('web-guest-ended')).toContainText(
      'That jam has ended. Thanks for playing.',
      { timeout: 30000 }
    )
    await expect(guest.getByText('Dani')).toHaveCount(0)
    expect(
      await guest.evaluate(
        c => localStorage.getItem(`rockon.jam.${c}`),
        jam.code
      )
    ).toBeNull()

    await guestCtx.close()
    await hostCtx.close()
  })

  test("another jam's token is refused: the page stays neutral", async ({
    browser,
  }) => {
    const jam = await freshJam({ live: true, songs: ['Creep'] })
    jams.push(jam)
    const ctx = await browser.newContext({ viewport: PHONE })
    const page = await ctx.newPage()
    // Alex's real token for TUES7JAM, filed under this jam's code.
    await page.goto('/terms')
    await page.evaluate(
      c => localStorage.setItem(`rockon.jam.${c}`, 'seed-guest-alex'),
      jam.code
    )
    await page.goto(`/j/${jam.code}`)
    await expect(page.getByTestId('web-guest-arriving')).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByTestId('web-guest-notice')).toBeVisible()
    await expect(page.getByText('Alex')).toHaveCount(0)
    expect(
      await page.evaluate(
        c => localStorage.getItem(`rockon.jam.${c}`),
        jam.code
      )
    ).toBeNull()
    await ctx.close()
  })

  test('the seeded guest token opens the live jam (read only)', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ viewport: PHONE })
    const page = await ctx.newPage()
    await page.goto('/terms')
    await page.evaluate(() =>
      localStorage.setItem('rockon.jam.TUES7JAM', 'seed-guest-alex')
    )
    await page.goto('/j/TUES-7JAM')
    await expect(page.getByTestId('web-guest-me')).toContainText("You're Alex")
    await expect(page.getByTestId('web-guest-stage')).toContainText('Black')
    await expect(page.getByTestId('web-guest-up-next')).toBeVisible()
    await expect(page.getByTestId('web-guest-signup-link')).toHaveAttribute(
      'href',
      '/auth/signup?returnTo=%2Fj%2FTUES7JAM'
    )
    await ctx.close()
  })
})
