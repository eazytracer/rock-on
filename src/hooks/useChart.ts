import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../services/queryClient'
import { useRealtimeInvalidate } from './useRealtimeInvalidate'
import {
  getChart,
  saveChart,
  setStartingNote,
  copyLinkedChart,
  type SongChart,
} from '../services/api/charts'

/**
 * A song's own chart (`null` = none yet). `bandId` scopes live updates: a
 * bandmate's save refetches it (band songs only; personal charts have no feed).
 */
export function useChart(songId: string | null, bandId?: string) {
  const key = queryKeys.charts.detail(songId ?? '')
  const query = useQuery({
    queryKey: key,
    queryFn: () => getChart(songId!),
    enabled: !!songId,
  })
  useRealtimeInvalidate({
    events: ['song_charts:changed'],
    bandId,
    queryKey: key,
  })
  return {
    chart: query.data ?? null,
    loading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  }
}

/**
 * Whether "Copy ‹band›'s chart" applies: the band song a My Songs copy was made
 * from has a non-empty chart the user can still read. Pass the copy's
 * `linkedFromSongId`, and only when the copy's own chart is empty.
 */
export function useLinkedChartAvailable(linkedFromSongId: string | null) {
  const query = useQuery({
    queryKey: queryKeys.charts.detail(linkedFromSongId ?? ''),
    queryFn: () => getChart(linkedFromSongId!),
    enabled: !!linkedFromSongId,
    retry: false,
  })
  return !query.error && !!query.data?.chordpro
}

/**
 * Writes the cache with the server's row, so the version moves on at once
 * (the refetch then fills in the editor's name).
 */
function useChartWrite<A>(
  songId: string,
  write: (args: A) => Promise<SongChart>
) {
  const queryClient = useQueryClient()
  const key = queryKeys.charts.detail(songId)
  return useMutation({
    mutationFn: write,
    onSuccess: saved => queryClient.setQueryData<SongChart>(key, saved),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

/**
 * Save the chart text. Pass the version the editor opened (omit for a new
 * chart); `stale_version` / `chart_too_long` reject as ApiError.
 */
export function useSaveChart(songId: string) {
  const m = useChartWrite(
    songId,
    (a: { chordpro: string; expectedVersion?: number }) =>
      saveChart(songId, a.chordpro, a.expectedVersion)
  )
  return {
    saveChart: (chordpro: string, expectedVersion?: number) =>
      m.mutateAsync({ chordpro, expectedVersion }),
    saving: m.isPending,
  }
}

/** Starting note, saved as you pick (shown at once, rolled back on failure). */
export function useSetStartingNote(songId: string) {
  const queryClient = useQueryClient()
  const key = queryKeys.charts.detail(songId)
  const m = useMutation({
    mutationFn: (note: number | null) => setStartingNote(songId, note),
    onMutate: note => {
      const before = queryClient.getQueryData<SongChart | null>(key)
      if (before)
        queryClient.setQueryData(key, { ...before, startingNote: note })
      return { before }
    },
    onError: (_e, _note, ctx) => {
      if (ctx) queryClient.setQueryData(key, ctx.before)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
  return {
    setStartingNote: (note: number | null) => m.mutateAsync(note),
    saving: m.isPending,
  }
}

/** "Copy ‹band›'s chart" onto an empty My Songs copy. */
export function useCopyLinkedChart(songId: string) {
  const m = useChartWrite(songId, () => copyLinkedChart(songId))
  return {
    copyLinkedChart: () => m.mutateAsync(undefined),
    copying: m.isPending,
  }
}
