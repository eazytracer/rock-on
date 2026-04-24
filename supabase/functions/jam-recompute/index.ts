/**
 * jam-recompute Edge Function
 *
 * Recomputes common song matches for a jam session entirely server-side.
 * No song data ever travels to a browser client — the function reads directly
 * from the database, runs the matching algorithm, and writes results atomically
 * via the replace_jam_matches() Postgres function.
 *
 * Both connected clients receive the updated matches via their existing
 * Realtime subscription on jam_song_matches — no polling or manual refresh needed.
 *
 * Endpoint: POST /functions/v1/jam-recompute
 * Body:     { "sessionId": "<uuid>" }
 * Auth:     Bearer token (authenticated Supabase user)
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import { mergeMatches } from '../_shared/songMatcher.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// deno-lint-ignore no-explicit-any
Deno.serve(async (req: any) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // ── Environment ────────────────────────────────────────────────────────────
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  // ── Auth: verify the caller is an authenticated user ──────────────────────
  const authHeader = req.headers.get('Authorization') ?? ''
  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: authError,
  } = await supabaseUser.auth.getUser()

  if (authError || !user) {
    return json({ error: 'Unauthorized' }, 401)
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let sessionId: string
  try {
    const body = await req.json()
    sessionId = body?.sessionId
    if (!sessionId) throw new Error('missing sessionId')
  } catch {
    return json({ error: 'Body must be { sessionId: string }' }, 400)
  }

  // ── Service-role client for all data operations ────────────────────────────
  const admin = createClient(supabaseUrl, serviceRoleKey)

  // ── Verify caller is an active participant ─────────────────────────────────
  const { data: participant } = await admin
    .from('jam_participants')
    .select('id')
    .eq('jam_session_id', sessionId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!participant) {
    return json({ error: 'Not a participant in this session' }, 403)
  }

  // ── Fetch all active participants ──────────────────────────────────────────
  const { data: participants, error: participantsError } = await admin
    .from('jam_participants')
    .select('user_id')
    .eq('jam_session_id', sessionId)
    .eq('status', 'active')

  if (participantsError || !participants?.length) {
    return json({ error: 'Failed to fetch participants' }, 500)
  }

  if (participants.length < 2) {
    // Not enough participants — clear any stale matches
    await admin
      .from('jam_song_matches')
      .delete()
      .eq('jam_session_id', sessionId)
    return json([])
  }

  // ── Fetch each participant's personal song catalog ─────────────────────────
  // The service role bypasses RLS so we can read any user's personal songs.
  // This is the key win: all DB reads happen in the same Deno isolate,
  // no data round-trips through the browser.
  const catalogs = await Promise.all(
    participants.map(async (p: { user_id: string }) => {
      const { data: songs } = await admin
        .from('songs')
        .select('id, title, artist')
        .eq('context_type', 'personal')
        .eq('context_id', p.user_id)

      return {
        userId: p.user_id,
        songs: (songs ?? []).map(
          (s: { id: string; title: string; artist: string | null }) => ({
            id: s.id,
            title: s.title,
            artist: s.artist ?? undefined,
          })
        ),
      }
    })
  )

  // ── Run the matching algorithm ─────────────────────────────────────────────
  const rawMatches = mergeMatches(catalogs)

  // ── Atomically replace jam_song_matches via Postgres transaction ───────────
  // replace_jam_matches() wraps DELETE + INSERT in a single transaction so
  // Realtime subscribers never see a 0-match window, and concurrent calls
  // cannot interleave their writes.
  const matchesForDb = rawMatches.map(m => ({
    id: crypto.randomUUID(),
    canonical_title: m.canonicalTitle,
    canonical_artist: m.canonicalArtist,
    display_title: m.displayTitle,
    display_artist: m.displayArtist,
    match_confidence: m.matchConfidence,
    is_confirmed: m.isConfirmed,
    matched_songs: m.matchedSongs,
    participant_count: m.participantCount,
  }))

  const { error: rpcError } = await admin.rpc('replace_jam_matches', {
    p_session_id: sessionId,
    p_matches: matchesForDb,
  })

  if (rpcError) {
    console.error('replace_jam_matches error:', rpcError)
    return json({ error: 'Failed to save matches' }, 500)
  }

  // Return the new matches so the caller can update local state immediately
  // without waiting for the Realtime event.
  return json(
    matchesForDb.map(m => ({
      id: m.id,
      jamSessionId: sessionId,
      canonicalTitle: m.canonical_title,
      canonicalArtist: m.canonical_artist,
      displayTitle: m.display_title,
      displayArtist: m.display_artist,
      matchConfidence: m.match_confidence,
      isConfirmed: m.is_confirmed,
      matchedSongs: m.matched_songs,
      participantCount: m.participant_count,
      computedAt: new Date().toISOString(),
    }))
  )
})
