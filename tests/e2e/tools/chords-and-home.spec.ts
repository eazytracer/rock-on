/**
 * Chords + the way in (docs/redesign/12 · 5c): the Chords tab (root and type
 * keys, the link keeps the chord, Play), Home's Tools row on phone and
 * desktop, the desktop sidebar's Tools group, and the trimmed More.
 */
import { test, expect } from '@playwright/test'
import {
  createTestUser,
  deleteTestUser,
  getCurrentUserId,
  signUpViaUI,
} from '../../fixtures/auth'
import { seedCalendar, type CalendarSeed } from '../../helpers/calendarSeed'
import {
  setupConsoleErrorTracking,
  assertNoConsoleErrors,
} from '../../helpers/assertions'

test.describe('Tools · Chords and the way in', () => {
  let seed: CalendarSeed | undefined
  let userId: string | undefined
  test.afterEach(async () => {
    if (seed) await deleteTestUser(seed.userId)
    if (userId) await deleteTestUser(userId)
    seed = undefined
    userId = undefined
  })

  test.describe('desktop', () => {
    test.use({ viewport: { width: 1280, height: 860 } })

    test('Chords: pick a root and a type; the link keeps the chord', async ({
      page,
    }) => {
      const errors = setupConsoleErrorTracking(page)
      seed = await seedCalendar(page)
      await page.goto('/tools/chords')
      await expect(page.getByTestId('chord-card')).toContainText('G')
      await expect(page.getByTestId('chords-root-G')).toHaveAttribute(
        'aria-pressed',
        'true'
      )

      await page.getByTestId('chords-root-A').click()
      await expect(page).toHaveURL(/\/tools\/chords\?chord=A$/)
      await page.getByTestId('chords-quality-m7').click()
      await expect(page).toHaveURL(/\/tools\/chords\?chord=Am7$/)
      await expect(page.getByTestId('chord-card')).toContainText('Am7')
      await expect(page.getByTestId('chord-card')).toContainText('x 0 2 0 1 0')

      // Root keeps the type; Major clears it.
      await page.getByTestId('chords-root-Bb').click()
      await expect(page).toHaveURL(/chord=Bbm7$/)
      await page.getByTestId('chords-quality-major').click()
      await expect(page).toHaveURL(/chord=Bb$/)

      await page.getByTestId('chord-play').click()
      await expect(page.getByTestId('chord-play')).toContainText('Play B♭')

      // A link opens on its chord; garbage falls back to G.
      await page.goto('/tools/chords?chord=F%23m')
      await expect(page.getByTestId('chord-card')).toContainText('F♯m')
      await page.goto('/tools/chords?chord=Hm')
      await expect(page.getByTestId('chord-card')).toContainText('G')
      await assertNoConsoleErrors(page, errors)
    })

    test('the sidebar Tools group opens each tab and lights on /tools/*', async ({
      page,
    }) => {
      seed = await seedCalendar(page)
      await page.goto('/')
      for (const tab of ['tuner', 'metronome', 'chords'] as const) {
        await page.getByTestId(`sidebar-tool-${tab}`).click()
        await expect(page).toHaveURL(new RegExp(`/tools/${tab}`))
        await expect(page.getByTestId(`sidebar-tool-${tab}`)).toHaveAttribute(
          'aria-current',
          'page'
        )
        await expect(page.getByTestId(`tools-tab-${tab}`)).toHaveAttribute(
          'aria-checked',
          'true'
        )
      }
      await expect(page.getByTestId('sidebar-tool-tuner')).not.toHaveAttribute(
        'aria-current',
        'page'
      )
    })

    test('band Home: the Tools row sits between the cards and Quick actions', async ({
      page,
    }) => {
      seed = await seedCalendar(page)
      await page.goto('/')
      const tools = page.getByTestId('home-tools')
      const practice = page.getByTestId('home-next-practice')
      // Measure once the cards have loaded (the layout settles then).
      await expect(practice).toBeVisible()
      await expect(tools).toBeVisible()
      const practiceY = (await practice.boundingBox())!.y
      const toolsY = (await tools.boundingBox())!.y
      const actionsY = (await page
        .getByTestId('home-action-song')
        .boundingBox())!.y
      expect(toolsY).toBeGreaterThan(practiceY)
      expect(toolsY).toBeLessThan(actionsY)
      await expect(page.getByTestId('home-tool-tuner')).toContainText('E STD')
      await expect(page.getByTestId('home-tool-metronome')).toContainText('BPM')
      await expect(page.getByTestId('home-tool-chords')).toContainText('Lookup')
      await page.getByTestId('home-tool-metronome').click()
      await expect(page).toHaveURL(/\/tools\/metronome/)
    })
  })

  test.describe('phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

    test('Personal Home leads with the Tools row; each tile opens its tab', async ({
      page,
    }) => {
      await signUpViaUI(page, createTestUser())
      userId = await getCurrentUserId(page)
      await page.goto('/')
      const tools = page.getByTestId('home-tools')
      await expect(tools).toBeVisible()
      // Nothing sits above it in the page body.
      const first = page.getByTestId('home-page').locator('section').first()
      await expect(first).toContainText('Tools')

      for (const tab of ['tuner', 'metronome', 'chords'] as const) {
        await page.goto('/')
        await page.getByTestId(`home-tool-${tab}`).tap()
        await expect(page).toHaveURL(new RegExp(`/tools/${tab}`))
        await expect(page.getByTestId('tools-page')).toBeVisible()
      }
    })

    test('the Tuner tile shows the last tuning used', async ({ page }) => {
      seed = await seedCalendar(page)
      await page.goto('/tools/tuner?tuning=drop-d')
      await expect(page.getByTestId('tuner')).toBeVisible()
      await page.goto('/')
      await expect(page.getByTestId('home-tool-tuner')).toContainText('D DROP')
    })

    test('More is trimmed: no Events or Band members rows', async ({
      page,
    }) => {
      seed = await seedCalendar(page)
      await page.goto('/more')
      await expect(page.getByTestId('more-page')).toBeVisible()
      await expect(page.getByTestId('more-jam')).toBeVisible()
      await expect(page.getByTestId('more-friends')).toBeVisible()
      await expect(page.getByTestId('more-events')).toHaveCount(0)
      await expect(page.getByTestId('more-band')).toHaveCount(0)
      await expect(page.getByTestId('more-manage-band')).toBeVisible()
    })
  })
})
