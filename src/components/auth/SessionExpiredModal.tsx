import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'

/**
 * SessionExpiredModal - Handles session expiry by redirecting to auth page
 *
 * When session expires:
 * 1. AuthContext sets sessionExpired=true and clears localStorage
 * 2. This component detects sessionExpired and:
 *    - Shows a toast notification
 *    - Redirects to /auth?reason=session-expired
 *
 * Note: On protected pages, ProtectedRoute's useAuthCheck may also trigger
 * a redirect. This component handles the case where user is on a public page
 * when their session expires.
 */
export const SessionExpiredModal: React.FC = () => {
  const { sessionExpired } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (sessionExpired) {
      // Don't redirect if already on auth page
      if (location.pathname === '/auth') {
        return
      }

      // Show toast notification
      showToast('Your session has expired. Please log in again.', 'info')

      // Redirect to auth page with reason parameter
      navigate('/auth?reason=session-expired', { replace: true })
    }
  }, [sessionExpired, navigate, location.pathname, showToast])

  // No UI - this component only handles the redirect
  return null
}
