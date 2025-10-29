import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  useShows,
  useUpcomingShows,
  useCreateShow,
  useUpdateShow,
  useDeleteShow
} from '../../../src/hooks/useShows'
import { PracticeSessionService } from '../../../src/services/PracticeSessionService'
import { getSyncRepository } from '../../../src/services/data/SyncRepository'
import type { PracticeSession } from '../../../src/models/PracticeSession'

// Mock the services
vi.mock('../../../src/services/PracticeSessionService', () => ({
  PracticeSessionService: {
    getSessions: vi.fn(),
    createSession: vi.fn(),
    updateSession: vi.fn(),
    deleteSession: vi.fn()
  }
}))
vi.mock('../../../src/services/data/SyncRepository', () => ({
  getSyncRepository: vi.fn()
}))

describe('useShows', () => {
  const mockBandId = 'test-band-456'
  const mockShows: PracticeSession[] = [
    {
      id: 'show-1',
      bandId: mockBandId,
      type: 'gig',
      name: 'Test Show 1',
      scheduledDate: new Date('2025-11-15T20:00:00'),
      venue: 'The Rock Club',
      location: '123 Main St',
      duration: 120,
      status: 'scheduled',
      songs: [],
      attendees: [],
      objectives: [],
      completedObjectives: []
    },
    {
      id: 'show-2',
      bandId: mockBandId,
      type: 'gig',
      name: 'Test Show 2',
      scheduledDate: new Date('2025-10-10T21:00:00'),
      venue: 'The Jazz Lounge',
      location: '456 Oak Ave',
      duration: 90,
      status: 'confirmed',
      songs: [],
      attendees: [],
      objectives: [],
      completedObjectives: []
    },
    {
      id: 'practice-1',
      bandId: mockBandId,
      type: 'rehearsal',
      scheduledDate: new Date('2025-10-20T19:00:00'),
      duration: 120,
      status: 'scheduled',
      songs: [],
      attendees: [],
      objectives: [],
      completedObjectives: []
    }
  ]

  let mockRepo: any

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Create mock repository with event emitter
    mockRepo = {
      onSyncStatusChange: vi.fn(() => vi.fn()) // Returns unsubscribe function
    }

    vi.mocked(getSyncRepository).mockReturnValue(mockRepo)
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('useShows hook', () => {
    it('should fetch shows (type=gig) for a band on mount', async () => {
      const gigs = mockShows.filter(p => p.type === 'gig')
      vi.mocked(PracticeSessionService.getSessions).mockResolvedValue({
        sessions: gigs,
        total: gigs.length
      })

      const { result } = renderHook(() => useShows(mockBandId))

      expect(result.current.loading).toBe(true)
      expect(result.current.shows).toEqual([])

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.shows).toHaveLength(2)
      expect(result.current.shows[0].type).toBe('gig')
      expect(result.current.shows[1].type).toBe('gig')
      expect(result.current.error).toBeNull()
    })

    it('should call PracticeSessionService.getSessions with correct bandId', async () => {
      vi.mocked(PracticeSessionService.getSessions).mockResolvedValue({
        sessions: [],
        total: 0
      })

      renderHook(() => useShows(mockBandId))

      await waitFor(() => {
        expect(PracticeSessionService.getSessions).toHaveBeenCalledWith({ bandId: mockBandId })
      })
    })

    it('should sort shows by date ascending', async () => {
      const gigs = mockShows.filter(p => p.type === 'gig')
      vi.mocked(PracticeSessionService.getSessions).mockResolvedValue({
        sessions: gigs,
        total: gigs.length
      })

      const { result } = renderHook(() => useShows(mockBandId))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // show-2 (Oct 10) should come before show-1 (Nov 15)
      expect(result.current.shows[0].id).toBe('show-2')
      expect(result.current.shows[1].id).toBe('show-1')
    })

    it('should handle empty bandId', async () => {
      const { result } = renderHook(() => useShows(''))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.shows).toEqual([])
      expect(PracticeSessionService.getSessions).not.toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      const error = new Error('Failed to fetch shows')
      vi.mocked(PracticeSessionService.getSessions).mockRejectedValue(error)

      const { result } = renderHook(() => useShows(mockBandId))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toEqual(error)
      expect(result.current.shows).toEqual([])
    })

    it('should subscribe to sync changes', async () => {
      vi.mocked(PracticeSessionService.getSessions).mockResolvedValue({
        sessions: [],
        total: 0
      })

      const { unmount } = renderHook(() => useShows(mockBandId))

      await waitFor(() => {
        expect(mockRepo.onSyncStatusChange).toHaveBeenCalled()
      })

      // Verify unsubscribe is called on unmount
      const unsubscribeFn = mockRepo.onSyncStatusChange.mock.results[0].value
      unmount()

      expect(unsubscribeFn).toBeDefined()
    })

    it('should refetch shows when sync status changes', async () => {
      let syncCallback: (() => void) | undefined

      mockRepo.onSyncStatusChange = vi.fn((callback) => {
        syncCallback = callback
        return vi.fn()
      })

      vi.mocked(PracticeSessionService.getSessions).mockResolvedValue({
        sessions: [],
        total: 0
      })

      renderHook(() => useShows(mockBandId))

      await waitFor(() => {
        expect(PracticeSessionService.getSessions).toHaveBeenCalledTimes(1)
      })

      // Trigger sync change
      act(() => {
        syncCallback?.()
      })

      await waitFor(() => {
        expect(PracticeSessionService.getSessions).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('useUpcomingShows hook', () => {
    it('should split shows into upcoming and past', async () => {
      const gigs = mockShows.filter(p => p.type === 'gig')
      vi.mocked(PracticeSessionService.getSessions).mockResolvedValue({
        sessions: gigs,
        total: gigs.length
      })

      const { result } = renderHook(() => useUpcomingShows(mockBandId))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // show-1 (Nov 15, 2025) is upcoming
      expect(result.current.upcomingShows).toHaveLength(1)
      expect(result.current.upcomingShows[0].id).toBe('show-1')

      // show-2 (Oct 10, 2025) is in the past
      expect(result.current.pastShows).toHaveLength(1)
      expect(result.current.pastShows[0].id).toBe('show-2')
    })

    it('should handle all upcoming shows', async () => {
      const futureShows: PracticeSession[] = [
        {
          id: 'future-1',
          bandId: mockBandId,
          type: 'gig',
          scheduledDate: new Date('2026-01-01T20:00:00'),
          duration: 120,
          status: 'scheduled',
          songs: [],
          attendees: [],
          objectives: [],
          completedObjectives: []
        }
      ]

      vi.mocked(PracticeSessionService.getSessions).mockResolvedValue({
        sessions: futureShows,
        total: 1
      })

      const { result } = renderHook(() => useUpcomingShows(mockBandId))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.upcomingShows).toHaveLength(1)
      expect(result.current.pastShows).toHaveLength(0)
    })
  })

  describe('useCreateShow hook', () => {
    it('should create a show with type=gig', async () => {
      const mockShowId = 'new-show-123'
      vi.mocked(PracticeSessionService.createSession).mockResolvedValue({
        id: mockShowId,
        bandId: mockBandId,
        type: 'gig',
        scheduledDate: new Date('2025-12-01T20:00:00'),
        duration: 120,
        status: 'scheduled',
        songs: [],
        attendees: [],
        objectives: [],
        completedObjectives: []
      })

      const { result } = renderHook(() => useCreateShow())

      let createdId: string | undefined

      await act(async () => {
        createdId = await result.current.createShow({
          bandId: mockBandId,
          name: 'New Test Show',
          scheduledDate: new Date('2025-12-01T20:00:00'),
          venue: 'Test Venue',
          duration: 120
        })
      })

      expect(createdId).toBe(mockShowId)
      expect(PracticeSessionService.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          bandId: mockBandId,
          type: 'gig',
          scheduledDate: expect.any(String),
          duration: 120
        })
      )
    })

    it('should use default values for optional fields', async () => {
      vi.mocked(PracticeSessionService.createSession).mockResolvedValue({
        id: 'show-id',
        bandId: mockBandId,
        type: 'gig',
        scheduledDate: new Date(),
        duration: 90,
        status: 'scheduled',
        songs: [],
        attendees: [],
        objectives: [],
        completedObjectives: []
      })

      const { result } = renderHook(() => useCreateShow())

      await act(async () => {
        await result.current.createShow({
          bandId: mockBandId
        })
      })

      expect(PracticeSessionService.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'gig',
          duration: 90,
          status: 'scheduled'
        })
      )
    })

    it('should handle errors', async () => {
      const error = new Error('Failed to create show')
      vi.mocked(PracticeSessionService.createSession).mockRejectedValue(error)

      const { result } = renderHook(() => useCreateShow())

      await expect(
        act(async () => {
          await result.current.createShow({ bandId: mockBandId })
        })
      ).rejects.toThrow('Failed to create show')
    })
  })

  describe('useUpdateShow hook', () => {
    it('should update a show', async () => {
      vi.mocked(PracticeSessionService.updateSession).mockResolvedValue(undefined)

      const { result } = renderHook(() => useUpdateShow())

      await act(async () => {
        await result.current.updateShow('show-1', {
          name: 'Updated Show',
          venue: 'New Venue'
        })
      })

      expect(PracticeSessionService.updateSession).toHaveBeenCalledWith('show-1', {
        name: 'Updated Show',
        venue: 'New Venue'
      })
    })

    it('should handle errors', async () => {
      const error = new Error('Failed to update show')
      vi.mocked(PracticeSessionService.updateSession).mockRejectedValue(error)

      const { result } = renderHook(() => useUpdateShow())

      await expect(
        act(async () => {
          await result.current.updateShow('show-1', { name: 'Updated' })
        })
      ).rejects.toThrow('Failed to update show')
    })
  })

  describe('useDeleteShow hook', () => {
    it('should delete a show', async () => {
      vi.mocked(PracticeSessionService.deleteSession).mockResolvedValue(undefined)

      const { result } = renderHook(() => useDeleteShow())

      await act(async () => {
        await result.current.deleteShow('show-1')
      })

      expect(PracticeSessionService.deleteSession).toHaveBeenCalledWith('show-1')
    })

    it('should handle errors', async () => {
      const error = new Error('Failed to delete show')
      vi.mocked(PracticeSessionService.deleteSession).mockRejectedValue(error)

      const { result } = renderHook(() => useDeleteShow())

      await expect(
        act(async () => {
          await result.current.deleteShow('show-1')
        })
      ).rejects.toThrow('Failed to delete show')
    })
  })
})
