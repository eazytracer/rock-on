/**
 * Casting models (mobile-redesign-port / casting v1).
 * Supabase-only tables: band_roles (per-band role vocabulary) + casting_assignments
 * (one row per slot+role+member). See supabase/migrations/20260703045901_casting.sql.
 */

export type CastingContext = 'setlist' | 'event'

export interface BandRole {
  id: string
  bandId: string
  key: string
  label: string
  sort: number
  isDefaultPart: boolean
}

export interface CastingAssignment {
  id: string
  contextType: CastingContext
  contextId: string
  /** SetlistItem.id (setlist) or event_lineup_items.id (event). */
  slotId: string
  bandId?: string
  songId?: string
  roleKey: string
  memberId?: string
  memberName?: string
  isPrimary: boolean
  priority?: number
  confidence?: number
  arrangement?: string
  notes?: string
  createdBy: string
  createdDate: Date
}

/** A history row: a past casting of a member on a song (band-wide). */
export interface CastingHistoryEntry {
  id: string
  roleKey: string
  memberId?: string
  memberName?: string
  contextType: CastingContext
  contextId: string
  isPrimary: boolean
  castOn: Date
}

/** Input to assign a member to a role on a slot. */
export interface AssignInput {
  contextType: CastingContext
  contextId: string
  slotId: string
  bandId?: string
  songId?: string
  roleKey: string
  memberId?: string
  memberName?: string
  isPrimary?: boolean
  confidence?: number
  arrangement?: string
  notes?: string
}
