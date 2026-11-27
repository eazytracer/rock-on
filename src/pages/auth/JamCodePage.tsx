/**
 * Got a jam code? (`/get-started/jam`): a code entry that hands off to the
 * shared resolver at `/j/CODE` (jam or band code, with or without the hyphen).
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui'
import { parseInviteCode } from '../../domain/invites'
import { resolveCode } from '../../services/api/jams'
import { errorText } from '../../services/api/errors'
import { AuthError, AuthFrame } from './AuthFrame'

export const JamCodePage: React.FC = () => {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  // A wrong code says so here; a jam or band code opens its preview.
  const join = async (e: React.FormEvent) => {
    e.preventDefault()
    const c = parseInviteCode(code)
    if (!c) {
      setError('Enter the code from the host.')
      return
    }
    setChecking(true)
    try {
      if (await resolveCode(c)) navigate(`/j/${c}`)
      else setError("That code isn't valid.")
    } catch (err) {
      setError(errorText(err))
    }
    setChecking(false)
  }

  return (
    <AuthFrame
      data-testid="jam-code-page"
      back={{ label: 'Get started', to: '/get-started' }}
      title={
        <>
          Got a <br className="md:hidden" />
          jam code?
        </>
      }
      lede="Enter the code from the host. You'll see the jam before you join."
      error={
        error && <AuthError data-testid="jam-code-error">{error}</AuthError>
      }
    >
      <form
        onSubmit={join}
        noValidate
        className="flex flex-col flex-1 gap-2.5 md:gap-3"
      >
        <label htmlFor="event-code" className="sr-only">
          Jam or event code
        </label>
        <input
          id="event-code"
          name="eventCode"
          data-testid="join-event-code-input"
          value={code}
          onChange={e => {
            setCode(e.target.value.toUpperCase())
            setError(null)
          }}
          placeholder="ABCD-EFGH"
          autoComplete="off"
          autoCapitalize="characters"
          autoFocus
          aria-invalid={!!error || undefined}
          className={`w-full h-[60px] px-4 rounded-[20px] bg-bg-2 shadow-group font-mono text-[22px] tracking-[.12em] text-center uppercase text-ink-1 placeholder-ink-5 focus:outline-none ${
            error
              ? 'shadow-[inset_0_0_0_2px_rgb(var(--danger-rgb))]'
              : 'focus:shadow-[inset_0_0_0_2px_rgb(var(--accent-rgb))]'
          }`}
        />
        <div className="mt-auto md:mt-0">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            disabled={checking}
            data-testid="join-event-button"
          >
            {checking ? 'Checking…' : 'Continue'}
          </Button>
        </div>
      </form>
    </AuthFrame>
  )
}

export default JamCodePage
