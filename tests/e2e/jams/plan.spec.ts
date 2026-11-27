/**
 * E2E — the planned jam (Phase 7a), on fresh jams Eric hosts: add songs
 * (SongBrowser + a free-text title), parts (Guitar 2, a custom part), hands
 * from a second browser as Sarah (raise, lower), accept a hand, pitches
 * (approve / decline), requests hidden from others when "Show song requests
 * to everyone" is off, the Grid view's gaps, settings (who can join; the code
 * card only in code mode), inviting a friend, deleting, an ended jam saved as
 * a setlist, and "Add to My Songs" from a lineup song.
 */
import { test, expect, type Page } from '@playwright/test'
import { getSupabaseAdmin } from '../../fixtures/supabase'
import { befriend, makePerson, removePeople } from '../friends/friendsHelpers'
import {
  VIEWPORTS,
  cleanUpJams,
  freshJam,
  openJam,
  rpc,
  second,
  signIn,
  userId,
} from './jamSetup'

interface State {
  people: { participant_id: string; user_id?: string; name: string }[]
  items: { id: string; title: string; state: string }[]
}
const jamState = (id: string) =>
  rpc<State>('eric', 'jam_state', { p_event: id })
const itemId = async (jam: string, title: string) =>
  (await jamState(jam)).items.find(i => i.title === title)!.id
const pidOf = async (jam: string, who: 'sarah' | 'mike') => {
  const uid = await userId(who)
  return (await jamState(jam)).people.find(p => p.user_id === uid)!
    .participant_id
}
const stamp = () => Date.now().toString(36)

async function tab(page: Page, name: string) {
  await page.getByTestId(`jam-tabs-${name}`).click()
}

