/**
 * `list-songs <persona>` — print the persona's personal catalog.
 *
 * Runs as the persona, so RLS applies. Use `dump-session` for a full
 * service-role view.
 */

import { userClient } from '../clients'
import { findPersona } from '../config'

export async function runListSongs(args: { name: string }): Promise<void> {
  const persona = findPersona(args.name)
  const { client, userId } = await userClient(persona)
  const { data, error } = await client
    .from('songs')
    .select('id, title, artist, key, tempo, difficulty')
    .eq('context_type', 'personal')
    .eq('context_id', userId)
    .order('title')
  if (error) throw error
  console.log(`[list-songs] ${persona.name} (${data?.length ?? 0} songs):`)
  for (const s of data ?? []) {
    console.log(
      `  - ${s.title} — ${s.artist} [${s.key} / ${s.tempo}bpm / L${s.difficulty}]`
    )
  }
}
