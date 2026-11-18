/**
 * Custom tuning, the neck editor (docs/redesign/12 · 2.4, 5g): create from
 * Settings → Tunings, a duplicate disables Save, edit an existing custom, the
 * song's tuning picker gets the new tuning back selected, the tuner's
 * "+ Custom", and the Settings Tuner shortcut.
 */
import { test, expect, type Page } from '@playwright/test'
import { deleteTestUser } from '../../fixtures/auth'
import { getSupabaseAdmin } from '../../fixtures/supabase'
import { seedCalendar, type CalendarSeed } from '../../helpers/calendarSeed'
import {
  setupConsoleErrorTracking,
  assertNoConsoleErrors,
} from '../../helpers/assertions'

const customsOf = async (bandId: string) => {
  const admin = await getSupabaseAdmin()
  const { data } = await admin
    .from('tunings')
    .select('id, name, pitches, color, context_type, context_id, instrument')
    .eq('context_id', bandId)
    .eq('is_builtin', false)
  return data ?? []
}

/** E A D G B E → C G C G C E (Open C). */
const makeOpenC = async (page: Page) => {
  for (let i = 0; i < 4; i++)
    await page.getByTestId('tuning-string-6-down').click()
  for (let i = 0; i < 2; i++) {
    await page.getByTestId('tuning-string-5-down').click()
    await page.getByTestId('tuning-string-4-down').click()
  }
  await page.getByTestId('tuning-string-2-up').click()
  await expect(page.getByTestId('tuning-strings-line')).toContainText(
    'C G C G C E'
  )
}

const openSettingsTunings = async (page: Page) => {
  await page.goto('/settings#settings-tunings')
  await expect(page.getByTestId('settings-tunings')).toBeVisible()
}

