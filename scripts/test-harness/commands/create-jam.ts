/**
 * `create-jam <persona> [--name=<name>] [--json]`
 *
 * Persona creates a jam session using the same RPC the app uses.
 * Also auto-adds the host as an active participant (matching the
 * app's JamSessionService.create flow).
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

export async function runCreateJam(args: {
  name: string
  sessionName?: string
  json?: boolean
}): Promise<void> {
  const persona = findPersona(args.name)
  const { client, userId } = await userClient(persona)

  const sessionName =
    args.sessionName ?? `Harness jam (${new Date().toISOString().slice(0, 16)})`
  const joinCode = randomJoinCode()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const { data: session, error: sErr } = await client
    .from('jam_sessions')
    .insert({
      name: sessionName,
      host_user_id: userId,
      short_code: joinCode,
      status: 'active',
      expires_at: expiresAt,
      settings: { matchThreshold: 0.92, hostSongIds: [], setlistItems: [] },
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
        { id: session.id, joinCode: session.short_code, hostUserId: userId },
        null,
        2
      )
    )
    return
  }

  console.log(`[create-jam] ${persona.name} created session:`)
  console.log(`  id:       ${session.id}`)
  console.log(`  name:     ${session.name}`)
  console.log(`  joinCode: ${session.short_code}`)
  console.log(`  expires:  ${session.expires_at}`)
}
