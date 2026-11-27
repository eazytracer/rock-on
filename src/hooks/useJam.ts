/**
 * Jam hooks (Phase 7), shared by every jam screen: the hub, the planned jam,
 * the host console, the web guest, the bar TV and the counter iPad.
 *
 * Freshness: each screen listens to the realtime broadcast topic
 * `jam:<short_code>` (the migration's triggers send `changed` once per
 * transaction; `askTheRoom` sends `nudge`) and refetches, debounced, with a
 * 20 s poll as the fallback. Tokens: a web guest's token lives in localStorage
 * (`rockon.jam.<CODE>`), the kiosk's in sessionStorage (`rockon.kiosk`); never
 * in a URL.
 */
import { useEffect, useRef } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query'
import { getSupabaseClient } from '../services/supabase/client'
import { queryKeys } from '../services/queryClient'
import { useAuth } from '../contexts/AuthContext'
import * as jams from '../services/api/jams'
import type { JamState, Part, PartKey } from '../services/api/jams'

const POLL_MS = 20_000
const DEBOUNCE_MS = 250

/** Codes are stored and compared without the hyphen, upper case. */
export const normalizeCode = (code: string) =>
  code.replace(/[^a-z0-9]/gi, '').toUpperCase()

/** `ABCDEFGH` → `ABCD-EFGH` for display. */
export const formatCode = (code: string) => {
  const c = normalizeCode(code)
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c
}

// ── Tokens ────────────────────────────────────────────────────────────────────
const guestKey = (code: string) => `rockon.jam.${normalizeCode(code)}`
const KIOSK_KEY = 'rockon.kiosk'

const safe = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn()
  } catch {
    return fallback
  }
}

export const guestToken = {
  get: (code: string) =>
    safe(() => localStorage.getItem(guestKey(code)), null as string | null),
  set: (code: string, token: string) =>
    safe(() => localStorage.setItem(guestKey(code), token), undefined),
  clear: (code: string) =>
    safe(() => localStorage.removeItem(guestKey(code)), undefined),
}

export interface KioskSession {
  eventId: string
  code: string
  token: string
}
export const kioskSession = {
  get: (): KioskSession | null =>
    safe(() => {
      const raw = sessionStorage.getItem(KIOSK_KEY)
      return raw ? (JSON.parse(raw) as KioskSession) : null
    }, null),
  set: (s: KioskSession) =>
    safe(() => sessionStorage.setItem(KIOSK_KEY, JSON.stringify(s)), undefined),
  clear: () => safe(() => sessionStorage.removeItem(KIOSK_KEY), undefined),
}

// ── Live updates ──────────────────────────────────────────────────────────────
/** askTheRoom's broadcast: the song, the part it needs, the song's title. */
export interface JamNudge {
  item_id: string
  part: Part
  title: string
}

type ChannelHandlers = {
  onChanged?: () => void
  onNudge?: (payload: JamNudge) => void
}

// One channel per topic, shared: supabase-js hands back the same channel for
// the same topic, which can only be subscribed once and is removed for all.
const channels = new Map<
  string,
  { remove: () => void; listeners: Set<{ current: ChannelHandlers }> }
>()

/**
 * Subscribe to `jam:<code>`. `onChanged` is debounced; `onNudge` gets the
 * askTheRoom payload. Pass `null` to stay unsubscribed. Several screens on
 * one page (the planned jam and its Tonight view) share one channel.
 */
export function useJamChannel(
  code: string | null | undefined,
  handlers: ChannelHandlers
) {
  const ref = useRef(handlers)
  ref.current = handlers
  useEffect(() => {
    if (!code) return
    const topic = `jam:${normalizeCode(code)}`
    let entry = channels.get(topic)
    if (!entry) {
      const supabase = getSupabaseClient()
      const listeners = new Set<{ current: ChannelHandlers }>()
      let timer: ReturnType<typeof setTimeout> | undefined
      const channel = supabase
        .channel(topic)
        .on('broadcast', { event: 'changed' }, () => {
          clearTimeout(timer)
          timer = setTimeout(
            () => listeners.forEach(l => l.current.onChanged?.()),
            DEBOUNCE_MS
          )
        })
        .on('broadcast', { event: 'nudge' }, ({ payload }) =>
          listeners.forEach(l => l.current.onNudge?.(payload as JamNudge))
        )
        .subscribe()
      entry = {
        listeners,
        remove: () => {
          clearTimeout(timer)
          void supabase.removeChannel(channel)
        },
      }
      channels.set(topic, entry)
    }
    const current = entry
    current.listeners.add(ref)
    return () => {
      current.listeners.delete(ref)
      if (current.listeners.size === 0) {
        current.remove()
        channels.delete(topic)
      }
    }
  }, [code])
}

