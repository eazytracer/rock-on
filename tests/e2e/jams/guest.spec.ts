/**
 * `/j/:code`, the shared resolver: band codes → the band preview, jam codes →
 * the jam preview, invite-only and bad codes → neutral copy, any case and
 * with or without the hyphen; a signed-in join with parts lands on the jam.
 * Seeded jams are read only (FRDY4JAM, MKBD6JAM); the join uses a fresh jam.
 */
import { test, expect } from '@playwright/test'
import { loginViaUI, deleteTestUser } from '../../fixtures/auth'
import { getSupabaseAdmin } from '../../fixtures/supabase'
import { bandWith, newUser, type User } from '../bands/bandSetup'
import { freshJam, loginAs, SEED, type LiveJam } from './liveSetup'
import { PHONE, resetRateLimits, tidy } from './guestSetup'

test.describe('Join code resolver', () => {
  const users: User[] = []
  let jam: LiveJam | undefined

  test.beforeEach(() => resetRateLimits())
  test.afterEach(async () => {
    await tidy(jam)
    jam = undefined
    for (const u of users.splice(0)) await deleteTestUser(u.id)
  })

  test('a band code opens the band preview; signed out it asks to sign in', async ({
    page,
  }) => {
    const owner = await newUser('Owner')
    const joiner = await newUser('Joiner')
    users.push(owner, joiner)
    const band = await bandWith(owner)

    await page.goto(`/j/${band.code}`)
    await expect(page).toHaveURL(/\/auth\?.*returnTo=%2Fj%2F/)

    await loginViaUI(page, joiner)
    await page.goto(`/j/${band.code.toLowerCase()}`)
    await expect(page.getByTestId('join-band-name')).toHaveText(band.name)
  })

  test('a jam code shows the jam preview, any case, with or without the hyphen', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE)
    await loginAs(page, SEED.mike)
    for (const code of ['frdy-4jam', 'FRDY4JAM', 'Frdy4Jam']) {
      await page.goto(`/j/${code}`)
      await expect(page.getByTestId('jam-preview-name')).toHaveText(
        'Friday Night Jam'
      )
      await expect(page.getByTestId('jam-preview-meta')).toContainText(
        'Hosted by Eric'
      )
    }
  })

  test('invite only and bad codes are neutral, signed in or out', async ({
    page,
  }) => {
    await page.goto('/j/MKBD-6JAM')
    await expect(page.getByTestId('jam-code-invite-only')).toContainText(
      'This jam is invite only.'
    )
    await expect(page.getByText('Band Rehearsal Jam')).toHaveCount(0)

    await page.goto('/j/ZZZZ-ZZZZ')
    await expect(page.getByTestId('jam-code-invalid')).toContainText(
      "That code isn't valid."
    )

    // Someone who isn't in it (participants get the preview).
    const outsider = await newUser('Out')
    users.push(outsider)
    await loginViaUI(page, outsider)
    await page.goto('/j/zzzzzzzz')
    await expect(page.getByTestId('jam-code-invalid')).toBeVisible()
    await page.goto('/j/MKBD6JAM')
    await expect(page.getByTestId('jam-code-invite-only')).toBeVisible()
  })

  for (const [label, viewport] of [
    ['phone', PHONE],
    ['desktop', { width: 1280, height: 800 }],
  ] as const) {
    test(`signed in (${label}): Join → parts → skip songs → the jam`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      jam = await freshJam()
      const joiner = await newUser('Jo')
      users.push(joiner)
      await loginViaUI(page, joiner)

      await page.goto(`/j/${jam.code.toLowerCase()}`)
      await page.getByTestId('jam-join-button').click()
      await page.getByTestId('jam-join-parts-guitar').click()
      await page.getByTestId('jam-join-parts-vox').click()
      await page.getByTestId('jam-join-parts-next').click()
      // No jam songs yet: pick some, or skip.
      await expect(page.getByTestId('jam-join-pick-songs')).toBeVisible()
      await page.getByTestId('jam-join-skip').click()
      await expect(page).toHaveURL(new RegExp(`/jam/${jam.id}$`))

      const admin = await getSupabaseAdmin()
      const { data } = await admin
        .from('event_participants')
        .select('parts, via')
        .eq('event_id', jam.id)
        .eq('user_id', joiner.id)
        .single()
      expect(data!.parts).toEqual([{ key: 'guitar' }, { key: 'vox' }])
      expect(data!.via).toBe('app')

      // Coming back: already in, so Open jam.
      await page.goto(`/j/${jam.code}`)
      await expect(page.getByTestId('jam-join-open')).toBeVisible()
    })
  }
})
