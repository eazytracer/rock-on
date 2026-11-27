/**
 * Song tags (Phase 7): tags save and come back after a reload, lowercased and
 * de-duplicated; they belong to the song's context (a band song's are the
 * band's, its linked My Songs copy has its own); the Jam song switch on a My
 * Songs song is just the `jam` tag, and band songs don't have it.
 */
import { test, expect, Page } from '@playwright/test'
import {
  createTestUser,
  signUpViaUI,
  deleteTestUser,
  getCurrentUserId,
} from '../../fixtures/auth'
import { createBandViaUI } from '../../fixtures/bands'
import { getSupabaseAdmin } from '../../fixtures/supabase'

type Seed = { userId: string; bandSong: string; copy: string; solo: string }

/** A band song, its linked copy in My Songs, and a My Songs-only song. */
async function setup(page: Page): Promise<Seed> {
  await signUpViaUI(page, createTestUser())
  await createBandViaUI(page, `Tags ${Date.now()}`)
  const userId = await getCurrentUserId(page)
  const admin = await getSupabaseAdmin()
  const { data: m } = await admin
    .from('band_memberships')
    .select('band_id')
    .eq('user_id', userId)
    .single()
  const base = { artist: 'Test Artist', guitar_tuning: 'Standard' }
  const { data: band } = await admin
    .from('songs')
    .insert({
      ...base,
      title: 'Alpha',
      context_type: 'band',
      context_id: m!.band_id,
      created_by: userId,
    })
    .select('id')
    .single()
  const mine = {
    context_type: 'personal',
    context_id: userId,
    created_by: userId,
    visibility: 'personal',
  }
  const { data: rows, error } = await admin
    .from('songs')
    .insert([
      { ...base, ...mine, title: 'Alpha', linked_from_song_id: band!.id },
      { ...base, ...mine, title: 'Solo' },
    ])
    .select('id, title, linked_from_song_id')
  expect(error).toBeNull()
  return {
    userId,
    bandSong: band!.id,
    copy: rows!.find(r => r.linked_from_song_id)!.id,
    solo: rows!.find(r => r.title === 'Solo')!.id,
  }
}

async function dbTags(id: string): Promise<string[]> {
  const admin = await getSupabaseAdmin()
  const { data } = await admin
    .from('songs')
    .select('tags')
    .eq('id', id)
    .single()
  return data!.tags
}

async function editTags(page: Page, text: string) {
  await page.getByTestId('song-tags').click()
  await page.getByTestId('song-tags-input').fill(text)
  await page.getByTestId('song-tags-input').press('Enter')
  await expect(page.getByText('Tags saved')).toBeVisible()
}

for (const [name, viewport] of [
  ['desktop', { width: 1440, height: 900 }],
  ['phone', { width: 390, height: 844 }],
] as const) {
  test.describe(`Song tags (${name})`, () => {
    test.use({ viewport })
    let seed: Seed | undefined

    test.afterEach(async () => {
      if (seed) await deleteTestUser(seed.userId)
      seed = undefined
    })

    test('band and My Songs tags persist separately; a linked copy shows its own', async ({
      page,
    }) => {
      seed = await setup(page)

      await page.goto(`/songs/${seed.bandSong}`)
      await expect(page.getByTestId('song-detail-title')).toHaveText('Alpha')
      await expect(page.getByTestId('song-jam-toggle')).toHaveCount(0)
      await editTags(page, ' Covers, 90s ,covers,, ')
      await expect(page.getByTestId('song-tag-covers')).toBeVisible()
      await expect(page.getByTestId('song-tag-90s')).toBeVisible()

      // Undo puts the old (empty) tags back; save again.
      await page.getByTestId('toast-action').click()
      await expect(page.getByTestId('song-tag-covers')).toHaveCount(0)
      await editTags(page, 'Covers, 90s')

      await page.reload()
      await expect(page.getByTestId('song-tag-covers')).toBeVisible()
      await expect(page.getByTestId('song-tag-90s')).toBeVisible()
      expect(await dbTags(seed.bandSong)).toEqual(['covers', '90s'])

      // The linked copy in My Songs has none of the band's tags.
      await page.goto(`/songs/${seed.copy}`)
      await expect(page.getByTestId('song-detail-title')).toHaveText('Alpha')
      await expect(page.getByTestId('song-tags')).toHaveText('Add tags')
      await editTags(page, 'Acoustic')
      await page.reload()
      await expect(page.getByTestId('song-tag-acoustic')).toBeVisible()
      await expect(page.getByTestId('song-tag-covers')).toHaveCount(0)
      expect(await dbTags(seed.copy)).toEqual(['acoustic'])
      expect(await dbTags(seed.bandSong)).toEqual(['covers', '90s'])
    })

    test('Jam song switch on a My Songs song adds and removes the jam tag', async ({
      page,
    }) => {
      seed = await setup(page)
      await page.goto(`/songs/${seed.solo}`)
      await expect(page.getByTestId('song-detail-title')).toHaveText('Solo')
      const toggle = page.getByTestId('song-jam-toggle')
      await expect(toggle).toHaveAttribute('aria-checked', 'false')

      await toggle.click()
      await expect(page.getByText('Jam song saved')).toBeVisible()
      await expect(page.getByTestId('song-tag-jam')).toBeVisible()
      await page.reload()
      await expect(toggle).toHaveAttribute('aria-checked', 'true')
      expect(await dbTags(seed.solo)).toEqual(['jam'])

      await toggle.click()
      await expect(toggle).toHaveAttribute('aria-checked', 'false')
      await expect(page.getByTestId('song-tag-jam')).toHaveCount(0)
      await expect.poll(() => dbTags(seed!.solo)).toEqual([])
    })
  })
}

test.describe('Add song tags', () => {
  test.use({ viewport: { width: 1440, height: 900 } })
  let userId: string | undefined
  test.afterEach(async () => {
    if (userId) await deleteTestUser(userId)
    userId = undefined
  })

  test('save lowercased and de-duplicated', async ({ page }) => {
    await signUpViaUI(page, createTestUser())
    await createBandViaUI(page, `Add Tags ${Date.now()}`)
    userId = await getCurrentUserId(page)
    await page.goto('/songs/new')
    await page.getByTestId('song-title-input').fill('Tagged Tune')
    await page.getByTestId('song-tags-input').fill('Live, live , Opener')
    await page.getByTestId('song-submit-button').click()

    const admin = await getSupabaseAdmin()
    await expect
      .poll(async () => {
        const { data } = await admin
          .from('songs')
          .select('tags')
          .eq('created_by', userId!)
          .eq('title', 'Tagged Tune')
        return data?.[0]?.tags
      })
      .toEqual(['live', 'opener'])
  })
})
