/**
 * Event models (mobile-redesign-port).
 * Supabase-only tables (events, event_participants, event_lineup_items,
 * event_lineup_requests). Song requests stay pending until the host approves.
 */

export type EventVisibility = 'private' | 'unlisted' | 'public'
export type EventStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled'
export type LineupSource = 'mine' | 'band' | 'public' | 'external'
export type LineupRequestStatus = 'pending' | 'approved' | 'rejected'
export type EventAccessTier = 'host' | 'cohost' | 'guest' | 'viewer'
export type EventRsvp = 'pending' | 'going' | 'maybe' | 'declined'

/** A person taking part in an event — the pool the host casts from. */
export interface EventParticipant {
  userId: string
  name: string
  accessTier: EventAccessTier
  rsvp: EventRsvp
}

export interface EventSummary {
  id: string
  name: string
  venue?: string
  scheduledDate: Date
  status: EventStatus
  visibility: EventVisibility
  hostUserId: string
  bandId?: string
  /** Access controls (fork #5). Default true/false when the columns are absent. */
  allowSuggestions: boolean
  autoApprove: boolean
  shortCode?: string
  /** Lightweight participant preview for list cards (avatar stack). */
  participantCount?: number
  participantNames?: string[]
  /** Participants who RSVP'd "going" — the "N going" list-card stat. */
  goingCount?: number
  /** Cast progress 0–100 (primary parts filled ÷ lineup×parts), or undefined
   *  when the lineup is empty. Drives "X% cast" on hosting list cards. */
  castPct?: number
  /** The current user's own RSVP for this event (invited-card badge). */
  myRsvp?: EventRsvp
}

/** Host-editable access settings (Access tab). */
export interface EventAccess {
  visibility: EventVisibility
  allowSuggestions: boolean
  autoApprove: boolean
}

export type RaisedHandStatus = 'raised' | 'accepted' | 'declined' | 'withdrawn'

/**
 * A participant volunteering to play a part (lineup item + role) — the
 * "raise a hand" signal the host resolves (accept → casts them, or decline).
 */
export interface RaisedHand {
  id: string
  lineupItemId: string
  roleKey: string
  userId: string
  userName: string
  status: RaisedHandStatus
}

export interface LineupItem {
  id: string
  position: number
  source: LineupSource
  ownerId?: string
  songId?: string
  displayTitle: string
  displayArtist: string
}

export interface LineupRequest {
  id: string
  requesterId: string
  source: LineupSource
  displayTitle: string
  displayArtist: string
  status: LineupRequestStatus
  createdDate: Date
}
