/**
 * CastingAssignmentService — per-song, per-role member assignments on a setlist or
 * event, plus band-wide "who played what" history.
 *
 * The clean v1 casting service (Supabase-only + RLS). Distinct from the legacy,
 * shelved `CastingService` (Dexie-local, broken) which this replaces going forward.
 * Writes are authorized by RLS (band admin for setlists, event host/cohost for
 * events) with WITH CHECK binding band↔context↔song — the service only shapes rows.
 */

import { getSupabaseClient } from './supabase/client'
import { createLogger } from '../utils/logger'
import type {
  BandRole,
  CastingAssignment,
  CastingContext,
  CastingHistoryEntry,
  AssignInput,
} from '../models/Casting'

const log = createLogger('CastingAssignmentService')

async function currentUserId(): Promise<string | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

interface RoleRow {
  id: string
  band_id: string
  key: string
  label: string
  sort: number
  is_default_part: boolean
}

interface CastingRow {
  id: string
  context_type: CastingContext
  context_id: string
  setlist_item_id: string | null
  event_lineup_item_id: string | null
  band_id: string | null
  song_id: string | null
  role_key: string
  member_id: string | null
  member_name: string | null
  is_primary: boolean
  priority: number | null
  confidence: number | null
  arrangement: string | null
  notes: string | null
  created_by: string
  created_date: string
}

const slotColumn = (t: CastingContext) =>
  t === 'setlist' ? 'setlist_item_id' : 'event_lineup_item_id'

function mapRow(r: CastingRow): CastingAssignment {
  return {
    id: r.id,
    contextType: r.context_type,
    contextId: r.context_id,
    slotId: (r.setlist_item_id ?? r.event_lineup_item_id) as string,
    bandId: r.band_id ?? undefined,
    songId: r.song_id ?? undefined,
    roleKey: r.role_key,
    memberId: r.member_id ?? undefined,
    memberName: r.member_name ?? undefined,
    isPrimary: r.is_primary,
    priority: r.priority ?? undefined,
    confidence: r.confidence ?? undefined,
    arrangement: r.arrangement ?? undefined,
    notes: r.notes ?? undefined,
    createdBy: r.created_by,
    createdDate: new Date(r.created_date),
  }
}

export class CastingAssignmentService {
  /** The band's role vocabulary (defaults + custom), sorted. */
  static async getBandRoles(bandId: string): Promise<BandRole[]> {
    const supabase = getSupabaseClient()
    if (!supabase) return []
    const { data, error } = await supabase
      .from('band_roles')
      .select('id, band_id, key, label, sort, is_default_part')
      .eq('band_id', bandId)
      .order('sort', { ascending: true })
    if (error) {
      log.error('getBandRoles failed', error)
      return []
    }
    return ((data as unknown as RoleRow[]) ?? []).map(r => ({
      id: r.id,
      bandId: r.band_id,
      key: r.key,
      label: r.label,
      sort: r.sort,
      isDefaultPart: r.is_default_part,
    }))
  }

  /** All casting rows for a setlist/event (RLS-scoped). */
  static async getCasting(
    contextType: CastingContext,
    contextId: string
  ): Promise<CastingAssignment[]> {
    const supabase = getSupabaseClient()
    if (!supabase) return []
    const { data, error } = await supabase
      .from('casting_assignments')
      .select('*')
      .eq('context_type', contextType)
      .eq('context_id', contextId)
    if (error) {
      log.error('getCasting failed', error)
      return []
    }
    return ((data as unknown as CastingRow[]) ?? []).map(mapRow)
  }

  /** Assign a member to a role on a slot. */
  static async assign(
    input: AssignInput
  ): Promise<{ ok: boolean; error?: string }> {
    const supabase = getSupabaseClient()
    if (!supabase) return { ok: false, error: 'Offline' }
    const me = await currentUserId()
    if (!me) return { ok: false, error: 'Not signed in' }
    const row: Record<string, unknown> = {
      context_type: input.contextType,
      context_id: input.contextId,
      [slotColumn(input.contextType)]: input.slotId,
      band_id: input.bandId ?? null,
      song_id: input.songId ?? null,
      role_key: input.roleKey,
      member_id: input.memberId ?? null,
      member_name: input.memberName ?? null,
      is_primary: input.isPrimary ?? true,
      priority: input.priority ?? null,
      confidence: input.confidence ?? null,
      arrangement: input.arrangement ?? null,
      notes: input.notes ?? null,
      created_by: me,
    }
    const { error } = await supabase
      .from('casting_assignments')
      .insert(row as never)
    if (error) {
      const dup = (error as { code?: string }).code === '23505'
      log.error('assign failed', error)
      return {
        ok: false,
        error: dup ? 'Already cast for that part' : 'Could not assign',
      }
    }
    return { ok: true }
  }

  /** Remove a casting assignment. */
  static async unassign(id: string): Promise<void> {
    const supabase = getSupabaseClient()
    if (!supabase) return
    const { error } = await supabase
      .from('casting_assignments')
      .delete()
      .eq('id', id)
    if (error) log.error('unassign failed', error)
  }

  /** Update mutable fields (confidence / notes / is_primary). */
  static async update(
    id: string,
    patch: Partial<
      Pick<CastingAssignment, 'confidence' | 'notes' | 'isPrimary'>
    >
  ): Promise<void> {
    const supabase = getSupabaseClient()
    if (!supabase) return
    const row: Record<string, unknown> = {
      updated_date: new Date().toISOString(),
    }
    if (patch.confidence !== undefined) row.confidence = patch.confidence
    if (patch.notes !== undefined) row.notes = patch.notes
    if (patch.isPrimary !== undefined) row.is_primary = patch.isPrimary
    const { error } = await supabase
      .from('casting_assignments')
      .update(row as never)
      .eq('id', id)
    if (error) log.error('update failed', error)
  }

  /**
   * Band-wide history for a song: who's been cast on it, most recent first.
   * v1 orders by created_date; resolving the actual performance date via the
   * context (show/event date) is a v2 refinement.
   */
  static async getSongHistory(
    bandId: string,
    songId: string
  ): Promise<CastingHistoryEntry[]> {
    const supabase = getSupabaseClient()
    if (!supabase) return []
    const { data, error } = await supabase
      .from('casting_assignments')
      .select(
        'id, role_key, member_id, member_name, context_type, context_id, is_primary, created_date'
      )
      .eq('band_id', bandId)
      .eq('song_id', songId)
      .order('created_date', { ascending: false })
    if (error) {
      log.error('getSongHistory failed', error)
      return []
    }
    return (
      (data as unknown as {
        id: string
        role_key: string
        member_id: string | null
        member_name: string | null
        context_type: CastingContext
        context_id: string
        is_primary: boolean
        created_date: string
      }[]) ?? []
    ).map(r => ({
      id: r.id,
      roleKey: r.role_key,
      memberId: r.member_id ?? undefined,
      memberName: r.member_name ?? undefined,
      contextType: r.context_type,
      contextId: r.context_id,
      isPrimary: r.is_primary,
      castOn: new Date(r.created_date),
    }))
  }
}
