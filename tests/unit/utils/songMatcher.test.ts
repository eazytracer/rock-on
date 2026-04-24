/**
 * Tests for song matching utilities used in jam sessions.
 * normalizeText() must match the SQL normalize_text() function exactly.
 * computeExactMatches() / computeFuzzyMatches() / mergeMatches() handle the
 * multi-participant matching algorithm.
 */
import { describe, it, expect } from 'vitest'
import {
  normalizeText,
  computeExactMatches,
  computeFuzzyMatches,
  mergeMatches,
} from '../../../src/utils/songMatcher'
import type { Song } from '../../../src/models/Song'

// ============================================================================
// Helpers
// ============================================================================

function makeSong(
  id: string,
  title: string,
  artist: string,
  userId = 'user-a'
): Song {
  return {
    id,
    title,
    artist,
    album: '',
    duration: 200,
    key: 'C',
    bpm: 120,
    difficulty: 3,
    structure: [],
    lyrics: '',
    chords: [],
    referenceLinks: [],
    tags: [],
    notes: '',
    createdDate: new Date(),
    confidenceLevel: 3,
    contextType: 'personal',
    contextId: userId,
    createdBy: userId,
    visibility: 'personal',
  }
}

// ============================================================================
// normalizeText — must mirror SQL normalize_text() function exactly
// ============================================================================

describe('normalizeText', () => {
  describe('leading article stripping', () => {
    it('strips leading "The "', () => {
      expect(normalizeText('The Black Parade')).toBe('black parade')
    })

    it('strips leading "the " (lowercase)', () => {
      expect(normalizeText('the black parade')).toBe('black parade')
    })

    it('strips leading "A " article', () => {
      expect(normalizeText('A Day To Remember')).toBe('day to remember')
    })

    it('strips leading "An " article', () => {
      expect(normalizeText('An Honest Mistake')).toBe('honest mistake')
    })

    it('does NOT strip "The" from the middle of a string', () => {
      expect(normalizeText('Welcome To The Black Parade')).toBe(
        'welcome to the black parade'
      )
    })

    it('does NOT strip "A" that is part of a word', () => {
      expect(normalizeText('ABBA')).toBe('abba')
    })
  })

  describe('apostrophe normalization', () => {
    it('removes straight apostrophes', () => {
      expect(normalizeText("Don't Stop Believin'")).toBe('dont stop believin')
    })

    it('removes curly apostrophes (right single quote)', () => {
      expect(normalizeText('Don\u2019t Stop')).toBe('dont stop')
    })

    it('removes backtick-style apostrophes (only article at start is stripped)', () => {
      // Note: "a" article only stripped from START of string, not mid-string
      expect(normalizeText("Nothin' But a Good Time")).toBe(
        'nothin but a good time'
      )
    })
  })

  describe('punctuation stripping', () => {
    it('strips forward slash', () => {
      expect(normalizeText('AC/DC')).toBe('acdc')
    })

    it('strips exclamation mark', () => {
      expect(normalizeText('Bon Jovi!')).toBe('bon jovi')
    })

    it('strips hyphens', () => {
      expect(normalizeText('Run-D.M.C.')).toBe('rundmc')
    })

    it('strips periods', () => {
      expect(normalizeText('R.E.M.')).toBe('rem')
    })

    it('strips parentheses and contents... wait, just the parens', () => {
      // Parens themselves get stripped; words inside remain
      expect(normalizeText('Sweet Home Alabama (Live)')).toBe(
        'sweet home alabama live'
      )
    })

    it('strips commas', () => {
      expect(normalizeText('Hello, Goodbye')).toBe('hello goodbye')
    })
  })

  describe('case folding', () => {
    it('lowercases everything', () => {
      expect(normalizeText('BOHEMIAN RHAPSODY')).toBe('bohemian rhapsody')
    })

    it('handles mixed case', () => {
      expect(normalizeText('Stairway To Heaven')).toBe('stairway to heaven')
    })
  })

  describe('whitespace collapsing', () => {
    it('collapses multiple spaces into one', () => {
      expect(normalizeText('Sweet   Home   Alabama')).toBe('sweet home alabama')
    })

    it('trims leading and trailing whitespace', () => {
      expect(normalizeText('  Wonderwall  ')).toBe('wonderwall')
    })
  })

  describe('article variation equivalence — the core jam matching cases', () => {
    it('"The Black Parade" and "Black Parade" normalize identically', () => {
      expect(normalizeText('The Black Parade')).toBe(
        normalizeText('Black Parade')
      )
    })

    it('"The Counting Crows" and "Counting Crows" normalize identically', () => {
      expect(normalizeText('The Counting Crows')).toBe(
        normalizeText('Counting Crows')
      )
    })

    it('"The Beatles" and "Beatles" normalize identically', () => {
      expect(normalizeText('The Beatles')).toBe(normalizeText('Beatles'))
    })

    it('"A Day To Remember" and "Day To Remember" normalize identically', () => {
      expect(normalizeText('A Day To Remember')).toBe(
        normalizeText('Day To Remember')
      )
    })
  })

  describe('apostrophe variation equivalence', () => {
    it('"Don\'t Stop Believin\'" and "Don\'t Stop Believing" — NOT the same (different ending)', () => {
      // These are actually different after normalization
      const v1 = normalizeText("Don't Stop Believin'")
      const v2 = normalizeText("Don't Stop Believing")
      // v1 = "dont stop believin", v2 = "dont stop believing" — different!
      expect(v1).not.toBe(v2)
    })
  })

  describe('empty/edge cases', () => {
    it('handles empty string', () => {
      expect(normalizeText('')).toBe('')
    })

    it('handles string with only punctuation', () => {
      expect(normalizeText('...')).toBe('')
    })

    it('handles numbers', () => {
      expect(normalizeText('99 Problems')).toBe('99 problems')
    })

    it('handles unicode letters by stripping non-alphanumeric', () => {
      // é, ñ etc. get stripped since they are not a-z0-9
      expect(normalizeText('Café')).toBe('caf')
    })
  })
})

