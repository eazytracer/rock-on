/**
 * E2E — Friend requests (Phase 6g): accept one, decline another, cancel one
 * you sent. Requests come first, then Friends, then Sent.
 */
import { test, expect } from '@playwright/test'
import {
  VIEWPORTS,
  makePerson,
  removePeople,
  openFriendsAs,
  request,
  type Person,
} from './friendsHelpers'

for (const { label, viewport } of VIEWPORTS) {
  test.describe(`Friends — requests (${label})`, () => {
    test.use({ viewport })
    let people: Person[] = []

    test.afterEach(async () => {
      await removePeople(people)
      people = []
    })

    test('accept and decline incoming requests, cancel a sent one', async ({
      page,
    }) => {
      const me = await makePerson('Eve')
      const asker = await makePerson('Mia')
      const other = await makePerson('Ray')
      const target = await makePerson('Sol')
      people = [me, asker, other, target]
      const acceptId = await request(asker, me)
      const declineId = await request(other, me)
      const sentId = await request(me, target)

      await openFriendsAs(page, me)
      await expect(page.getByTestId('friends-list-empty')).toBeVisible()

      // Order: Requests · Friends · Sent.
      const ys: number[] = []
      for (const id of [
        'friends-incoming',
        'friends-list-empty',
        'friends-outgoing',
      ])
        ys.push((await page.getByTestId(id).boundingBox())!.y)
      expect(ys).toEqual([...ys].sort((a, b) => a - b))

      await page.getByTestId(`friend-accept-${acceptId}`).click()
      await expect(page.getByTestId('friends-list')).toContainText(asker.name)

      await page.getByTestId(`friend-decline-${declineId}`).click()
      await expect(page.getByTestId('friends-requests-empty')).toBeVisible()
      await expect(page.getByTestId('friends-list')).not.toContainText(
        other.name
      )

      await page.getByTestId(`friend-cancel-${sentId}`).click()
      await expect(page.getByTestId('friends-sent-empty')).toBeVisible()

      // Persisted.
      await page.reload()
      await expect(page.getByTestId('friends-list')).toContainText(asker.name)
      await expect(page.getByTestId('friends-requests-empty')).toBeVisible()
      await expect(page.getByTestId('friends-sent-empty')).toBeVisible()
    })
  })
}
