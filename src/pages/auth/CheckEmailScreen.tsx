/**
 * Check your email: shared by sign up and forgot password. Account and
 * Settings 3; desktop-final.js V.checkmail. No Open Mail (decision 5).
 */
import React, { useEffect, useState } from 'react'
import { Mail } from 'lucide-react'
import { authService } from '../../services/auth/AuthFactory'
import { useToast } from '../../contexts/ToastContext'
import { Button } from '../../components/ui'
import { AuthError, AuthFrame } from './AuthFrame'

export const RESEND_SECONDS = 60

const clock = (s: number) =>
  `${Math.floor(s / 60)}:${`${s % 60}`.padStart(2, '0')}`

export const CheckEmailScreen: React.FC<{
  email: string
  kind: 'signup' | 'reset'
  returnTo?: string | null
  onUseDifferentEmail: () => void
}> = ({ email, kind, returnTo, onUseDifferentEmail }) => {
  const { showToast } = useToast()
  const [wait, setWait] = useState(RESEND_SECONDS)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait(w => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  const resend = async () => {
    setSending(true)
    setError(null)
    const { error: err } =
      kind === 'signup'
        ? await authService.resendSignupEmail(email, returnTo)
        : await authService.requestPasswordReset(email)
    setSending(false)
    if (err) {
      setError(err)
      return
    }
    setWait(RESEND_SECONDS)
    showToast("Sent again. Check spam if it isn't there.", 'success')
  }

  return (
    <AuthFrame
      data-testid="check-email-page"
      back={{ label: 'Sign in', to: '/auth' }}
      centered
      error={error && <AuthError>{error}</AuthError>}
    >
      <span className="w-[88px] h-[88px] rounded-full bg-bg-3 grid place-items-center mx-auto mt-16 mb-4 md:mt-0 md:mb-2 text-accent-ink">
        <Mail size={40} />
      </span>
      <h1 className="font-display font-extrabold uppercase leading-[.92] text-[36px] md:text-[44px] text-ink-1">
        Check your email
      </h1>
      <p className="text-[15px] text-ink-2" data-testid="check-email-copy">
        We sent a link to{' '}
        <b className="text-ink-1" data-testid="check-email-address">
          {email}
        </b>
        . Go check your email and open the link on this device to carry on. It
        works for an hour.
        {kind === 'signup' && returnTo
          ? " The link you came from is saved, and you'll land there after."
          : ''}
      </p>
      <div className="mt-auto flex flex-col gap-2 w-full md:mt-3">
        <Button
          size="lg"
          fullWidth
          className="disabled:!opacity-100 disabled:text-ink-3"
          onClick={resend}
          disabled={wait > 0 || sending}
          data-testid="check-email-resend-button"
        >
          {wait > 0
            ? `Resend in ${clock(wait)}`
            : sending
              ? 'Sending…'
              : 'Resend'}
        </Button>
        <Button
          variant="text"
          className="self-center"
          onClick={onUseDifferentEmail}
          data-testid="check-email-different-button"
        >
          Use a different email
        </Button>
      </div>
    </AuthFrame>
  )
}
