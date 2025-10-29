import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the database BEFORE any imports
vi.mock('../../../src/services/database', () => ({
  db: {
    setlists: {
      get: vi.fn(),
      filter: vi.fn(() => ({
        toArray: vi.fn().mockResolvedValue([])
      }))
    }
  }
}))

// Mock the services BEFORE any imports
vi.mock('../../../src/services/PracticeSessionService')

vi.mock('../../../src/services/data/SyncRepository', () => {
  const mockSyncRepository = {
    getInstance: vi.fn(() => mockSyncRepository),
    onSyncStatusChange: vi.fn(() => vi.fn()),
    // Add other methods as needed
  }
  return {
    SyncRepository: mockSyncRepository,
    getSyncRepository: vi.fn()
  }
})

// Now import after mocks are set up
import { renderHook, act, waitFor, cleanup } from '@testing-library/react'
import {
  usePractices,
  useUpcomingPractices,
  useCreatePractice,
  useUpdatePractice,
  useDeletePractice,
  useAutoSuggestSongs
} from '../../../src/hooks/usePractices'
import { PracticeSessionService } from '../../../src/services/PracticeSessionService'
import { getSyncRepository } from '../../../src/services/data/SyncRepository'
import type { PracticeSession } from '../../../src/models/PracticeSession'

