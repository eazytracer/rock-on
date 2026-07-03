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
 * Canonical default lineup for band-less (personal/social) events, mirroring the
 * `seed_band_roles` DDL. Used by `useCasting` when there's no band to source roles
 * from — role_key on casting_assignments is a soft ref, so these keys are valid.
 */
export const DEFAULT_LINEUP: BandRole[] = [
  { key: 'lead_vocals', label: 'Lead Vocals', sort: 1, isDefaultPart: true },
  {
    key: 'backing_vocals',
    label: 'Backing Vocals',
    sort: 2,
    isDefaultPart: false,
  },
  { key: 'guitar', label: 'Guitar', sort: 3, isDefaultPart: true },
  { key: 'bass', label: 'Bass', sort: 4, isDefaultPart: true },
  { key: 'drums', label: 'Drums', sort: 5, isDefaultPart: true },
  { key: 'keys', label: 'Keys', sort: 6, isDefaultPart: true },
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
  confidence?: number
  arrangement?: string
  notes?: string
}
