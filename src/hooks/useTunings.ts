import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TuningService } from '../services/TuningService'
import { queryKeys, EMPTY_ARRAY } from '../services/queryClient'
import { useAuth } from '../contexts/AuthContext'
import type { Tuning } from '../models/Tuning'

/**
 * Tunings available to the current user for an optional instrument, sourced from
 * the DB in one RLS-scoped query so every entry carries a real id (needed to set
 * songs.tuning_id):
 * - `builtins`: the world-readable built-in tunings.
 * - `customs`: the caller's custom tunings (personal + their bands').
 *
 * One cached query (`queryKeys.tunings`) for every picker, so a tuning created
 * or edited in one place shows everywhere once the key is invalidated (or
 * `refetch` is called). Errored → empty lists (callers fall back to the
 * stored `guitarTuning` label for display).
 */
export function useTunings(instrument?: 'guitar' | 'bass'): {
  builtins: Tuning[]
  customs: Tuning[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
} {
  const { currentUser } = useAuth()
  const query = useQuery({
    queryKey: queryKeys.tunings.all(currentUser?.id ?? ''),
    queryFn: () => TuningService.getAllTunings(),
  })
  const all: Tuning[] = query.data ?? EMPTY_ARRAY

  const forInstrument = useCallback(
    (list: Tuning[]) =>
      instrument ? list.filter(t => t.instrument === instrument) : list,
    [instrument]
  )

  const builtins = useMemo(
    () => forInstrument(all.filter(t => t.isBuiltin)),
    [all, forInstrument]
  )
  const customs = useMemo(
    () => forInstrument(all.filter(t => !t.isBuiltin)),
    [all, forInstrument]
  )

  const { refetch: refetchQuery } = query
  const refetch = useCallback(async () => {
    await refetchQuery()
  }, [refetchQuery])

  return {
    builtins,
    customs,
    loading: query.isLoading,
    error: query.error as Error | null,
    refetch,
  }
}
