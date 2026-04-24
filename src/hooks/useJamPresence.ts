/**
 * useJamPresence — anonymous-viewer presence tracking for a jam session.
 *
 * Supabase Realtime Presence is exactly the shape we want for "who's
 * watching right now":
 *
 *   - Ephemeral — state is tied to the socket. Close the tab, you're
 *     gone. No DB rows to clean up, no cron needed.
 *   - Anon-safe — presence channels are not RLS-filtered, so an
 *     unauthenticated client with the public anon key can join.
 *   - Works symmetrically — the host's authenticated page and each
 *     anon viewer connect to the same channel and see the same list.
 *
 * Channel key is `jam:presence:<shortCode>`. The shortCode is already
 * exposed to anyone with the jam link, so using it as the channel name
 * doesn't leak any additional information — and it's the only
 * identifier both sides (anon viewer + authenticated host) have in
 * common without a server round-trip.
 *
 * The hook has two modes:
 *
 *   - **Watcher mode** (`selfName` provided): tracks this client as a
 *     presence entry AND receives updates. Used by `JamViewPage`.
 *   - **Listener mode** (`selfName` omitted): subscribes but does not
 *     track itself. Used by `JamSessionPage` so the host's entry
 *     doesn't pollute the watcher list (the host is already in
 *     `jam_participants`).
 */
import { useEffect, useRef, useState } from 'react'
import { getSupabaseClient } from '../services/supabase/client'
import { createLogger } from '../utils/logger'

const log = createLogger('useJamPresence')

export interface JamWatcher {
  /** Unique per-tab presence key (random UUID regenerated per tab). */
  key: string
  /** User-chosen display name. May be empty for "lurker" entries. */
  name: string
  /** ms-since-epoch of when the client first tracked presence. */
  joinedAt: number
}

interface UseJamPresenceOptions {
  /** The jam session's short code. Hook is a no-op until this is set. */
  shortCode: string | undefined
  /**
   * If provided, the hook will track this client as a watcher with the
   * given name. If omitted, the hook only listens (host mode). The
   * empty string is treated as "lurking" and still tracked so the host
   * sees the viewer count, just without a name.
   */
  selfName?: string
  /**
   * Master switch for the whole effect. Useful for gating on "the host
   * has entered a session" or "the anon viewer has picked a name yet."
   */
  enabled: boolean
}

/** One entry per tab (stable across renders). */
function ensureSelfKey(): string {
  if (typeof window === 'undefined') return 'ssr'
  const existing = window.sessionStorage.getItem('rockon:jam:presenceKey')
  if (existing) return existing
  const fresh = crypto.randomUUID()
  try {
    window.sessionStorage.setItem('rockon:jam:presenceKey', fresh)
  } catch {
    /* session storage blocked; fall back to per-mount key */
  }
  return fresh
}

export function useJamPresence({
  shortCode,
  selfName,
  enabled,
}: UseJamPresenceOptions): { watchers: JamWatcher[] } {
  const [watchers, setWatchers] = useState<JamWatcher[]>([])
  // Stable per-tab key so our own presence entry doesn't duplicate on
  // re-renders. sessionStorage (not localStorage) so multiple tabs on
  // the same device get their own keys and all show up in the host's
  // list.
  const selfKeyRef = useRef<string>(ensureSelfKey())

  useEffect(() => {
    if (!enabled || !shortCode) return

    let supabase
    try {
      supabase = getSupabaseClient()
    } catch (err) {
      // Offline / dev-without-Supabase — skip silently. The host UI
      // renders the empty list and anon viewers simply won't advertise
      // themselves. The feature is additive, not critical.
      log.debug('presence disabled — no supabase client', {
        err: (err as Error).message,
      })
      return
    }

    const channelName = `jam:presence:${shortCode}`
    const channel = supabase.channel(channelName, {
      config: { presence: { key: selfKeyRef.current } },
    })

    const refreshFromPresenceState = () => {
      // Supabase shapes presenceState as Record<key, payload[]>. One
      // key can have multiple payloads (rare — happens if a single
      // client tracks more than once). We flatten and dedupe by key,
      // keeping the most recent payload per key.
      const state = channel.presenceState() as Record<
        string,
        Array<{ name?: string; joinedAt?: number }>
      >
      const flat: JamWatcher[] = []
      for (const [key, payloads] of Object.entries(state)) {
        if (!payloads || payloads.length === 0) continue
        const latest = payloads[payloads.length - 1]
        flat.push({
          key,
          name: typeof latest.name === 'string' ? latest.name : '',
          joinedAt:
            typeof latest.joinedAt === 'number' ? latest.joinedAt : Date.now(),
        })
      }
      // Stable ordering — oldest first so new watchers appear at the
      // bottom. Secondary sort on key for deterministic tests.
      flat.sort((a, b) => a.joinedAt - b.joinedAt || a.key.localeCompare(b.key))
      setWatchers(flat)
    }

    channel
      .on('presence', { event: 'sync' }, refreshFromPresenceState)
      .on('presence', { event: 'join' }, refreshFromPresenceState)
      .on('presence', { event: 'leave' }, refreshFromPresenceState)
      .subscribe(async status => {
        if (status !== 'SUBSCRIBED') {
          log.debug('presence subscribe status', { status, shortCode })
          return
        }
        // Only track ourselves if the caller provided a name (watcher
        // mode). Host / listener mode omits selfName and so never
        // shows up in its own watcher list.
        if (selfName !== undefined) {
          await channel.track({
            name: selfName,
            joinedAt: Date.now(),
          })
          log.debug('tracked self', { selfName, channelName })
        }
      })

    return () => {
      // untrack is implicit on removeChannel, but being explicit keeps
      // the intent legible when reading.
      void channel.untrack()
      void supabase.removeChannel(channel)
    }
    // selfName is a dep so a name change re-tracks with the new value.
  }, [shortCode, selfName, enabled])

  return { watchers }
}
