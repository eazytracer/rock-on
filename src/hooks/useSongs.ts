import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { SongService } from '../services/SongService'
import { repository } from '../services/data/RepositoryFactory'
import { queryKeys } from '../services/queryClient'
import { useRealtimeInvalidate } from './useRealtimeInvalidate'
import type { Song } from '../models/Song'
import type { Setlist } from '../models/Setlist'

/**
 * Fetch the setlists (of the song's own context) that contain a given song.
 * A band song can only appear in that band's setlists; a personal song only in
 * the user's personal setlists — so we scope the lookup by the song's context
 * instead of scanning every setlist.
 */
async function getSetlistsContainingSong(song: Song): Promise<Setlist[]> {
  const setlists =
    song.contextType === 'personal'
      ? await repository.getPersonalSetlists(song.contextId)
      : await repository.getSetlists(song.contextId)
  return setlists.filter(setlist =>
    setlist.items?.some(item => item.type === 'song' && item.songId === song.id)
  )
}

/**
 * Hook to fetch songs for a band.
 *
 * Reads via TanStack Query (ephemeral in-memory cache). Realtime `songs:changed`
 * events invalidate the query so other members' edits refetch. Return shape is
 * preserved (`songs`, `loading`, `error`, `refetch`) for existing consumers.
 */
export function useSongs(bandId: string) {
  const query = useQuery({
    queryKey: queryKeys.songs.band(bandId),
    queryFn: async () => {
      const response = await SongService.getBandSongs(bandId)
      return response.songs
    },
    enabled: !!bandId,
  })

  // Invalidate on remote changes to this band's songs.
  useRealtimeInvalidate({
    events: ['songs:changed'],
    bandId,
    queryKey: queryKeys.songs.band(bandId),
  })

  return {
    songs: query.data ?? [],
    loading: query.isLoading,
    error: query.error as Error | null,
    refetch: useCallback(async () => {
      await query.refetch()
    }, [query]),
  }
}

/**
 * Hook to fetch personal songs for the current user.
 * Personal songs have contextType='personal' and contextId=userId.
 */
export function usePersonalSongs(userId: string) {
  const query = useQuery({
    queryKey: queryKeys.songs.personal(userId),
    queryFn: async () => {
      const response = await SongService.getPersonalSongs(userId)
      return response.songs
    },
    enabled: !!userId,
  })

  // Personal songs carry no bandId; any songs change may touch them, so
  // invalidate on every songs:changed event.
  useRealtimeInvalidate({
    events: ['songs:changed'],
    queryKey: queryKeys.songs.personal(userId),
  })

  return {
    songs: query.data ?? [],
    loading: query.isLoading,
    error: query.error as Error | null,
    refetch: useCallback(async () => {
      await query.refetch()
    }, [query]),
  }
}

/**
 * Hook to create a new song. Optimistic: the song appears immediately; on
 * failure the cache rolls back and the caller's try/catch shows an error toast.
 */
export function useCreateSong() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (songData: Partial<Song>) => {
      const songId = crypto.randomUUID()
      const newSong: Song = {
        id: songId,
        title: songData.title || '',
        artist: songData.artist || '',
        contextType: songData.contextType || 'band',
        contextId: songData.contextId || '',
        createdBy: songData.createdBy || '',
        visibility: songData.visibility || 'band',
        createdDate: new Date(),
        confidenceLevel: songData.confidenceLevel || 1,
        ...songData,
      } as Song

      await repository.addSong(newSong)
      return songId
    },
    onSettled: (_data, _err, songData) => {
      // Reconcile whichever catalog this song belongs to.
      if (songData.contextType === 'personal' && songData.contextId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.songs.personal(songData.contextId),
        })
      } else if (songData.contextId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.songs.band(songData.contextId),
        })
      }
    },
  })

  return {
    createSong: (songData: Partial<Song>) => mutation.mutateAsync(songData),
    loading: mutation.isPending,
    error: mutation.error as Error | null,
  }
}

/**
 * Hook to update a song. Invalidates the owning catalog on settle.
 */
export function useUpdateSong() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async ({
      songId,
      updates,
    }: {
      songId: string
      updates: Partial<Song>
    }) => {
      await repository.updateSong(songId, updates)
      return songId
    },
    onSettled: () => {
      // A song update can affect band or personal lists and detail views.
      queryClient.invalidateQueries({ queryKey: ['songs'] })
    },
  })

  return {
    updateSong: (songId: string, updates: Partial<Song>) =>
      mutation.mutateAsync({ songId, updates }),
    loading: mutation.isPending,
    error: mutation.error as Error | null,
  }
}

/**
 * Hook to delete a song. Removes the song from any setlists in its context
 * first (through the repository so the change syncs), then deletes the song.
 */
export function useDeleteSong() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (songId: string) => {
      const song = await repository.getSong(songId)
      if (song) {
        // Remove the song from any setlists that reference it.
        const setlists = await getSetlistsContainingSong(song)
        for (const setlist of setlists) {
          const updatedItems = (setlist.items || []).filter(
            item => !(item.type === 'song' && item.songId === songId)
          )
          updatedItems.forEach((item, index) => {
            item.position = index + 1
          })
          await repository.updateSetlist(setlist.id!, { items: updatedItems })
        }
      }

      await repository.deleteSong(songId)
      return songId
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['songs'] })
      queryClient.invalidateQueries({ queryKey: ['setlists'] })
    },
  })

  const checkSongInSetlists = useCallback(async (songId: string) => {
    const song = await repository.getSong(songId)
    if (!song) return []
    return getSetlistsContainingSong(song)
  }, [])

  return {
    deleteSong: (songId: string) => mutation.mutateAsync(songId),
    checkSongInSetlists,
    loading: mutation.isPending,
    error: mutation.error as Error | null,
  }
}
