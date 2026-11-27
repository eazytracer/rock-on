/**
 * Calendar and the show page (docs/redesign 03-screens Calendar, Show; FP 4–6):
 * the agenda's filters and redirects, New show as the blank page that saves as
 * you go, the desktop pane (Open, double-click, Enter), Confirmed, Cancelled
 * with Undo, the set as a copy (edits never reach the source), Re-copy, and
 * delete.
 */
import { test, expect, Page } from '@playwright/test'
import { deleteTestUser } from '../../fixtures/auth'
import { getSupabaseAdmin } from '../../fixtures/supabase'
import {
  setupConsoleErrorTracking,
  assertNoConsoleErrors,
} from '../../helpers/assertions'
import {
  seedCalendar,
  daysOut,
  type CalendarSeed,
} from '../../helpers/calendarSeed'

const showRow = async (id: string) => {
  const admin = await getSupabaseAdmin()
  const { data } = await admin.from('shows').select('*').eq('id', id).single()
  return data!
}

async function copySet(page: Page, seed: CalendarSeed) {
  await page.getByTestId('show-copy-set').click()
  await page.getByTestId(`show-copy-option-${seed.fall}`).click()
  await expect(page.getByTestId('show-set-copied')).toContainText(
    'Copied from Fall Set'
  )
}

