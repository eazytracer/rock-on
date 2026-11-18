/**
 * Ways into the tools (docs/redesign/12 · 2.2, 3.4 Flows): the song page's
 * Tune / Click, a setlist retune line, the practice session's Tune now layer,
 * and the metronome's Save to song with Undo. No mic needed.
 */
import { test, expect, type Page } from '@playwright/test'
import { deleteTestUser } from '../../fixtures/auth'
import { getSupabaseAdmin } from '../../fixtures/supabase'
import { seedCalendar, type CalendarSeed } from '../../helpers/calendarSeed'
import {
  setupConsoleErrorTracking,
  assertNoConsoleErrors,
} from '../../helpers/assertions'

const tempoOf = async (id: string) => {
  const admin = await getSupabaseAdmin()
  const { data } = await admin
    .from('songs')
    .select('tempo')
    .eq('id', id)
    .single()
  return data?.tempo as number | null
}

const elapsedSeconds = async (page: Page) => {
  const t = (await page.getByTestId('session-elapsed').textContent()) ?? ''
  const [m, s] = t.split(':').map(Number)
  return m * 60 + s
}

test.describe('Tools · ways in', () => {
  let seed: CalendarSeed | undefined
  test.afterEach(async () => {
    if (seed) await deleteTestUser(seed.userId)
    seed = undefined
  })

  test.describe('desktop', () => {
    test.use({ viewport: { width: 1280, height: 860 } })

    test('song Tune opens the tuner on the song’s tuning; Back returns', async ({
      page,
    }) => {
      const errors = setupConsoleErrorTracking(page)
      seed = await seedCalendar(page)
      await page.goto(`/songs/${seed.songs.Everlong}`)
      await page.getByTestId('song-tune-button').click()
      await expect(page).toHaveURL(/\/tools\/tuner\?tuning=drop-d$/)
      await expect(page.getByTestId('tuner-tuning-drop-d')).toHaveAttribute(
        'aria-pressed',
        'true'
      )
      await expect(page.getByTestId('tuner-string-6')).toContainText('D')
      // Any tuning can be picked; ← → steps through them.
      await page.getByTestId('tuner-tuning-standard').click()
      await expect(page.getByTestId('tuner-string-6')).toContainText('E')
      await page.keyboard.press('ArrowRight')
      await expect(
        page.getByTestId('tuner-tuning-half-step-down')
      ).toHaveAttribute('aria-pressed', 'true')
      await page.getByTestId('tools-back').click()
      await expect(page).toHaveURL(new RegExp(`/songs/${seed.songs.Everlong}`))
      await assertNoConsoleErrors(page, errors)
    })

    test('a retune line’s Tune marks the strings that change', async ({
      page,
    }) => {
      seed = await seedCalendar(page)
      await page.goto(`/setlists/${seed.fall}`)
      await page.getByTestId('setlist-retune-tune').first().click()
      await expect(page).toHaveURL(/tuning=drop-d&prev=standard/)
      await expect(page.getByTestId('tuner-string-6')).toHaveAttribute(
        'data-changed',
        'true'
      )
      await expect(page.getByTestId('tuner-string-5')).not.toHaveAttribute(
        'data-changed',
        'true'
      )
      await expect(page.getByTestId('tuner-in-tune-count')).toContainText(
        'changed from E STD'
      )
    })

    test('Bass: the song’s tuning becomes the matching bass built-in', async ({
      page,
    }) => {
      seed = await seedCalendar(page)
      await page.goto('/tools/tuner?tuning=drop-d')
      await page.getByTestId('tuner-instrument-bass').click()
      await expect(
        page.getByTestId('tuner-tuning-bass-drop-d')
      ).toHaveAttribute('aria-pressed', 'true')
      await expect(
        page.getByTestId('tuner-strings').getByRole('button')
      ).toHaveCount(4)
      // Remembered on this device.
      await page.goto('/tools/tuner')
      await expect(page.getByTestId('tuner-instrument-bass')).toHaveAttribute(
        'aria-checked',
        'true'
      )
    })

    test('session Tune now opens a layer; closing keeps the song and the timer', async ({
      page,
    }) => {
      const errors = setupConsoleErrorTracking(page)
      seed = await seedCalendar(page)
      await page.goto(`/practices/${seed.practice}/session`)
      await expect(page.getByTestId('session-title')).toHaveText('Black')
      await page.getByTestId('session-tune-now').click()
      const layer = page.getByTestId('session-tuner-layer')
      await expect(layer).toBeVisible()
      await expect(layer).toContainText('Everlong')
      await expect(layer.getByTestId('tuner-tuning-drop-d')).toHaveAttribute(
        'aria-pressed',
        'true'
      )
      await expect(layer.getByTestId('tuner-string-6')).toHaveAttribute(
        'data-changed',
        'true'
      )
      const before = await elapsedSeconds(page)
      // Session keys pause under the layer.
      await page.keyboard.press('PageDown')
      await page.waitForTimeout(2200)
      await page.getByTestId('tool-layer-close').click()
      await expect(layer).toHaveCount(0)
      await expect(page.getByTestId('session-title')).toHaveText('Black')
      await expect(page.getByTestId('session-position')).toHaveText(
        /Song 1 of 3/i
      )
      expect(await elapsedSeconds(page)).toBeGreaterThanOrEqual(before + 2)
      // Tune (toolbar) opens on the current song; Esc closes.
      await page.getByTestId('session-tune').click()
      await expect(layer.getByTestId('tuner-tuning-standard')).toHaveAttribute(
        'aria-pressed',
        'true'
      )
      await page.keyboard.press('Escape')
      await expect(layer).toHaveCount(0)
      await page.keyboard.press('ArrowRight')
      await expect(page.getByTestId('session-title')).toHaveText('Everlong')
      await assertNoConsoleErrors(page, errors)
    })

    test('metronome from a song: Save to song writes the BPM, Undo restores', async ({
      page,
    }) => {
      seed = await seedCalendar(page)
      const admin = await getSupabaseAdmin()
      await admin
        .from('songs')
        .update({ tempo: 100 })
        .eq('id', seed.songs.Black)
      await page.goto(`/songs/${seed.songs.Black}`)
      await page.getByTestId('song-click-button').click()
      await expect(page).toHaveURL(
        new RegExp(`/tools/metronome\\?song=${seed.songs.Black}`)
      )
      await expect(page.getByTestId('metro-bpm')).toHaveText('100')
      await expect(page.getByTestId('metro-save-to-song')).toHaveCount(0)
      await page.getByTestId('metro-plus').click()
      await page.getByTestId('metro-plus').click()
      await expect(page.getByTestId('metro-bpm')).toHaveText('102')
      await page.getByTestId('metro-save-to-song').click()
      await expect(page.getByTestId('metro-save-to-song')).toHaveCount(0)
      await expect.poll(() => tempoOf(seed!.songs.Black)).toBe(102)
      await page.getByTestId('toast-action').click()
      await expect.poll(() => tempoOf(seed!.songs.Black)).toBe(100)
    })

    test('metronome: start lights the beats, keys, tab switch stops it', async ({
      page,
    }) => {
      const errors = setupConsoleErrorTracking(page)
      seed = await seedCalendar(page)
      await page.goto('/tools/metronome?bpm=200')
      await expect(page.getByTestId('metro-bpm')).toHaveText('200')
      await page.getByTestId('metro-sig-3/4').click()
      await expect(page.getByTestId('metro-beat-2')).toBeVisible()
      await expect(page.getByTestId('metro-beat-3')).toHaveCount(0)
      await page.getByTestId('metro-beat-1').click()
      await expect(page.getByTestId('metro-beat-1')).toHaveAttribute(
        'data-accent',
        'mute'
      )
      await page.getByTestId('metro-start').click()
      await expect(page.getByTestId('metro-start')).toHaveText(/Stop/)
      await expect(
        page.locator('[data-testid^="metro-beat-"][data-lit]')
      ).toHaveCount(1)
      await page.keyboard.press('ArrowUp')
      await expect(page.getByTestId('metro-bpm')).toHaveText('201')
      await page.keyboard.press('Space')
      await expect(page.getByTestId('metro-start')).toHaveText(/Start/)
      await page.getByTestId('metro-start').click()
      await page.getByTestId('tools-tab-tuner').click()
      await expect(page.getByTestId('tuner')).toBeVisible()
      await page.getByTestId('tools-tab-metronome').click()
      await expect(page.getByTestId('metro-start')).toHaveText(/Start/)
      // Remembered: tempo and signature.
      await expect(page.getByTestId('metro-bpm')).toHaveText('201')
      await expect(page.getByTestId('metro-sig-3/4')).toHaveAttribute(
        'aria-checked',
        'true'
      )
      await assertNoConsoleErrors(page, errors)
    })
  })

  test.describe('phone', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test('the tuner’s tuning sheet and the metronome dock', async ({
      page,
    }) => {
      seed = await seedCalendar(page)
      await page.goto('/tools/tuner')
      await expect(page.getByTestId('tools-tab-tuner')).toHaveAttribute(
        'aria-checked',
        'true'
      )
      await page.getByTestId('tuner-tuning-picker').click()
      await page.getByTestId('tuner-tuning-list-option-drop-d').click()
      await expect(page.getByTestId('tuner-tuning-sheet')).toHaveCount(0)
      await expect(page.getByTestId('tuner-tuning-picker')).toContainText(
        'D DROP'
      )
      await page.getByTestId('tools-tab-metronome').click()
      await expect(page).toHaveURL(/\/tools\/metronome$/)
      await expect(page.getByTestId('metro-start')).toBeVisible()
      await page.getByTestId('metro-tap').click()
      await page.getByTestId('metro-tap').click()
      await expect(page.getByTestId('metro-bpm')).not.toHaveText('')
      // /tools lands on the last tab used.
      await page.goto('/tools')
      await expect(page).toHaveURL(/\/tools\/metronome$/)
    })
  })
})
