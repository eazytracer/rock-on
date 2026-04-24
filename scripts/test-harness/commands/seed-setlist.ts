/**
 * `seed-setlist <persona> [--name=<name>] [--count=N] [--json]`
 *
 * Inserts a personal setlist for the persona, drawing songs from that
 * persona's existing personal catalog. Mirrors what the app does when
 * a user creates a setlist via the UI:
 *
 *   - context_type='personal', context_id=<userId>
 *   - items[] is a JSONB array of { id, type:'song', position, songId }
 *   - written through the persona's JWT so the
 *     `setlists_insert_personal_own` RLS policy is exercised
 *
 * Use this to set up the "host has a personal setlist they want to
 * seed a jam from" scenario without touching the UI.
 *
 * Prints the new setlist id (or full JSON with --json).
 */

import { userClient } from '../clients'
import { findPersona } from '../config'

export async function runSeedSetlist(args: {
  name: string
  setlistName?: string
  count?: number
  json?: boolean
}): Promise<void> {
  const persona = findPersona(args.name)
  const { client, userId } = await userClient(persona)

  // Pull the persona's personal songs through their own JWT so we know
  // they're really visible to the user (and not just to service role).
  const { data: songs, error: songsErr } = await client
    .from('songs')
    .select('id, title, artist')
    .eq('context_type', 'personal')
    .eq('context_id', userId)
    .order('created_date', { ascending: true })
  if (songsErr) {
    throw new Error(`fetch personal songs failed: ${songsErr.message}`)
  }
  if (!songs || songs.length === 0) {
    throw new Error(
      `${persona.name} has no personal songs. Run: npm run harness -- seed-songs ${persona.name}`
    )
  }

  const picked = args.count ? songs.slice(0, args.count) : songs
  if (picked.length === 0) {
    throw new Error(`No songs to add (count=${args.count} produced 0).`)
  }

  const items = picked.map((s, idx) => ({
    id: crypto.randomUUID(),
    type: 'song',
    position: idx + 1,
    songId: s.id,
  }))

  const setlistName =
    args.setlistName ??
    `Harness setlist (${new Date().toISOString().slice(0, 16)})`

  const { data: setlist, error: insErr } = await client
    .from('setlists')
    .insert({
      name: setlistName,
      // band_id intentionally omitted — this is a personal setlist
      context_type: 'personal',
      context_id: userId,
      created_by: userId,
      status: 'active',
      items,
      tags: [],
      version: 1,
    })
    .select('id, name, context_type, context_id')
    .single()
  if (insErr) {
    throw new Error(`insert setlist failed: ${insErr.message}`)
  }

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          id: setlist.id,
          name: setlist.name,
          contextType: setlist.context_type,
          contextId: setlist.context_id,
          songCount: items.length,
          songs: picked.map(s => ({
            id: s.id,
            title: s.title,
            artist: s.artist,
          })),
        },
        null,
        2
      )
    )
    return
  }

  console.log(`[seed-setlist] ${persona.name} created personal setlist:`)
  console.log(`  id:      ${setlist.id}`)
  console.log(`  name:    ${setlist.name}`)
  console.log(`  songs:   ${items.length}`)
  for (const s of picked) {
    console.log(`    - ${s.title} — ${s.artist}`)
  }
}
