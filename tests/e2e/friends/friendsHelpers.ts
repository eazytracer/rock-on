/**
 * Shared setup for the Friends specs. Each test makes its own users (unique
 * names, so name searches are exact) and deletes them afterwards; no global
 * data wipe, so specs can run alongside others.
 */
import { expect, type Page } from '@playwright/test'
import {
  createTestUser,
  createTestUserInDB,
  deleteTestUser,
} from '../../fixtures/auth'
import { getSupabaseAdmin } from '../../fixtures/supabase'

export type Policy = 'everyone' | 'friends_of_friends' | 'code_only'

export interface Person {
  id: string
  name: string
  email: string
  password: string
  code: string
}

export const VIEWPORTS = [
  { label: 'phone', viewport: { width: 390, height: 844 } },
  { label: 'desktop', viewport: { width: 1280, height: 860 } },
] as const

const rand = () => Math.random().toString(36).slice(2, 8)

/** Letters and digits only, 8 chars, as the app's codes. */
const newCode = () =>
  `T${Date.now().toString(36).slice(-4)}${rand().slice(0, 3)}`.toUpperCase()

/** A user with a profile: findable or not, a request policy, a friend code. */
export async function makePerson(
  first: string,
  opts: { discoverable?: boolean; policy?: Policy } = {}
): Promise<Person> {
  const name = `${first} Fr${rand()}`
  const user = await createTestUserInDB(createTestUser({ name }))
  const code = newCode()
  const admin = await getSupabaseAdmin()
  const { error } = await admin.from('user_profiles').upsert(
    {
      user_id: user.id,
      display_name: name,
      discoverable: opts.discoverable ?? false,
      friend_request_policy: opts.policy ?? 'everyone',
      friend_code: code,
      instruments: ['Bass', 'Vocals'],
    },
    { onConflict: 'user_id' }
  )
  if (error) throw new Error(`profile seed failed: ${error.message}`)
  return { ...user, code }
}

export async function removePeople(people: (Person | undefined)[]) {
  for (const p of people) if (p) await deleteTestUser(p.id)
}

/** A pending request from → to. */
export async function request(from: Person, to: Person) {
  const admin = await getSupabaseAdmin()
  const { data, error } = await admin
    .from('friend_requests')
    .insert({ requester_id: from.id, addressee_id: to.id, status: 'pending' })
    .select('id')
    .single()
  if (error) throw new Error(`request seed failed: ${error.message}`)
  return data.id as string
}

/** Make two people friends (accepting writes the friendship row). */
export async function befriend(a: Person, b: Person) {
  const id = await request(a, b)
  const admin = await getSupabaseAdmin()
  const { error } = await admin
    .from('friend_requests')
    .update({ status: 'accepted' })
    .eq('id', id)
  if (error) throw new Error(`befriend failed: ${error.message}`)
}

/** Log in through the form and open Friends. */
export async function openFriendsAs(page: Page, p: Person) {
  await page.goto('/auth')
  await page.fill('[data-testid="login-email-input"]', p.email)
  await page.fill('[data-testid="login-password-input"]', p.password)
  await page.press('[data-testid="login-password-input"]', 'Enter')
  await page.waitForURL(url => !url.pathname.startsWith('/auth'), {
    timeout: 15000,
  })
  await page.goto('/friends')
  await expect(page.getByTestId('friends-page')).toBeVisible()
}

/** Open Add a friend (the dock action on phones, the header button on desktop). */
export async function openAddFriend(page: Page) {
  await page.getByTestId('friends-add-button').click()
  await expect(page.getByTestId('add-friend-sheet')).toBeVisible()
}
