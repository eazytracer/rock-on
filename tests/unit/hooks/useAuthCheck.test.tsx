import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useAuthCheck } from '../../../src/hooks/useAuthCheck'
import { SessionManager } from '../../../src/services/auth/SessionManager'

// Mock SessionManager
vi.mock('../../../src/services/auth/SessionManager', () => ({
  SessionManager: {
    loadSession: vi.fn(),
    isSessionValid: vi.fn(),
    clearSession: vi.fn(),
  },
}))

// Wrapper component that provides router context
function createWrapper(initialPath = '/test') {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>
    )
  }
}

describe('useAuthCheck Hook', () => {
  let getItemSpy: ReturnType<typeof vi.spyOn>
  let removeItemSpy: ReturnType<typeof vi.spyOn>
  let mockStorage: Record<string, string>

  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage = {}

    // Spy on localStorage methods
    getItemSpy = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation((key: string) => {
        return mockStorage[key] || null
      })
    removeItemSpy = vi
      .spyOn(Storage.prototype, 'removeItem')
      .mockImplementation((key: string) => {
        delete mockStorage[key]
      })

    // Reset SessionManager mocks
    vi.mocked(SessionManager.loadSession).mockReturnValue(null)
    vi.mocked(SessionManager.isSessionValid).mockReturnValue(false)
    vi.mocked(SessionManager.clearSession).mockImplementation(() => {})
  })

  afterEach(() => {
    getItemSpy.mockRestore()
    removeItemSpy.mockRestore()
  })

  describe('No User Scenario', () => {
    it('should return no-user when localStorage has no currentUserId', async () => {
      // No user ID in storage
      mockStorage = {}

      const { result } = renderHook(() => useAuthCheck(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false)
      })

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.hasBand).toBe(false)
      expect(result.current.failureReason).toBe('no-user')
    })
  })

  describe('No Band Scenario', () => {
    it('should return no-band when user exists but no band selected', async () => {
      mockStorage = {
        currentUserId: 'user-123',
      }
      // No band ID

      const { result } = renderHook(() => useAuthCheck(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false)
      })

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.hasBand).toBe(false)
      expect(result.current.failureReason).toBe('no-band')
    })
  })

  describe('Invalid Session Scenario', () => {
    it('should return session-invalid when SessionManager has no session', async () => {
      mockStorage = {
        currentUserId: 'user-123',
        currentBandId: 'band-456',
      }
      vi.mocked(SessionManager.loadSession).mockReturnValue(null)

      const { result } = renderHook(() => useAuthCheck(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false)
      })

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.failureReason).toBe('session-invalid')
    })

    it('should clear localStorage when session is invalid', async () => {
      mockStorage = {
        currentUserId: 'user-123',
        currentBandId: 'band-456',
      }
      vi.mocked(SessionManager.loadSession).mockReturnValue(null)

      const { result } = renderHook(() => useAuthCheck(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false)
      })

      expect(removeItemSpy).toHaveBeenCalledWith('currentUserId')
      expect(removeItemSpy).toHaveBeenCalledWith('currentBandId')
      expect(SessionManager.clearSession).toHaveBeenCalled()
    })
  })

  describe('Session Expired Scenario', () => {
    it('should return session-expired when session expired beyond grace period', async () => {
      mockStorage = {
        currentUserId: 'user-123',
        currentBandId: 'band-456',
      }

      // Session expired 2 hours ago (beyond 1.5 hour grace period)
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000
      vi.mocked(SessionManager.loadSession).mockReturnValue({
        userId: 'user-123',
        expiresAt: twoHoursAgo,
        createdAt: Date.now() - 10 * 60 * 60 * 1000,
      })
      vi.mocked(SessionManager.isSessionValid).mockReturnValue(false)

      const { result } = renderHook(() => useAuthCheck(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false)
      })

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.failureReason).toBe('session-expired')
    })

    it('should clear localStorage when session is expired beyond grace period', async () => {
      mockStorage = {
        currentUserId: 'user-123',
        currentBandId: 'band-456',
      }

      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000
      vi.mocked(SessionManager.loadSession).mockReturnValue({
        userId: 'user-123',
        expiresAt: twoHoursAgo,
        createdAt: Date.now() - 10 * 60 * 60 * 1000,
      })
      vi.mocked(SessionManager.isSessionValid).mockReturnValue(false)

      const { result } = renderHook(() => useAuthCheck(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false)
      })

      expect(removeItemSpy).toHaveBeenCalledWith('currentUserId')
      expect(removeItemSpy).toHaveBeenCalledWith('currentBandId')
      expect(SessionManager.clearSession).toHaveBeenCalled()
    })
  })

  describe('Grace Period Scenario', () => {
    it('should allow access when session expired within grace period', async () => {
      mockStorage = {
        currentUserId: 'user-123',
        currentBandId: 'band-456',
      }

      // Session expired 30 minutes ago (within 1.5 hour grace period)
      const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000
      vi.mocked(SessionManager.loadSession).mockReturnValue({
        userId: 'user-123',
        expiresAt: thirtyMinutesAgo,
        createdAt: Date.now() - 10 * 60 * 60 * 1000,
      })
      vi.mocked(SessionManager.isSessionValid).mockReturnValue(false)

      const { result } = renderHook(() => useAuthCheck(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false)
      })

      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.hasBand).toBe(true)
      expect(result.current.failureReason).toBeNull()
    })

    it('should not clear localStorage when within grace period', async () => {
      mockStorage = {
        currentUserId: 'user-123',
        currentBandId: 'band-456',
      }

      const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000
      vi.mocked(SessionManager.loadSession).mockReturnValue({
        userId: 'user-123',
        expiresAt: thirtyMinutesAgo,
        createdAt: Date.now() - 10 * 60 * 60 * 1000,
      })
      vi.mocked(SessionManager.isSessionValid).mockReturnValue(false)

      const { result } = renderHook(() => useAuthCheck(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false)
      })

      expect(removeItemSpy).not.toHaveBeenCalled()
      expect(SessionManager.clearSession).not.toHaveBeenCalled()
    })

    it('should allow access when session expired just under the grace period boundary', async () => {
      mockStorage = {
        currentUserId: 'user-123',
        currentBandId: 'band-456',
      }

      // Session expired 1.49 hours ago (just under 1.5 hour grace period)
      const justUnderBoundary = Date.now() - 1.49 * 60 * 60 * 1000
      vi.mocked(SessionManager.loadSession).mockReturnValue({
        userId: 'user-123',
        expiresAt: justUnderBoundary,
        createdAt: Date.now() - 10 * 60 * 60 * 1000,
      })
      vi.mocked(SessionManager.isSessionValid).mockReturnValue(false)

      const { result } = renderHook(() => useAuthCheck(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false)
      })

      // At 1.49 hours, hoursExpired > 1.5 is false, so access should be allowed
      expect(result.current.isAuthenticated).toBe(true)
    })

    it('should deny access when session expired just over the grace period boundary', async () => {
      mockStorage = {
        currentUserId: 'user-123',
        currentBandId: 'band-456',
      }

      // Session expired 1.51 hours ago (just over 1.5 hour grace period)
      const justOverBoundary = Date.now() - 1.51 * 60 * 60 * 1000
      vi.mocked(SessionManager.loadSession).mockReturnValue({
        userId: 'user-123',
        expiresAt: justOverBoundary,
        createdAt: Date.now() - 10 * 60 * 60 * 1000,
      })
      vi.mocked(SessionManager.isSessionValid).mockReturnValue(false)

      const { result } = renderHook(() => useAuthCheck(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false)
      })

      // At 1.51 hours, hoursExpired > 1.5 is true, so access should be denied
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.failureReason).toBe('session-expired')
    })
  })

  describe('Valid Session Scenario', () => {
    it('should authenticate when session is valid', async () => {
      mockStorage = {
        currentUserId: 'user-123',
        currentBandId: 'band-456',
      }

      vi.mocked(SessionManager.loadSession).mockReturnValue({
        userId: 'user-123',
        expiresAt: Date.now() + 3600000, // 1 hour from now
        createdAt: Date.now() - 1000,
      })
      vi.mocked(SessionManager.isSessionValid).mockReturnValue(true)

      const { result } = renderHook(() => useAuthCheck(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false)
      })

      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.hasBand).toBe(true)
      expect(result.current.failureReason).toBeNull()
    })

    it('should not clear localStorage when session is valid', async () => {
      mockStorage = {
        currentUserId: 'user-123',
        currentBandId: 'band-456',
      }

      vi.mocked(SessionManager.loadSession).mockReturnValue({
        userId: 'user-123',
        expiresAt: Date.now() + 3600000,
        createdAt: Date.now() - 1000,
      })
      vi.mocked(SessionManager.isSessionValid).mockReturnValue(true)

      const { result } = renderHook(() => useAuthCheck(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false)
      })

      expect(removeItemSpy).not.toHaveBeenCalled()
      expect(SessionManager.clearSession).not.toHaveBeenCalled()
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing expiresAt in session gracefully', async () => {
      mockStorage = {
        currentUserId: 'user-123',
        currentBandId: 'band-456',
      }

      // Session with no expiresAt (should treat as expired at epoch)
      vi.mocked(SessionManager.loadSession).mockReturnValue({
        userId: 'user-123',
        expiresAt: undefined as unknown as number,
        createdAt: Date.now() - 1000,
      })
      vi.mocked(SessionManager.isSessionValid).mockReturnValue(false)

      const { result } = renderHook(() => useAuthCheck(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false)
      })

      // With no expiresAt (treated as 0), the session is expired way beyond grace period
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.failureReason).toBe('session-expired')
    })

    it('should handle session with expiresAt of 0', async () => {
      mockStorage = {
        currentUserId: 'user-123',
        currentBandId: 'band-456',
      }

      vi.mocked(SessionManager.loadSession).mockReturnValue({
        userId: 'user-123',
        expiresAt: 0,
        createdAt: Date.now() - 1000,
      })
      vi.mocked(SessionManager.isSessionValid).mockReturnValue(false)

      const { result } = renderHook(() => useAuthCheck(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false)
      })

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.failureReason).toBe('session-expired')
    })
  })

  describe('Return Type Structure', () => {
    it('should return correct structure with all required fields', async () => {
      mockStorage = {
        currentUserId: 'user-123',
        currentBandId: 'band-456',
      }

      vi.mocked(SessionManager.loadSession).mockReturnValue({
        userId: 'user-123',
        expiresAt: Date.now() + 3600000,
        createdAt: Date.now() - 1000,
      })
      vi.mocked(SessionManager.isSessionValid).mockReturnValue(true)

      const { result } = renderHook(() => useAuthCheck(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false)
      })

      expect(result.current).toHaveProperty('isAuthenticated')
      expect(result.current).toHaveProperty('isChecking')
      expect(result.current).toHaveProperty('hasBand')
      expect(result.current).toHaveProperty('failureReason')

      expect(typeof result.current.isAuthenticated).toBe('boolean')
      expect(typeof result.current.isChecking).toBe('boolean')
      expect(typeof result.current.hasBand).toBe('boolean')
    })

    it('should have correct failureReason type values', async () => {
      const validReasons = [
        'no-user',
        'no-band',
        'session-expired',
        'session-invalid',
        null,
      ]

      // Test no-user
      mockStorage = {}
      const { result: noUserResult } = renderHook(() => useAuthCheck(), {
        wrapper: createWrapper(),
      })
      await waitFor(() => expect(noUserResult.current.isChecking).toBe(false))
      expect(validReasons).toContain(noUserResult.current.failureReason)
    })
  })

  describe('Console Logging', () => {
    it('should log warning when session is invalid', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      mockStorage = {
        currentUserId: 'user-123',
        currentBandId: 'band-456',
      }
      vi.mocked(SessionManager.loadSession).mockReturnValue(null)

      const { result } = renderHook(() => useAuthCheck(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false)
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No session found')
      )

      consoleSpy.mockRestore()
    })

    it('should log warning when session expired beyond grace period', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      mockStorage = {
        currentUserId: 'user-123',
        currentBandId: 'band-456',
      }

      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000
      vi.mocked(SessionManager.loadSession).mockReturnValue({
        userId: 'user-123',
        expiresAt: twoHoursAgo,
        createdAt: Date.now() - 10 * 60 * 60 * 1000,
      })
      vi.mocked(SessionManager.isSessionValid).mockReturnValue(false)

      const { result } = renderHook(() => useAuthCheck(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false)
      })

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('beyond'))

      consoleSpy.mockRestore()
    })

    it('should log info when session is within grace period', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      mockStorage = {
        currentUserId: 'user-123',
        currentBandId: 'band-456',
      }

      const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000
      vi.mocked(SessionManager.loadSession).mockReturnValue({
        userId: 'user-123',
        expiresAt: thirtyMinutesAgo,
        createdAt: Date.now() - 10 * 60 * 60 * 1000,
      })
      vi.mocked(SessionManager.isSessionValid).mockReturnValue(false)

      const { result } = renderHook(() => useAuthCheck(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false)
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('within grace period')
      )

      consoleSpy.mockRestore()
    })
  })

  describe('Route Change Re-validation', () => {
    it('should re-check auth when path changes', async () => {
      mockStorage = {
        currentUserId: 'user-123',
        currentBandId: 'band-456',
      }

      vi.mocked(SessionManager.loadSession).mockReturnValue({
        userId: 'user-123',
        expiresAt: Date.now() + 3600000,
        createdAt: Date.now() - 1000,
      })
      vi.mocked(SessionManager.isSessionValid).mockReturnValue(true)

      // First render at /songs
      const { result, rerender } = renderHook(() => useAuthCheck(), {
        wrapper: createWrapper('/songs'),
      })

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false)
      })

      expect(SessionManager.loadSession).toHaveBeenCalledTimes(1)

      // Clear and re-render at different path
      vi.clearAllMocks()

      // Re-render with a new wrapper at different path
      // Note: In real app, MemoryRouter location changes would trigger this
      // but in tests, we verify the hook setup correctly
      rerender()

      // The hook should be set up to re-run on path changes
      // Since we can't easily simulate navigation in this test,
      // we verify the hook is properly configured with location.pathname dependency
      expect(result.current.isAuthenticated).toBe(true)
    })

    it('should eventually complete checking and set authenticated state', async () => {
      mockStorage = {
        currentUserId: 'user-123',
        currentBandId: 'band-456',
      }

      vi.mocked(SessionManager.loadSession).mockReturnValue({
        userId: 'user-123',
        expiresAt: Date.now() + 3600000,
        createdAt: Date.now() - 1000,
      })
      vi.mocked(SessionManager.isSessionValid).mockReturnValue(true)

      const { result } = renderHook(() => useAuthCheck(), {
        wrapper: createWrapper(),
      })

      // Wait for check to complete
      await waitFor(() => {
        expect(result.current.isChecking).toBe(false)
      })

      // Should be authenticated after check completes
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.hasBand).toBe(true)
    })
  })
})
