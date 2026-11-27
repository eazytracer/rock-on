/**
 * Set new password (`/auth/reset`), opened from the reset email. The link
 * signs the user in with a recovery session (Supabase reads it from the URL);
 * one field with eye + Save → Home (decision 2).
 */
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService } from '../../services/auth/AuthFactory'
import { useToast } from '../../contexts/ToastContext'
import { Button } from '../../components/ui'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { AuthError, AuthField, AuthFields, AuthFrame } from './AuthFrame'
import { PASSWORD_MIN, signedInUser } from './authHelpers'

type Status = 'checking' | 'ready' | 'expired'

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [status, setStatus] = useState<Status>(() =>
    window.location.hash.includes('error') ? 'expired' : 'checking'
  )
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (status !== 'checking') return
    let live = true
    authService.getSession().then(session => {
      if (live) setStatus(session ? 'ready' : 'expired')
    })
    return () => {
      live = false
    }
  }, [status])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < PASSWORD_MIN) {
      setError(`Passwords need at least ${PASSWORD_MIN} characters.`)
      return
    }
    setSaving(true)
    setError(null)
    const { error: err } = await authService.updatePassword(password)
    setSaving(false)
    if (err) {
      setError(err)
      return
    }
    await signedInUser()
    showToast('Password saved', 'success')
    navigate('/', { replace: true })
  }

  if (status === 'checking') {
    return (
      <AuthFrame data-testid="reset-password-page" centered>
        <div className="flex-1 grid place-items-center">
          <LoadingSpinner size="lg" />
        </div>
      </AuthFrame>
    )
  }

  if (status === 'expired') {
    return (
      <AuthFrame
        data-testid="reset-password-page"
        back={{ label: 'Sign in', to: '/auth' }}
        title={
          <>
            Link <br className="md:hidden" />
            expired
          </>
        }
        lede="This reset link has expired or was already used. Send yourself a new one."
      >
        <div className="mt-auto md:mt-0">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => navigate('/auth/forgot')}
            data-testid="reset-new-link-button"
          >
            Send a new link
          </Button>
        </div>
      </AuthFrame>
    )
  }

  return (
    <AuthFrame
      data-testid="reset-password-page"
      title={
        <>
          Set new <br className="md:hidden" />
          password
        </>
      }
      lede={`At least ${PASSWORD_MIN} characters. You'll stay signed in.`}
      error={error && <AuthError data-testid="reset-error">{error}</AuthError>}
    >
      <form
        onSubmit={save}
        noValidate
        className="flex flex-col flex-1 gap-2.5 md:gap-3"
      >
        <AuthFields>
          <AuthField
            label="New password"
            id="reset-password"
            name="password"
            data-testid="reset-password-input"
            type="password"
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={v => {
              setPassword(v)
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
            disabled={saving}
            data-testid="reset-save-button"
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </AuthFrame>
  )
}

export default ResetPasswordPage
