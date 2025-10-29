import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSupabaseClient } from '../../services/supabase/client'
import { config } from '../../config/appMode'

/**
 * Auth callback page for OAuth redirects (Google, etc.)
 * Handles the OAuth callback and redirects to the app
 */
export function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleCallback = async () => {
      // Only process callback in production mode
      if (!config.enableSupabaseAuth) {
        console.error('OAuth callback received in mock auth mode')
        navigate('/login?error=oauth_not_configured')
        return
      }

      try {
        const supabase = getSupabaseClient()

        // Exchange the code for a session
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          console.error('Auth callback error:', error)
          navigate('/login?error=' + encodeURIComponent(error.message))
          return
        }

        if (data.session) {
          // Success! Redirect to home
          navigate('/')
        } else {
          // No session created
          navigate('/login?error=no_session')
        }
      } catch (error) {
        console.error('Auth callback error:', error)
        navigate('/login?error=unexpected_error')
      }
    }

    handleCallback()
  }, [navigate])

  return (
    <div className="flex items-center justify-center min-h-screen bg-surface">
      <div className="flex items-center space-x-2">
        <svg
          className="animate-spin h-8 w-8 text-blue-600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span className="text-lg text-gray-700">Completing sign in...</span>
      </div>
    </div>
  )
}
