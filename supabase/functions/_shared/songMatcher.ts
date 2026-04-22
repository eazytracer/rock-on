/**
 * Song matching utilities — Deno-compatible shared copy.
 *
 * Mirrors src/utils/songMatcher.ts exactly. Types are inlined so this file
 * has zero external imports and can be used by any Edge Function.
 *
 * Matching tiers:
 *   Tier 1 (exact): both normalizedTitle AND normalizedArtist are identical
 *   Tier 2 (fuzzy): Levenshtein distance ≤ 2 on title, exact artist
 *   Tier 3 (manual): host manually links two songs (not computed here)
 */

// ============================================================================
// Inline types (mirrors src/models/Song.ts and src/models/JamSession.ts)
// ============================================================================

export interface SongRecord {
  id: string
  title: string
  artist?: string | null
}

export interface MatchedSongEntry {
  userId: string
  songId: string
  rawTitle: string
  rawArtist: string
}

export interface ParticipantCatalog {
  userId: string
  songs: SongRecord[]
}

export interface RawMatch {
  canonicalTitle: string
  canonicalArtist: string
  displayTitle: string
  displayArtist: string
  matchConfidence: 'exact' | 'fuzzy' | 'manual'
  isConfirmed: boolean
  matchedSongs: MatchedSongEntry[]
  participantCount: number
}

// ============================================================================
// Text normalization (must mirror SQL normalize_text() exactly)
// ============================================================================

export function normalizeText(input: string): string {
  if (!input) return ''
  return input
    .toLowerCase()
    .replace(/^(the|a|an)\s+/i, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ============================================================================
// Levenshtein distance
// ============================================================================

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  return matrix[b.length][a.length]
}

// ============================================================================
// Tier 1: Exact matching
// ============================================================================

export function computeExactMatches(
  catalogA: ParticipantCatalog,
  catalogB: ParticipantCatalog
): RawMatch[] {
  const matches: RawMatch[] = []
  const bIndex = new Map<string, SongRecord>()

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
// Tier 2: Fuzzy matching
// ============================================================================

export function computeFuzzyMatches(
  catalogA: ParticipantCatalog,
  catalogB: ParticipantCatalog,
  existingMatches: RawMatch[] = [],
  maxDistance = 2
): RawMatch[] {
  const matchedIds = new Set<string>()
  for (const m of existingMatches) {
    for (const ms of m.matchedSongs) matchedIds.add(ms.songId)
  }

  const matches: RawMatch[] = []

  for (const songA of catalogA.songs) {
    if (matchedIds.has(songA.id)) continue
    const normTitleA = normalizeText(songA.title)
    const normArtistA = normalizeText(songA.artist ?? '')

    for (const songB of catalogB.songs) {
      if (matchedIds.has(songB.id)) continue
      const normArtistB = normalizeText(songB.artist ?? '')
      if (normArtistA !== normArtistB) continue

      const normTitleB = normalizeText(songB.title)
      if (normTitleA === normTitleB) continue

      const dist = levenshtein(normTitleA, normTitleB)
      if (dist <= maxDistance) {
        matches.push({
          canonicalTitle: normTitleA,
          canonicalArtist: normArtistA,
          displayTitle: songA.title,
          displayArtist: songA.artist ?? '',
          matchConfidence: 'fuzzy',
          isConfirmed: false,
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

export function mergeMatches(participants: ParticipantCatalog[]): RawMatch[] {
  if (participants.length < 2) return []

  const matchMap = new Map<string, RawMatch>()
  const [host, ...others] = participants

  for (const other of others) {
    const exactMatches = computeExactMatches(host, other)
    const fuzzyMatches = computeFuzzyMatches(host, other, exactMatches)

    for (const match of [...exactMatches, ...fuzzyMatches]) {
      const key = `${match.canonicalTitle}|${match.canonicalArtist}`
      const existing = matchMap.get(key)

      if (existing) {
        const newSong = match.matchedSongs.find(
          ms => ms.userId === other.userId
        )
        if (
          newSong &&
          !existing.matchedSongs.find(ms => ms.userId === other.userId)
        ) {
          existing.matchedSongs.push(newSong)
          existing.participantCount++
          if (
            match.matchConfidence === 'exact' &&
            existing.matchConfidence === 'fuzzy'
          ) {
            existing.matchConfidence = 'exact'
            existing.isConfirmed = true
          }
        }
      } else {
        matchMap.set(key, { ...match, matchedSongs: [...match.matchedSongs] })
      }
    }
  }

  return Array.from(matchMap.values()).sort((a, b) => {
    if (b.participantCount !== a.participantCount)
      return b.participantCount - a.participantCount
    return a.displayTitle.localeCompare(b.displayTitle)
  })
}
