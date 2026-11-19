/**
 * Sign in (`/auth`). Account and Settings 1–2; desktop-more.js V.signin.
 */
import React, { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { authService } from '../../services/auth/AuthFactory'
import { BUILD_ID } from '../../config/buildInfo'
import { sanitizeReturnTo } from '../../utils/returnTo'
import { createLogger } from '../../utils/logger'
import { Button } from '../../components/ui'
import {
  AuthError,
  AuthField,
  AuthFields,
  AuthFrame,
  GoogleButton,
  OrRule,
} from './AuthFrame'
import { arrivalMessage } from './authHelpers'

const log = createLogger('SignInPage')

const WRONG_PASSWORD = 'wrong-password'

const DEV_USERS = [
  ['Eric', 'eric@testband.demo'],
  ['Mike', 'mike@testband.demo'],
  ['Sarah', 'sarah@testband.demo'],
] as const

export const SignInPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn } = useAuth()
  const params = new URLSearchParams(location.search)
  const returnTo = sanitizeReturnTo(params.get('returnTo'))
  const returnQuery = returnTo
    ? `?returnTo=${encodeURIComponent(returnTo)}`
    : ''

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  // Starts with the arrival reason (signed out, cancelled Google, …).
  const [error, setError] = useState<string | null>(() =>
    arrivalMessage(params)
  )
  const [missing, setMissing] = useState<{ email?: boolean; pw?: boolean }>({})

  // Old deep links: `?view=signup` (jam view) and `?view=get-started`.
  const view = params.get('view')
  if (view === 'signup') return <Navigate to={`/auth/signup${returnQuery}`} />
  if (view === 'get-started') return <Navigate to="/get-started" />

  const doSignIn = async (e: string, p: string, to: string) => {
    setLoading(true)
    setError(null)
    try {
      const { error: err } = await signIn({ email: e, password: p })
      if (err) {
        setError(/invalid login credentials/i.test(err) ? WRONG_PASSWORD : err)
        setLoading(false)
        return
      }
      navigate(to)
    } catch (err) {
      log.error('Sign in failed', err)
      setError("Couldn't sign you in. Try again.")
      setLoading(false)
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const m = { email: !email.trim(), pw: !password }
    setMissing(m)
    if (m.email || m.pw) {
      setError('Enter your email and password.')
      return
    }
    void doSignIn(email.trim(), password, returnTo ?? '/')
  }

  const google = async () => {
    setError(null)
    setLoading(true)
    const { error: err } = await authService.signInWithOAuth('google', returnTo)
    // Success leaves the page for Google; only a failure comes back here.
    if (err) {
      setError(err)
      setLoading(false)
    }
  }

  const wrong = error === WRONG_PASSWORD

  return (
    <AuthFrame
      data-testid="sign-in-page"
      logo
      lead={
        <>
          <GoogleButton onClick={google} disabled={loading} />
          <OrRule />
        </>
      }
      error={
        error && (
          <AuthError data-testid="sign-in-error">
            {wrong ? (
              <>
                That email and password don&apos;t match. Check for typos, or{' '}
                <Link
                  to="/auth/forgot"
                  state={{ email }}
                  data-testid="sign-in-error-reset-link"
                  className="font-semibold text-accent-ink underline underline-offset-2"
                >
                  reset your password
                </Link>
                .
              </>
            ) : (
              error
            )}
          </AuthError>
        )
      }
    >
      <form
        onSubmit={submit}
        noValidate
        className="flex flex-col gap-2.5 md:gap-3"
      >
        <AuthFields>
          <AuthField
            label="Email"
            id="login-email"
            name="email"
            data-testid="login-email-input"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={v => {
              setEmail(v)
              setMissing(m => ({ ...m, email: false }))
            }}
            invalid={missing.email}
          />
          <AuthField
            label="Password"
            id="login-password"
            name="password"
            data-testid="login-password-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={v => {
              setPassword(v)
              setMissing(m => ({ ...m, pw: false }))
            }}
            invalid={wrong || missing.pw}
          />
        </AuthFields>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          disabled={loading}
          data-testid="sign-in-button"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <div className="flex-1 flex flex-col md:flex-none md:flex-row md:items-center md:justify-between">
        <Link
          to="/auth/forgot"
          state={{ email }}
          data-testid="forgot-password-link"
          className="self-center md:self-auto h-11 px-1.5 inline-flex items-center font-semibold text-[16px] md:text-[14px] text-ink-2"
        >
          Forgot password?
        </Link>
        <p className="mt-auto pt-4 md:mt-0 md:pt-0 text-center text-[14px] text-ink-2">
          New here?{' '}
          <Link
            to={`/auth/signup${returnQuery}`}
            data-testid="create-account-link"
            className="font-bold text-accent-ink"
          >
            Create an account
          </Link>
        </p>
      </div>

      {import.meta.env.MODE === 'development' && (
        <div
          className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-2 font-mono text-[10.5px] text-ink-4"
          data-testid="dev-quick-logins"
        >
          <span>DEV</span>
          {DEV_USERS.map(([name, devEmail]) => (
            <button
              key={devEmail}
              type="button"
              disabled={loading}
              onClick={() => void doSignIn(devEmail, 'test123', '/')}
              data-testid={`dev-login-${name.toLowerCase()}`}
              className="underline underline-offset-2 hover:text-ink-2"
            >
              {name}
            </button>
          ))}
        </div>
      )}
      <p
        className="text-center font-mono text-[10px] text-ink-5"
        data-testid="build-id"
      >
        Build {BUILD_ID}
      </p>
    </AuthFrame>
  )
}

export default SignInPage
