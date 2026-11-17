import { useCallback, useMemo } from 'react'
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { repository } from '../services/data/RepositoryFactory'
import { queryKeys } from '../services/queryClient'
import { useRealtimeInvalidate } from './useRealtimeInvalidate'
import { calendarAgenda } from '../services/api/calendar'
import { freshPracticeSong, weekLater } from '../domain/calendar'
import type { Show } from '../models/Show'
import type { PracticeSession } from '../models/PracticeSession'
import type { Song } from '../models/Song'

const NO_ROWS: never[] = []

const LAST_KEY = 'calendar:last'

/** Remembers the agenda's query (filter, selection) for "‹ Calendar". */
export function rememberCalendar(search: string) {
  try {
    sessionStorage.setItem(LAST_KEY, search)
  } catch {
    /* convenience only */
  }
}

/** Where "‹ Calendar" goes: the agenda as last seen, else `fallback`. */
export function calendarBackTo(fallback: string) {
  try {
    const last = sessionStorage.getItem(LAST_KEY)
    if (last !== null) return `/calendar${last}`
  } catch {
    /* convenience only */
  }
  return fallback
}

/** The band's shows and practices for the agenda (jams come from useEvents). */
export function useAgenda(bandId: string) {
  const queryKey = ['calendar', 'agenda', bandId]
  const query = useQuery({
    queryKey,
    queryFn: () => calendarAgenda(bandId),
    enabled: !!bandId,
  })
  useRealtimeInvalidate({
    events: ['shows:changed', 'practices:changed', 'setlists:changed'],
    bandId,
    queryKey: ['calendar'],
  })
  return {
    rows: query.data ?? NO_ROWS,
    loading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  }
}

/**
 * One show for the show page. `run(op, local)` applies `local` to the cached
 * show at once, runs the server op, rolls back on failure and refetches.
 */
export function useShowPage(showId: string | null) {
  const queryClient = useQueryClient()
  const key = queryKeys.shows.detail(showId ?? '')
  const query = useQuery({
    queryKey: key,
    queryFn: () => repository.getShow(showId!),
    enabled: !!showId,
  })
  const show = query.data ?? null

  useRealtimeInvalidate({
    events: ['shows:changed'],
    bandId: show?.bandId,
    queryKey: key,
  })

  const run = useCallback(
    async (op: () => Promise<unknown>, local?: Partial<Show>) => {
      const before = queryClient.getQueryData<Show | null>(key)
      if (local && before) {
        queryClient.setQueryData<Show>(key, { ...before, ...local })
      }
      try {
        await op()
      } catch (e) {
        if (local) queryClient.setQueryData(key, before)
        throw e
      } finally {
        void queryClient.invalidateQueries({ queryKey: key })
        void queryClient.invalidateQueries({ queryKey: ['calendar'] })
        void queryClient.invalidateQueries({ queryKey: ['shows'] })
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, showId]
  )

  return {
    show,
    loading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
    run,
  }
}

/**
 * One practice with its songs. `save(patch)` writes through the repository
 * (applied to the cache at once, rolled back on failure).
 */
export function usePracticePage(practiceId: string | null) {
  const queryClient = useQueryClient()
  const key = queryKeys.practices.detail(practiceId ?? '')
  const query = useQuery({
    queryKey: key,
    queryFn: () => repository.getPracticeSession(practiceId!),
    enabled: !!practiceId,
  })
  const practice = query.data ?? null

  useRealtimeInvalidate({
    events: ['practices:changed'],
    bandId: practice?.bandId,
    queryKey: key,
  })

  const songIds = useMemo(
    () => [...new Set((practice?.songs ?? []).map(s => s.songId))].sort(),
    [practice?.songs]
  )
  const songsQuery = useQuery({
    queryKey: ['songs', 'byIds', ...songIds],
    queryFn: () => repository.getSongsByIds(songIds),
    enabled: songIds.length > 0,
    placeholderData: keepPreviousData,
  })
  useRealtimeInvalidate({
    events: ['songs:changed'],
    bandId: practice?.bandId,
    queryKey: ['songs', 'byIds'],
  })
  const songsById = useMemo(
    () => new Map<string, Song>((songsQuery.data ?? []).map(s => [s.id!, s])),
    [songsQuery.data]
  )

  const save = useCallback(
    async (patch: Partial<PracticeSession>) => {
      const before = queryClient.getQueryData<PracticeSession | null>(key)
      if (before) queryClient.setQueryData(key, { ...before, ...patch })
      try {
        await repository.updatePracticeSession(practiceId!, patch)
      } catch (e) {
        queryClient.setQueryData(key, before)
        throw e
      } finally {
        void queryClient.invalidateQueries({ queryKey: ['practices'] })
        void queryClient.invalidateQueries({ queryKey: ['calendar'] })
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, practiceId]
  )

  return {
    practice,
    songsById,
    loading: query.isLoading,
    error: query.error as Error | null,
    save,
  }
}

/** A new practice in the band (the blank practice page's first save). */
export async function createPractice(
  bandId: string,
  userId: string | undefined,
  fields: Partial<PracticeSession>
): Promise<string> {
  const saved = await repository.addPracticeSession({
    id: crypto.randomUUID(),
    bandId,
    type: 'rehearsal',
    status: 'scheduled',
    duration: 120,
    songs: [],
    objectives: [],
    completedObjectives: [],
    attendees: [],
    createdDate: new Date(),
    lastModifiedBy: userId,
    ...fields,
  } as PracticeSession)
  return saved.id
}

/**
 * Duplicate: the same name, place, focus and songs (fresh, notes kept) a week
 * later. Returns the new practice's id.
 */
export async function duplicatePractice(
  practiceId: string,
  userId: string | undefined
): Promise<string> {
  const p = await repository.getPracticeSession(practiceId)
  if (!p) throw new Error('That practice was deleted.')
  return createPractice(p.bandId, userId, {
    name: p.name,
    scheduledDate: weekLater(new Date(p.scheduledDate)),
    duration: p.duration,
    location: p.location,
    notes: p.notes,
    type: p.type,
    songs: p.songs.map(s => freshPracticeSong(s.songId, s.notes)),
  })
}
