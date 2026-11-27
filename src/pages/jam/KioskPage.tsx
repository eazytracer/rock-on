/**
 * The counter iPad (`/kiosk`; Jam Venue 1–3): full screen, dark, outside the
 * layout, and never signed in as the host. It pairs onto a jam-scoped kiosk
 * token: from the host's QR (`#k=<token>&e=<jam>`, read once and stripped
 * from the URL) or by typing the one-time pairing code (pair_kiosk). Then a
 * 4-digit exit PIN, kept in this tab's sessionStorage only. Each walk-up:
 * first name + parts → raise a hand on a song that needs them, request one,
 * or just add the name (add_walkup) → a thank-you that clears itself. Exit:
 * hold the logo 3 s, then the PIN. A dead token (jam ended) clears the kiosk.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Hand, Plus } from 'lucide-react'
import { useToast } from '../../contexts/ToastContext'
import {
  kioskSession,
  normalizeCode,
  partName,
  useJamAction,
  useJamState,
  type JamItem,
  type KioskSession,
} from '../../hooks/useJam'
import * as jams from '../../services/api/jams'
import type { JamState, Part } from '../../services/api/jams'
import { ApiError, errorText } from '../../services/api/errors'
import { Button } from '../../components/ui'
import { PartPicker } from '../../components/jams/guest/PartPicker'
import { LiveMark } from '../../components/jams/guest/JamHeader'
import {
  neededParts,
  partsText,
  samePart,
} from '../../components/jams/guest/parts'
import { useDarkTheme } from '../../components/jams/guest/useDarkTheme'
import { useWakeLock } from '../../hooks/useWakeLock'
import { useBrandAccent } from '../auth/AuthFrame'

const PIN_KEY = 'rockon.kiosk.pin'
const HOLD_MS = 3_000
const CLEAR_S = 8
const TITLE_MAX = 80

const pin = {
  get: () => {
    try {
      return sessionStorage.getItem(PIN_KEY)
    } catch {
      return null
    }
  },
  set: (p: string) => {
    try {
      sessionStorage.setItem(PIN_KEY, p)
    } catch {
      /* private mode: the PIN lasts as long as the page */
    }
  },
  clear: () => {
    try {
      sessionStorage.removeItem(PIN_KEY)
    } catch {
      /* nothing stored */
    }
  },
}

/** The QR's hash, once: store the session and take the token out of the URL. */
function sessionFromHash(): KioskSession | null {
  const hash = new URLSearchParams(window.location.hash.slice(1))
  const token = hash.get('k')
  const eventId = hash.get('e')
  if (window.location.hash) {
    window.history.replaceState(null, '', window.location.pathname)
  }
  if (token && eventId) {
    const s = { eventId, token, code: '' }
    kioskSession.clear()
    pin.clear()
    kioskSession.set(s)
    return s
  }
  return kioskSession.get()
}

const label =
  'block font-mono text-[13px] tracking-[.12em] uppercase text-ink-3 mb-2.5'
const bigField =
  'w-full h-[72px] px-5 rounded-[22px] bg-bg-3 text-[28px] font-semibold text-ink-1 outline-none placeholder:text-ink-4 focus:shadow-[inset_0_0_0_3px_rgb(var(--accent-rgb))]'

const Frame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    data-testid="kiosk-page"
    style={useBrandAccent()}
    className="fixed inset-0 overflow-y-auto custom-scrollbar bg-bg-0 text-ink-1 select-none"
  >
    {children}
  </div>
)

