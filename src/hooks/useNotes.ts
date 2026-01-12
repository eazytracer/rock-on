import { useState, useEffect, useCallback } from 'react'
import { db } from '../services/database'
import { getSyncRepository } from '../services/data/SyncRepository'
import type {
  SongPersonalNote,
  SongPersonalNoteInput,
} from '../models/SongPersonalNote'
import type { SongNoteEntry, SongNoteEntryInput } from '../models/SongNoteEntry'

/**
 * Hook to manage band-level notes on a song (song.notes field)
 */
export function useBandNotes(songId: string) {
  const [notes, setNotes] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchNotes = useCallback(async () => {
    try {
      setLoading(true)
      const song = await db.songs.get(songId)
      setNotes(song?.notes || '')
      setError(null)
    } catch (err) {
      console.error('[useBandNotes] Error fetching notes:', err)
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [songId])

  useEffect(() => {
    if (!songId) {
      setNotes('')
      setLoading(false)
      return
    }

    fetchNotes()
  }, [songId, fetchNotes])

  const updateNotes = async (newNotes: string) => {
    try {
      setError(null)
      await getSyncRepository().updateSong(songId, { notes: newNotes })
      setNotes(newNotes)
    } catch (err) {
      console.error('[useBandNotes] Error updating notes:', err)
      setError(err as Error)
      throw err
    }
  }

  return {
    notes,
    loading,
    error,
    updateNotes,
    refetch: fetchNotes,
  }
}

/**
 * Hook to manage personal notes for a song
 */
export function usePersonalNote(
  songId: string,
  userId: string,
  bandId: string
) {
  const [personalNote, setPersonalNote] = useState<SongPersonalNote | null>(
    null
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchNote = useCallback(async () => {
    try {
      setLoading(true)
      const note = await db.songPersonalNotes
        .where('[songId+userId+bandId]')
        .equals([songId, userId, bandId])
        .first()
      setPersonalNote(note || null)
      setError(null)
    } catch (err) {
      console.error('[usePersonalNote] Error fetching note:', err)
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [songId, userId, bandId])

  useEffect(() => {
    if (!songId || !userId || !bandId) {
      setPersonalNote(null)
      setLoading(false)
      return
    }

    fetchNote()
  }, [songId, userId, bandId, fetchNote])

  const upsertNote = async (content: string) => {
    try {
      setError(null)
      const input: SongPersonalNoteInput = {
        songId,
        userId,
        bandId,
        content,
      }

      // Use local repository directly (not yet synced to remote)
      const repo = getSyncRepository()
      const updated = await repo.upsertPersonalNote(input)
      setPersonalNote(updated)
      return updated
    } catch (err) {
      console.error('[usePersonalNote] Error upserting note:', err)
      setError(err as Error)
      throw err
    }
  }

  const deleteNote = async () => {
    try {
      if (!personalNote) return

      setError(null)
      const repo = getSyncRepository()
      await repo.deletePersonalNote(personalNote.id)
      setPersonalNote(null)
    } catch (err) {
      console.error('[usePersonalNote] Error deleting note:', err)
      setError(err as Error)
      throw err
    }
  }

  return {
    personalNote,
    loading,
    error,
    upsertNote,
    deleteNote,
    refetch: fetchNote,
  }
}

/**
 * Hook to fetch note entries for a song
 */
export function useNoteEntries(songId: string, bandId: string, userId: string) {
  const [entries, setEntries] = useState<SongNoteEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true)

      // Fetch all entries for the song
      const allEntries = await db.songNoteEntries
        .where('songId')
        .equals(songId)
        .filter(e => e.bandId === bandId)
        .toArray()

      // Filter to show only band-visible entries OR user's personal entries
      const visibleEntries = allEntries.filter(
        entry => entry.visibility === 'band' || entry.userId === userId
      )

      // Sort by date (newest first)
      visibleEntries.sort((a, b) => {
        const dateA = new Date(b.createdDate).getTime()
        const dateB = new Date(a.createdDate).getTime()
        return dateA - dateB
      })

      setEntries(visibleEntries)
      setError(null)
    } catch (err) {
      console.error('[useNoteEntries] Error fetching entries:', err)
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [songId, bandId, userId])

  useEffect(() => {
    if (!songId || !bandId) {
      setEntries([])
      setLoading(false)
      return
    }

    fetchEntries()
  }, [songId, bandId, fetchEntries])

  return {
    entries,
    loading,
    error,
    refetch: fetchEntries,
  }
}

/**
 * Hook to create a note entry
 */
export function useCreateNoteEntry() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const createEntry = async (input: SongNoteEntryInput) => {
    try {
      setLoading(true)
      setError(null)

      const repo = getSyncRepository()
      const entry = await repo.createNoteEntry(input)

      return entry
    } catch (err) {
      console.error('[useCreateNoteEntry] Error creating entry:', err)
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return {
    createEntry,
    loading,
    error,
  }
}

/**
 * Hook to update a note entry
 */
export function useUpdateNoteEntry() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const updateEntry = async (
    entryId: string,
    content: string,
    visibility: 'personal' | 'band'
  ) => {
    try {
      setLoading(true)
      setError(null)

      const repo = getSyncRepository()
      const updated = await repo.updateNoteEntry(entryId, {
        content,
        visibility,
      })

      return updated
    } catch (err) {
      console.error('[useUpdateNoteEntry] Error updating entry:', err)
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return {
    updateEntry,
    loading,
    error,
  }
}

/**
 * Hook to delete a note entry
 */
export function useDeleteNoteEntry() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const deleteEntry = async (entryId: string) => {
    try {
      setLoading(true)
      setError(null)

      const repo = getSyncRepository()
      await repo.deleteNoteEntry(entryId)

      return true
    } catch (err) {
      console.error('[useDeleteNoteEntry] Error deleting entry:', err)
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return {
    deleteEntry,
    loading,
    error,
  }
}
