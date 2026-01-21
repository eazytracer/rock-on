import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  SpotifyService,
  SpotifyTrack,
  SpotifySearchResult,
} from '../../../../src/services/spotify/SpotifyService'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('SpotifyService', () => {
  let service: SpotifyService

  beforeEach(() => {
    service = new SpotifyService(
      'http://localhost:54321/functions/v1',
      'test-anon-key'
    )
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('searchTracks', () => {
    const mockSuccessResponse: SpotifySearchResult = {
      tracks: [
        {
          id: 'track1',
          name: 'Bohemian Rhapsody',
          artist: 'Queen',
          album: 'A Night at the Opera',
          durationMs: 354947,
          spotifyUrl: 'https://open.spotify.com/track/track1',
          albumArt: 'https://i.scdn.co/image/album1',
        },
        {
          id: 'track2',
          name: 'We Will Rock You',
          artist: 'Queen',
          album: 'News of the World',
          durationMs: 122000,
          spotifyUrl: 'https://open.spotify.com/track/track2',
          albumArt: 'https://i.scdn.co/image/album2',
        },
      ],
    }

    it('should search tracks successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      })

      const result = await service.searchTracks('Queen')

      expect(mockFetch).toHaveBeenCalledOnce()
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:54321/functions/v1/spotify-search',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-anon-key',
          },
          body: JSON.stringify({ query: 'Queen', limit: 10 }),
        }
      )
      expect(result.tracks).toHaveLength(2)
      expect(result.tracks[0].name).toBe('Bohemian Rhapsody')
    })

    it('should pass custom limit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tracks: [] }),
      })

      await service.searchTracks('Queen', 20)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ query: 'Queen', limit: 20 }),
        })
      )
    })

    it('should return empty array for empty results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tracks: [] }),
      })

      const result = await service.searchTracks('nonexistent song xyz')

      expect(result.tracks).toHaveLength(0)
    })

    it('should throw error on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(service.searchTracks('Queen')).rejects.toThrow(
        'Network error'
      )
    })

    it('should throw error on 500 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () =>
          Promise.resolve({ error: 'Internal server error', tracks: [] }),
      })

      await expect(service.searchTracks('Queen')).rejects.toThrow(
        'Internal server error'
      )
    })

    it('should throw rate limit error on 429 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () =>
          Promise.resolve({
            error: 'Rate limited. Retry after 5 seconds',
            tracks: [],
          }),
      })

      await expect(service.searchTracks('Queen')).rejects.toThrow(
        'Rate limited'
      )
    })

    it('should throw error on 400 response for short query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            error: 'Query must be at least 3 characters',
            tracks: [],
          }),
      })

      await expect(service.searchTracks('Q')).rejects.toThrow(
        'Query must be at least 3 characters'
      )
    })
  })

  describe('track data mapping', () => {
    it('should correctly parse track duration', () => {
      const track: SpotifyTrack = {
        id: 'track1',
        name: 'Test Song',
        artist: 'Test Artist',
        album: 'Test Album',
        durationMs: 180000, // 3 minutes
        spotifyUrl: 'https://open.spotify.com/track/track1',
      }

      // Duration in seconds is calculated by consumer
      const durationSeconds = Math.floor(track.durationMs / 1000)
      expect(durationSeconds).toBe(180)
    })

    it('should handle missing album art', async () => {
      const responseWithoutArt: SpotifySearchResult = {
        tracks: [
          {
            id: 'track1',
            name: 'Song without art',
            artist: 'Artist',
            album: 'Album',
            durationMs: 120000,
            spotifyUrl: 'https://open.spotify.com/track/track1',
            // albumArt is optional
          },
        ],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(responseWithoutArt),
      })

      const result = await service.searchTracks('song')

      expect(result.tracks[0].albumArt).toBeUndefined()
    })
  })

  describe('formatDuration helper', () => {
    it('should format milliseconds to mm:ss', () => {
      expect(SpotifyService.formatDuration(180000)).toBe('3:00')
      expect(SpotifyService.formatDuration(354947)).toBe('5:54')
      expect(SpotifyService.formatDuration(0)).toBe('0:00')
      expect(SpotifyService.formatDuration(59000)).toBe('0:59')
      expect(SpotifyService.formatDuration(3600000)).toBe('60:00')
    })

    it('should handle edge cases', () => {
      // Just under 1 minute
      expect(SpotifyService.formatDuration(59999)).toBe('0:59')
      // Exactly 1 minute
      expect(SpotifyService.formatDuration(60000)).toBe('1:00')
      // Large value
      expect(SpotifyService.formatDuration(7200000)).toBe('120:00')
    })
  })

  describe('durationToSeconds helper', () => {
    it('should convert milliseconds to seconds', () => {
      expect(SpotifyService.durationToSeconds(180000)).toBe(180)
      expect(SpotifyService.durationToSeconds(354947)).toBe(354)
      expect(SpotifyService.durationToSeconds(0)).toBe(0)
    })
  })
})
