import { useState, useEffect, useCallback } from 'react'
import {
  SyncConflict,
  ConflictResolution,
  ConflictEvent,
} from '../services/data/syncTypes'
import { repository } from '../services/data/RepositoryFactory'

interface UseSyncConflictsResult {
  conflicts: SyncConflict[]
  currentConflict: SyncConflict | null
  hasConflicts: boolean
  isLoading: boolean
  resolveConflict: (resolution: ConflictResolution) => Promise<void>
  dismissConflict: () => void
  refreshConflicts: () => Promise<void>
}

/**
 * Hook for managing sync conflicts
 *
 * Provides:
 * - List of all pending conflicts
 * - Current conflict to display in modal
 * - Methods to resolve or dismiss conflicts
 * - Automatic updates when conflicts are detected/resolved
 */
export function useSyncConflicts(): UseSyncConflictsResult {
  const [conflicts, setConflicts] = useState<SyncConflict[]>([])
  const [currentConflict, setCurrentConflict] = useState<SyncConflict | null>(
    null
  )
  const [isLoading, setIsLoading] = useState(false)

  // Load pending conflicts
  const refreshConflicts = useCallback(async () => {
    try {
      const syncEngine = repository.getSyncEngine?.()
      if (!syncEngine) {
        // Sync engine not available yet (e.g., on auth page before login)
        return
      }

      const pending = await syncEngine.getPendingConflicts()
      setConflicts(pending)

      // Auto-show first conflict if not already showing one
      if (pending.length > 0 && !currentConflict) {
        setCurrentConflict(pending[0])
      }
    } catch {
      // Silently ignore all errors when sync engine/database is not ready
      // This can happen during initial app load or on auth pages
      // DexieError occurs when database isn't initialized yet
    }
  }, [currentConflict])

  // Subscribe to conflict events
  useEffect(() => {
    let unsubscribe: (() => void) | undefined

    try {
      const syncEngine = repository.getSyncEngine?.()
      if (!syncEngine) {
        // Sync engine not available yet - retry on next render
        return
      }

      const handleConflictEvent = (event: ConflictEvent) => {
        if (event.type === 'conflict_detected') {
          // Add new conflict to list
          setConflicts(prev => [...prev, event.conflict])

          // Show it if not already showing a conflict
          if (!currentConflict) {
            setCurrentConflict(event.conflict)
          }
        } else if (event.type === 'conflict_resolved') {
          // Remove resolved conflict from list
          setConflicts(prev => prev.filter(c => c.id !== event.conflict.id))

          // If this was the current conflict, clear it
          if (currentConflict?.id === event.conflict.id) {
            setCurrentConflict(null)
          }
        }
      }

      unsubscribe = syncEngine.onConflict(handleConflictEvent)

      // Initial load
      refreshConflicts()
    } catch {
      // Silently ignore errors when sync engine is not ready
    }

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [currentConflict, refreshConflicts])

  // Resolve the current conflict
  const resolveConflict = useCallback(
    async (resolution: ConflictResolution) => {
      if (!currentConflict?.id) return

      setIsLoading(true)
      try {
        const syncEngine = repository.getSyncEngine?.()
        if (syncEngine) {
          await syncEngine.resolveConflict(currentConflict.id, resolution)
        }

        // Remove from local state
        setConflicts(prev => prev.filter(c => c.id !== currentConflict.id))

        // Show next conflict or clear
        const remaining = conflicts.filter(c => c.id !== currentConflict.id)
        setCurrentConflict(remaining.length > 0 ? remaining[0] : null)
      } catch (error) {
        console.error('[useSyncConflicts] Failed to resolve conflict:', error)
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    [currentConflict, conflicts]
  )

  // Dismiss the current conflict (decide later)
  const dismissConflict = useCallback(() => {
    if (!currentConflict) return

    // Show next conflict or clear
    const remaining = conflicts.filter(c => c.id !== currentConflict.id)
    setCurrentConflict(remaining.length > 0 ? remaining[0] : null)
  }, [currentConflict, conflicts])

  return {
    conflicts,
    currentConflict,
    hasConflicts: conflicts.length > 0,
    isLoading,
    resolveConflict,
    dismissConflict,
    refreshConflicts,
  }
}
