/**
 * SupabaseAuthService: OAuth returnTo, password reset, resend, update.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SupabaseAuthService } from '../../../../src/services/auth/SupabaseAuthService'

describe('SupabaseAuthService - OAuth and password flows', () => {
  let service: SupabaseAuthService
  let auth: Record<string, ReturnType<typeof vi.fn>>
  const origin = window.location.origin

  beforeEach(() => {
    auth = {
      signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
      resend: vi.fn().mockResolvedValue({ error: null }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    }
    service = new SupabaseAuthService()
    ;(service as any).supabase = { auth }
  })

  it('signInWithOAuth takes the provider and carries returnTo on the callback', async () => {
    await service.signInWithOAuth('google', '/j/ABC123')
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: `${origin}/auth/callback?returnTo=%2Fj%2FABC123`,
      },
    })
  })

  it('signInWithOAuth drops an unsafe returnTo', async () => {
    await service.signInWithOAuth('apple', 'https://evil.example')
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'apple',
      options: { redirectTo: `${origin}/auth/callback` },
    })
  })

  it('signInWithOAuth returns the provider error', async () => {
    auth.signInWithOAuth.mockResolvedValue({ error: { message: 'nope' } })
    expect(await service.signInWithOAuth('google')).toEqual({ error: 'nope' })
  })

  it('requestPasswordReset sends a link to /auth/reset', async () => {
    expect(await service.requestPasswordReset('a@b.co')).toEqual({})
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('a@b.co', {
      redirectTo: `${origin}/auth/reset`,
    })
  })

  it('requestPasswordReset surfaces errors', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({
      error: { message: 'rate limited' },
    })
    expect(await service.requestPasswordReset('a@b.co')).toEqual({
      error: 'rate limited',
    })
  })

  it('resendSignupEmail resends the signup email with returnTo', async () => {
    await service.resendSignupEmail('a@b.co', '/j/X')
    expect(auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'a@b.co',
      options: { emailRedirectTo: `${origin}/auth/callback?returnTo=%2Fj%2FX` },
    })
  })

  it('updatePassword calls updateUser', async () => {
    expect(await service.updatePassword('newpassword1')).toEqual({})
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'newpassword1' })
  })

  it('updatePassword surfaces errors', async () => {
    auth.updateUser.mockResolvedValue({
      error: { message: 'Password should be at least 8 characters.' },
    })
    expect(await service.updatePassword('short')).toEqual({
      error: 'Password should be at least 8 characters.',
    })
  })
})
