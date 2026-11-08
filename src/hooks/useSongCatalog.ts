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
  setSetlistItemNote,
  songNextShows,
  songUsage,
} from '../services/api/songs'
import { ApiError } from '../services/api/errors'
import { useToast } from '../contexts/ToastContext'
import { createLogger } from '../utils/logger'
import { readListView, type ListView } from '../domain/songs'
import { repository } from '../services/data/RepositoryFactory'
import type { Song } from '../models/Song'
import { useCreateSong, useUpdateSong } from './useSongs'

const log = createLogger('useSongCatalog')

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

/**
 * Song page (docs/redesign/10 · 1.3): each field saves on its own with the
 * version it was read at, then "‹Field› saved · Undo". If someone saved in
 * between, show theirs and say so; never retry on top of it.
 */
export function useSongFieldSave(song: Song | null) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const write = async (id: string, fields: Partial<Song>, version?: number) => {
    const saved = await repository.updateSong(id, fields, version)
    queryClient.setQueryData(queryKeys.songs.detail(id), saved)
    queryClient.invalidateQueries({
      queryKey: ['songs'],
      predicate: q => !(q.queryKey[1] === 'detail' && q.queryKey[2] === id),
    })
    return saved
  }

  const fail = (id: string, label: string, err: unknown) => {
    if (err instanceof ApiError && err.key === 'stale_version') {
      queryClient.invalidateQueries({ queryKey: queryKeys.songs.detail(id) })
      showToast('Someone just changed this. Showing the latest.', 'info')
      return
    }
    log.error(`Saving ${label} failed`, err)
    showToast(`Couldn't save ${label.toLowerCase()}. Try again.`, 'error')
  }

  return async (label: string, fields: Partial<Song>) => {
    if (!song) return
    const id = song.id
    const before = Object.fromEntries(
      Object.keys(fields).map(k => [k, song[k as keyof Song] ?? null])
    ) as Partial<Song>
    try {
      await write(id, fields, song.version)
    } catch (err) {
      fail(id, label, err)
      return
    }
    showToast(`${label} saved`, 'success', {
      action: {
        label: 'Undo',
        onClick: () => {
          const current = queryClient.getQueryData<Song>(
            queryKeys.songs.detail(id)
          )
          write(id, before, current?.version).then(
            () => showToast(`${label} restored`, 'success'),
            err => fail(id, label, err)
          )
        },
      },
    })
  }
}

export type BandNoteResult =
  | { ok: true }
  | { ok: false; theirs: string; editedBy?: string }

/**
 * Band note with Done (10 · 1.4). The song's version also moves when a fact
 * changes, so a stale version is only a conflict if the note itself changed
 * since `base` (the text the editor opened with); otherwise save again.
 */
export function useSaveBandNote(songId: string) {
  const queryClient = useQueryClient()
  const key = queryKeys.songs.detail(songId)
  const refresh = () =>
    queryClient.fetchQuery({
      queryKey: key,
      queryFn: () => repository.getSong(songId),
      staleTime: 0,
    })

  return async (
    draft: string,
    base: string,
    version?: number
  ): Promise<BandNoteResult> => {
    try {
      await setBandNote(songId, draft, version)
    } catch (err) {
      if (!(err instanceof ApiError && err.key === 'stale_version')) throw err
      const fresh = await refresh()
      if ((fresh?.notes ?? '') !== base)
        return {
          ok: false,
          theirs: fresh?.notes ?? '',
          editedBy: fresh?.notesEditedBy,
        }
      await setBandNote(songId, draft, fresh?.version)
    }
    await refresh()
    queryClient.invalidateQueries({
      queryKey: ['songs'],
      predicate: q => !(q.queryKey[1] === 'detail' && q.queryKey[2] === songId),
    })
    return { ok: true }
  }
}

/** "In ‹setlist›": this set's note for the song (one item, atomically). */
export function useSaveSetlistItemNote(setlistId: string) {
  const queryClient = useQueryClient()
  return async (itemId: string, notes: string) => {
    await setSetlistItemNote(setlistId, itemId, notes)
    await queryClient.invalidateQueries({ queryKey: ['setlists'] })
  }
}
