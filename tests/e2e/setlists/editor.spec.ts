/**
 * The setlist editor (docs/redesign/10 · 2.3–2.4, 03-screens Setlists): full
 * width with ← Setlists, the name switcher, header ⋯, totals with retunes and
 * the show slot, Add songs (incl. From my songs), breaks and sections in
 * place, the row menu's Move / Remove, drag, and saving as you go.
 */
import { test, expect, Page } from '@playwright/test'
import {
  createTestUser,
  signUpViaUI,
  deleteTestUser,
  getCurrentUserId,
} from '../../fixtures/auth'
import { createBandViaUI } from '../../fixtures/bands'
import { getSupabaseAdmin } from '../../fixtures/supabase'
import {
  setupConsoleErrorTracking,
  assertNoConsoleErrors,
} from '../../helpers/assertions'
import { attachShowCopy } from '../../helpers/calendarSeed'

type Seed = {
  userId: string
  bandId: string
  fall: string
  other: string
  songs: Record<string, string>
  mine: string
}

/**
 * A band with four songs (Black, Everlong in Drop D, Breed, Creep) and a
 * personal "Mine"; Fall Set = Black, Everlong (a 6-minute show slot) and an
 * empty Acoustic Sunday.
 */
async function setup(page: Page): Promise<Seed> {
  await signUpViaUI(page, createTestUser())
  await createBandViaUI(page, `Editor ${Date.now()}`)
  const userId = await getCurrentUserId(page)
  const admin = await getSupabaseAdmin()
  const { data: m } = await admin
    .from('band_memberships')
    .select('band_id')
    .eq('user_id', userId)
    .single()
  const bandId = m!.band_id as string
  const { data: rows } = await admin
    .from('songs')
    .insert(
      (
        [
          ['Black', 'Standard', 343],
          ['Everlong', 'Drop D', 250],
          ['Breed', 'Standard', 184],
          ['Creep', 'Standard', 238],
        ] as const
      ).map(([title, guitar_tuning, duration]) => ({
        title,
        guitar_tuning,
        duration,
        context_type: 'band',
        context_id: bandId,
        created_by: userId,
      }))
    )
    .select('id, title')
  const songs = Object.fromEntries(rows!.map(r => [r.title, r.id as string]))
  const { data: mine } = await admin
    .from('songs')
    .insert({
      title: 'Mine',
      guitar_tuning: 'Standard',
      duration: 200,
      context_type: 'personal',
      context_id: userId,
      created_by: userId,
    })
    .select('id')
    .single()
  const { data: sets } = await admin
    .from('setlists')
    .insert([
      {
        name: 'Fall Set',
        band_id: bandId,
        context_type: 'band',
        context_id: bandId,
        created_by: userId,
        items: [songs.Black, songs.Everlong].map((songId, i) => ({
          id: `i${i}`,
          type: 'song',
          position: i + 1,
          songId,
        })),
      },
      {
        name: 'Acoustic Sunday',
        band_id: bandId,
        context_type: 'band',
        context_id: bandId,
        created_by: userId,
        items: [],
      },
    ])
    .select('id, name')
  const fall = sets!.find(s => s.name === 'Fall Set')!.id as string
  const { data: show } = await admin
    .from('shows')
    .insert({
      name: 'Next Gig',
      venue: 'The Crocodile',
      band_id: bandId,
      duration: 6,
      scheduled_date: new Date(Date.now() + 5 * 864e5).toISOString(),
      created_by: userId,
    })
    .select('id')
    .single()
  await attachShowCopy(show!.id, fall)
  return {
    userId,
    bandId,
    fall,
    other: sets!.find(s => s.name === 'Acoustic Sunday')!.id as string,
    songs,
    mine: mine!.id as string,
  }
}

const titles = (page: Page) =>
  page.getByTestId('setlist-song-title').allTextContents()

