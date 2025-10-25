import { useState, useEffect } from 'react'
import { db } from '../services/database'
import type { Setlist } from '../models/Setlist'
import type { SetlistItem } from '../types'

/**
 * Hook to fetch setlists for a band
 */
export function useSetlists(bandId: string) {
  const [setlists, setSetlists] = useState<Setlist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!bandId) {
      setSetlists([])
      setLoading(false)
      return
    }

    const fetchSetlists = async () => {
      try {
        setLoading(true)
        const bandSetlists = await db.setlists
          .where('bandId')
          .equals(bandId)
          .toArray()

        setSetlists(bandSetlists)
        setError(null)
      } catch (err) {
        console.error('Error fetching setlists:', err)
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    fetchSetlists()
  }, [bandId])

  return { setlists, loading, error }
}

/**
 * Hook to create a new setlist
 */
export function useCreateSetlist() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const createSetlist = async (setlistData: Partial<Setlist>) => {
    try {
      setLoading(true)
      setError(null)

      const setlistId = crypto.randomUUID()
      const newSetlist: Setlist = {
        id: setlistId,
        name: setlistData.name || 'New Setlist',
        bandId: setlistData.bandId || '',
        items: [],
        totalDuration: 0,
        status: 'draft',
        createdDate: new Date(),
        lastModified: new Date(),
        ...setlistData
      }

      await db.setlists.add(newSetlist)

      return setlistId
    } catch (err) {
      console.error('Error creating setlist:', err)
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { createSetlist, loading, error }
}

/**
 * Hook to update a setlist
 */
export function useUpdateSetlist() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const updateSetlist = async (setlistId: string, updates: Partial<Setlist>) => {
    try {
      setLoading(true)
      setError(null)

      await db.setlists.update(setlistId, {
        ...updates,
        lastModified: new Date()
      })

      return true
    } catch (err) {
      console.error('Error updating setlist:', err)
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { updateSetlist, loading, error }
}

/**
 * Hook to delete a setlist
 */
export function useDeleteSetlist() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const deleteSetlist = async (setlistId: string) => {
    try {
      setLoading(true)
      setError(null)

      // Clear any show references to this setlist
      const shows = await db.practiceSessions
        .where('setlistId')
        .equals(setlistId)
        .toArray()

      for (const show of shows) {
        await db.practiceSessions.update(show.id!, { setlistId: undefined })
      }

      // Delete the setlist
      await db.setlists.delete(setlistId)

      return true
    } catch (err) {
      console.error('Error deleting setlist:', err)
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { deleteSetlist, loading, error }
}

/**
 * Hook to add an item to a setlist
 */
export function useAddSetlistItem() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const addItem = async (setlistId: string, item: Omit<SetlistItem, 'id' | 'position'>) => {
    try {
      setLoading(true)
      setError(null)

      const setlist = await db.setlists.get(setlistId)
      if (!setlist) throw new Error('Setlist not found')

      const items = setlist.items || []
      const newItem: SetlistItem = {
        ...item,
        id: crypto.randomUUID(),
        position: items.length + 1
      } as SetlistItem

      items.push(newItem)

      await db.setlists.update(setlistId, { items })

      return newItem
    } catch (err) {
      console.error('Error adding setlist item:', err)
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { addItem, loading, error }
}

/**
 * Hook to remove an item from a setlist
 */
export function useRemoveSetlistItem() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const removeItem = async (setlistId: string, itemId: string) => {
    try {
      setLoading(true)
      setError(null)

      const setlist = await db.setlists.get(setlistId)
      if (!setlist) throw new Error('Setlist not found')

      const items = setlist.items?.filter(item => item.id !== itemId) || []

      // Reindex positions
      items.forEach((item, index) => {
        item.position = index + 1
      })

      await db.setlists.update(setlistId, { items })

      return true
    } catch (err) {
      console.error('Error removing setlist item:', err)
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { removeItem, loading, error }
}

/**
 * Hook to reorder setlist items
 */
export function useReorderSetlistItems() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const reorderItems = async (setlistId: string, reorderedItems: SetlistItem[]) => {
    try {
      setLoading(true)
      setError(null)

      // Update positions
      reorderedItems.forEach((item, index) => {
        item.position = index + 1
      })

      await db.setlists.update(setlistId, { items: reorderedItems })

      return true
    } catch (err) {
      console.error('Error reordering setlist items:', err)
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { reorderItems, loading, error }
}
