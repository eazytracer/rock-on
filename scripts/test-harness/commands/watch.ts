/**
 * `watch <sessionId>` — stream realtime changes for a jam session.
 *
 * Subscribes via the Supabase Realtime channel pattern the app uses
 * and prints one line per event to stdout. Ctrl-C exits. Uses admin
 * client so nothing is filtered by RLS.
 */

import { adminClient } from '../clients'

export async function runWatch(args: { sessionId: string }): Promise<void> {
  const admin = adminClient()

  console.log(
    `[watch] subscribing to session ${args.sessionId} (Ctrl-C to exit)`
  )

  const channel = admin
    .channel(`jam-watch:${args.sessionId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'jam_sessions',
        filter: `id=eq.${args.sessionId}`,
      },
      payload => logEvent('jam_sessions', payload)
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'jam_participants',
        filter: `jam_session_id=eq.${args.sessionId}`,
      },
      payload => logEvent('jam_participants', payload)
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'jam_song_matches',
        filter: `jam_session_id=eq.${args.sessionId}`,
      },
      payload => logEvent('jam_song_matches', payload)
    )

  await new Promise<void>((resolvePromise, reject) => {
    channel.subscribe(status => {
      if (status === 'SUBSCRIBED') {
        console.log(`[watch] subscribed (status=${status})`)
      } else if (status === 'CHANNEL_ERROR') {
        reject(new Error('realtime channel error'))
      }
    })
    process.on('SIGINT', () => {
      console.log('\n[watch] closing channel...')
      void channel.unsubscribe().then(() => resolvePromise())
    })
  })
}

function logEvent(
  table: string,
  payload: { eventType: string; new?: unknown; old?: unknown }
) {
  const stamp = new Date().toISOString().slice(11, 19)
  const what = summariseEvent(table, payload)
  console.log(`[${stamp}] ${table} ${payload.eventType} ${what}`)
}

function summariseEvent(
  table: string,
  payload: { eventType: string; new?: unknown; old?: unknown }
): string {
  const rec = (payload.eventType === 'DELETE' ? payload.old : payload.new) ?? {}
  const r = rec as Record<string, unknown>
  switch (table) {
    case 'jam_sessions':
      return `status=${r.status ?? '?'} setlistItems=${
        Array.isArray((r.settings as any)?.setlistItems)
          ? (r.settings as any).setlistItems.length
          : 0
      }`
    case 'jam_participants':
      return `user=${r.user_id ?? '?'} status=${r.status ?? '?'}`
    case 'jam_song_matches':
      return `${r.display_title ?? '?'} — ${r.display_artist ?? '?'} (${r.match_confidence ?? '?'})`
    default:
      return JSON.stringify(r)
  }
}