export const KioskPage: React.FC = () => {
  useDarkTheme()
  useWakeLock()
  const [session, setSession] = useState<KioskSession | null>(sessionFromHash)
  const [hasPin, setHasPin] = useState(() => !!pin.get())
  const [ended, setEnded] = useState(false)

  // No way out by Back: the kiosk stays on its screen.
  useEffect(() => {
    window.history.pushState(null, '', window.location.href)
    const stay = () => window.history.pushState(null, '', window.location.href)
    window.addEventListener('popstate', stay)
    return () => window.removeEventListener('popstate', stay)
  }, [])

  const clear = () => {
    kioskSession.clear()
    pin.clear()
    setSession(null)
    setHasPin(false)
  }

  if (ended) {
    return (
      <Frame>
        <div
          className="min-h-full grid place-items-center text-center px-10"
          data-testid="kiosk-ended"
        >
          <div className="flex flex-col items-center gap-6">
            <h1 className="font-display font-black uppercase text-[64px] leading-[.9]">
              This jam has ended
            </h1>
            <p className="text-[22px] text-ink-2">Thanks for playing.</p>
            <Button
              size="lg"
              onClick={() => setEnded(false)}
              data-testid="kiosk-pair-again"
            >
              Pair with another jam
            </Button>
          </div>
        </div>
      </Frame>
    )
  }
  if (!session)
    return (
      <Pairing
        onPaired={s => {
          kioskSession.set(s)
          setSession(s)
        }}
      />
    )
  if (!hasPin)
    return (
      <SetPin
        onSet={p => {
          pin.set(p)
          setHasPin(true)
        }}
      />
    )
  return (
    <KioskLive
      session={session}
      onExit={clear}
      onEnded={() => {
        clear()
        setEnded(true)
      }}
    />
  )
}

// ── Pairing ──────────────────────────────────────────────────────────────────
const Pairing: React.FC<{ onPaired: (s: KioskSession) => void }> = ({
  onPaired,
}) => {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const clean = normalizeCode(code).slice(0, 6)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (clean.length < 6) return
    setBusy(true)
    setError(null)
    try {
      const r = await jams.pairKiosk(clean)
      onPaired({ eventId: r.event_id, code: r.short_code, token: r.token })
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }
  return (
    <Frame>
      <form
        onSubmit={submit}
        noValidate
        className="min-h-full flex flex-col items-center justify-center gap-6 px-10 text-center"
        data-testid="kiosk-pairing"
      >
        <img src="/brand/horns-bone.png" alt="Rock On" className="w-20 h-20" />
        <h1 className="font-display font-black uppercase text-[60px] leading-[.9]">
          Counter iPad
        </h1>
        <p className="text-[20px] text-ink-2 max-w-[560px]">
          On the host's phone: the jam's ⋯ menu → Counter iPad. Scan the QR with
          this iPad's camera, or type the code it shows.
        </p>
        <label htmlFor="kiosk-pairing-code" className="sr-only">
          Pairing code
        </label>
        <input
          id="kiosk-pairing-code"
          name="pairingCode"
          data-testid="kiosk-pairing-input"
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          value={clean}
          onChange={e => {
            setCode(e.target.value)
            setError(null)
          }}
          placeholder="ABC123"
          className="w-[360px] h-20 rounded-[24px] bg-bg-3 text-center font-mono text-[40px] tracking-[.3em] uppercase text-ink-1 outline-none placeholder:text-ink-5 focus:shadow-[inset_0_0_0_3px_rgb(var(--accent-rgb))]"
        />
        {error && (
          <p
            role="alert"
            className="text-[18px] text-danger"
            data-testid="kiosk-pairing-error"
          >
            {error}
          </p>
        )}
        <Button
          type="submit"
          variant="primary"
          size="xl"
          disabled={clean.length < 6 || busy}
          className="min-w-[360px] !h-[72px] !text-[22px]"
          data-testid="kiosk-pairing-submit"
        >
          {busy ? 'Pairing…' : 'Pair'}
        </Button>
      </form>
    </Frame>
  )
}

