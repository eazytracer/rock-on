/**
 * Band page specs' setup: users through the admin API, bands and joins through
 * the same RPCs the app calls (as each user), so a spec starts on the screen
 * it tests instead of clicking through sign-up and create.
 */
import { readFileSync } from 'fs'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { expect, Page } from '@playwright/test'
import {
  createTestUser,
  createTestUserInDB,
  loginViaUI,
  type TestUser,
} from '../../fixtures/auth'

export type User = TestUser & { id: string }

function env(name: string): string {
  if (process.env[name]) return process.env[name]!
  const file = readFileSync('.env.development', 'utf8')
  const line = file.split('\n').find(l => l.startsWith(`${name}=`))
  if (!line) throw new Error(`${name} missing from .env.development`)
  return line
    .slice(name.length + 1)
    .trim()
    .replace(/^["']|["']$/g, '')
}

export async function newUser(first: string): Promise<User> {
  const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 5)}`
  return createTestUserInDB(
    createTestUser({
      name: `${first} Test${stamp.slice(-4)}`,
      email: `${first.toLowerCase()}.${stamp}@example.com`,
    })
  )
}

export async function clientFor(user: User): Promise<SupabaseClient> {
  const c = createClient(
    env('VITE_SUPABASE_URL'),
    env('VITE_SUPABASE_ANON_KEY'),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  )
  const { error } = await c.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  })
  if (error) throw new Error(`sign in ${user.email}: ${error.message}`)
  return c
}

async function rpc<T>(c: SupabaseClient, fn: string, args: object) {
  const { data, error } = await c.rpc(fn, args)
  if (error) throw new Error(`${fn}: ${error.message}`)
  return data as T
}

export interface TestBandSetup {
  id: string
  name: string
  code: string
  owner: User
}

/** A band owned by `owner`; `members` join with the code, then get their role. */
export async function bandWith(
  owner: User,
  members: { user: User; role?: 'admin' | 'member' }[] = [],
  name = `Band ${Date.now().toString().slice(-6)}`
): Promise<TestBandSetup> {
  const oc = await clientFor(owner)
  const band = await rpc<{ id: string }>(oc, 'create_band', { p_name: name })
  const { data: codes } = await oc
    .from('invite_codes')
    .select('code')
    .eq('band_id', band.id)
    .eq('is_active', true)
  const code = codes![0].code as string
  for (const m of members) {
    const mc = await clientFor(m.user)
    await rpc(mc, 'join_band', { p_code: code })
    if (m.role === 'admin') {
      await rpc(oc, 'set_member_role', {
        p_band_id: band.id,
        p_user_id: m.user.id,
        p_role: 'admin',
      })
    }
  }
  return { id: band.id, name, code, owner }
}

/** Sign in through the UI and open the band page. */
export async function openBand(page: Page, user: User) {
  await loginViaUI(page, user)
  await page.goto('/band')
  await expect(page.getByTestId('band-card')).toBeVisible({ timeout: 15000 })
}

export const PHONE = { width: 390, height: 844 }