// ============================================================================
// computeExactMatches — Tier 1: both normalized title AND artist must match
// ============================================================================

describe('computeExactMatches', () => {
  it('returns a match when title and artist both normalize identically', () => {
    const catalogA = [makeSong('a1', 'Wonderwall', 'Oasis', 'user-a')]
    const catalogB = [makeSong('b1', 'Wonderwall', 'Oasis', 'user-b')]
    const matches = computeExactMatches(
      { userId: 'user-a', songs: catalogA },
      { userId: 'user-b', songs: catalogB }
    )
    expect(matches).toHaveLength(1)
    expect(matches[0].canonicalTitle).toBe('wonderwall')
    expect(matches[0].canonicalArtist).toBe('oasis')
    expect(matches[0].matchConfidence).toBe('exact')
    expect(matches[0].participantCount).toBe(2)
  })

  it('matches despite "The" article difference in title', () => {
    const catalogA = [makeSong('a1', 'The Black Parade', 'My Chemical Romance')]
    const catalogB = [makeSong('b1', 'Black Parade', 'My Chemical Romance')]
    const matches = computeExactMatches(
      { userId: 'user-a', songs: catalogA },
      { userId: 'user-b', songs: catalogB }
    )
    expect(matches).toHaveLength(1)
  })

  it('does NOT match songs with same title but different artists', () => {
    const catalogA = [makeSong('a1', 'Hurt', 'Nine Inch Nails')]
    const catalogB = [makeSong('b1', 'Hurt', 'Johnny Cash')]
    const matches = computeExactMatches(
      { userId: 'user-a', songs: catalogA },
      { userId: 'user-b', songs: catalogB }
    )
    expect(matches).toHaveLength(0)
  })

  it('returns empty array when catalogs have no songs in common', () => {
    const catalogA = [makeSong('a1', 'Wonderwall', 'Oasis')]
    const catalogB = [makeSong('b1', 'Bohemian Rhapsody', 'Queen')]
    const matches = computeExactMatches(
      { userId: 'user-a', songs: catalogA },
      { userId: 'user-b', songs: catalogB }
    )
    expect(matches).toHaveLength(0)
  })

  it('includes both participants song IDs in matchedSongs', () => {
    const catalogA = [makeSong('a1', 'Stairway To Heaven', 'Led Zeppelin')]
    const catalogB = [makeSong('b1', 'Stairway to Heaven', 'Led Zeppelin')]
    const matches = computeExactMatches(
      { userId: 'user-a', songs: catalogA },
      { userId: 'user-b', songs: catalogB }
    )
    expect(matches[0].matchedSongs).toHaveLength(2)
    const songIds = matches[0].matchedSongs.map(m => m.songId)
    expect(songIds).toContain('a1')
    expect(songIds).toContain('b1')
  })

  it('returns multiple matches when catalogs share multiple songs', () => {
    const catalogA = [
      makeSong('a1', 'Wonderwall', 'Oasis'),
      makeSong('a2', 'Champagne Supernova', 'Oasis'),
    ]
    const catalogB = [
      makeSong('b1', 'Wonderwall', 'Oasis'),
      makeSong('b2', 'Champagne Supernova', 'Oasis'),
    ]
    const matches = computeExactMatches(
      { userId: 'user-a', songs: catalogA },
      { userId: 'user-b', songs: catalogB }
    )
    expect(matches).toHaveLength(2)
  })
})

