/**
 * Tuner with a fake mic playing A2 at 110 Hz (docs/redesign/12 · 3.4): the
 * face reads A and IN TUNE, auto-detect picks the A string, and the string
 * counts as tuned after holding.
 */
import { test, expect } from '@playwright/test'
import { deleteTestUser } from '../../fixtures/auth'
import { seedCalendar, type CalendarSeed } from '../../helpers/calendarSeed'
import {
  setupConsoleErrorTracking,
  assertNoConsoleErrors,
} from '../../helpers/assertions'
import { fakeMic } from './fakeMic'

test.use({ ...fakeMic('a2-110hz.wav'), permissions: ['microphone'] })

test.describe('Tuner · fake mic in tune', () => {
  let seed: CalendarSeed | undefined
  test.afterEach(async () => {
    if (seed) await deleteTestUser(seed.userId)
    seed = undefined
  })

  test('reads A2 in tune and counts the string', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    seed = await seedCalendar(page)
    await page.setViewportSize({ width: 1280, height: 860 })
    await page.goto('/tools/tuner?tuning=standard')
    await expect(page.getByTestId('tools-page')).toBeVisible()
    await expect(page.getByTestId('tuner-in-tune-count')).toContainText(
      '0 of 6'
    )
    await page.getByTestId('tuner-start').click()
    await expect(page.getByTestId('tuner-stop')).toBeVisible()
    await expect(page.getByTestId('tuner-note')).toHaveAttribute(
      'data-note',
      'A',
      { timeout: 10_000 }
    )
    await expect(page.getByTestId('tuner-cents')).toHaveText('IN TUNE')
    await expect(page.getByTestId('tuner-chevrons-l')).toHaveAttribute(
      'data-lit',
      '1'
    )
    await expect(page.getByTestId('tuner-string-5')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expect(page.getByTestId('tuner-string-5')).toHaveAttribute(
      'data-tuned',
      'true'
    )
    await expect(page.getByTestId('tuner-in-tune-count')).toContainText(
      '1 of 6'
    )

    // Leaving the tab stops the mic.
    await page.getByTestId('tools-tab-metronome').click()
    await expect(page.getByTestId('metronome')).toBeVisible()
    await page.getByTestId('tools-tab-tuner').click()
    await expect(page.getByTestId('tuner-start')).toBeVisible()
    await assertNoConsoleErrors(page, errors)
  })
})
