import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  type SpyInstance,
} from 'vitest'
import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useAuthCheck } from '../../../src/hooks/useAuthCheck'
import * as AuthFactory from '../../../src/services/auth/AuthFactory'
import type { AuthSession } from '../../../src/services/auth/types'

// Mock AuthFactory
vi.mock('../../../src/services/auth/AuthFactory', () => ({
  authService: {
    getSession: vi.fn(),
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

describe('useAuthCheck Hook (Phase 1)', () => {
  let getItemSpy: SpyInstance
  let removeItemSpy: SpyInstance
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

    // Default mock: no session
    vi.mocked(AuthFactory.authService.getSession).mockResolvedValue(null)
  })

  afterEach(() => {
    getItemSpy.mockRestore()
    removeItemSpy.mockRestore()
  })

  describe('No User Scenario', () => {
    it('should return no-user when localStorage has no currentUserId', async () => {
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

  describe('No Band Scenario (personal / guest accounts)', () => {
    it('should authenticate a user with a valid session but no band (hasBand=false)', async () => {
      mockStorage = {
        currentUserId: 'user-123',
        // No currentBandId
      }

      const mockSession: AuthSession = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          authProvider: 'email',
          createdDate: new Date(),
          lastLogin: new Date(),
        },
        accessToken: 'mock-token',
        expiresAt: Date.now() + 3600000, // 1 hour from now
      }
      vi.mocked(AuthFactory.authService.getSession).mockResolvedValue(
        mockSession
      )

      const { result } = renderHook(() => useAuthCheck(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false)
      })

      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.hasBand).toBe(false)
      expect(result.current.failureReason).toBeNull()
    })
  })

  describe('Signed Out Scenario', () => {
    it('should return signed-out when authService.getSession returns null', async () => {
      mockStorage = {
        currentUserId: 'user-123',
        currentBandId: 'band-456',
      }
      vi.mocked(AuthFactory.authService.getSession).mockResolvedValue(null)

      const { result } = renderHook(() => useAuthCheck(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false)
      })

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.failureReason).toBe('signed-out')
    })

    it('should clear localStorage when session is null', async () => {
      mockStorage = {
        currentUserId: 'user-123',
        currentBandId: 'band-456',
      }
      vi.mocked(AuthFactory.authService.getSession).mockResolvedValue(null)

      const { result } = renderHook(() => useAuthCheck(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false)
      })

      expect(removeItemSpy).toHaveBeenCalledWith('currentUserId')
      expect(removeItemSpy).toHaveBeenCalledWith('currentBandId')
    })
  })

  describe('Valid Session Scenario', () => {
    it('should authenticate when session is valid', async () => {
      mockStorage = {
        currentUserId: 'user-123',
        currentBandId: 'band-456',
      }

      const mockSession: AuthSession = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          authProvider: 'email',
          createdDate: new Date(),
          lastLogin: new Date(),
        },
        accessToken: 'mock-token',
        expiresAt: Date.now() + 3600000, // 1 hour from now
      }
      vi.mocked(AuthFactory.authService.getSession).mockResolvedValue(
        mockSession
      )

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

      const mockSession: AuthSession = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          authProvider: 'email',
          createdDate: new Date(),
          lastLogin: new Date(),
        },
        accessToken: 'mock-token',
        expiresAt: Date.now() + 3600000,
      }
      vi.mocked(AuthFactory.authService.getSession).mockResolvedValue(
        mockSession
      )

      const { result } = renderHook(() => useAuthCheck(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false)
      })

      expect(removeItemSpy).not.toHaveBeenCalled()
    })
  })

  describe('Session Error Scenario', () => {
    it('should return session-error when getSession throws', async () => {
      mockStorage = {
        currentUserId: 'user-123',
        currentBandId: 'band-456',
      }
      vi.mocked(AuthFactory.authService.getSession).mockRejectedValue(
        new Error('Network error')
      )

      const { result } = renderHook(() => useAuthCheck(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false)
      })

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.failureReason).toBe('session-error')
    })
  })

  describe('Return Type Structure', () => {
    it('should return correct structure with all required fields', async () => {
      mockStorage = {
        currentUserId: 'user-123',
        currentBandId: 'band-456',
      }

      const mockSession: AuthSession = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          authProvider: 'email',
          createdDate: new Date(),
          lastLogin: new Date(),
        },
        accessToken: 'mock-token',
        expiresAt: Date.now() + 3600000,
      }
      vi.mocked(AuthFactory.authService.getSession).mockResolvedValue(
        mockSession
      )

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
        'signed-out',
        'session-error',
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
})
