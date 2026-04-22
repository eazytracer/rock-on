/**
 * `recompute <sessionId> [--as=<persona>]`
 *
 * Invokes the `jam-recompute` Edge Function, which reads all
 * participants' shared catalogs server-side, runs the matching
 * algorithm, and atomically writes `jam_song_matches` rows via
 * `replace_jam_matches()`. Mirrors what the app does automatically
 * on participant changes.
 *
 * Requires the Edge Functions runtime to be running — part of
 * `npm run start:dev` (logs in /tmp/edge-functions.log).
 *
 * Defaults to acting as `alice`, but any persona who's an active
 * participant in the target session works.
 */

import { CONFIG } from '../config'
import { userClient } from '../clients'
import { findPersona } from '../config'

export async function runRecompute(args: {
  sessionId: string
  asName?: string
}): Promise<void> {
  const persona = findPersona(args.asName ?? 'alice')
  const { accessToken } = await userClient(persona)

  const url = `${CONFIG.supabaseUrl}/functions/v1/jam-recompute`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sessionId: args.sessionId }),
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(
      `recompute failed (${response.status}): ${text}\n` +
        `(Is the Edge Functions runtime running? Check /tmp/edge-functions.log.)`
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = text
  }
  console.log(
    `[recompute] session=${args.sessionId} as=${persona.name} → ${JSON.stringify(parsed)}`
  )
}
