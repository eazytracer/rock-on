import { useState, useEffect, useCallback, useRef } from 'react'
import { SyncRepository } from '../services/data/SyncRepository'
import type { SyncStatus as SyncEngineStatus } from '../services/data/syncTypes'

/**
 * Sync status information exposed by the hook
 */
export interface SyncStatus {
  isOnline: boolean
  isSupabaseConnected: boolean // NEW: actual Supabase connectivity
  isSyncing: boolean
  pendingCount: number
  lastSyncTime: Date | null
  syncError: string | null
}

/**
 * Return type for useSyncStatus hook
 */
export interface UseSyncStatusReturn extends SyncStatus {
  sync: () => Promise<void>
}

/**
 * React hook that provides real-time sync status information
 *
 * Features:
 * - Subscribes to sync engine status changes
 * - Tracks online/offline status
 * - Shows pending sync queue count
 * - Shows last successful sync time
 * - Shows sync errors
 * - Provides manual sync trigger
 *
 * @example
 * ```tsx
 * function SyncIndicator() {
 *   const { isOnline, isSyncing, pendingCount, sync } = useSyncStatus()
 *
 *   return (
 *     <div>
 *       <span>{isOnline ? 'Online' : 'Offline'}</span>
 *       {isSyncing && <Spinner />}
 *       {pendingCount > 0 && <span>{pendingCount} pending</span>}
 *       <button onClick={sync}>Sync Now</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useSyncStatus(): UseSyncStatusReturn {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isSupabaseConnected: true, // Assume connected initially
    isSyncing: false,
    pendingCount: 0,
    lastSyncTime: null,
    syncError: null,
  })
  const supabaseCheckInterval = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const repo = SyncRepository.getInstance()

    // Check Supabase connectivity
    const checkSupabaseConnection = async () => {
      try {
        // Dynamic import to avoid circular dependencies
        const { getSupabaseClient } = await import(
          '../services/supabase/client'
        )
        const supabase = getSupabaseClient()

        if (!supabase) {
          setStatus(prev => ({ ...prev, isSupabaseConnected: false }))
          return
        }

        // Quick health check - try to get auth session
        const { error } = await supabase.auth.getSession()

        setStatus(prev => {
          const isConnected = !error
          if (prev.isSupabaseConnected === isConnected) {
            return prev // No change
          }
          return { ...prev, isSupabaseConnected: isConnected }
        })
      } catch {
        setStatus(prev => ({ ...prev, isSupabaseConnected: false }))
      }
    }

    // Initial check
    checkSupabaseConnection()

    // Check periodically (every 30 seconds) when online
    supabaseCheckInterval.current = setInterval(() => {
      if (navigator.onLine) {
        checkSupabaseConnection()
      }
    }, 30000)

    // Subscribe to sync engine status changes
    const unsubscribe = repo.onSyncStatusChange(
      (engineStatus: SyncEngineStatus) => {
        setStatus(prevStatus => {
          // Only update if values have actually changed to prevent unnecessary re-renders
          const newLastSyncTime = engineStatus.lastSyncTime || null
          const hasChanged =
            prevStatus.isSyncing !== engineStatus.isSyncing ||
            prevStatus.pendingCount !== engineStatus.pendingCount ||
            prevStatus.lastSyncTime?.getTime() !== newLastSyncTime?.getTime()

          if (!hasChanged) {
            return prevStatus // Return same reference to prevent re-render
          }

          // If sync succeeded, mark Supabase as connected
          const isSupabaseConnected =
            engineStatus.isSyncing || !engineStatus.lastError
              ? true
              : prevStatus.isSupabaseConnected

          return {
            ...prevStatus,
            isSyncing: engineStatus.isSyncing,
            pendingCount: engineStatus.pendingCount,
            lastSyncTime: newLastSyncTime,
            isSupabaseConnected,
          }
        })
      }
    )

    // Handle online/offline events
    const handleOnline = () => {
      setStatus(prevStatus => {
        if (prevStatus.isOnline) {
          return prevStatus // Already online, don't re-render
        }
        return {
          ...prevStatus,
          isOnline: true,
        }
      })
    }

    const handleOffline = () => {
      setStatus(prevStatus => {
        if (!prevStatus.isOnline) {
          return prevStatus // Already offline, don't re-render
        }
        return {
          ...prevStatus,
          isOnline: false,
        }
      })
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Cleanup on unmount
    return () => {
      unsubscribe()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (supabaseCheckInterval.current) {
        clearInterval(supabaseCheckInterval.current)
      }
    }
  }, [])

  // Manual sync trigger
  const sync = useCallback(async () => {
    try {
      const repo = SyncRepository.getInstance()
      await repo.syncAll()

      // Clear any previous errors on successful sync
      setStatus(prevStatus => ({
        ...prevStatus,
        syncError: null,
      }))
    } catch (error) {
      // Set error message
      setStatus(prevStatus => ({
        ...prevStatus,
        syncError:
          error instanceof Error ? error.message : 'Unknown sync error',
      }))

      // Re-throw so calling code can handle if needed
      throw error
    }
  }, [])

  return {
    ...status,
    sync,
  }
}
