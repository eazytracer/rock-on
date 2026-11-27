/**
 * E2E — the Jam hub (Phase 7a): seeded sections for Eric (live hero
 * TUES7JAM, Hosting FRDY4JAM, Invited MKBD6JAM with Join, Friends' jams
 * SRAH5JAM, Past HALW3JAM), Join with a code → /j/CODE, Host a jam → the
 * planned page, the Calendar's jam rows, and the old Events redirects.
 */
import { test, expect } from '@playwright/test'
import {
  VIEWPORTS,
  cleanUpJams,
  freshJam,
  rpc,
  signIn,
  userId,
} from './jamSetup'

const FRDY = 'e2222222-2222-4222-8222-222222222201'
const TUES = 'e2222222-2222-4222-8222-222222222202'

for (const { label, viewport } of VIEWPORTS) {
  test.describe(`Jam hub (${label})`, () => {
    test.use({ viewport })
    test.afterAll(cleanUpJams)

    test.beforeEach(async ({ page }) => {
      await signIn(page, 'eric')
    })

    test('shows the live hero and every section', async ({ page }) => {
      await page.goto('/jam')
      await expect(page.getByTestId('jam-hub-page')).toBeVisible()

      const hero = page.getByTestId('jam-live-hero')
      await expect(hero).toContainText('Tuesday Open Jam')
      await expect(page.getByTestId('jam-live-return')).toHaveText(
        label === 'desktop' ? 'Return to console' : 'Return to jam'
      )

      await expect(page.getByTestId('jam-hub-hosting')).toContainText(
        'Friday Night Jam'
      )
      const invited = page.getByTestId('jam-hub-invited')
      await expect(invited).toContainText('Band Rehearsal Jam')
      await expect(page.getByTestId('jam-join-MKBD6JAM')).toBeVisible()
      const friends = page.getByTestId('jam-hub-friends')
      await expect(friends).toContainText("Sarah's Basement Session")
      await expect(page.getByTestId('jam-join-SRAH5JAM')).toBeVisible()
      await expect(page.getByTestId('jam-hub-past')).toContainText(
        'Halloween Jam'
      )
      await expect(page.getByTestId('jam-hub-explainer')).toBeVisible()

      // Rows open the jam.
      await page.getByTestId('jam-row-FRDY4JAM').click()
      await expect(page).toHaveURL(new RegExp(`/jam/${FRDY}$`))
    })

    test('Join accepts an invite and opens the jam', async ({ page }) => {
      const jam = await freshJam('sarah', { band: true, who: 'invite' })
      await rpc('sarah', 'invite_to_jam', {
        p_event: jam.id,
        p_user_ids: [await userId('eric')],
      })
      await page.goto('/jam')
      await expect(page.getByTestId('jam-hub-invited')).toContainText(jam.name)
      await page.getByTestId(`jam-join-${jam.short_code}`).click()
      await expect(page).toHaveURL(new RegExp(`/jam/${jam.id}$`))
      await expect(page.getByTestId('jam-tabs-hands')).toBeVisible()
      await expect(page.getByTestId('jam-invited-card')).toHaveCount(0)
    })

    test('Join with a code opens the code page', async ({ page }) => {
      await page.goto('/jam')
      await page.getByTestId('jam-join-code-button').click()
      await page.getByTestId('jam-join-input').fill('frdy4jam')
      await expect(page.getByTestId('jam-join-input')).toHaveValue('FRDY-4JAM')
      await page.getByTestId('jam-join-button').click()
      await expect(page).toHaveURL(/\/j\/FRDY4JAM$/)
    })

    test('Host a jam lands on the planned jam', async ({ page }) => {
      await page.goto('/jam')
      await page.getByTestId('jam-host-button').click()
      await expect(page).toHaveURL(/\/jam\/new$/)
      const name = `Hub Jam ${Date.now().toString(36)}`
      await page.getByTestId('jam-new-name-input').fill(name)
      await page.getByTestId('jam-new-where-input').fill('The Cellar')
      await page.getByTestId('jam-new-create').click()
      await expect(page).toHaveURL(/\/jam\/[0-9a-f-]{36}$/)
      await expect(page.getByTestId('jam-title')).toHaveText(name)
      await expect(page.getByTestId('jam-kicker')).toContainText('The Cellar')
      await expect(page.getByTestId('jam-code-line')).toContainText(/Code/i)
      // Clean up through the app's own delete.
      await page.getByTestId('jam-more').click()
      await page.getByTestId('jam-menu-delete').click()
      await page.getByTestId('confirm-dialog-confirm').click()
      await expect(page).toHaveURL(/\/jam$/)
      await expect(page.getByText(name)).toHaveCount(0)
    })

    test('the Calendar opens jams on the new page, with a LIVE mark', async ({
      page,
    }) => {
      await page.goto('/calendar?type=jam')
      const live = page.getByTestId(`calendar-item-jam-${TUES}`)
      await expect(
        live.getByTestId('calendar-item-live').filter({ visible: true })
      ).toHaveCount(1)
      await page.getByTestId(`calendar-item-jam-${FRDY}`).click()
      await expect(page).toHaveURL(new RegExp(`/jam/${FRDY}$`))
    })

    test('old Events links redirect', async ({ page }) => {
      await page.goto('/events')
      await expect(page).toHaveURL(/\/jam$/)
      await page.goto('/events/new')
      await expect(page).toHaveURL(/\/jam\/new$/)
      await page.goto(`/events/${FRDY}`)
      await expect(page).toHaveURL(new RegExp(`/jam/${FRDY}$`))
      await page.goto('/events?join=FRDY4JAM')
      await expect(page).toHaveURL(/\/j\/FRDY4JAM$/)
      await page.goto('/jam/view/ABC123')
      await expect(page).toHaveURL(/\/j\/ABC123$/)
    })
  })
}
