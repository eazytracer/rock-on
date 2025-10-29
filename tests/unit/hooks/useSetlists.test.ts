import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import {
  useSetlists,
  useCreateSetlist,
  useUpdateSetlist,
  useDeleteSetlist,
  useAddSetlistItem,
  useRemoveSetlistItem,
  useReorderSetlistItems
} from '../../../src/hooks/useSetlists'
import { SetlistService } from '../../../src/services/SetlistService'
import { SyncRepository } from '../../../src/services/data/SyncRepository'
import type { Setlist } from '../../../src/models/Setlist'
import type { SetlistItem } from '../../../src/types'
import type { SyncStatus } from '../../../src/services/data/syncTypes'

// Mock SetlistService
vi.mock('../../../src/services/SetlistService', () => ({
  SetlistService: {
    getSetlists: vi.fn(),
    createSetlist: vi.fn(),
    updateSetlist: vi.fn(),
    deleteSetlist: vi.fn(),
    addSongToSetlist: vi.fn(),
    removeSongFromSetlist: vi.fn(),
    reorderSongs: vi.fn(),
    getSetlistById: vi.fn(),
  }
}))

// Mock SyncRepository
vi.mock('../../../src/services/data/SyncRepository', () => {
  const mockCallbacks = new Set<(status: SyncStatus) => void>()

  return {
    SyncRepository: {
      getInstance: vi.fn(() => ({
        onSyncStatusChange: vi.fn((callback: (status: SyncStatus) => void) => {
          mockCallbacks.add(callback)
          return () => mockCallbacks.delete(callback)
        }),
        _triggerStatusChange: (status: SyncStatus) => {
          mockCallbacks.forEach(cb => cb(status))
        },
        _clearMockCallbacks: () => mockCallbacks.clear(),
      })),
    },
    getSyncRepository: vi.fn(() => ({
      onSyncStatusChange: vi.fn((callback: (status: SyncStatus) => void) => {
        mockCallbacks.add(callback)
        return () => mockCallbacks.delete(callback)
      }),
      _triggerStatusChange: (status: SyncStatus) => {
        mockCallbacks.forEach(cb => cb(status))
      },
      _clearMockCallbacks: () => mockCallbacks.clear(),
    })),
  }
})