test.describe('Setlist editor', () => {
  let seed: Seed | undefined
  test.afterEach(async () => {
    if (seed) await deleteTestUser(seed.userId)
    seed = undefined
  })

  test.describe('desktop', () => {
    test.use({ viewport: { width: 1280, height: 900 } })

    test('full width, ← Setlists, totals with the retune and the slot', async ({
      page,
    }) => {
      const errors = setupConsoleErrorTracking(page)
      seed = await setup(page)
      await page.goto(`/setlists/${seed.fall}`)

      await expect(page.getByTestId('setlist-name-display')).toHaveText(
        'Fall Set'
      )
      await expect(page.getByTestId('setlist-show-line')).toContainText(
        'The Crocodile'
      )
      const totals = page.getByTestId('setlist-totals').first()
      await expect(totals).toContainText('2 songs')
      await expect(page.getByTestId('setlist-runtime')).toHaveText(
        '10 of 6 min'
      )
      await expect(totals).toContainText('1 retune')
      await expect(page.getByTestId('setlist-slot').first()).toHaveAttribute(
        'data-over',
        'true'
      )
      await expect(page.getByTestId('setlist-retune')).toHaveCount(1)

      // Nothing between the sidebar and the editor.
      const box = await page.getByTestId('setlist-view-page').boundingBox()
      expect(box!.x).toBeLessThan(300)
      expect(box!.width).toBeGreaterThan(900)

      await page.getByTestId('setlist-back').click()
      await expect(page).toHaveURL(/\/setlists$/)
      await assertNoConsoleErrors(page, errors)
    })

    test('the caret switcher opens another set in place; All setlists → index', async ({
      page,
    }) => {
      seed = await setup(page)
      await page.goto(`/setlists/${seed.fall}`)
      await page.getByTestId('setlist-switcher-toggle').click()
      const sheet = page.getByTestId('setlist-switcher')
      await expect(sheet).toContainText('Setlists · 2')
      await expect(
        page.getByTestId(`setlist-switch-${seed.fall}`)
      ).toHaveAttribute('aria-checked', 'true')
      await page.getByTestId(`setlist-switch-${seed.other}`).click()
      await expect(page).toHaveURL(new RegExp(`/setlists/${seed.other}$`))
      await expect(page.getByTestId('setlist-name-display')).toHaveText(
        'Acoustic Sunday'
      )
      await expect(page.getByTestId('setlist-editor-empty')).toBeVisible()

      await page.getByTestId('setlist-switcher-toggle').click()
      await page.getByTestId('setlist-switch-all').click()
      await expect(page).toHaveURL(/\/setlists$/)
    })

    test('Add songs: + goes in after the selected row; your own song is copied in', async ({
      page,
    }) => {
      seed = await setup(page)
      await page.goto(`/setlists/${seed.fall}`)
      // Select Black, then add Breed: it lands second.
      await page.getByTestId('setlist-song-i0').click()
      await page.getByTestId('setlist-add-songs').click()
      const browser = page.getByTestId('song-browser')
      await expect(
        browser.getByTestId(`browser-song-${seed.songs.Black}`)
      ).toHaveAttribute('data-in-set', 'true')
      await browser.getByTestId(`browser-song-${seed.songs.Breed}`).click()
      await expect
        .poll(() => titles(page))
        .toEqual(['Black', 'Breed', 'Everlong'])
      // From my songs: copied into the band, added after Breed.
      await browser.getByTestId(`browser-song-${seed.mine}`).click()
      await expect
        .poll(() => titles(page))
        .toEqual(['Black', 'Breed', 'Mine', 'Everlong'])
      const admin = await getSupabaseAdmin()
      const { data } = await admin
        .from('songs')
        .select('id')
        .eq('context_id', seed.bandId)
        .eq('title', 'Mine')
      expect(data).toHaveLength(1)

      // Saved as we went.
      await page.reload()
      await expect
        .poll(() => titles(page))
        .toEqual(['Black', 'Breed', 'Mine', 'Everlong'])
    })

    test('the browser filters by another setlist', async ({ page }) => {
      seed = await setup(page)
      await page.goto(`/setlists/${seed.other}`)
      await page.getByTestId('setlist-empty-add-songs').click()
      const browser = page.getByTestId('song-browser')
      await expect(
        browser.getByTestId(`browser-song-${seed.songs.Creep}`)
      ).toBeVisible()
      await browser.getByTestId('browser-setlist-filter').click()
      await page.getByTestId(`browser-setlist-option-${seed.fall}`).click()
      await expect(browser.getByTestId('browser-setlist-filter')).toHaveText(
        'In Fall Set'
      )
      await expect(
        browser.locator('[data-testid^="browser-song-"]')
      ).toHaveCount(2)
      await expect(
        browser.getByTestId(`browser-song-${seed.songs.Everlong}`)
      ).toBeVisible()
      await browser.getByTestId(`browser-song-${seed.songs.Everlong}`).click()
      await expect.poll(() => titles(page)).toEqual(['Everlong'])

      await browser.getByTestId('browser-setlist-filter').click()
      await page.getByTestId('browser-setlist-option-any').click()
      await expect(
        browser.getByTestId(`browser-song-${seed.songs.Creep}`)
      ).toBeVisible()
    })

    test('+ Break and + Section insert after the selection and edit in place', async ({
      page,
    }) => {
      seed = await setup(page)
      await page.goto(`/setlists/${seed.fall}`)
      await page.getByTestId('setlist-song-i0').click()
      await page.getByTestId('setlist-add-break').click()
      const brk = page.locator('[data-testid^="setlist-break-"][data-selected]')
      await expect(brk).toContainText('Break · 15 min')
      await page.getByTestId('setlist-break-minutes-20').click()
      await page.getByTestId('setlist-break-note-input').fill('Swap kit')
      await page.getByTestId('setlist-break-done').click()
      await expect(brk).toContainText('Break · 20 min')
      await expect(brk).toContainText('Swap kit')
      await expect(page.getByTestId('setlist-runtime')).toContainText('30 of')

      await page.getByTestId('setlist-add-section').click()
      const input = page.getByTestId('setlist-section-input')
      await expect(input).toHaveValue('Set 1')
      await input.fill('Encore')
      await input.press('Enter')
      await expect(page.getByTestId('setlist-section-title')).toHaveText(
        'Encore'
      )

      await page.reload()
      await expect
        .poll(async () =>
          (
            await page
              .getByTestId('setlist-rows')
              .locator(':scope > li')
              .allTextContents()
          ).join('|')
        )
        .toMatch(/Black.*Break · 20 min.*Encore.*Everlong/)
    })

    test('row menu: To top, Note for this set, Remove (stays in your songs)', async ({
      page,
    }) => {
      seed = await setup(page)
      await page.goto(`/setlists/${seed.fall}`)
      await page.getByTestId('setlist-song-i1').click({ button: 'right' })
      await page.getByTestId('setlist-move-top').click()
      await expect.poll(() => titles(page)).toEqual(['Everlong', 'Black'])

      await page.getByTestId('setlist-song-i1').click({ button: 'right' })
      await page.getByTestId('setlist-row-note').click()
      await page.getByTestId('setlist-item-note-input').fill('Count in slow')
      await page.getByTestId('setlist-item-note-sheet-save').click()
      await expect(page.getByTestId('setlist-song-note')).toHaveText(
        'Count in slow'
      )

      await page.getByTestId('setlist-song-i0').click({ button: 'right' })
      await page.getByTestId('setlist-row-remove').click()
      await expect(page.getByTestId('confirm-dialog-message')).toContainText(
        'stays in your songs'
      )
      await page.getByTestId('confirm-dialog-confirm').click()
      await expect.poll(() => titles(page)).toEqual(['Everlong'])
    })

    test('drag by the grip (keyboard or mouse) reorders and saves', async ({
      page,
    }) => {
      seed = await setup(page)
      await page.goto(`/setlists/${seed.fall}`)
      const grip = page
        .getByTestId('setlist-song-i0')
        .getByTestId('setlist-row-grip')
      await grip.focus()
      await page.keyboard.press('Space')
      await page.waitForTimeout(150)
      await page.keyboard.press('ArrowDown')
      await page.waitForTimeout(150)
      await page.keyboard.press('Space')
      await expect.poll(() => titles(page)).toEqual(['Everlong', 'Black'])
      await page.reload()
      await expect.poll(() => titles(page)).toEqual(['Everlong', 'Black'])

      // Mouse: drag Black's grip above Everlong.
      const from = await page
        .getByTestId('setlist-song-i0')
        .getByTestId('setlist-row-grip')
        .boundingBox()
      const to = await page.getByTestId('setlist-song-i1').boundingBox()
      await page.mouse.move(from!.x + 10, from!.y + 10)
      await page.mouse.down()
      await page.mouse.move(from!.x + 10, to!.y + 4, { steps: 12 })
      await page.mouse.up()
      await expect.poll(() => titles(page)).toEqual(['Black', 'Everlong'])
    })

    test('header ⋯: Rename, Duplicate (no show), Delete keeps the show copy', async ({
      page,
    }) => {
      seed = await setup(page)
      await page.goto(`/setlists/${seed.fall}`)

      await page.getByTestId('setlist-header-menu').click()
      await page.getByTestId('setlist-menu-rename').click()
      await page.getByTestId('setlist-name-input').fill('Winter Set')
      await page.getByTestId('setlist-name-input').press('Enter')
      await expect(page.getByTestId('setlist-name-display')).toHaveText(
        'Winter Set'
      )

      await page.getByTestId('setlist-header-menu').click()
      await page.getByTestId('setlist-menu-duplicate').click()
      await expect(page.getByTestId('setlist-name-display')).toHaveText(
        'Winter Set copy'
      )
      await expect(page.getByTestId('setlist-show-line')).toContainText(
        /Not attached to a show/i
      )
      await expect.poll(() => titles(page)).toEqual(['Black', 'Everlong'])

      await page.goto(`/setlists/${seed.fall}`)
      await page.getByTestId('setlist-header-menu').click()
      await page.getByTestId('setlist-menu-delete').click()
      await expect(page.getByTestId('confirm-dialog-message')).toContainText(
        'shows keep their own copy'
      )
      await page.getByTestId('confirm-dialog-confirm').click()
      await expect(page).toHaveURL(/\/setlists$/)
      await expect(page.getByTestId(`setlist-card-${seed.fall}`)).toHaveCount(0)
    })
  })

  test.describe('phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

    test('⇄ opens the switch sheet; All setlists → the list', async ({
      page,
    }) => {
      seed = await setup(page)
      await page.goto(`/setlists/${seed.fall}`)
      await expect.poll(() => titles(page)).toEqual(['Black', 'Everlong'])
      // The seed's realtime refresh can land mid-tap under load: retry.
      const sheet = page.getByTestId('setlist-switcher')
      await expect(async () => {
        await page.getByTestId('setlist-switcher-toggle').tap()
        await expect(sheet).toBeVisible({ timeout: 1000 })
      }).toPass()
      await expect(sheet).toContainText('Switch setlist')
      await expect(sheet).toContainText('The Crocodile')
      await page.getByTestId(`setlist-switch-${seed.other}`).tap()
      await expect(page).toHaveURL(new RegExp(`/setlists/${seed.other}$`))

      await page.getByTestId('setlist-name-display').tap()
      await page.getByTestId('setlist-switch-all').tap()
      await expect(page).toHaveURL(/\/setlists$/)
    })

    test('Add → Break inserts after the last row; Add → Songs picks many', async ({
      page,
    }) => {
      seed = await setup(page)
      await page.goto(`/setlists/${seed.fall}`)
      await expect.poll(() => titles(page)).toEqual(['Black', 'Everlong'])
      await expect(async () => {
        await page.getByTestId('setlist-add').tap()
        await expect(page.getByTestId('setlist-add-sheet')).toBeVisible({
          timeout: 1000,
        })
      }).toPass()
      await page.getByTestId('setlist-addmenu-break').tap()
      await expect(page.getByTestId('setlist-insert-after')).toContainText(
        'Everlong'
      )
      await page.getByTestId('setlist-insert-minutes-10').tap()
      await page.getByTestId('setlist-insert-confirm').tap()
      await expect(page.getByTestId('setlist-break-summary')).toContainText(
        'Break · 10 min'
      )

      await page.getByTestId('setlist-add').tap()
      await page.getByTestId('setlist-addmenu-songs').tap()
      await page.getByTestId(`browser-song-${seed.songs.Breed}`).tap()
      await page.getByTestId(`browser-song-${seed.songs.Creep}`).tap()
      await expect(page.getByTestId('browser-add-picked')).toHaveText(
        /Add 2 songs/
      )
      await page.getByTestId('browser-add-picked').tap()
      await expect(page.getByTestId('song-browser')).toHaveCount(0)
      await expect
        .poll(() => titles(page))
        .toEqual(['Black', 'Everlong', 'Breed', 'Creep'])
    })
  })
})
