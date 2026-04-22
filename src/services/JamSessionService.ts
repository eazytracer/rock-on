/**
 * JamSessionService — Business logic for Social Catalog jam sessions.
 *
 * Responsibilities:
 * - Create/join/leave/expire sessions
 * - Compute song matches across participants
 * - Generate QR-friendly share URLs
 * - Save jam session as personal setlist
 * - Tier gating stub (always allowed until account-tiers feature ships)
 */

import { repository } from './data/RepositoryFactory'
import { getSupabaseClient } from './supabase/client'
// SetlistService not used directly — we use repository.addSetlist for personal setlists
import type { JamSession, JamSongMatch } from '../models/JamSession'
import type { Setlist } from '../models/Setlist'
import type { Song } from '../models/Song'
import type { SetlistItem } from '../types'

// ============================================================================
// Constants
// ============================================================================

/** Free tier: 24-hour session duration */
const FREE_TIER_SESSION_HOURS = 24

/** Characters used for short code generation (no ambiguous chars: 0/O, 1/I/l) */
const SHORT_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Short code length */
const SHORT_CODE_LENGTH = 6

// ============================================================================
// Helpers
// ============================================================================

/** Generate a random 6-character alphanumeric short code */
function generateShortCode(): string {
  let code = ''
  const array = new Uint8Array(SHORT_CODE_LENGTH)
  crypto.getRandomValues(array)
  for (const byte of array) {
    code += SHORT_CODE_CHARS[byte % SHORT_CODE_CHARS.length]
  }
  return code
}

/** Hash a string with SHA-256 and return hex string */
async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// ============================================================================
// JamSessionService
// ============================================================================

export class JamSessionService {
  /**
   * Check if the user is allowed to create a new jam session.
   * STUB: Always allowed — wire to real tier limits when account-tiers ships.
   *
   * Future implementation checks:
   * - users.account_tier === 'pro' → unlimited
   * - users.account_tier === 'free' → max 1 active session
   */
  static async canCreateJamSession(
    _userId: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    // TODO: wire to account_tier limits when account-tiers-and-access ships
    return { allowed: true }
  }

  /**
   * Create a new jam session.
   * Returns the session + the raw (pre-hash) view token for embedding in URLs.
   *
   * When `seedSetlistId` is provided, the referenced setlist's song items are
   * copied into `settings.setlistSongIds` so the host's setlist panel is
   * pre-populated. The seedSetlistId is also persisted on the session row for
   * provenance/UI display.
   */
  static async createSession(
    hostUserId: string,
    name?: string,
    settings?: JamSession['settings'],
    seedSetlistId?: string
  ): Promise<{ session: JamSession; rawViewToken: string }> {
    const { allowed, reason } = await this.canCreateJamSession(hostUserId)
    if (!allowed) {
      throw new Error(reason ?? 'Cannot create jam session')
    }

    // Generate unique short code (retry on collision)
    let shortCode = ''
    for (let attempt = 0; attempt < 5; attempt++) {
      shortCode = generateShortCode()
      const existing = await repository
        .getJamSessionByCode(shortCode)
        .catch(() => null)
      if (!existing) break
    }

    // Generate view token: raw UUID (for URLs) + SHA-256 hash (stored in DB)
    const rawViewToken = crypto.randomUUID()
    const hashedViewToken = await sha256(rawViewToken)

    const expiresAt = new Date(
      Date.now() + FREE_TIER_SESSION_HOURS * 60 * 60 * 1000
    )
    const viewTokenExpiresAt = expiresAt

    // If a seed setlist was provided, extract its song IDs into setlistSongIds
    // so the host's Setlist panel is pre-populated. We only take items of
    // type='song' with a resolvable songId (skip breaks and sections — the jam
    // setlist is a flat list for now).
    let mergedSettings: JamSession['settings'] = { ...(settings ?? {}) }
    if (seedSetlistId) {
      const seed = await repository.getSetlist(seedSetlistId)
      if (!seed) {
        throw new Error('Seed setlist not found')
      }
      // Ownership check: seed must be a personal setlist owned by the host.
      // (Band setlists belong to the band, not a user — seeding from those is
      // out of scope for this release per product decision.)
      if (seed.contextType !== 'personal' || seed.contextId !== hostUserId) {
        throw new Error(
          'You can only seed a jam from your own personal setlists'
        )
      }
      // Build setlist items with display data so participants / anon viewers
      // don't need to resolve IDs against the host's catalog. We pull title +
      // artist from the seed setlist's items when embedded, or do a best-effort
      // lookup against songs the seed refers to.
      const candidateSongIds: string[] = (seed.items ?? [])
        .filter(item => item.type === 'song' && item.songId)
        .map(item => item.songId as string)

      const seedItems: Array<{
        id: string
        displayTitle: string
        displayArtist: string
      }> = []
      for (const songId of candidateSongIds) {
        const song = await repository.getSong(songId).catch(() => null)
        if (song) {
          seedItems.push({
            id: song.id,
            displayTitle: song.title,
            displayArtist: song.artist ?? '',
          })
        } else {
          // Song not available locally yet — skip rather than insert an
          // un-renderable placeholder. The host can re-add manually if needed.
        }
      }

      // Preserve anything the caller already put in settings; seed only if empty.
      if (!mergedSettings.setlistItems?.length) {
        mergedSettings = { ...mergedSettings, setlistItems: seedItems }
      }
    }

    const session = await repository.createJamSession({
      shortCode,
      name: name ?? undefined,
      hostUserId,
      status: 'active',
      createdDate: new Date(),
      expiresAt,
      savedSetlistId: undefined,
      seedSetlistId: seedSetlistId ?? undefined,
      viewToken: hashedViewToken, // Store the hash, not the raw token
      viewTokenExpiresAt,
      settings: mergedSettings,
    })

    // Auto-add host as participant sharing their personal catalog
    await repository.addJamParticipant({
      jamSessionId: session.id,
      userId: hostUserId,
      joinedDate: new Date(),
      status: 'active',
      sharedContexts: [{ type: 'personal', id: hostUserId }],
    })

    return { session, rawViewToken }
  }

