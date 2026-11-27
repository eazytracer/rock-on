/**
 * Settings (docs/redesign/13 · 6e, 6f): phone list → sub-screens, desktop
 * tabs, Profile (name, ordered instruments, colour), Music (click sound read
 * by the metronome), push preferences, change password, and delete account
 * (blocked for an owner, works for anyone else).
 *
 * Each test creates its own user through the admin API and signs in on the
 * sign-in screen, so nothing here touches the seeded demo users.
 */
import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import {
  createTestUser,
  createTestUserInDB,
  deleteTestUser,
  type TestUser,
} from '../../fixtures/auth'
import { getLocalServiceKey, getSupabaseAdmin } from '../../fixtures/supabase'
import {
  setupConsoleErrorTracking,
  assertNoConsoleErrors,
} from '../../helpers/assertions'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321'

type User = TestUser & { id: string }

/** A separate client signed in as the user (never the shared admin client). */
async function clientAs(email: string, password: string) {
  const c = createClient(SUPABASE_URL, await getLocalServiceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await c.auth.signInWithPassword({ email, password })
  return { c, error }
}

async function signIn(page: Page, user: TestUser) {
  await page.goto('/auth')
  await page.getByTestId('login-email-input').fill(user.email)
  await page.getByTestId('login-password-input').fill(user.password)
  await page.getByTestId('login-password-input').press('Enter')
  await page.waitForURL(url => !url.pathname.startsWith('/auth'), {
    timeout: 15000,
  })
}

async function prefsOf(userId: string) {
  const admin = await getSupabaseAdmin()
  const { data } = await admin
    .from('user_preferences')
    .select('theme, metronome, push')
    .eq('user_id', userId)
    .maybeSingle()
  return data
}

test.describe('Settings', () => {
  let user: User | undefined

  test.beforeEach(async ({ page }) => {
    user = await createTestUserInDB(createTestUser())
    await signIn(page, user)
  })
  test.afterEach(async () => {
    if (user) await deleteTestUser(user.id)
    user = undefined
  })

  test.describe('phone', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test('the list opens sub-screens with a Settings back crumb', async ({
      page,
    }) => {
      const errors = setupConsoleErrorTracking(page)
      await page.goto('/settings')
      await expect(page.getByTestId('settings-list')).toBeVisible()
      await expect(page.getByTestId('theme-segmented')).toBeVisible()
      await expect(page.getByTestId('account-email')).toHaveText(user!.email)
      await expect(page.getByTestId('version-info')).toBeVisible()
      await expect(page.getByTestId('account-user-id')).toHaveCount(0)

      await page.getByTestId('settings-row-profile').click()
      await expect(page).toHaveURL(/\/settings\/profile$/)
      await expect(page.getByTestId('settings-profile')).toBeVisible()
      await expect(page.getByTestId('profile-email-note')).toContainText(
        "email isn't shown"
      )
      await page.getByTestId('settings-back').click()
      await expect(page).toHaveURL(/\/settings$/)

      await page.getByTestId('settings-row-music').click()
      await expect(page.getByTestId('settings-music')).toBeVisible()
      await expect(page.getByTestId('settings-tunings-tuner')).toBeVisible()
      await page.getByTestId('settings-back').click()

      await page.getByTestId('delete-account-button').click()
      await expect(page).toHaveURL(/\/settings\/delete$/)
      await expect(page.getByTestId('settings-delete')).toBeVisible()
      await assertNoConsoleErrors(page, errors)
    })

    test('profile: name, instruments in order and colour save', async ({
      page,
    }) => {
      await page.goto('/settings/profile')
      await page.getByTestId('profile-name-input').fill('Stage Name')
      await page.getByTestId('profile-name-save').click()
      await expect(page.getByText('Name saved')).toBeVisible()

      await page.getByTestId('profile-instrument-add-bass').click()
      await expect(page.getByTestId('profile-instrument-row-0')).toContainText(
        'Bass'
      )
      await page.getByTestId('profile-instrument-add-vocals').click()
      await expect(page.getByTestId('profile-instrument-row-1')).toContainText(
        'Vocals'
      )
      await page.getByTestId('profile-instrument-other-button').click()
      await page.getByTestId('profile-instrument-other-input').fill('Cello')
      await page.getByTestId('profile-instrument-other-add').click()
      await expect(page.getByTestId('profile-instrument-row-2')).toContainText(
        'Cello'
      )
      // Cello to the top, then remove Vocals (now third).
      await page.getByTestId('profile-instrument-up-2').click()
      await expect(page.getByTestId('profile-instrument-row-1')).toContainText(
        'Cello'
      )
      await page.getByTestId('profile-instrument-up-1').click()
      await expect(page.getByTestId('profile-instrument-row-0')).toContainText(
        'Cello'
      )
      await page.getByTestId('profile-instrument-remove-2').click()
      await page.getByTestId('profile-color-teal').click()

      const admin = await getSupabaseAdmin()
      await expect
        .poll(async () => {
          const { data } = await admin
            .from('user_profiles')
            .select('display_name, instruments, personal_color')
            .eq('user_id', user!.id)
            .single()
          return data
        })
        .toEqual({
          display_name: 'Stage Name',
          instruments: ['Cello', 'Bass'],
          personal_color: '#2dd4bf',
        })
      const { data: u } = await admin
        .from('users')
        .select('name')
        .eq('id', user!.id)
        .single()
      expect(u!.name).toBe('Stage Name')

      await page.reload()
      await expect(page.getByTestId('profile-name-input')).toHaveValue(
        'Stage Name'
      )
      await expect(page.getByTestId('profile-instrument-row-0')).toContainText(
        'Cello'
      )
      await expect(page.getByTestId('profile-color-teal')).toHaveAttribute(
        'aria-checked',
        'true'
      )
    })

    test('push preferences persist, merged into user_preferences.push', async ({
      page,
    }) => {
      const admin = await getSupabaseAdmin()
      await admin
        .from('user_preferences')
        .upsert(
          { user_id: user!.id, theme: 'dark', push: { legacy: 1 } },
          { onConflict: 'user_id' }
        )
      await page.goto('/settings/notifications')
      await expect(page.getByTestId('push-not-on-yet')).toContainText(
        "Push isn't on yet"
      )
      await page.getByTestId('push-type-practices-switch').click()
      await expect(
        page.getByTestId('push-type-practices-switch')
      ).toHaveAttribute('aria-checked', 'false')
      await page.getByTestId('push-quiet-start-input').fill('22:30')
      await expect(page.getByTestId('push-quiet-start-input')).toHaveValue(
        '22:30'
      )
      await page.getByTestId('push-enabled-switch').click()
      await expect(page.getByTestId('push-type-shows-switch')).toBeDisabled()

      await expect
        .poll(async () => {
          const p = await prefsOf(user!.id)
          const push = p?.push as Record<string, any>
          return [
            p?.theme,
            push?.legacy,
            push?.enabled,
            push?.types?.practices,
            push?.quietHours?.start,
            typeof push?.quietHours?.tz,
          ]
        })
        .toEqual(['dark', 1, false, false, '22:30', 'string'])

      await page.reload()
      await expect(page.getByTestId('push-enabled-switch')).toHaveAttribute(
        'aria-checked',
        'false'
      )
      await expect(page.getByTestId('push-quiet-start-input')).toHaveValue(
        '22:30'
      )
    })

    test('delete account works for a non-owner; sign-in fails after', async ({
      page,
    }) => {
      await page.goto('/settings/delete')
      await expect(
        page.getByTestId('delete-account-consequences')
      ).toContainText('Former member')
      await expect(page.getByTestId('delete-account-owner-block')).toHaveCount(
        0
      )
      const go = page.getByTestId('delete-account-confirm-button')
      await expect(go).toBeDisabled()
      await page.getByTestId('delete-account-confirmation-input').fill('delete')
      await expect(go).toBeDisabled()
      await page.getByTestId('delete-account-confirmation-input').fill('DELETE')
      await expect(go).toBeEnabled()
      await go.click()
      await page.waitForURL(/\/auth/, { timeout: 15000 })

      const admin = await getSupabaseAdmin()
      const { data: row } = await admin
        .from('users')
        .select('id')
        .eq('id', user!.id)
        .maybeSingle()
      expect(row).toBeNull()
      const { error } = await clientAs(user!.email, user!.password)
      expect(error).not.toBeNull()
      user = undefined // already gone
    })
  })

  test.describe('desktop', () => {
    test.use({ viewport: { width: 1280, height: 860 } })

    test('tabs switch sections; /settings opens Profile', async ({ page }) => {
      const errors = setupConsoleErrorTracking(page)
      await page.goto('/settings')
      await expect(page.getByTestId('settings-nav')).toBeVisible()
      await expect(page.getByTestId('settings-tab-profile')).toHaveAttribute(
        'aria-current',
        'page'
      )
      await expect(page.getByTestId('settings-profile')).toBeVisible()
      for (const [tab, body] of [
        ['appearance', 'theme-segmented'],
        ['music', 'settings-tunings'],
        ['notifications', 'settings-notifications'],
        ['account', 'account-email'],
        ['about', 'version-info'],
      ]) {
        await page.getByTestId(`settings-tab-${tab}`).click()
        await expect(page).toHaveURL(new RegExp(`/settings/${tab}$`))
        await expect(page.getByTestId(body)).toBeVisible()
      }
      await page.getByTestId('about-whats-new').click()
      await expect(page).toHaveURL(/\/notifications\?tab=updates/)
      await expect(page.getByTestId('notifications-updates')).toBeVisible()
      await assertNoConsoleErrors(page, errors)
    })

    test('click sound saves (merged) and the metronome uses it', async ({
      page,
    }) => {
      const admin = await getSupabaseAdmin()
      await admin
        .from('user_preferences')
        .upsert(
          { user_id: user!.id, theme: 'light', metronome: { other: 'kept' } },
          { onConflict: 'user_id' }
        )
      await page.goto('/settings/music')
      await expect(page.getByTestId('music-click-beep')).toBeVisible()
      await page.getByTestId('music-click-woodblock').click()
      await expect
        .poll(async () => {
          const p = await prefsOf(user!.id)
          return [p?.theme, p?.metronome]
        })
        .toEqual(['light', { other: 'kept', click: 'woodblock' }])

      await page.goto('/tools/metronome')
      await expect(page.getByTestId('metronome')).toHaveAttribute(
        'data-click-sound',
        'woodblock'
      )
    })

    test('change password asks for the current one first', async ({ page }) => {
      await page.goto('/settings/account')
      await expect(page.getByTestId('account-signin-methods')).toHaveText(
        'Password'
      )
      await page.getByTestId('account-change-password').click()
      await page
        .getByTestId('change-password-current-input')
        .fill('not-my-password')
      await page.getByTestId('change-password-new-input').fill('short')
      await expect(page.getByTestId('change-password-save')).toBeDisabled()
      await page.getByTestId('change-password-new-input').fill('BrandNew-123')
      await page.getByTestId('change-password-save').click()
      await expect(
        page.getByTestId('change-password-current-error')
      ).toContainText("isn't your current password")

      await page
        .getByTestId('change-password-current-input')
        .fill(user!.password)
      await page.getByTestId('change-password-save').click()
      await expect(page.getByText('Password changed')).toBeVisible()
      await expect(page.getByTestId('change-password-form')).toHaveCount(0)

      expect((await clientAs(user!.email, 'BrandNew-123')).error).toBeNull()
      expect((await clientAs(user!.email, user!.password)).error).not.toBeNull()
    })

    test('delete account is blocked while you own a band', async ({ page }) => {
      const { c } = await clientAs(user!.email, user!.password)
      const { error } = await c.rpc('create_band', {
        p_name: `Owned ${Date.now()}`,
      })
      expect(error).toBeNull()

      await page.goto('/settings/account')
      await page.getByTestId('delete-account-button').click()
      await expect(page).toHaveURL(/\/settings\/delete$/)
      await expect(page.getByTestId('delete-account-owner-block')).toBeVisible()
      await expect(
        page.getByTestId('delete-account-consequences')
      ).toContainText('You own Owned')
      await page.getByTestId('delete-account-confirmation-input').fill('DELETE')
      await expect(
        page.getByTestId('delete-account-confirm-button')
      ).toBeDisabled()
    })
  })
})