// ── PIN ──────────────────────────────────────────────────────────────────────
const PinPad: React.FC<{
  value: string
  onChange: (v: string) => void
  testid: string
}> = ({ value, onChange, testid }) => (
  <div className="flex flex-col items-center gap-5" data-testid={testid}>
    <div className="flex gap-4" aria-label={`${value.length} of 4 digits`}>
      {[0, 1, 2, 3].map(i => (
        <i
          key={i}
          className={`w-6 h-6 rounded-full ${i < value.length ? 'bg-ink-1' : 'shadow-[inset_0_0_0_2px_rgb(var(--border-1-rgb))]'}`}
        />
      ))}
    </div>
    <div className="grid grid-cols-3 gap-3">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map(
        (k, i) =>
          k === '' ? (
            <span key={i} />
          ) : (
            <button
              key={k}
              type="button"
              onClick={() =>
                onChange(
                  k === '⌫' ? value.slice(0, -1) : (value + k).slice(0, 4)
                )
              }
              className="w-[84px] h-[84px] rounded-full bg-bg-3 text-[32px] font-bold text-ink-1 active:bg-bg-4"
              data-testid={`${testid}-key-${k === '⌫' ? 'back' : k}`}
            >
              {k}
            </button>
          )
      )}
    </div>
  </div>
)

const SetPin: React.FC<{ onSet: (p: string) => void }> = ({ onSet }) => {
  const [first, setFirst] = useState<string | null>(null)
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)
  useEffect(() => {
    if (value.length < 4) return
    if (first === null) {
      setFirst(value)
      setValue('')
    } else if (value === first) {
      onSet(value)
    } else {
      setError(true)
      setFirst(null)
      setValue('')
    }
  }, [value, first, onSet])
  return (
    <Frame>
      <div
        className="min-h-full flex flex-col items-center justify-center gap-5 px-10 text-center"
        data-testid="kiosk-set-pin"
      >
        <h1 className="font-display font-black uppercase text-[52px] leading-[.9]">
          {first === null ? 'Set an exit PIN' : 'Once more'}
        </h1>
        <p className="text-[19px] text-ink-2 max-w-[520px]">
          {error
            ? "Those didn't match. Start again."
            : 'Four digits. You need it to leave the kiosk: hold the logo for 3 seconds.'}
        </p>
        <PinPad value={value} onChange={setValue} testid="kiosk-set-pin-pad" />
      </div>
    </Frame>
  )
}

const ExitPin: React.FC<{ onExit: () => void; onCancel: () => void }> = ({
  onExit,
  onCancel,
}) => {
  const [value, setValue] = useState('')
  const [wrong, setWrong] = useState(false)
  useEffect(() => {
    if (value.length < 4) return
    if (value === pin.get()) onExit()
    else {
      setWrong(true)
      setValue('')
    }
  }, [value, onExit])
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/80 grid place-items-center"
      role="dialog"
      aria-modal="true"
      data-testid="kiosk-exit"
    >
      <div className="rounded-[32px] bg-bg-2 p-10 flex flex-col items-center gap-5">
        <b className="text-[26px]">
          {wrong ? 'Wrong PIN. Try again.' : 'Enter the exit PIN'}
        </b>
        <PinPad value={value} onChange={setValue} testid="kiosk-exit-pad" />
        <Button
          variant="text"
          size="lg"
          onClick={onCancel}
          data-testid="kiosk-exit-cancel"
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}

// ── The kiosk ────────────────────────────────────────────────────────────────
type Step =
  | { at: 'start' }
  | { at: 'pick' }
  | { at: 'done'; name: string; song: string | null; part: string | null }

