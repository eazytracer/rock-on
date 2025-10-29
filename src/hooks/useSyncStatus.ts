import { useState, useEffect, useCallback } from 'react'
import { SyncRepository } from '../services/data/SyncRepository'
import type { SyncStatus as SyncEngineStatus } from '../services/data/syncTypes'

/**
 * Sync status information exposed by the hook
 */
export interface SyncStatus {
  isOnline: boolean
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
    isSyncing: false,
    pendingCount: 0,
    lastSyncTime: null,
    syncError: null,
  })

  useEffect(() => {
    const repo = SyncRepository.getInstance()

    // Subscribe to sync engine status changes
    const unsubscribe = repo.onSyncStatusChange((engineStatus: SyncEngineStatus) => {
      setStatus(prevStatus => ({
        ...prevStatus,
        isSyncing: engineStatus.isSyncing,
        pendingCount: engineStatus.pendingCount,
        lastSyncTime: engineStatus.lastSyncTime || null,
      }))
    })

    // Handle online/offline events
    const handleOnline = () => {
      setStatus(prevStatus => ({
        ...prevStatus,
        isOnline: true,
      }))
    }

    const handleOffline = () => {
      setStatus(prevStatus => ({
        ...prevStatus,
        isOnline: false,
      }))
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Cleanup on unmount
    return () => {
      unsubscribe()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
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
        syncError: error instanceof Error ? error.message : 'Unknown sync error',
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
