/**
 * Jam specs' setup: the seeded demo users (eric@, sarah@, mike@testband.demo),
 * fresh jams made through the same RPCs the app calls (as each user), and
 * clean-up through the admin client, so specs don't mutate the seeded jams.
 */
import { readFileSync } from 'fs'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { expect, type Browser, type Page } from '@playwright/test'
import { getSupabaseAdmin } from '../../fixtures/supabase'

export const VIEWPORTS = [
  { label: 'phone', viewport: { width: 390, height: 844 } },
  { label: 'desktop', viewport: { width: 1280, height: 860 } },
] as const

export type Who = 'eric' | 'sarah' | 'mike'
export const email = (who: Who) => `${who}@testband.demo`
const PASSWORD = 'test123'

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

const clients = new Map<Who, Promise<SupabaseClient>>()
/** A Supabase client signed in as a seeded user. */
export function as(who: Who): Promise<SupabaseClient> {
  if (!clients.has(who))
    clients.set(
      who,
      (async () => {
        const c = createClient(
          env('VITE_SUPABASE_URL'),
          env('VITE_SUPABASE_ANON_KEY'),
          { auth: { persistSession: false, autoRefreshToken: false } }
        )
        const { error } = await c.auth.signInWithPassword({
          email: email(who),
          password: PASSWORD,
        })
        if (error) throw new Error(`sign in ${who}: ${error.message}`)
        return c
      })()
    )
  return clients.get(who)!
}

export async function userId(who: Who): Promise<string> {
  const { data } = await (await as(who)).auth.getUser()
  return data.user!.id
}

export async function rpc<T = unknown>(
  who: Who,
  fn: string,
  args: object = {}
): Promise<T> {
  const { data, error } = await (await as(who)).rpc(fn, args)
  if (error) throw new Error(`${fn} as ${who}: ${error.message}`)
  return data as T
}

export interface TestJam {
  id: string
  short_code: string
  name: string
}

const made: string[] = []

/** A fresh planned jam hosted by `host`; joiners join with the code. */
export async function freshJam(
  host: Who = 'eric',
  opts: {
    name?: string
    band?: boolean
    who?: 'invite' | 'friends' | 'code'
    join?: Who[]
  } = {}
): Promise<TestJam> {
  let bandId: string | undefined
  if (opts.band) {
    const { data } = await (
      await as(host)
    )
      .from('band_memberships')
      .select('band_id')
      .eq('user_id', await userId(host))
      .eq('status', 'active')
      .limit(1)
    bandId = data?.[0]?.band_id
  }
  const name = opts.name ?? `E2E Jam ${Date.now().toString(36)}`
  const jam = await rpc<TestJam>(host, 'create_jam', {
    p_name: name,
    p_at: new Date(Date.now() + 2 * 86400_000).toISOString(),
    p_where: 'Test Bar',
    p_band_id: bandId,
    p_who_can_join: opts.who ?? 'code',
  })
  made.push(jam.id)
  for (const w of opts.join ?? [])
    await rpc(w, 'join_jam', {
      p_code: jam.short_code,
      p_parts: [{ key: 'bass' }, { key: 'vox' }],
    })
  return jam
}

/** Delete the jams this worker made (any status) and their setlists. */
export async function cleanUpJams() {
  if (!made.length) return
  const admin = await getSupabaseAdmin()
  await admin.from('events').delete().in('id', made.splice(0))
}

export async function signIn(page: Page, who: Who) {
  await page.goto('/auth')
  await page.fill('[data-testid="login-email-input"]', email(who))
  await page.fill('[data-testid="login-password-input"]', PASSWORD)
  await page.press('[data-testid="login-password-input"]', 'Enter')
  await page.waitForURL(url => !url.pathname.startsWith('/auth'), {
    timeout: 15000,
  })
}

/** A second signed-in browser (same viewport) for another seeded user. */
export async function second(
  browser: Browser,
  who: Who,
  viewport: { width: number; height: number }
) {
  const ctx = await browser.newContext({ viewport })
  const page = await ctx.newPage()
  await signIn(page, who)
  return { ctx, page }
}

export async function openJam(page: Page, id: string) {
  await page.goto(`/jam/${id}`)
  await expect(page.getByTestId('jam-page')).toBeVisible()
  await expect(page.getByTestId('jam-title')).toBeVisible()
}
