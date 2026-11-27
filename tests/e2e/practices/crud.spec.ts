/**
 * Practices (docs/redesign 03-screens Practice; Practice 1, FP 7): the practice
 * page edits in place, like a setlist with a few more fields. New from the
 * calendar is the page blank and the first change creates it; name, when,
 * where and focus save as you go; songs come from the Add songs drawer, drag by the
 * grip and × out; Duplicate makes a copy a week later; delete from the
 * agenda's row menu; the old /edit URL lands on the page. From a setlist (its
 * ⋯ → Plan a practice, or Add songs filtered by it) songs keep the set's order,
 * and a RETUNE line sits on each song whose tuning differs from the one before.
 * A song opened from the practice comes Back to it; from 1440 px a click
 * previews it in the song pane and a double-click opens it. A past practice
 * can still start, and its wrap-up notes edit in place.
 */
import { test, expect, type Page } from '@playwright/test'
import { deleteTestUser } from '../../fixtures/auth'
import { getSupabaseAdmin } from '../../fixtures/supabase'
import {
  setupConsoleErrorTracking,
  assertNoConsoleErrors,
} from '../../helpers/assertions'
import { seedCalendar, type CalendarSeed } from '../../helpers/calendarSeed'

const practices = async (bandId: string) => {
  const admin = await getSupabaseAdmin()
  const { data } = await admin
    .from('practice_sessions')
    .select('id, name, location, notes, duration, scheduled_date, songs')
    .eq('band_id', bandId)
    .order('scheduled_date')
  return data!
}

const order = (page: Page) =>
  page
    .locator('li[data-testid^="practice-song-"]')
    .evaluateAll(els =>
      els.map(e => e.getAttribute('data-testid')!.replace('practice-song-', ''))
    )