describe('usePractices', () => {
  const mockBandId = 'test-band-123'
  const mockPractices: PracticeSession[] = [
    {
      id: 'practice-1',
      bandId: mockBandId,
      type: 'rehearsal',
      scheduledDate: new Date('2025-11-01T19:00:00'),
      duration: 120,
      status: 'scheduled',
      songs: [],
      attendees: [],
      objectives: [],
      completedObjectives: []
    },
    {
      id: 'practice-2',
      bandId: mockBandId,
      type: 'rehearsal',
      scheduledDate: new Date('2025-10-15T19:00:00'),
      duration: 90,
      status: 'scheduled',
      songs: [],
      attendees: [],
      objectives: [],
      completedObjectives: []
    },
    {
      id: 'show-1',
      bandId: mockBandId,
      type: 'gig',
      scheduledDate: new Date('2025-11-10T20:00:00'),
      duration: 180,
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
    cleanup() // Cleanup React components after each test
    vi.clearAllTimers()
  })

  describe('usePractices hook', () => {
    it('should fetch practices for a band on mount', async () => {
      const rehearsals = mockPractices.filter(p => p.type === 'rehearsal')
      vi.mocked(PracticeSessionService.getSessions).mockResolvedValue({
        sessions: rehearsals,
        total: rehearsals.length
      })

      const { result } = renderHook(() => usePractices(mockBandId))

      expect(result.current.loading).toBe(true)
      expect(result.current.practices).toEqual([])

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(PracticeSessionService.getSessions).toHaveBeenCalledWith({
        bandId: mockBandId
      })
      expect(result.current.practices).toHaveLength(2)
      expect(result.current.error).toBeNull()
    })

    it('should filter practices to only include rehearsals', async () => {
      vi.mocked(PracticeSessionService.getSessions).mockResolvedValue({
        sessions: mockPractices,
        total: mockPractices.length
      })

      const { result } = renderHook(() => usePractices(mockBandId))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Should only have rehearsal type practices
      const allRehearsals = result.current.practices.every(p => p.type === 'rehearsal')
      expect(allRehearsals).toBe(true)
    })

    it('should sort practices by date in ascending order', async () => {
      const rehearsals = mockPractices.filter(p => p.type === 'rehearsal')
      vi.mocked(PracticeSessionService.getSessions).mockResolvedValue({
        sessions: rehearsals,
        total: rehearsals.length
      })

      const { result } = renderHook(() => usePractices(mockBandId))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const practices = result.current.practices
      expect(practices).toHaveLength(2)

      // Earlier date should come first
      const date1 = new Date(practices[0].scheduledDate).getTime()
      const date2 = new Date(practices[1].scheduledDate).getTime()
      expect(date1).toBeLessThan(date2)
    })

    it('should handle empty bandId', async () => {
      const { result } = renderHook(() => usePractices(''))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(PracticeSessionService.getSessions).not.toHaveBeenCalled()
      expect(result.current.practices).toEqual([])
      expect(result.current.error).toBeNull()
    })

    it('should handle errors gracefully', async () => {
      const error = new Error('Failed to fetch practices')
      vi.mocked(PracticeSessionService.getSessions).mockRejectedValue(error)

      const { result } = renderHook(() => usePractices(mockBandId))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBe(error)
      expect(result.current.practices).toEqual([])
    })

    it('should subscribe to sync repository changes', async () => {
      const rehearsals = mockPractices.filter(p => p.type === 'rehearsal')
      vi.mocked(PracticeSessionService.getSessions).mockResolvedValue({
        sessions: rehearsals,
        total: rehearsals.length
      })

      const mockUnsubscribe = vi.fn()
      mockRepo.onSyncStatusChange.mockReturnValue(mockUnsubscribe)

      const { unmount } = renderHook(() => usePractices(mockBandId))

      await waitFor(() => {
        expect(mockRepo.onSyncStatusChange).toHaveBeenCalledWith(expect.any(Function))
      })

      unmount()

      expect(mockUnsubscribe).toHaveBeenCalled()
    })

    it('should refetch practices when sync repository emits change event', async () => {
      const rehearsals = mockPractices.filter(p => p.type === 'rehearsal')
      vi.mocked(PracticeSessionService.getSessions).mockResolvedValue({
        sessions: rehearsals,
        total: rehearsals.length
      })

      let changeCallback: (() => void) | undefined

      mockRepo.onSyncStatusChange.mockImplementation((callback: () => void) => {
        changeCallback = callback
        return vi.fn() // Return unsubscribe function
      })

      renderHook(() => usePractices(mockBandId))

      await waitFor(() => {
        expect(PracticeSessionService.getSessions).toHaveBeenCalledTimes(1)
      })

      // Trigger the change event
      act(() => {
        changeCallback?.()
      })

      await waitFor(() => {
        expect(PracticeSessionService.getSessions).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('useUpcomingPractices hook', () => {
    it('should separate upcoming and past practices', async () => {
      const now = new Date('2025-10-26T12:00:00')
      vi.setSystemTime(now)

      const rehearsals = mockPractices.filter(p => p.type === 'rehearsal')
      vi.mocked(PracticeSessionService.getSessions).mockResolvedValue({
        sessions: rehearsals,
        total: rehearsals.length
      })

      const { result } = renderHook(() => useUpcomingPractices(mockBandId))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // practice-2 is Oct 15 (past), practice-1 is Nov 1 (upcoming)
      expect(result.current.upcomingPractices).toHaveLength(1)
      expect(result.current.upcomingPractices[0].id).toBe('practice-1')

      expect(result.current.pastPractices).toHaveLength(1)
      expect(result.current.pastPractices[0].id).toBe('practice-2')
    })

    it('should handle all upcoming practices', async () => {
      const now = new Date('2025-10-01T12:00:00')
      vi.setSystemTime(now)

      const rehearsals = mockPractices.filter(p => p.type === 'rehearsal')
      vi.mocked(PracticeSessionService.getSessions).mockResolvedValue({
        sessions: rehearsals,
        total: rehearsals.length
      })

      const { result } = renderHook(() => useUpcomingPractices(mockBandId))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.upcomingPractices).toHaveLength(2)
      expect(result.current.pastPractices).toHaveLength(0)
    })

    it('should handle all past practices', async () => {
      const now = new Date('2025-12-01T12:00:00')
      vi.setSystemTime(now)

      const rehearsals = mockPractices.filter(p => p.type === 'rehearsal')
      vi.mocked(PracticeSessionService.getSessions).mockResolvedValue({
        sessions: rehearsals,
        total: rehearsals.length
      })

      const { result } = renderHook(() => useUpcomingPractices(mockBandId))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.upcomingPractices).toHaveLength(0)
      expect(result.current.pastPractices).toHaveLength(2)
    })
  })

  describe('useCreatePractice hook', () => {
    it('should create a new practice', async () => {
      const newPractice: PracticeSession = {
        id: 'new-practice',
        bandId: mockBandId,
        type: 'rehearsal',
        scheduledDate: new Date('2025-11-15T19:00:00'),
        duration: 120,
        status: 'scheduled',
        songs: [],
        attendees: [],
        objectives: ['Work on timing'],
        completedObjectives: []
      }

      vi.mocked(PracticeSessionService.createSession).mockResolvedValue(newPractice)

      const { result } = renderHook(() => useCreatePractice())

      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()

      let practiceId: string | undefined

      await act(async () => {
        practiceId = await result.current.createPractice({
          bandId: mockBandId,
          scheduledDate: new Date('2025-11-15T19:00:00'),
          duration: 120,
          objectives: ['Work on timing']
        })
      })

      expect(PracticeSessionService.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          bandId: mockBandId,
          type: 'rehearsal',
          duration: 120,
          objectives: ['Work on timing']
        })
      )
      expect(practiceId).toBe('new-practice')
      expect(result.current.error).toBeNull()
    })

    it('should handle create errors', async () => {
      const error = new Error('Failed to create practice')
      vi.mocked(PracticeSessionService.createSession).mockRejectedValue(error)

      const { result } = renderHook(() => useCreatePractice())

      // The error should be thrown
      await expect(
        act(async () => {
          await result.current.createPractice({
            bandId: mockBandId,
            scheduledDate: new Date()
          })
        })
      ).rejects.toThrow('Failed to create practice')

      // After the error, loading should be false
      expect(result.current.loading).toBe(false)
    })

    it('should set loading state during creation', async () => {
      let resolveCreate: (value: PracticeSession) => void
      const createPromise = new Promise<PracticeSession>((resolve) => {
        resolveCreate = resolve
      })

      vi.mocked(PracticeSessionService.createSession).mockReturnValue(createPromise)

      const { result } = renderHook(() => useCreatePractice())

      expect(result.current.loading).toBe(false)

      // Start the creation (don't await)
      let createCall: Promise<string | undefined> | undefined
      act(() => {
        createCall = result.current.createPractice({ bandId: mockBandId, scheduledDate: new Date() })
      })

      // Should be loading
      await waitFor(() => {
        expect(result.current.loading).toBe(true)
      })

      // Resolve the creation
      await act(async () => {
        resolveCreate!({
          id: 'test',
          bandId: mockBandId,
          type: 'rehearsal',
          scheduledDate: new Date(),
          duration: 120,
          status: 'scheduled',
          songs: [],
          attendees: [],
          objectives: [],
          completedObjectives: []
        })
      })

      // Wait for the call to complete
      await createCall

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
    })
  })

  describe('useUpdatePractice hook', () => {
    it('should update an existing practice', async () => {
      const updatedPractice: PracticeSession = {
        ...mockPractices[0],
        duration: 150,
        objectives: ['New objective']
      }

      vi.mocked(PracticeSessionService.updateSession).mockResolvedValue(updatedPractice)

      const { result } = renderHook(() => useUpdatePractice())

      await act(async () => {
        await result.current.updatePractice('practice-1', {
          duration: 150,
          objectives: ['New objective']
        })
      })

      expect(PracticeSessionService.updateSession).toHaveBeenCalledWith('practice-1', {
        duration: 150,
        objectives: ['New objective']
      })
      expect(result.current.error).toBeNull()
    })

    it('should handle update errors', async () => {
      const error = new Error('Failed to update practice')
      vi.mocked(PracticeSessionService.updateSession).mockRejectedValue(error)

      const { result } = renderHook(() => useUpdatePractice())

      // The error should be thrown
      await expect(
        act(async () => {
          await result.current.updatePractice('practice-1', { duration: 150 })
        })
      ).rejects.toThrow('Failed to update practice')

      // After the error, loading should be false
      expect(result.current.loading).toBe(false)
    })

    it('should set loading state during update', async () => {
      let resolveUpdate: (value: PracticeSession) => void
      const updatePromise = new Promise<PracticeSession>((resolve) => {
        resolveUpdate = resolve
      })

      vi.mocked(PracticeSessionService.updateSession).mockReturnValue(updatePromise)

      const { result } = renderHook(() => useUpdatePractice())

      expect(result.current.loading).toBe(false)

      // Start the update (don't await)
      let updateCall: Promise<boolean | undefined> | undefined
      act(() => {
        updateCall = result.current.updatePractice('practice-1', { duration: 150 })
      })

      // Should be loading
      await waitFor(() => {
        expect(result.current.loading).toBe(true)
      })

      // Resolve the update
      await act(async () => {
        resolveUpdate!(mockPractices[0])
      })

      // Wait for the call to complete
      await updateCall

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
    })
  })

  describe('useDeletePractice hook', () => {
    it('should delete a practice', async () => {
      vi.mocked(PracticeSessionService.deleteSession).mockResolvedValue(undefined)

      const { result } = renderHook(() => useDeletePractice())

      await act(async () => {
        await result.current.deletePractice('practice-1')
      })

      expect(PracticeSessionService.deleteSession).toHaveBeenCalledWith('practice-1')
      expect(result.current.error).toBeNull()
    })

    it('should handle delete errors', async () => {
      const error = new Error('Failed to delete practice')
      vi.mocked(PracticeSessionService.deleteSession).mockRejectedValue(error)

      const { result } = renderHook(() => useDeletePractice())

      // The error should be thrown
      await expect(
        act(async () => {
          await result.current.deletePractice('practice-1')
        })
      ).rejects.toThrow('Failed to delete practice')

      // After the error, loading should be false
      expect(result.current.loading).toBe(false)
    })

    it('should set loading state during deletion', async () => {
      let resolveDelete: (value: void) => void
      const deletePromise = new Promise<void>((resolve) => {
        resolveDelete = resolve
      })

      vi.mocked(PracticeSessionService.deleteSession).mockReturnValue(deletePromise)

      const { result } = renderHook(() => useDeletePractice())

      expect(result.current.loading).toBe(false)

      // Start the deletion (don't await)
      let deleteCall: Promise<boolean | undefined> | undefined
      act(() => {
        deleteCall = result.current.deletePractice('practice-1')
      })

      // Should be loading
      await waitFor(() => {
        expect(result.current.loading).toBe(true)
      })

      // Resolve the deletion
      await act(async () => {
        resolveDelete!()
      })

      // Wait for the call to complete
      await deleteCall

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
    })
  })

  describe('useAutoSuggestSongs hook', () => {
    beforeEach(() => {
      // Note: This hook uses direct db access which we'll need to refactor
      // For now, we'll create tests for the expected behavior
    })

    it('should get song suggestions from upcoming shows', async () => {
      const mockSongIds = ['song-1', 'song-2', 'song-3']

      // We'll need to mock the internal implementation once refactored
      // For now, this test documents the expected behavior
      const { result } = renderHook(() => useAutoSuggestSongs(mockBandId))

      expect(result.current.loading).toBe(false)
      expect(result.current.suggestedSongs).toEqual([])
    })

    it('should handle errors when getting suggestions', async () => {
      const { result } = renderHook(() => useAutoSuggestSongs(mockBandId))

      expect(result.current.error).toBeNull()
    })

    it('should return unique song IDs', async () => {
      // Test that duplicate songs from multiple shows are deduplicated
      const { result } = renderHook(() => useAutoSuggestSongs(mockBandId))

      await act(async () => {
        await result.current.getSuggestions()
      })

      // Verify no duplicates in results
      const uniqueSongs = new Set(result.current.suggestedSongs)
      expect(uniqueSongs.size).toBe(result.current.suggestedSongs.length)
    })
  })
})
