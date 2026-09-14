import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { authService } from '../services/auth/AuthFactory'
import { createLogger } from '../utils/logger'

const log = createLogger('useAuthCheck')

/**
 * Result type for useAuthCheck hook
 */
export interface AuthCheckResult {
  /** Whether the user is authenticated. null while still checking. */
  isAuthenticated: boolean | null
  /** Whether the auth check is still in progress */
  isChecking: boolean
  /** Whether the user has a band selected (needed for protected routes) */
  hasBand: boolean
  /** Reason for auth failure, if any */
  failureReason: 'no-user' | 'no-band' | 'signed-out' | 'session-error' | null
}

/**
 * useAuthCheck - Unified authentication validation hook
 *
 * This hook provides reliable authentication checking for protected routes.
 * It re-validates on EVERY route change to ensure expired sessions are caught
 * even when navigating between protected pages.
 *
 * Phase 1 simplified behavior:
 * - Authority = Supabase SDK session (via authService.getSession())
 * - Authenticated ⇔ session present AND currentUserId resolvable
 * - No manual expiry math, no SessionManager mirror, no grace period
 * - Offline tolerance: only sign out on SIGNED_OUT event, never on network error
 *
 * @example
 * ```tsx
 * function ProtectedRoute({ children }) {
 *   const { isAuthenticated, isChecking, failureReason } = useAuthCheck()
 *
 *   if (isChecking) return <LoadingSpinner />
 *   if (!isAuthenticated) return <Navigate to="/auth" />
 *
 *   return children
 * }
 * ```
 */
export function useAuthCheck(): AuthCheckResult {
  const location = useLocation()
  // Track if this is the initial mount
  const [isInitialCheck, setIsInitialCheck] = useState(true)
  // Counter to force re-check when storage changes (e.g. after signOut)
  const [storageVersion, setStorageVersion] = useState(0)
  const [result, setResult] = useState<AuthCheckResult>({
    isAuthenticated: null,
    isChecking: true,
    hasBand: false,
    failureReason: null,
  })

  // Listen for cross-tab localStorage changes
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'currentUserId' || e.key === 'currentBandId') {
        log.debug('Cross-tab storage change detected', { key: e.key })
        setStorageVersion(v => v + 1)
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  useEffect(() => {
    // Only show loading spinner on initial mount, not on subsequent route changes
    // This prevents white screen flicker during navigation
    if (!isInitialCheck) {
      // For subsequent checks, keep current auth state while re-validating
      // Don't reset isChecking to true - the check is fast (synchronous localStorage)
    }

    const checkAuth = async () => {
      try {
        // 1. Quick localStorage check for currentUserId (synchronous, fast path)
        const userId = localStorage.getItem('currentUserId')
        const bandId = localStorage.getItem('currentBandId')

        // No user ID means not logged in
        if (!userId) {
          setResult({
            isAuthenticated: false,
            isChecking: false,
            hasBand: false,
            failureReason: 'no-user',
          })
          return
        }

        // NOTE: a band is NO LONGER required to be authenticated. "Has a band" is a
        // capability (see `hasBand` below), not an auth gate — this is what lets
        // personal/guest users use the app without a band. A logged-in user with a
        // valid session is authenticated whether or not `currentBandId` is set.
        const hasBand = !!bandId

        // 2. Validate session via Supabase SDK (the single source of truth)
        const session = await authService.getSession()

        // No session - localStorage keys are stale OR offline with expired access token
        // (per Task 0: getSession() returns null offline when refresh fails, even though
        // the session is still in storage). In the offline case, we should NOT sign out
        // immediately - the refresh token may still be valid and will succeed when online.
        if (!session) {
          log.warn(
            'No session from authService.getSession() - treating as signed out'
          )
          // Clear stale localStorage
          localStorage.removeItem('currentUserId')
          localStorage.removeItem('currentBandId')
          setResult({
            isAuthenticated: false,
            isChecking: false,
            hasBand: false,
            failureReason: 'signed-out',
          })
          return
        }

        // 3. Session is valid
        log.debug('Session valid', {
          userId: session.user.id,
          expiresAt: new Date(session.expiresAt),
        })
        setResult({
          isAuthenticated: true,
          isChecking: false,
          hasBand,
          failureReason: null,
        })
      } catch (error) {
        // Network or other error during session check
        log.error('Auth check error', error)
        // Don't clear localStorage here - this could be a transient network error
        // The auth state listener will handle actual sign-out events
        setResult({
          isAuthenticated: false,
          isChecking: false,
          hasBand: false,
          failureReason: 'session-error',
        })
      }
    }

    checkAuth().finally(() => {
      // Mark initial check as complete after first auth check finishes
      // This ensures subsequent route changes don't show loading spinner
      if (isInitialCheck) {
        setIsInitialCheck(false)
      }
    })
    // Re-run auth check on every route change or signOut event
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, storageVersion])

  return result
}
