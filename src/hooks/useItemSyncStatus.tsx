/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react'
import type { SyncStatus } from '../components/sync/SyncIcon'
import { db } from '../services/database'
import { getSyncRepository } from '../services/data/SyncRepository'
import { createLogger } from '../utils/logger'

const log = createLogger('useItemStatus')

/**
 * Per-item sync status store
 * Tracks the sync status of individual items (songs, setlists, shows, etc.)
 *
 * Note: This context provides manual overrides for sync status.
 * The useItemStatus hook queries the actual syncQueue for accurate status.
 */
interface ItemSyncStatusContextType {
  getStatus: (itemId: string) => SyncStatus | undefined
  setStatus: (itemId: string, status: SyncStatus) => void
  clearStatus: (itemId: string) => void
  clearAll: () => void
  /** Trigger a re-check of all item statuses */
  refreshAll: () => void
  /** Counter that increments when statuses should be refreshed */
  refreshCounter: number
}

const ItemSyncStatusContext = createContext<
  ItemSyncStatusContextType | undefined
>(undefined)

/**
 * Provider component for per-item sync status
 */
export function ItemSyncStatusProvider({ children }: { children: ReactNode }) {
  const [statuses, setStatuses] = useState<Map<string, SyncStatus>>(new Map())
  const [refreshCounter, setRefreshCounter] = useState(0)

  const getStatus = useCallback(
    (itemId: string) => {
      return statuses.get(itemId)
    },
    [statuses]
  )

  const setStatus = useCallback((itemId: string, status: SyncStatus) => {
    setStatuses(prev => {
      const newMap = new Map(prev)
      newMap.set(itemId, status)
      return newMap
    })
  }, [])

  const clearStatus = useCallback((itemId: string) => {
    setStatuses(prev => {
      const newMap = new Map(prev)
      newMap.delete(itemId)
      return newMap
    })
  }, [])

  const clearAll = useCallback(() => {
    setStatuses(new Map())
  }, [])

  const refreshAll = useCallback(() => {
    setRefreshCounter(prev => prev + 1)
  }, [])

  // Subscribe to SyncEngine status changes to trigger refreshes
  useEffect(() => {
    const repo = getSyncRepository()
    const unsubscribe = repo.onSyncStatusChange(() => {
      // When sync status changes, trigger a refresh for all items
      refreshAll()
    })

    return () => {
      unsubscribe()
    }
  }, [refreshAll])

  const value = {
    getStatus,
    setStatus,
    clearStatus,
    clearAll,
    refreshAll,
    refreshCounter,
  }

  return (
    <ItemSyncStatusContext.Provider value={value}>
      {children}
    </ItemSyncStatusContext.Provider>
  )
}

/**
 * Hook to access per-item sync status
 *
 * @example
 * ```tsx
 * function SongListItem({ song }: { song: Song }) {
 *   const { getStatus, setStatus } = useItemSyncStatus()
 *   const status = getStatus(song.id)
 *
 *   return (
 *     <div>
 *       <SyncIcon status={status || 'synced'} />
 *       <span>{song.title}</span>
 *     </div>
 *   )
 * }
 * ```
 */
export function useItemSyncStatus() {
  const context = useContext(ItemSyncStatusContext)
  if (!context) {
    throw new Error(
      'useItemSyncStatus must be used within ItemSyncStatusProvider'
    )
  }
  return context
}

/**
 * Hook that returns the sync status for a specific item by querying the syncQueue.
 *
 * This hook queries the IndexedDB syncQueue directly to determine the actual
 * sync status of an item:
 * - If no queue item exists for this ID → 'synced' (item has been synced)
 * - If queue item has status 'pending' → 'pending' (waiting to sync)
 * - If queue item has status 'syncing' → 'syncing' (currently syncing)
 * - If queue item has status 'failed' → 'error' (sync failed)
 *
 * The hook also subscribes to sync status changes via the context's refreshCounter
 * so it re-queries when sync operations complete.
 *
 * @example
 * ```tsx
 * function SongListItem({ song }: { song: Song }) {
 *   const status = useItemStatus(song.id)
 *
 *   return (
 *     <div>
 *       <SyncIcon status={status} />
 *       <span>{song.title}</span>
 *     </div>
 *   )
 * }
 * ```
 */
export function useItemStatus(itemId: string): SyncStatus {
  const { refreshCounter } = useItemSyncStatus()
  const [status, setStatus] = useState<SyncStatus>('synced')

  useEffect(() => {
    let isMounted = true

    const checkSyncStatus = async () => {
      try {
        if (!db.syncQueue) {
          // Database not initialized yet
          return
        }

        // Query the syncQueue for any items with this ID
        // Try both where() (indexed) and filter() (fallback) to ensure we find items
        // Dexie's nested property indexing (data.id) can be inconsistent
        let queueItems = await db.syncQueue
          .where('data.id')
          .equals(itemId)
          .toArray()

        // If where() returns empty, try filter() as fallback
        if (queueItems.length === 0) {
          queueItems = await db.syncQueue
            .filter(item => item.data?.id === itemId)
            .toArray()
        }

        // Debug logging (only in dev/test, filtered by logger)
        if (queueItems.length > 0) {
          const allQueueItems = await db.syncQueue.toArray()
          log.debug('Queue status for', itemId, ':', {
            foundForThisItem: queueItems.length,
            itemStatuses: queueItems.map(q => ({
              status: q.status,
              operation: q.operation,
              retries: q.retryCount,
            })),
            totalInQueue: allQueueItems.length,
          })
        }

        if (!isMounted) return

        if (queueItems.length === 0) {
          // No queue item = item has been synced successfully
          setStatus('synced')
        } else {
          // Get the most recent queue item for this ID
          const latestItem = queueItems.sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )[0]

          // Map syncQueue status to SyncIcon status
          switch (latestItem.status) {
            case 'failed':
              setStatus('error')
              break
            case 'syncing':
              setStatus('syncing')
              break
            case 'pending':
              setStatus('pending')
              break
            case 'synced':
              // Item marked as synced but still in queue (edge case)
              setStatus('synced')
              break
            default:
              setStatus('pending')
          }
        }
      } catch (error) {
        console.error('[useItemStatus] Error checking sync status:', error)
        // On error, assume synced to avoid false alarms
        if (isMounted) {
          setStatus('synced')
        }
      }
    }

    checkSyncStatus()

    return () => {
      isMounted = false
    }
  }, [itemId, refreshCounter])

  return status
}
