/**
 * Sign up (`/auth/signup`): name, email, one password with eye (decision 2),
 * then Check your email, or straight on to Get started when confirmations are
 * off.
 */
import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { authService } from '../../services/auth/AuthFactory'
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
import { EMAIL_RE, PASSWORD_MIN, signedInUser } from './authHelpers'
import { CheckEmailScreen } from './CheckEmailScreen'

const log = createLogger('SignUpPage')

type Bad = { name?: boolean; email?: boolean; password?: boolean }

export const SignUpPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { signUp } = useAuth()
  const returnTo = sanitizeReturnTo(
    new URLSearchParams(location.search).get('returnTo')
  )

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [bad, setBad] = useState<Bad>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  if (sentTo) {
    return (
      <CheckEmailScreen
        email={sentTo}
        kind="signup"
        returnTo={returnTo}
        onUseDifferentEmail={() => setSentTo(null)}
      />
    )
  }

  const validate = (): boolean => {
    const next: Bad = {
      name: name.trim().length < 2,
      email: !EMAIL_RE.test(email.trim()),
      password: password.length < PASSWORD_MIN,
    }
    setBad(next)
    if (next.name) setError('Add your name: at least 2 characters.')
    else if (next.email) setError("That email doesn't look right.")
    else if (next.password)
      setError(`Passwords need at least ${PASSWORD_MIN} characters.`)
    else setError(null)
    return !next.name && !next.email && !next.password
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const { error: err, needsEmailConfirmation } = await signUp(
        { email: email.trim(), password, name: name.trim() },
        returnTo ?? undefined
      )
      setLoading(false)
      if (err) {
        setError(err)
        return
      }
      if (needsEmailConfirmation) {
        setSentTo(email.trim())
        return
      }
      // Get started's rows and any returnTo are protected routes: let
      // AuthContext finish setting up the user first, or the route guard
      // bounces back to sign in.
      await signedInUser()
      navigate(returnTo ?? '/get-started')
    } catch (err) {
      log.error('Sign up failed', err)
      setError("Couldn't create your account. Try again.")
      setLoading(false)
    }
  }

  const google = async () => {
    setError(null)
    setLoading(true)
    const { error: err } = await authService.signInWithOAuth('google', returnTo)
    if (err) {
      setError(err)
      setLoading(false)
    }
  }

  return (
    <AuthFrame
      data-testid="sign-up-page"
      back={{
        label: 'Sign in',
        to: returnTo
          ? `/auth?returnTo=${encodeURIComponent(returnTo)}`
          : '/auth',
      }}
      title="Create account"
      lede="Your own songs and setlists, and any bands you join."
      lead={
        <>
          <GoogleButton onClick={google} disabled={loading} />
          <OrRule />
        </>
      }
      error={
        error && <AuthError data-testid="sign-up-error">{error}</AuthError>
      }
      footer={
        <p className="text-center text-[14px] text-ink-2">
          Have an account?{' '}
          <Link
            to={
              returnTo
                ? `/auth?returnTo=${encodeURIComponent(returnTo)}`
                : '/auth'
            }
            data-testid="sign-in-link"
            className="font-bold text-accent-ink"
          >
            Sign in
          </Link>
          <span className="block mt-3 text-[12.5px] text-ink-3">
            By creating an account you agree to the{' '}
            <Link
              to="/terms"
              className="underline"
              data-testid="signup-terms-link"
            >
              Terms
            </Link>{' '}
            and{' '}
            <Link
              to="/privacy"
              className="underline"
              data-testid="signup-privacy-link"
            >
              Privacy policy
            </Link>
            .
          </span>
        </p>
      }
    >
      <form
        onSubmit={submit}
        noValidate
        className="flex flex-col gap-2.5 md:gap-3"
      >
        <AuthFields>
          <AuthField
            label="Name"
            id="signup-name"
            name="name"
            data-testid="signup-name-input"
            autoComplete="name"
            placeholder="What your band calls you"
            value={name}
            onChange={v => {
              setName(v)
              setBad(b => ({ ...b, name: false }))
            }}
            invalid={bad.name}
          />
          <AuthField
            label="Email"
            id="signup-email"
            name="email"
            data-testid="signup-email-input"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={v => {
              setEmail(v)
              setBad(b => ({ ...b, email: false }))
            }}
            invalid={bad.email}
          />
          <AuthField
            label="Password"
            id="signup-password"
            name="password"
            data-testid="signup-password-input"
            type="password"
            autoComplete="new-password"
            placeholder={`At least ${PASSWORD_MIN} characters`}
            value={password}
            onChange={v => {
              setPassword(v)
              setBad(b => ({ ...b, password: false }))
            }}
            invalid={bad.password}
          />
        </AuthFields>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          disabled={loading}
          data-testid="signup-submit-button"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthFrame>
  )
}

export default SignUpPage
