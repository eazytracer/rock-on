/* eslint-disable react-refresh/only-export-components */
/**
 * "Switch to ‹Band›?" (Core Navigation 5–6). Opening something that belongs to
 * another context asks first. The first time explains what switching does;
 * after that it's one line. "Stay here" / "Not now" is the safe default.
 */
import React, { createContext, useCallback, useContext, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { BandMark } from '../components/ui/BandMark'
import { Button } from '../components/ui/Button'

const SEEN_KEY = 'rockon.switchPromptSeen'

export interface SwitchTarget {
  /** null = Personal */
  bandId: string | null
  name: string
  /** Where to go once switched. */
  path: string
  /** What's being opened, for the first-time copy ("This practice"). */
  what?: string
}

interface SwitchPromptValue {
  /** Opens `path`, asking to switch first when it's in another context. */
  openIn: (target: SwitchTarget) => void
}

const SwitchPromptContext = createContext<SwitchPromptValue | undefined>(
  undefined
)

function readSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export const SwitchPromptProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const navigate = useNavigate()
  const { currentBandId, setContext } = useAuth()
  const [pending, setPending] = useState<SwitchTarget | null>(null)
  const [firstTime, setFirstTime] = useState(false)

  const openIn = useCallback(
    (target: SwitchTarget) => {
      if (target.bandId === currentBandId) {
        navigate(target.path)
        return
      }
      setFirstTime(!readSeen())
      setPending(target)
    },
    [currentBandId, navigate]
  )

  const close = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1')
    } catch {
      // storage unavailable: the long copy shows again next time
    }
    setPending(null)
  }

  const confirm = async () => {
    if (!pending) return
    const { bandId, path } = pending
    close()
    await setContext(bandId ?? 'personal')
    // Full load so every page re-scopes to the new context.
    window.location.assign(path)
  }

  return (
    <SwitchPromptContext.Provider value={{ openIn }}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4 bg-[var(--scrim)]"
          onClick={e => e.target === e.currentTarget && close()}
          data-testid="switch-prompt"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="switch-prompt-title"
            className="w-full max-w-sm rounded-[22px] bg-bg-4 p-5 shadow-float"
          >
            {firstTime ? (
              <>
                <h2
                  id="switch-prompt-title"
                  className="text-[19px] font-bold text-ink-1"
                >
                  Switch to {pending.name}?
                </h2>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
                  {pending.what ?? 'This'} belongs to {pending.name}. Switching
                  changes your songs, setlists and calendar to{' '}
                  {pending.bandId ? 'that band' : 'your personal ones'}. You can
                  switch back from the header.
                </p>
                <p className="mt-4 text-[13px] text-ink-3">
                  Shown once. After this it's a one-line prompt.
                </p>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <BandMark
                  name={pending.name}
                  personal={!pending.bandId}
                  size={40}
                />
                <h2
                  id="switch-prompt-title"
                  className="text-[18px] font-bold text-ink-1"
                >
                  Switch to {pending.name}?
                </h2>
              </div>
            )}
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <Button
                variant={firstTime ? 'secondary' : 'text'}
                size="lg"
                onClick={close}
                data-testid="switch-prompt-cancel"
              >
                {firstTime ? 'Stay here' : 'Not now'}
              </Button>
              <Button
                variant="primary"
                size="lg"
                onClick={confirm}
                data-testid="switch-prompt-confirm"
              >
                Switch
              </Button>
            </div>
          </div>
        </div>
      )}
    </SwitchPromptContext.Provider>
  )
}

export function useSwitchPrompt(): SwitchPromptValue {
  const ctx = useContext(SwitchPromptContext)
  if (!ctx)
    throw new Error('useSwitchPrompt must be used within SwitchPromptProvider')
  return ctx
}