describe('useSetlists Hook', () => {
  const mockBandId = 'band-123'
  const mockSetlists: Setlist[] = [
    {
      id: 'setlist-1',
      name: 'Summer Tour 2025',
      bandId: mockBandId,
      items: [],
      songs: [],
      totalDuration: 0,
      status: 'draft',
      createdDate: new Date('2025-10-01'),
      lastModified: new Date('2025-10-01'),
    },
    {
      id: 'setlist-2',
      name: 'Acoustic Set',
      bandId: mockBandId,
      items: [],
      songs: [],
      totalDuration: 120,
      status: 'active',
      createdDate: new Date('2025-10-15'),
      lastModified: new Date('2025-10-15'),
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(async () => {
    const { getSyncRepository } = vi.mocked(await import('../../../src/services/data/SyncRepository'))
    const repo = getSyncRepository() as any
    repo._clearMockCallbacks()
  })

  describe('useSetlists', () => {
    it('should fetch setlists on mount', async () => {
      vi.mocked(SetlistService.getSetlists).mockResolvedValue({
        setlists: mockSetlists,
        total: 2
      })

      const { result } = renderHook(() => useSetlists(mockBandId))

      // Initial state
      expect(result.current.loading).toBe(true)
      expect(result.current.setlists).toEqual([])

      // Wait for fetch to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Verify service was called correctly
      expect(SetlistService.getSetlists).toHaveBeenCalledWith({ bandId: mockBandId })
      expect(result.current.setlists).toEqual(mockSetlists)
      expect(result.current.error).toBeNull()
    })

    it('should return empty array when bandId is empty', () => {
      const { result } = renderHook(() => useSetlists(''))

      expect(result.current.setlists).toEqual([])
      expect(result.current.loading).toBe(false)
      expect(SetlistService.getSetlists).not.toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      const error = new Error('Failed to fetch setlists')
      vi.mocked(SetlistService.getSetlists).mockRejectedValue(error)

      const { result } = renderHook(() => useSetlists(mockBandId))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toEqual(error)
      expect(result.current.setlists).toEqual([])
    })

    it('should refetch when bandId changes', async () => {
      vi.mocked(SetlistService.getSetlists).mockResolvedValue({
        setlists: mockSetlists,
        total: 2
      })

      const { result, rerender } = renderHook(
        ({ bandId }) => useSetlists(bandId),
        { initialProps: { bandId: mockBandId } }
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(SetlistService.getSetlists).toHaveBeenCalledTimes(1)

      // Change bandId
      const newBandId = 'band-456'
      rerender({ bandId: newBandId })

      await waitFor(() => {
        expect(SetlistService.getSetlists).toHaveBeenCalledWith({ bandId: newBandId })
      })

      expect(SetlistService.getSetlists).toHaveBeenCalledTimes(2)
    })

    it('should subscribe to sync events and refetch on changes', async () => {
      vi.mocked(SetlistService.getSetlists).mockResolvedValue({
        setlists: mockSetlists,
        total: 2
      })

      const { getSyncRepository } = vi.mocked(await import('../../../src/services/data/SyncRepository'))
      const repo = getSyncRepository() as any

      const { result } = renderHook(() => useSetlists(mockBandId))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(SetlistService.getSetlists).toHaveBeenCalledTimes(1)

      // Trigger sync event
      act(() => {
        repo._triggerStatusChange({
          isEnabled: true,
          isSyncing: false,
          pendingCount: 0,
          failedCount: 0,
          conflictCount: 0,
          lastSyncTime: new Date(),
        })
      })

      // Should refetch
      await waitFor(() => {
        expect(SetlistService.getSetlists).toHaveBeenCalledTimes(2)
      })
    })

    it('should cleanup sync listener on unmount', async () => {
      vi.mocked(SetlistService.getSetlists).mockResolvedValue({
        setlists: mockSetlists,
        total: 2
      })

      const unsubscribeSpy = vi.fn()
      const { getSyncRepository } = vi.mocked(await import('../../../src/services/data/SyncRepository'))
      const mockRepo = {
        onSyncStatusChange: vi.fn(() => unsubscribeSpy),
        _triggerStatusChange: vi.fn(),
        _clearMockCallbacks: vi.fn(),
      }
      vi.mocked(getSyncRepository).mockReturnValue(mockRepo as any)

      const { unmount } = renderHook(() => useSetlists(mockBandId))

      await waitFor(() => {
        expect(mockRepo.onSyncStatusChange).toHaveBeenCalled()
      })

      unmount()

      expect(unsubscribeSpy).toHaveBeenCalled()
    })
  })

  describe('useCreateSetlist', () => {
    it('should create a setlist successfully', async () => {
      const newSetlist: Setlist = {
        id: 'setlist-new',
        name: 'New Setlist',
        bandId: mockBandId,
        items: [],
        songs: [],
        totalDuration: 0,
        status: 'draft',
        createdDate: new Date(),
        lastModified: new Date(),
      }

      vi.mocked(SetlistService.createSetlist).mockResolvedValue(newSetlist)

      const { result } = renderHook(() => useCreateSetlist())

      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()

      let setlistId: string | undefined
      await act(async () => {
        setlistId = await result.current.createSetlist({
          name: 'New Setlist',
          bandId: mockBandId
        })
      })

      expect(setlistId).toBe('setlist-new')
      expect(SetlistService.createSetlist).toHaveBeenCalledWith({
        name: 'New Setlist',
        bandId: mockBandId
      })
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should handle creation errors', async () => {
      const error = new Error('Failed to create setlist')
      vi.mocked(SetlistService.createSetlist).mockRejectedValue(error)

      const { result } = renderHook(() => useCreateSetlist())

      // The error should be thrown
      await expect(
        act(async () => {
          await result.current.createSetlist({
            name: 'New Setlist',
            bandId: mockBandId
          })
        })
      ).rejects.toThrow('Failed to create setlist')

      // After the error, loading should be false
      expect(result.current.loading).toBe(false)
    })

    it('should set loading state during creation', async () => {
      let resolveCreate: (value: Setlist) => void
      const createPromise = new Promise<Setlist>(resolve => {
        resolveCreate = resolve
      })

      vi.mocked(SetlistService.createSetlist).mockReturnValue(createPromise)

      const { result } = renderHook(() => useCreateSetlist())

      // Start the creation (don't await)
      let createCall: Promise<void> | undefined
      act(() => {
        createCall = (async () => {
          await result.current.createSetlist({
            name: 'New Setlist',
            bandId: mockBandId
          })
        })()
      })

      // Should be loading
      await waitFor(() => {
        expect(result.current.loading).toBe(true)
      })

      // Resolve the creation
      await act(async () => {
        resolveCreate!({
          id: 'setlist-new',
          name: 'New Setlist',
          bandId: mockBandId,
          items: [],
          songs: [],
          totalDuration: 0,
          status: 'draft',
          createdDate: new Date(),
          lastModified: new Date(),
        })
        await createCall
      })

      expect(result.current.loading).toBe(false)
    })
  })

  describe('useUpdateSetlist', () => {
    it('should update a setlist successfully', async () => {
      const updatedSetlist: Setlist = {
        ...mockSetlists[0],
        name: 'Updated Name',
      }

      vi.mocked(SetlistService.updateSetlist).mockResolvedValue(updatedSetlist)

      const { result } = renderHook(() => useUpdateSetlist())

      let success: boolean | undefined
      await act(async () => {
        success = await result.current.updateSetlist('setlist-1', {
          name: 'Updated Name'
        })
      })

      expect(success).toBe(true)
      expect(SetlistService.updateSetlist).toHaveBeenCalledWith('setlist-1', {
        name: 'Updated Name'
      })
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should handle update errors', async () => {
      const error = new Error('Failed to update setlist')
      vi.mocked(SetlistService.updateSetlist).mockRejectedValue(error)

      const { result } = renderHook(() => useUpdateSetlist())

      await expect(
        act(async () => {
          await result.current.updateSetlist('setlist-1', { name: 'Updated' })
        })
      ).rejects.toThrow('Failed to update setlist')

      expect(result.current.loading).toBe(false)
    })
  })

  describe('useDeleteSetlist', () => {
    it('should delete a setlist successfully', async () => {
      vi.mocked(SetlistService.deleteSetlist).mockResolvedValue()

      const { result } = renderHook(() => useDeleteSetlist())

      let success: boolean | undefined
      await act(async () => {
        success = await result.current.deleteSetlist('setlist-1')
      })

      expect(success).toBe(true)
      expect(SetlistService.deleteSetlist).toHaveBeenCalledWith('setlist-1')
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should handle deletion errors', async () => {
      const error = new Error('Failed to delete setlist')
      vi.mocked(SetlistService.deleteSetlist).mockRejectedValue(error)

      const { result } = renderHook(() => useDeleteSetlist())

      await expect(
        act(async () => {
          await result.current.deleteSetlist('setlist-1')
        })
      ).rejects.toThrow('Failed to delete setlist')

      expect(result.current.loading).toBe(false)
    })
  })

  describe('useAddSetlistItem', () => {
    it('should add an item to a setlist successfully', async () => {
      const updatedSetlist: Setlist = {
        ...mockSetlists[0],
        songs: [{ songId: 'song-1', order: 1 }],
      }

      vi.mocked(SetlistService.addSongToSetlist).mockResolvedValue(updatedSetlist)

      const { result } = renderHook(() => useAddSetlistItem())

      const item: Omit<SetlistItem, 'id' | 'position'> = {
        type: 'song',
        songId: 'song-1',
      }

      let newItem: SetlistItem | undefined
      await act(async () => {
        newItem = await result.current.addItem('setlist-1', item)
      })

      expect(newItem).toBeDefined()
      expect(SetlistService.addSongToSetlist).toHaveBeenCalledWith('setlist-1', {
        songId: 'song-1',
      })
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should handle add item errors', async () => {
      const error = new Error('Failed to add item')
      vi.mocked(SetlistService.addSongToSetlist).mockRejectedValue(error)

      const { result } = renderHook(() => useAddSetlistItem())

      const item: Omit<SetlistItem, 'id' | 'position'> = {
        type: 'song',
        songId: 'song-1',
      }

      await expect(
        act(async () => {
          await result.current.addItem('setlist-1', item)
        })
      ).rejects.toThrow('Failed to add item')

      expect(result.current.loading).toBe(false)
    })
  })

  describe('useRemoveSetlistItem', () => {
    it('should remove an item from a setlist successfully', async () => {
      const updatedSetlist: Setlist = {
        ...mockSetlists[0],
        songs: [],
      }

      vi.mocked(SetlistService.removeSongFromSetlist).mockResolvedValue(updatedSetlist)

      const { result } = renderHook(() => useRemoveSetlistItem())

      let success: boolean | undefined
      await act(async () => {
        success = await result.current.removeItem('setlist-1', 'song-1')
      })

      expect(success).toBe(true)
      expect(SetlistService.removeSongFromSetlist).toHaveBeenCalledWith('setlist-1', 'song-1')
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should handle remove item errors', async () => {
      const error = new Error('Failed to remove item')
      vi.mocked(SetlistService.removeSongFromSetlist).mockRejectedValue(error)

      const { result } = renderHook(() => useRemoveSetlistItem())

      await expect(
        act(async () => {
          await result.current.removeItem('setlist-1', 'song-1')
        })
      ).rejects.toThrow('Failed to remove item')

      expect(result.current.loading).toBe(false)
    })
  })

  describe('useReorderSetlistItems', () => {
    it('should reorder setlist items successfully', async () => {
      const updatedSetlist: Setlist = {
        ...mockSetlists[0],
        songs: [
          { songId: 'song-2', order: 1 },
          { songId: 'song-1', order: 2 },
        ],
      }

      vi.mocked(SetlistService.reorderSongs).mockResolvedValue(updatedSetlist)

      const { result } = renderHook(() => useReorderSetlistItems())

      const reorderedItems: SetlistItem[] = [
        { id: 'item-2', type: 'song', songId: 'song-2', position: 1 },
        { id: 'item-1', type: 'song', songId: 'song-1', position: 2 },
      ]

      let success: boolean | undefined
      await act(async () => {
        success = await result.current.reorderItems('setlist-1', reorderedItems)
      })

      expect(success).toBe(true)
      expect(SetlistService.reorderSongs).toHaveBeenCalledWith('setlist-1', {
        songOrder: ['song-2', 'song-1']
      })
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should handle reorder errors', async () => {
      const error = new Error('Failed to reorder items')
      vi.mocked(SetlistService.reorderSongs).mockRejectedValue(error)

      const { result } = renderHook(() => useReorderSetlistItems())

      const reorderedItems: SetlistItem[] = [
        { id: 'item-2', type: 'song', songId: 'song-2', position: 1 },
      ]

      await expect(
        act(async () => {
          await result.current.reorderItems('setlist-1', reorderedItems)
        })
      ).rejects.toThrow('Failed to reorder items')

      expect(result.current.loading).toBe(false)
    })

    it('should handle items without songId by skipping them', async () => {
      const updatedSetlist: Setlist = {
        ...mockSetlists[0],
        songs: [
          { songId: 'song-1', order: 1 },
        ],
      }

      vi.mocked(SetlistService.reorderSongs).mockResolvedValue(updatedSetlist)

      const { result } = renderHook(() => useReorderSetlistItems())

      const reorderedItems: SetlistItem[] = [
        { id: 'item-1', type: 'song', songId: 'song-1', position: 1 },
        { id: 'item-2', type: 'break', position: 2, breakDuration: 15 },
        { id: 'item-3', type: 'section', position: 3, sectionTitle: 'Encore' },
      ]

      await act(async () => {
        await result.current.reorderItems('setlist-1', reorderedItems)
      })

      // Should only include items with songId
      expect(SetlistService.reorderSongs).toHaveBeenCalledWith('setlist-1', {
        songOrder: ['song-1']
      })
    })
  })
})
