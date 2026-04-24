/**
 * Tests for usePersonalSongs hook
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { usePersonalSongs } from '../../../src/hooks/useSongs'
import { SongService } from '../../../src/services/SongService'
import type { Song } from '../../../src/models/Song'

// Mock SongService
vi.mock('../../../src/services/SongService', () => ({
  SongService: {
    getPersonalSongs: vi.fn(),
    getBandSongs: vi.fn(),
  },
}))

// Mock AuthContext
vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    currentUserId: 'user-123',
    currentBandId: 'band-456',
    realtimeManager: null,
  })),
}))

// Mock database
vi.mock('../../../src/services/database', () => ({
  db: {
    songs: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          filter: vi.fn(() => ({ toArray: vi.fn().mockResolvedValue([]) })),
          toArray: vi.fn().mockResolvedValue([]),
        })),
      })),
      toCollection: vi.fn(() => ({
        toArray: vi.fn().mockResolvedValue([]),
        filter: vi.fn(() => ({ toArray: vi.fn().mockResolvedValue([]) })),
      })),
    },
  },
}))

function makePersonalSong(
  id: string,
  title: string,
  userId = 'user-123'
): Song {
  return {
    id,
    title,
    artist: 'Test Artist',
    album: '',
    duration: 180,
    key: 'G',
    bpm: 100,
    difficulty: 2,
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

describe('usePersonalSongs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches personal songs for the given userId', async () => {
    const mockSongs = [
      makePersonalSong('s1', 'My Personal Song 1'),
      makePersonalSong('s2', 'My Personal Song 2'),
    ]
    vi.mocked(SongService.getPersonalSongs).mockResolvedValue({
      songs: mockSongs,
      total: 2,
      filtered: 2,
    })

    const { result } = renderHook(() => usePersonalSongs('user-123'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(SongService.getPersonalSongs).toHaveBeenCalledWith('user-123')
    expect(result.current.songs).toHaveLength(2)
    expect(result.current.songs[0].title).toBe('My Personal Song 1')
    expect(result.current.error).toBeNull()
  })

  it('returns empty array when userId is empty', async () => {
    const { result } = renderHook(() => usePersonalSongs(''))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(SongService.getPersonalSongs).not.toHaveBeenCalled()
    expect(result.current.songs).toHaveLength(0)
  })

  it('re-fetches when userId changes', async () => {
    const mockSongsA = [makePersonalSong('s1', 'Song for User A', 'user-a')]
    const mockSongsB = [makePersonalSong('s2', 'Song for User B', 'user-b')]

    vi.mocked(SongService.getPersonalSongs)
      .mockResolvedValueOnce({ songs: mockSongsA, total: 1, filtered: 1 })
      .mockResolvedValueOnce({ songs: mockSongsB, total: 1, filtered: 1 })

    const { result, rerender } = renderHook(
      ({ userId }: { userId: string }) => usePersonalSongs(userId),
      { initialProps: { userId: 'user-a' } }
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.songs[0].title).toBe('Song for User A')

    rerender({ userId: 'user-b' })

    await waitFor(() => {
      expect(SongService.getPersonalSongs).toHaveBeenCalledWith('user-b')
    })
  })

  it('sets error state when fetch fails', async () => {
    vi.mocked(SongService.getPersonalSongs).mockRejectedValue(
      new Error('Network error') as never
    )

    const { result } = renderHook(() => usePersonalSongs('user-123'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.songs).toHaveLength(0)
  })

  it('starts in loading state', () => {
    vi.mocked(SongService.getPersonalSongs).mockResolvedValue({
      songs: [],
      total: 0,
      filtered: 0,
    })

    const { result } = renderHook(() => usePersonalSongs('user-123'))

    // Initially loading
    expect(result.current.loading).toBe(true)
  })

  it('returned songs all have contextType="personal"', async () => {
    const mockSongs = [makePersonalSong('s1', 'Personal Song')]
    vi.mocked(SongService.getPersonalSongs).mockResolvedValue({
      songs: mockSongs,
      total: 1,
      filtered: 1,
    })

    const { result } = renderHook(() => usePersonalSongs('user-123'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    result.current.songs.forEach(song => {
      expect(song.contextType).toBe('personal')
    })
  })
})
