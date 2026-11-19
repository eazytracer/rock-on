/** Shared auth-screen rules and helpers (non-component exports). */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const PASSWORD_MIN = 8

/** Messages for `?reason=` (ProtectedLayoutRoute) and `?error=` (AuthCallback). */
export function arrivalMessage(params: URLSearchParams): string | null {
  const reason = params.get('reason')
  if (reason === 'signed-out')
    return "You've been signed out. Please sign in again."
  if (reason === 'session-error')
    return 'There was a problem with your session. Please sign in again.'
  const error = params.get('error')
  if (!error) return null
  switch (error) {
    case 'access_denied':
    case 'no_auth_code':
      return "Sign-in was cancelled or didn't finish. Try again, or use your email."
    case 'oauth_not_configured':
      return "Google sign-in isn't set up here. Use your email and password."
    case 'no_session':
      return "Couldn't sign you in. Try again."
    case 'unexpected_error':
      return 'Something went wrong. Try again.'
    default:
      return error
  }
}

/**
 * Resolves once AuthContext has stored the signed-in user (at most 10 s).
 * Protected routes check that first, so navigate there only after it.
 */
export const signedInUser = () =>
  new Promise<void>(resolve => {
    const started = Date.now()
    const tick = () =>
      localStorage.getItem('currentUserId') || Date.now() - started > 10000
        ? resolve()
        : setTimeout(tick, 100)
    tick()
  })
