import { useEffect, useCallback, useRef, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'

/**
 * Event types emitted by RealtimeManager
 */
export type SyncEventType =
  | 'songs:changed'
  | 'setlists:changed'
  | 'shows:changed'
  | 'practices:changed'

interface SyncEvent {
  bandId?: string
  recordId?: string
  action?: 'INSERT' | 'UPDATE' | 'DELETE'
  userId?: string
}

interface UseRealtimeSyncOptions {
  /** Events to subscribe to */
  events: SyncEventType[]
  /** Callback when sync event received */
  onSync: () => void | Promise<void>
  /** Only trigger if event matches this band ID */
  bandId?: string
  /** Only trigger if event matches this record ID */
  recordId?: string
  /** Debounce rapid events (ms). Default: 100 */
  debounce?: number
  /** Enable debug logging */
  debug?: boolean
  /** Skip events from current user (prevents race conditions). Default: true */
  skipOwnChanges?: boolean
}

/**
 * Hook to subscribe to RealtimeManager sync events.
 *
 * Provides a consistent pattern for pages that need to react to real-time
 * data changes from other users/devices.
 *
 * @example
 * ```tsx
 * // In a practice view page:
 * useRealtimeSync({
 *   events: ['songs:changed', 'practices:changed'],
 *   bandId: currentBandId,
 *   recordId: practiceId,
 *   onSync: () => {
 *     loadPracticeData()
 *   }
 * })
 * ```
 */
export function useRealtimeSync(options: UseRealtimeSyncOptions) {
  const { realtimeManager, user } = useAuth()
  const {
    events,
    onSync,
    bandId,
    recordId,
    debounce = 100,
    debug = false,
    skipOwnChanges = true,
  } = options

  const currentUserId = user?.id

  // Create a stable key for events array to avoid unnecessary effect re-runs
  // This prevents the effect from re-running when a new array with same values is passed
  const eventsKey = useMemo(() => JSON.stringify(events), [events])

  // Store events in a ref so we can access current values without triggering effect
  const eventsRef = useRef(events)
  eventsRef.current = events

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onSyncRef = useRef(onSync)
  const pendingSyncRef = useRef(false)

  // Keep onSync ref updated to avoid stale closures
  useEffect(() => {
    onSyncRef.current = onSync
  }, [onSync])

  const debouncedSync = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    pendingSyncRef.current = true
    timeoutRef.current = setTimeout(() => {
      if (debug) {
        console.log('[useRealtimeSync] Executing sync callback')
      }
      pendingSyncRef.current = false
      onSyncRef.current()
    }, debounce)
  }, [debounce, debug])

  useEffect(() => {
    if (!realtimeManager) {
      if (debug) {
        console.log('[useRealtimeSync] No realtimeManager available')
      }
      return
    }

    const handleChange = (event: SyncEvent) => {
      // Skip own changes to prevent race conditions
      // When a user saves data, their own change triggers an audit log event
      // Without this filter, the refetch would race with the local save
      if (skipOwnChanges && currentUserId && event.userId === currentUserId) {
        if (debug) {
          console.log(
            `[useRealtimeSync] Skipping own change - userId: ${event.userId}`
          )
        }
        return
      }

      // Filter by bandId if specified
      if (bandId && event.bandId && event.bandId !== bandId) {
        if (debug) {
          console.log(
            `[useRealtimeSync] Skipping event - bandId mismatch: ${event.bandId} !== ${bandId}`
          )
        }
        return
      }

      // Filter by recordId if specified
      if (recordId && event.recordId && event.recordId !== recordId) {
        if (debug) {
          console.log(
            `[useRealtimeSync] Skipping event - recordId mismatch: ${event.recordId} !== ${recordId}`
          )
        }
        return
      }

      if (debug) {
        console.log('[useRealtimeSync] Received matching event:', event)
      }

      debouncedSync()
    }

    // Use ref to get current events (stable reference)
    const currentEvents = eventsRef.current

    // Subscribe to all specified events
    if (debug) {
      console.log('[useRealtimeSync] Subscribing to events:', currentEvents)
    }

    currentEvents.forEach(eventType => {
      realtimeManager.on(eventType, handleChange)
    })

    return () => {
      // If there's a pending sync, execute it immediately before cleanup
      // This prevents losing sync events when effect re-runs
      if (pendingSyncRef.current && timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
        pendingSyncRef.current = false
        if (debug) {
          console.log('[useRealtimeSync] Executing pending sync on cleanup')
        }
        onSyncRef.current()
      }
      currentEvents.forEach(eventType => {
        realtimeManager.off(eventType, handleChange)
      })
      if (debug) {
        console.log(
          '[useRealtimeSync] Unsubscribed from events:',
          currentEvents
        )
      }
    }
    // Use eventsKey instead of events to prevent re-running when array reference changes
  }, [
    realtimeManager,
    eventsKey,
    bandId,
    recordId,
    debouncedSync,
    debug,
    skipOwnChanges,
    currentUserId,
  ])
}
