/**
 * Practices (docs/redesign 03-screens Practice; Practice 1, FP 7): New from the
 * calendar opens the editor (name, when, location, focus, songs from the
 * browser), Save lands on the practice page; Edit and Duplicate (a week later,
 * "Copied from") reuse the editor; delete from the agenda's row menu.
 */
import { test, expect } from '@playwright/test'
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
    .select('id, name, location, scheduled_date, songs')
    .eq('band_id', bandId)
    .order('scheduled_date')
  return data!
}

test.describe('Practices', () => {
  test.use({ viewport: { width: 1280, height: 900 } })
  let seed: CalendarSeed | undefined
  test.afterEach(async () => {
    if (seed) await deleteTestUser(seed.userId)
    seed = undefined
  })

  test('New practice: the editor saves and opens the practice page', async ({
    page,
  }) => {
    const errors = setupConsoleErrorTracking(page)
    seed = await seedCalendar(page)
    await page.goto('/calendar?type=practice')
    await page.getByTestId('calendar-new-button').click()
    await expect(page).toHaveURL(/\/practices\/new/)

    await page.getByTestId('practice-name-input').fill('Set run')
    await page.getByTestId('practice-location-input').fill('The Loft')
    await page.getByTestId('practice-focus-input').fill('Tighten the outro')
    await page.getByTestId('practice-editor-add-songs').click()
    await page.getByTestId(`browser-song-${seed.songs.Breed}`).click()
    await page.getByTestId(`browser-song-${seed.songs.Black}`).click()
    await page.getByTestId('practice-editor-done-adding').click()
    await expect(
      page.getByTestId(`practice-editor-song-${seed.songs.Breed}`)
    ).toBeVisible()

    await page.getByTestId('practice-editor-save').click()
    await expect(page).toHaveURL(/\/practices\/[0-9a-f-]{36}$/)
    await expect(page.getByTestId('practice-title')).toHaveText('Set run')
    await expect(page.getByTestId('practice-focus')).toContainText(
      'Tighten the outro'
    )
    await expect(
      page.getByTestId(`practice-song-${seed.songs.Breed}`)
    ).toBeVisible()

    const saved = (await practices(seed.bandId)).find(p => p.name === 'Set run')
    expect(saved?.location).toBe('The Loft')
    expect(saved?.songs.map((s: { songId: string }) => s.songId)).toEqual([
      seed.songs.Breed,
      seed.songs.Black,
    ])
    await assertNoConsoleErrors(page, errors)
  })

  test('Edit changes the practice in place', async ({ page }) => {
    seed = await seedCalendar(page)
    await page.goto(`/practices/${seed.practice}`)
    await page.getByTestId('practice-menu').click()
    await page.getByTestId('practice-menu-edit').click()
    await expect(page).toHaveURL(new RegExp(`/practices/${seed.practice}/edit`))
    await expect(page.getByTestId('practice-name-input')).toHaveValue(
      'Thursday run'
    )
    await page.getByTestId('practice-location-input').fill('Studio B')
    await page
      .getByTestId(`practice-editor-song-${seed.songs.Breed}`)
      .getByTestId('practice-editor-song-remove')
      .click()
    await page.getByTestId('practice-editor-save').click()
    await expect(page).toHaveURL(new RegExp(`/practices/${seed.practice}$`))
    await expect(page.getByTestId('practice-when')).toBeVisible()
    await expect(
      page.getByTestId(`practice-song-${seed.songs.Breed}`)
    ).toHaveCount(0)

    const [p] = await practices(seed.bandId)
    expect(p.location).toBe('Studio B')
    expect(p.songs).toHaveLength(2)
  })

  test('Duplicate prefills the same practice a week later', async ({
    page,
  }) => {
    seed = await seedCalendar(page)
    await page.goto(`/practices/${seed.practice}`)
    await page.getByTestId('practice-menu').click()
    await page.getByTestId('practice-menu-duplicate').click()
    await expect(page).toHaveURL(/\/practices\/new\?from=/)
    await expect(page.getByTestId('practice-copied-from')).toContainText(
      'Thursday run'
    )
    await page.getByTestId('practice-editor-save').click()
    await expect(page).toHaveURL(/\/practices\/[0-9a-f-]{36}$/)

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
})
