/**
 * The live night's shared helpers: reading jam_state for the console and
 * Tonight, and one action runner (toast on failure, optional Undo, optional
 * optimistic patch of the cached jam_state).
 */
import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../../contexts/AuthContext'
import { useToast } from '../../../contexts/ToastContext'
import { queryKeys } from '../../../services/queryClient'
import { errorText } from '../../../services/api/errors'
import { useJamAction, partName, type JamItem } from '../../../hooks/useJam'
import type {
  JamItemRow,
  JamState,
  Part,
  PartKey,
} from '../../../services/api/jams'
import { createLogger } from '../../../utils/logger'

const log = createLogger('JamLive')

export type Slot = JamItem['slots'][number]
export type Hand = JamItem['hands'][number]

/** A slot or a hand as a Part (key + label when there is one). */
export const asPart = (p: { key: PartKey; label?: string | null }): Part =>
  p.label ? { key: p.key, label: p.label } : { key: p.key }

/** Same part: key + lower(label), as the server compares them. */
export const samePart = (
  a: { key: PartKey; label?: string | null },
  b: { key: PartKey; label?: string | null }
) =>
  a.key === b.key &&
  (a.label ?? '').toLowerCase() === (b.label ?? '').toLowerCase()

/** "Guitar 2" for a slot (nth only when the song has more than one). */
export const slotName = (item: JamItem, slot: Slot) => {
  const many = item.slots.filter(s => samePart(s, slot)).length > 1
  return partName(slot, many ? slot.nth : 1)
}

/** Open parts, once each ("Bass", "Drums"). */
export const gapParts = (item: JamItem): Part[] => {
  const out: Part[] = []
  item.slots
    .filter(s => s.gap)
    .forEach(s => {
      if (!out.some(p => samePart(p, s))) out.push(asPart(s))
    })
  return out
}

export const byId = (state: JamState) => {
  const m = new Map<string, JamItem>()
  state.items.forEach(i => m.set(i.id, i))
  return m
}

/** "called 12 min ago" */
export const ago = (iso: string | null, now = Date.now()) => {
  if (!iso) return ''
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000))
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.floor(min / 60)
  return `${h} h ${min % 60} min ago`
}

/** "needs bass, drums" / "ready" */
export const needsLine = (item: JamItem) => {
  const g = gapParts(item)
  return g.length
    ? `needs ${g.map(p => partName(p).toLowerCase()).join(', ')}`
    : 'ready'
}

/** Who's on what: "Eric · Mike · Sarah". */
export const castLine = (item: JamItem) =>
  item.slots
    .filter(s => s.cast)
    .map(s => s.cast!.name.split(' ')[0])
    .join(' · ')

export const firstName = (name: string) => name.split(' ')[0]

const STANDARD: PartKey[] = ['vox', 'guitar', 'bass', 'drums', 'keys']

/** Vocals … Keys, then the jam's custom parts. */
export const partOptions = (state: JamState): Part[] => {
  const out: Part[] = STANDARD.map(key => ({ key }))
  state.jam.default_parts.forEach(p => {
    if (!out.some(o => samePart(o, p))) out.push(p)
  })
  return out
}

/** A pitch's toast: waiting for approval, or straight onto the list. */
export const pitchToast = (state: JamState) => (r: JamItemRow) =>
  r.state === 'pending'
    ? `Sent to ${state.jam.host_name || 'the host'}`
    : `${r.display_title} is on the list`

/** Queue edits applied to the cached state before the server answers. */
export const patches = {
  move:
    (id: string, to: number) =>
    (s: JamState): JamState => {
      const q = s.queue.filter(x => x !== id)
      q.splice(Math.max(0, Math.min(q.length, to)), 0, id)
      return { ...s, queue: q, up_next: q[0] ?? null }
    },
  leaveQueue:
    (id: string, state: JamState['items'][number]['state']) =>
    (s: JamState): JamState => {
      const q = s.queue.filter(x => x !== id)
      return {
        ...s,
        queue: q,
        up_next: q[0] ?? null,
        stage: s.stage === id ? null : s.stage,
        items: s.items.map(i => (i.id === id ? { ...i, state } : i)),
      }
    },
  callUp:
    (id: string) =>
    (s: JamState): JamState => {
      const q = s.queue.filter(x => x !== id)
      return {
        ...s,
        queue: q,
        up_next: q[0] ?? null,
        stage: id,
        items: s.items.map(i =>
          i.id === id
            ? { ...i, state: 'stage', called_at: new Date().toISOString() }
            : i.id === s.stage
              ? { ...i, state: 'played' }
              : i
        ),
      }
    },
}

export interface RunOptions<T> {
  /** Optimistic change to the cached jam_state. */
  patch?: (s: JamState) => JamState
  /** Toast on success; with `undo`, the toast carries an Undo button. */
  ok?: string | ((result: T) => string)
  undo?: (result: T) => Promise<unknown>
}

/**
 * Runs jam writes for one jam. Every jam read refetches when a write settles
 * (useJamAction); the broadcast refreshes everyone else.
 */
export function useLiveRunner(eventId: string) {
  const qc = useQueryClient()
  const { showToast } = useToast()
  const userId = useAuth().user?.id ?? ''
  const action = useJamAction((f: () => Promise<unknown>) => f())
  const { mutateAsync } = action
  const key = queryKeys.jams.state(eventId, userId)

  const run = useCallback(
    async <T>(fn: () => Promise<T>, opts: RunOptions<T> = {}) => {
      if (opts.patch) {
        await qc.cancelQueries({ queryKey: key })
        const cur = qc.getQueryData<JamState>(key)
        if (cur) qc.setQueryData(key, opts.patch(cur))
      }
      try {
        const result = (await mutateAsync(fn)) as T
        const msg = typeof opts.ok === 'function' ? opts.ok(result) : opts.ok
        if (msg) {
          const undo = opts.undo
          showToast(msg, 'success', {
            action: undo
              ? {
                  label: 'Undo',
                  onClick: () =>
                    void mutateAsync(() => undo(result)).catch(err => {
                      log.error('Undo failed', err)
                      showToast(errorText(err), 'error')
                    }),
                }
              : undefined,
          })
        }
        return result
      } catch (err) {
        log.error('Jam action failed', err)
        showToast(errorText(err), 'error')
        return undefined
      }
    },
    // key is derived from eventId + userId
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qc, mutateAsync, showToast, eventId, userId]
  )

  return { run, pending: action.isPending }
}
