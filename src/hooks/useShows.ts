import { useState, useEffect } from 'react'
import { ShowService } from '../services/ShowService'
import { getSyncRepository } from '../services/data/SyncRepository'
import type { Show } from '../models/Show'

/**
 * Hook to fetch shows for a band
 */
export function useShows(bandId: string) {
  const [shows, setShows] = useState<Show[]>([])
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
        const response = await ShowService.getShows({ bandId })

        // Sort by date (ascending)
        const sortedShows = [...response.shows].sort((a, b) => {
          return a.scheduledDate.getTime() - b.scheduledDate.getTime()
        })

        setShows(sortedShows)
        setError(null)
      } catch (err) {
        console.error('Error fetching shows:', err)
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    fetchShows()

    // Subscribe to sync changes for live updates
    const repo = getSyncRepository()
    const unsubscribe = repo.onSyncStatusChange(() => {
      fetchShows()
    })

    return unsubscribe
  }, [bandId])

  return { shows, loading, error }
}

/**
 * Hook to get upcoming and past shows separately
 */
export function useUpcomingShows(bandId: string) {
  const { shows, loading, error } = useShows(bandId)

  const now = new Date()
  const upcomingShows = shows.filter(show => show.scheduledDate >= now && show.status !== 'cancelled')
  const pastShows = shows.filter(show => show.scheduledDate < now || show.status === 'completed')

  return { upcomingShows, pastShows, loading, error }
}

/**
 * Hook to create a new show
 */
export function useCreateShow() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const createShow = async (showData: Partial<Show>) => {
    try {
      setLoading(true)
      setError(null)

      const newShow = await ShowService.createShow({
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
        notes: showData.notes
      })

      return newShow
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

  const updateShow = async (showId: string, updates: Partial<Show>) => {
    try {
      setLoading(true)
      setError(null)

      await ShowService.updateShow(showId, updates)

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

      await ShowService.deleteShow(showId)

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