const KioskLive: React.FC<{
  session: KioskSession
  onExit: () => void
  onEnded: () => void
}> = ({ session, onExit, onEnded }) => {
  const state = useJamState(session.eventId, {
    token: session.token,
    kiosk: true,
  })
  const [exiting, setExiting] = useState(false)
  const hold = useRef<ReturnType<typeof setTimeout>>()
  const startHold = () => {
    clearTimeout(hold.current)
    hold.current = setTimeout(() => setExiting(true), HOLD_MS)
  }
  const stopHold = () => clearTimeout(hold.current)
  useEffect(() => () => clearTimeout(hold.current), [])

  const dead =
    (state.error instanceof ApiError && state.error.key === 'forbidden') ||
    state.data?.jam.status === 'completed' ||
    state.data?.jam.status === 'cancelled'
  useEffect(() => {
    if (dead) onEnded()
  }, [dead, onEnded])

  const data = state.data
  useEffect(() => {
    if (data && !session.code)
      kioskSession.set({ ...session, code: data.jam.short_code })
  }, [data, session])

  return (
    <Frame>
      <div className="flex items-center gap-4 px-8 h-[84px]">
        <button
          type="button"
          aria-label="Hold for 3 seconds to exit"
          onPointerDown={startHold}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          onContextMenu={e => e.preventDefault()}
          className="shrink-0 touch-none"
          data-testid="kiosk-logo"
        >
          <img
            src="/brand/horns-bone.png"
            alt=""
            draggable={false}
            className="w-12 h-12"
          />
        </button>
        <span
          className="font-display font-extrabold uppercase text-[30px] truncate"
          data-testid="kiosk-jam-name"
        >
          {data?.jam.name ?? ''}
        </span>
        {data?.jam.status === 'live' && <LiveMark />}
        {data?.jam.venue && (
          <span className="font-mono text-[13px] tracking-[.1em] uppercase text-ink-3 truncate">
            {data.jam.venue}
          </span>
        )}
        <span className="ml-auto font-mono text-[11px] tracking-[.12em] uppercase text-ink-4">
          Hold logo 3s to exit
        </span>
      </div>
      {data ? (
        <KioskFlow state={data} token={session.token} onDead={onEnded} />
      ) : (
        <div className="mx-8 h-[520px] rounded-[32px] bg-bg-2 animate-pulse" />
      )}
      {exiting && (
        <ExitPin onExit={onExit} onCancel={() => setExiting(false)} />
      )}
    </Frame>
  )
}

const OPEN = new Set(['open', 'queued'])