// ============================================================================
// computeFuzzyMatches — Tier 2: Levenshtein distance ≤ 2 on title, exact artist
// ============================================================================

describe('computeFuzzyMatches', () => {
  it('matches titles with 1-2 character difference (typo/missing letter)', () => {
    // "wonderwal" vs "wonderwall" — 1 character difference
    const catalogA = [makeSong('a1', 'Wonderwall', 'Oasis')]
    const catalogB = [makeSong('b1', 'Wonderwal', 'Oasis')] // missing one 'l'
    const matches = computeFuzzyMatches(
      { userId: 'user-a', songs: catalogA },
      { userId: 'user-b', songs: catalogB }
    )
    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0].matchConfidence).toBe('fuzzy')
    expect(matches[0].isConfirmed).toBe(false)
  })

  it('does NOT match heavily abbreviated titles (distance > 2)', () => {
    // "bohemian rhapsody" vs "bohemian rhap" — distance 4, too different for auto-fuzzy
    const catalogA = [makeSong('a1', 'Bohemian Rhapsody', 'Queen')]
    const catalogB = [makeSong('b1', 'Bohemian Rhap.', 'Queen')]
    const matches = computeFuzzyMatches(
      { userId: 'user-a', songs: catalogA },
      { userId: 'user-b', songs: catalogB }
    )
    // Distance > 2, so no automatic fuzzy match — requires manual linking
    expect(matches).toHaveLength(0)
  })

  it('fuzzy matches have isConfirmed=false (pending host confirmation)', () => {
    // "wonderwall" vs "wonderwal" — 1 char difference, should be fuzzy
    const catalogA = [makeSong('a1', 'Wonderwall', 'Oasis')]
    const catalogB = [makeSong('b1', 'Wonderwal', 'Oasis')]
    const matches = computeFuzzyMatches(
      { userId: 'user-a', songs: catalogA },
      { userId: 'user-b', songs: catalogB }
    )
    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0].isConfirmed).toBe(false)
  })

  it('does NOT fuzzy match when artists are different', () => {
    const catalogA = [makeSong('a1', 'Hurt', 'Nine Inch Nails')]
    const catalogB = [makeSong('b1', 'Hurt', 'Johnny Cash')]
    const matches = computeFuzzyMatches(
      { userId: 'user-a', songs: catalogA },
      { userId: 'user-b', songs: catalogB }
    )
    expect(matches).toHaveLength(0)
  })

  it('does NOT return fuzzy matches for songs that already have exact matches', () => {
    const catalogA = [makeSong('a1', 'Wonderwall', 'Oasis')]
    const catalogB = [makeSong('b1', 'Wonderwall', 'Oasis')]
    // Exact match should take precedence
    const exactMatches = computeExactMatches(
      { userId: 'user-a', songs: catalogA },
      { userId: 'user-b', songs: catalogB }
    )
    const fuzzyMatches = computeFuzzyMatches(
      { userId: 'user-a', songs: catalogA },
      { userId: 'user-b', songs: catalogB },
      exactMatches
    )
    // Should not duplicate the exact match as a fuzzy match
    expect(fuzzyMatches).toHaveLength(0)
  })
})

