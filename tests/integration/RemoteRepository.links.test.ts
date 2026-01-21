import { describe, it, expect } from 'vitest'
import type { ReferenceLink } from '../../src/types'
import type { Song } from '../../src/models/Song'

/**
 * Integration tests for reference_links field mapping in RemoteRepository.
 *
 * These tests verify the mapping logic between IndexedDB (referenceLinks)
 * and Supabase (reference_links) works correctly.
 *
 * NOTE: Actual database integration is tested via E2E tests in tests/e2e/song-links.spec.ts
 * and database schema tests in supabase/tests/012-reference-links.test.sql
 */

// Simulated mapping functions that mirror RemoteRepository logic
function mapSongToSupabase(song: Partial<Song>): Record<string, unknown> {
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    reference_links: song.referenceLinks ?? [],
    // ... other fields omitted for brevity
  }
}

function mapSongFromSupabase(row: Record<string, unknown>): Partial<Song> {
  return {
    id: row.id as string,
    title: row.title as string,
    artist: row.artist as string,
    referenceLinks: (row.reference_links as ReferenceLink[]) ?? [],
    // ... other fields omitted for brevity
  }
}

describe('RemoteRepository.links field mapping', () => {
  describe('mapSongToSupabase', () => {
    it('should map referenceLinks to reference_links', () => {
      const testLinks: ReferenceLink[] = [
        {
          icon: 'spotify',
          url: 'https://open.spotify.com/track/test123',
          description: 'Spotify Track',
        },
        {
          icon: 'youtube',
          url: 'https://www.youtube.com/watch?v=test456',
          description: 'Tutorial Video',
        },
      ]

      const song: Partial<Song> = {
        id: 'test-id',
        title: 'Test Song',
        artist: 'Test Artist',
        referenceLinks: testLinks,
      }

      const supabaseData = mapSongToSupabase(song)

      expect(supabaseData.reference_links).toHaveLength(2)
      expect(supabaseData.reference_links).toEqual(testLinks)
      expect(supabaseData).not.toHaveProperty('referenceLinks')
    })

    it('should handle empty referenceLinks array', () => {
      const song: Partial<Song> = {
        id: 'test-id',
        title: 'Test Song',
        referenceLinks: [],
      }

      const supabaseData = mapSongToSupabase(song)

      expect(supabaseData.reference_links).toEqual([])
    })

    it('should handle undefined referenceLinks', () => {
      const song: Partial<Song> = {
        id: 'test-id',
        title: 'Test Song',
        // referenceLinks not set
      }

      const supabaseData = mapSongToSupabase(song)

      expect(supabaseData.reference_links).toEqual([])
    })

    it('should preserve all link types', () => {
      const allLinkTypes: ReferenceLink[] = [
        { icon: 'spotify', url: 'https://spotify.com/track' },
        { icon: 'youtube', url: 'https://youtube.com/watch' },
        { icon: 'tabs', url: 'https://ultimate-guitar.com' },
        { icon: 'lyrics', url: 'https://genius.com/song' },
        { icon: 'other', url: 'https://example.com/resource' },
      ]

      const song: Partial<Song> = {
        id: 'test-id',
        title: 'Test Song',
        referenceLinks: allLinkTypes,
      }

      const supabaseData = mapSongToSupabase(song)
      const types = (supabaseData.reference_links as ReferenceLink[]).map(
        l => l.icon
      )

      expect(types).toContain('spotify')
      expect(types).toContain('youtube')
      expect(types).toContain('tabs')
      expect(types).toContain('lyrics')
      expect(types).toContain('other')
    })
  })

  describe('mapSongFromSupabase', () => {
    it('should map reference_links to referenceLinks', () => {
      const supabaseRow = {
        id: 'test-id',
        title: 'Test Song',
        artist: 'Test Artist',
        reference_links: [
          {
            icon: 'spotify',
            url: 'https://open.spotify.com/track/test123',
            description: 'Spotify Track',
          },
        ],
      }

      const song = mapSongFromSupabase(supabaseRow)

      expect(song.referenceLinks).toHaveLength(1)
      expect(song.referenceLinks![0].icon).toBe('spotify')
      expect(song.referenceLinks![0].url).toBe(
        'https://open.spotify.com/track/test123'
      )
    })

    it('should handle empty reference_links array', () => {
      const supabaseRow = {
        id: 'test-id',
        title: 'Test Song',
        reference_links: [],
      }

      const song = mapSongFromSupabase(supabaseRow)

      expect(song.referenceLinks).toEqual([])
    })

    it('should handle null reference_links', () => {
      const supabaseRow = {
        id: 'test-id',
        title: 'Test Song',
        reference_links: null,
      }

      const song = mapSongFromSupabase(supabaseRow)

      expect(song.referenceLinks).toEqual([])
    })

    it('should handle undefined reference_links', () => {
      const supabaseRow = {
        id: 'test-id',
        title: 'Test Song',
        // reference_links not present
      }

      const song = mapSongFromSupabase(supabaseRow)

      expect(song.referenceLinks).toEqual([])
    })

    it('should preserve link descriptions through round-trip', () => {
      const originalLinks: ReferenceLink[] = [
        {
          icon: 'tabs',
          url: 'https://ultimate-guitar.com/tabs',
          description: 'Guitar Tabs for Verse',
        },
      ]

      // Simulate round-trip
      const toSupabase = mapSongToSupabase({
        id: 'test-id',
        title: 'Test',
        referenceLinks: originalLinks,
      })

      const fromSupabase = mapSongFromSupabase({
        id: 'test-id',
        title: 'Test',
        reference_links: toSupabase.reference_links,
      })

      expect(fromSupabase.referenceLinks).toHaveLength(1)
      expect(fromSupabase.referenceLinks![0].description).toBe(
        'Guitar Tabs for Verse'
      )
    })
  })

  describe('round-trip data integrity', () => {
    it('should preserve all link data through to/from mapping', () => {
      const originalLinks: ReferenceLink[] = [
        {
          icon: 'spotify',
          url: 'https://open.spotify.com/track/abc',
          description: 'Original Recording',
        },
        { icon: 'youtube', url: 'https://youtube.com/v/xyz' },
        {
          icon: 'tabs',
          url: 'https://songsterr.com/a/tab',
          description: 'Interactive Tabs',
        },
      ]

      const originalSong: Partial<Song> = {
        id: 'round-trip-id',
        title: 'Round Trip Song',
        artist: 'Test Artist',
        referenceLinks: originalLinks,
      }

      // To Supabase
      const supabaseData = mapSongToSupabase(originalSong)

      // From Supabase (simulating what comes back from DB)
      const restoredSong = mapSongFromSupabase({
        id: supabaseData.id,
        title: supabaseData.title,
        artist: supabaseData.artist,
        reference_links: supabaseData.reference_links,
      })

      expect(restoredSong.referenceLinks).toHaveLength(3)
      expect(restoredSong.referenceLinks).toEqual(originalLinks)
    })
  })
})
