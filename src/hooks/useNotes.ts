import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { repository } from '../services/data/RepositoryFactory'
import { queryKeys } from '../services/queryClient'
import type { SongPersonalNoteInput } from '../models/SongPersonalNote'
import type { SongNoteEntry, SongNoteEntryInput } from '../models/SongNoteEntry'

/**
 * Hook to manage band-level notes on a song (song.notes field).
 */
export function useBandNotes(songId: string) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: [...queryKeys.songs.detail(songId), 'bandNotes'],
    queryFn: async () => {
      const song = await repository.getSong(songId)
      return song?.notes || ''
    },
    enabled: !!songId,
  })

  const mutation = useMutation({
    mutationFn: async (newNotes: string) => {
      await repository.updateSong(songId, { notes: newNotes })
      return newNotes
    },
    onSuccess: newNotes => {
      queryClient.setQueryData(
        [...queryKeys.songs.detail(songId), 'bandNotes'],
        newNotes
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['songs'] })
    },
  })

  return {
    notes: query.data ?? '',
    loading: query.isLoading,
    error: (query.error || mutation.error) as Error | null,
    updateNotes: (newNotes: string) => mutation.mutateAsync(newNotes),
    refetch: useCallback(async () => {
      await query.refetch()
    }, [query]),
  }
}

/**
 * Hook to manage personal notes for a song.
 */
export function usePersonalNote(
  songId: string,
  userId: string,
  bandId: string
) {
  const queryClient = useQueryClient()
  const queryKey = [...queryKeys.notes.personalForUser(userId, bandId), songId]

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const note = await repository.getPersonalNote(songId, userId, bandId)
      return note || null
    },
    enabled: !!songId && !!userId && !!bandId,
  })

  const upsertMutation = useMutation({
    mutationFn: async (content: string) => {
      const input: SongPersonalNoteInput = { songId, userId, bandId, content }
      return repository.upsertPersonalNote(input)
    },
    onSuccess: updated => {
      queryClient.setQueryData(queryKey, updated)
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notes.personalForUser(userId, bandId),
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      await repository.deletePersonalNote(noteId)
    },
    onSuccess: () => {
      queryClient.setQueryData(queryKey, null)
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notes.personalForUser(userId, bandId),
      })
    },
  })

  const personalNote = query.data ?? null

  return {
    personalNote,
    loading: query.isLoading,
    error: (query.error ||
      upsertMutation.error ||
      deleteMutation.error) as Error | null,
    upsertNote: (content: string) => upsertMutation.mutateAsync(content),
    deleteNote: async () => {
      if (!personalNote) return
      await deleteMutation.mutateAsync(personalNote.id)
    },
    refetch: useCallback(async () => {
      await query.refetch()
    }, [query]),
  }
}

/**
 * Hook to determine which of the given songs have a non-empty personal note
 * for the current user + band context. Fetches the user's notes once and
 * filters client-side, for use in list views (e.g. SongsPage).
 */
export function useBulkPersonalNotePresence(
  songIds: string[],
  userId: string,
  bandId: string
): Set<string> {
  const idsKey = [...songIds].sort().join(',')

  const query = useQuery({
    queryKey: [
      ...queryKeys.notes.personalForUser(userId, bandId),
      'presence',
      idsKey,
    ],
    queryFn: async () => {
      const notes = await repository.getPersonalNotesForUser(userId, bandId)
      const idSet = new Set(songIds)
      return notes
        .filter(note => idSet.has(note.songId) && !!note.content?.trim())
        .map(note => note.songId)
    },
    enabled: songIds.length > 0 && !!userId && !!bandId,
  })

  return new Set(query.data ?? [])
}

/**
 * Hook to fetch note entries for a song (band-visible + the user's own),
 * newest first.
 */
export function useNoteEntries(songId: string, bandId: string, userId: string) {
  const query = useQuery({
    queryKey: queryKeys.notes.entriesForSong(songId, bandId),
    queryFn: async () => {
      const allEntries = await repository.getNoteEntriesForSong(songId, bandId)
      const visibleEntries = allEntries.filter(
        entry => entry.visibility === 'band' || entry.userId === userId
      )
      visibleEntries.sort(
        (a, b) =>
          new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()
      )
      return visibleEntries
    },
    enabled: !!songId && !!bandId,
  })

  return {
    entries: query.data ?? [],
    loading: query.isLoading,
    error: query.error as Error | null,
    refetch: useCallback(async () => {
      await query.refetch()
    }, [query]),
  }
}

/**
 * Hook to create a note entry.
 */
export function useCreateNoteEntry() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (input: SongNoteEntryInput) =>
      repository.createNoteEntry(input),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
    },
  })

  return {
    createEntry: (input: SongNoteEntryInput) => mutation.mutateAsync(input),
    loading: mutation.isPending,
    error: mutation.error as Error | null,
  }
}

/**
 * Hook to update a note entry.
 */
export function useUpdateNoteEntry() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: ({
      entryId,
      content,
      visibility,
    }: {
      entryId: string
      content: string
      visibility: 'personal' | 'band'
    }): Promise<SongNoteEntry> =>
      repository.updateNoteEntry(entryId, { content, visibility }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
    },
  })

  return {
    updateEntry: (
      entryId: string,
      content: string,
      visibility: 'personal' | 'band'
    ) => mutation.mutateAsync({ entryId, content, visibility }),
    loading: mutation.isPending,
    error: mutation.error as Error | null,
  }
}

/**
 * Hook to delete a note entry.
 */
export function useDeleteNoteEntry() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (entryId: string) => {
      await repository.deleteNoteEntry(entryId)
      return true
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
    },
  })

  return {
    deleteEntry: (entryId: string) => mutation.mutateAsync(entryId),
    loading: mutation.isPending,
    error: mutation.error as Error | null,
  }
}
