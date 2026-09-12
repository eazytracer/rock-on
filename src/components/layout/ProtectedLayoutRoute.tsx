import React, { useState, useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthCheck } from '../../hooks/useAuthCheck'
import { useAuth } from '../../contexts/AuthContext'
import { encodeReturnTo } from '../../utils/returnTo'
import { ModernLayout } from './ModernLayout'
import { createLogger } from '../../utils/logger'

const log = createLogger('ProtectedLayoutRoute')

// Circuit breaker key for recovery ladder
const RECOVERY_ATTEMPTS_KEY = 'authRecoveryAttempts'
const MAX_RECOVERY_ATTEMPTS = 1

/**
 * ProtectedLayoutRoute
 *
 * Combines authentication checking with the persistent layout wrapper.
 * This component serves as the layout route for all protected pages.
 *
 * Phase 1 behavior:
 * - Shows loading spinner during auth check (full screen, dark theme)
 * - Redirects to /auth BEFORE rendering layout if unauthenticated
 * - Implements recovery ladder for "token valid but app state broken":
 *   1. Retry loadUserData once
 *   2. Redirect to home (/)
 *   3. Only then /auth
 * - Circuit breaker: authRecoveryAttempts in sessionStorage, cleared on success
 *
 * Redirect behavior:
 * - no-user: /auth (login page)
 * - signed-out: /auth?reason=signed-out (inactivity/explicit sign-out)
 * - session-error: /auth?reason=session-error (corruption/network error)
 *
 * @example
 * ```tsx
 * // In App.tsx
 * <Routes>
 *   <Route element={<ProtectedLayoutRoute />}>
 *     <Route path="/songs" element={<SongsPage />} />
 *     <Route path="/setlists" element={<SetlistsPage />} />
 *   </Route>
 *   <Route path="/auth" element={<AuthPages />} />
 * </Routes>
 * ```
 */
export const ProtectedLayoutRoute: React.FC = () => {
  const { isAuthenticated, isChecking, failureReason } = useAuthCheck()
  const { currentUser, loading: contextLoading } = useAuth()
  const location = useLocation()
  const [recoveryAttempted, setRecoveryAttempted] = useState(false)

  // Preserve where the user was headed (e.g. `/events?join=CODE`) so the auth
  // pages can return them there after login/signup. Only the current pathname +
  // search is captured; it's re-validated as same-origin on the way back out.
  const returnTo = encodeReturnTo(location.pathname + location.search)
  const returnToParam = `&returnTo=${returnTo}`

  // Circuit breaker: track recovery attempts in sessionStorage
  // Cleared on successful load (when currentUser is present)
  useEffect(() => {
    if (currentUser && !contextLoading) {
      // Success - clear the circuit breaker
      sessionStorage.removeItem(RECOVERY_ATTEMPTS_KEY)
      log.debug('Context loaded successfully, circuit breaker cleared')
    }
  }, [currentUser, contextLoading])

  // Show loading spinner during auth check (full screen, dark theme).
  // Preserves the auth-loading-spinner testid for E2E test compatibility.
  // Palette: `bg-bg-0` (app background), `border-primary` (brand
  // orange `#FE4401` via tailwind semantic token), `text-ink-3`
  // (secondary text per style guide).
  if (isChecking || contextLoading) {
    return (
      <div
        className="flex items-center justify-center min-h-screen bg-bg-0"
        data-testid="auth-loading-spinner"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-ink-3 text-sm">Loading...</span>
        </div>
      </div>
    )
  }

  // Handle authentication failures with appropriate redirects
  // IMPORTANT: These redirects happen BEFORE ModernLayout renders
  // This prevents any flash of authenticated content
  if (!isAuthenticated) {
    switch (failureReason) {
      case 'signed-out':
        // User was signed out (inactivity, explicit sign-out, or SIGNED_OUT event)
        return (
          <Navigate to={`/auth?reason=signed-out${returnToParam}`} replace />
        )

      case 'session-error':
        // Session error (network error, corrupted session)
        return (
          <Navigate to={`/auth?reason=session-error${returnToParam}`} replace />
        )

      case 'no-user':
      default:
        // No user at all - send to login
        return <Navigate to={`/auth?returnTo=${returnTo}`} replace />
    }
  }

  // Recovery ladder: authenticated (session valid) but context not loaded
  // This handles "token valid but app state broken" scenarios
  if (!currentUser && !recoveryAttempted) {
    const attempts = parseInt(
      sessionStorage.getItem(RECOVERY_ATTEMPTS_KEY) || '0',
      10
    )

    if (attempts < MAX_RECOVERY_ATTEMPTS) {
      // Step 1: Retry loading user data once
      log.warn(
        'Context not loaded despite valid session, incrementing recovery'
      )
      sessionStorage.setItem(RECOVERY_ATTEMPTS_KEY, String(attempts + 1))
      setRecoveryAttempted(true)
      // Force a re-render by updating state; AuthContext will retry loadUserData
      window.location.reload()
      return null
    } else if (location.pathname !== '/') {
      // Step 2: Redirect to home (safe surface)
      log.warn('Recovery retry exhausted, redirecting to home')
      return <Navigate to="/" replace />
    } else {
      // Step 3: Already at home and still broken, send to auth
      log.error('Recovery ladder exhausted, redirecting to auth')
      sessionStorage.removeItem(RECOVERY_ATTEMPTS_KEY)
      return (
        <Navigate to={`/auth?reason=session-error${returnToParam}`} replace />
      )
    }
  }

  // Render persistent layout with Outlet for nested routes
  // ModernLayout stays mounted while navigating between child routes
  return (
    <ModernLayout>
      <Outlet />
    </ModernLayout>
  )
}
