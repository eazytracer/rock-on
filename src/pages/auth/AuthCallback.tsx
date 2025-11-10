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
        navigate('/auth?error=oauth_not_configured')
        return
      }

      try {
        const supabase = getSupabaseClient()

        // Check for OAuth provider errors in query params
        const params = new URLSearchParams(window.location.search)
        const errorParam = params.get('error')
        const errorDescription = params.get('error_description')

        if (errorParam) {
          console.error('OAuth provider error:', errorParam, errorDescription)
          const errorMessage = errorDescription || errorParam
          navigate('/auth?error=' + encodeURIComponent(errorMessage))
          return
        }

        // Check if we have tokens in the hash (implicit flow) or code in query params (PKCE flow)
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const code = params.get('code')
        const accessToken = hashParams.get('access_token')

        console.log('🔍 OAuth Callback Debug:')
        console.log('  Full URL:', window.location.href)
        console.log('  Has code (PKCE):', !!code)
        console.log('  Has access_token (Implicit):', !!accessToken)

        // If we have access_token in hash, let Supabase's detectSessionInUrl handle it
        if (accessToken) {
          console.log('🔄 Implicit flow detected - letting Supabase handle session from URL hash...')

          // Give Supabase a moment to detect and process the session from URL
          await new Promise(resolve => setTimeout(resolve, 1000))

          // Check if session was established
          const { data: { session }, error: sessionError } = await supabase.auth.getSession()

          if (sessionError) {
            console.error('Failed to get session after implicit flow:', sessionError)
            navigate('/auth?error=' + encodeURIComponent(sessionError.message))
            return
          }

          if (!session) {
            console.error('No session found after implicit flow')
            navigate('/auth?error=no_session')
            return
          }

          console.log('✅ Implicit OAuth session established successfully')

          // Continue with the rest of the flow (checking for band, etc.)
          // Fall through to the common redirect logic below

        } else if (code) {
          // PKCE flow - exchange code for session
          console.log('🔄 PKCE flow detected - exchanging code for session...')

          const { data, error } = await supabase.auth.exchangeCodeForSession(code)

          if (error) {
            console.error('Failed to exchange code for session:', error)

            // Provide more specific error messages
            let errorMessage = error.message
            if (error.message.includes('expired')) {
              errorMessage = 'The sign-in link has expired. Please try signing in again.'
            } else if (error.message.includes('invalid')) {
              errorMessage = 'Invalid sign-in link. Please try signing in again.'
            } else if (error.message.includes('already')) {
              errorMessage = 'This sign-in link has already been used. Please try signing in again.'
            }

            navigate('/auth?error=' + encodeURIComponent(errorMessage))
            return
          }

          if (!data.session) {
            console.warn('⚠️ Code exchange succeeded but no session created')
            navigate('/auth?error=no_session')
            return
          }

          console.log('✅ PKCE OAuth session established successfully')

        } else {
          // No code and no access_token - this shouldn't happen
          console.error('No auth code or access token in callback URL')
          navigate('/auth?error=no_auth_code')
          return
        }

        // Common logic for both flows - wait for auth state to be ready
        console.log('✅ OAuth session established successfully')
        // The onAuthStateChange listener in AuthContext will handle:
        // - Syncing user to local DB
        // - Loading bands/memberships
        // - Initial sync if needed
        // - Setting up realtime subscriptions

        // Wait for AuthContext to set up user in localStorage
        // before navigating (to avoid ProtectedRoute race condition)
        console.log('⏳ Waiting for auth state to be ready...')

        const waitForAuthState = () => {
          return new Promise<{ userId: string | null; bandId: string | null }>((resolve) => {
            const checkInterval = setInterval(() => {
              const currentUserId = localStorage.getItem('currentUserId')
              const currentBandId = localStorage.getItem('currentBandId')

              if (currentUserId) {
                // User is synced - check if they have a band
                console.log(`✅ Auth state ready (userId: ${currentUserId}, bandId: ${currentBandId || 'none'})`)
                clearInterval(checkInterval)
                resolve({ userId: currentUserId, bandId: currentBandId })
              }
            }, 100) // Check every 100ms

            // Timeout after 10 seconds
            setTimeout(() => {
              clearInterval(checkInterval)
              const currentUserId = localStorage.getItem('currentUserId')
              const currentBandId = localStorage.getItem('currentBandId')
              console.warn('⚠️ Auth state setup timeout')
              resolve({ userId: currentUserId, bandId: currentBandId })
            }, 10000)
          })
        }

        const { userId, bandId } = await waitForAuthState()

        // If user has a band, go to home. Otherwise, go to get-started flow
        if (bandId) {
          console.log('🏠 User has band, navigating to home')
          navigate('/')
        } else if (userId) {
          console.log('👋 New user without band, navigating to get-started')
          navigate('/auth?view=get-started')
        } else {
          console.error('❌ No user ID found after auth - redirecting to sign in')
          navigate('/auth')
        }
      } catch (error) {
        console.error('Auth callback error:', error)
        navigate('/auth?error=unexpected_error')
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
