/**
 * AuthContext.signOut — escape-hatch guarantee.
 *
 * Regression lock for the production "stuck, must purge cache" bug: a hung
 * `supabase.auth.signOut()` used to trap the user because the local session
 * clear was gated behind the awaited network call. signOut must now clear local
 * session state FIRST and unconditionally, so the user can always recover even
 * when the network sign-out never resolves.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
import React from 'react'
import { AuthProvider, useAuth } from '../../../src/contexts/AuthContext'
import type { IAuthService } from '../../../src/services/auth/types'

type AuthContextType = ReturnType<typeof useAuth>

// A never-resolving promise — models a hung network sign-out.
const hang = () => new Promise<void>(() => {})

function makeAuthService(overrides: Partial<IAuthService> = {}): IAuthService {
  return {
    signUp: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(() => hang()),
    getSession: vi.fn().mockResolvedValue(null),
    refreshSession: vi.fn().mockResolvedValue(null),
    onAuthStateChange: vi.fn(() => () => {}),
    ...overrides,
  } as IAuthService
}

let ctx: AuthContextType | null = null
function Grab() {
  ctx = useAuth()
  return null
}

beforeEach(() => {
  ctx = null
  localStorage.clear()
})
afterEach(() => {
  localStorage.clear()
})

describe('AuthContext.signOut escape hatch', () => {
  it('clears local session even when the network sign-out hangs forever', async () => {
    const authService = makeAuthService() // signOut hangs
    render(
      <AuthProvider authService={authService}>
        <Grab />
      </AuthProvider>
    )
    await waitFor(() => expect(ctx).not.toBeNull())

    // Simulate a signed-in session in localStorage.
    localStorage.setItem('currentUserId', 'u1')
    localStorage.setItem('currentBandId', 'b1')
    const logoutFired = vi.fn()
    window.addEventListener('auth-logout', logoutFired)

    // Do NOT await — the network call never resolves. Local clear must still
    // happen (it runs before the awaited network race).
    act(() => {
      void ctx!.signOut()
    })

    await waitFor(() => {
      expect(localStorage.getItem('currentUserId')).toBeNull()
      expect(localStorage.getItem('currentBandId')).toBeNull()
    })
    expect(logoutFired).toHaveBeenCalled()
    expect(authService.signOut).toHaveBeenCalled()

    window.removeEventListener('auth-logout', logoutFired)
  })

  it('clears local session when the network sign-out rejects', async () => {
    const authService = makeAuthService({
      signOut: vi.fn().mockRejectedValue(new Error('network down')),
    })
    render(
      <AuthProvider authService={authService}>
        <Grab />
      </AuthProvider>
    )
    await waitFor(() => expect(ctx).not.toBeNull())

    localStorage.setItem('currentUserId', 'u1')
    const logoutFired = vi.fn()
    window.addEventListener('auth-logout', logoutFired)

    await act(async () => {
      await ctx!.signOut()
    })

    expect(localStorage.getItem('currentUserId')).toBeNull()
    expect(logoutFired).toHaveBeenCalled()
    window.removeEventListener('auth-logout', logoutFired)
  })
})
