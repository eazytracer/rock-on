import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Sync status information exposed by the hook.
 *
 * Post Phase 2 the web client is a naive online Supabase client — there is no
 * offline sync queue, so `isSyncing`/`pendingCount`/`failedCount` are always
 * zero/false. The hook is retained (same shape) to drive the online/offline +
 * Supabase-connectivity affordances in the layout chrome.
 */
export interface SyncStatus {
  isOnline: boolean
  isSupabaseConnected: boolean
  isSyncing: boolean
  pendingCount: number
  failedCount: number
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
 * React hook that reports connectivity for the layout chrome:
 * - browser online/offline state
 * - Supabase reachability (periodic auth-session health check)
 */
export function useSyncStatus(): UseSyncStatusReturn {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isSupabaseConnected: true, // Assume connected initially
    isSyncing: false,
    pendingCount: 0,
    failedCount: 0,
    lastSyncTime: null,
    syncError: null,
  })
  const supabaseCheckInterval = useRef<ReturnType<typeof setInterval> | null>(
    null
  )

  useEffect(() => {
    // Check Supabase connectivity
    const checkSupabaseConnection = async () => {
      try {
        const { getSupabaseClient } = await import(
          '../services/supabase/client'
        )
        const supabase = getSupabaseClient()

        if (!supabase) {
          setStatus(prev => ({ ...prev, isSupabaseConnected: false }))
          return
        }

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

    // Handle online/offline events
    const handleOnline = () => {
      setStatus(prevStatus =>
        prevStatus.isOnline ? prevStatus : { ...prevStatus, isOnline: true }
      )
    }

    const handleOffline = () => {
      setStatus(prevStatus =>
        !prevStatus.isOnline ? prevStatus : { ...prevStatus, isOnline: false }
      )
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Cleanup on unmount
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (supabaseCheckInterval.current) {
        clearInterval(supabaseCheckInterval.current)
      }
    }
  }, [])

  // No-op sync trigger: reads are already always fresh from Supabase (cloud
  // is the source of truth). Retained so existing call sites keep compiling.
  const sync = useCallback(async () => {
    setStatus(prevStatus => ({ ...prevStatus, syncError: null }))
  }, [])

  return {
    ...status,
    sync,
  }
}
