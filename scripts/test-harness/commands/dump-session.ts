/**
 * `dump-session <sessionId>` — print a full service-role snapshot of a
 * jam session: row, participants (with display names), matches, host
 * queue, working setlist.
 *
 * Uses the admin client, so RLS is bypassed — this is intended for
 * debugging "what does each side actually see?". For the per-user
 * view, sign in as that persona and query through the app.
 */

import { adminClient } from '../clients'

export async function runDumpSession(args: {
  sessionId: string
}): Promise<void> {
  const admin = adminClient()

  const { data: session, error: sErr } = await admin
    .from('jam_sessions')
    .select('*')
    .eq('id', args.sessionId)
    .single()
  if (sErr) throw sErr

  const { data: participants, error: pErr } = await admin
    .from('jam_participants')
    .select('*')
    .eq('jam_session_id', args.sessionId)
  if (pErr) throw pErr

  const userIds = Array.from(new Set((participants ?? []).map(p => p.user_id)))
  let profilesByUserId: Record<
    string,
    { display_name?: string; email?: string }
  > = {}
  if (userIds.length > 0) {
    const { data: profs } = await admin
      .from('user_profiles')
      .select('user_id, display_name')
      .in('user_id', userIds)
    const { data: usrs } = await admin
      .from('users')
      .select('id, email, name')
      .in('id', userIds)
    for (const p of profs ?? []) {
      profilesByUserId[p.user_id] = {
        ...profilesByUserId[p.user_id],
        display_name: p.display_name,
      }
    }
    for (const u of usrs ?? []) {
      profilesByUserId[u.id] = {
        ...profilesByUserId[u.id],
        email: u.email,
        display_name: profilesByUserId[u.id]?.display_name ?? u.name,
      }
    }
  }

  const { data: matches, error: mErr } = await admin
    .from('jam_song_matches')
    .select('*')
    .eq('jam_session_id', args.sessionId)
    .order('match_confidence', { ascending: true })
  if (mErr) throw mErr

  console.log('=== Jam Session ===')
  console.log(`id:          ${session.id}`)
  console.log(`name:        ${session.name}`)
  console.log(`status:      ${session.status}`)
  console.log(`host:        ${session.host_user_id}`)
  console.log(`joinCode:    ${session.short_code}`)
  console.log(`expires:     ${session.expires_at}`)
  console.log(`seedSetlist: ${session.seed_setlist_id ?? '(none)'}`)
  console.log(`savedSetlist: ${session.saved_setlist_id ?? '(none)'}`)
  const hostSongIds = (session.settings?.hostSongIds as string[]) ?? []
  const setlistItems =
    (session.settings?.setlistItems as
      | Array<{ id: string; displayTitle: string; displayArtist: string }>
      | undefined) ?? []
  console.log(`hostSongIds: ${hostSongIds.length} entries`)
  for (const id of hostSongIds) console.log(`  - ${id}`)
  console.log(`setlistItems: ${setlistItems.length} entries`)
  for (const it of setlistItems)
    console.log(`  - [${it.id}] ${it.displayTitle} — ${it.displayArtist}`)

  console.log('\n=== Participants ===')
  for (const p of participants ?? []) {
    const prof = profilesByUserId[p.user_id]
    const label = prof?.display_name ?? prof?.email ?? p.user_id
    console.log(
      `  ${label} — status=${p.status} shared=${JSON.stringify(p.shared_contexts)} joined=${p.joined_date}`
    )
  }

  console.log(`\n=== Matches (${matches?.length ?? 0}) ===`)
  for (const m of matches ?? []) {
    const mSongs = (m.matched_songs as Array<unknown>) ?? []
    console.log(
      `  [${m.match_confidence}] ${m.display_title} — ${m.display_artist} (participants=${m.participant_count}, songs=${mSongs.length})`
    )
  }
}