for (const { label, viewport } of VIEWPORTS) {
  test.describe(`Planned jam (${label})`, () => {
    test.use({ viewport })
    test.afterAll(cleanUpJams)

    test.beforeEach(async ({ page }) => {
      await signIn(page, 'eric')
    })

    test('add songs from the catalog and a free-text title', async ({
      page,
    }) => {
      const jam = await freshJam('eric', { band: true })
      await openJam(page, jam.id)
      await expect(page.getByTestId('jam-lineup-empty')).toBeVisible()

      await page.getByTestId('jam-add-songs').click()
      await expect(page.getByTestId('song-browser')).toBeVisible()
      await page.locator('[data-testid^="browser-song-"]').first().click()
      await expect(page.getByTestId('browser-added-count')).toHaveText(
        '1 added'
      )
      const title = `Nobody Catalogued ${stamp()}`
      await page.getByTestId('browser-search-input').fill(title)
      await page.getByTestId('browser-add-title').click()
      await expect(page.getByTestId('browser-added-count')).toHaveText(
        '2 added'
      )
      await page.getByTestId('browser-done').click()

      const lineup = page.getByTestId('jam-lineup')
      await expect(lineup.locator('li')).toHaveCount(2)
      await expect(lineup).toContainText(title)
    })

    test('parts: a second guitar and a custom part', async ({ page }) => {
      const jam = await freshJam('eric')
      await rpc('eric', 'add_lineup_title', {
        p_event: jam.id,
        p_title: 'Low Rider',
        p_artist: 'War',
      })
      const item = await itemId(jam.id, 'Low Rider')
      await openJam(page, jam.id)

      await page.getByTestId(`jam-item-menu-${item}`).click()
      await page.getByTestId('jam-item-parts').click()
      await page.getByTestId('jam-parts-add-guitar').click()
      await page.getByTestId('jam-parts-custom-input').fill('Harmonica')
      await page.getByTestId('jam-parts-custom-add').click()
      await page.getByTestId('jam-parts-save').click()

      await expect(page.getByTestId(`jam-slot-${item}-guitar-2`)).toContainText(
        'Guitar 2'
      )
      await expect(
        page.getByTestId(`jam-slot-${item}-other-harmonica-1`)
      ).toContainText('Harmonica')
    })

    test('hands from a second browser; the host accepts one', async ({
      page,
      browser,
    }) => {
      const jam = await freshJam('eric', { join: ['sarah'] })
      await rpc('eric', 'add_lineup_title', {
        p_event: jam.id,
        p_title: 'Black',
        p_artist: 'Pearl Jam',
      })
      const item = await itemId(jam.id, 'Black')
      const sarah = await second(browser, 'sarah', viewport)
      try {
        await openJam(sarah.page, jam.id)
        await expect(sarah.page.getByTestId('jam-my-parts')).toContainText(
          'Bass'
        )
        await sarah.page.getByTestId(`jam-item-title-${item}`).click()
        await expect(sarah.page.getByTestId('jam-hand-sheet')).toBeVisible()
        // Raise and lower Vocals; raise Bass.
        const vox = sarah.page.getByTestId('jam-hand-vox')
        await vox.click()
        await expect(vox).toHaveAttribute('aria-pressed', 'true')
        await vox.click()
        await expect(vox).toHaveAttribute('aria-pressed', 'false')
        await sarah.page.getByTestId('jam-hand-bass').click()
        await expect(sarah.page.getByTestId('jam-hand-bass')).toHaveAttribute(
          'aria-pressed',
          'true'
        )
        await sarah.page.getByTestId('jam-hand-done').click()

        // The host sees the hand (live) and accepts it.
        await openJam(page, jam.id)
        const bass = page.getByTestId(`jam-slot-${item}-bass-1`)
        await expect(bass).toHaveAttribute('aria-label', /1 hands up/)
        await bass.click()
        const pid = await pidOf(jam.id, 'sarah')
        await page.getByTestId(`jam-cast-accept-${pid}`).click()
        await expect(bass).toContainText('Sarah')

        // …and puts Sarah on drums directly (set_cast, no hand).
        await page.getByTestId(`jam-slot-${item}-drums-1`).click()
        await page.getByTestId(`jam-cast-person-${pid}`).click()
        await expect(
          page.getByTestId(`jam-slot-${item}-drums-1`)
        ).toContainText('Sarah')
        // Sarah's page follows without a reload.
        await expect(
          sarah.page.getByTestId(`jam-slot-${item}-bass-1`)
        ).toHaveAttribute('data-mine', 'true')
      } finally {
        await sarah.ctx.close()
      }
    })

    test('pitches: approve one, decline another', async ({ page, browser }) => {
      const jam = await freshJam('eric', { join: ['sarah'] })
      const sarah = await second(browser, 'sarah', viewport)
      const keep = `Plush ${stamp()}`
      const drop = `Wonderwall ${stamp()}`
      try {
        await openJam(sarah.page, jam.id)
        for (const t of [keep, drop]) {
          await tab(sarah.page, 'request')
          await sarah.page.getByTestId('jam-request-title-input').fill(t)
          await sarah.page.getByTestId('jam-request-artist-input').fill('Band')
          await sarah.page.getByTestId('jam-request-looking-drums').click()
          await sarah.page.getByTestId('jam-request-send').click()
          await expect(
            sarah.page.getByTestId('jam-guest-requests')
          ).toContainText(t)
        }

        await openJam(page, jam.id)
        await tab(page, 'requests')
        const reqs = page.getByTestId('jam-requests')
        await expect(reqs).toContainText(keep)
        await expect(reqs).toContainText('Asked by Sarah')
        const keepId = await itemId(jam.id, keep)
        const dropId = await itemId(jam.id, drop)
        await page.getByTestId(`jam-request-approve-${keepId}`).click()
        await page.getByTestId(`jam-request-decline-${dropId}`).click()
        await expect(page.getByTestId('jam-requests-empty')).toBeVisible()
        await tab(page, 'lineup')
        await expect(page.getByTestId('jam-lineup')).toContainText(keep)
        await expect(page.getByTestId('jam-lineup')).not.toContainText(drop)
      } finally {
        await sarah.ctx.close()
      }
    })

    test('settings: requests hidden from others, who can join, the code card', async ({
      page,
      browser,
    }) => {
      const jam = await freshJam('eric', { join: ['sarah', 'mike'] })
      const pitch = `Mike's pick ${stamp()}`
      await rpc('mike', 'pitch_song', { p_event: jam.id, p_title: pitch })
      const sarah = await second(browser, 'sarah', viewport)
      try {
        await openJam(sarah.page, jam.id)
        await expect(
          sarah.page.getByTestId('jam-guest-requests')
        ).toContainText(pitch)

        await openJam(page, jam.id)
        if (label === 'desktop')
          await expect(page.getByTestId('jam-share-card')).toBeVisible()
        else await expect(page.getByTestId('jam-share-button')).toBeVisible()
        await expect(page.getByTestId('jam-code-line')).toContainText('Code')

        await page.getByTestId('jam-more').click()
        await page.getByTestId('jam-menu-settings').click()
        await page.getByTestId('jam-settings-who-friends').click()
        await page.getByTestId('jam-settings-advanced').click()
        await page.getByTestId('jam-settings-requests-visible').click()
        await page.getByTestId('jam-settings-save').click()
        await expect(page.getByTestId('jam-settings-sheet')).toHaveCount(0)

        await expect(page.getByTestId('jam-code-line')).not.toContainText(
          'Code'
        )
        await expect(page.getByTestId('jam-share-card')).toHaveCount(0)
        await expect(page.getByTestId('jam-share-button')).toHaveCount(0)
        // The host still sees the request; Sarah no longer does.
        await tab(page, 'requests')
        await expect(page.getByTestId('jam-requests')).toContainText(pitch)
        await sarah.page.reload()
        await expect(sarah.page.getByTestId('jam-title')).toBeVisible()
        await expect(sarah.page.getByTestId('jam-guest-requests')).toHaveCount(
          0
        )

        // Settings persist.
        await page.reload()
        await page.getByTestId('jam-more').click()
        await page.getByTestId('jam-menu-settings').click()
        await expect(
          page.getByTestId('jam-settings-who-friends')
        ).toHaveAttribute('aria-checked', 'true')
        await expect(
          page.getByTestId('jam-settings-requests-visible')
        ).toHaveAttribute('aria-checked', 'false')
      } finally {
        await sarah.ctx.close()
      }
    })

    test('Grid view shows the gaps', async ({ page }) => {
      const jam = await freshJam('eric')
      await rpc('eric', 'add_lineup_title', {
        p_event: jam.id,
        p_title: 'Creep',
      })
      const item = await itemId(jam.id, 'Creep')
      await openJam(page, jam.id)
      await page.getByTestId('jam-grid-toggle').click()
      const grid = page.getByTestId('jam-grid')
      await expect(grid).toBeVisible()
      await expect(
        page.getByTestId(`jam-grid-cell-${item}-bass-1`)
      ).toHaveAttribute('data-gap', 'true')
      await expect(page.getByTestId(`jam-grid-cell-${item}-bass-1`)).toHaveText(
        'Open'
      )
      // Tapping a gap opens the cast sheet.
      await page.getByTestId(`jam-grid-cell-${item}-bass-1`).click()
      await expect(page.getByTestId('jam-cast-sheet')).toBeVisible()
    })

    test('invite a friend', async ({ page }) => {
      const jam = await freshJam('eric')
      const friend = await makePerson('Jamie')
      try {
        await befriend(friend, { id: await userId('eric') } as never)
        await openJam(page, jam.id)
        await tab(page, 'people')
        await page.getByTestId('jam-invite-button').click()
        await page.getByTestId(`jam-invite-friend-${friend.id}`).click()
        await page.getByTestId('jam-invite-send').click()
        await expect(page.getByTestId('jam-people')).toContainText(friend.name)
        await expect(page.getByTestId('jam-people')).toContainText('Invited')
      } finally {
        await removePeople([friend])
      }
    })

    test('delete a planned jam names the consequence', async ({ page }) => {
      const jam = await freshJam('eric')
      await openJam(page, jam.id)
      await page.getByTestId('jam-more').click()
      await page.getByTestId('jam-menu-delete').click()
      await expect(page.getByTestId('confirm-dialog-message')).toHaveText(
        'Removes the jam and its lineup for everyone who joined. They’ll get a notice.'
      )
      await page.getByTestId('confirm-dialog-confirm').click()
      await expect(page).toHaveURL(/\/jam$/)
      await page.goto(`/jam/${jam.id}`)
      await expect(page.getByTestId('jam-not-found')).toBeVisible()
    })

    test('an ended jam saves tonight as a setlist', async ({ page }) => {
      const jam = await freshJam('eric')
      const title = `Encore ${stamp()}`
      await rpc('eric', 'add_lineup_title', { p_event: jam.id, p_title: title })
      const item = await itemId(jam.id, title)
      await rpc('eric', 'go_live', { p_event: jam.id })
      await rpc('eric', 'call_up', { p_item: item })
      await rpc('eric', 'end_jam', { p_event: jam.id })

      await openJam(page, jam.id)
      await expect(page.getByTestId('jam-ended-summary')).toHaveText(
        'Ended · 1 song played'
      )
      await expect(page.getByTestId('jam-played')).toContainText(title)
      await page.getByTestId('jam-save-setlist').click()
      await page.getByTestId('jam-save-setlist-personal').click()
      await expect(page).toHaveURL(/\/setlists\/[0-9a-f-]{36}$/)
      const setlist = page.url().split('/').pop()!
      const admin = await getSupabaseAdmin()
      await admin.from('setlists').delete().eq('id', setlist)
      await admin.from('songs').delete().eq('title', title)
    })

    test('Add to My Songs from a lineup song', async ({ page }) => {
      const jam = await freshJam('eric')
      const title = `Fresh Tune ${stamp()}`
      await rpc('eric', 'add_lineup_title', {
        p_event: jam.id,
        p_title: title,
        p_artist: 'Nobody Yet',
      })
      const item = await itemId(jam.id, title)
      try {
        await openJam(page, jam.id)
        const mine = page.getByTestId(`jam-mine-${item}`)
        await expect(mine).toHaveAttribute('data-mine', 'none')
        await expect(mine).toHaveText('Add to My Songs')
        await mine.click()
        await expect(mine).toHaveAttribute('data-mine', 'jam-song')
      } finally {
        const admin = await getSupabaseAdmin()
        await admin.from('songs').delete().eq('title', title)
      }
    })
  })
}
