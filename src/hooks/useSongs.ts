/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useRef } from 'react'
import { SongService } from '../services/SongService'
import { getSyncRepository } from '../services/data/SyncRepository'
import { db } from '../services/database'
import { useAuth } from '../contexts/AuthContext'
import type { Song } from '../models/Song'

/**
 * Hook to fetch songs for a band
 * Uses SongService with sync event listening for real-time updates
 */
export function useSongs(bandId: string) {
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const { realtimeManager } = useAuth()

  // Use ref to track the current realtime handler for proper cleanup
  const realtimeHandlerRef = useRef<
    | ((event: { bandId: string; action: string; recordId: string }) => void)
    | null
  >(null)

  // Memoize fetchSongs with optional silent mode (no loading state change)
  const fetchSongs = useCallback(
    async (silent = false) => {
      try {
        console.log(
          '[useSongs] Fetching songs for band:',
          bandId,
          silent ? '(silent)' : ''
        )
        if (!silent) {
          setLoading(true)
        }
        const response = await SongService.getBandSongs(bandId)
        console.log('[useSongs] Fetched songs count:', response.songs.length)
        setSongs(response.songs)
        setError(null)
      } catch (err) {
        console.error('[useSongs] Error fetching songs:', err)
        setError(err as Error)
        setSongs([])
      } finally {
        if (!silent) {
          setLoading(false)
        }
      }
    },
    [bandId]
  )

  useEffect(() => {
    if (!bandId) {
      setSongs([])
      setLoading(false)
      return
    }

    console.log('[useSongs] Mounting hook for band:', bandId)
    fetchSongs() // Initial load - show loading state

    // Listen for sync status changes to trigger refetch
    const repo = getSyncRepository()
    const handleSyncChange = (status: any) => {
      // Only refetch when sync COMPLETES, not when it starts
      // This prevents double-fetching during deletion
      if (status.status === 'idle' || status.status === 'synced') {
        console.log('[useSongs] Sync completed, refetching songs...')
        fetchSongs(true) // Silent mode
      } else {
        console.log(
          '[useSongs] Sync status changed to:',
          status.status,
          '- not refetching'
        )
      }
    }

    const unsubscribe = repo.onSyncStatusChange(handleSyncChange)

    // Cleanup previous realtime handler if exists
    if (realtimeManager && realtimeHandlerRef.current) {
      realtimeManager.off('songs:changed', realtimeHandlerRef.current)
      realtimeHandlerRef.current = null
    }

    // Listen for real-time changes from RealtimeManager
    const handleRealtimeChange = ({
      bandId: changedBandId,
    }: {
      bandId: string
      action: string
      recordId: string
    }) => {
      console.log('[useSongs] Realtime event received:', {
        changedBandId,
        currentBandId: bandId,
      })
      // Only refetch if the change is for the current band
      if (changedBandId === bandId) {
        console.log(
          '[useSongs] Realtime change detected for band, refetching...'
        )
        fetchSongs(true) // Silent mode - update list without loading state
      } else {
        console.log('[useSongs] Ignoring change for different band')
      }
    }

    if (realtimeManager) {
      console.log('[useSongs] Registering realtime listener for band:', bandId)
      realtimeManager.on('songs:changed', handleRealtimeChange)
      realtimeHandlerRef.current = handleRealtimeChange
    } else {
      console.warn(
        '[useSongs] No realtimeManager available, real-time updates disabled'
      )
    }

    // Cleanup
    return () => {
      console.log('[useSongs] Unmounting hook for band:', bandId)
      unsubscribe()
      if (realtimeManager && realtimeHandlerRef.current) {
        realtimeManager.off('songs:changed', realtimeHandlerRef.current)
        realtimeHandlerRef.current = null
      }
    }
  }, [bandId, realtimeManager, fetchSongs])

  return {
    songs,
    loading,
    error,
    refetch: async () => {
      console.log(
        '[useSongs.refetch] Starting manual refetch for band:',
        bandId
      )
      console.log(
        '[useSongs.refetch] Current songs in state:',
        songs.length,
        'songs'
      )
      setLoading(true)
      try {
        const response = await SongService.getBandSongs(bandId)
        console.log(
          '[useSongs.refetch] Fetched from DB:',
          response.songs.length,
          'songs'
        )
        console.log(
          '[useSongs.refetch] Song IDs from DB:',
          response.songs
            .map(s => `${s.id.substring(0, 8)}:${s.title}`)
            .join(', ')
        )
        setSongs(response.songs)
        setError(null)
        console.log(
          '[useSongs.refetch] setSongs called with',
          response.songs.length,
          'songs'
        )
      } catch (err) {
        console.error('[useSongs.refetch] Error:', err)
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    },
  }
}

/**
 * Hook to create a new song
 */
export function useCreateSong() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const createSong = async (songData: Partial<Song>) => {
    try {
      setLoading(true)
      setError(null)

      const songId = crypto.randomUUID()
      const newSong: Song = {
        id: songId,
        title: songData.title || '',
        artist: songData.artist || '',
        contextType: songData.contextType || 'band',
        contextId: songData.contextId || '',
        createdBy: songData.createdBy || '',
        visibility: songData.visibility || 'band', // Fixed: use 'band' to match Supabase constraint
        createdDate: new Date(),
        confidenceLevel: songData.confidenceLevel || 1,
        ...songData,
      } as Song

      // Use SyncRepository instead of direct db access - this will queue for sync!
      await getSyncRepository().addSong(newSong)

      return songId
    } catch (err) {
      console.error('Error creating song:', err)
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { createSong, loading, error }
}

/**
 * Hook to update a song
 */
export function useUpdateSong() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const updateSong = async (songId: string, updates: Partial<Song>) => {
    try {
      setLoading(true)
      setError(null)

      // Use SyncRepository instead of direct db access - this will queue for sync!
      await getSyncRepository().updateSong(songId, updates)

      return true
    } catch (err) {
      console.error('Error updating song:', err)
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { updateSong, loading, error }
}

/**
 * Hook to delete a song
 */
export function useDeleteSong() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const deleteSong = async (songId: string) => {
    try {
      setLoading(true)
      setError(null)

      // Check if song is in any setlists
      const setlists = await db.setlists
        .filter(setlist =>
          setlist.items?.some(
            item => item.type === 'song' && item.songId === songId
          )
        )
        .toArray()

      if (setlists.length > 0) {
        // Remove song from all setlists
        for (const setlist of setlists) {
          const updatedItems =
            setlist.items?.filter(
              item => !(item.type === 'song' && item.songId === songId)
            ) || []

          // Reindex positions
          updatedItems.forEach((item, index) => {
            item.position = index + 1
          })

          await db.setlists.update(setlist.id!, { items: updatedItems })
        }
      }

      // Use SyncRepository instead of direct db access - this will queue for sync!
      await getSyncRepository().deleteSong(songId)

      return true
    } catch (err) {
      console.error('Error deleting song:', err)
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const checkSongInSetlists = async (songId: string) => {
    const setlists = await db.setlists
      .filter(setlist =>
        setlist.items?.some(
          item => item.type === 'song' && item.songId === songId
        )
      )
      .toArray()

    return setlists
  }

  return { deleteSong, checkSongInSetlists, loading, error }
}