test.describe('Calendar and shows', () => {
  test.use({ viewport: { width: 1280, height: 900 } })
  let seed: CalendarSeed | undefined
  test.afterEach(async () => {
    if (seed) await deleteTestUser(seed.userId)
    seed = undefined
  })

  test('agenda lists shows and practices; filters and redirects', async ({
    page,
  }) => {
    const errors = setupConsoleErrorTracking(page)
    seed = await seedCalendar(page)
    await page.goto('/calendar')
    const show = page.getByTestId(`calendar-item-show-${seed.show}`)
    const practice = page.getByTestId(`calendar-item-practice-${seed.practice}`)
    await expect(show).toContainText('Next Gig')
    await expect(practice).toContainText('Thursday run')

    await page.getByTestId('calendar-filter-show').click()
    await expect(show).toBeVisible()
    await expect(practice).toHaveCount(0)
    await expect(page.getByTestId('calendar-new-button')).toHaveText(/New show/)

    await page.goto('/shows')
    await expect(page).toHaveURL(/\/calendar\?type=show/)
    await page.goto('/practices')
    await expect(page).toHaveURL(/\/calendar\?type=practice/)
    await expect(practice).toBeVisible()
    await expect(show).toHaveCount(0)
    await assertNoConsoleErrors(page, errors)
  })

  test('the pane previews; Open, double-click and Enter open the full page', async ({
    page,
  }) => {
    seed = await seedCalendar(page)
    await page.goto('/calendar')
    const pane = page.getByTestId('calendar-detail-pane')
    const show = page.getByTestId(`calendar-item-show-${seed.show}`)
    const practice = page.getByTestId(`calendar-item-practice-${seed.practice}`)

    // Practice pane: Start is in view without scrolling the pane.
    await practice.click()
    await expect(pane.getByTestId('practice-name-input')).toHaveValue(
      'Thursday run'
    )
    await expect(pane.getByTestId('practice-start-session')).toBeInViewport()
    await pane.getByTestId('practice-pane-open').click()
    await expect(page).toHaveURL(new RegExp(`/practices/${seed.practice}$`))

    await page.goto('/calendar')
    await show.click()
    await pane.getByTestId('show-pane-open').click()
    await expect(page).toHaveURL(new RegExp(`/shows/${seed.show}$`))

    await page.goto('/calendar')
    await show.dblclick()
    await expect(page).toHaveURL(new RegExp(`/shows/${seed.show}$`))

    // Enter selects a row; Enter again on the selected row opens it.
    // (The practice, first upcoming, is selected by default; use the show.)
    await page.goto('/calendar')
    await show.focus()
    await page.keyboard.press('Enter')
    await expect(show).toHaveAttribute('data-selected', 'true')
    await expect(page).toHaveURL(/\/calendar/)
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new RegExp(`/shows/${seed.show}$`))
  })

  test('‹ Calendar returns to the filter and selection you left', async ({
    page,
  }) => {
    seed = await seedCalendar(page)
    const show = page.getByTestId(`calendar-item-show-${seed.show}`)
    const practice = page.getByTestId(`calendar-item-practice-${seed.practice}`)

    // From All, a show's back button lands on All (not Shows).
    await page.goto('/calendar')
    await show.dblclick()
    await page.getByTestId('show-back').click()
    await expect(page).toHaveURL(/\/calendar(\?|$)/)
    await expect(page.getByTestId('calendar-filter-all')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expect(practice).toBeVisible()

    // A filter and selection come back too.
    await page.getByTestId('calendar-filter-practice').click()
    await practice.dblclick()
    await page.getByTestId('practice-back').click()
    await expect(page).toHaveURL(/type=practice/)
    await expect(practice).toHaveAttribute('data-selected', 'true')
  })

  test('narrower windows: no pane, and the type column shrinks to icons', async ({
    page,
  }) => {
    seed = await seedCalendar(page)
    const admin = await getSupabaseAdmin()
    await admin.from('shows').update({ confirmed: true }).eq('id', seed.show)
    await page.setViewportSize({ width: 820, height: 900 })
    await page.goto('/calendar')
    const show = page.getByTestId(`calendar-item-show-${seed.show}`)
    await expect(show.getByTestId('calendar-item-type-compact')).toBeVisible()
    await expect(show.getByTestId('calendar-item-type')).toBeHidden()
    await expect(show.getByLabel('Confirmed')).toBeVisible()
    await expect(page.getByTestId('calendar-detail-pane')).toHaveCount(0)

    // Wider, but still too narrow for the pane: a click opens the page.
    await page.setViewportSize({ width: 1100, height: 900 })
    await expect(show.getByTestId('calendar-item-type')).toContainText(
      'Confirmed'
    )
    await show.click()
    await expect(page).toHaveURL(new RegExp(`/shows/${seed.show}$`))
  })

  test('the show date reads the day it was set (no off-by-one)', async ({
    page,
  }) => {
    seed = await seedCalendar(page)
    await page.goto(`/shows/${seed.show}`)
    const day = daysOut(5, 20).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
    await expect(page.getByTestId('show-date-input')).toContainText(day)
  })

  test('New show is the blank page; the first save creates it', async ({
    page,
  }) => {
    seed = await seedCalendar(page)
    await page.goto('/calendar?type=show')
    await page.getByTestId('calendar-new-button').click()
    await expect(page).toHaveURL(/\/calendar\?.*selected=new-show|\/shows\/new/)
    await page.getByTestId('show-name-input').fill('Fall Kickoff')
    await page.getByTestId('show-name-input').press('Enter')
    await expect(page.getByTestId('show-kicker')).not.toContainText('New', {
      timeout: 10000,
    })
    const admin = await getSupabaseAdmin()
    const { data } = await admin
      .from('shows')
      .select('id, name, duration')
      .eq('band_id', seed.bandId)
      .eq('name', 'Fall Kickoff')
    expect(data).toHaveLength(1)
    expect(data![0].duration).toBe(45)
  })

  test('Confirmed, and Cancelled with Undo', async ({ page }) => {
    seed = await seedCalendar(page)
    await page.goto(`/shows/${seed.show}`)
    const confirmed = page.getByTestId('show-confirmed')
    await expect(confirmed).toHaveAttribute('aria-checked', 'false')
    await confirmed.click()
    await expect(confirmed).toHaveAttribute('aria-checked', 'true')
    await expect
      .poll(async () => (await showRow(seed!.show)).confirmed)
      .toBe(true)

    await page.getByTestId('show-menu').click()
    await page.getByTestId('show-menu-cancel').click()
    await expect(page.getByTestId('show-cancelled-banner')).toBeVisible()
    await expect
      .poll(async () => (await showRow(seed!.show)).status)
      .toBe('cancelled')
    await page.getByTestId('show-undo-cancel').click()
    await expect(page.getByTestId('show-cancelled-banner')).toHaveCount(0)
    await expect
      .poll(async () => (await showRow(seed!.show)).status)
      .toBe('scheduled')
  })

  test("the set is the show's own copy: edits never change the source", async ({
    page,
  }) => {
    seed = await seedCalendar(page)
    await page.goto(`/shows/${seed.show}`)
    await expect(page.getByTestId('show-no-set')).toBeVisible()
    await copySet(page, seed)

    const copyId = (await showRow(seed.show)).setlist_id as string
    expect(copyId).not.toBe(seed.fall)

    // Edit the copy in the setlist editor: remove Black.
    await page.goto(`/setlists/${copyId}?from=show:${seed.show}`)
    await page.getByTestId('setlist-song-i0').click({ button: 'right' })
    await page.getByTestId('setlist-row-remove').click()
    await page.getByTestId('confirm-dialog-confirm').click()
    await expect
      .poll(() => page.getByTestId('setlist-song-title').allTextContents())
      .toEqual(['Everlong'])

    const admin = await getSupabaseAdmin()
    const { data: source } = await admin
      .from('setlists')
      .select('items')
      .eq('id', seed.fall)
      .single()
    expect(source!.items).toHaveLength(2)

    // Back on the show: Re-copy asks first (the copy was edited), then restores.
    await page.goto(`/shows/${seed.show}`)
    await page.getByTestId('show-recopy').click()
    await page.getByTestId('confirm-dialog-confirm').click()
    await expect
      .poll(async () => {
        const { data } = await admin
          .from('setlists')
          .select('items')
          .eq('id', copyId)
          .single()
        return data!.items.length
      })
      .toBe(2)
  })

  test('delete takes the show and its copy; the source stays', async ({
    page,
  }) => {
    seed = await seedCalendar(page)
    await page.goto(`/shows/${seed.show}`)
    await copySet(page, seed)
    const copyId = (await showRow(seed.show)).setlist_id as string

    await page.getByTestId('show-menu').click()
    await page.getByTestId('show-menu-delete').click()
    await expect(page.getByTestId('confirm-dialog-message')).toContainText(
      'Fall Set itself is untouched'
    )
    await page.getByTestId('confirm-dialog-confirm').click()
    await expect(page).toHaveURL(/\/calendar/)

    const admin = await getSupabaseAdmin()
    const ids = async (id: string) =>
      (await admin.from('setlists').select('id').eq('id', id)).data!.length
    await expect.poll(() => ids(copyId)).toBe(0)
    expect(await ids(seed.fall)).toBe(1)
    const { data: gone } = await admin
      .from('shows')
      .select('id')
      .eq('id', seed.show)
    expect(gone).toHaveLength(0)
  })
})
