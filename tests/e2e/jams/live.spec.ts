/**
 * The host console (`/jam/:id/live`, Jam Host 1–5): go live, call up and
 * Undo, up next and skip, reorder, fill a part from a hand and directly,
 * walk-ups, lock joining, remove a person, End jam; phone swipes. Each test
 * runs on a fresh jam Eric hosts (liveSetup).
 */
import { test, expect, type Page } from '@playwright/test'
import {
  SEED,
  cleanup,
  clientAs,
  freshJam,
  loginAs,
  openConsole,
  rpc,
  type LiveJam,
} from './liveSetup'

const upNextTitle = (page: Page) => page.getByTestId('console-up-next-title')
const queueTitles = (page: Page) =>
  page.getByTestId('console-after').locator('[data-item-id] b')

let jam: LiveJam | undefined
test.afterEach(async () => {
  await cleanup(jam)
  jam = undefined
})

test.describe('Host console · desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('go live, call up with Undo, up next, skip, reorder', async ({
    page,
  }) => {
    jam = await freshJam()
    await loginAs(page, SEED.eric)
    await openConsole(page, jam)

    // Planned: the console offers Go live.
    await page.getByTestId('console-go-live').click()
    await page.getByTestId('confirm-dialog-confirm').click()
    await expect(upNextTitle(page)).toHaveText('Song A')
    await expect(queueTitles(page)).toHaveText(['Song B', 'Song C'])

    // Call up anyway (open parts) → on stage; Undo puts it back.
    await page.getByTestId('console-call-up').click()
    await expect(page.getByTestId('console-on-stage-title')).toHaveText(
      'Song A'
    )
    await expect(upNextTitle(page)).toHaveText('Song B')
    await page.getByTestId('toast-action').last().click()
    await expect(upNextTitle(page)).toHaveText('Song A')
    await expect(page.getByTestId('console-on-stage-title')).toHaveText(
      'Nobody yet'
    )

    // Skip: up next moves behind the next one.
    await page.getByTestId('console-skip').click()
    await expect(upNextTitle(page)).toHaveText('Song B')
    await expect(queueTitles(page)).toHaveText(['Song A', 'Song C'])

    // Reorder with the hover arrows, then make one up next.
    const row = page.getByTestId('queue-row-1')
    await row.hover()
    await row.getByTestId('queue-row-up').click()
    await expect(queueTitles(page)).toHaveText(['Song C', 'Song A'])
    const c = page.getByTestId('queue-row-0')
    await c.hover()
    await c.getByTestId('queue-row-next').click()
    await expect(upNextTitle(page)).toHaveText('Song C')
    await expect(queueTitles(page)).toHaveText(['Song B', 'Song A'])

    // The server agrees.
    const st = await rpc<{ queue: string[] }>(jam.eric, 'jam_state', {
      p_event: jam.id,
    })
    expect(st.queue).toEqual([
      jam.items['Song C'],
      jam.items['Song B'],
      jam.items['Song A'],
    ])

    // Played from the row, with Undo.
    const a = page.getByTestId('queue-row-1')
    await a.hover()
    await a.getByTestId('queue-row-played').click()
    await expect(queueTitles(page)).toHaveText(['Song B'])
    await page.getByTestId('toast-action').last().click()
    await expect(queueTitles(page)).toHaveText(['Song B', 'Song A'])
  })

  test('fill a gap from a hand and directly; pitches approve live', async ({
    page,
  }) => {
    jam = await freshJam({ live: true })
    await rpc(jam.sarah, 'raise_hand', {
      p_item: jam.items['Song A'],
      p_parts: ['bass'],
    })
    await rpc(jam.mike, 'pitch_song', {
      p_event: jam.id,
      p_title: 'Plush',
      p_artist: 'STP',
      p_my_parts: ['drums'],
    })
    await loginAs(page, SEED.eric)
    await openConsole(page, jam)

    const card = page.getByTestId('console-up-next')
    await expect(card.getByTestId('slot-bass-1')).toContainText('Open')
    // From hands → Sarah.
    await page.getByTestId('console-from-hands').click()
    await page.getByTestId(`fill-hand-${jam.people.Sarah}`).click()
    await expect(card.getByTestId('slot-bass-1')).toContainText('Sarah')

    // Directly: anyone here on drums.
    await card.getByTestId('slot-drums-1').click()
    await page.getByTestId(`fill-person-${jam.people.Mike}`).click()
    await expect(card.getByTestId('slot-drums-1')).toContainText('Mike')

    // A pending pitch, approved live, then queued.
    const pitch = page
      .getByTestId('console-pitches')
      .locator('li', { hasText: 'Plush' })
    await expect(pitch).toContainText('REQUEST')
    await pitch.getByTestId('pitch-approve').click()
    await expect(pitch).not.toContainText('REQUEST')
    await pitch.getByTestId('pitch-queue').click()
    await expect(queueTitles(page)).toContainText(['Song B', 'Song C', 'Plush'])

    // Grid view: the same casting.
    await page.getByTestId('console-view-grid').click()
    await expect(page.getByTestId('console-grid')).toContainText('Sarah')
  })

  test('walk-up, lock joining, remove a person, end jam', async ({ page }) => {
    jam = await freshJam({ live: true })
    await loginAs(page, SEED.eric)
    await openConsole(page, jam)

    // Walk-up with a hand on the up-next song.
    await page.getByTestId('console-walkup').click()
    await page.getByTestId('walkup-name-input').fill('Pete')
    await page.getByTestId('walkup-part-bass').click()
    await page.getByTestId(`walkup-song-${jam.items['Song A']}`).click()
    await page.getByTestId('walkup-submit').click()
    const people = page.getByTestId('console-people')
    await expect(people).toContainText('Pete')
    await expect(people).toContainText('WALK-UP')
    await expect(page.getByTestId('console-hands')).toContainText('Pete · Bass')

    // Lock joining: a new join by code is refused.
    await page.getByTestId('console-lock-joining').click()
    await expect(page.getByTestId('console-join-code')).toContainText(
      'JOINING LOCKED'
    )
    const leo = await clientAs(SEED.leo)
    const { error } = await leo.rpc('join_jam', { p_code: jam.code })
    expect(error?.message).toBe('not_taking_people')

    // Remove Mike (confirm names what goes).
    await page.getByTestId(`person-menu-${jam.people.Mike}`).click()
    await page.getByTestId('person-remove').click()
    await expect(page.getByTestId('confirm-dialog-message')).toContainText(
      'hands go'
    )
    await page.getByTestId('confirm-dialog-confirm').click()
    await expect(page.getByTestId(`person-${jam.people.Mike}`)).toHaveCount(0)

    // End jam → the jam page.
    await page.getByTestId('console-end').click()
    await page.getByTestId('confirm-dialog-confirm').click()
    await expect(page).toHaveURL(new RegExp(`/jam/${jam.id}$`))
    const ended = await rpc<{ jam: { status: string } }>(
      jam.eric,
      'jam_state',
      { p_event: jam.id }
    )
    expect(ended.jam.status).toBe('completed')
  })

  test('a guest is sent to the jam page', async ({ page }) => {
    jam = await freshJam({ live: true })
    await loginAs(page, SEED.sarah)
    await page.goto(`/jam/${jam.id}/live`)
    await expect(page).toHaveURL(new RegExp(`/jam/${jam.id}$`))
  })
})

