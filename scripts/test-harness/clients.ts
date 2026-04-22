/**
 * Supabase client factories for the test harness.
 *
 * `adminClient()` uses the service role key — RLS is bypassed. Use
 *   for provisioning, inspection, and anything the app would never do.
 *
 * `userClient(persona)` signs in as the persona and returns an
 *   authenticated client whose queries run with that user's JWT. Use
 *   for anything meant to exercise RLS and real application paths.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

import { CONFIG, Persona } from './config'

// Safety: refuse to run against any non-local URL. Every test-harness
// script that touches data goes through these factories.
const LOCAL_URL_RE = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/
if (!LOCAL_URL_RE.test(CONFIG.supabaseUrl)) {
  throw new Error(
    `Test harness refuses to run against non-local Supabase URL: ${CONFIG.supabaseUrl}\n` +
      `Only 127.0.0.1 / localhost is allowed.`
  )
}

let _admin: SupabaseClient | null = null

export function adminClient(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(CONFIG.supabaseUrl, CONFIG.serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  }
  return _admin
}

/**
 * Sign in as a persona and return an authenticated client. The client
 * holds the JWT in memory only (no disk persistence). Each call
 * creates a fresh session, so invoking this in a loop will issue
 * multiple refresh tokens — prefer holding on to one client per
 * persona within a command.
 */
export async function userClient(persona: Persona): Promise<{
  client: SupabaseClient
  userId: string
  accessToken: string
  refreshToken: string
}> {
  const client = createClient(CONFIG.supabaseUrl, CONFIG.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const { data, error } = await client.auth.signInWithPassword({
    email: persona.email,
    password: persona.password,
  })
  if (error) {
    throw new Error(
      `Failed to sign in as ${persona.name} (${persona.email}): ${error.message}\n` +
        `If the user doesn't exist yet, run: npm run harness -- ensure`
    )
  }
  if (!data.user || !data.session) {
    throw new Error(`Sign-in for ${persona.name} returned no user/session`)
  }

  return {
    client,
    userId: data.user.id,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  }
}
