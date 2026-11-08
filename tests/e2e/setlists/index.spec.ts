/**
 * The Setlists index (docs/redesign/10 · 2.2 / 2.4): one list per context,
 * next show first and outlined, ⋯ Open / Duplicate / Delete, New setlist.
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
import {
  setupConsoleErrorTracking,
  assertNoConsoleErrors,
} from '../../helpers/assertions'
import { attachShowCopy } from '../../helpers/calendarSeed'

type Seed = { userId: string; bandId: string; fall: string; empty: string }

/** Sign up with a band; seed two songs, two sets and an upcoming show. */
async function setup(page: Page): Promise<Seed> {
  await signUpViaUI(page, createTestUser())
  await createBandViaUI(page, `Index ${Date.now()}`)
  const userId = await getCurrentUserId(page)
  const admin = await getSupabaseAdmin()
  const { data: m } = await admin
    .from('band_memberships')
    .select('band_id')
    .eq('user_id', userId)
    .single()
  const bandId = m!.band_id as string
  const { data: songs } = await admin
    .from('songs')
    .insert(
      [
        ['Black', 'Standard', 343],
        ['Everlong', 'Drop D', 250],
      ].map(([title, guitar_tuning, duration]) => ({
        title,
        guitar_tuning,
        duration,
        context_type: 'band',
        context_id: bandId,
        created_by: userId,
      }))
    )
    .select('id')
  const { data: sets } = await admin
    .from('setlists')
    .insert([
      {
        name: 'Fall Set',
        band_id: bandId,
        context_type: 'band',
        context_id: bandId,
        created_by: userId,
        items: songs!.map((s, i) => ({
          id: `i${i}`,
          type: 'song',
          position: i + 1,
          songId: s.id,
        })),
      },
      {
        name: 'Acoustic Sunday',
        band_id: bandId,
        context_type: 'band',
        context_id: bandId,
        created_by: userId,
        items: [],
      },
    ])
    .select('id, name')
  const fall = sets!.find(s => s.name === 'Fall Set')!.id as string
  const { data: show } = await admin
    .from('shows')
    .insert({
      name: 'Next Gig',
      venue: 'The Crocodile',
      band_id: bandId,
      scheduled_date: new Date(Date.now() + 5 * 864e5).toISOString(),
      created_by: userId,
    })
    .select('id')
    .single()
  await attachShowCopy(show!.id, fall)
  return {
    userId,
    bandId,
    fall,
    empty: sets!.find(s => s.name === 'Acoustic Sunday')!.id as string,
  }
}

test.describe('Setlists index', () => {
  let seed: Seed | undefined
  test.afterEach(async () => {
    if (seed) await deleteTestUser(seed.userId)
    seed = undefined
  })

  test.describe('desktop', () => {
    test.use({ viewport: { width: 1440, height: 900 } })

    test('cards: next show first and outlined, with counts and songs', async ({
      page,
    }) => {
      const errors = setupConsoleErrorTracking(page)
      seed = await setup(page)
      await page.goto('/setlists')

      const cards = page.locator(
        '[data-testid^="setlist-card-"][role="button"]'
      )
      await expect(cards).toHaveCount(2)
      const fall = page.getByTestId(`setlist-card-${seed.fall}`)
      await expect(cards.first()).toHaveAttribute(
        'data-testid',
        `setlist-card-${seed.fall}`
      )
      await expect(fall).toHaveAttribute('data-next', 'true')
      await expect(fall.getByTestId('setlist-card-show')).toContainText(
        /Next show · The Crocodile/i
      )
      await expect(fall).toContainText('2 songs')
      await expect(fall).toContainText('10 min')
      await expect(fall).toContainText('1 retune')
      await expect(fall).toContainText('Black · Everlong')
      await expect(
        page
          .getByTestId(`setlist-card-${seed.empty}`)
          .getByTestId('setlist-card-show')
      ).toContainText(/Not attached to a show/i)

      // Sort by name puts Acoustic Sunday first.
      await page.getByTestId('setlists-sort').click()
      await page.getByTestId('setlist-sort-option-name').click()
      await expect(cards.first()).toHaveAttribute(
        'data-testid',
        `setlist-card-${seed.empty}`
      )

      // A card opens the set full width.
      await page.getByTestId(`setlist-card-${seed.fall}`).click()
      await expect(page).toHaveURL(new RegExp(`/setlists/${seed.fall}$`))
      await assertNoConsoleErrors(page, errors)
    })

    test('⋯ Duplicate makes an unattached copy; Delete keeps the show copy', async ({
      page,
    }) => {
      seed = await setup(page)
      await page.goto('/setlists')

      await page.getByTestId(`setlist-card-menu-${seed.fall}`).click()
      await page.getByTestId('setlist-menu-duplicate').click()
      const copy = page.locator(
        '[data-testid^="setlist-card-"][role="button"]',
        {
          hasText: 'Fall Set copy',
        }
      )
      await expect(copy).toBeVisible()
      await expect(copy.getByTestId('setlist-card-show')).toContainText(
        /Not attached to a show/i
      )

      await page.getByTestId(`setlist-card-menu-${seed.fall}`).click()
      await page.getByTestId('setlist-menu-delete').click()
      await expect(page.getByTestId('confirm-dialog-message')).toContainText(
        'shows keep their own copy'
      )
      await page.getByTestId('confirm-dialog-confirm').click()
      await expect(page.getByTestId(`setlist-card-${seed.fall}`)).toHaveCount(0)
    })

    test('New setlist creates an empty set and opens it', async ({ page }) => {
      seed = await setup(page)
      await page.goto('/setlists')
      await page.getByTestId('setlist-new-card').click()
      await expect(page).toHaveURL(/\/setlists\/[0-9a-f-]{36}$/)
      await expect(page.getByTestId('setlist-name-display')).toContainText(
        'New setlist'
      )
    })

    test('Personal context lists only your own sets', async ({ page }) => {
      seed = await setup(page)
      await switchContextViaUI(page, 'personal')
      await page.goto('/setlists')
      await expect(page.getByTestId('setlist-empty-state')).toBeVisible()
    })
  })

  test.describe('phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

    test('list rows with the show date; search filters by song', async ({
      page,
    }) => {
      seed = await setup(page)
      await page.goto('/setlists')
      const fall = page.getByTestId(`setlist-card-${seed.fall}`)
      await expect(fall.getByTestId('setlist-runtime')).toHaveText('10 min')
      await expect(fall).toContainText('2 songs')
      await expect(fall).toContainText('1 retune')
      await expect(fall).toContainText('The Crocodile')

      await page.getByTestId('setlists-search-toggle').tap()
      await page.getByTestId('setlists-search-input').fill('everlong')
      await expect(fall).toBeVisible()
      await expect(page.getByTestId(`setlist-card-${seed.empty}`)).toHaveCount(
        0
      )
    })
  })
})
