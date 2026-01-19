import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuthCheck } from '../../hooks/useAuthCheck'
import { useAuth } from '../../contexts/AuthContext'
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

  // Show loading spinner during auth check (full screen, dark theme)
  // This preserves the auth-loading-spinner testid for E2E test compatibility
  if (isChecking) {
    return (
      <div
        className="flex items-center justify-center min-h-screen bg-gray-900"
        data-testid="auth-loading-spinner"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-400 text-sm">Loading...</span>
        </div>
      </div>
    )
  }

  // Handle session expiration detected by AuthContext's visibility listener
  // This catches the "left tab open overnight" scenario
  if (sessionExpired) {
    return <Navigate to="/auth?reason=session-expired" replace />
  }

  // Handle authentication failures with appropriate redirects
  // IMPORTANT: These redirects happen BEFORE ModernLayout renders
  // This prevents any flash of authenticated content
  if (!isAuthenticated) {
    switch (failureReason) {
      case 'no-band':
        // User is logged in but has no band - send to band creation
        return <Navigate to="/auth?view=get-started" replace />

      case 'session-expired':
        // Session expired beyond grace period
        return <Navigate to="/auth?reason=session-expired" replace />

      case 'session-invalid':
        // Session data corrupted or missing
        return <Navigate to="/auth?reason=session-invalid" replace />

      case 'no-user':
      default:
        // No user at all - send to login
        return <Navigate to="/auth" replace />
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
