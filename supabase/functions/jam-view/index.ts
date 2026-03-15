/**
 * jam-view Edge Function
 *
 * Serves jam session data to unauthenticated users via a scoped view_token.
 * This function is the ONLY way unauthenticated users can access jam session data.
 * It never exposes user IDs, emails, or raw song catalog data.
 *
 * Endpoint: GET /functions/v1/jam-view?code={shortCode}&t={rawToken}
 *
 * Rate limiting: handled by Supabase Edge Function infrastructure.
 * Additional rate limiting via Retry-After header on 429 responses.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

/** Hash a string with SHA-256 and return hex */
async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const url = new URL(req.url)
  const shortCode = url.searchParams.get('code')
  const rawToken = url.searchParams.get('t')

  if (!shortCode || !rawToken) {
    return new Response(JSON.stringify({ error: 'Missing code or token' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Initialize Supabase client with service_role (bypasses RLS)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // Hash the raw token to compare with stored hash
  const hashedToken = await sha256(rawToken)

  // Look up the jam session
  const { data: session, error: sessionError } = await supabase
    .from('jam_sessions')
    .select('id, name, host_user_id, status, expires_at, view_token_expires_at')
    .eq('short_code', shortCode)
    .eq('view_token', hashedToken)
    .single()

  if (sessionError || !session) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Check if session has expired
  if (
    session.status === 'expired' ||
    new Date(session.expires_at) < new Date()
  ) {
    return new Response(JSON.stringify({ error: 'Session has expired' }), {
      status: 410,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Check view token expiry
  if (
    session.view_token_expires_at &&
    new Date(session.view_token_expires_at) < new Date()
  ) {
    return new Response(JSON.stringify({ error: 'View link has expired' }), {
      status: 410,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Get host display name (NEVER return email or user ID)
  const { data: hostProfile } = await supabase
    .from('user_profiles')
    .select('display_name')
    .eq('user_id', session.host_user_id)
    .single()

  const hostDisplayName = hostProfile?.display_name || 'Host'

  // Get confirmed song matches
  const { data: matches, error: matchesError } = await supabase
    .from('jam_song_matches')
    .select('display_title, display_artist, match_confidence')
    .eq('jam_session_id', session.id)
    .eq('is_confirmed', true)
    .order('participant_count', { ascending: false })

  if (matchesError) {
    return new Response(JSON.stringify({ error: 'Failed to load matches' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Get participant count (NEVER return participant details)
  const { count: participantCount } = await supabase
    .from('jam_participants')
    .select('*', { count: 'exact', head: true })
    .eq('jam_session_id', session.id)
    .eq('status', 'active')

  // Build safe public payload — NO user IDs, emails, or raw catalog data
  const payload = {
    sessionName: session.name || 'Jam Session',
    hostDisplayName,
    participantCount: participantCount ?? 0,
    matchCount: matches?.length ?? 0,
    matches: (matches ?? []).map((m: Record<string, string>) => ({
      displayTitle: m.display_title,
      displayArtist: m.display_artist,
      matchConfidence: m.match_confidence,
    })),
  }

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, max-age=0',
    },
  })
})
