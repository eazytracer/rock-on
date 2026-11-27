/**
 * Unit Tests for SupabaseAuthService - Logout/SignOut Functionality
 *
 * Tests that signOut properly clears:
 * - Supabase session
 * - All Supabase localStorage keys (sb-*)
 * - Auth state
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SupabaseAuthService } from '../../../../src/services/auth/SupabaseAuthService'
import { logger } from '../../../../src/utils/logger'

describe('SupabaseAuthService - SignOut', () => {
  let authService: SupabaseAuthService
  let mockSupabaseSignOut: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()

    // Mock the Supabase client
    mockSupabaseSignOut = vi.fn().mockResolvedValue({ error: null })

    authService = new SupabaseAuthService()

    // Replace the supabase client's auth.signOut with our mock
    ;(authService as any).supabase = {
      auth: {
        signOut: mockSupabaseSignOut,
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
      },
    }
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('Clearing Supabase localStorage keys', () => {
    it('should remove all keys starting with "sb-"', async () => {
      // Setup: Add various localStorage keys including Supabase ones
      localStorage.setItem('sb-khzeuxxhigqcmrytsfux-auth-token', 'fake-token')
      localStorage.setItem('sb-project-ref-auth-token', 'another-token')
      localStorage.setItem('regular-key', 'should-remain')
      localStorage.setItem('another-key', 'also-remain')

      expect(localStorage.getItem('sb-khzeuxxhigqcmrytsfux-auth-token')).toBe(
        'fake-token'
      )
      expect(localStorage.getItem('sb-project-ref-auth-token')).toBe(
        'another-token'
      )

      // Act
      await authService.signOut()

      // Assert: Supabase keys removed, regular keys remain
      expect(
        localStorage.getItem('sb-khzeuxxhigqcmrytsfux-auth-token')
      ).toBeNull()
      expect(localStorage.getItem('sb-project-ref-auth-token')).toBeNull()
      expect(localStorage.getItem('regular-key')).toBe('should-remain')
      expect(localStorage.getItem('another-key')).toBe('also-remain')
    })

    it('should handle case with no Supabase keys gracefully', async () => {
      localStorage.setItem('regular-key', 'value')

      await authService.signOut()

      // Should not throw and regular key should remain
      expect(localStorage.getItem('regular-key')).toBe('value')
      expect(mockSupabaseSignOut).toHaveBeenCalled()
    })
  })

  describe('Supabase auth.signOut() integration', () => {
    it('should call supabase.auth.signOut()', async () => {
      await authService.signOut()

      expect(mockSupabaseSignOut).toHaveBeenCalledOnce()
    })

    it('should clear localStorage even if Supabase signOut fails', async () => {
      mockSupabaseSignOut.mockRejectedValue(new Error('Network error'))
      localStorage.setItem('sb-test-key', 'value')

      try {
        await authService.signOut()
      } catch (error) {
        // Expected to throw
      }

      // Even though Supabase signOut failed, localStorage should be cleared
      expect(localStorage.getItem('sb-test-key')).toBeNull()
    })
  })

  describe('Error handling', () => {
    it('should throw error if Supabase signOut fails', async () => {
      const error = new Error('Supabase error')
      mockSupabaseSignOut.mockRejectedValue(error)

      await expect(authService.signOut()).rejects.toThrow('Supabase error')
    })

    it('should log error if signOut fails', async () => {
      const logErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})
      mockSupabaseSignOut.mockRejectedValue(new Error('Test error'))

      await expect(authService.signOut()).rejects.toThrow()

      expect(logErrorSpy).toHaveBeenCalledWith(
        '[SupabaseAuthService]',
        'Supabase sign out error:',
        expect.any(Error)
      )

      logErrorSpy.mockRestore()
    })
  })
})
