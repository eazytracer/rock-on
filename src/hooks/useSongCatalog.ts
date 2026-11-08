import { useCallback, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys, EMPTY_ARRAY } from '../services/queryClient'
import { useRealtimeInvalidate } from './useRealtimeInvalidate'
import { getListViews, setListView } from '../services/api/preferences'
import {
  bandSongsNotInMyCatalog,
  copyBandSongsToPersonal,
  duplicateSong,
  setBandNote,
  songNextShows,
  songUsage,
} from '../services/api/songs'
import { readListView, type ListView } from '../domain/songs'
import { repository } from '../services/data/RepositoryFactory'
import type { Song } from '../models/Song'
import { useCreateSong, useUpdateSong } from './useSongs'

/** View options for one list (`songs:<contextId>`), saved to the account. */
export function useListView(
  userId: string,
  listKey: string
): [ListView, (changes: Partial<ListView>) => void] {
  const queryClient = useQueryClient()
  const key = queryKeys.listViews(userId)
  const query = useQuery({
    queryKey: key,
    queryFn: () => getListViews(userId),
    enabled: !!userId,
    staleTime: Infinity,
  })
  const view = useMemo(
    () => readListView(query.data?.[listKey]),
    [query.data, listKey]
  )
  const mutation = useMutation({
    mutationFn: (next: ListView) => setListView(userId, listKey, next),
  })
  const update = useCallback(
    (changes: Partial<ListView>) => {
      const next = { ...view, ...changes }
      queryClient.setQueryData(key, (old: Record<string, unknown> = {}) => ({
        ...old,
        [listKey]: next,
      }))
      mutation.mutate(next)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, listKey, userId]
  )
  return [view, update]
}

/** songId → soonest upcoming show (ms + name) for a band's songs. */
export function useSongNextShows(bandId: string) {
  const query = useQuery({
    queryKey: queryKeys.songs.nextShows(bandId),
    queryFn: () => songNextShows(bandId),
    enabled: !!bandId,
  })
  useRealtimeInvalidate({
    events: ['shows:changed', 'setlists:changed'],
    bandId,
    queryKey: queryKeys.songs.nextShows(bandId),
  })
  return useMemo(() => {
    const map = new Map<string, { at: number; name: string }>()
    for (const r of query.data ?? EMPTY_ARRAY) {
      if (r.song_id && r.starts_at)
        map.set(r.song_id, {
          at: new Date(r.starts_at).getTime(),
          name: r.show_name ?? '',
        })
    }
    return map
  }, [query.data])
}

/** "Used in": setlists, shows and upcoming practices for a song. */
export function useSongUsage(songId: string | null | undefined) {
  const query = useQuery({
    queryKey: queryKeys.songs.usage(songId ?? ''),
    queryFn: () => songUsage(songId!),
    enabled: !!songId,
  })
  return { usage: query.data ?? EMPTY_ARRAY, loading: query.isLoading }
}

/** Band songs with no linked copy in My Songs (Personal banner). */
export function useNotInMyCatalog(userId: string, enabled: boolean) {
  const query = useQuery({
    queryKey: queryKeys.songs.notInCatalog(userId),
    queryFn: bandSongsNotInMyCatalog,
    enabled: enabled && !!userId,
  })
  return query.data ?? EMPTY_ARRAY
}

export function useCopyToPersonal() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (ids: string[] | null) => copyBandSongsToPersonal(ids),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['songs'] }),
  })
  return (ids: string[] | null) => mutation.mutateAsync(ids)
}

export function useDuplicateSong() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: duplicateSong,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['songs'] }),
  })
  return (songId: string) => mutation.mutateAsync(songId)
}

export function useSetBandNote() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (v: { songId: string; notes: string; version?: number }) =>
      setBandNote(v.songId, v.notes, v.version),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['songs'] }),
  })
  return (songId: string, notes: string, version?: number) =>
    mutation.mutateAsync({ songId, notes, version })
}

/** One song, fresh from the server (song view). */
export function useSong(songId: string, initial?: Song) {
  const query = useQuery({
    queryKey: queryKeys.songs.detail(songId),
    queryFn: () => repository.getSong(songId),
    enabled: !!songId,
    placeholderData: initial,
  })
  useRealtimeInvalidate({
    events: ['songs:changed'],
    queryKey: queryKeys.songs.detail(songId),
  })
  return {
    song: query.data ?? null,
    loading: query.isLoading,
    error: query.error as Error | null,
  }
}

/**
 * Save from the song editor: create in the current context (and, if asked, a
 * linked copy in My Songs) or update. Returns the song id.
 */
export function useSaveSong(bandId: string | null, userId: string) {
  const { createSong } = useCreateSong()
  const { updateSong } = useUpdateSong()
  const copy = useCopyToPersonal()
  return async (
    song: Song,
    isNew: boolean,
    alsoSaveToPersonal?: boolean
  ): Promise<string> => {
    const fields: Partial<Song> = {
      title: song.title.trim(),
      artist: song.artist,
      album: song.album,
      duration: song.duration,
      key: song.key,
      bpm: song.bpm,
      guitarTuning: song.guitarTuning,
      tuningId: song.tuningId,
      tags: song.tags || [],
      referenceLinks: song.referenceLinks || [],
    }
    if (!isNew) {
      await updateSong(song.id, fields)
      return song.id
    }
    const id = await createSong({
      ...fields,
      difficulty: 1,
      structure: [],
      chords: [],
      confidenceLevel: 1,
      contextType: bandId ? 'band' : 'personal',
      contextId: bandId ?? userId,
      createdBy: userId,
      visibility: bandId ? 'band' : 'personal',
    })
    if (alsoSaveToPersonal && bandId) await copy([id])
    return id
  }
}
