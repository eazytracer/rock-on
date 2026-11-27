/** Tuner with a fake mic at 107 Hz: A, TUNE UP, three chevrons on the flat side. */
import { test, expect } from '@playwright/test'
import { deleteTestUser } from '../../fixtures/auth'
import { seedCalendar, type CalendarSeed } from '../../helpers/calendarSeed'
import { fakeMic } from './fakeMic'

test.use({ ...fakeMic('a2-107hz.wav'), permissions: ['microphone'] })

test.describe('Tuner · fake mic flat', () => {
  let seed: CalendarSeed | undefined
  test.afterEach(async () => {
    if (seed) await deleteTestUser(seed.userId)
    seed = undefined
  })

  test('reads 107 Hz as A, tune up, 3 chevrons', async ({ page }) => {
    seed = await seedCalendar(page)
    await page.goto('/tools/tuner?tuning=standard')
    await page.getByTestId('tuner-start').click()
    await expect(page.getByTestId('tuner-note')).toHaveAttribute(
      'data-note',
      'A',
      { timeout: 10_000 }
    )
    await expect(page.getByTestId('tuner-cents')).toHaveText(/TUNE UP · 4[78]¢/)
    await expect(page.getByTestId('tuner-chevrons-l')).toHaveAttribute(
      'data-lit',
      '3'
    )
    await expect(page.getByTestId('tuner-chevrons-r')).toHaveAttribute(
      'data-lit',
      '0'
    )
    await expect(page.getByTestId('tuner-in-tune-count')).toContainText(
      '0 of 6'
    )
  })
})
