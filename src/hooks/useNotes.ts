import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { repository } from '../services/data/RepositoryFactory'
import { queryKeys, EMPTY_ARRAY } from '../services/queryClient'
import type { SongPersonalNoteInput } from '../models/SongPersonalNote'

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

  return new Set(query.data ?? EMPTY_ARRAY)
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
    entries: query.data ?? EMPTY_ARRAY,
    loading: query.isLoading,
    error: query.error as Error | null,
    refetch: useCallback(async () => {
      await query.refetch()
    }, [query]),
  }
}
