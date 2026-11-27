/**
 * The song page (docs/redesign/10 · 1.8): origin-aware Back and ‹ › stepping,
 * per-field saves with Undo, band note Done + the stale-version conflict, the
 * read-only pane, Add song as a page, and the phone layout.
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

type Seed = {
  userId: string
  bandId: string
  songIds: string[]
  setlistId: string
}

/** Sign up, make a band, and seed three songs plus a setlist (B, A) directly. */
async function setup(page: Page): Promise<Seed> {
  const user = createTestUser()
  await signUpViaUI(page, user)
  await createBandViaUI(page, `Song Page ${Date.now()}`)
  const userId = await getCurrentUserId(page)
  const admin = await getSupabaseAdmin()
  const { data: m } = await admin
    .from('band_memberships')
    .select('band_id')
    .eq('user_id', userId)
    .single()
  const bandId = m!.band_id as string
  const { data: songs, error } = await admin
    .from('songs')
    .insert(
      ['Alpha', 'Bravo', 'Charlie'].map((title, i) => ({
        title,
        artist: 'Test Artist',
        tempo: 100 + i,
        key: 'E',
        guitar_tuning: 'Standard',
        context_type: 'band',
        context_id: bandId,
        created_by: userId,
      }))
    )
    .select('id, title')
  expect(error).toBeNull()
  const id = (t: string) => songs!.find(s => s.title === t)!.id as string
  const { data: setlist } = await admin
    .from('setlists')
    .insert({
      name: 'Fall Set',
      band_id: bandId,
      context_type: 'band',
      context_id: bandId,
      created_by: userId,
      items: [
        {
          id: 'i1',
          type: 'song',
          position: 1,
          songId: id('Bravo'),
          notes: 'Count in slow',
        },
        { id: 'i2', type: 'song', position: 2, songId: id('Alpha') },
      ],
    })
    .select('id')
    .single()
  return {
    userId,
    bandId,
    songIds: [id('Alpha'), id('Bravo'), id('Charlie')],
    setlistId: setlist!.id as string,
  }
}

