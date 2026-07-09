import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthCheck } from '../../hooks/useAuthCheck'
import { useAuth } from '../../contexts/AuthContext'
import { encodeReturnTo } from '../../utils/returnTo'
import { ModernLayout } from './ModernLayout'

/**
 * ProtectedLayoutRoute
 *
 * Combines authentication checking with the persistent layout wrapper.
 * This component serves as the layout route for all protected pages.
 *
 * Key behaviors:
 * 1. Shows loading spinner during auth check (full screen, dark theme)
 * 2. Redirects to /auth BEFORE rendering layout if unauthenticated
 * 3. Wraps authenticated content in ModernLayout with Outlet
 *
 * The layout (navbar/sidebar) stays mounted during navigation between
 * protected routes, eliminating white screen flicker.
 *
 * Redirect behavior:
 * - no-user: /auth (login page)
 * - no-band: /auth?view=get-started (band creation)
 * - session-expired: /auth?reason=session-expired
 * - session-invalid: /auth?reason=session-invalid
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
  const { sessionExpired } = useAuth()
  const location = useLocation()

  // Preserve where the user was headed (e.g. `/events?join=CODE`) so the auth
  // pages can return them there after login/signup. Only the current pathname +
  // search is captured; it's re-validated as same-origin on the way back out.
  const returnTo = encodeReturnTo(location.pathname + location.search)
  const returnToParam = `&returnTo=${returnTo}`

  // Show loading spinner during auth check (full screen, dark theme).
  // Preserves the auth-loading-spinner testid for E2E test compatibility.
  // Palette: `bg-bg-0` (app background), `border-primary` (brand
  // orange `#FE4401` via tailwind semantic token), `text-ink-3`
  // (secondary text per style guide).
  if (isChecking) {
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

  // Handle session expiration detected by AuthContext's visibility listener
  // This catches the "left tab open overnight" scenario
  if (sessionExpired) {
    return (
      <Navigate to={`/auth?reason=session-expired${returnToParam}`} replace />
    )
  }

  // Handle authentication failures with appropriate redirects
  // IMPORTANT: These redirects happen BEFORE ModernLayout renders
  // This prevents any flash of authenticated content
  if (!isAuthenticated) {
    switch (failureReason) {
      // NOTE: 'no-band' is no longer an auth failure — a user can be authenticated
      // without a band (personal/guest accounts). "Has a band" is a capability the
      // app degrades gracefully around; see useAuthCheck.

      case 'session-expired':
        // Session expired beyond grace period
        return (
          <Navigate
            to={`/auth?reason=session-expired${returnToParam}`}
            replace
          />
        )

      case 'session-invalid':
        // Session data corrupted or missing
        return (
          <Navigate
            to={`/auth?reason=session-invalid${returnToParam}`}
            replace
          />
        )

      case 'no-user':
      default:
        // No user at all - send to login
        return <Navigate to={`/auth?returnTo=${returnTo}`} replace />
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
