import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShowService } from '../services/ShowService'
import { queryKeys, EMPTY_ARRAY } from '../services/queryClient'
import { useRealtimeInvalidate } from './useRealtimeInvalidate'

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
    shows: query.data ?? EMPTY_ARRAY,
    loading: query.isLoading,
    error: query.error as Error | null,
  }
}

/**
 * Hook to get upcoming and past shows separately.
 */
export function useUpcomingShows(bandId: string) {
  const { shows, loading, error } = useShows(bandId)

  // Memoized: consumers key effects on these arrays, so they must keep their
  // identity until `shows` changes.
  const { upcomingShows, pastShows } = useMemo(() => {
    const now = new Date()
    return {
      upcomingShows: shows.filter(
        show => show.scheduledDate >= now && show.status !== 'cancelled'
      ),
      pastShows: shows.filter(
        show => show.scheduledDate < now || show.status === 'completed'
      ),
    }
  }, [shows])

  return { upcomingShows, pastShows, loading, error }
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