const KioskFlow: React.FC<{
  state: JamState
  token: string
  onDead: () => void
}> = ({ state, token, onDead }) => {
  const { showToast } = useToast()
  const [step, setStep] = useState<Step>({ at: 'start' })
  const [name, setName] = useState('')
  const [parts, setParts] = useState<Part[]>([])
  const [itemId, setItemId] = useState<string | null>(null)
  const [requesting, setRequesting] = useState(false)
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')

  const byId = useMemo(
    () => new Map(state.items.map(i => [i.id, i])),
    [state.items]
  )
  const stage = state.stage ? byId.get(state.stage) : undefined
  const upNext = state.up_next ? byId.get(state.up_next) : undefined
  const open = state.items.filter(i => OPEN.has(i.state))
  const gaps = (i: JamItem) => i.slots.filter(s => s.gap)
  const onePlayerAway = open.filter(i => gaps(i).length === 1).slice(0, 3)
  const fits = (i: JamItem) =>
    neededParts(i).filter(p => parts.some(m => samePart(m, p)))
  const fitting = open
    .filter(i => fits(i).length > 0)
    .sort(
      (a, b) =>
        Number(!gaps(b).some(g => fits(b).some(p => samePart(p, g)))) -
          Number(!gaps(a).some(g => fits(a).some(p => samePart(p, g)))) ||
        a.position - b.position
    )

  const reset = () => {
    setStep({ at: 'start' })
    setName('')
    setParts([])
    setItemId(null)
    setRequesting(false)
    setTitle('')
    setArtist('')
  }

  const add = useJamAction(() =>
    jams.addWalkup(
      state.jam.id,
      {
        name: name.trim(),
        parts,
        via: 'kiosk',
        itemId: requesting ? undefined : (itemId ?? undefined),
        pitchTitle: requesting ? title.trim() : undefined,
        pitchArtist: requesting ? artist.trim() || undefined : undefined,
      },
      token
    )
  )
  const done = () =>
    add.mutate(undefined, {
      onSuccess: () => {
        const item = itemId ? byId.get(itemId) : undefined
        const part = item ? fits(item)[0] : undefined
        setStep({
          at: 'done',
          name: name.trim(),
          song: requesting ? title.trim() : (item?.title ?? null),
          part: requesting ? null : part ? partName(part) : null,
        })
      },
      onError: err => {
        if (err instanceof ApiError && err.key === 'forbidden') onDead()
        else showToast(errorText(err), 'error')
      },
    })

  // The thank-you clears itself.
  const [left, setLeft] = useState(CLEAR_S)
  useEffect(() => {
    if (step.at !== 'done') return
    setLeft(CLEAR_S)
    const t = setInterval(() => setLeft(n => n - 1), 1000)
    return () => clearInterval(t)
  }, [step.at])
  useEffect(() => {
    if (step.at === 'done' && left <= 0) reset()
  }, [left, step.at])

  if (step.at === 'done') {
    return (
      <div
        className="flex flex-col items-center text-center gap-5 px-10 pt-16"
        data-testid="kiosk-done"
      >
        <span className="grid place-items-center w-28 h-28 rounded-full bg-success/20 text-success">
          <Check size={64} />
        </span>
        <h2 className="font-display font-black uppercase text-[72px] leading-[.9]">
          You're on, {step.name}.
        </h2>
        <p className="text-[24px] text-ink-2 max-w-[640px]">
          {step.song
            ? requesting || !step.part
              ? `We've sent ${step.song} to the host. `
              : `Hand up for ${step.song} on ${step.part.toLowerCase()}. `
            : 'The host has your name. '}
          Watch the screen, or the host will call your name.
        </p>
        <span className="font-mono text-[14px] tracking-[.12em] uppercase text-ink-3">
          Clearing for the next person in {Math.max(left, 0)}s
        </span>
        <Button size="lg" onClick={reset} data-testid="kiosk-add-another">
          Add another
        </Button>
      </div>
    )
  }

  const nowPlaying = (stage || upNext) && (
    <div
      className="flex flex-col gap-1.5 mb-5 text-[19px]"
      data-testid="kiosk-now"
    >
      {stage && (
        <span data-testid="kiosk-stage">
          <span className="font-mono text-[12px] tracking-[.12em] uppercase text-ink-3 mr-2">
            On stage
          </span>
          <b>{stage.title}</b>
        </span>
      )}
      {upNext && (
        <span data-testid="kiosk-up-next">
          <span className="font-mono text-[12px] tracking-[.12em] uppercase text-ink-3 mr-2">
            Up next
          </span>
          <b>{upNext.title}</b>
        </span>
      )}
    </div>
  )

  const songRow = (i: JamItem, pick?: boolean) => {
    const g = gaps(i)
    const names = i.slots.filter(s => s.cast).map(s => s.cast!.name)
    const on = itemId === i.id && !requesting
    return (
      <div
        key={i.id}
        className="flex items-center gap-4 rounded-[24px] bg-bg-2 px-6 py-4"
        data-testid={`kiosk-song-${i.id}`}
      >
        <div className="flex-1 min-w-0">
          <b className="block text-[24px] truncate">{i.title}</b>
          <small className="text-[16px] text-ink-3 truncate block">
            {[i.artist, names.length ? `${names.join(', ')} in` : null]
              .filter(Boolean)
              .join(' · ')}
          </small>
          {g.length > 0 && (
            <div className="font-mono text-[12px] tracking-[.12em] uppercase text-type-jam mt-1">
              Needs {g.map(s => partName(s, s.nth)).join(', ')}
            </div>
          )}
        </div>
        {pick && (
          <button
            type="button"
            aria-pressed={on}
            onClick={() => {
              setRequesting(false)
              setItemId(on ? null : i.id)
            }}
            className={`shrink-0 inline-flex items-center gap-2 h-16 px-6 rounded-full text-[20px] font-bold ${
              on
                ? 'bg-accent text-on-accent'
                : 'shadow-[inset_0_0_0_2px_rgb(var(--border-1-rgb))]'
            }`}
            data-testid={`kiosk-song-${i.id}-raise`}
          >
            <Hand size={22} />
            {on ? 'Hand up' : 'Raise'}
          </button>
        )}
      </div>
    )
  }

  if (step.at === 'start') {
    return (
      <div
        className="grid grid-cols-[1fr_1.05fr] gap-8 px-8 pb-10"
        data-testid="kiosk-start"
      >
        <div>
          <h2 className="font-display font-black uppercase text-[76px] leading-[.86]">
            Want to <span className="text-accent">play</span>?
          </h2>
          <p className="text-[20px] text-ink-2 mt-3 mb-6">
            Put your name down here. No phone, no account. The host sees it
            straight away.
          </p>
          {nowPlaying}
          <div className="flex flex-col gap-3">
            {onePlayerAway.map(i => songRow(i))}
          </div>
        </div>
        <form
          onSubmit={e => {
            e.preventDefault()
            if (name.trim()) setStep({ at: 'pick' })
          }}
          noValidate
          className="rounded-[32px] bg-bg-2 p-7 flex flex-col gap-5 self-start"
        >
          <div>
            <label htmlFor="kiosk-name" className={label}>
              Your first name
            </label>
            <input
              id="kiosk-name"
              name="walkupName"
              data-testid="kiosk-name-input"
              autoComplete="off"
              maxLength={40}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="First name"
              className={bigField}
            />
          </div>
          <div>
            <span className={label}>You play</span>
            <PartPicker
              value={parts}
              onChange={setParts}
              jamParts={state.jam.default_parts}
              size="xl"
              testid="kiosk-parts"
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            size="xl"
            fullWidth
            disabled={!name.trim()}
            className="!h-[72px] !text-[22px]"
            data-testid="kiosk-next"
          >
            Next
          </Button>
        </form>
      </div>
    )
  }

  return (
    <div
      className="grid grid-cols-[1.3fr_1fr] gap-8 px-8 pb-10"
      data-testid="kiosk-pick"
    >
      <div className="flex flex-col gap-3">
        <span className={label}>
          {name.trim()} · {partsText(parts)} · raise your hand
        </span>
        {fitting.length === 0 && (
          <p className="text-[20px] text-ink-2" data-testid="kiosk-no-songs">
            Nothing on the list needs {parts.length ? 'that' : 'a part'} yet.
            Request a song, or just add your name.
          </p>
        )}
        {fitting.slice(0, 6).map(i => songRow(i, true))}
        {requesting ? (
          <div
            className="rounded-[24px] bg-bg-2 p-5 flex flex-col gap-3"
            data-testid="kiosk-request"
          >
            <label htmlFor="kiosk-request-title" className={label}>
              Song
            </label>
            <input
              id="kiosk-request-title"
              name="pitchTitle"
              data-testid="kiosk-request-title-input"
              autoFocus
              maxLength={TITLE_MAX}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Title"
              className={bigField}
            />
            <label htmlFor="kiosk-request-artist" className="sr-only">
              Artist
            </label>
            <input
              id="kiosk-request-artist"
              name="pitchArtist"
              data-testid="kiosk-request-artist-input"
              maxLength={TITLE_MAX}
              value={artist}
              onChange={e => setArtist(e.target.value)}
              placeholder="Artist (optional)"
              className={bigField}
            />
          </div>
        ) : (
          state.jam.requests_open && (
            <button
              type="button"
              onClick={() => {
                setItemId(null)
                setRequesting(true)
              }}
              className="flex items-center gap-3 h-[72px] px-6 rounded-[24px] text-[20px] font-bold text-ink-2 shadow-[inset_0_0_0_2px_rgb(var(--border-1-rgb))]"
              data-testid="kiosk-request-button"
            >
              <Plus size={24} />
              Request a different song
            </button>
          )
        )}
      </div>
      <div className="rounded-[32px] bg-bg-2 p-7 flex flex-col gap-4 self-start">
        <p className="text-[19px] text-ink-2">
          {requesting
            ? 'The host sees your request with your name.'
            : itemId
              ? 'Your hand goes up on that song.'
              : 'No song picked: the host gets your name and what you play.'}
        </p>
        <Button
          variant="primary"
          size="xl"
          fullWidth
          disabled={add.isPending || (requesting && !title.trim())}
          onClick={done}
          className="!h-[72px] !text-[22px]"
          data-testid="kiosk-done-button"
        >
          {add.isPending ? 'Adding…' : 'Done'}
        </Button>
        <Button
          variant="text"
          size="lg"
          onClick={() => setStep({ at: 'start' })}
          data-testid="kiosk-back"
        >
          Back
        </Button>
      </div>
    </div>
  )
}

export default KioskPage
