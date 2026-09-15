import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PracticeSessionService } from '../services/PracticeSessionService'
import { repository } from '../services/data/RepositoryFactory'
import { queryKeys } from '../services/queryClient'
import { useRealtimeInvalidate } from './useRealtimeInvalidate'
import type { PracticeSession } from '../models/PracticeSession'
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
    practices: query.data ?? [],
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

  const now = new Date()
  // Categorize on the practice's EFFECTIVE END (start + duration, or actual
  // endTime), not its start. A practice whose start has passed but whose end
  // has not is still upcoming/planned — not history.
  const upcomingPractices = practices.filter(
    practice => getPracticeEffectiveEnd(practice) >= now
  )
  const pastPractices = practices.filter(
    practice => getPracticeEffectiveEnd(practice) < now
  )

  return { upcomingPractices, pastPractices, loading, error, refetch }
}

/**
 * Hook to create a new practice.
 */
export function useCreatePractice() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (practiceData: Partial<PracticeSession>) => {
      const newPractice = await PracticeSessionService.createSession({
        bandId: practiceData.bandId || '',
        type: 'rehearsal',
        scheduledDate: (practiceData.scheduledDate || new Date()).toISOString(),
        duration: practiceData.duration || 120,
        location: practiceData.location,
        songs: practiceData.songs?.map(s =>
          typeof s === 'string' ? s : s.songId
        ),
        invitees: practiceData.attendees?.map(a =>
          typeof a === 'string' ? a : a.memberId
        ),
        objectives: practiceData.objectives || [],
        notes: practiceData.notes,
      })
      return newPractice.id
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['practices'] })
    },
  })

  return {
    createPractice: (practiceData: Partial<PracticeSession>) =>
      mutation.mutateAsync(practiceData),
    loading: mutation.isPending,
    error: mutation.error as Error | null,
  }
}

/**
 * Hook to duplicate an existing practice as a starting point for a new one.
 */
export function useDuplicatePractice() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async ({
      practiceId,
      overrides,
    }: {
      practiceId: string
      overrides?: { scheduledDate?: Date }
    }) => {
      const newPractice = await PracticeSessionService.duplicateSession(
        practiceId,
        overrides
      )
      return newPractice.id
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['practices'] })
    },
  })

  return {
    duplicatePractice: (
      practiceId: string,
      overrides?: { scheduledDate?: Date }
    ) => mutation.mutateAsync({ practiceId, overrides }),
    loading: mutation.isPending,
    error: mutation.error as Error | null,
  }
}

/**
 * Hook to update a practice.
 */
export function useUpdatePractice() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async ({
      practiceId,
      updates,
    }: {
      practiceId: string
      updates: Partial<PracticeSession>
    }) => {
      await PracticeSessionService.updateSession(practiceId, {
        scheduledDate: updates.scheduledDate
          ? new Date(updates.scheduledDate).toISOString()
          : undefined,
        duration: updates.duration,
        location: updates.location,
        objectives: updates.objectives,
        notes: updates.notes,
        wrapupNotes: updates.wrapupNotes,
        status: updates.status,
        songs: updates.songs,
      })
      return true
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['practices'] })
    },
  })

  return {
    updatePractice: (practiceId: string, updates: Partial<PracticeSession>) =>
      mutation.mutateAsync({ practiceId, updates }),
    loading: mutation.isPending,
    error: mutation.error as Error | null,
  }
}

/**
 * Hook to delete a practice.
 */
export function useDeletePractice() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (practiceId: string) => {
      await PracticeSessionService.deleteSession(practiceId)
      return true
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['practices'] })
    },
  })

  return {
    deletePractice: (practiceId: string) => mutation.mutateAsync(practiceId),
    loading: mutation.isPending,
    error: mutation.error as Error | null,
  }
}

/**
 * Hook to get song suggestions from upcoming shows/gigs (their setlists).
 */
export function useAutoSuggestSongs(bandId: string) {
  const [suggestedSongs, setSuggestedSongs] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const getSuggestions = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get upcoming shows (gigs) using PracticeSessionService.
      const now = new Date()
      const response = await PracticeSessionService.getSessions({
        bandId,
        startDate: now.toISOString(),
      })

      const upcomingShows = response.sessions.filter(s => s.type === 'gig')

      // Collect song IDs from each upcoming show's setlist (via repository).
      const songIds = new Set<string>()
      for (const show of upcomingShows) {
        if (show.setlistId) {
          const setlist = await repository.getSetlist(show.setlistId)
          if (setlist?.items) {
            setlist.items.forEach(item => {
              if (item.type === 'song' && item.songId) {
                songIds.add(item.songId)
              }
            })
          }
        }
      }

      setSuggestedSongs(Array.from(songIds))
      return Array.from(songIds)
    } catch (err) {
      console.error('Error getting song suggestions:', err)
      setError(err as Error)
      return []
    } finally {
      setLoading(false)
    }
  }

  return { suggestedSongs, getSuggestions, loading, error }
}