test.describe('Song page', () => {
  let seed: Seed | undefined

  test.afterEach(async () => {
    if (seed) await deleteTestUser(seed.userId)
    seed = undefined
  })

  test.describe('desktop', () => {
    test.use({ viewport: { width: 1440, height: 900 } })

    test('Open from the pane, step with J, Esc returns with the song selected', async ({
      page,
    }) => {
      seed = await setup(page)
      await page.goto('/songs')
      await page
        .locator('[data-testid^="song-row-"]', { hasText: 'Alpha' })
        .click()
      await page.getByTestId('songs-pane-open').click()

      await expect(page).toHaveURL(
        new RegExp(`/songs/${seed.songIds[0]}\\?from=songs`)
      )
      await expect(page.getByTestId('song-page-back')).toHaveText(/Songs/)
      await expect(page.getByTestId('song-page-position')).toHaveText('1 of 3')

      await page.keyboard.press('j')
      await expect(page.getByTestId('song-detail-title')).toHaveText('Bravo')
      await expect(page.getByTestId('song-page-position')).toHaveText('2 of 3')

      await page.keyboard.press('Escape')
      await expect(page).toHaveURL(/\/songs$/)
      await expect(
        page.locator('[data-testid^="song-row-"]', { hasText: 'Bravo' })
      ).toHaveAttribute('data-selected', 'true')
    })

    test('From a setlist: Back names the set, the set note shows, Back selects the row', async ({
      page,
    }) => {
      seed = await setup(page)
      await page.goto(`/setlists/${seed.setlistId}`)
      await page
        .locator('[data-testid="setlist-row-open-song"]:visible')
        .first()
        .click()

      await expect(page.getByTestId('song-detail-title')).toHaveText('Bravo')
      await expect(page.getByTestId('song-page-back')).toHaveText(/Fall Set/)
      await expect(page.getByTestId('song-page-position')).toHaveText('1 of 2')
      await expect(page.getByTestId('song-note-set')).toContainText(
        'Count in slow'
      )

      await page.getByTestId('song-page-back').click()
      await expect(page).toHaveURL(new RegExp(`/setlists/${seed.setlistId}`))
      await expect(page.locator('[data-selected="true"]')).toContainText(
        'Bravo'
      )
    })

    test('From a setlist: a click previews in the pane, Open keeps Back to the set', async ({
      page,
    }) => {
      seed = await setup(page)
      await page.goto(`/setlists/${seed.setlistId}`)
      await page
        .locator('[data-testid^="setlist-song-i"]', { hasText: 'Bravo' })
        .click()
      await expect(page).toHaveURL(new RegExp(`/setlists/${seed.setlistId}$`))
      const pane = page.getByTestId('song-pane')
      await expect(pane.getByTestId('song-detail-title')).toHaveText('Bravo')
      await pane.getByTestId('song-pane-close').click()
      await expect(pane).toHaveCount(0)

      await page
        .locator('[data-testid^="setlist-song-i"]', { hasText: 'Bravo' })
        .click()
      await page.getByTestId('songs-pane-open').click()
      await expect(page.getByTestId('song-page-back')).toHaveText(/Fall Set/)
    })

    test('Direct link: no stepper, ?from survives a reload', async ({
      page,
    }) => {
      seed = await setup(page)
      await page.goto(`/songs/${seed.songIds[2]}`)
      await expect(page.getByTestId('song-detail-title')).toHaveText('Charlie')
      await expect(page.getByTestId('song-page-stepper')).toHaveCount(0)

      await page.goto(
        `/songs/${seed.songIds[0]}?from=setlist:${seed.setlistId}`
      )
      await page.reload()
      await expect(page.getByTestId('song-page-back')).toHaveText(/Fall Set/)
    })

    test('Facts save on their own with Undo', async ({ page }) => {
      seed = await setup(page)
      await page.goto(`/songs/${seed.songIds[0]}?from=songs`)
      await expect(page.getByTestId('song-detail-title')).toHaveText('Alpha')

      await page.getByTestId('song-fact-bpm').click()
      await page.getByTestId('song-bpm-input').fill('132')
      await page.getByTestId('song-bpm-input').press('Enter')
      await expect(page.getByText('BPM saved')).toBeVisible()
      await expect(page.getByTestId('song-fact-bpm')).toContainText('132')

      await page.getByTestId('toast-action').click()
      await expect(page.getByTestId('song-fact-bpm')).toContainText('100')

      await page.getByTestId('song-fact-tuning').click()
      await page.getByTestId('song-tuning-option-Drop D').click()
      await expect(page.getByText('Tuning saved')).toBeVisible()

      await page.getByTestId('song-fact-key').click()
      await page.getByTestId('song-key-option-A').click()
      await expect(page.getByTestId('song-fact-key')).toContainText('A')

      await page.getByTestId('song-detail-title').click()
      await page.getByTestId('song-title-input').fill('Alpha Prime')
      await page.getByTestId('song-title-input').press('Enter')
      await expect(page.getByTestId('song-detail-title')).toHaveText(
        'Alpha Prime'
      )

      await page.reload()
      await expect(page.getByTestId('song-detail-title')).toHaveText(
        'Alpha Prime'
      )
      await expect(page.getByTestId('song-fact-tuning')).toContainText(
        /D\s*DROP/i
      )
    })

    test('Band note: Done saves; a stale save offers Keep mine', async ({
      page,
    }) => {
      seed = await setup(page)
      await page.goto(`/songs/${seed.songIds[0]}?from=songs`)
      await page.getByTestId('song-note-band-edit').click()
      await page.getByTestId('markdown-textarea').fill('Mine')

      // Someone else saves first.
      const admin = await getSupabaseAdmin()
      await admin
        .from('songs')
        .update({ notes: 'Theirs' })
        .eq('id', seed.songIds[0])

      await page.getByTestId('song-note-done').click()
      await expect(page.getByTestId('song-note-conflict')).toBeVisible()
      await page.getByTestId('song-note-conflict-keep').click()
      await expect(page.getByTestId('song-note-band-view')).toContainText(
        'Mine'
      )

      const { data } = await admin
        .from('songs')
        .select('notes')
        .eq('id', seed.songIds[0])
        .single()
      expect(data!.notes).toBe('Mine')
    })

    test('The pane is a preview with one way out: Open', async ({ page }) => {
      seed = await setup(page)
      await page.goto('/songs')
      await page
        .locator('[data-testid^="song-row-"]', { hasText: 'Alpha' })
        .click()
      const pane = page.getByTestId('song-detail')
      await expect(pane.getByTestId('song-notes-band-preview')).toBeVisible()
      // Notes are read-only here; no Edit / Open to edit / + Add
      await expect(pane.getByTestId('song-notes-band-preview')).not.toHaveRole(
        'button'
      )
      await expect(pane.getByText(/open to edit|click to add/i)).toHaveCount(0)
      await pane.getByTestId('songs-pane-open').click()
      await expect(page).toHaveURL(
        new RegExp(`/songs/${seed.songIds[0]}\\?from=songs`)
      )
    })

    test('Add song is a page beside the sidebar', async ({ page }) => {
      seed = await setup(page)
      await page.goto('/songs')
      await page
        .getByRole('button', { name: /add song/i })
        .first()
        .click()
      await expect(page).toHaveURL(/\/songs\/new$/)
      await expect(page.getByTestId('song-new-page')).toBeVisible()
      await expect(page.getByTestId('sidebar-band-name').first()).toBeVisible()

      await page.getByTestId('song-title-input').fill('Delta')
      await page.getByTestId('song-submit-button').click()
      await expect(page).toHaveURL(/\/songs$/)
      await expect(
        page.locator('[data-testid^="song-row-"]', { hasText: 'Delta' })
      ).toHaveAttribute('data-selected', 'true')
    })
  })

  test.describe('phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

    test('BPM and tuning save from the page', async ({ page }) => {
      seed = await setup(page)
      await page.goto(`/songs/${seed.songIds[0]}?from=songs`)

      await page.getByTestId('song-fact-bpm').tap()
      await expect(page.getByTestId('song-bpm-input')).toHaveAttribute(
        'inputmode',
        'numeric'
      )
      await page.getByTestId('song-bpm-input').fill('90')
      await page.getByTestId('song-bpm-input').press('Enter')
      await expect(page.getByTestId('song-fact-bpm')).toContainText('90')

      await page.getByTestId('song-fact-tuning').tap()
      await page.getByTestId('song-tuning-option-Drop D').tap()
      await expect(page.getByText('Tuning saved')).toBeVisible()
    })
  })
})
