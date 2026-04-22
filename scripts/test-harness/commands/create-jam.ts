/**
 * `create-jam <persona> [--name=<name>] [--seed-from=<setlistId>] [--json]`
 *
 * Persona creates a jam session.
 *
 * - With `--seed-from=<setlistId>`: projects the named personal setlist's songs
 *   into `settings.setlistItems` (mirrors `JamSessionService.createSession`'s
 *   seedSetlistId path) and stamps `seed_setlist_id` on the row. Validates
 *   ownership: the setlist must be context_type='personal' and owned by the
 *   persona, otherwise the insert is refused before touching the DB.
 *
 * Always auto-adds the host as an active participant.
 *
 * Prints the session id + 6-char join code (or full JSON with --json).
 */

import { userClient } from '../clients'
import { findPersona } from '../config'

function randomJoinCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1
  let out = ''
  for (let i = 0; i < 6; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}

interface SeedSetlistItem {
  type?: string
  songId?: string
}

export async function runCreateJam(args: {
  name: string
  sessionName?: string
  seedFrom?: string
  json?: boolean
}): Promise<void> {
  const persona = findPersona(args.name)
  const { client, userId } = await userClient(persona)

  const sessionName =
    args.sessionName ?? `Harness jam (${new Date().toISOString().slice(0, 16)})`
  const joinCode = randomJoinCode()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  let seedSetlistId: string | null = null
  let setlistItems: Array<{
    id: string
    displayTitle: string
    displayArtist: string
  }> = []

  if (args.seedFrom) {
    // Mirror JamSessionService.createSession: ownership check first, then
    // project songs into the broadcast setlist shape (objects with display
    // data so participants/anon viewers don't need to resolve IDs against
    // the host's catalog).
    const { data: setlist, error: slErr } = await client
      .from('setlists')
      .select('id, items, context_type, context_id')
      .eq('id', args.seedFrom)
      .maybeSingle()
    if (slErr) throw new Error(`load seed setlist failed: ${slErr.message}`)
    if (!setlist) throw new Error(`Seed setlist ${args.seedFrom} not found`)
    if (setlist.context_type !== 'personal' || setlist.context_id !== userId) {
      throw new Error(
        `Setlist ${args.seedFrom} is not a personal setlist owned by ${persona.name}; refusing to seed.`
      )
    }

    const songIds: string[] = ((setlist.items ?? []) as SeedSetlistItem[])
      .filter(it => it?.type === 'song' && typeof it.songId === 'string')
      .map(it => it.songId as string)

    if (songIds.length > 0) {
      const { data: songs, error: songsErr } = await client
        .from('songs')
        .select('id, title, artist')
        .in('id', songIds)
      if (songsErr) {
        throw new Error(`load seed songs failed: ${songsErr.message}`)
      }
      const byId = new Map<
        string,
        { id: string; title: string; artist: string }
      >()
      for (const s of songs ?? []) byId.set(s.id, s)
      // Preserve setlist-author ordering (songIds order) — drop unresolved.
      setlistItems = songIds
        .map(id => byId.get(id))
        .filter((s): s is { id: string; title: string; artist: string } => !!s)
        .map(s => ({
          id: s.id,
          displayTitle: s.title,
          displayArtist: s.artist ?? '',
        }))
    }
    seedSetlistId = setlist.id
  }

  const { data: session, error: sErr } = await client
    .from('jam_sessions')
    .insert({
      name: sessionName,
      host_user_id: userId,
      short_code: joinCode,
      status: 'active',
      expires_at: expiresAt,
      seed_setlist_id: seedSetlistId,
      settings: {
        matchThreshold: 0.92,
        hostSongIds: [],
        setlistItems,
      },
    })
    .select('*')
    .single()
  if (sErr) throw new Error(`create jam failed: ${sErr.message}`)

  const { error: pErr } = await client.from('jam_participants').insert({
    jam_session_id: session.id,
    user_id: userId,
    status: 'active',
    shared_contexts: [{ type: 'personal', id: userId }],
  })
  if (pErr) throw new Error(`add host as participant failed: ${pErr.message}`)

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          id: session.id,
          joinCode: session.short_code,
          hostUserId: userId,
          seedSetlistId,
          setlistItemCount: setlistItems.length,
        },
        null,
        2
      )
    )
    return
  }

  console.log(`[create-jam] ${persona.name} created session:`)
  console.log(`  id:           ${session.id}`)
  console.log(`  name:         ${session.name}`)
  console.log(`  joinCode:     ${session.short_code}`)
  console.log(`  expires:      ${session.expires_at}`)
  if (seedSetlistId) {
    console.log(`  seedSetlist:  ${seedSetlistId}`)
    console.log(`  setlistItems: ${setlistItems.length}`)
  }
}
