/**
 * TuningService — read/write custom tunings in public.tunings.
 *
 * Goes through the AUTHENTICATED Supabase client so RLS applies:
 * - Built-ins are world-readable (not fetched here — this service is customs-only).
 * - Personal customs are owner-only; band customs are member-only.
 * - An UPDATE trigger pins ownership columns (created_by/context/is_builtin/slug),
 *   so update patches only touch editable fields.
 *
 * We intentionally do NOT add an owner filter on reads — RLS auto-scopes the
 * result to the caller's personal customs + their bands' customs. That's the point.
 */

import { getSupabaseClient } from './supabase/client'
import type { Tuning, NewCustomTuning } from '../models/Tuning'

/** A raw row from public.tunings (snake_case). */
interface TuningRow {
  id: string
  instrument: 'guitar' | 'bass'
  string_count: number
  pitches: number[]
  name: string
  slug: string | null
  is_builtin: boolean
  color: string | null
  context_type: 'personal' | 'band' | null
  context_id: string | null
  created_by: string | null
  created_date: string
  updated_date: string
}

/** Map a snake_case DB row → camelCase Tuning model. */
function mapRow(row: TuningRow): Tuning {
  return {
    id: row.id,
    instrument: row.instrument,
    stringCount: row.string_count,
    pitches: row.pitches,
    name: row.name,
    slug: row.slug,
    isBuiltin: row.is_builtin,
    color: row.color,
    contextType: row.context_type,
    contextId: row.context_id,
    createdBy: row.created_by,
    createdDate: row.created_date,
    updatedDate: row.updated_date,
  }
}

export class TuningService {
  /**
   * Fetch the caller's custom tunings (personal + their bands'), ordered by name.
   * RLS scopes the result — no owner filter here by design.
   */
  static async getCustomTunings(): Promise<Tuning[]> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('tunings')
      .select('*')
      .eq('is_builtin', false)
      .order('name')

    if (error) {
      throw new Error(`Failed to fetch custom tunings: ${error.message}`)
    }

    return ((data as unknown as TuningRow[]) ?? []).map(mapRow)
  }

  /**
   * Create a custom tuning. RLS WITH CHECK enforces created_by = auth.uid()
   * and a valid owner (personal-self or band-member) — any violation surfaces.
   */
  static async createCustomTuning(
    t: NewCustomTuning,
    ctx: {
      contextType: 'personal' | 'band'
      contextId: string
      createdBy: string
    }
  ): Promise<Tuning> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('tunings')
      .insert({
        instrument: t.instrument,
        string_count: t.stringCount,
        pitches: t.pitches,
        name: t.name,
        is_builtin: false,
        color: t.color ?? null,
        context_type: ctx.contextType,
        context_id: ctx.contextId,
        created_by: ctx.createdBy,
        // `as never`: `tunings` isn't in the generated Database types (new table);
        // matches the insert-cast pattern used by NotificationService/FriendService.
      } as never)
      .select('*')
      .single()

    if (error) {
      throw new Error(`Failed to create custom tuning: ${error.message}`)
    }

    return mapRow(data as unknown as TuningRow)
  }

  /**
   * Update editable fields of a custom tuning. The DB trigger pins ownership,
   * is_builtin, and slug regardless of what's sent, so only pass what changed.
   */
  static async updateCustomTuning(
    id: string,
    patch: {
      name?: string
      pitches?: number[]
      color?: string | null
      stringCount?: number
      instrument?: 'guitar' | 'bass'
    }
  ): Promise<Tuning> {
    const supabase = getSupabaseClient()

    const update: Record<string, unknown> = {}
    if (patch.name !== undefined) update.name = patch.name
    if (patch.pitches !== undefined) update.pitches = patch.pitches
    if (patch.color !== undefined) update.color = patch.color
    if (patch.stringCount !== undefined) update.string_count = patch.stringCount
    if (patch.instrument !== undefined) update.instrument = patch.instrument

    const { data, error } = await supabase
      .from('tunings')
      .update(update as never)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      throw new Error(`Failed to update custom tuning: ${error.message}`)
    }

    return mapRow(data as unknown as TuningRow)
  }

  /**
   * Delete a custom tuning by id. RLS blocks non-owners (matches 0 rows), which
   * is a no-op success — no error is surfaced in that case.
   */
  static async deleteCustomTuning(id: string): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase.from('tunings').delete().eq('id', id)

    if (error) {
      throw new Error(`Failed to delete custom tuning: ${error.message}`)
    }
  }
}
