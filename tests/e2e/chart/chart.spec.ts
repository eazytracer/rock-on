/**
 * Chords & lyrics (docs/redesign/12 · 5d–5f): the reader pages with Back /
 * Next and the pedal keys, transpose is saved per user, the starting note
 * saves as you pick, paste → save → reader, the stale-version conflict, copying
 * the band's chart onto a linked My Songs copy, the phone editor's Chords mode,
 * and the practice session's Chart layer keeping its place.
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
import { seedCalendar } from '../../helpers/calendarSeed'

/** An original chart (no real lyrics), long enough to need several pages. */
const LONG_CHART = Array.from(
  { length: 16 },
  (_, v) => `{start_of_verse: Verse ${v + 1}}
[G]Porch light burning [C]on the gravel [G]road
[Em]Engine ticking [C]while the night goes [D]cold
[G]Radio playing [C]what we used to [G]know
[Em]Turn it up and [D]let it [G]go
{end_of_verse}
`
).join('\n')

type Seed = { userId: string; bandId: string; songId: string }

async function setup(page: Page, chordpro: string | null): Promise<Seed> {
  await signUpViaUI(page, createTestUser())
  await createBandViaUI(page, `Chart ${Date.now()}`)
  const userId = await getCurrentUserId(page)
  const admin = await getSupabaseAdmin()
  const { data: m } = await admin
    .from('band_memberships')
    .select('band_id')
    .eq('user_id', userId)
    .single()
  const bandId = m!.band_id as string
  const { data: song, error } = await admin
    .from('songs')
    .insert({
      title: 'Gravel Road',
      artist: 'Test Artist',
      key: 'G',
      guitar_tuning: 'Standard',
      context_type: 'band',
      context_id: bandId,
      created_by: userId,
    })
    .select('id')
    .single()
  expect(error).toBeNull()
  const songId = song!.id as string
  if (chordpro != null) {
    const { error: e2 } = await admin
      .from('song_charts')
      .insert({ song_id: songId, chordpro, last_modified_by: userId })
    expect(e2).toBeNull()
  }
  return { userId, bandId, songId }
}

const chart = async (songId: string) => {
  const admin = await getSupabaseAdmin()
  const { data } = await admin
    .from('song_charts')
    .select('chordpro, starting_note, version')
    .eq('song_id', songId)
    .maybeSingle()
  return data
}

