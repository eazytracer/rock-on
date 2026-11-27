/**
 * Jam songs (Phase 7): your jam songs are your My Songs songs tagged `jam`.
 * The "Jam songs" filter on Songs (My Songs only), and the builder at
 * /jam/songs: check / uncheck My Songs songs, pick a band song (copied to My
 * Songs, linked, tagged jam), Save honours ?returnTo=, Not now skips.
 */
import { test, expect, Page } from '@playwright/test'
import {
  createTestUser,
  signUpViaUI,
  deleteTestUser,
  getCurrentUserId,
} from '../../fixtures/auth'
import { createBandViaUI, switchContextViaUI } from '../../fixtures/bands'
import { getSupabaseAdmin } from '../../fixtures/supabase'

type Seed = {
  userId: string
  zulu: string
  alpha: string
  bravo: string
}

/** My Songs: Alpha (jam), Bravo. The band: Zulu (not in My Songs). */
async function setup(page: Page): Promise<Seed> {
  await signUpViaUI(page, createTestUser())
  await createBandViaUI(page, `Jam Songs ${Date.now()}`)
  const userId = await getCurrentUserId(page)
  const admin = await getSupabaseAdmin()
  const { data: m } = await admin
    .from('band_memberships')
    .select('band_id')
    .eq('user_id', userId)
    .single()
  const base = {
    artist: 'Test Artist',
    guitar_tuning: 'Standard',
    tags: [] as string[],
  }
  const mine = {
    context_type: 'personal',
    context_id: userId,
    created_by: userId,
    visibility: 'personal',
  }
  const { data: rows, error } = await admin
    .from('songs')
    .insert([
      { ...base, ...mine, title: 'Alpha', tags: ['jam'] },
      { ...base, ...mine, title: 'Bravo' },
      {
        ...base,
        title: 'Zulu',
        context_type: 'band',
        context_id: m!.band_id,
        created_by: userId,
      },
    ])
    .select('id, title')
  expect(error).toBeNull()
  const id = (t: string) => rows!.find(r => r.title === t)!.id as string
  return { userId, alpha: id('Alpha'), bravo: id('Bravo'), zulu: id('Zulu') }
}

async function tagsOf(id: string): Promise<string[]> {
  const admin = await getSupabaseAdmin()
  const { data } = await admin
    .from('songs')
    .select('tags')
    .eq('id', id)
    .single()
  return data!.tags
}

for (const [name, viewport] of [
  ['desktop', { width: 1440, height: 900 }],
  ['phone', { width: 390, height: 844 }],
] as const) {
  test.describe(`Jam songs (${name})`, () => {
    test.use({ viewport })
    let seed: Seed | undefined

    test.afterEach(async () => {
      if (seed) await deleteTestUser(seed.userId)
      seed = undefined
    })

    test('Jam songs filter on My Songs', async ({ page }) => {
      seed = await setup(page)
      await page.goto('/songs')
      await expect(page.getByTestId('songs-jam-filter')).toHaveCount(0)
      await switchContextViaUI(page, 'personal')
      await page.goto('/songs')

      const rows = page.locator('[data-testid^="song-row-"]')
      await expect(rows).toHaveCount(2)
      await page.getByTestId('songs-jam-filter').click()
      await expect(rows).toHaveCount(1)
      await expect(rows.first()).toContainText('Alpha')

      await page.getByTestId('songs-jam-filter').click()
      await expect(rows).toHaveCount(2)
    })

    test('builder: check, uncheck, copy a band song; Save goes to returnTo', async ({
      page,
    }) => {
      seed = await setup(page)
      await page.goto('/jam/songs?returnTo=/friends')
      await expect(page.getByTestId('jam-songs-title')).toContainText(
        "Songs you'd jam on"
      )
      const row = (id: string) => page.getByTestId(`jam-songs-row-${id}`)
      await expect(row(seed.alpha)).toHaveAttribute('aria-pressed', 'true')
      await expect(row(seed.bravo)).toHaveAttribute('aria-pressed', 'false')
      await expect(row(seed.zulu)).toHaveAttribute('aria-pressed', 'false')

      // Search narrows the list.
      await page.getByTestId('jam-songs-search').fill('zul')
      await expect(row(seed.alpha)).toHaveCount(0)
      await row(seed.zulu).click()
      await page.getByTestId('jam-songs-search').fill('')

      await row(seed.alpha).click()
      await row(seed.bravo).click()
      await page.getByTestId('jam-songs-save').click()

      await expect(page).toHaveURL(/\/friends$/)
      await expect(page.getByText('Saved · 2 jam songs')).toBeVisible()
      expect(await tagsOf(seed.alpha)).toEqual([])
      expect(await tagsOf(seed.bravo)).toEqual(['jam'])
      expect(await tagsOf(seed.zulu)).toEqual([])

      const admin = await getSupabaseAdmin()
      const { data: copies } = await admin
        .from('songs')
        .select('title, tags, context_type, context_id')
        .eq('linked_from_song_id', seed.zulu)
      expect(copies).toEqual([
        {
          title: 'Zulu',
          tags: ['jam'],
          context_type: 'personal',
          context_id: seed.userId,
        },
      ])

      // Back in the builder, the copy is a My Songs song, checked.
      await page.goto('/jam/songs')
      await expect(
        page.locator('[data-testid^="jam-songs-row-"][aria-pressed="true"]')
      ).toHaveCount(2)
      await expect(page.getByText('Zulu')).toHaveCount(1)
    })

    test('Not now leaves without saving', async ({ page }) => {
      seed = await setup(page)
      await page.goto('/jam/songs?returnTo=/friends')
      await page.getByTestId(`jam-songs-row-${seed.bravo}`).click()
      await page.getByTestId('jam-songs-not-now').click()
      await expect(page).toHaveURL(/\/friends$/)
      expect(await tagsOf(seed.bravo)).toEqual([])
    })
  })
}
