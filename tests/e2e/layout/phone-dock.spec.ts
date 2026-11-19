/**
 * The phone dock (layout/PhoneDock): on a page with a main action the tab bar
 * tucks into a button beside it in one bar; tap or swipe right for the tabs,
 * and the back-to-action button, picking a tab, swiping left or tapping the
 * page tucks it back. Pages without one keep the tab bar.
 */
import { test, expect, type Page } from '@playwright/test'
import { deleteTestUser } from '../../fixtures/auth'
import { seedCalendar, type CalendarSeed } from '../../helpers/calendarSeed'

const dock = (page: Page) => page.getByTestId('phone-dock')

const swipe = async (page: Page, testId: string, dx: number) => {
  const box = (await page.getByTestId(testId).boundingBox())!
  const y = box.y + box.height / 2
  const x = dx > 0 ? box.x + 12 : box.x + box.width - 12
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y, { steps: 6 })
  await page.mouse.up()
}

test.describe('Phone dock', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  let seed: CalendarSeed | undefined
  test.afterEach(async () => {
    if (seed) await deleteTestUser(seed.userId)
    seed = undefined
  })

  test('a page action tucks the tab bar; tap, swipe and pick bring it and tuck it', async ({
    page,
  }) => {
    seed = await seedCalendar(page)
    await page.goto(`/practices/${seed.practice}`)
    const start = page
      .getByTestId('dock-action')
      .getByTestId('practice-start-session')
    await expect(start).toBeVisible()
    await expect(dock(page)).toHaveAttribute('data-tucked', 'true')

    // Tap the pill → tabs; tap the page → tucked.
    await page.getByTestId('dock-tab-pill').click()
    await expect(dock(page)).toHaveAttribute('data-tucked', 'false')
    await page
      .getByTestId('practice-detail')
      .click({ position: { x: 5, y: 5 } })
    await expect(dock(page)).toHaveAttribute('data-tucked', 'true')

    // Open, the bar ends with the way back to the action.
    await page.getByTestId('dock-tab-pill').click()
    await expect(dock(page)).toHaveAttribute('data-tucked', 'false')
    await page.getByTestId('dock-back-to-action').click()
    await expect(dock(page)).toHaveAttribute('data-tucked', 'true')
    await expect(start).toBeVisible()

    // Swipe right on the pill → tabs; swipe left on them → tucked.
    await swipe(page, 'dock-tab-pill', 90)
    await expect(dock(page)).toHaveAttribute('data-tucked', 'false')
    await swipe(page, 'bottom-navigation', -90)
    await expect(dock(page)).toHaveAttribute('data-tucked', 'true')

    // Picking a tab goes there; Songs' Add song takes the dock in turn.
    await page.getByTestId('dock-tab-pill').click()
    await page.getByTestId('bottom-nav-songs').click()
    await expect(page).toHaveURL(/\/songs$/)
    await expect(dock(page)).toHaveAttribute('data-tucked', 'true')
    await expect(
      page.getByTestId('dock-action').getByTestId('add-song-button')
    ).toBeVisible()

    // Back on the practice it starts tucked again, and Start still works.
    await page.goBack()
    await expect(dock(page)).toHaveAttribute('data-tucked', 'true')
    await start.click()
    await expect(page).toHaveURL(/\/session$/)
  })
})
