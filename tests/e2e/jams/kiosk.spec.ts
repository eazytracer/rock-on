/**
 * The counter iPad (`/kiosk`, iPad 1024 × 768): the host starts it from the
 * console, the iPad pairs by code (or the QR link's hash), sets an exit PIN,
 * adds a walk-up with a hand up, and exits with the PIN. A dead token (the
 * jam ended) clears it.
 */
import { test, expect, type Page } from '@playwright/test'
import { freshJam, loginAs, rpc, SEED, type LiveJam } from './liveSetup'
import { IPAD, resetRateLimits, tidy } from './guestSetup'

async function typePin(page: Page, pad: string, pin: string) {
  for (const d of pin) await page.getByTestId(`${pad}-key-${d}`).click()
}

test.describe('Counter iPad', () => {
  let jam: LiveJam | undefined
  test.beforeEach(() => resetRateLimits())
  test.afterEach(async () => {
    await tidy(jam)
    jam = undefined
  })

  test('pair by code, add a walk-up with a hand, exit with the PIN', async ({
    browser,
  }) => {
    jam = await freshJam({ live: true, songs: ['Plush', 'Zombie'] })

    // The host opens the counter iPad sheet from the console.
    const hostCtx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    })
    const host = await hostCtx.newPage()
    await loginAs(host, SEED.eric)
    await host.goto(`/jam/${jam.id}/live`)
    await host.getByTestId('jam-start-kiosk').click()
    const code = (await host.getByTestId('kiosk-pairing-code').textContent())!
    expect(code).toMatch(/^[A-Z0-9]{6}$/)
    await expect(host.getByTestId('kiosk-start-qr')).toHaveAttribute(
      'data-value',
      new RegExp(`/kiosk#k=.+&e=${jam.id}$`)
    )

    // The iPad: no login, just the pairing code, then a PIN.
    const ipadCtx = await browser.newContext({ viewport: IPAD, hasTouch: true })
    const ipad = await ipadCtx.newPage()
    await ipad.goto('/kiosk')
    await ipad.getByTestId('kiosk-pairing-input').fill(code.toLowerCase())
    await ipad.getByTestId('kiosk-pairing-submit').click()
    await typePin(ipad, 'kiosk-set-pin-pad', '1234')
    await typePin(ipad, 'kiosk-set-pin-pad', '1234')
    await expect(ipad.getByTestId('kiosk-start')).toBeVisible()
    await expect(ipad.getByTestId('kiosk-jam-name')).toHaveText(/Live test/)
    expect(
      await ipad.evaluate(() => localStorage.getItem('currentUserId'))
    ).toBeNull()

    // The pairing code works once.
    const again = await (await browser.newContext()).newPage()
    await again.goto('/kiosk')
    await again.getByTestId('kiosk-pairing-input').fill(code)
    await again.getByTestId('kiosk-pairing-submit').click()
    await expect(again.getByTestId('kiosk-pairing-error')).toBeVisible()

    // A walk-up: name, part, a hand on Plush.
    await ipad.getByTestId('kiosk-name-input').fill('Frank')
    await ipad.getByTestId('kiosk-parts-vox').click()
    await ipad.getByTestId('kiosk-next').click()
    await ipad.getByTestId(`kiosk-song-${jam.items.Plush}-raise`).click()
    await ipad.getByTestId('kiosk-done-button').click()
    await expect(ipad.getByTestId('kiosk-done')).toContainText(
      "You're on, Frank."
    )
    const st = await rpc<{
      people: { name: string; via: string }[]
      items: { id: string; hands: { name: string; key: string }[] }[]
    }>(jam.eric, 'jam_state', { p_event: jam.id })
    expect(st.people).toContainEqual(
      expect.objectContaining({ name: 'Frank', via: 'kiosk' })
    )
    expect(st.items.find(i => i.id === jam!.items.Plush)!.hands).toContainEqual(
      expect.objectContaining({ name: 'Frank', key: 'vox' })
    )
    // Clears itself for the next person.
    await expect(ipad.getByTestId('kiosk-start')).toBeVisible({
      timeout: 15000,
    })
    await expect(ipad.getByTestId('kiosk-name-input')).toHaveValue('')

    // Exit: hold the logo 3 s, a wrong PIN, then the right one.
    const logo = ipad.getByTestId('kiosk-logo')
    const box = (await logo.boundingBox())!
    await ipad.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await ipad.mouse.down()
    await ipad.waitForTimeout(3300)
    await ipad.mouse.up()
    await expect(ipad.getByTestId('kiosk-exit')).toBeVisible()
    await typePin(ipad, 'kiosk-exit-pad', '0000')
    await expect(ipad.getByTestId('kiosk-exit')).toContainText('Wrong PIN')
    await typePin(ipad, 'kiosk-exit-pad', '1234')
    await expect(ipad.getByTestId('kiosk-pairing')).toBeVisible()
    expect(
      await ipad.evaluate(() => sessionStorage.getItem('rockon.kiosk'))
    ).toBeNull()

    await hostCtx.close()
    await ipadCtx.close()
  })

  test('the QR link pairs without a code, leaves the URL clean, and ends with the jam', async ({
    browser,
  }) => {
    jam = await freshJam({ live: true, songs: ['Creep'] })
    const [k] = await rpc<{ token: string }[]>(jam.eric, 'start_kiosk', {
      p_event: jam.id,
    })
    const ctx = await browser.newContext({ viewport: IPAD })
    const ipad = await ctx.newPage()
    await ipad.goto(`/kiosk#k=${encodeURIComponent(k.token)}&e=${jam.id}`)
    await expect(ipad.getByTestId('kiosk-set-pin')).toBeVisible()
    expect(ipad.url()).not.toContain('#')
    expect(ipad.url()).not.toContain(k.token)
    await typePin(ipad, 'kiosk-set-pin-pad', '4321')
    await typePin(ipad, 'kiosk-set-pin-pad', '4321')
    await expect(ipad.getByTestId('kiosk-start')).toBeVisible()

    // A request instead of a hand.
    await ipad.getByTestId('kiosk-name-input').fill('Sam')
    await ipad.getByTestId('kiosk-next').click()
    await ipad.getByTestId('kiosk-request-button').click()
    await ipad.getByTestId('kiosk-request-title-input').fill('Song 2')
    await ipad.getByTestId('kiosk-done-button').click()
    await expect(ipad.getByTestId('kiosk-done')).toContainText(
      "You're on, Sam."
    )
    await ipad.getByTestId('kiosk-add-another').click()

    await rpc(jam.eric, 'end_jam', { p_event: jam.id })
    await expect(ipad.getByTestId('kiosk-ended')).toBeVisible({
      timeout: 30000,
    })
    expect(
      await ipad.evaluate(() => sessionStorage.getItem('rockon.kiosk'))
    ).toBeNull()
    await ctx.close()
  })
})
