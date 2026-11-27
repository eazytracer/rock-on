/**
 * Live-night specs' setup: a fresh jam per test, hosted by the seeded Eric,
 * built through the same RPCs the app calls (as each seeded user), so a spec
 * starts on the console instead of clicking through planning.
 */
import { readFileSync } from 'fs'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { expect, type Page } from '@playwright/test'

export const SEED = {
  eric: 'eric@testband.demo',
  sarah: 'sarah@testband.demo',
  mike: 'mike@testband.demo',
  leo: 'leo@testband.demo',
}
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

export async function clientAs(email: string): Promise<SupabaseClient> {
  const c = createClient(
    env('VITE_SUPABASE_URL'),
    env('VITE_SUPABASE_ANON_KEY'),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  )
  const { error } = await c.auth.signInWithPassword({
    email,
    password: PASSWORD,
  })
  if (error) throw new Error(`sign in ${email}: ${error.message}`)
  return c
}

export async function rpc<T>(c: SupabaseClient, fn: string, args: object = {}) {
  const { data, error } = await c.rpc(fn, args)
  if (error) throw new Error(`${fn}: ${error.message}`)
  return data as T
}

export interface LiveJam {
  id: string
  code: string
  /** Lineup item ids by title. */
  items: Record<string, string>
  /** Participant ids by seeded first name. */
  people: Record<string, string>
  eric: SupabaseClient
  sarah: SupabaseClient
  mike: SupabaseClient
}

/**
 * Eric's jam with songs A, B, C (Vocals, Guitar, Bass, Drums); Sarah joins on
 * bass, Mike on drums + vocals. `live` goes live through the RPC.
 */
export async function freshJam(
  opts: { live?: boolean; songs?: string[] } = {}
) {
  const [eric, sarah, mike] = await Promise.all([
    clientAs(SEED.eric),
    clientAs(SEED.sarah),
    clientAs(SEED.mike),
  ])
  const stamp = Date.now().toString().slice(-6)
  const jam = await rpc<{ id: string; short_code: string }>(
    eric,
    'create_jam',
    {
      p_name: `Live test ${stamp}`,
      p_at: new Date().toISOString(),
      p_where: 'The Anchor',
    }
  )
  const items: Record<string, string> = {}
  for (const title of opts.songs ?? ['Song A', 'Song B', 'Song C']) {
    const row = await rpc<{ id: string }>(eric, 'add_lineup_title', {
      p_event: jam.id,
      p_title: title,
      p_artist: 'Test Band',
    })
    items[title] = row.id
  }
  const s = await rpc<{ id: string }>(sarah, 'join_jam', {
    p_code: jam.short_code,
    p_parts: ['bass'],
  })
  const m = await rpc<{ id: string }>(mike, 'join_jam', {
    p_code: jam.short_code,
    p_parts: ['drums', 'vox'],
  })
  const st = await rpc<{ me: { participant_id: string } }>(eric, 'jam_state', {
    p_event: jam.id,
  })
  if (opts.live) await rpc(eric, 'go_live', { p_event: jam.id })
  return {
    id: jam.id,
    code: jam.short_code,
    items,
    people: { Eric: st.me.participant_id, Sarah: s.id, Mike: m.id },
    eric,
    sarah,
    mike,
  } satisfies LiveJam
}

/** Ends the jam if it's still live (keeps Eric's hub tidy). */
export async function cleanup(jam: LiveJam | undefined) {
  if (!jam) return
  await jam.eric.rpc('end_jam', { p_event: jam.id })
}

export async function loginAs(page: Page, email: string) {
  await page.goto('/auth')
  await page.getByTestId('login-email-input').fill(email)
  await page.getByTestId('login-password-input').fill(PASSWORD)
  await page.getByTestId('sign-in-button').click()
  await page.waitForURL(u => !u.pathname.startsWith('/auth'), {
    timeout: 15000,
  })
}

export async function openConsole(page: Page, jam: LiveJam) {
  await page.goto(`/jam/${jam.id}/live`)
  await expect(page.getByTestId('jam-console-page')).toBeVisible()
}
