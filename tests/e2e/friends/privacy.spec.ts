/**
 * E2E — Friend privacy (Phase 6g): one status line that rolls open to the
 * Findable switch and who can send requests; each change saves.
 */
import { test, expect } from '@playwright/test'
import {
  VIEWPORTS,
  makePerson,
  removePeople,
  openFriendsAs,
  type Person,
} from './friendsHelpers'
import { getSupabaseAdmin } from '../../fixtures/supabase'

for (const { label, viewport } of VIEWPORTS) {
  test.describe(`Friends — privacy (${label})`, () => {
    test.use({ viewport })
    let me: Person | undefined

    test.afterEach(async () => {
      await removePeople([me])
      me = undefined
    })

    test('rolls open, saves Findable and the request policy', async ({
      page,
    }) => {
      me = await makePerson('Pat', { discoverable: true, policy: 'everyone' })
      await openFriendsAs(page, me)

      const status = page.getByTestId('friends-privacy-status')
      await expect(status).toHaveText('Findable · anyone can send requests')
      await expect(page.getByTestId('friends-privacy-panel')).toHaveCount(0)

      await page.getByTestId('friends-privacy-toggle').click()
      await expect(page.getByTestId('friends-privacy-panel')).toBeVisible()

      await page.getByTestId('friends-discoverable-toggle').click()
      await page.getByTestId('friends-policy-code_only').click()
      await expect(status).toHaveText('Not findable · code only')
      await expect(
        page.getByTestId('friends-policy-code_only')
      ).toHaveAttribute('aria-checked', 'true')

      // Saved server-side.
      const admin = await getSupabaseAdmin()
      await expect
        .poll(async () => {
          const { data } = await admin
            .from('user_profiles')
            .select('discoverable, friend_request_policy')
            .eq('user_id', me!.id)
            .single()
          return data
        })
        .toEqual({ discoverable: false, friend_request_policy: 'code_only' })

      // Closed again by a tap; survives a reload.
      await page.getByTestId('friends-privacy-toggle').click()
      await expect(page.getByTestId('friends-privacy-panel')).toHaveCount(0)
      await page.reload()
      await expect(status).toHaveText('Not findable · code only')
    })
  })
}
