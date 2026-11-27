import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PracticeSessionService } from '../services/PracticeSessionService'
import { queryKeys, EMPTY_ARRAY } from '../services/queryClient'
import { useRealtimeInvalidate } from './useRealtimeInvalidate'
import { getPracticeEffectiveEnd } from '../utils/dateHelpers'

/**
 * Hook to fetch practices (rehearsals) for a band, sorted by date ascending.
 *
 * Reads via TanStack Query (ephemeral cache); realtime `practices:changed`
 * events invalidate the query. Return shape (`practices`, `loading`, `error`,
 * `refetch`) preserved for consumers.
 */
export function usePractices(bandId: string) {
  const query = useQuery({
    queryKey: queryKeys.practices.band(bandId),
    queryFn: async () => {
      const response = await PracticeSessionService.getSessions({ bandId })
      const rehearsals = response.sessions.filter(p => p.type === 'rehearsal')
      rehearsals.sort(
        (a, b) =>
          new Date(a.scheduledDate).getTime() -
          new Date(b.scheduledDate).getTime()
      )
      return rehearsals
    },
    enabled: !!bandId,
  })

  useRealtimeInvalidate({
    events: ['practices:changed'],
    bandId,
    queryKey: queryKeys.practices.band(bandId),
  })

  return {
    practices: query.data ?? EMPTY_ARRAY,
    loading: query.isLoading,
    error: query.error as Error | null,
    refetch: useCallback(async () => {
      await query.refetch()
    }, [query]),
  }
}

/**
 * Hook to get upcoming and past practices separately.
 */
export function useUpcomingPractices(bandId: string) {
  const { practices, loading, error, refetch } = usePractices(bandId)

  // Categorize on the practice's EFFECTIVE END (start + duration, or actual
  // endTime), not its start. A practice whose start has passed but whose end
  // has not is still upcoming/planned — not history. Memoized: consumers key
  // effects on these arrays, so they must keep their identity until
  // `practices` changes.
  const { upcomingPractices, pastPractices } = useMemo(() => {
    const now = new Date()
    return {
      upcomingPractices: practices.filter(
        practice => getPracticeEffectiveEnd(practice) >= now
      ),
      pastPractices: practices.filter(
        practice => getPracticeEffectiveEnd(practice) < now
      ),
    }
  }, [practices])

  return { upcomingPractices, pastPractices, loading, error, refetch }
}