test.describe('Chart', () => {
  let seed: { userId: string } | undefined
  test.afterEach(async () => {
    if (seed) await deleteTestUser(seed.userId)
    seed = undefined
  })

  test.describe('desktop', () => {
    test.use({ viewport: { width: 1280, height: 860 } })

    test('the song page opens the reader; keys and pedals page', async ({
      page,
    }) => {
      const errors = setupConsoleErrorTracking(page)
      const s = (seed = await setup(page, LONG_CHART))
      await page.goto(`/songs/${s.songId}`)
      await page.getByTestId('song-chords-button').click()
      await expect(page).toHaveURL(new RegExp(`/songs/${s.songId}/chart`))
      await expect(page.getByTestId('chart-title')).toHaveText(/Gravel Road/i)
      await expect(page.getByTestId('chart-chords-panel')).toContainText('Em')

      const scroller = page.getByTestId('chart-scroll')
      const left = () => scroller.evaluate(el => el.scrollLeft)
      expect(await left()).toBe(0)
      const step = await scroller.evaluate(el => el.clientWidth + 48)
      await page.keyboard.press('PageDown')
      await expect.poll(left).toBe(step)
      await page.keyboard.press('Space')
      await page.keyboard.press('ArrowRight')
      await expect.poll(left).toBe(3 * step)
      await page.keyboard.press('ArrowUp')
      await expect.poll(left).toBe(2 * step)
      await page.keyboard.press('ArrowLeft')
      await expect.poll(left).toBe(step)
      await page.keyboard.press('PageUp')
      await expect.poll(left).toBe(0)

      await page.getByTestId('chart-close').click()
      await expect(page).toHaveURL(new RegExp(`/songs/${s.songId}$`))
      await assertNoConsoleErrors(page, errors)
    })

    test('transpose is saved for this user only, never on the chart', async ({
      page,
    }) => {
      const s = (seed = await setup(page, LONG_CHART))
      await page.goto(`/songs/${s.songId}/chart`)
      await expect(page.getByTestId('chart-key-value')).toContainText('G')
      await page.getByTestId('chart-key-up').click()
      await page.getByTestId('chart-key-up').click()
      await expect(page.getByTestId('chart-key-value')).toContainText('A')
      await expect(page.getByTestId('chart-chord').first()).toHaveText('A')

      const admin = await getSupabaseAdmin()
      await expect
        .poll(async () => {
          const { data } = await admin
            .from('user_preferences')
            .select('chart')
            .eq('user_id', s.userId)
            .maybeSingle()
          return data?.chart?.transpose?.[s.songId]
        })
        .toBe(2)
      expect((await chart(s.songId))!.chordpro).toBe(LONG_CHART)

      await page.reload()
      await expect(page.getByTestId('chart-key-value')).toContainText('A')

      // Quick taps all count (each step reads the saved value, not the render).
      await page.getByTestId('chart-key-up').evaluate(b => {
        ;(b as HTMLButtonElement).click()
        ;(b as HTMLButtonElement).click()
      })
      await expect(page.getByTestId('chart-key-value')).toContainText('B')
    })

    test('the starting note saves as you pick', async ({ page }) => {
      const s = (seed = await setup(page, LONG_CHART))
      await page.goto(`/songs/${s.songId}/chart`)
      await page.getByTestId('chart-start-note-change').click()
      await expect(page.getByTestId('start-note-sheet')).toBeVisible()
      await expect(page.getByTestId('start-note-play')).toHaveText('Note')
      await page.getByTestId('start-note-key-2').click() // D
      await expect(page.getByTestId('start-note-play')).toHaveText('D4 note')
      await expect(page.getByTestId('start-note-value')).toContainText('D')
      await expect
        .poll(async () => (await chart(s.songId))?.starting_note)
        .toBe(62)
      expect((await chart(s.songId))!.version).toBe(1)
      await page.getByTestId('start-note-done').click()
      await expect(page.getByTestId('start-note-sheet')).toHaveCount(0)
    })

    test('paste chords over lyrics → preview → save → reader', async ({
      page,
    }) => {
      const s = (seed = await setup(page, null))
      await page.goto(`/songs/${s.songId}`)
      await page.getByTestId('song-add-chart-button').click()
      await expect(page.getByTestId('chart-editor-page')).toBeVisible()
      await expect(page.getByTestId('chart-editor-preview-empty')).toBeVisible()

      await page.getByTestId('chart-editor-text').fill(
        `[Verse 1]
G              C
Porch light burning on the road
Em        D
Engine ticking low
`
      )
      const detected = page.getByTestId('chart-editor-detected')
      await expect(detected).toHaveAttribute(
        'data-format',
        'chords-over-lyrics'
      )
      await expect(detected).toContainText('Chords over lyrics detected')
      await expect(page.getByTestId('chart-editor-preview')).toContainText(
        'on the road'
      )
      // The note popover opens near the bottom but fits on screen.
      await page.getByTestId('chart-editor-start-note-pick').click()
      await expect(page.getByTestId('start-note-done')).toBeInViewport({
        ratio: 1,
      })
      await page.getByTestId('start-note-done').click()
      await page.getByTestId('chart-editor-save').click()

      await expect(page).toHaveURL(new RegExp(`/songs/${s.songId}/chart$`))
      await expect(page.getByTestId('chart-text')).toContainText('on the road')
      const saved = await chart(s.songId)
      expect(saved!.chordpro).toContain('[G]Porch light bur[C]ning on the road')
      expect(saved!.chordpro).toContain('{start_of_verse: Verse 1}')
    })

    test('a newer save shows the conflict; Show theirs loads it', async ({
      page,
    }) => {
      const s = (seed = await setup(page, '[G]Mine to start\n'))
      await page.goto(`/songs/${s.songId}/chart/edit`)
      const text = page.getByTestId('chart-editor-text')
      await expect(text).toHaveValue(/Mine to start/)
      await text.fill('G\nMy own new words\n')

      const admin = await getSupabaseAdmin()
      await admin
        .from('song_charts')
        .update({ chordpro: '[C]Their newer words\n', version: 2 })
        .eq('song_id', s.songId)

      await page.getByTestId('chart-editor-save').click()
      await expect(page.getByTestId('chart-conflict')).toBeVisible()
      expect((await chart(s.songId))!.chordpro).toBe('[C]Their newer words\n')
      await page.getByTestId('chart-conflict-theirs').click()
      await expect(text).toHaveValue(/Their newer words/)

      // Keep mine still works after looking.
      await text.fill('G\nMy own new words\n')
      await page.getByTestId('chart-editor-save').click()
      await expect(page).toHaveURL(new RegExp(`/songs/${s.songId}/chart$`))
      await expect
        .poll(async () => (await chart(s.songId))!.chordpro)
        .toContain('My own new words')
    })

    test("an empty linked copy offers the band's chart", async ({ page }) => {
      const s = (seed = await setup(page, LONG_CHART))
      const admin = await getSupabaseAdmin()
      const { data: copy, error } = await admin
        .from('songs')
        .insert({
          title: 'Gravel Road',
          artist: 'Test Artist',
          key: 'G',
          guitar_tuning: 'Standard',
          context_type: 'personal',
          context_id: s.userId,
          created_by: s.userId,
          linked_from_song_id: s.songId,
        })
        .select('id')
        .single()
      expect(error).toBeNull()
      const copyId = copy!.id as string

      await page.goto(`/songs/${copyId}`)
      await expect(page.getByTestId('song-add-chart-button')).toBeVisible()
      await page.getByTestId('song-copy-chart-button').click()
      await expect(page.getByTestId('song-chords-button')).toBeVisible()
      await expect(page.getByTestId('song-copy-chart-button')).toHaveCount(0)
      expect((await chart(copyId))!.chordpro).toBe(LONG_CHART)

      // Its own chart from here: editing the copy leaves the band's alone.
      await admin
        .from('song_charts')
        .update({ chordpro: '[D]Only mine\n', version: 2 })
        .eq('song_id', copyId)
      expect((await chart(s.songId))!.chordpro).toBe(LONG_CHART)
    })

    test('the session Chart is a layer and keeps the place', async ({
      page,
    }) => {
      const cal = await seedCalendar(page)
      seed = cal
      const admin = await getSupabaseAdmin()
      await admin.from('song_charts').insert({
        song_id: cal.songs.Everlong,
        chordpro:
          '{start_of_chorus}\n[D]Hold the line, [G]hold the line\n{end_of_chorus}\n',
      })
      await page.goto(`/practices/${cal.practice}/session`)
      await page.getByTestId('session-next').click()
      const pos = page.getByTestId('session-position')
      await expect(pos).toHaveText(/Song 2 of 3/i)
      const url = page.url()

      await page.getByTestId('session-chart').click()
      const layer = page.getByTestId('session-chart-layer')
      await expect(layer).toBeVisible()
      await expect(layer.getByTestId('chart-text')).toContainText(
        'Hold the line'
      )
      // Pedals page the chart, not the session.
      await page.keyboard.press('PageDown')
      await expect(page.getByTestId('chart-edit')).toHaveCount(0)
      expect(page.url()).toBe(url)

      await page.keyboard.press('Escape')
      await expect(layer).toHaveCount(0)
      await expect(pos).toHaveText(/Song 2 of 3/i)
      expect(page.url()).toBe(url)
    })
  })

  test.describe('phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

    test('big Back / Next page the chart; Controls hold the steppers', async ({
      page,
    }) => {
      const s = (seed = await setup(page, LONG_CHART))
      await page.goto(`/songs/${s.songId}/chart`)
      const scroller = page.getByTestId('chart-scroll')
      const top = () => scroller.evaluate(el => el.scrollTop)
      await expect(page.getByTestId('chart-back')).toHaveAttribute(
        'data-at-edge',
        'true'
      )
      await page.getByTestId('chart-next').click()
      await expect.poll(top).toBeGreaterThan(200)
      await expect(page.getByTestId('chart-back')).toHaveAttribute(
        'data-at-edge',
        'false'
      )
      await page.getByTestId('chart-back').click()
      await expect.poll(top).toBe(0)

      await page.getByTestId('chart-controls').click()
      await expect(page.getByTestId('chart-controls-sheet')).toBeVisible()
      await page.getByTestId('chart-size-up').click()
      await expect(page.getByTestId('chart-size-value')).toContainText('24')
      await page.getByTestId('chart-chords-toggle').click()
      await page.getByTestId('chart-controls-done').click()
      await expect(page.getByTestId('chart-chord')).toHaveCount(0)

      // Esc closes the sheet only; the reader stays.
      await page.getByTestId('chart-controls').click()
      await expect(page.getByTestId('chart-controls-sheet')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('chart-controls-sheet')).toHaveCount(0)
      await expect(page).toHaveURL(new RegExp(`/songs/${s.songId}/chart$`))
    })

    test('Chords mode places a chord on a tapped letter and saves', async ({
      page,
    }) => {
      const s = (seed = await setup(
        page,
        '{start_of_verse: Verse 1}\n[G]Porch light\n{end_of_verse}\n'
      ))
      await page.goto(`/songs/${s.songId}/chart/edit`)
      await page.getByTestId('chart-mode-chords').click()
      await page.getByTestId('chart-palette-C').click()
      await page.getByTestId('chart-letter-0-6').click() // the "l" of light
      await expect(page.getByTestId('chart-placed-0-6')).toHaveText('C')
      await page.getByTestId('chart-placed-0-6').click()
      await page.getByTestId('chart-chord-nudge-right').click()
      await expect(page.getByTestId('chart-placed-0-7')).toHaveText('C')
      await page.getByTestId('chart-editor-save').click()
      await expect(page).toHaveURL(new RegExp(`/songs/${s.songId}/chart$`))
      await expect
        .poll(async () => (await chart(s.songId))!.chordpro)
        .toContain('[G]Porch l[C]ight')
    })

    test("a chords-only line's chords don't overlap", async ({ page }) => {
      const s = (seed = await setup(
        page,
        '[Gsus4]  [G]  [F]\n[G]Porch light\n'
      ))
      await page.goto(`/songs/${s.songId}/chart/edit`)
      await page.getByTestId('chart-mode-chords').click()
      const a = await page.getByTestId('chart-placed-0-0').boundingBox()
      const b = await page.getByTestId('chart-placed-0-2').boundingBox()
      expect(a!.x + a!.width).toBeLessThanOrEqual(b!.x)

      await page.getByTestId('chart-mode-lyrics').click()
      await expect(page.getByTestId('chart-lyric-chords-0')).toHaveText(
        /Gsus4\s*G\s*F/
      )
      await expect(page.getByTestId('chart-lyric-1')).toHaveValue('Porch light')
    })
  })
})