  /**
   * Join a jam session via short code.
   * Adds the user as a participant sharing their personal catalog.
   */
  static async joinSession(
    shortCode: string,
    userId: string
  ): Promise<JamSession> {
    const session = await repository.getJamSessionByCode(shortCode)
    if (!session) {
      throw new Error('Jam session not found')
    }
    if (session.status !== 'active') {
      throw new Error(
        session.status === 'expired'
          ? 'This jam session has expired'
          : 'This jam session is no longer active'
      )
    }
    if (new Date(session.expiresAt) < new Date()) {
      await this.expireSession(session.id)
      throw new Error('This jam session has expired')
    }

    // Add participant (ignore if already joined)
    try {
      await repository.addJamParticipant({
        jamSessionId: session.id,
        userId,
        joinedDate: new Date(),
        status: 'active',
        sharedContexts: [{ type: 'personal', id: userId }],
      })
    } catch (err) {
      // UNIQUE constraint violation = already a participant, that's OK
      if (
        !(err as Error).message?.includes('duplicate') &&
        !(err as Error).message?.includes('unique')
      ) {
        throw err
      }
    }

    // Recompute matches now that a new participant has joined
    await this.recomputeMatches(session.id)

    return session
  }

  /**
   * Recompute all song matches for a session.
   * Fetches all participant catalogs and runs the matching algorithm.
   */
  /**
   * Recompute song matches by delegating to the `jam-recompute` Edge Function.
   *
   * The Edge Function runs entirely server-side:
   *   1. Fetches all participants' song catalogs directly from the DB
   *   2. Runs the matching algorithm in Deno
   *   3. Atomically replaces jam_song_matches via replace_jam_matches() RPC
   *
   * Both clients' existing Realtime subscriptions on jam_song_matches fire
   * automatically — no manual refresh needed on the other client.
   */
  static async recomputeMatches(sessionId: string): Promise<JamSongMatch[]> {
    const supabase = getSupabaseClient()
    if (!supabase) return []

    const { data, error } = await supabase.functions.invoke('jam-recompute', {
      body: { sessionId },
    })

    if (error) {
      throw new Error(`jam-recompute failed: ${error.message}`)
    }

    // The Edge Function returns the new matches in camelCase format.
    // Convert date strings to Date objects to match the JamSongMatch model.
    return ((data as JamSongMatch[]) ?? []).map(m => ({
      ...m,
      computedAt: new Date(m.computedAt),
    }))
  }

  /**
   * Confirm a fuzzy match (host only).
   * Re-fetches all matches and marks the target as confirmed.
   */
  static async confirmMatch(sessionId: string, matchId: string): Promise<void> {
    const matches = await repository.getJamSongMatches(sessionId)
    const updated = matches.map(m =>
      m.id === matchId ? { ...m, isConfirmed: true } : m
    )
    // Re-upsert with the updated confirmed state (strip ids for upsert)
    const withoutIds = updated.map(m => {
      const { id: _id, ...rest } = m
      return rest
    })
    await repository.upsertJamSongMatches(sessionId, withoutIds)
  }

