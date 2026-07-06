import { useState, useEffect, useCallback, useMemo } from 'react'
import { TuningService } from '../services/TuningService'
import { BUILTIN_TUNINGS } from '../utils/tunings'
import type { BuiltinTuning } from '../utils/tunings'
import type { Tuning } from '../models/Tuning'

/**
 * Provide the tunings available to the current user for an optional instrument:
 * - `builtins`: the static BUILTIN_TUNINGS list (world-readable), filtered by
 *   instrument when provided. Synchronous — no fetch.
 * - `customs`: the caller's custom tunings (personal + their bands'), fetched
 *   via TuningService (RLS-scoped), filtered by instrument when provided.
 *
 * `refetch` re-pulls customs after a create/update/delete.
 */
export function useTunings(instrument?: 'guitar' | 'bass'): {
  builtins: BuiltinTuning[]
  customs: Tuning[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
} {
  const [allCustoms, setAllCustoms] = useState<Tuning[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    try {
      setLoading(true)
      const customs = await TuningService.getCustomTunings()
      setAllCustoms(customs)
      setError(null)
    } catch (err) {
      console.error('[useTunings] Error fetching custom tunings:', err)
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  const builtins = useMemo(
    () =>
      instrument
        ? BUILTIN_TUNINGS.filter(t => t.instrument === instrument)
        : [...BUILTIN_TUNINGS],
    [instrument]
  )

  const customs = useMemo(
    () =>
      instrument
        ? allCustoms.filter(t => t.instrument === instrument)
        : allCustoms,
    [allCustoms, instrument]
  )

  return { builtins, customs, loading, error, refetch }
}
