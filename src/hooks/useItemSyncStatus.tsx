/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react'
import type { SyncStatus } from '../components/sync/SyncIcon'

/**
 * Per-item sync status store.
 *
 * Post Phase 2 the web client is a naive online Supabase client with no local
 * write queue — every write goes straight to Supabase, so an item is either
 * saved ('synced') or the mutation threw. This provider is retained as a
 * lightweight manual-override store (same API) so existing call sites keep
 * working; there is no sync engine to subscribe to anymore.
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
 * Sync status for a specific item.
 *
 * With no local write queue, a persisted item is always 'synced' (a failed
 * write surfaces as a thrown mutation + error toast at the call site, not as a
 * lingering per-item state). Manual overrides set via the provider still win.
 */
export function useItemStatus(itemId: string): SyncStatus {
  const { getStatus } = useItemSyncStatus()
  return getStatus(itemId) ?? 'synced'
}
