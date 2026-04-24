/**
 * `join-jam <persona> <joinCode>`
 *
 * Persona joins an existing active jam session by join code. Shares
 * their personal context (matches the app's default share behaviour).
 * Re-joining an already-active participant is a no-op.
 */

import { userClient } from '../clients'
import { findPersona } from '../config'

export async function runJoinJam(args: {
  name: string
  joinCode: string
}): Promise<void> {
  const persona = findPersona(args.name)
  const { client, userId } = await userClient(persona)

  // Lookup session by join code (case-insensitive).
  const { data: session, error: sErr } = await client
    .from('jam_sessions')
    .select('id, name, status, host_user_id')
    .ilike('short_code', args.joinCode)
    .maybeSingle()
  if (sErr) throw sErr
  if (!session) throw new Error(`No session with join code ${args.joinCode}`)
  if (session.status !== 'active')
    throw new Error(`Session ${session.id} is ${session.status}, cannot join.`)

  // Upsert participant (active, shares personal catalog).
  const { data, error } = await client
    .from('jam_participants')
    .upsert(
      {
        jam_session_id: session.id,
        user_id: userId,
        status: 'active',
        shared_contexts: [{ type: 'personal', id: userId }],
      },
      { onConflict: 'jam_session_id,user_id' }
    )
    .select('id, joined_date, status')
    .single()
  if (error) throw new Error(`join failed: ${error.message}`)

  console.log(
    `[join-jam] ${persona.name} joined "${session.name}" (${session.id}) as participant ${data.id} (${data.status})`
  )
}
