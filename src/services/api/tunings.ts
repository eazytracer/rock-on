/**
 * Custom tunings (design/OPERATIONS.md §8). Reads stay in TuningService; these
 * writes need the server's rules (range, duplicates). Errors: `name_required`,
 * `invalid_pitches`, `duplicate_tuning` (HINT names the existing tuning),
 * `forbidden`, `not_found`, `stale_version`.
 */
import { api } from './client'
import { toApiError } from './errors'
import type { Database } from '../../types/database.types'
import type { Tuning } from '../../models/Tuning'

type TuningRow = Database['public']['Tables']['tunings']['Row']

const fromRow = (r: TuningRow): Tuning & { version: number } => ({
  id: r.id,
  instrument: r.instrument as Tuning['instrument'],
  stringCount: r.string_count,
  pitches: r.pitches,
  name: r.name,
  slug: r.slug,
  isBuiltin: r.is_builtin,
  color: r.color,
  contextType: r.context_type as Tuning['contextType'],
  contextId: r.context_id,
  createdBy: r.created_by,
  createdDate: r.created_date,
  updatedDate: r.updated_date,
  version: r.version,
})

export interface NewTuning {
  name: string
  instrument: 'guitar' | 'bass'
  /** Guitar 6 / 7 / 8, bass 4 / 5 / 6. */
  stringCount: number
  /** MIDI, low → high; each −12 … +7 from that string's standard. */
  pitches: number[]
  contextType: 'personal' | 'band'
  contextId: string
  /** Hex, or null for automatic. */
  color?: string | null
}

export async function createTuning(t: NewTuning) {
  const { data, error } = await api().rpc('create_tuning', {
    p_name: t.name,
    p_instrument: t.instrument,
    p_string_count: t.stringCount,
    p_pitches: t.pitches,
    p_context_type: t.contextType,
    p_context_id: t.contextId,
    p_color: t.color ?? undefined,
  })
  if (error) throw toApiError(error)
  return fromRow(data as TuningRow)
}

/** Name, strings and colour (null = automatic). Instrument and count stay. */
export async function updateTuning(
  tuningId: string,
  patch: { name: string; pitches: number[]; color?: string | null },
  expectedVersion?: number
) {
  const { data, error } = await api().rpc('update_tuning', {
    p_tuning_id: tuningId,
    p_name: patch.name,
    p_pitches: patch.pitches,
    p_color: patch.color ?? undefined,
    p_expected_version: expectedVersion,
  })
  if (error) throw toApiError(error)
  return fromRow(data as TuningRow)
}
