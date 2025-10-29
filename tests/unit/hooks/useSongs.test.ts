import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor, cleanup } from '@testing-library/react'
import { useSongs } from '../../../src/hooks/useSongs'
import { SongService } from '../../../src/services/SongService'
import { getSyncRepository } from '../../../src/services/data/SyncRepository'
import type { Song } from '../../../src/models/Song'

// Mock SongService
vi.mock('../../../src/services/SongService', () => ({
  SongService: {
    getBandSongs: vi.fn(),
  },
}))

// Mock SyncRepository
vi.mock('../../../src/services/data/SyncRepository', () => {
  const mockCallbacks = new Set<() => void>()

  // Create a stable mock instance that will be returned every time
  const mockRepo = {
    onSyncStatusChange: vi.fn((callback: () => void) => {
      mockCallbacks.add(callback)
      // Return unsubscribe function
      return () => mockCallbacks.delete(callback)
    }),
    _triggerSyncStatusChange: () => {
      mockCallbacks.forEach(cb => cb())
    },
    _clearMockCallbacks: () => mockCallbacks.clear(),
  }

  return {
    getSyncRepository: vi.fn(() => mockRepo),
  }
})

describe('useSongs Hook', () => {
  const mockBandId = 'test-band-123'
  const mockSongs: Song[] = [
    {
      id: 'song-1',
      title: 'Test Song 1',
      artist: 'Test Artist 1',
      contextType: 'band',
      contextId: mockBandId,
      createdBy: 'user-1',
      visibility: 'band',
      createdDate: new Date('2025-01-01'),
      confidenceLevel: 3,
      album: 'Test Album',
      duration: 180,
      key: 'C',
      bpm: 120,
      difficulty: 3,
      guitarTuning: 'Standard',
      structure: [],
      chords: [],
      tags: [],
      referenceLinks: [],
    },
    {
      id: 'song-2',
      title: 'Test Song 2',
      artist: 'Test Artist 2',
      contextType: 'band',
      contextId: mockBandId,
      createdBy: 'user-2',
      visibility: 'band',
      createdDate: new Date('2025-01-02'),
      confidenceLevel: 4,
      album: 'Test Album 2',
      duration: 200,
      key: 'G',
      bpm: 140,
      difficulty: 4,
      guitarTuning: 'Standard',
      structure: [],
      chords: [],
      tags: [],
      referenceLinks: [],
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup() // Cleanup React components after each test
    vi.clearAllTimers() // Clear any pending timers
    const repo = getSyncRepository() as any
    repo._clearMockCallbacks()
  })

  describe('Service Integration', () => {
    it('should call SongService.getBandSongs with correct bandId', async () => {
      vi.mocked(SongService.getBandSongs).mockResolvedValue({
        songs: mockSongs,
        total: 2,
        filtered: 2,
      })

      const { result } = renderHook(() => useSongs(mockBandId))

      await waitFor(() => {
        expect(SongService.getBandSongs).toHaveBeenCalledWith(mockBandId)
        expect(SongService.getBandSongs).toHaveBeenCalledTimes(1)
      })
    })

    it('should extract songs array from SongListResponse', async () => {
      vi.mocked(SongService.getBandSongs).mockResolvedValue({
        songs: mockSongs,
        total: 2,
        filtered: 2,
      })

      const { result } = renderHook(() => useSongs(mockBandId))

      await waitFor(() => {
        expect(result.current.songs).toEqual(mockSongs)
        expect(result.current.songs.length).toBe(2)
      })
    })

    it('should not call service when bandId is empty', () => {
      const { result } = renderHook(() => useSongs(''))

      expect(SongService.getBandSongs).not.toHaveBeenCalled()
      expect(result.current.songs).toEqual([])
      expect(result.current.loading).toBe(false)
    })

    it('should refetch when bandId changes', async () => {
      const bandId1 = 'band-1'
      const bandId2 = 'band-2'
      const songs1 = [mockSongs[0]]
      const songs2 = [mockSongs[1]]

      vi.mocked(SongService.getBandSongs)
        .mockResolvedValueOnce({ songs: songs1, total: 1, filtered: 1 })
        .mockResolvedValueOnce({ songs: songs2, total: 1, filtered: 1 })

      const { result, rerender } = renderHook(
        ({ bandId }) => useSongs(bandId),
        { initialProps: { bandId: bandId1 } }
      )

      await waitFor(() => {
        expect(result.current.songs).toEqual(songs1)
      })

      // Change bandId
      rerender({ bandId: bandId2 })

      await waitFor(() => {
        expect(SongService.getBandSongs).toHaveBeenCalledWith(bandId2)
        expect(result.current.songs).toEqual(songs2)
      })

      expect(SongService.getBandSongs).toHaveBeenCalledTimes(2)
    })
  })

  describe('Sync Event Listening', () => {
    it('should subscribe to sync repository status changes on mount', async () => {
      vi.mocked(SongService.getBandSongs).mockResolvedValue({
        songs: mockSongs,
        total: 2,
        filtered: 2,
      })

      renderHook(() => useSongs(mockBandId))

      const repo = getSyncRepository()

      await waitFor(() => {
        expect(repo.onSyncStatusChange).toHaveBeenCalledWith(expect.any(Function))
      })
    })

    it('should unsubscribe from sync events on unmount', async () => {
      vi.mocked(SongService.getBandSongs).mockResolvedValue({
        songs: mockSongs,
        total: 2,
        filtered: 2,
      })

      const repo = getSyncRepository()

      // Track unsubscribe calls
      const unsubscribeMock = vi.fn()
      vi.mocked(repo.onSyncStatusChange).mockReturnValue(unsubscribeMock)

      const { unmount } = renderHook(() => useSongs(mockBandId))

      await waitFor(() => {
        expect(repo.onSyncStatusChange).toHaveBeenCalled()
      })

      unmount()

      expect(unsubscribeMock).toHaveBeenCalled()
    })

    it('should refetch when sync status changes', async () => {
      const initialSongs = [mockSongs[0]]
      const updatedSongs = mockSongs

      vi.mocked(SongService.getBandSongs)
        .mockResolvedValueOnce({ songs: initialSongs, total: 1, filtered: 1 })
        .mockResolvedValueOnce({ songs: updatedSongs, total: 2, filtered: 2 })

      const { result } = renderHook(() => useSongs(mockBandId))

      await waitFor(() => {
        expect(result.current.songs).toEqual(initialSongs)
      })

      // Verify initial fetch happened
      expect(SongService.getBandSongs).toHaveBeenCalledTimes(1)

      // Trigger sync status change event
      act(() => {
        const repo = getSyncRepository() as any
        repo._triggerSyncStatusChange()
      })

      // Wait for refetch to complete
      await waitFor(() => {
        expect(SongService.getBandSongs).toHaveBeenCalledTimes(2)
      })

      await waitFor(() => {
        expect(result.current.songs).toEqual(updatedSongs)
      })
    })

    it('should not subscribe to events when bandId is empty', () => {
      renderHook(() => useSongs(''))

      const repo = getSyncRepository()

      expect(repo.onSyncStatusChange).not.toHaveBeenCalled()
    })
  })

  describe('Loading States', () => {
    it('should set loading true initially', () => {
      vi.mocked(SongService.getBandSongs).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      const { result } = renderHook(() => useSongs(mockBandId))

      expect(result.current.loading).toBe(true)
      expect(result.current.songs).toEqual([])
    })

    it('should set loading false after data loads', async () => {
      vi.mocked(SongService.getBandSongs).mockResolvedValue({
        songs: mockSongs,
        total: 2,
        filtered: 2,
      })

      const { result } = renderHook(() => useSongs(mockBandId))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.songs).toEqual(mockSongs)
      })
    })

    it('should set loading false on error', async () => {
      const error = new Error('Failed to fetch songs')
      vi.mocked(SongService.getBandSongs).mockRejectedValue(error)

      const { result } = renderHook(() => useSongs(mockBandId))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.error).toEqual(error)
      })
    })

    it('should set loading false immediately when bandId is empty', () => {
      const { result } = renderHook(() => useSongs(''))

      expect(result.current.loading).toBe(false)
      expect(result.current.songs).toEqual([])
    })
  })

  describe('Error Handling', () => {
    it('should set error state when service throws', async () => {
      const error = new Error('Service error')
      vi.mocked(SongService.getBandSongs).mockRejectedValue(error)

      const { result } = renderHook(() => useSongs(mockBandId))

      await waitFor(() => {
        expect(result.current.error).toEqual(error)
        expect(result.current.songs).toEqual([])
        expect(result.current.loading).toBe(false)
      })
    })

    it('should clear error on successful refetch', async () => {
      const error = new Error('Service error')
      vi.mocked(SongService.getBandSongs)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({ songs: mockSongs, total: 2, filtered: 2 })

      const { result } = renderHook(() => useSongs(mockBandId))

      await waitFor(() => {
        expect(result.current.error).toEqual(error)
      })

      // Trigger refetch via sync status change event
      act(() => {
        const repo = getSyncRepository() as any
        repo._triggerSyncStatusChange()
      })

      // Wait for refetch to complete
      await waitFor(() => {
        expect(SongService.getBandSongs).toHaveBeenCalledTimes(2)
      })

      await waitFor(() => {
        expect(result.current.error).toBeNull()
        expect(result.current.songs).toEqual(mockSongs)
      })
    })

    it('should initialize with no error', () => {
      vi.mocked(SongService.getBandSongs).mockResolvedValue({
        songs: [],
        total: 0,
        filtered: 0,
      })

      const { result } = renderHook(() => useSongs(mockBandId))

      expect(result.current.error).toBeNull()
    })
  })

  describe('Return Values', () => {
    it('should return all expected fields', async () => {
      vi.mocked(SongService.getBandSongs).mockResolvedValue({
        songs: mockSongs,
        total: 2,
        filtered: 2,
      })

      const { result } = renderHook(() => useSongs(mockBandId))

      await waitFor(() => {
        expect(result.current).toHaveProperty('songs')
        expect(result.current).toHaveProperty('loading')
        expect(result.current).toHaveProperty('error')
        expect(result.current).toHaveProperty('refetch')
      })
    })

    it('should provide refetch function', async () => {
      vi.mocked(SongService.getBandSongs).mockResolvedValue({
        songs: mockSongs,
        total: 2,
        filtered: 2,
      })

      const { result } = renderHook(() => useSongs(mockBandId))

      await waitFor(() => {
        expect(typeof result.current.refetch).toBe('function')
      })
    })
  })
})
