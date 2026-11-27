/**
 * Forgot password (`/auth/forgot`): one field, one button, then Check your
 * email. Account and Settings 10; desktop-final.js V.forgot.
 */
import React, { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { authService } from '../../services/auth/AuthFactory'
import { Button } from '../../components/ui'
import { AuthError, AuthField, AuthFields, AuthFrame } from './AuthFrame'
import { EMAIL_RE } from './authHelpers'
import { CheckEmailScreen } from './CheckEmailScreen'

export const ForgotPasswordPage: React.FC = () => {
  const location = useLocation()
  const [email, setEmail] = useState<string>(
    (location.state as { email?: string } | null)?.email ?? ''
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  if (sentTo) {
    return (
      <CheckEmailScreen
        email={sentTo}
        kind="reset"
        onUseDifferentEmail={() => setSentTo(null)}
      />
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const address = email.trim()
    if (!EMAIL_RE.test(address)) {
      setError("That email doesn't look right.")
      return
    }
    setLoading(true)
    setError(null)
    const { error: err } = await authService.requestPasswordReset(address)
    setLoading(false)
    if (err) {
      setError(err)
      return
    }
    setSentTo(address)
  }

  return (
    <AuthFrame
      data-testid="forgot-password-page"
      back={{ label: 'Sign in', to: '/auth' }}
      title={
        <>
          Reset <br className="md:hidden" />
          password
        </>
      }
      lede="Enter the email you signed up with. We'll send a link that works for 1 hour."
      error={error && <AuthError data-testid="forgot-error">{error}</AuthError>}
    >
      <form
        onSubmit={submit}
        noValidate
        className="flex flex-col flex-1 gap-2.5 md:gap-3"
      >
        <AuthFields>
          <AuthField
            label="Email"
            id="forgot-email"
            name="email"
            data-testid="forgot-email-input"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            autoFocus
            value={email}
            onChange={v => {
              setEmail(v)
              setError(null)
            }}
            invalid={!!error}
          />
        </AuthFields>
        <div className="mt-auto md:mt-0">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            disabled={loading}
            data-testid="forgot-submit-button"
          >
            {loading ? 'Sending…' : 'Send reset link'}
          </Button>
        </div>
      </form>
    </AuthFrame>
  )
}

export default ForgotPasswordPage
