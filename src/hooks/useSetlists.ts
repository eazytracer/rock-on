import { useCallback, useMemo } from 'react'
import {
  keepPreviousData,
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { SetlistService } from '../services/SetlistService'
import { repository } from '../services/data/RepositoryFactory'
import { queryKeys, EMPTY_ARRAY } from '../services/queryClient'
import { useRealtimeInvalidate } from './useRealtimeInvalidate'
import type { Setlist } from '../models/Setlist'
import type { SetlistItem } from '../types'
import type { Song } from '../models/Song'
import { setlistIndex, duplicateSetlist } from '../services/api/setlists'

/**
 * Hook to fetch setlists for a band.
 *
 * Reads via TanStack Query (ephemeral cache); realtime `setlists:changed`
 * events invalidate the query so other members' edits refetch. Return shape
 * (`setlists`, `loading`, `error`) preserved for consumers.
 */
export function useSetlists(bandId: string) {
  const query = useQuery({
    queryKey: queryKeys.setlists.band(bandId),
    queryFn: async () => {
      const response = await SetlistService.getSetlists({ bandId })
      return response.setlists
    },
    enabled: !!bandId,
  })

  useRealtimeInvalidate({
    events: ['setlists:changed'],
    bandId,
    queryKey: queryKeys.setlists.band(bandId),
  })

  return {
    setlists: query.data ?? EMPTY_ARRAY,
    loading: query.isLoading,
    error: query.error as Error | null,
  }
}

/**
 * Hook to update a setlist.
 * Supports updating full Setlist structure including items.
 */
export function useUpdateSetlist() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async ({
      setlistId,
      updates,
    }: {
      setlistId: string
      updates: Partial<Setlist>
    }) => {
      // If updating items or other fields SetlistService doesn't handle, use repo.
      if (
        updates.items !== undefined ||
        updates.showId !== undefined ||
        updates.totalDuration !== undefined
      ) {
        await repository.updateSetlist(setlistId, {
          ...updates,
          lastModified: new Date(),
        })
        return true
      }

      await SetlistService.updateSetlist(setlistId, {
        name: updates.name,
        showDate: updates.showDate?.toISOString(),
        venue: updates.venue,
        notes: updates.notes,
        status: updates.status,
      })
      return true
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['setlists'] })
    },
  })

  return {
    updateSetlist: (setlistId: string, updates: Partial<Setlist>) =>
      mutation.mutateAsync({ setlistId, updates }),
    loading: mutation.isPending,
    error: mutation.error as Error | null,
  }
}

/**
 * Hook to delete a setlist.
 */
export function useDeleteSetlist() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (setlistId: string) => {
      await SetlistService.deleteSetlist(setlistId)
      return true
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['setlists'] })
    },
  })

  return {
    deleteSetlist: (setlistId: string) => mutation.mutateAsync(setlistId),
    loading: mutation.isPending,
    error: mutation.error as Error | null,
  }
}

/**
 * Hook to add an item to a setlist.
 */
export function useAddSetlistItem() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async ({
      setlistId,
      item,
    }: {
      setlistId: string
      item: Omit<SetlistItem, 'id' | 'position'>
    }) => {
      // Only handle song items for now (SetlistService works with songs).
      if (item.type === 'song' && item.songId) {
        const updatedSetlist = await SetlistService.addSongToSetlist(
          setlistId,
          {
            songId: item.songId,
            keyChange: item.notes, // Map notes to keyChange if needed
          }
        )
        const newSong = (updatedSetlist.songs || [])[
          (updatedSetlist.songs || []).length - 1
        ]
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

      // For non-song items, return a placeholder.
      return {
        ...item,
        id: crypto.randomUUID(),
        position: 1,
      } as SetlistItem
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['setlists'] })
    },
  })

  return {
    addItem: (setlistId: string, item: Omit<SetlistItem, 'id' | 'position'>) =>
      mutation.mutateAsync({ setlistId, item }),
    loading: mutation.isPending,
    error: mutation.error as Error | null,
  }
}

/**
 * Hook to remove an item from a setlist.
 */
export function useRemoveSetlistItem() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async ({
      setlistId,
      itemId,
    }: {
      setlistId: string
      itemId: string
    }) => {
      // For now, assume itemId is the songId.
      await SetlistService.removeSongFromSetlist(setlistId, itemId)
      return true
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['setlists'] })
    },
  })

  return {
    removeItem: (setlistId: string, itemId: string) =>
      mutation.mutateAsync({ setlistId, itemId }),
    loading: mutation.isPending,
    error: mutation.error as Error | null,
  }
}

/**
 * Hook to reorder setlist items.
 */
export function useReorderSetlistItems() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async ({
      setlistId,
      reorderedItems,
    }: {
      setlistId: string
      reorderedItems: SetlistItem[]
    }) => {
      const songOrder = reorderedItems
        .filter(item => item.type === 'song' && item.songId)
        .map(item => item.songId!)
      await SetlistService.reorderSongs(setlistId, { songOrder })
      return true
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['setlists'] })
    },
  })

  return {
    reorderItems: (setlistId: string, reorderedItems: SetlistItem[]) =>
      mutation.mutateAsync({ setlistId, reorderedItems }),
    loading: mutation.isPending,
    error: mutation.error as Error | null,
  }
}

