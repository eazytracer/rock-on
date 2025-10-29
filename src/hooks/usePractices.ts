import { useState, useEffect } from 'react'
import { PracticeSessionService } from '../services/PracticeSessionService'
import { getSyncRepository } from '../services/data/SyncRepository'
import type { PracticeSession } from '../models/PracticeSession'

/**
 * Hook to fetch practices (rehearsals) for a band
 */
export function usePractices(bandId: string) {
  const [practices, setPractices] = useState<PracticeSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!bandId) {
      setPractices([])
      setLoading(false)
      return
    }

    const fetchPractices = async () => {
      try {
        setLoading(true)
        const response = await PracticeSessionService.getSessions({ bandId })

        // Filter to only rehearsals
        const rehearsals = response.sessions.filter(p => p.type === 'rehearsal')

        // Sort by date (ascending)
        rehearsals.sort((a, b) => {
          const dateA = new Date(a.scheduledDate).getTime()
          const dateB = new Date(b.scheduledDate).getTime()
          return dateA - dateB
        })

        setPractices(rehearsals)
        setError(null)
      } catch (err) {
        console.error('Error fetching practices:', err)
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    fetchPractices()

    // Subscribe to sync changes for live updates
    const repo = getSyncRepository()
    const unsubscribe = repo.onSyncStatusChange(() => {
      fetchPractices()
    })

    return unsubscribe
  }, [bandId])

  return { practices, loading, error }
}

/**
 * Hook to get upcoming and past practices separately
 */
export function useUpcomingPractices(bandId: string) {
  const { practices, loading, error } = usePractices(bandId)

  const now = new Date()
  const upcomingPractices = practices.filter(practice => new Date(practice.scheduledDate) >= now)
  const pastPractices = practices.filter(practice => new Date(practice.scheduledDate) < now)

  return { upcomingPractices, pastPractices, loading, error }
}

/**
 * Hook to create a new practice
 */
export function useCreatePractice() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const createPractice = async (practiceData: Partial<PracticeSession>) => {
    try {
      setLoading(true)
      setError(null)

      const newPractice = await PracticeSessionService.createSession({
        bandId: practiceData.bandId || '',
        type: 'rehearsal',
        scheduledDate: (practiceData.scheduledDate || new Date()).toISOString(),
        duration: practiceData.duration || 120,
        location: practiceData.location,
        songs: practiceData.songs?.map(s => typeof s === 'string' ? s : s.songId),
        invitees: practiceData.attendees?.map(a => typeof a === 'string' ? a : a.memberId),
        objectives: practiceData.objectives || [],
        notes: practiceData.notes
      })

      return newPractice.id
    } catch (err) {
      console.error('Error creating practice:', err)
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { createPractice, loading, error }
}

/**
 * Hook to update a practice
 */
export function useUpdatePractice() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const updatePractice = async (practiceId: string, updates: Partial<PracticeSession>) => {
    try {
      setLoading(true)
      setError(null)

      await PracticeSessionService.updateSession(practiceId, {
        scheduledDate: updates.scheduledDate ? new Date(updates.scheduledDate).toISOString() : undefined,
        duration: updates.duration,
        location: updates.location,
        objectives: updates.objectives,
        notes: updates.notes
      })

      return true
    } catch (err) {
      console.error('Error updating practice:', err)
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { updatePractice, loading, error }
}

/**
 * Hook to delete a practice
 */
export function useDeletePractice() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const deletePractice = async (practiceId: string) => {
    try {
      setLoading(true)
      setError(null)

      await PracticeSessionService.deleteSession(practiceId)

      return true
    } catch (err) {
      console.error('Error deleting practice:', err)
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { deletePractice, loading, error }
}

/**
 * Hook to get song suggestions from upcoming shows
 *
 * NOTE: This hook still uses direct database access for setlists.
 * Full migration requires SetlistService integration which is tracked separately.
 */
export function useAutoSuggestSongs(bandId: string) {
  const [suggestedSongs, setSuggestedSongs] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const getSuggestions = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get upcoming shows (gigs) using PracticeSessionService
      const now = new Date()
      const response = await PracticeSessionService.getSessions({
        bandId,
        startDate: now.toISOString()
      })

      // Filter to only shows/gigs
      const upcomingShows = response.sessions.filter(s => s.type === 'gig')

      // Get setlists for those shows
      const songIds = new Set<string>()

      // Note: This still requires direct database access for setlists
      // until SetlistService provides the necessary methods
      for (const show of upcomingShows) {
        if (show.setlistId) {
          const { db } = await import('../services/database')
          const setlist = await db.setlists.get(show.setlistId)
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
