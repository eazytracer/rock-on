import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSyncStatus } from '../../../src/hooks/useSyncStatus'

// Post Phase 2 the web client is a naive online Supabase client — there is no
// sync engine. useSyncStatus reports browser online/offline + Supabase
// reachability; the sync fields are inert (always zero/false) and sync() is a
// no-op. Supabase connectivity checks are dynamically imported, so we mock the
// client module.
vi.mock('../../../src/services/supabase/client', () => ({
  getSupabaseClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    },
  })),
}))

describe('useSyncStatus Hook (connectivity only)', () => {
  let originalOnLine: boolean

  beforeEach(() => {
    vi.clearAllMocks()
    originalOnLine = navigator.onLine
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
  })

  describe('Initial State', () => {
    it('returns initial status with isOnline true and inert sync fields', () => {
      const { result } = renderHook(() => useSyncStatus())

      expect(result.current.isOnline).toBe(true)
      expect(result.current.isSyncing).toBe(false)
      expect(result.current.pendingCount).toBe(0)
      expect(result.current.failedCount).toBe(0)
      expect(result.current.lastSyncTime).toBeNull()
      expect(result.current.syncError).toBeNull()
    })

    it('detects offline state on mount', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      })

      const { result } = renderHook(() => useSyncStatus())

      expect(result.current.isOnline).toBe(false)
    })
  })

  describe('Online/Offline Events', () => {
    it('updates isOnline when going offline', async () => {
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

    it('updates isOnline when coming back online', async () => {
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

  describe('Manual Sync (no-op)', () => {
    it('provides a sync function', () => {
      const { result } = renderHook(() => useSyncStatus())

      expect(result.current.sync).toBeDefined()
      expect(typeof result.current.sync).toBe('function')
    })

    it('calls sync without throwing and clears syncError', async () => {
      const { result } = renderHook(() => useSyncStatus())

      await act(async () => {
        await result.current.sync()
      })

      expect(result.current.syncError).toBeNull()
    })
  })

  describe('Error Handling', () => {
    it('initializes with no sync error', () => {
      const { result } = renderHook(() => useSyncStatus())
      expect(result.current.syncError).toBeNull()
      expect('syncError' in result.current).toBe(true)
    })
  })

  describe('Cleanup', () => {
    it('does not throw when unmounting', () => {
      const { unmount } = renderHook(() => useSyncStatus())
      expect(() => unmount()).not.toThrow()
    })

    it('removes online/offline listeners on unmount', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

      const { unmount } = renderHook(() => useSyncStatus())

      const onlineHandler = addEventListenerSpy.mock.calls.find(
        call => call[0] === 'online'
      )?.[1]
      const offlineHandler = addEventListenerSpy.mock.calls.find(
        call => call[0] === 'offline'
      )?.[1]

      unmount()

      if (onlineHandler) {
        expect(removeEventListenerSpy).toHaveBeenCalledWith(
          'online',
          onlineHandler
        )
      }
      if (offlineHandler) {
        expect(removeEventListenerSpy).toHaveBeenCalledWith(
          'offline',
          offlineHandler
        )
      }

      addEventListenerSpy.mockRestore()
      removeEventListenerSpy.mockRestore()
    })
  })
})
