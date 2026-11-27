import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSupabaseClient } from '../../services/supabase/client'
import { config } from '../../config/appMode'
import { sanitizeReturnTo } from '../../utils/returnTo'
import { createLogger } from '../../utils/logger'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'

const log = createLogger('AuthCallback')

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
        log.error('OAuth callback received in mock auth mode')
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
          log.error('OAuth provider error:', errorParam, errorDescription)
          // A cancelled sign-in keeps its code so Sign in can say so; the
          // pending returnTo rides along so the link isn't lost.
          const errorMessage =
            errorParam === 'access_denied'
              ? errorParam
              : errorDescription || errorParam
          const pending = sanitizeReturnTo(params.get('returnTo'))
          navigate(
            '/auth?error=' +
              encodeURIComponent(errorMessage) +
              (pending ? `&returnTo=${encodeURIComponent(pending)}` : '')
          )
          return
        }

        // Check if we have tokens in the hash (implicit flow) or code in query params (PKCE flow)
        const hashParams = new URLSearchParams(
          window.location.hash.substring(1)
        )
        const code = params.get('code')
        const accessToken = hashParams.get('access_token')

        // If we have access_token in hash, let Supabase's detectSessionInUrl handle it
        if (accessToken) {
          log.debug('Implicit OAuth flow detected')

          // Give Supabase a moment to detect and process the session from URL
          await new Promise(resolve => setTimeout(resolve, 1000))

          // Check if session was established
          const {
            data: { session },
            error: sessionError,
          } = await supabase.auth.getSession()

          if (sessionError) {
            log.error(
              'Failed to get session after implicit flow:',
              sessionError
            )
            navigate('/auth?error=' + encodeURIComponent(sessionError.message))
            return
          }

          if (!session) {
            log.error('No session found after implicit flow')
            navigate('/auth?error=no_session')
            return
          }

          // Continue with the rest of the flow (checking for band, etc.)
          // Fall through to the common redirect logic below
        } else if (code) {
          // PKCE flow - exchange code for session
          log.debug('PKCE OAuth flow detected - exchanging code for session')

          const { data, error } =
            await supabase.auth.exchangeCodeForSession(code)

          if (error) {
            log.error('Failed to exchange code for session:', error)

            // Provide more specific error messages
            let errorMessage = error.message
            if (error.message.includes('expired')) {
              errorMessage =
                'The sign-in link has expired. Please try signing in again.'
            } else if (error.message.includes('invalid')) {
              errorMessage =
                'Invalid sign-in link. Please try signing in again.'
            } else if (error.message.includes('already')) {
              errorMessage =
                'This sign-in link has already been used. Please try signing in again.'
            }

            navigate('/auth?error=' + encodeURIComponent(errorMessage))
            return
          }

          if (!data.session) {
            log.warn('Code exchange succeeded but no session created')
            navigate('/auth?error=no_session')
            return
          }
        } else {
          // No code and no access_token - this shouldn't happen
          log.error('No auth code or access token in callback URL')
          navigate('/auth?error=no_auth_code')
          return
        }

        // Common logic for both flows - wait for auth state to be ready
        // The onAuthStateChange listener in AuthContext will handle:
        // - Loading bands/memberships
        // - Setting up realtime subscriptions

        // Wait for AuthContext to set up user in localStorage
        // before navigating (to avoid ProtectedRoute race condition)
        const waitForAuthState = () => {
          return new Promise<{ userId: string | null; bandId: string | null }>(
            resolve => {
              const checkInterval = setInterval(() => {
                const currentUserId = localStorage.getItem('currentUserId')
                const currentBandId = localStorage.getItem('currentBandId')

                if (currentUserId) {
                  // User is set up - check if they have a band
                  clearInterval(checkInterval)
                  resolve({ userId: currentUserId, bandId: currentBandId })
                }
              }, 100) // Check every 100ms

              // Timeout after 10 seconds
              setTimeout(() => {
                clearInterval(checkInterval)
                const currentUserId = localStorage.getItem('currentUserId')
                const currentBandId = localStorage.getItem('currentBandId')
                log.warn('Auth state setup timeout')
                resolve({ userId: currentUserId, bandId: currentBandId })
              }, 10000)
            }
          )
        }

        const { userId, bandId } = await waitForAuthState()

        // Replay a pending same-origin destination (e.g. an event join URL)
        // if one was carried through on the callback URL. Only safe relative
        // paths survive sanitization.
        const returnTo = sanitizeReturnTo(params.get('returnTo'))

        // returnTo (if any) takes priority — a band isn't required to, e.g.,
        // join an event. Otherwise: has-band → home, brand-new user → get-started.
        if (returnTo) {
          navigate(returnTo)
        } else if (bandId) {
          navigate('/')
        } else if (userId) {
          navigate('/get-started')
        } else {
          log.error('No user ID found after auth - redirecting to sign in')
          navigate('/auth')
        }
      } catch (error) {
        log.error('Auth callback error:', error)
        navigate('/auth?error=unexpected_error')
      }
    }

    handleCallback()
  }, [navigate])

  return (
    <div
      className="flex items-center justify-center min-h-[100dvh] bg-bg-1"
      data-testid="auth-callback-page"
    >
      <LoadingSpinner size="lg" text="Signing you in…" />
    </div>
  )
}
