/**
 * Song matching utilities for jam sessions.
 *
 * normalizeText() mirrors the SQL normalize_text() function exactly so that
 * matching is consistent between the application layer and the database.
 *
 * Matching tiers:
 *   Tier 1 (exact): both normalizedTitle AND normalizedArtist are identical
 *   Tier 2 (fuzzy): Levenshtein distance ≤ 2 on title, exact artist
 *   Tier 3 (manual): host manually links two songs
 */

import type { Song } from '../models/Song'
import type { JamSongMatch } from '../models/JamSession'

// ============================================================================
// Text normalization
// ============================================================================

/**
 * Normalize a song title or artist name for matching.
 *
 * Rules (must mirror SQL normalize_text() function exactly):
 * 1. Strip leading articles: "the ", "a ", "an " (case-insensitive)
 * 2. Strip all non-alphanumeric characters (keeps spaces and digits)
 * 3. Lowercase
 * 4. Collapse multiple whitespace to single space
 * 5. Trim leading/trailing whitespace
 */
export function normalizeText(input: string): string {
  if (!input) return ''

  return (
    input
      .toLowerCase()
      // Strip leading articles (the/a/an followed by a space)
      .replace(/^(the|a|an)\s+/i, '')
      // Strip all non-alphanumeric characters (but keep spaces)
      .replace(/[^a-z0-9 ]/g, '')
      // Collapse multiple spaces into one
      .replace(/\s+/g, ' ')
      // Trim
      .trim()
  )
}

// ============================================================================
// Participant catalog type
// ============================================================================

export interface ParticipantCatalog {
  userId: string
  songs: Song[]
}

// ============================================================================
// Partial match type used internally before assembling JamSongMatch
// ============================================================================

interface RawMatch {
  canonicalTitle: string
  canonicalArtist: string
  displayTitle: string
  displayArtist: string
  matchConfidence: 'exact' | 'fuzzy' | 'manual'
  isConfirmed: boolean
  matchedSongs: Array<{
    userId: string
    songId: string
    rawTitle: string
    rawArtist: string
  }>
  participantCount: number
}

// ============================================================================
// Levenshtein distance
// ============================================================================

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

// ============================================================================
// Tier 1: Exact normalized matching between two catalogs
// ============================================================================

/**
 * Find songs that match exactly (same normalized title AND artist) between
 * two participant catalogs.
 */
export function computeExactMatches(
  catalogA: ParticipantCatalog,
  catalogB: ParticipantCatalog
): RawMatch[] {
  const matches: RawMatch[] = []

  // Build a lookup map from B indexed by normalizedTitle+normalizedArtist
  const bIndex = new Map<string, Song>()
  for (const song of catalogB.songs) {
    const key = `${normalizeText(song.title)}|${normalizeText(song.artist ?? '')}`
    bIndex.set(key, song)
  }

  for (const songA of catalogA.songs) {
    const normTitle = normalizeText(songA.title)
    const normArtist = normalizeText(songA.artist ?? '')
    const key = `${normTitle}|${normArtist}`

    const songB = bIndex.get(key)
    if (songB) {
      matches.push({
        canonicalTitle: normTitle,
        canonicalArtist: normArtist,
        displayTitle: songA.title,
        displayArtist: songA.artist ?? '',
        matchConfidence: 'exact',
        isConfirmed: true,
        participantCount: 2,
        matchedSongs: [
          {
            userId: catalogA.userId,
            songId: songA.id,
            rawTitle: songA.title,
            rawArtist: songA.artist ?? '',
          },
          {
            userId: catalogB.userId,
            songId: songB.id,
            rawTitle: songB.title,
            rawArtist: songB.artist ?? '',
          },
        ],
      })
    }
  }

  return matches
}

// ============================================================================
// Tier 2: Fuzzy matching between two catalogs
// ============================================================================

/**
 * Find songs that are probably the same (Levenshtein distance ≤ 2 on normalized
 * title, with exact normalized artist match) but didn't match exactly.
 *
 * @param existingMatches - Already found exact matches (to avoid duplicates)
 */
