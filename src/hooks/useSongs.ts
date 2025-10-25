import { useState, useEffect } from 'react'
import { db } from '../services/database'
import type { Song } from '../models/Song'

/**
 * Hook to fetch songs for a band
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

    const fetchSongs = async () => {
      try {
        setLoading(true)
        const bandSongs = await db.songs
          .where('contextType')
          .equals('band')
          .and(s => s.contextId === bandId)
          .toArray()

        setSongs(bandSongs)
        setError(null)
      } catch (err) {
        console.error('Error fetching songs:', err)
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    fetchSongs()

    return () => {
      // Cleanup if needed
    }
  }, [bandId])

  return { songs, loading, error, refetch: () => {} }
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
        visibility: songData.visibility || 'band_only',
        createdDate: new Date(),
        confidenceLevel: songData.confidenceLevel || 1,
        ...songData
      } as Song

      await db.songs.add(newSong)

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

      await db.songs.update(songId, updates)

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

      // Delete the song
      await db.songs.delete(songId)

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
