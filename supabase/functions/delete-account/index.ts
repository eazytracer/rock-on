/**
 * delete-account Edge Function (docs/redesign/13 · 6f; the contract is in the
 * header of migration 20261120120000_redesign_phase_6.sql).
 *
 *   1. The gateway verifies the caller's JWT.
 *   2. `rpc('delete_account')` WITH THE CALLER'S JWT: it acts on auth.uid().
 *      `owns_band` (or any RPC error) goes back to the client unchanged.
 *   3. With the service role, `auth.admin.deleteUser(<caller id>)`.
 *   4. 204. Retrying after a failed step 3 is safe: step 2 refuses nothing for
 *      a user with no row.
 *
 * Endpoint: POST /functions/v1/delete-account (no body)
 * Errors:   { key, message } — key = the RPC's MESSAGE, message = its HINT.
 */

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ key: 'method_not_allowed', message: 'Use POST.' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // The caller's client: every query runs as them (RLS, auth.uid()).
  const authHeader = req.headers.get('Authorization') ?? ''
  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const {
    data: { user },
    error: authError,
  } = await caller.auth.getUser()
  if (authError || !user) {
    return json({ key: 'forbidden', message: 'Sign in again.' }, 401)
  }

  const { error: rpcError } = await caller.rpc('delete_account')
  if (rpcError) {
    const keyed =
      rpcError.code === 'P0001' && /^[a-z_]+$/.test(rpcError.message)
    return json(
      keyed
        ? { key: rpcError.message, message: rpcError.hint ?? rpcError.message }
        : { key: 'unknown', message: "That didn't work. Try again." },
      keyed && rpcError.message === 'forbidden' ? 403 : keyed ? 409 : 500
    )
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteError) {
    console.error('delete-account: auth.admin.deleteUser failed', deleteError)
    return json(
      {
        key: 'unknown',
        message: 'Your data is deleted, but signing out failed. Try again.',
      },
      500
    )
  }

  return new Response(null, { status: 204, headers: corsHeaders })
})
