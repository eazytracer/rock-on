/**
 * `seed-songs <persona> [--count=N | --file=path | --preset=name]`
 *
 * Inserts songs into the persona's **personal** catalog using that
 * persona's JWT — so every write goes through the real RLS-gated
 * `songs_insert_personal_own` policy.
 *
 * Source of songs, highest precedence first:
 *   --file=songs.json    array of SongFixture objects (see config.ts)
 *   --count=N            first N from the preset (default preset)
 *   --preset=name        full preset for this persona from SONG_PRESETS
 * Default: `--preset=default` fully applied.
 */

import { readFileSync } from 'node:fs'

import { userClient } from '../clients'
import { findPersona, SONG_PRESETS, SongFixture } from '../config'

export async function runSeedSongs(args: {
  name: string
  count?: number
  file?: string
  preset?: string
}): Promise<void> {
  const persona = findPersona(args.name)
  const presetName = args.preset ?? 'default'

  let source: SongFixture[]
  if (args.file) {
    source = JSON.parse(readFileSync(args.file, 'utf8'))
  } else {
    const preset = SONG_PRESETS[presetName]
    if (!preset) {
      throw new Error(
        `Unknown preset "${presetName}". Known: ${Object.keys(SONG_PRESETS).join(', ')}`
      )
    }
    const forPersona = preset[persona.name]
    if (!forPersona) {
      throw new Error(
        `Preset "${presetName}" has no entry for persona "${persona.name}". Add one in config.ts.`
      )
    }
    source = forPersona
  }

  const toInsert = args.count ? source.slice(0, args.count) : source
  if (toInsert.length === 0) {
    console.log(`[seed-songs] ${persona.name}: nothing to insert`)
    return
  }

  const { client, userId } = await userClient(persona)

  // Match seed-mvp-data.sql structure exactly — column names snake_case.
  const rows = toInsert.map(s => ({
    title: s.title,
    artist: s.artist,
    duration: s.duration,
    key: s.key,
    tempo: s.tempo,
    difficulty: s.difficulty,
    guitar_tuning: s.guitarTuning,
    context_type: 'personal' as const,
    context_id: userId, // stored as TEXT in schema
    created_by: userId,
    visibility: 'personal' as const,
    notes: s.notes ?? null,
    version: 1,
    created_date: new Date().toISOString(),
  }))

  const { data, error } = await client
    .from('songs')
    .insert(rows)
    .select('id, title, artist')
  if (error) {
    throw new Error(
      `Insert failed for ${persona.name}: ${error.message}\n` +
        `(If this is an RLS error, confirm persona signed in correctly.)`
    )
  }
  console.log(
    `[seed-songs] ${persona.name}: inserted ${data?.length ?? 0} songs:`
  )
  for (const r of data ?? []) {
    console.log(`  - ${r.title} — ${r.artist} (${r.id})`)
  }
}
