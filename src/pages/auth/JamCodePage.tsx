/**
 * Got a jam code? (`/get-started/jam`): a thin code entry over today's event
 * join (decision 3). Phase 7 rebuilds the jam-code path.
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EventService } from '../../services/EventService'
import { useToast } from '../../contexts/ToastContext'
import { createLogger } from '../../utils/logger'
import { Button } from '../../components/ui'
import { AuthError, AuthFrame } from './AuthFrame'

const log = createLogger('JamCodePage')

export const JamCodePage: React.FC = () => {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

  const join = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) {
      setError('Enter the code from the host.')
      return
    }
    setJoining(true)
    setError(null)
    try {
      const result = await EventService.joinByCode(code)
      if (!result.ok || !result.eventId) {
        setError(result.error || "Couldn't join. Try again.")
        setJoining(false)
        return
      }
      showToast(`You joined ${result.name || 'the event'}`, 'success')
      navigate(`/events/${result.eventId}`)
    } catch (err) {
      log.error('Join by code failed', err)
      setError("Couldn't join. Try again.")
      setJoining(false)
    }
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
      lede="Enter the code from the host. You'll land on the jam or event."
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
          placeholder="JAM4567"
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
            disabled={joining}
            data-testid="join-event-button"
          >
            {joining ? 'Joining…' : 'Join'}
          </Button>
        </div>
      </form>
    </AuthFrame>
  )
}

export default JamCodePage
