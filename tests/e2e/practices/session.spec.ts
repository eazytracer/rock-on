/**
 * The practice session (docs/redesign 03-screens Practice session; FP 7–8,
 * Practice 2–4): Start from the practice page; Prev / Next name the song they
 * go to and the last Next ends; keys and pedals (← → / PgUp PgDn), N for
 * notes (a panel on desktop, a sheet on phones); Up next warns on a tuning
 * change; the wrap-up saves time played, songs reached and shared notes.
 */
import { test, expect } from '@playwright/test'
import { deleteTestUser } from '../../fixtures/auth'
import { getSupabaseAdmin } from '../../fixtures/supabase'
import {
  setupConsoleErrorTracking,
  assertNoConsoleErrors,
} from '../../helpers/assertions'
import { seedCalendar, type CalendarSeed } from '../../helpers/calendarSeed'

test.describe('Practice session', () => {
  let seed: CalendarSeed | undefined
  test.afterEach(async () => {
    if (seed) await deleteTestUser(seed.userId)
    seed = undefined
  })

  test.describe('desktop', () => {
    test.use({ viewport: { width: 1280, height: 860 } })

    test('Start, named Prev / Next, keys, and the tuning warning', async ({
      page,
    }) => {
      const errors = setupConsoleErrorTracking(page)
      seed = await seedCalendar(page)
      await page.goto(`/practices/${seed.practice}`)
      await page.getByTestId('practice-start-session').click()
      await expect(page).toHaveURL(/\/session$/)

      const pos = page.getByTestId('session-position')
      await expect(pos).toHaveText(/Song 1 of 3/i)
      await expect(page.getByTestId('session-title')).toHaveText('Black')
      await expect(page.getByTestId('session-next')).toContainText('Everlong')
      await expect(page.getByTestId('session-prev')).toBeDisabled()
      // Black (Standard) → Everlong (Drop D): Up next warns.
      await expect(page.getByTestId('session-up-next')).toHaveAttribute(
        'data-retune',
        'true'
      )
      await expect(page.getByTestId('session-tune-now')).toBeVisible()
      // Dark text on the yellow fill (the secondary variant's ink lost before).
      const tuneNow = await page
        .getByTestId('session-tune-now')
        .evaluate(el => {
          const bg = getComputedStyle(document.documentElement)
            .getPropertyValue('--bg-0-rgb')
            .trim()
            .split(/\s+/)
            .join(', ')
          return { color: getComputedStyle(el).color, bg: `rgb(${bg})` }
        })
      expect(tuneNow.color).toBe(tuneNow.bg)

      await page.getByTestId('session-next').click()
      await expect(pos).toHaveText(/Song 2 of 3/i)
      await expect(page.getByTestId('session-prev')).toContainText('Black')

      await page.keyboard.press('PageDown')
      await expect(pos).toHaveText(/Song 3 of 3/i)
      await expect(page.getByTestId('session-next')).toContainText(
        /End practice/i
      )
      await page.keyboard.press('ArrowLeft')
      await expect(pos).toHaveText(/Song 2 of 3/i)
      await page.keyboard.press('PageUp')
      await expect(page.getByTestId('session-title')).toHaveText('Black')
      await assertNoConsoleErrors(page, errors)
    })

    test('notes are a side panel that N toggles', async ({ page }) => {
      seed = await seedCalendar(page)
      await page.goto(`/practices/${seed.practice}/session`)
      const panel = page.getByTestId('session-notes-panel')
      await expect(panel).toBeVisible()
      await expect(page.getByTestId('session-band-notes')).toContainText(
        'Count in slow'
      )
      await page.keyboard.press('n')
      await expect(panel).toHaveCount(0)
      await page.keyboard.press('n')
      await expect(panel).toBeVisible()
    })

    test('the wrap-up saves time, songs reached and shared notes', async ({
      page,
    }) => {
      seed = await seedCalendar(page)
      await page.goto(`/practices/${seed.practice}/session`)
      await page.getByTestId('session-next').click()
      await page.getByTestId('session-end').click()

      await expect(page.getByTestId('session-wrapup-summary')).toContainText(
        '2 of 3 songs'
      )
      await expect(page.getByTestId('session-wrapup')).toContainText('skipped')
      await page
        .getByTestId('session-wrapup-notes')
        .fill('Bridge on Everlong still loose')
      await page.getByTestId('session-wrapup-save').click()
      await expect(page).toHaveURL(new RegExp(`/practices/${seed.practice}$`))
      await expect(page.getByTestId('practice-wrapup')).toContainText(
        'Bridge on Everlong still loose'
      )

      const admin = await getSupabaseAdmin()
      const { data } = await admin
        .from('practice_sessions')
        .select('start_time, end_time, wrapup_notes, songs')
        .eq('id', seed.practice)
        .single()
      expect(data!.start_time).toBeTruthy()
      expect(data!.end_time).toBeTruthy()
      expect(data!.wrapup_notes).toBe('Bridge on Everlong still loose')
      expect(data!.songs.map((s: { status: string }) => s.status)).toEqual([
        'completed',
        'completed',
        'skipped',
      ])
    })

    test('Skip marks the song skipped, and the wrap-up can change it', async ({
      page,
    }) => {
      seed = await seedCalendar(page)
      await page.goto(`/practices/${seed.practice}/session`)
      await page.getByTestId('session-skip').click()
      await expect(page.getByTestId('session-title')).toHaveText('Everlong')
      await page.keyboard.press('s')
      await expect(page.getByTestId('session-title')).toHaveText('Breed')
      // Skip on the last song ends the practice.
      await page.getByTestId('session-skip').click()

      const summary = page.getByTestId('session-wrapup-summary')
      await expect(summary).toContainText('0 of 3 songs')
      // Tap to change: Black was played after all; Breed toggles back off.
      await page.getByTestId('session-wrapup-song-0').click()
      await page.getByTestId('session-wrapup-song-2').click()
      await expect(summary).toContainText('2 of 3 songs')
      await page.getByTestId('session-wrapup-song-2').click()
      await expect(summary).toContainText('1 of 3 songs')
      await expect(page.getByTestId('session-wrapup-song-2')).toHaveAttribute(
        'aria-pressed',
        'false'
      )
      await page.getByTestId('session-wrapup-save').click()
      await expect(page).toHaveURL(new RegExp(`/practices/${seed.practice}$`))

      const admin = await getSupabaseAdmin()
      const { data } = await admin
        .from('practice_sessions')
        .select('songs')
        .eq('id', seed.practice)
        .single()
      expect(data!.songs.map((s: { status: string }) => s.status)).toEqual([
        'completed',
        'skipped',
        'skipped',
      ])
    })
  })

  test.describe('phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

    test('notes open as a sheet', async ({ page }) => {
      seed = await seedCalendar(page)
      await page.goto(`/practices/${seed.practice}/session`)
      await expect(page.getByTestId('session-notes-panel')).toHaveCount(0)
      await page.getByTestId('session-notes-toggle').click()
      const sheet = page.getByTestId('session-notes-sheet')
      await expect(sheet).toBeVisible()
      await expect(sheet).toContainText('Count in slow')
    })
  })
})
