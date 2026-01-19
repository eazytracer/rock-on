import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { SessionManager } from '../services/auth/SessionManager'

/**
 * Grace period in hours for expired sessions.
 * During this period, users can still access protected routes
 * to allow for brief offline periods or token refresh delays.
 */
const GRACE_PERIOD_HOURS = 1.5

/**
 * Clears authentication-related localStorage keys
 * Called when session is determined to be invalid
 */
function clearAuthLocalStorage(): void {
  localStorage.removeItem('currentUserId')
  localStorage.removeItem('currentBandId')
  // Also clear session data
  SessionManager.clearSession()
}

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
  failureReason:
    | 'no-user'
    | 'no-band'
    | 'session-expired'
    | 'session-invalid'
    | null
}

/**
 * useAuthCheck - Unified authentication validation hook
 *
 * This hook provides reliable authentication checking for protected routes.
 * It re-validates on EVERY route change to ensure expired sessions are caught
 * even when navigating between protected pages.
 *
 * Key features:
 * 1. Re-runs auth check on every route navigation (via location.pathname)
 * 2. Checking localStorage keys synchronously first (fast path)
 * 3. Validating the actual session from SessionManager
 * 4. Applying a grace period for briefly expired sessions
 * 5. Cleaning up invalid localStorage keys
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
  const [result, setResult] = useState<AuthCheckResult>({
    isAuthenticated: null,
    isChecking: true,
    hasBand: false,
    failureReason: null,
  })

  useEffect(() => {
    // Only show loading spinner on initial mount, not on subsequent route changes
    // This prevents white screen flicker during navigation
    if (!isInitialCheck) {
      // For subsequent checks, keep current auth state while re-validating
      // Don't reset isChecking to true - the check is fast (synchronous localStorage)
    }

    const checkAuth = async () => {
      // 1. Quick localStorage check (synchronous, fast path)
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

      // User exists but no band selected
      if (!bandId) {
        setResult({
          isAuthenticated: false,
          isChecking: false,
          hasBand: false,
          failureReason: 'no-band',
        })
        return
      }

      // 2. Load and validate session from SessionManager
      const session = SessionManager.loadSession()

      // No session in storage - localStorage keys are stale
      if (!session) {
        console.warn(
          '[useAuthCheck] No session found - clearing stale localStorage keys'
        )
        clearAuthLocalStorage()
        setResult({
          isAuthenticated: false,
          isChecking: false,
          hasBand: false,
          failureReason: 'session-invalid',
        })
        return
      }

      // 3. Check session validity with grace period
      if (!SessionManager.isSessionValid(session)) {
        // Session is expired - check if within grace period
        const expiresAt = session.expiresAt || 0
        const msExpired = Date.now() - expiresAt
        const hoursExpired = msExpired / (1000 * 60 * 60)

        if (hoursExpired > GRACE_PERIOD_HOURS) {
          // Beyond grace period - session is truly expired
          console.warn(
            `[useAuthCheck] Session expired ${hoursExpired.toFixed(1)} hours ago - beyond ${GRACE_PERIOD_HOURS}h grace period`
          )
          clearAuthLocalStorage()
          setResult({
            isAuthenticated: false,
            isChecking: false,
            hasBand: false,
            failureReason: 'session-expired',
          })
          return
        }

        // Within grace period - allow access but log warning
        console.log(
          `[useAuthCheck] Session expired ${Math.round(hoursExpired * 60)} minutes ago - within grace period, allowing access`
        )
      }

      // 4. Session is valid (or within grace period)
      setResult({
        isAuthenticated: true,
        isChecking: false,
        hasBand: true,
        failureReason: null,
      })
    }

    checkAuth().finally(() => {
      // Mark initial check as complete after first auth check finishes
      // This ensures subsequent route changes don't show loading spinner
      if (isInitialCheck) {
        setIsInitialCheck(false)
      }
    })
    // Re-run auth check on every route change to catch expired sessions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  return result
}