  /**
   * Dismiss a fuzzy match (host only) — removes it from the session.
   */
  static async dismissMatch(sessionId: string, matchId: string): Promise<void> {
    const matches = await repository.getJamSongMatches(sessionId)
    const filtered = matches
      .filter(m => m.id !== matchId)
      .map(({ id: _id, ...rest }) => rest)
    await repository.upsertJamSongMatches(sessionId, filtered)
  }

  /**
   * Mark a session as expired.
   */
  static async expireSession(sessionId: string): Promise<void> {
    await repository.updateJamSession(sessionId, { status: 'expired' })
  }

  /**
   * Update the session's settings JSONB (e.g. to persist hostSongIds).
   */
  static async updateSessionSettings(
    sessionId: string,
    settingsUpdate: JamSession['settings']
  ): Promise<void> {
    const session = await repository.getJamSession(sessionId)
    if (!session) return
    await repository.updateJamSession(sessionId, {
      settings: { ...session.settings, ...settingsUpdate },
    })
  }

  /**
   * Save a jam session as a personal setlist.
   *
   * Two modes:
   * - **Explicit** (`setlistSongs` provided): uses the host's curated ordered list directly.
   * - **Auto** (no `setlistSongs`): builds from all confirmed matches, then appends `queuedSongs`.
   *
   * @param sessionId The jam session ID
   * @param hostUserId The host user's ID (used to pick their song copy from matches)
   * @param setlistName Optional name override for the setlist
   * @param queuedSongs Optional manually queued songs to append after auto-matched items (auto mode only)
   * @param setlistSongs Explicitly curated + ordered song list (takes priority over auto mode)
   */
  static async saveAsSetlist(
    sessionId: string,
    hostUserId: string,
    setlistName?: string,
    queuedSongs?: Song[],
    setlistSongs?: Song[]
  ): Promise<Setlist> {
    const session = await repository.getJamSession(sessionId)
    if (!session) throw new Error('Jam session not found')

    let items: SetlistItem[]

    if (setlistSongs && setlistSongs.length > 0) {
      // Explicit mode: host has curated the setlist in the Setlist panel
      items = setlistSongs.map((song, index) => ({
        id: crypto.randomUUID(),
        type: 'song' as const,
        position: index + 1,
        songId: song.id,
        notes: undefined,
      }))
    } else {
      // Auto mode: build from confirmed matches + optional queued songs
      const matches = await repository.getJamSongMatches(sessionId)
      const confirmedMatches = matches.filter(m => m.isConfirmed)

      // Build setlist items from confirmed matches
      // Use the host's song ID when available
      const matchItems: SetlistItem[] = confirmedMatches.map((match, index) => {
        const hostSong = match.matchedSongs.find(ms => ms.userId === hostUserId)
        return {
          id: crypto.randomUUID(),
          type: 'song' as const,
          position: index + 1,
          songId: hostSong?.songId,
          notes: `Matched ${match.participantCount} participants`,
        }
      })

      // Append manually queued songs after auto-matched items (dedup by songId)
      const matchedSongIds = new Set(
        matchItems.map(i => i.songId).filter(Boolean)
      )
      const queueItems: SetlistItem[] = (queuedSongs ?? [])
        .filter(s => !matchedSongIds.has(s.id))
        .map((song, idx) => ({
          id: crypto.randomUUID(),
          type: 'song' as const,
          position: matchItems.length + idx + 1,
          songId: song.id,
          notes: undefined,
        }))

      items = [...matchItems, ...queueItems]
    }

    // Create the personal setlist using SetlistService
    const name =
      setlistName || session.name || `Jam Session ${session.shortCode}`
    // Create the personal setlist directly via repository
    const setlistId = crypto.randomUUID()
    await repository.addSetlist({
      id: setlistId,
      name,
      bandId: undefined,
      contextType: 'personal',
      contextId: hostUserId,
      jamSessionId: sessionId,
      tags: ['jam'],
      items,
      songs: [],
      totalDuration: items.length * 200, // rough estimate
      notes: `Saved from jam session ${session.shortCode}`,
      status: 'draft',
      createdDate: new Date(),
      lastModified: new Date(),
    })

    // Mark session as saved
    await repository.updateJamSession(sessionId, {
      status: 'saved',
      savedSetlistId: setlistId,
    })

    return (await repository.getSetlist(setlistId))!
  }

  /**
   * Generate the shareable URL for a jam session.
   * @param shortCode The session's short code
   * @param rawViewToken The raw (pre-hash) view token
   * @param baseUrl The app base URL (defaults to window.location.origin)
   */
  static generateShareUrl(
    shortCode: string,
    rawViewToken: string,
    baseUrl?: string
  ): string {
    const base =
      baseUrl ?? (typeof window !== 'undefined' ? window.location.origin : '')
    return `${base}/jam/view/${shortCode}?t=${rawViewToken}`
  }
}
