/**
 * Tonight (Jam Live 1–3, 6), the live jam for people who aren't hosting:
 * the Ask-the-room nudge reaching a second browser, raising and lowering
 * hands, pitching, and who knows your songs (seeded jam songs spelled
 * differently: Eric's "Black" and Sarah's "Black [Live]").
 */
import { test, expect } from '@playwright/test'
import {
  SEED,
  cleanup,
  freshJam,
  loginAs,
  openConsole,
  rpc,
  type LiveJam,
} from './liveSetup'

let jam: LiveJam | undefined
test.afterEach(async () => {
  await cleanup(jam)
  jam = undefined
})

test.describe('Tonight · desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test("Ask the room nudges Sarah in her browser; I'm in raises her hand", async ({
    browser,
  }) => {
    jam = await freshJam({ live: true })
    const host = await (await browser.newContext()).newPage()
    const guest = await (await browser.newContext()).newPage()
    await loginAs(host, SEED.eric)
    await loginAs(guest, SEED.sarah)
    await guest.goto(`/jam/${jam.id}`)
    await expect(guest.getByTestId('jam-tonight')).toBeVisible()
    await openConsole(host, jam)

    // Up next is Song A with every part open: ask the room for all of them.
    await expect(host.getByTestId('console-up-next-title')).toHaveText('Song A')
    await host.getByTestId('console-ask-room').click()

    // Sarah plays bass: she gets the bass nudge.
    const nudge = guest.getByTestId('tonight-nudge')
    await expect(nudge).toContainText('Song A needs bass', { timeout: 5000 })
    await nudge.getByTestId('nudge-in').click()
    await expect(
      guest.getByTestId(`tonight-hand-${jam.items['Song A']}`)
    ).toContainText('Hand up: bass')
    // The host's console hears about it without a reload.
    await expect(
      host.getByTestId('console-up-next').getByTestId('slot-bass-1')
    ).toContainText('1', { timeout: 5000 })
    await expect(host.getByTestId('console-hands')).toContainText(
      'Sarah · Bass'
    )
  })
})

test.describe('Tonight · phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('hands, a pitch, and who knows your songs', async ({ page }) => {
    jam = await freshJam({ live: true })
    await loginAs(page, SEED.sarah)
    await page.goto(`/jam/${jam.id}`)
    const tonight = page.getByTestId('jam-tonight')
    await expect(tonight).toBeVisible()
    await expect(page.getByTestId('tonight-up-next')).toContainText('Song A')

    // Who knows your songs: Eric (Black ≈ Black [Live]).
    const eric = page.getByTestId(`tonight-person-${jam.people.Eric}`)
    await expect(eric).toContainText('IN COMMON')
    await eric.click()
    const compare = page.getByTestId('compare-sheet')
    await expect(compare).toContainText('Black')
    await page.keyboard.press('Escape')
    await expect(compare).toHaveCount(0)

    // Raise a hand on Song B: bass (her part, open) is preselected.
    await page.getByTestId(`tonight-raise-${jam.items['Song B']}`).click()
    await expect(page.getByTestId('raise-part-bass')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await page.getByTestId('raise-submit').click()
    const mine = page.getByTestId(`tonight-hand-${jam.items['Song B']}`)
    await expect(mine).toContainText('Hand up: bass')
    const st = await rpc<{
      items: { id: string; hands: { participant_id: string }[] }[]
    }>(jam.eric, 'jam_state', { p_event: jam.id })
    expect(
      st.items
        .find(i => i.id === jam!.items['Song B'])!
        .hands.map(h => h.participant_id)
    ).toContain(jam.people.Sarah)

    // Lower it again.
    await page.getByTestId(`tonight-hand-edit-${jam.items['Song B']}`).click()
    await page.getByTestId('raise-lower-bass').click()
    await expect(mine).toHaveCount(0)

    // Pitch a song: the host approves pitches, so it waits for Eric.
    await page.getByTestId('tonight-pitch').click()
    await page.getByTestId('pitch-title-input').fill('Zombie')
    await page.getByTestId('pitch-artist-input').fill('The Cranberries')
    await page.getByTestId('pitch-submit').click()
    await expect(page.getByText(/Sent to Eric/)).toBeVisible()
    await expect(page.getByTestId('tonight-songs')).toContainText('Zombie')
    await expect(page.getByTestId('tonight-my-hands')).toContainText(
      'Waiting for the host'
    )
  })
})
