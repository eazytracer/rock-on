import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { SetlistService } from '../services/SetlistService'
import { repository } from '../services/data/RepositoryFactory'
import { queryKeys } from '../services/queryClient'
import { useRealtimeInvalidate } from './useRealtimeInvalidate'
import type { Setlist } from '../models/Setlist'
import type { SetlistItem } from '../types'

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
    setlists: query.data ?? [],
    loading: query.isLoading,
    error: query.error as Error | null,
  }
}

/**
 * Hook to create a new setlist.
 * Supports full Setlist structure including items (songs, breaks, sections).
 */
export function useCreateSetlist() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (setlistData: Partial<Setlist>) => {
      // For setlists with items, use the repository directly.
      if (setlistData.items && setlistData.items.length > 0) {
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
          lastModified: new Date(),
        }
        await repository.addSetlist(newSetlist)
        return newSetlist.id
      }

      // For legacy setlists without items, use SetlistService.
      const newSetlist = await SetlistService.createSetlist({
        name: setlistData.name || 'New Setlist',
        bandId: setlistData.bandId || '',
        showDate: setlistData.showDate
          ? setlistData.showDate.toISOString()
          : undefined,
        venue: setlistData.venue,
        notes: setlistData.notes,
      })
      return newSetlist.id
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['setlists'] })
    },
  })

  return {
    createSetlist: (setlistData: Partial<Setlist>) =>
      mutation.mutateAsync(setlistData),
    loading: mutation.isPending,
    error: mutation.error as Error | null,
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
    setlists: query.data ?? [],
    loading: query.isLoading,
    error: query.error as Error | null,
    refetch: useCallback(async () => {
      await query.refetch()
    }, [query]),
  }
}
