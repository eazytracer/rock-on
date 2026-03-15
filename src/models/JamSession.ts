/**
 * Jam Session models for the Social Catalog feature.
 *
 * Jam sessions are Supabase-only (not cached in IndexedDB).
 * They allow users to find common songs across personal catalogs
 * for impromptu performances.
 */

export interface JamSessionSettings {
  /** Jaro-Winkler similarity threshold for fuzzy matching (default: 0.92) */
  matchThreshold?: number
  /** Maximum number of participants (null = unlimited, pro only) */
  maxParticipants?: number | null
}

export interface JamSession {
  id: string
  shortCode: string // 6-char alphanumeric join code
  name?: string // Optional human name, e.g., "Friday Night Jam"
  hostUserId: string
  status: 'active' | 'expired' | 'saved'
  createdDate: Date
  expiresAt: Date
  savedSetlistId?: string // Set when session is saved as a setlist
  /** Raw (pre-hash) view token — only present immediately after session creation */
  viewToken?: string
  viewTokenExpiresAt?: Date
  settings: JamSessionSettings
  version?: number
  lastModifiedBy?: string
}

export interface JamParticipant {
  id: string
  jamSessionId: string
  userId: string
  joinedDate: Date
  status: 'active' | 'left' | 'kicked'
  /** Which catalog contexts the user is sharing for this session */
  sharedContexts: Array<{ type: 'personal'; id: string }>
  /** Enriched display name (joined from user_profiles) */
  displayName?: string
}

export interface JamSongMatch {
  id: string
  jamSessionId: string
  /** Normalized title used for matching (lowercase, no articles/punctuation) */
  canonicalTitle: string
  /** Normalized artist used for matching */
  canonicalArtist: string
  /** Human-readable title for UI (from host's song record) */
  displayTitle: string
  /** Human-readable artist for UI */
  displayArtist: string
  matchConfidence: 'exact' | 'fuzzy' | 'manual'
  /** false for fuzzy matches pending host confirmation */
  isConfirmed: boolean
  /** Per-participant song references — does NOT expose raw catalog data */
  matchedSongs: Array<{
    userId: string
    songId: string
    rawTitle: string
    rawArtist: string
  }>
  participantCount: number
  computedAt: Date
}

/** Public-safe payload returned by the jam-view Edge Function to unauthenticated users */
export interface JamViewPublicPayload {
  sessionName: string
  hostDisplayName: string
  participantCount: number
  matchCount: number
  matches: Array<{
    displayTitle: string
    displayArtist: string
    matchConfidence: 'exact' | 'fuzzy' | 'manual'
  }>
}