/**
 * Hook to fetch personal setlists for the current user.
 * Personal setlists have contextType='personal' and contextId=userId.
 */
export function usePersonalSetlists(userId: string) {
  const query = useQuery({
    queryKey: queryKeys.setlists.personal(userId),
    queryFn: async () => {
      const response = await SetlistService.getPersonalSetlists(userId)
      return response.setlists
    },
    enabled: !!userId,
  })

  useRealtimeInvalidate({
    events: ['setlists:changed'],
    queryKey: queryKeys.setlists.personal(userId),
  })

  return {
    setlists: query.data ?? EMPTY_ARRAY,
    loading: query.isLoading,
    error: query.error as Error | null,
    refetch: useCallback(async () => {
      await query.refetch()
    }, [query]),
  }
}

/**
 * The Setlists index for one context (docs/redesign/10 · 2.2): each set with
 * its show and songs, from `setlist_index`. Live via `setlists:changed`.
 */
export function useSetlistIndex(
  contextType: 'band' | 'personal',
  contextId: string
) {
  const queryKey = queryKeys.setlists.index(contextType, contextId)
  const query = useQuery({
    queryKey,
    queryFn: () => setlistIndex(contextType, contextId),
    enabled: !!contextId,
  })

  useRealtimeInvalidate({
    events: ['setlists:changed'],
    bandId: contextType === 'band' ? contextId : undefined,
    queryKey,
  })

  return {
    rows: query.data ?? EMPTY_ARRAY,
    loading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  }
}

/** New setlist: an empty set named "New setlist" in the context. Returns its id. */
export function useNewSetlist() {
  const queryClient = useQueryClient()
  return useCallback(
    async (contextType: 'band' | 'personal', contextId: string) => {
      const saved = await repository.addSetlist({
        id: crypto.randomUUID(),
        name: 'New setlist',
        bandId: contextType === 'band' ? contextId : undefined,
        contextType,
        contextId,
        items: [],
        totalDuration: 0,
        status: 'draft',
        createdDate: new Date(),
        lastModified: new Date(),
      })
      queryClient.invalidateQueries({ queryKey: ['setlists'] })
      return saved.id
    },
    [queryClient]
  )
}

/** Duplicate: a copy, not attached to a show. Returns the copy's id. */
export function useDuplicateSetlist() {
  const queryClient = useQueryClient()
  return useCallback(
    async (setlistId: string) => {
      const id = await duplicateSetlist(setlistId)
      queryClient.invalidateQueries({ queryKey: ['setlists'] })
      return id
    },
    [queryClient]
  )
}

/**
 * The setlist editor's data (docs/redesign/10 · 2.3): the set, the songs in
 * it, and `run`, which applies an edit locally first (when given `local`),
 * calls the server, rolls back on failure and refetches. Live via
 * `setlists:changed` / `songs:changed`.
 */
export function useSetlistEditor(setlistId: string) {
  const queryClient = useQueryClient()
  const key = queryKeys.setlists.detail(setlistId)
  const query = useQuery({
    queryKey: key,
    queryFn: () => repository.getSetlist(setlistId),
    enabled: !!setlistId,
  })
  const setlist = query.data ?? null
  const bandId =
    setlist?.contextType === 'band'
      ? (setlist.contextId ?? setlist.bandId)
      : undefined

  useRealtimeInvalidate({
    events: ['setlists:changed'],
    bandId,
    queryKey: key,
  })

  const songIds = useMemo(
    () =>
      [
        ...new Set(
          (setlist?.items ?? []).flatMap(i =>
            i.type === 'song' && i.songId ? [i.songId] : []
          )
        ),
      ].sort(),
    [setlist?.items]
  )
  const songsKey = ['songs', 'byIds', ...songIds]
  const songsQuery = useQuery({
    queryKey: songsKey,
    queryFn: () => repository.getSongsByIds(songIds),
    enabled: songIds.length > 0,
    placeholderData: keepPreviousData,
  })
  useRealtimeInvalidate({
    events: ['songs:changed'],
    bandId,
    queryKey: ['songs', 'byIds'],
  })
  const songsById = useMemo(
    () => new Map<string, Song>((songsQuery.data ?? []).map(s => [s.id!, s])),
    [songsQuery.data]
  )

  const run = useCallback(
    async <T>(
      op: () => Promise<T>,
      local?: (items: SetlistItem[]) => SetlistItem[]
    ): Promise<T> => {
      let prev: Setlist | null | undefined
      if (local) {
        await queryClient.cancelQueries({ queryKey: key })
        prev = queryClient.getQueryData<Setlist | null>(key)
        queryClient.setQueryData<Setlist | null>(key, s =>
          s ? { ...s, items: local(s.items ?? []) } : s
        )
      }
      try {
        return await op()
      } catch (err) {
        if (prev !== undefined) queryClient.setQueryData(key, prev)
        throw err
      } finally {
        await queryClient.invalidateQueries({ queryKey: ['setlists'] })
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, setlistId]
  )

  return {
    setlist,
    songsById,
    loading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
    run,
  }
}
