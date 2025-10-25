import { useState, useEffect } from 'react'
import { db } from '../services/database'
import type { PracticeSession } from '../models/PracticeSession'

/**
 * Hook to fetch shows (gigs) for a band
 */
export function useShows(bandId: string) {
  const [shows, setShows] = useState<PracticeSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!bandId) {
      setShows([])
      setLoading(false)
      return
    }

    const fetchShows = async () => {
      try {
        setLoading(true)
        const bandShows = await db.practiceSessions
          .where('bandId')
          .equals(bandId)
          .and(s => s.type === 'gig')
          .toArray()

        // Sort by date
        bandShows.sort((a, b) => {
          const dateA = new Date(a.scheduledDate).getTime()
          const dateB = new Date(b.scheduledDate).getTime()
          return dateA - dateB
        })

        setShows(bandShows)
        setError(null)
      } catch (err) {
        console.error('Error fetching shows:', err)
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    fetchShows()
  }, [bandId])

  return { shows, loading, error }
}

/**
 * Hook to get upcoming and past shows separately
 */
export function useUpcomingShows(bandId: string) {
  const { shows, loading, error } = useShows(bandId)

  const now = new Date()
  const upcomingShows = shows.filter(show => new Date(show.scheduledDate) >= now)
  const pastShows = shows.filter(show => new Date(show.scheduledDate) < now)

  return { upcomingShows, pastShows, loading, error }
}

/**
 * Hook to create a new show
 */
export function useCreateShow() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const createShow = async (showData: Partial<PracticeSession>) => {
    try {
      setLoading(true)
      setError(null)

      const showId = crypto.randomUUID()
      const newShow: PracticeSession = {
        id: showId,
        bandId: showData.bandId || '',
        type: 'gig',
        scheduledDate: showData.scheduledDate || new Date(),
        duration: showData.duration || 90,
        status: showData.status || 'scheduled',
        songs: [],
        attendees: [],
        objectives: [],
        completedObjectives: [],
        ...showData
      } as PracticeSession

      await db.practiceSessions.add(newShow)

      return showId
    } catch (err) {
      console.error('Error creating show:', err)
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { createShow, loading, error }
}

/**
 * Hook to update a show
 */
export function useUpdateShow() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const updateShow = async (showId: string, updates: Partial<PracticeSession>) => {
    try {
      setLoading(true)
      setError(null)

      await db.practiceSessions.update(showId, updates)

      return true
    } catch (err) {
      console.error('Error updating show:', err)
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { updateShow, loading, error }
}

/**
 * Hook to delete a show
 */
export function useDeleteShow() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const deleteShow = async (showId: string) => {
    try {
      setLoading(true)
      setError(null)

      // Get the show to find associated setlist
      const show = await db.practiceSessions.get(showId)

      if (show?.setlistId) {
        // Clear the showId reference in the setlist
        const setlist = await db.setlists.get(show.setlistId)
        if (setlist && setlist.showId === showId) {
          await db.setlists.update(show.setlistId, { showId: undefined })
        }
      }

      // Delete the show
      await db.practiceSessions.delete(showId)

      return true
    } catch (err) {
      console.error('Error deleting show:', err)
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { deleteShow, loading, error }
}
