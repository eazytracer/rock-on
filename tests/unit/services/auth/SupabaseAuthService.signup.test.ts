/**
 * Unit Tests for SupabaseAuthService.signUp
 *
 * Covers the email-confirmation flow: when Supabase email confirmations are
 * enabled (production), a successful signUp returns a `user` but NO `session`.
 * That is a SUCCESS that needs email confirmation — not an error.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SupabaseAuthService } from '../../../../src/services/auth/SupabaseAuthService'

describe('SupabaseAuthService - signUp', () => {
  let authService: SupabaseAuthService
  let mockSignUp: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    mockSignUp = vi.fn()

    authService = new SupabaseAuthService()
    ;(authService as any).supabase = {
      auth: {
        signUp: mockSignUp,
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
      },
    }
  })

  it('returns needsEmailConfirmation when user is created but no session (confirmation required)', async () => {
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: 'user-123', email: 'new@example.com' },
        session: null,
      },
      error: null,
    })

    const result = await authService.signUp({
      email: 'new@example.com',
      password: 'password123',
      name: 'New User',
    })

    expect(result.error).toBeUndefined()
    expect(result.session).toBeNull()
    expect(result.needsEmailConfirmation).toBe(true)
    expect(result.user).not.toBeNull()
    expect(result.user?.email).toBe('new@example.com')
  })

  it('returns an error when no user is created (true failure)', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    })

    const result = await authService.signUp({
      email: 'dupe@example.com',
      password: 'password123',
      name: 'Dupe',
    })

    expect(result.user).toBeNull()
    expect(result.session).toBeNull()
    expect(result.needsEmailConfirmation).toBeFalsy()
    expect(result.error).toBeTruthy()
  })

  it('returns the error message from Supabase when signUp errors', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Password too weak' },
    })

    const result = await authService.signUp({
      email: 'x@example.com',
      password: 'weak',
      name: 'X',
    })

    expect(result.error).toBe('Password too weak')
    expect(result.needsEmailConfirmation).toBeFalsy()
  })

  it('passes emailRedirectTo pointing at /auth/callback', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'u', email: 'a@b.com' }, session: null },
      error: null,
    })

    await authService.signUp({
      email: 'a@b.com',
      password: 'password123',
      name: 'A',
    })

    expect(mockSignUp).toHaveBeenCalledTimes(1)
    const arg = mockSignUp.mock.calls[0][0]
    expect(arg.options.emailRedirectTo).toContain('/auth/callback')
  })

  it('threads a safe returnTo into emailRedirectTo as an encoded param', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'u', email: 'a@b.com' }, session: null },
      error: null,
    })

    await authService.signUp(
      { email: 'a@b.com', password: 'password123', name: 'A' },
      '/events?join=ABC123'
    )

    const arg = mockSignUp.mock.calls[0][0]
    expect(arg.options.emailRedirectTo).toContain('/auth/callback?returnTo=')
    expect(arg.options.emailRedirectTo).toContain(
      encodeURIComponent('/events?join=ABC123')
    )
  })

  it('omits an unsafe returnTo from emailRedirectTo (open-redirect guard)', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'u', email: 'a@b.com' }, session: null },
      error: null,
    })

    await authService.signUp(
      { email: 'a@b.com', password: 'password123', name: 'A' },
      'https://evil.example/phish'
    )

    const arg = mockSignUp.mock.calls[0][0]
    expect(arg.options.emailRedirectTo).not.toContain('returnTo')
    expect(arg.options.emailRedirectTo).toContain('/auth/callback')
    expect(arg.options.emailRedirectTo).not.toContain('evil.example')
  })

  it('returns user and session on immediate signup (confirmations disabled)', async () => {
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'ok@example.com' },
        session: {
          access_token: 'token',
          refresh_token: 'refresh',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: {
            id: 'user-1',
            email: 'ok@example.com',
            user_metadata: { name: 'OK' },
            app_metadata: { provider: 'email' },
            created_at: new Date().toISOString(),
          },
        },
      },
      error: null,
    })

    const result = await authService.signUp({
      email: 'ok@example.com',
      password: 'password123',
      name: 'OK',
    })

    expect(result.error).toBeUndefined()
    expect(result.needsEmailConfirmation).toBeFalsy()
    expect(result.session).not.toBeNull()
    expect(result.user?.id).toBe('user-1')
  })
})