test.describe('Practices', () => {
  test.use({ viewport: { width: 1280, height: 900 } })
  let seed: CalendarSeed | undefined
  test.afterEach(async () => {
    if (seed) await deleteTestUser(seed.userId)
    seed = undefined
  })

  test('New practice is the page blank; the first change creates it', async ({
    page,
  }) => {
    const errors = setupConsoleErrorTracking(page)
    seed = await seedCalendar(page)
    await page.goto('/calendar?type=practice')
    await page.getByTestId('calendar-new-button').click()
    await expect(page).toHaveURL(/\/practices\/new/)
    await expect(page.getByTestId('practice-kicker')).toContainText(
      /saves as you go/i
    )

    await page.getByTestId('practice-name-input').fill('Set run')
    await page.getByTestId('practice-name-input').press('Enter')
    await expect(page).toHaveURL(/\/practices\/[0-9a-f-]{36}$/)
    await page.getByTestId('practice-location-input').fill('The Loft')
    await page.getByTestId('practice-location-input').press('Enter')
    // Focus is plain text, saved on leave.
    await page.getByTestId('practice-focus-input').fill('Tighten the outro')
    await page.getByTestId('practice-focus-input').blur()

    // Songs come from the Add songs drawer.
    await page.getByTestId('practice-add-songs').click()
    await page.getByTestId(`browser-song-${seed.songs.Breed}`).click()
    await page.getByTestId(`browser-song-${seed.songs.Black}`).click()
    await expect
      .poll(() => order(page))
      .toEqual([seed.songs.Breed, seed.songs.Black])

    await expect
      .poll(async () =>
        (await practices(seed!.bandId)).find(p => p.name === 'Set run')
      )
      .toMatchObject({ location: 'The Loft', notes: 'Tighten the outro' })
    const saved = (await practices(seed.bandId)).find(p => p.name === 'Set run')
    expect(saved?.songs.map((s: { songId: string }) => s.songId)).toEqual([
      seed.songs.Breed,
      seed.songs.Black,
    ])
    await assertNoConsoleErrors(page, errors)
  })

  test('fields save in place; × removes a song; /edit lands here', async ({
    page,
  }) => {
    seed = await seedCalendar(page)
    await page.goto(`/practices/${seed.practice}/edit`)
    await expect(page).toHaveURL(new RegExp(`/practices/${seed.practice}$`))
    await expect(page.getByTestId('practice-name-input')).toHaveValue(
      'Thursday run'
    )
    await page.getByTestId('practice-location-input').fill('Studio B')
    await page.getByTestId('practice-location-input').press('Enter')
    await page.getByTestId('practice-end-input').click()
    await page.getByTestId('practice-end-option-90').click()
    await page
      .getByTestId(`practice-song-${seed.songs.Breed}`)
      .getByTestId('practice-song-remove')
      .click()
    await expect(
      page.getByTestId(`practice-song-${seed.songs.Breed}`)
    ).toHaveCount(0)

    await expect
      .poll(async () => (await practices(seed!.bandId))[0])
      .toMatchObject({ location: 'Studio B', duration: 90 })
    const [p] = await practices(seed.bandId)
    expect(p.songs).toHaveLength(2)

    // Full width on desktop: Add songs also sits top right.
    await page.getByTestId('practice-header-add-songs').click()
    await expect(page.getByTestId('song-browser')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('song-browser')).toHaveCount(0)
  })

  test('Add to… on the Songs page ticks setlists and upcoming practices', async ({
    page,
  }) => {
    seed = await seedCalendar(page)
    await page.goto('/songs')
    const row = page.getByTestId(`song-row-${seed.songs.Breed}`)
    await row.hover()
    await row.getByLabel('Add to setlist or practice').click()
    const sheet = page.getByTestId('add-to-setlist-sheet')
    const practice = sheet.getByTestId(`add-to-practice-${seed.practice}`)
    const set = sheet.getByTestId(`add-to-setlist-${seed.fall}`)
    await expect(practice).toHaveAttribute('data-in-set', 'true')
    await expect(set).not.toHaveAttribute('data-in-set', 'true')

    await set.click()
    await expect(set).toHaveAttribute('data-in-set', 'true')
    await practice.click()
    await expect(practice).not.toHaveAttribute('data-in-set', 'true')
    await sheet.getByTestId('add-to-done').click()
    await expect(sheet).toHaveCount(0)

    const admin = await getSupabaseAdmin()
    const { data: sl } = await admin
      .from('setlists')
      .select('items')
      .eq('id', seed.fall)
      .single()
    expect((sl!.items as { songId?: string }[]).map(i => i.songId)).toContain(
      seed.songs.Breed
    )
    const [p] = await practices(seed.bandId)
    expect(p.songs.map((s: { songId: string }) => s.songId)).toEqual([
      seed.songs.Black,
      seed.songs.Everlong,
    ])
  })

  test('drag by the grip (keyboard or mouse) reorders the songs', async ({
    page,
  }) => {
    seed = await seedCalendar(page)
    await page.goto(`/practices/${seed.practice}`)
    const { Black, Everlong, Breed } = seed.songs
    await expect.poll(() => order(page)).toEqual([Black, Everlong, Breed])

    // Keyboard: Black down one.
    await page
      .getByTestId(`practice-song-${Black}`)
      .getByTestId('practice-song-grip')
      .focus()
    await page.keyboard.press('Space')
    await page.waitForTimeout(150)
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(150)
    await page.keyboard.press('Space')
    await expect.poll(() => order(page)).toEqual([Everlong, Black, Breed])

    // Mouse: Breed's grip to the top.
    const from = await page
      .getByTestId(`practice-song-${Breed}`)
      .getByTestId('practice-song-grip')
      .boundingBox()
    const to = await page.getByTestId(`practice-song-${Everlong}`).boundingBox()
    await page.mouse.move(from!.x + 10, from!.y + 10)
    await page.mouse.down()
    await page.mouse.move(from!.x + 10, to!.y + 4, { steps: 12 })
    await page.mouse.up()
    await expect.poll(() => order(page)).toEqual([Breed, Everlong, Black])

    await expect
      .poll(async () =>
        (await practices(seed!.bandId))[0].songs.map(
          (s: { songId: string }) => s.songId
        )
      )
      .toEqual([Breed, Everlong, Black])
    await page.reload()
    await expect.poll(() => order(page)).toEqual([Breed, Everlong, Black])
  })

  test('Duplicate makes the same practice a week later and opens it', async ({
    page,
  }) => {
    seed = await seedCalendar(page)
    await page.goto(`/practices/${seed.practice}`)
    await page.getByTestId('practice-menu').click()
    await page.getByTestId('practice-menu-duplicate').click()
    await expect(page).toHaveURL(/\/practices\/[0-9a-f-]{36}$/)
    await expect(page).not.toHaveURL(new RegExp(seed.practice))
    await expect(page.getByTestId('practice-name-input')).toHaveValue(
      'Thursday run'
    )

    const [first, second] = await practices(seed.bandId)
    expect(second.id).not.toBe(first.id)
    const days =
      (new Date(second.scheduled_date).getTime() -
        new Date(first.scheduled_date).getTime()) /
      864e5
    expect(Math.round(days)).toBe(7)
    expect(second.songs).toHaveLength(3)
  })

  test('delete from the agenda row menu', async ({ page }) => {
    seed = await seedCalendar(page)
    await page.goto('/calendar?type=practice')
    const row = page.getByTestId(`calendar-item-practice-${seed.practice}`)
    await expect(row).toBeVisible()
    await page.getByTestId(`calendar-item-menu-${seed.practice}`).click()
    await page.getByTestId('calendar-row-delete').click()
    await page.getByTestId('confirm-dialog-confirm').click()
    await expect(row).toHaveCount(0)
    expect(await practices(seed.bandId)).toHaveLength(0)
  })

  /** Fall Set as Everlong (Drop D), Breed, Black: not alphabetical. */
  const reorderFall = async (seed: CalendarSeed) => {
    const { Everlong, Breed, Black } = seed.songs
    const admin = await getSupabaseAdmin()
    await admin
      .from('setlists')
      .update({
        items: [Everlong, Breed, Black].map((songId, i) => ({
          id: `i${i}`,
          type: 'song',
          position: i + 1,
          songId,
        })),
      })
      .eq('id', seed.fall)
  }

  test('Plan a practice from a setlist keeps its order and retunes', async ({
    page,
  }) => {
    seed = await seedCalendar(page)
    await reorderFall(seed)
    const { Everlong, Breed, Black } = seed.songs
    await page.goto(`/setlists/${seed.fall}`)
    await page.getByTestId('setlist-header-menu').click()
    await page.getByTestId('setlist-menu-practice').click()
    await expect(page).toHaveURL(/\/practices\/[0-9a-f-]{36}$/)
    await expect.poll(() => order(page)).toEqual([Everlong, Breed, Black])
    // Drop D → Standard before Breed; Breed → Black needs none.
    const retunes = page.getByTestId('practice-retune')
    await expect(retunes).toHaveCount(1)
    // Its own row, right above Breed.
    await expect(
      page
        .getByTestId('practice-retune-row')
        .locator('xpath=following-sibling::li[1]')
    ).toHaveAttribute('data-song-id', Breed)
    expect(await practices(seed.bandId)).toHaveLength(2)
  })

  test('Add songs filtered by a setlist lists and adds in its order', async ({
    page,
  }) => {
    seed = await seedCalendar(page)
    await reorderFall(seed)
    const { Everlong, Breed, Black } = seed.songs
    await page.goto('/practices/new?add=1')
    const browser = page.getByTestId('song-browser')
    await browser.getByTestId('browser-setlist-filter').click()
    await page.getByTestId(`browser-setlist-option-${seed.fall}`).click()
    await expect
      .poll(() =>
        browser
          .locator('[data-testid^="browser-song-"]')
          .evaluateAll(els =>
            els.map(e =>
              e.getAttribute('data-testid')!.replace('browser-song-', '')
            )
          )
      )
      .toEqual([Everlong, Breed, Black])
    await browser.getByTestId('browser-add-all').click()
    await expect(page).toHaveURL(/\/practices\/[0-9a-f-]{36}\?add=1$/)
    await browser.getByTestId('browser-done').click()
    await expect.poll(() => order(page)).toEqual([Everlong, Breed, Black])
  })

  test('a song opened from the practice comes Back to it', async ({ page }) => {
    seed = await seedCalendar(page)
    const { Everlong } = seed.songs
    await page.goto(`/practices/${seed.practice}`)
    await page.getByTestId(`practice-song-${Everlong}`).click()
    await expect(page).toHaveURL(
      new RegExp(`/songs/${Everlong}\\?from=practice`)
    )
    await expect(page.getByTestId('song-page-back')).toHaveText(/Practice/)
    await page.getByTestId('song-page-back').click()
    await expect(page).toHaveURL(new RegExp(`/practices/${seed.practice}$`))
  })

  test.describe('wide', () => {
    test.use({ viewport: { width: 1440, height: 900 } })

    test('a click previews the song in the pane; a double-click opens it', async ({
      page,
    }) => {
      seed = await seedCalendar(page)
      const { Everlong } = seed.songs
      await page.goto(`/practices/${seed.practice}`)
      const row = page.getByTestId(`practice-song-${Everlong}`)
      await row.click()
      await expect(page).toHaveURL(new RegExp(`/practices/${seed.practice}$`))
      const pane = page.getByTestId('song-pane')
      await expect(pane.getByTestId('song-detail-title')).toHaveText('Everlong')
      // A second click keeps it open (no flicker before a double-click); × closes.
      await row.click()
      await expect(pane).toBeVisible()
      await pane.getByTestId('song-pane-close').click()
      await expect(pane).toHaveCount(0)

      await row.dblclick()
      await expect(page).toHaveURL(
        new RegExp(`/songs/${Everlong}\\?from=practice`)
      )
    })
  })

  test('a past practice can still start, and its wrap-up notes edit in place', async ({
    page,
  }) => {
    seed = await seedCalendar(page)
    const admin = await getSupabaseAdmin()
    await admin
      .from('practice_sessions')
      .update({
        scheduled_date: new Date(Date.now() - 2 * 86400_000).toISOString(),
        wrapup_notes: 'Bridge loose',
      })
      .eq('id', seed.practice)
    await page.goto(`/practices/${seed.practice}`)
    await expect(page.getByTestId('practice-detail')).toHaveAttribute(
      'data-status',
      'done'
    )
    const notes = page.getByTestId('practice-wrapup-notes-input')
    await expect(notes).toHaveValue('Bridge loose')
    await notes.fill('Bridge tight now')
    await notes.blur()
    await expect
      .poll(async () => {
        const { data } = await admin
          .from('practice_sessions')
          .select('wrapup_notes')
          .eq('id', seed!.practice)
          .single()
        return data!.wrapup_notes
      })
      .toBe('Bridge tight now')

    await page.getByTestId('practice-start-session').click()
    await expect(page).toHaveURL(/\/session$/)
    // Its wrap-up starts from the notes it has.
    await page.getByTestId('session-end').click()
    await expect(page.getByTestId('session-wrapup-notes')).toHaveValue(
      'Bridge tight now'
    )
  })
})