test.describe('Host console · phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test('swipe left to clear with Undo, hold for the menu', async ({ page }) => {
    jam = await freshJam({ live: true })
    await loginAs(page, SEED.eric)
    await openConsole(page, jam)
    await expect(upNextTitle(page)).toHaveText('Song A')
    await expect(page.getByTestId('queue-hint')).toContainText('Swipe right')

    const swipe = async (index: number, dx: number) => {
      const front = page
        .getByTestId(`queue-row-${index}`)
        .getByTestId('queue-row-open')
      const box = (await front.boundingBox())!
      const y = box.y + box.height / 2
      const x = box.x + box.width / 2
      await page.mouse.move(x, y)
      await page.mouse.down()
      for (let i = 1; i <= 8; i++) await page.mouse.move(x + (dx * i) / 8, y)
      await page.mouse.up()
    }

    // Left: the tray (Played / Left / Remove).
    await swipe(1, -160)
    await page
      .getByTestId('queue-row-1')
      .getByTestId('queue-swipe-left')
      .click()
    await expect(queueTitles(page)).toHaveText(['Song B'])
    await page.getByTestId('toast-action').last().click()
    await expect(queueTitles(page)).toHaveText(['Song B', 'Song C'])

    // Right: up next.
    await swipe(1, 140)
    await expect(upNextTitle(page)).toHaveText('Song C')

    // Tap a row: its sheet with the same actions.
    await page.getByTestId('queue-row-0').getByTestId('queue-row-open').click()
    await expect(page.getByTestId('queue-item-sheet')).toBeVisible()
    await page.getByTestId('item-remove').click()
    await expect(queueTitles(page)).toHaveText(['Song B'])

    // Walk-up and People from the quick actions.
    await page.getByTestId('console-people-open').click()
    await expect(page.getByTestId('console-people-sheet')).toContainText(
      'Sarah'
    )
  })
})
