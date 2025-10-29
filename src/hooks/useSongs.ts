import { useState, useEffect } from 'react'
import { SongService } from '../services/SongService'
import { getSyncRepository } from '../services/data/SyncRepository'
import { db } from '../services/database'
import type { Song } from '../models/Song'

/**
 * Hook to fetch songs for a band
 * Uses SongService with sync event listening for real-time updates
 */
export function useSongs(bandId: string) {
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!bandId) {
      setSongs([])
      setLoading(false)
      return
    }

    // Initial fetch
    const fetchSongs = async () => {
      try {
        console.log('[useSongs] Fetching songs for band:', bandId)
        setLoading(true)
        const response = await SongService.getBandSongs(bandId)
        console.log('[useSongs] Fetched songs count:', response.songs.length)
        setSongs(response.songs)
        setError(null)
      } catch (err) {
        console.error('[useSongs] Error fetching songs:', err)
        setError(err as Error)
        setSongs([])
      } finally {
        setLoading(false)
      }
    }

    console.log('[useSongs] Mounting hook for band:', bandId)
    fetchSongs()

    // Listen for sync status changes to trigger refetch
    const repo = getSyncRepository()
    const handleSyncChange = () => {
      // Refetch when sync completes (data may have changed)
      console.log('[useSongs] Sync status changed, refetching songs...')
      fetchSongs()
    }

    const unsubscribe = repo.onSyncStatusChange(handleSyncChange)

    // Cleanup
    return () => {
      console.log('[useSongs] Unmounting hook for band:', bandId)
      unsubscribe()
    }
  }, [bandId])

  return { songs, loading, error, refetch: async () => {
    setLoading(true)
    try {
      const response = await SongService.getBandSongs(bandId)
      setSongs(response.songs)
      setError(null)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }}
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
        ...songData
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
        .filter(setlist => setlist.items?.some(item => item.type === 'song' && item.songId === songId))
        .toArray()

      if (setlists.length > 0) {
        // Remove song from all setlists
        for (const setlist of setlists) {
          const updatedItems = setlist.items?.filter(item => !(item.type === 'song' && item.songId === songId)) || []

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
      .filter(setlist => setlist.items?.some(item => item.type === 'song' && item.songId === songId))
      .toArray()

    return setlists
  }

  return { deleteSong, checkSongInSetlists, loading, error }
}
