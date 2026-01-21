import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useSpotifySearch } from '../../../../src/hooks/useSpotifySearch'
import type { SpotifyTrack } from '../../../../src/services/spotify/SpotifyService'
import * as SpotifyServiceModule from '../../../../src/services/spotify/SpotifyService'

// Mock the SpotifyService module
vi.mock('../../../../src/services/spotify/SpotifyService', () => ({
  SpotifyService: vi.fn(),
  getSpotifyService: vi.fn(),
}))

describe('useSpotifySearch', () => {
  const mockSearchTracks = vi.fn()
  const mockTracks: SpotifyTrack[] = [
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
    },
  ]

  beforeEach(() => {
    vi.useFakeTimers()
    mockSearchTracks.mockReset()

    // Mock getSpotifyService to return a mock service
    vi.mocked(SpotifyServiceModule.getSpotifyService).mockReturnValue({
      searchTracks: mockSearchTracks,
    } as unknown as SpotifyServiceModule.SpotifyService)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('should initialize with empty state', async () => {
    const { result } = renderHook(() => useSpotifySearch())

    expect(result.current.query).toBe('')
    expect(result.current.results).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should not search when query is less than 3 characters', async () => {
    const { result } = renderHook(() => useSpotifySearch())

    act(() => {
      result.current.setQuery('ab')
    })

    // Fast forward past debounce time
    await act(async () => {
      vi.advanceTimersByTime(500)
    })

    expect(mockSearchTracks).not.toHaveBeenCalled()
    expect(result.current.results).toEqual([])
  })

  it('should search when query is 3+ characters after debounce', async () => {
    mockSearchTracks.mockResolvedValueOnce({ tracks: mockTracks })

    const { result } = renderHook(() => useSpotifySearch())

    act(() => {
      result.current.setQuery('Queen')
    })

    // Before debounce fires, should not be loading
    expect(result.current.isLoading).toBe(false)

    // Advance past debounce time to trigger search
    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    // Wait for search to complete and results to be set
    await waitFor(() => {
      expect(result.current.results).toHaveLength(2)
    })

    expect(mockSearchTracks).toHaveBeenCalledWith('Queen', 10)
    expect(result.current.results).toEqual(mockTracks)
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('should debounce multiple rapid queries', async () => {
    mockSearchTracks.mockResolvedValueOnce({ tracks: mockTracks })

    const { result } = renderHook(() => useSpotifySearch())

    // Simulate typing
    act(() => {
      result.current.setQuery('Q')
    })
    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    act(() => {
      result.current.setQuery('Qu')
    })
    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    act(() => {
      result.current.setQuery('Que')
    })
    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    act(() => {
      result.current.setQuery('Queen')
    })

    // Only after full debounce time should search happen
    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Should only call once with final query
    expect(mockSearchTracks).toHaveBeenCalledTimes(1)
    expect(mockSearchTracks).toHaveBeenCalledWith('Queen', 10)
  })

  it('should handle search errors', async () => {
    mockSearchTracks.mockRejectedValueOnce(new Error('Rate limited'))

    const { result } = renderHook(() => useSpotifySearch())

    act(() => {
      result.current.setQuery('Queen')
    })

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    await waitFor(() => {
      expect(result.current.error).toBe('Rate limited')
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.results).toEqual([])
  })

  it('should clear results when query becomes empty', async () => {
    mockSearchTracks.mockResolvedValueOnce({ tracks: mockTracks })

    const { result } = renderHook(() => useSpotifySearch())

    // First search
    act(() => {
      result.current.setQuery('Queen')
    })

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    await waitFor(() => {
      expect(result.current.results).toHaveLength(2)
    })

    // Clear query
    act(() => {
      result.current.setQuery('')
    })

    expect(result.current.results).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('should clear results when query becomes too short', async () => {
    mockSearchTracks.mockResolvedValueOnce({ tracks: mockTracks })

    const { result } = renderHook(() => useSpotifySearch())

    // First search
    act(() => {
      result.current.setQuery('Queen')
    })

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    await waitFor(() => {
      expect(result.current.results).toHaveLength(2)
    })

    // Shorten query
    act(() => {
      result.current.setQuery('Qu')
    })

    expect(result.current.results).toEqual([])
  })

  it('should provide a clear function', async () => {
    mockSearchTracks.mockResolvedValueOnce({ tracks: mockTracks })

    const { result } = renderHook(() => useSpotifySearch())

    act(() => {
      result.current.setQuery('Queen')
    })

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    await waitFor(() => {
      expect(result.current.results).toHaveLength(2)
    })

    act(() => {
      result.current.clear()
    })

    expect(result.current.query).toBe('')
    expect(result.current.results).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('should accept custom debounce delay', async () => {
    mockSearchTracks.mockResolvedValueOnce({ tracks: mockTracks })

    const { result } = renderHook(() => useSpotifySearch({ debounceMs: 500 }))

    act(() => {
      result.current.setQuery('Queen')
    })

    // Should not search after default 300ms
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    expect(mockSearchTracks).not.toHaveBeenCalled()

    // Should search after custom 500ms
    await act(async () => {
      vi.advanceTimersByTime(200)
    })

    await waitFor(() => {
      expect(mockSearchTracks).toHaveBeenCalled()
    })
  })

  it('should accept custom minimum query length', async () => {
    mockSearchTracks.mockResolvedValueOnce({ tracks: mockTracks })

    const { result } = renderHook(() => useSpotifySearch({ minQueryLength: 5 }))

    act(() => {
      result.current.setQuery('Quee')
    })

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    // Should not search with 4 characters when min is 5
    expect(mockSearchTracks).not.toHaveBeenCalled()

    act(() => {
      result.current.setQuery('Queen')
    })

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    await waitFor(() => {
      expect(mockSearchTracks).toHaveBeenCalled()
    })
  })
})
