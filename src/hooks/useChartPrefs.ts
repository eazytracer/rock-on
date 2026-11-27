import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { queryKeys } from '../services/queryClient'
import {
  CHART_PREF_DEFAULTS,
  getChartPrefs,
  setChartPrefs,
  type ChartPrefs,
} from '../services/api/preferences'
import { createLogger } from '../utils/logger'

const log = createLogger('useChartPrefs')

/**
 * The reader's size, chords on / off and this song's transpose, saved to
 * `user_preferences.chart` (per user: a bandmate sees the original key).
 * Changes show at once; a failed save only logs (it's view state).
 */
export function useChartPrefs(songId: string) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const queryClient = useQueryClient()
  const key = queryKeys.chartPrefs(userId)
  const query = useQuery({
    queryKey: key,
    queryFn: () => getChartPrefs(userId),
    enabled: !!userId,
    staleTime: 60_000,
  })
  const prefs = query.data ?? CHART_PREF_DEFAULTS
  const save = useMutation({
    mutationFn: (next: ChartPrefs) => setChartPrefs(userId, next),
    onError: err => log.error('Save chart prefs failed', err),
  })

  const update = useCallback(
    (fn: (p: ChartPrefs) => ChartPrefs) => {
      const cur =
        queryClient.getQueryData<ChartPrefs>(key) ?? CHART_PREF_DEFAULTS
      const next = fn(cur)
      queryClient.setQueryData(key, next)
      if (userId) save.mutate(next)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, userId]
  )

  return {
    loaded: !userId || query.isFetched,
    size: prefs.size,
    chords: prefs.chords,
    transpose: prefs.transpose[songId] ?? 0,
    // Steps take the cached value, not the rendered one, so quick taps all count.
    stepSize: (fn: (size: number) => number) =>
      update(p => ({ ...p, size: fn(p.size) })),
    setChords: (chords: boolean) => update(p => ({ ...p, chords })),
    stepTranspose: (fn: (n: number) => number) =>
      update(p => {
        const transpose = { ...p.transpose }
        const n = fn(p.transpose[songId] ?? 0)
        if (n) transpose[songId] = n
        else delete transpose[songId]
        return { ...p, transpose }
      }),
  }
}
