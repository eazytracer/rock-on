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