test.describe('Custom tuning · neck editor', () => {
  let seed: CalendarSeed | undefined
  test.afterEach(async () => {
    if (seed) await deleteTestUser(seed.userId)
    seed = undefined
  })

  test.describe('desktop', () => {
    test.use({ viewport: { width: 1280, height: 860 } })

    test('create from Settings: starts at standard, duplicate disables Save, saves to the band', async ({
      page,
    }) => {
      const errors = setupConsoleErrorTracking(page)
      seed = await seedCalendar(page)
      await openSettingsTunings(page)
      await page.getByTestId('tunings-new-button').click()
      const editor = page.getByTestId('tuning-editor')
      await expect(editor).toBeVisible()

      // New tunings start at standard, which is a duplicate.
      await expect(page.getByTestId('tuning-string-6-note')).toHaveAttribute(
        'data-note',
        'E2'
      )
      await expect(page.getByTestId('tuning-duplicate')).toHaveAttribute(
        'data-match',
        /Standard/
      )
      await page.getByTestId('tuning-name-input').fill('Open C')
      await expect(page.getByTestId('tuning-save')).toHaveAttribute(
        'aria-disabled',
        'true'
      )
      // Grey Save explains itself on a tap; the warning never moves the neck.
      const neckTop = (await page.getByTestId('tuning-neck').boundingBox())!.y
      // (force: Playwright won't click an aria-disabled button; people can.)
      await page.getByTestId('tuning-save').click({ force: true })
      await expect(page.getByText(/already in your tunings/i)).toBeVisible()
      await expect(editor).toBeVisible()

      // All strings ½ step down → still a built-in (E♭).
      await page.getByTestId('tuning-all-down').click()
      await expect(page.getByTestId('tuning-duplicate')).toHaveAttribute(
        'data-match',
        /Half-step down/
      )
      await expect(page.getByTestId('tuning-save')).toHaveAttribute(
        'aria-disabled',
        'true'
      )
      await page.getByTestId('tuning-all-up').click()

      await makeOpenC(page)
      await expect(page.getByTestId('tuning-duplicate')).toHaveCount(0)
      expect((await page.getByTestId('tuning-neck').boundingBox())!.y).toBe(
        neckTop
      )
      await expect(page.getByTestId('tuning-save')).toHaveAttribute(
        'aria-disabled',
        'false'
      )

      // Without a name Save is grey again.
      await page.getByTestId('tuning-name-input').fill('')
      await expect(page.getByTestId('tuning-save')).toHaveAttribute(
        'aria-disabled',
        'true'
      )
      await page.getByTestId('tuning-name-input').fill('Open C')

      // Colour: automatic.
      await page.getByTestId('tuning-colour').click()
      await page.getByTestId('tuning-colour-auto').click()
      await page.getByTestId('tuning-colour-done').click()
      await expect(page.getByTestId('tuning-colour')).toHaveAttribute(
        'data-colour',
        'auto'
      )

      await page.getByTestId('tuning-save').click()
      await expect(editor).toHaveCount(0)
      await expect(page.getByTestId('tunings-customs')).toContainText('Open C')

      const rows = await customsOf(seed.bandId)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({
        name: 'Open C',
        pitches: [36, 43, 48, 55, 60, 64],
        color: null,
        context_type: 'band',
        instrument: 'guitar',
      })

      // The same strings again are a duplicate of the new custom.
      await page.getByTestId('tunings-new-button').click()
      await makeOpenC(page)
      await expect(page.getByTestId('tuning-duplicate')).toHaveAttribute(
        'data-match',
        /Open C/
      )
      await page.getByTestId('tuning-name-input').fill('Again')
      await expect(page.getByTestId('tuning-save')).toHaveAttribute(
        'aria-disabled',
        'true'
      )
      await page.getByTestId('tuning-cancel').click()
      await expect(editor).toHaveCount(0)
      await assertNoConsoleErrors(page, errors)
    })

    test('edit an existing custom tuning; limits dim the arrows', async ({
      page,
    }) => {
      seed = await seedCalendar(page)
      const admin = await getSupabaseAdmin()
      const { data: t } = await admin
        .from('tunings')
        .insert({
          instrument: 'guitar',
          string_count: 6,
          pitches: [36, 43, 48, 55, 60, 64],
          name: 'Open C',
          is_builtin: false,
          context_type: 'band',
          context_id: seed.bandId,
          created_by: seed.userId,
          color: '#d465a8',
        })
        .select('id')
        .single()
      await openSettingsTunings(page)
      await page.getByTestId(`tuning-edit-${t!.id}`).click()
      await expect(page.getByTestId('tuning-editor')).toContainText(
        'Edit tuning'
      )
      await expect(page.getByTestId('tuning-name-input')).toHaveValue('Open C')
      // Unchanged → nothing to save.
      await expect(page.getByTestId('tuning-save')).toHaveAttribute(
        'aria-disabled',
        'true'
      )

      // High E up to its +7 limit: the ↑ dims.
      const up = page.getByTestId('tuning-string-1-up')
      for (let i = 0; i < 7; i++) await up.click()
      await expect(up).toBeDisabled()
      await expect(page.getByTestId('tuning-string-1-note')).toHaveAttribute(
        'data-note',
        'B4'
      )
      // …and every string can't go up together any more.
      await expect(page.getByTestId('tuning-all-up')).toBeDisabled()
      for (let i = 0; i < 7; i++)
        await page.getByTestId('tuning-string-1-down').click()
      await page.getByTestId('tuning-string-1-down').click() // E → Eb
      await page.getByTestId('tuning-name-input').fill('Open C (Eb)')
      await page.getByTestId('tuning-save').click()
      await expect(page.getByTestId('tuning-editor')).toHaveCount(0)
      await expect(page.getByTestId('tunings-customs')).toContainText(
        'Open C (Eb)'
      )
      const rows = await customsOf(seed.bandId)
      expect(rows[0]).toMatchObject({
        name: 'Open C (Eb)',
        pitches: [36, 43, 48, 55, 60, 63],
        color: '#d465a8',
      })
    })

    test('Settings → Tunings has one Tuner shortcut', async ({ page }) => {
      seed = await seedCalendar(page)
      await openSettingsTunings(page)
      // Built-ins list Standard first (picker order), not alphabetically.
      await expect(
        page
          .getByTestId('settings-tunings')
          .locator('[data-testid^="tuning-row-"]')
          .first()
      ).toHaveText(/^\s*Standard/)
      await expect(page.getByTestId('settings-tunings-tuner')).toHaveCount(1)
      await page.getByTestId('settings-tunings-tuner').click()
      await expect(page).toHaveURL(/\/tools\/tuner/)
      await expect(page.getByTestId('tuner')).toBeVisible()
    })

    test('the tuner’s + Custom opens the editor and picks the new tuning', async ({
      page,
    }) => {
      seed = await seedCalendar(page)
      await page.goto('/tools/tuner')
      await page.getByTestId('tuner-tuning-custom').click()
      await expect(page.getByTestId('tuning-editor')).toBeVisible()
      await page.getByTestId('tuning-count-7').click()
      await expect(page.getByTestId('tuning-duplicate')).toHaveAttribute(
        'data-match',
        /7-string standard/
      )
      await page.getByTestId('tuning-string-7-down').click()
      await page.getByTestId('tuning-name-input').fill('Low Bb7')
      await page.getByTestId('tuning-save').click()
      await expect(page.getByTestId('tuning-editor')).toHaveCount(0)
      const [row] = await customsOf(seed.bandId)
      expect(row.pitches).toEqual([34, 40, 45, 50, 55, 59, 64])
      await expect(page.getByTestId(`tuner-tuning-${row.id}`)).toHaveAttribute(
        'aria-pressed',
        'true'
      )
      await expect(page.getByTestId('tuner-string-7')).toContainText('B♭')
    })

    test('the song’s tuning picker: New tuning… comes back selected', async ({
      page,
    }) => {
      const errors = setupConsoleErrorTracking(page)
      seed = await seedCalendar(page)
      await page.goto(`/songs/${seed.songs.Black}`)
      await page.getByTestId('song-fact-tuning').click()
      await page.getByTestId('song-tuning-new').click()
      await expect(page.getByTestId('tuning-editor')).toBeVisible()
      await makeOpenC(page)
      await page.getByTestId('tuning-name-input').fill('Open C')
      await page.getByTestId('tuning-save').click()
      await expect(page.getByTestId('tuning-editor')).toHaveCount(0)
      await expect(page.getByTestId('song-fact-tuning')).toContainText('OPEN C')

      const [row] = await customsOf(seed.bandId)
      const admin = await getSupabaseAdmin()
      await expect
        .poll(async () => {
          const { data } = await admin
            .from('songs')
            .select('tuning_id, guitar_tuning')
            .eq('id', seed!.songs.Black)
            .single()
          return data
        })
        .toEqual({ tuning_id: row.id, guitar_tuning: 'Open C' })
      await assertNoConsoleErrors(page, errors)
    })
  })

  test.describe('phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

    test('the editor is a full-screen layer and fits 7 strings', async ({
      page,
    }) => {
      seed = await seedCalendar(page)
      await openSettingsTunings(page)
      await page.getByTestId('tunings-new-button').scrollIntoViewIfNeeded()
      await page.getByTestId('tunings-new-button').tap()
      const editor = page.getByTestId('tuning-editor')
      await expect(editor).toBeVisible()
      const box = await editor.boundingBox()
      expect(box).toMatchObject({ x: 0, y: 0, width: 390, height: 844 })
      await page.getByTestId('tuning-instrument-bass').tap()
      await expect(page.getByTestId('tuning-count-4')).toHaveAttribute(
        'aria-checked',
        'true'
      )
      await page.getByTestId('tuning-count-5').tap()
      await expect(page.getByTestId('tuning-string-5-note')).toHaveAttribute(
        'data-note',
        'B0'
      )
      // Everything fits without scrolling: the ½ step row is on screen.
      await page.getByTestId('tuning-instrument-guitar').tap()
      await page.getByTestId('tuning-count-7').tap()
      await expect(page.getByTestId('tuning-all-down')).toBeInViewport()
      await page.getByTestId('tuning-cancel').tap()
      await expect(editor).toHaveCount(0)
    })
  })
})