// ============================================================================
// mergeMatches — multi-participant aggregation
// ============================================================================

describe('mergeMatches', () => {
  it('aggregates matches across 3 participants: all 3 have same song', () => {
    const catalogA = [makeSong('a1', 'Wonderwall', 'Oasis', 'user-a')]
    const catalogB = [makeSong('b1', 'Wonderwall', 'Oasis', 'user-b')]
    const catalogC = [makeSong('c1', 'Wonderwall', 'Oasis', 'user-c')]

    const participants = [
      { userId: 'user-a', songs: catalogA },
      { userId: 'user-b', songs: catalogB },
      { userId: 'user-c', songs: catalogC },
    ]
    const matches = mergeMatches(participants)
    expect(matches).toHaveLength(1)
    expect(matches[0].participantCount).toBe(3)
  })

  it('shows participantCount=2 when only 2 of 3 participants have a song', () => {
    const catalogA = [makeSong('a1', 'Wonderwall', 'Oasis', 'user-a')]
    const catalogB = [makeSong('b1', 'Wonderwall', 'Oasis', 'user-b')]
    const catalogC = [makeSong('c1', 'Bohemian Rhapsody', 'Queen', 'user-c')] // different song

    const participants = [
      { userId: 'user-a', songs: catalogA },
      { userId: 'user-b', songs: catalogB },
      { userId: 'user-c', songs: catalogC },
    ]
    const matches = mergeMatches(participants)
    const wonderwall = matches.find(m => m.canonicalTitle === 'wonderwall')
    expect(wonderwall).toBeDefined()
    expect(wonderwall?.participantCount).toBe(2)
  })

  it('returns empty array when no participants have any songs in common', () => {
    const participants = [
      { userId: 'user-a', songs: [makeSong('a1', 'Song A', 'Artist A')] },
      { userId: 'user-b', songs: [makeSong('b1', 'Song B', 'Artist B')] },
      { userId: 'user-c', songs: [makeSong('c1', 'Song C', 'Artist C')] },
    ]
    const matches = mergeMatches(participants)
    expect(matches).toHaveLength(0)
  })

  it('handles single participant (no matches possible)', () => {
    const participants = [
      { userId: 'user-a', songs: [makeSong('a1', 'Wonderwall', 'Oasis')] },
    ]
    const matches = mergeMatches(participants)
    expect(matches).toHaveLength(0)
  })

  it('uses display_title from the first (host) participant', () => {
    const catalogA = [
      makeSong('a1', 'The Black Parade', 'My Chemical Romance', 'user-a'),
    ]
    const catalogB = [
      makeSong('b1', 'Black Parade', 'My Chemical Romance', 'user-b'),
    ]

    const participants = [
      { userId: 'user-a', songs: catalogA },
      { userId: 'user-b', songs: catalogB },
    ]
    const matches = mergeMatches(participants)
    expect(matches).toHaveLength(1)
    // Display title should come from host (first participant)
    expect(matches[0].displayTitle).toBe('The Black Parade')
  })
})
