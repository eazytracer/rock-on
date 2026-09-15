import { useEffect, useRef } from 'react'
import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'

/**
 * Event types emitted by RealtimeManager (change notifications only — the
 * manager no longer writes a local cache; it just tells us something changed).
 */
export type RealtimeChangeEvent =
  | 'songs:changed'
  | 'setlists:changed'
  | 'shows:changed'
  | 'practices:changed'

interface RealtimeEventPayload {
  bandId?: string
  recordId?: string
  action?: 'INSERT' | 'UPDATE' | 'DELETE'
  userId?: string
}

interface UseRealtimeInvalidateOptions {
  /** RealtimeManager events to listen for. */
  events: RealtimeChangeEvent[]
  /**
   * Query key to invalidate when a matching event arrives. Optional: pages not
   * yet backed by a TanStack query pass `onChange` instead (transitional — see
   * Phase 2 Section C, which migrates those pages to real queries and drops the
   * callback).
   */
  queryKey?: QueryKey
  /**
   * Called on a matching event instead of/in addition to invalidation. Used by
   * pages that still load their own state via a manual refetch function.
   */
  onChange?: () => void | Promise<void>
  /** Only react to events for this band (omit to react to all). */
  bandId?: string
  /** Skip events caused by the current user's own writes. Default true. */
  skipOwnChanges?: boolean
  /** Debounce rapid events (ms). Default 100. */
  debounce?: number
}

/**
 * Bridge RealtimeManager change events to TanStack Query cache invalidation.
 *
 * Replaces the old `useRealtimeSync` (which manually refetched) and the
 * `onSyncStatusChange` refetch path. On a matching event we invalidate the
 * given query key; TanStack Query then refetches the active query from Supabase
 * (the single source of truth). Own-changes are skipped by default because the
 * user's optimistic mutation already reflects locally, and its onSettled
 * invalidation reconciles with the server.
 */
export function useRealtimeInvalidate({
  events,
  queryKey,
  onChange,
  bandId,
  skipOwnChanges = true,
  debounce = 100,
}: UseRealtimeInvalidateOptions) {
  const { realtimeManager, user } = useAuth()
  const queryClient = useQueryClient()
  const currentUserId = user?.id

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Stable key string so the effect doesn't re-run on new array/key identities.
  const queryKeyString = JSON.stringify(queryKey ?? null)
  const eventsString = JSON.stringify(events)

  // Keep the callback in a ref so a new inline function identity each render
  // doesn't re-subscribe the effect.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!realtimeManager) return

    const handleChange = (event: RealtimeEventPayload) => {
      if (skipOwnChanges && currentUserId && event.userId === currentUserId) {
        return
      }
      if (bandId && event.bandId && event.bandId !== bandId) {
        return
      }
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        if (queryKey) queryClient.invalidateQueries({ queryKey })
        onChangeRef.current?.()
      }, debounce)
    }

    const currentEvents = JSON.parse(eventsString) as RealtimeChangeEvent[]
    currentEvents.forEach(eventType => {
      realtimeManager.on(eventType, handleChange)
    })

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      currentEvents.forEach(eventType => {
        realtimeManager.off(eventType, handleChange)
      })
    }
    // queryKey/events are captured via their stable string forms.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    realtimeManager,
    queryClient,
    bandId,
    skipOwnChanges,
    debounce,
    currentUserId,
    queryKeyString,
    eventsString,
  ])
}
