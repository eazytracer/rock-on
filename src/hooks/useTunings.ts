import { useState, useEffect, useCallback, useMemo } from 'react'
import { TuningService } from '../services/TuningService'
import type { Tuning } from '../models/Tuning'

/**
 * Tunings available to the current user for an optional instrument, sourced from
 * the DB in one RLS-scoped query so every entry carries a real id (needed to set
 * songs.tuning_id):
 * - `builtins`: the world-readable built-in tunings.
 * - `customs`: the caller's custom tunings (personal + their bands').
 *
 * `refetch` re-pulls after a create/update/delete. Offline/errored → empty lists
 * (callers fall back to the stored `guitarTuning` label for display).
 */
export function useTunings(instrument?: 'guitar' | 'bass'): {
  builtins: Tuning[]
  customs: Tuning[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
} {
  const [all, setAll] = useState<Tuning[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    try {
      setLoading(true)
      setAll(await TuningService.getAllTunings())
      setError(null)
    } catch (err) {
      console.error('[useTunings] Error fetching tunings:', err)
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

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

  return { builtins, customs, loading, error, refetch }
}
