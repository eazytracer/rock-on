/**
 * Jam Session models for the Social Catalog feature.
 *
 * Jam sessions are Supabase-only (not cached in IndexedDB).
 * They allow users to find common songs across personal catalogs
 * for impromptu performances.
 */

/**
 * One entry in the host's curated jam setlist. Stored as an object (not just an
 * ID) because jam_song_matches rows are regenerated on every recompute — any
 * stored match ID becomes orphan the moment another participant joins. Carrying
 * `displayTitle` / `displayArtist` alongside the ID means:
 *
 *   1. Participants without the song in their own catalog can still see what's
 *      on the setlist (no cross-user fetch needed).
 *   2. Anonymous viewers (via jam-view Edge Function) get the full setlist
 *      without server-side ID resolution.
 *   3. If the underlying match row is regenerated, the setlist entry still
 *      renders correctly using the captured display values.
 *
 * The `id` field is a stable reference when possible (host's personal song
 * UUID) but may also be a non-resolving synthetic ID for external songs — UI
 * code must not assume `id` corresponds to any table's row.
 */
export interface JamSetlistItem {
  id: string
  displayTitle: string
  displayArtist: string
}

export interface JamSessionSettings {
  /** Jaro-Winkler similarity threshold for fuzzy matching (default: 0.92) */
  matchThreshold?: number
  /** Maximum number of participants (null = unlimited, pro only) */
  maxParticipants?: number | null
  /** Host's manually queued song IDs (from personal catalog) */
  hostSongIds?: string[]
  /**
   * Ordered host-curated setlist.
   *
   * Written as `setlistItems` going forward. The legacy `setlistSongIds`
   * string[] field (pre-2026-04-20) may still exist on older sessions and is
   * read as a fallback; new writes always populate `setlistItems`.
   */
  setlistItems?: JamSetlistItem[]
  /** @deprecated Read-only legacy fallback; new code writes `setlistItems`. */
  setlistSongIds?: string[]
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
  /**
   * Optional seed setlist used to pre-populate the host's curated setlist when
   * the session was created. The referenced setlist's items are copied into
   * settings.setlistSongIds at creation time; this column is retained for
   * provenance/UI display only.
   */
  seedSetlistId?: string
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

/**
 * Public-safe payload returned by the jam-view Edge Function to
 * unauthenticated users.
 *
 * The anon view's product intent is "see what the host is queuing up" — i.e.
 * the host-curated broadcast setlist. It deliberately does NOT include the
 * "common songs" match list that authenticated participants use: an anon
 * viewer has no personal catalog and therefore can neither contribute to nor
 * benefit from the match set. Including it would expose internal plumbing
 * that's irrelevant to the anon experience.
 *
 * This is a deliberate trimming from the pre-v0.3.2 shape — older clients
 * that tried to read `matches` / `matchCount` will simply see them as
 * undefined. The anon page (`JamViewPage`) treats the setlist as the
 * primary content and renders a clear empty state when it's absent.
 */
export interface JamViewPublicPayload {
  sessionName: string
  hostDisplayName: string
  participantCount: number
  /**
   * Broadcast setlist curated by the host — the ordered list of songs the host
   * has picked for this jam. Reflects the current value of
   * `jam_sessions.settings.setlistItems`. Always present (possibly empty) so
   * the anon page can render a stable empty state instead of a fallback to
   * some other surface.
   */
  setlist: Array<{
    displayTitle: string
    displayArtist: string
  }>
}