// ── Reads ─────────────────────────────────────────────────────────────────────
/** The hub: hosting / invited / friends' jams. */
export function useMyJams() {
  const userId = useAuth().user?.id ?? ''
  return useQuery({
    queryKey: queryKeys.jams.mine(userId),
    queryFn: () => jams.listMyJams(),
    enabled: !!userId,
    refetchInterval: POLL_MS,
  })
}

/** The viewer key for jam_state's cache entry. */
function useViewer(token?: string | null, kiosk?: boolean) {
  const userId = useAuth().user?.id ?? ''
  if (token) return kiosk ? 'kiosk' : 'guest'
  return userId
}

/**
 * jam_state for one jam, live. Signed-in callers omit `token`; a web guest or
 * the kiosk passes theirs.
 */
export function useJamState(
  eventId: string | null | undefined,
  opts: {
    token?: string | null
    kiosk?: boolean
    onNudge?: (payload: JamNudge) => void
  } = {}
) {
  const qc = useQueryClient()
  const viewer = useViewer(opts.token, opts.kiosk)
  const key = queryKeys.jams.state(eventId ?? '', viewer)
  const query = useQuery({
    queryKey: key,
    queryFn: () => jams.jamState(eventId!, opts.token ?? undefined),
    enabled: !!eventId && !!viewer,
    refetchInterval: POLL_MS,
  })
  useJamChannel(query.data?.jam.short_code, {
    onChanged: () => void qc.invalidateQueries({ queryKey: key }),
    onNudge: opts.onNudge,
  })
  return query
}

/** The bar TV feed, by code (anon). */
export function useJamTvFeed(code: string | null | undefined) {
  const qc = useQueryClient()
  const key = queryKeys.jams.tv(normalizeCode(code ?? ''))
  const query = useQuery({
    queryKey: key,
    queryFn: () => jams.jamTvFeed(normalizeCode(code!)),
    enabled: !!code,
    refetchInterval: POLL_MS,
  })
  useJamChannel(code, {
    onChanged: () => void qc.invalidateQueries({ queryKey: key }),
  })
  return query
}

export function useJamPreview(code: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.jams.preview(normalizeCode(code ?? '')),
    queryFn: () => jams.jamPreviewByCode(normalizeCode(code!)),
    enabled: !!code,
    retry: false,
    // Each fetch counts toward the per-IP code limit (a whole bar can share
    // one IP): no refetch on focus; screens refetch when they need to.
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
}

export function useWhoKnowsYourSongs(
  eventId: string | null | undefined,
  otherId?: string
) {
  return useQuery({
    queryKey: queryKeys.jams.overlap(eventId ?? '', otherId),
    queryFn: () => jams.whoKnowsYourSongs(eventId!, otherId),
    enabled: !!eventId,
  })
}

// ── Writes ────────────────────────────────────────────────────────────────────
/**
 * Any jam write. Refetches every jam read when it settles (the broadcast
 * refreshes other screens; this one shouldn't wait for it).
 *
 *   const raise = useJamAction((id: string) => jams.raiseHand(id, ['guitar']))
 */
export function useJamAction<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  extraKeys: QueryKey[] = []
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['jams'] })
      extraKeys.forEach(k => void qc.invalidateQueries({ queryKey: k }))
    },
  })
}

// ── Display helpers ───────────────────────────────────────────────────────────
export const PART_LABEL: Record<PartKey, string> = {
  vox: 'Vocals',
  guitar: 'Guitar',
  bass: 'Bass',
  drums: 'Drums',
  keys: 'Keys',
  other: 'Other',
}

/** "Guitar", "Guitar 2", "Harmonica". `nth` is 1-based. */
export const partName = (
  part: { key: PartKey; label?: string | null },
  nth = 1
) => `${part.label || PART_LABEL[part.key]}${nth > 1 ? ` ${nth}` : ''}`

export type JamItem = JamState['items'][number]
export type JamPerson = JamState['people'][number]
