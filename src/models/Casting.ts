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

/**
 * Fixed instrument set for personal (band-less) events. Per the v1 casting model
 * (2026-07-06) we make NO per-song assumptions about what a song needs or what a
 * person plays — a guest simply checks the instrument(s) they're open to playing,
 * from this basic set. `other` is the free-text catch-all (the raised hand / cast
 * carries the typed instrument name). role_key on casting_assignments/event_hands
 * is a soft text ref, so these keys are valid without any DB rows.
 */
export const OTHER_ROLE_KEY = 'other'

export const DEFAULT_LINEUP: BandRole[] = [
  { key: 'guitar', label: 'Guitar', sort: 1, isDefaultPart: true },
  { key: 'bass', label: 'Bass', sort: 2, isDefaultPart: true },
  { key: 'drums', label: 'Drums', sort: 3, isDefaultPart: true },
  { key: 'vox', label: 'Vox', sort: 4, isDefaultPart: true },
  { key: 'keys', label: 'Keys', sort: 5, isDefaultPart: true },
  { key: OTHER_ROLE_KEY, label: 'Other', sort: 6, isDefaultPart: false },
].map(r => ({ ...r, id: `default:${r.key}`, bandId: '' }))

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
  /** Ordering among backups for a part (starters have none). */
  priority?: number
  confidence?: number
  arrangement?: string
  notes?: string
}