export function computeFuzzyMatches(
  catalogA: ParticipantCatalog,
  catalogB: ParticipantCatalog,
  existingMatches: RawMatch[] = [],
  maxDistance = 2
): RawMatch[] {
  // Build set of already-matched song IDs to avoid duplicates
  const matchedIds = new Set<string>()
  for (const m of existingMatches) {
    for (const ms of m.matchedSongs) {
      matchedIds.add(ms.songId)
    }
  }

  const matches: RawMatch[] = []

  for (const songA of catalogA.songs) {
    if (matchedIds.has(songA.id)) continue
    const normTitleA = normalizeText(songA.title)
    const normArtistA = normalizeText(songA.artist ?? '')

    for (const songB of catalogB.songs) {
      if (matchedIds.has(songB.id)) continue

      const normArtistB = normalizeText(songB.artist ?? '')
      // Artist must match exactly (prevents cross-artist false positives)
      if (normArtistA !== normArtistB) continue

      const normTitleB = normalizeText(songB.title)
      if (normTitleA === normTitleB) continue // Would have been an exact match

      const dist = levenshtein(normTitleA, normTitleB)
      if (dist <= maxDistance) {
        matches.push({
          canonicalTitle: normTitleA,
          canonicalArtist: normArtistA,
          displayTitle: songA.title,
          displayArtist: songA.artist ?? '',
          matchConfidence: 'fuzzy',
          isConfirmed: false, // Requires host confirmation
          participantCount: 2,
          matchedSongs: [
            {
              userId: catalogA.userId,
              songId: songA.id,
              rawTitle: songA.title,
              rawArtist: songA.artist ?? '',
            },
            {
              userId: catalogB.userId,
              songId: songB.id,
              rawTitle: songB.title,
              rawArtist: songB.artist ?? '',
            },
          ],
        })
        // Mark as matched to avoid duplicate fuzzy matches
        matchedIds.add(songA.id)
        matchedIds.add(songB.id)
        break
      }
    }
  }

  return matches
}

// ============================================================================
// Multi-participant merge
// ============================================================================

/**
 * Compute all matches across N participants.
 *
 * Strategy:
 * - Use the first participant as the "host" (their display titles are used)
 * - Find songs that appear in at least 2 participants' catalogs
 * - Accumulate participantCount
 *
 * Returns matches sorted by participantCount DESC (most shared first).
 */
export function mergeMatches(
  participants: ParticipantCatalog[]
): Omit<JamSongMatch, 'id' | 'jamSessionId' | 'computedAt'>[] {
  if (participants.length < 2) return []

  // Map: "normalizedTitle|normalizedArtist" → accumulated match data
  const matchMap = new Map<
    string,
    {
      canonicalTitle: string
      canonicalArtist: string
      displayTitle: string
      displayArtist: string
      matchConfidence: 'exact' | 'fuzzy' | 'manual'
      isConfirmed: boolean
      matchedSongs: JamSongMatch['matchedSongs']
      participantCount: number
    }
  >()

  // Run exact matching between every pair (host vs each other participant)
  // Then pairwise between all others
  const [host, ...others] = participants

  for (const other of others) {
    const exactMatches = computeExactMatches(host, other)
    const fuzzyMatches = computeFuzzyMatches(host, other, exactMatches)
    const allPairMatches = [...exactMatches, ...fuzzyMatches]

    for (const match of allPairMatches) {
      const key = `${match.canonicalTitle}|${match.canonicalArtist}`
      const existing = matchMap.get(key)

      if (existing) {
        // Add this participant's song to the existing match
        const newSong = match.matchedSongs.find(
          ms => ms.userId === other.userId
        )
        if (
          newSong &&
          !existing.matchedSongs.find(
            (ms: { userId: string }) => ms.userId === other.userId
          )
        ) {
          existing.matchedSongs.push(newSong)
          existing.participantCount++
          // Upgrade confidence: if any pair match was exact, keep exact
          if (
            match.matchConfidence === 'exact' &&
            existing.matchConfidence === 'fuzzy'
          ) {
            existing.matchConfidence = 'exact'
            existing.isConfirmed = true
          }
        }
      } else {
        matchMap.set(key, {
          canonicalTitle: match.canonicalTitle,
          canonicalArtist: match.canonicalArtist,
          displayTitle: match.displayTitle,
          displayArtist: match.displayArtist,
          matchConfidence: match.matchConfidence,
          isConfirmed: match.isConfirmed,
          matchedSongs: [...match.matchedSongs],
          participantCount: 2, // At least the host + this participant
        })
      }
    }
  }

  // Sort by participant count DESC, then alphabetically
  return Array.from(matchMap.values()).sort((a, b) => {
    if (b.participantCount !== a.participantCount) {
      return b.participantCount - a.participantCount
    }
    return a.displayTitle.localeCompare(b.displayTitle)
  })
}
