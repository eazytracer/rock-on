/**
 * E2E — Add a friend (Phase 6g): by name for someone findable who takes
 * requests from everyone, refused by a friends-of-friends policy with no
 * mutual friend, and by friend code for someone who is code-only.
 */
import { test, expect } from '@playwright/test'
import {
  VIEWPORTS,
  makePerson,
  removePeople,
  openFriendsAs,
  openAddFriend,
  type Person,
} from './friendsHelpers'

for (const { label, viewport } of VIEWPORTS) {
  test.describe(`Friends — add a friend (${label})`, () => {
    test.use({ viewport })
    let me: Person | undefined
    let them: Person | undefined

    test.afterEach(async () => {
      await removePeople([me, them])
      me = them = undefined
    })

    test('by name: a findable person who takes requests from everyone', async ({
      page,
    }) => {
      me = await makePerson('Ada')
      them = await makePerson('Zoe', { discoverable: true, policy: 'everyone' })
      await openFriendsAs(page, me)

      await openAddFriend(page)
      await page.getByTestId('add-friend-search-input').fill(them.name)
      const row = page.getByTestId(`add-friend-result-${them.id}`)
      await expect(row).toContainText(them.name)
      await expect(row).toContainText('Bass, Vocals')

      await page.getByTestId(`add-friend-add-${them.id}`).click()
      await expect(row).toContainText('Requested')
      await expect(page.getByTestId('friends-outgoing')).toContainText(
        them.name
      )
    })

    test('by name: refused by a friends-of-friends policy without a mutual friend', async ({
      page,
    }) => {
      me = await makePerson('Ben')
      them = await makePerson('Leo', {
        discoverable: true,
        policy: 'friends_of_friends',
      })
      await openFriendsAs(page, me)

      await openAddFriend(page)
      await page.getByTestId('add-friend-search-input').fill(them.name)
      await page.getByTestId(`add-friend-add-${them.id}`).click()
      await expect(page.getByTestId('add-friend-error')).toHaveText(
        "They aren't taking requests this way. Ask for their friend code."
      )
      await expect(page.getByTestId('friends-sent-empty')).toBeVisible()
    })

    test('by friend code: someone who is code-only (not findable)', async ({
      page,
    }) => {
      me = await makePerson('Cy')
      them = await makePerson('Dana', {
        discoverable: false,
        policy: 'code_only',
      })
      await openFriendsAs(page, me)

      await openAddFriend(page)
      // Not findable by name.
      await page.getByTestId('add-friend-search-input').fill(them.name)
      await expect(page.getByTestId('add-friend-no-results')).toBeVisible()

      // The no-results link switches to Friend code.
      await page.getByTestId('add-friend-use-code').click()
      await page.getByTestId('add-friend-code-input').fill('NOPE2345')
      await page.getByTestId('add-friend-code-send').click()
      await expect(page.getByTestId('add-friend-error')).toHaveText(
        'No one has that code. Check it and try again.'
      )

      await page
        .getByTestId('add-friend-code-input')
        .fill(them.code.toLowerCase())
      await page.getByTestId('add-friend-code-send').click()
      await expect(page.getByTestId('add-friend-sheet')).toHaveCount(0)
      await expect(page.getByTestId('friends-outgoing')).toContainText(
        them.name
      )
    })
  })
}
