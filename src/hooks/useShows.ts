import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShowService } from '../services/ShowService'
import { queryKeys } from '../services/queryClient'
import { useRealtimeInvalidate } from './useRealtimeInvalidate'
import type { Show } from '../models/Show'

/**
 * Hook to fetch shows for a band (sorted by scheduled date ascending).
 *
 * Reads via TanStack Query (ephemeral cache); realtime `shows:changed` events
 * invalidate the query so other members' edits refetch. Return shape
 * (`shows`, `loading`, `error`) preserved for consumers.
 */
export function useShows(bandId: string) {
  const query = useQuery({
    queryKey: queryKeys.shows.band(bandId),
    queryFn: async () => {
      const response = await ShowService.getShows({ bandId })
      return [...response.shows].sort(
        (a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime()
      )
    },
    enabled: !!bandId,
  })

  useRealtimeInvalidate({
    events: ['shows:changed'],
    bandId,
    queryKey: queryKeys.shows.band(bandId),
  })

  return {
    shows: query.data ?? [],
    loading: query.isLoading,
    error: query.error as Error | null,
  }
}

/**
 * Hook to get upcoming and past shows separately.
 */
export function useUpcomingShows(bandId: string) {
  const { shows, loading, error } = useShows(bandId)

  const now = new Date()
  const upcomingShows = shows.filter(
    show => show.scheduledDate >= now && show.status !== 'cancelled'
  )
  const pastShows = shows.filter(
    show => show.scheduledDate < now || show.status === 'completed'
  )

  return { upcomingShows, pastShows, loading, error }
}

/**
 * Hook to create a new show.
 */
export function useCreateShow() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (showData: Partial<Show>) => {
      return ShowService.createShow({
        bandId: showData.bandId || '',
        name: showData.name || 'Untitled Show',
        scheduledDate: showData.scheduledDate || new Date(),
        duration: showData.duration || 120,
        venue: showData.venue,
        location: showData.location,
        loadInTime: showData.loadInTime,
        soundcheckTime: showData.soundcheckTime,
        payment: showData.payment,
        contacts: showData.contacts,
        setlistId: showData.setlistId,
        status: showData.status,
        notes: showData.notes,
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['shows'] })
    },
  })

  return {
    createShow: (showData: Partial<Show>) => mutation.mutateAsync(showData),
    loading: mutation.isPending,
    error: mutation.error as Error | null,
  }
}

/**
 * Hook to update a show.
 */
export function useUpdateShow() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async ({
      showId,
      updates,
    }: {
      showId: string
      updates: Partial<Show>
    }) => {
      await ShowService.updateShow(showId, updates)
      return true
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['shows'] })
    },
  })

  return {
    updateShow: (showId: string, updates: Partial<Show>) =>
      mutation.mutateAsync({ showId, updates }),
    loading: mutation.isPending,
    error: mutation.error as Error | null,
  }
}

/**
 * Hook to delete a show.
 */
export function useDeleteShow() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (showId: string) => {
      await ShowService.deleteShow(showId)
      return true
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['shows'] })
    },
  })

  return {
    deleteShow: (showId: string) => mutation.mutateAsync(showId),
    loading: mutation.isPending,
    error: mutation.error as Error | null,
  }
}
