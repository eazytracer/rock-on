/**
 * Without mic permission the tuner shows the denied state; references still
 * play. Headless Chromium can't show (or remember) a permission prompt, so the
 * browser's "Block" answer is stood in for: getUserMedia rejects with
 * NotAllowedError, exactly what a real denial throws.
 */
import { test, expect } from '@playwright/test'
import { deleteTestUser } from '../../fixtures/auth'
import { seedCalendar, type CalendarSeed } from '../../helpers/calendarSeed'

test.describe('Tuner · mic denied', () => {
  let seed: CalendarSeed | undefined
  test.afterEach(async () => {
    if (seed) await deleteTestUser(seed.userId)
    seed = undefined
  })

  test('shows "Microphone is off" and keeps the reference notes', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException('Permission denied', 'NotAllowedError'))
    })
    seed = await seedCalendar(page)
    await page.goto('/tools/tuner?tuning=standard')
    await page.getByTestId('tuner-start').click()
    await expect(page.getByTestId('tuner-mic-denied')).toBeVisible()
    await expect(page.getByTestId('tuner-mic-denied')).toContainText(
      'Microphone is off'
    )
    await expect(page.getByTestId('tuner-start')).toHaveText(
      /Try the mic again/
    )
    // A string still picks and plays.
    await page.getByTestId('tuner-string-1').click()
    await expect(page.getByTestId('tuner-string-1')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expect(page.getByTestId('tuner-hear')).toHaveText(/Hear E/)
  })
})
