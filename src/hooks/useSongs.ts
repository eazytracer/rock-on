import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { SongService } from '../services/SongService'
import { repository } from '../services/data/RepositoryFactory'
import { queryKeys, EMPTY_ARRAY } from '../services/queryClient'
import { useRealtimeInvalidate } from './useRealtimeInvalidate'
import type { Song } from '../models/Song'
import { deleteSong as deleteSongApi } from '../services/api/songs'

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
    songs: query.data ?? EMPTY_ARRAY,
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
    songs: query.data ?? EMPTY_ARRAY,
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
 * Hook to delete a song. The `delete_song` RPC removes it from setlists in its
 * context and deletes it in one transaction.
 */
export function useDeleteSong() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (songId: string) => {
      await deleteSongApi(songId)
      return songId
    },
    onMutate: songId => {
      // Drop it from every song list right away, so nothing (the desktop pane)
      // keeps showing — and refetching — a song that's about to be gone.
      queryClient.setQueriesData<Song[]>(
        {
          predicate: q =>
            q.queryKey[0] === 'songs' &&
            (q.queryKey[1] === 'band' || q.queryKey[1] === 'personal'),
        },
        old => old?.filter(s => s.id !== songId)
      )
    },
    onSettled: (_data, _err, songId) => {
      // The deleted song's own queries (usage, detail) would 404 if refetched.
      const isDeleted = (key: readonly unknown[]) => key.includes(songId)
      queryClient.removeQueries({
        queryKey: ['songs'],
        predicate: q => isDeleted(q.queryKey),
      })
      queryClient.invalidateQueries({
        queryKey: ['songs'],
        predicate: q => !isDeleted(q.queryKey),
      })
      queryClient.invalidateQueries({ queryKey: ['setlists'] })
    },
  })

  return {
    deleteSong: (songId: string) => mutation.mutateAsync(songId),
    loading: mutation.isPending,
    error: mutation.error as Error | null,
  }
}
