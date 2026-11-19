/**
 * E2E — Remove a friend from their ⋯ menu (with a confirm), then add them
 * again. The re-add locks the old "You're already friends" dead-end: removing
 * must clear the accepted request so a fresh one goes through.
 */
import { test, expect } from '@playwright/test'
import {
  VIEWPORTS,
  makePerson,
  removePeople,
  openFriendsAs,
  openAddFriend,
  befriend,
  type Person,
} from './friendsHelpers'

for (const { label, viewport } of VIEWPORTS) {
  test.describe(`Friends — remove a friend (${label})`, () => {
    test.use({ viewport })
    let people: Person[] = []

    test.afterEach(async () => {
      await removePeople(people)
      people = []
    })

    test('remove with confirm, then add them again', async ({ page }) => {
      const me = await makePerson('Kim')
      const pal = await makePerson('Lou', {
        discoverable: true,
        policy: 'everyone',
      })
      people = [me, pal]
      await befriend(pal, me)

      await openFriendsAs(page, me)
      const list = page.getByTestId('friends-list')
      await expect(list).toContainText(pal.name)

      await list.locator('[data-testid^="friend-menu-"]').first().click()
      await page.getByTestId('friend-remove').click()
      await expect(page.getByTestId('confirm-dialog-title')).toHaveText(
        `Remove ${pal.name}?`
      )
      await page.getByTestId('confirm-dialog-confirm').click()
      await expect(page.getByTestId('friends-list-empty')).toBeVisible()

      await page.reload()
      await expect(page.getByTestId('friends-list-empty')).toBeVisible()

      await openAddFriend(page)
      await page.getByTestId('add-friend-search-input').fill(pal.name)
      await page.getByTestId(`add-friend-add-${pal.id}`).click()
      await expect(
        page.getByTestId(`add-friend-result-${pal.id}`)
      ).toContainText('Requested')
      await expect(page.getByTestId('add-friend-error')).toHaveCount(0)
    })
  })
}
