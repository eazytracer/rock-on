/**
 * Counter iPad (host / co-host): start_kiosk, then a sheet with a QR for
 * `/kiosk#k=<token>&e=<jam>` and the one-time pairing code (10 min) to type
 * in at /kiosk. The iPad runs on that jam-scoped kiosk token, never on the
 * host's login. `variant="item"` for a ⋯ menu; the sheet lives in this
 * component, so keep it mounted while the sheet is open (or render
 * `<KioskSheet>` yourself).
 */
import React, { useEffect, useRef, useState } from 'react'
import { Tablet } from 'lucide-react'
import { Button, RetryCard, Sheet, SheetItem } from '../../ui'
import * as jams from '../../../services/api/jams'
import { errorText } from '../../../services/api/errors'
import { CodeQr } from './CodeQr'
import { kioskLink } from './helpers'

type Started = Awaited<ReturnType<typeof jams.startKiosk>>

export const KioskSheet: React.FC<{ eventId: string; onClose: () => void }> = ({
  eventId,
  onClose,
}) => {
  const [started, setStarted] = useState<Started | null>(null)
  const [error, setError] = useState<unknown>(null)
  const once = useRef(false)

  const start = () => {
    setError(null)
    jams.startKiosk(eventId).then(setStarted, setError)
  }
  useEffect(() => {
    // Once per sheet: each start_kiosk mints a token.
    if (once.current) return
    once.current = true
    jams.startKiosk(eventId).then(setStarted, setError)
  }, [eventId])

  const until = started
    ? new Date(started.expires_at).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      })
    : ''

  return (
    <Sheet
      onClose={onClose}
      title="Counter iPad"
      sub={`Scan this with the iPad's camera, or open ${window.location.host}/kiosk on it and type the code.`}
      data-testid="kiosk-start-sheet"
    >
      {error ? (
        <RetryCard message={errorText(error)} onRetry={start} />
      ) : !started ? (
        <div
          className="h-[260px] rounded-2xl bg-bg-3 animate-pulse"
          aria-busy
        />
      ) : (
        <div className="flex flex-col items-center text-center gap-3 pb-2">
          <CodeQr
            value={kioskLink(started.token, eventId)}
            size={200}
            data-testid="kiosk-start-qr"
          />
          <div className="font-mono text-[10.5px] tracking-[.12em] uppercase text-ink-3">
            Pairing code · until {until}
          </div>
          <div
            className="font-mono text-[34px] font-bold tracking-[.24em] text-ink-1"
            data-testid="kiosk-pairing-code"
          >
            {started.pairing_code}
          </div>
          <p className="text-[13.5px] text-ink-2 max-w-[340px]">
            The iPad asks for a 4-digit PIN before it starts. You'll need it to
            leave the kiosk: hold the logo for 3 seconds.
          </p>
          <p className="text-[13px] text-ink-3 max-w-[340px]">
            To lock the iPad to this screen, turn on Guided Access (Settings →
            Accessibility → Guided Access), then triple-click the side button.
          </p>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={onClose}
            data-testid="kiosk-start-done"
          >
            Done
          </Button>
        </div>
      )}
    </Sheet>
  )
}

export const StartKioskButton: React.FC<{
  eventId: string
  variant?: 'item' | 'button'
}> = ({ eventId, variant = 'button' }) => {
  const [open, setOpen] = useState(false)
  return (
    <>
      {variant === 'item' ? (
        <SheetItem
          icon={<Tablet />}
          label="Counter iPad"
          onClick={() => setOpen(true)}
          data-testid="jam-start-kiosk"
        />
      ) : (
        <Button
          icon={<Tablet size={18} />}
          onClick={() => setOpen(true)}
          data-testid="jam-start-kiosk"
        >
          Counter iPad
        </Button>
      )}
      {open && <KioskSheet eventId={eventId} onClose={() => setOpen(false)} />}
    </>
  )
}

export default StartKioskButton
