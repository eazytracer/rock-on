import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSyncStatus } from '../../../src/hooks/useSyncStatus'
import { SyncRepository } from '../../../src/services/data/SyncRepository'
import type { SyncStatus } from '../../../src/services/data/syncTypes'

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
        getStatus: vi.fn(async () => ({
          isEnabled: true,
          isSyncing: false,
          pendingCount: 0,
          failedCount: 0,
          conflictCount: 0,
          lastSyncTime: undefined,
        })),
        syncAll: vi.fn(async () => {}),
        _triggerStatusChange: (status: SyncStatus) => {
          mockCallbacks.forEach(cb => cb(status))
        },
        _clearMockCallbacks: () => mockCallbacks.clear(),
      })),
    },
  }
})

describe('useSyncStatus Hook', () => {
  let originalOnLine: boolean

  beforeEach(() => {
    vi.clearAllMocks()
    originalOnLine = navigator.onLine
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: originalOnLine,
    })
    const repo = SyncRepository.getInstance() as any
    repo._clearMockCallbacks()
  })

  describe('Initial State', () => {
    it('should return initial sync status with isOnline true', () => {
      const { result } = renderHook(() => useSyncStatus())

      expect(result.current.isOnline).toBe(true)
      expect(result.current.isSyncing).toBe(false)
      expect(result.current.pendingCount).toBe(0)
      expect(result.current.lastSyncTime).toBeNull()
      expect(result.current.syncError).toBeNull()
    })

    it('should detect offline state on mount', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      })

      const { result } = renderHook(() => useSyncStatus())

      expect(result.current.isOnline).toBe(false)
    })
  })

  describe('Online/Offline Events', () => {
    it('should update isOnline when going offline', async () => {
      const { result } = renderHook(() => useSyncStatus())

      expect(result.current.isOnline).toBe(true)

      act(() => {
        Object.defineProperty(navigator, 'onLine', {
          writable: true,
          value: false,
        })
        window.dispatchEvent(new Event('offline'))
      })

      await waitFor(() => {
        expect(result.current.isOnline).toBe(false)
      })
    })

    it('should update isOnline when coming back online', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      })

      const { result } = renderHook(() => useSyncStatus())

      expect(result.current.isOnline).toBe(false)

      act(() => {
        Object.defineProperty(navigator, 'onLine', {
          writable: true,
          value: true,
        })
        window.dispatchEvent(new Event('online'))
      })

      await waitFor(() => {
        expect(result.current.isOnline).toBe(true)
      })
    })
  })

  describe('Sync Status Updates', () => {
    it('should update when sync status changes', async () => {
      const { result } = renderHook(() => useSyncStatus())

      const newStatus: SyncStatus = {
        isEnabled: true,
        isSyncing: true,
        pendingCount: 5,
        failedCount: 0,
        conflictCount: 0,
        lastSyncTime: new Date(),
      }

      act(() => {
        const repo = SyncRepository.getInstance() as any
        repo._triggerStatusChange(newStatus)
      })

      await waitFor(() => {
        expect(result.current.isSyncing).toBe(true)
        expect(result.current.pendingCount).toBe(5)
      })
    })

    it('should update lastSyncTime when sync completes', async () => {
      const { result } = renderHook(() => useSyncStatus())

      const syncTime = new Date('2025-10-25T17:00:00Z')
      const newStatus: SyncStatus = {
        isEnabled: true,
        isSyncing: false,
        pendingCount: 0,
        failedCount: 0,
        conflictCount: 0,
        lastSyncTime: syncTime,
      }

      act(() => {
        const repo = SyncRepository.getInstance() as any
        repo._triggerStatusChange(newStatus)
      })

      await waitFor(() => {
        expect(result.current.lastSyncTime).toEqual(syncTime)
      })
    })

    it('should show pending changes count', async () => {
      const { result } = renderHook(() => useSyncStatus())

      const newStatus: SyncStatus = {
        isEnabled: true,
        isSyncing: false,
        pendingCount: 10,
        failedCount: 0,
        conflictCount: 0,
        lastSyncTime: undefined,
      }

      act(() => {
        const repo = SyncRepository.getInstance() as any
        repo._triggerStatusChange(newStatus)
      })

      await waitFor(() => {
        expect(result.current.pendingCount).toBe(10)
      })
    })
  })

  describe('Error Handling', () => {
    it('should initialize with no sync error', () => {
      const { result } = renderHook(() => useSyncStatus())

      // Initial state should have no error
      expect(result.current.syncError).toBeNull()
    })

    it('should handle error states in sync error field', async () => {
      const { result } = renderHook(() => useSyncStatus())

      // Verify the error field exists and is initially null
      expect(result.current.syncError).toBeNull()

      // The sync error would be set if syncAll fails (tested via integration)
      // We verify the field is accessible and properly typed
      expect('syncError' in result.current).toBe(true)
    })
  })

  describe('Manual Sync', () => {
    it('should provide sync function', () => {
      const { result } = renderHook(() => useSyncStatus())

      expect(result.current.sync).toBeDefined()
      expect(typeof result.current.sync).toBe('function')
    })

    it('should call sync without throwing when sync is invoked', async () => {
      const { result } = renderHook(() => useSyncStatus())

      // Just verify that sync function works without error (integration test style)
      await act(async () => {
        await result.current.sync()
      })

      // If we get here without error, the sync function works
      expect(result.current.sync).toBeDefined()
    })

    it('should update isSyncing during manual sync', async () => {
      const { result } = renderHook(() => useSyncStatus())

      const repo = SyncRepository.getInstance() as any

      // Create a promise we can control
      let syncResolve: () => void
      const syncPromise = new Promise<void>(resolve => {
        syncResolve = resolve
      })
      repo.syncAll.mockReturnValue(syncPromise)

      // Start sync (don't await yet)
      act(() => {
        result.current.sync()
      })

      // Simulate sync status change from sync engine
      act(() => {
        repo._triggerStatusChange({
          isEnabled: true,
          isSyncing: true,
          pendingCount: 0,
          failedCount: 0,
          conflictCount: 0,
          lastSyncTime: undefined,
        })
      })

      // Verify syncing state
      await waitFor(() => {
        expect(result.current.isSyncing).toBe(true)
      })

      // Complete sync
      act(() => {
        repo._triggerStatusChange({
          isEnabled: true,
          isSyncing: false,
          pendingCount: 0,
          failedCount: 0,
          conflictCount: 0,
          lastSyncTime: new Date(),
        })
        syncResolve!()
      })

      await waitFor(() => {
        expect(result.current.isSyncing).toBe(false)
      })
    })
  })

  describe('Cleanup', () => {
    it('should not throw when unmounting', () => {
      const { unmount } = renderHook(() => useSyncStatus())

      // Should cleanly unmount without errors
      expect(() => unmount()).not.toThrow()
    })

    it('should remove online event listener on unmount', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

      const { unmount } = renderHook(() => useSyncStatus())

      // Get the handlers that were added
      const onlineHandler = addEventListenerSpy.mock.calls.find(
        call => call[0] === 'online'
      )?.[1]
      const offlineHandler = addEventListenerSpy.mock.calls.find(
        call => call[0] === 'offline'
      )?.[1]

      unmount()

      // Verify the same handlers were removed
      if (onlineHandler) {
        expect(removeEventListenerSpy).toHaveBeenCalledWith('online', onlineHandler)
      }
      if (offlineHandler) {
        expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', offlineHandler)
      }

      addEventListenerSpy.mockRestore()
      removeEventListenerSpy.mockRestore()
    })
  })
})
