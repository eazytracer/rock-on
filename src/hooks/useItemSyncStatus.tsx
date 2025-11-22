import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react'
import type { SyncStatus } from '../components/sync/SyncIcon'

/**
 * Per-item sync status store
 * Tracks the sync status of individual items (songs, setlists, shows, etc.)
 */
interface ItemSyncStatusContextType {
  getStatus: (itemId: string) => SyncStatus | undefined
  setStatus: (itemId: string, status: SyncStatus) => void
  clearStatus: (itemId: string) => void
  clearAll: () => void
}

const ItemSyncStatusContext = createContext<
  ItemSyncStatusContextType | undefined
>(undefined)

/**
 * Provider component for per-item sync status
 */
export function ItemSyncStatusProvider({ children }: { children: ReactNode }) {
  const [statuses, setStatuses] = useState<Map<string, SyncStatus>>(new Map())

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

  const value = {
    getStatus,
    setStatus,
    clearStatus,
    clearAll,
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
 * Hook that automatically subscribes to and returns the status for a specific item
 *
 * This hook returns the current status directly from the context.
 * Since getStatus depends on the statuses state, this component will
 * re-render whenever the statuses Map changes.
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
  const { getStatus } = useItemSyncStatus()
  // Directly read from context - will re-render when context changes
  // because getStatus is memoized with statuses as dependency
  return getStatus(itemId) || 'synced'
}
