import { useState, useEffect, useCallback, useRef } from 'react'
import { SetlistService } from '../services/SetlistService'
import { getSyncRepository } from '../services/data/SyncRepository'
import { useAuth } from '../contexts/AuthContext'
import type { Setlist } from '../models/Setlist'
import type { SetlistItem } from '../types'

/**
 * Hook to fetch setlists for a band
 */
export function useSetlists(bandId: string) {
  const [setlists, setSetlists] = useState<Setlist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const { realtimeManager } = useAuth()

  // Memoize fetchSetlists with optional silent mode (no loading state change)
  const fetchSetlists = useCallback(async (silent = false) => {
    try {
      console.log('[useSetlists] Fetching setlists for band:', bandId, silent ? '(silent)' : '')
      if (!silent) {
        setLoading(true)
      }
      const response = await SetlistService.getSetlists({ bandId })
      console.log('[useSetlists] Fetched setlists count:', response.setlists.length)
      setSetlists(response.setlists)
      setError(null)
    } catch (err) {
      console.error('[useSetlists] Error fetching setlists:', err)
      setError(err as Error)
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [bandId])

  // Store the handler ref to properly clean up listeners
  const realtimeHandlerRef = useRef<((event: { bandId: string; action: string; recordId: string }) => void) | null>(null)

  useEffect(() => {
    if (!bandId) {
      setSetlists([])
      setLoading(false)
      return
    }

    console.log('[useSetlists] Mounting hook for band:', bandId)
    fetchSetlists() // Initial load - show loading state

    // Subscribe to sync events for live updates
    const repo = getSyncRepository()
    const handleSyncChange = () => {
      console.log('[useSetlists] Sync status changed, refetching...')
      fetchSetlists(true) // Silent mode
    }

    const unsubscribe = repo.onSyncStatusChange(handleSyncChange)

    // Listen for real-time changes from RealtimeManager
    if (realtimeManager) {
      // Remove old listener if exists
      if (realtimeHandlerRef.current) {
        realtimeManager.off('setlists:changed', realtimeHandlerRef.current)
      }

      // Create new listener
      const handleRealtimeChange = ({ bandId: changedBandId }: { bandId: string; action: string; recordId: string }) => {
        // Only refetch if the change is for the current band
        if (changedBandId === bandId) {
          console.log('[useSetlists] Realtime change detected for band, refetching...')
          fetchSetlists(true) // Silent mode - update list without loading state
        }
      }
      realtimeHandlerRef.current = handleRealtimeChange

      console.log('[useSetlists] Registering realtime listener for band:', bandId)
      realtimeManager.on('setlists:changed', handleRealtimeChange)
    }

    // Cleanup
    return () => {
      console.log('[useSetlists] Unmounting hook for band:', bandId)
      unsubscribe()
      if (realtimeManager && realtimeHandlerRef.current) {
        realtimeManager.off('setlists:changed', realtimeHandlerRef.current)
      }
    }
  }, [bandId, realtimeManager, fetchSetlists])

  return { setlists, loading, error }
}

/**
 * Hook to create a new setlist
 * Supports full Setlist structure including items (songs, breaks, sections)
 */
export function useCreateSetlist() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const createSetlist = async (setlistData: Partial<Setlist>) => {
    try {
      setLoading(true)
      setError(null)

      // For setlists with items, use repository directly
      if (setlistData.items && setlistData.items.length > 0) {
        const repo = getSyncRepository()
        const newSetlist: Setlist = {
          id: setlistData.id || crypto.randomUUID(),
          name: setlistData.name || 'New Setlist',
          bandId: setlistData.bandId || '',
          showId: setlistData.showId,
          items: setlistData.items,
          totalDuration: setlistData.totalDuration || 0,
          notes: setlistData.notes || '',
          status: setlistData.status || 'draft',
          createdDate: new Date(),
          lastModified: new Date()
        }

        await repo.addSetlist(newSetlist)
        return newSetlist.id
      }

      // For legacy setlists without items, use SetlistService
      const newSetlist = await SetlistService.createSetlist({
        name: setlistData.name || 'New Setlist',
        bandId: setlistData.bandId || '',
        showDate: setlistData.showDate ? setlistData.showDate.toISOString() : undefined,
        venue: setlistData.venue,
        notes: setlistData.notes,
      })

      return newSetlist.id
    } catch (err) {
      console.error('Error creating setlist:', err)
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { createSetlist, loading, error }
}

/**
 * Hook to update a setlist
 * Supports updating full Setlist structure including items
 */
export function useUpdateSetlist() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const updateSetlist = async (setlistId: string, updates: Partial<Setlist>) => {
    try {
      setLoading(true)
      setError(null)

      // If updating items or other fields not supported by SetlistService, use repository
      if (updates.items !== undefined || updates.showId !== undefined || updates.totalDuration !== undefined) {
        const repo = getSyncRepository()
        const updateData: Partial<Setlist> = {
          ...updates,
          lastModified: new Date()
        }

        await repo.updateSetlist(setlistId, updateData)
        return true
      }

      // For legacy updates, use SetlistService
      await SetlistService.updateSetlist(setlistId, {
        name: updates.name,
        showDate: updates.showDate?.toISOString(),
        venue: updates.venue,
        notes: updates.notes,
        status: updates.status,
      })

      return true
    } catch (err) {
      console.error('Error updating setlist:', err)
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { updateSetlist, loading, error }
}

/**
 * Hook to delete a setlist
 */
export function useDeleteSetlist() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const deleteSetlist = async (setlistId: string) => {
    try {
      setLoading(true)
      setError(null)

      await SetlistService.deleteSetlist(setlistId)

      return true
    } catch (err) {
      console.error('Error deleting setlist:', err)
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { deleteSetlist, loading, error }
}

/**
 * Hook to add an item to a setlist
 */
export function useAddSetlistItem() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const addItem = async (setlistId: string, item: Omit<SetlistItem, 'id' | 'position'>) => {
    try {
      setLoading(true)
      setError(null)

      // Only handle song items for now (SetlistService works with songs)
      if (item.type === 'song' && item.songId) {
        const updatedSetlist = await SetlistService.addSongToSetlist(setlistId, {
          songId: item.songId,
          keyChange: item.notes, // Map notes to keyChange if needed
        })

        // Find the newly added song in the updated setlist
        const newSong = (updatedSetlist.songs || [])[(updatedSetlist.songs || []).length - 1]
        if (newSong) {
          const newItem: SetlistItem = {
            id: crypto.randomUUID(),
            type: 'song',
            songId: newSong.songId,
            position: newSong.order,
            notes: item.notes,
          }
          return newItem
        }
      }

      // For non-song items, we'll need to handle differently
      // For now, just return a placeholder
      const newItem: SetlistItem = {
        ...item,
        id: crypto.randomUUID(),
        position: 1,
      } as SetlistItem

      return newItem
    } catch (err) {
      console.error('Error adding setlist item:', err)
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { addItem, loading, error }
}

/**
 * Hook to remove an item from a setlist
 */
export function useRemoveSetlistItem() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const removeItem = async (setlistId: string, itemId: string) => {
    try {
      setLoading(true)
      setError(null)

      // For now, assume itemId is the songId
      // In a real implementation, we'd need to look up the item to get its songId
      await SetlistService.removeSongFromSetlist(setlistId, itemId)

      return true
    } catch (err) {
      console.error('Error removing setlist item:', err)
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { removeItem, loading, error }
}

/**
 * Hook to reorder setlist items
 */
export function useReorderSetlistItems() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const reorderItems = async (setlistId: string, reorderedItems: SetlistItem[]) => {
    try {
      setLoading(true)
      setError(null)

      // Extract song IDs from items, filtering out non-song items
      const songOrder = reorderedItems
        .filter(item => item.type === 'song' && item.songId)
        .map(item => item.songId!)

      await SetlistService.reorderSongs(setlistId, { songOrder })

      return true
    } catch (err) {
      console.error('Error reordering setlist items:', err)
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { reorderItems, loading, error }
}
