import React, { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'

interface ProtectedRouteProps {
  children: React.ReactNode
}

/**
 * ProtectedRoute Component
 *
 * Protects routes by checking for currentUserId and currentBandId in localStorage.
 * If either is missing, redirects to the /auth page.
 *
 * This component checks localStorage directly rather than using AuthContext
 * to avoid circular dependencies and ensure simple, reliable protection.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const [isChecking, setIsChecking] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    const checkAuth = () => {
      const currentUserId = localStorage.getItem('currentUserId')
      const currentBandId = localStorage.getItem('currentBandId')

      // User must have both userId and bandId to access protected routes
      setIsAuthorized(!!(currentUserId && currentBandId))
      setIsChecking(false)
    }

    checkAuth()
  }, [])

  // Show nothing while checking (prevents flash of content)
  if (isChecking) {
    return null
  }

  // Redirect to auth if not authorized
  if (!isAuthorized) {
    return <Navigate to="/auth" replace />
  }

  // Render protected content
  return <>{children}</>
}
