import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthCheck } from '../hooks/useAuthCheck'
import { useAuth } from '../contexts/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
}

/**
 * Loading spinner shown while checking authentication
 */
const AuthLoadingSpinner: React.FC = () => (
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

/**
 * ProtectedRoute Component
 *
 * Protects routes by validating authentication state using the useAuthCheck hook.
 * This ensures proper session validation, not just localStorage key checks.
 *
 * Features:
 * - Shows loading spinner while checking auth (prevents content flash)
 * - Validates actual session, not just localStorage keys
 * - Applies grace period for briefly expired sessions
 * - Cleans up stale localStorage on invalid sessions
 * - Redirects to appropriate auth page based on failure reason
 *
 * Redirect behavior:
 * - No user: /auth (login page)
 * - User but no band: /auth?view=get-started (band creation)
 * - Session expired: /auth?reason=session-expired
 * - Session invalid: /auth?reason=session-invalid
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isChecking, failureReason } = useAuthCheck()
  const { sessionExpired } = useAuth()

  // Show loading spinner while checking (prevents flash of content or "Not logged in")
  if (isChecking) {
    return <AuthLoadingSpinner />
  }

  // Handle session expiration detected by AuthContext's visibility listener
  // This catches the "left tab open overnight" scenario where the session expires
  // without a route change
  if (sessionExpired) {
    return <Navigate to="/auth?reason=session-expired" replace />
  }

  // Handle authentication failures with appropriate redirects
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

  // Render protected content
  return <>{children}</>
}
