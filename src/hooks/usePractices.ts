import { useState, useEffect } from 'react'
import { db } from '../services/database'
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
        const bandPractices = await db.practiceSessions
          .where('bandId')
          .equals(bandId)
          .and(p => p.type === 'rehearsal')
          .toArray()

        // Sort by date
        bandPractices.sort((a, b) => {
          const dateA = new Date(a.scheduledDate).getTime()
          const dateB = new Date(b.scheduledDate).getTime()
          return dateA - dateB
        })

        setPractices(bandPractices)
        setError(null)
      } catch (err) {
        console.error('Error fetching practices:', err)
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    fetchPractices()
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

      const practiceId = crypto.randomUUID()
      const newPractice: PracticeSession = {
        id: practiceId,
        bandId: practiceData.bandId || '',
        type: 'rehearsal',
        scheduledDate: practiceData.scheduledDate || new Date(),
        duration: practiceData.duration || 120,
        status: practiceData.status || 'scheduled',
        songs: [],
        attendees: [],
        objectives: [],
        completedObjectives: [],
        ...practiceData
      } as PracticeSession

      await db.practiceSessions.add(newPractice)

      return practiceId
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

      await db.practiceSessions.update(practiceId, updates)

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

      await db.practiceSessions.delete(practiceId)

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
 */
export function useAutoSuggestSongs(bandId: string) {
  const [suggestedSongs, setSuggestedSongs] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const getSuggestions = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get upcoming shows
      const now = new Date()
      const upcomingShows = await db.practiceSessions
        .where('bandId')
        .equals(bandId)
        .and(s => s.type === 'gig' && new Date(s.scheduledDate) >= now)
        .toArray()

      // Get setlists for those shows
      const songIds = new Set<string>()

      for (const show of upcomingShows) {
        if (show.setlistId) {
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
