/**
 * The tuner (docs/redesign/12 · 2.4; Sound Tools 3; desktop `tuner`). Opens on
 * the link's tuning (a song's, a retune line's) or the last one used; any
 * tuning can be picked (decision 7). Auto-detect follows the nearest string;
 * tapping a string picks it and plays its reference. Chevrons point toward the
 * note: 3 / 2 / 1 per DECISIONS · Tuner arrows, one green each side in tune.
 *
 * A component, not a page, so the practice session can open it as a layer.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Mic,
  MicOff,
  Plus,
  Volume2,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useTunings } from '../../hooks/useTunings'
import { useTuner, type TunerStatus } from '../../hooks/useTuner'
import { useMediaQuery } from '../../hooks/useResponsive'
import { Button, Chip, Segmented, Sheet, Switch, TuningPill } from '../ui'
import { TuningList } from '../tunings/TuningList'
import { TuningEditor } from '../tunings/TuningEditor'
import { centsOff, chevrons, inTune, nearestString } from '../../domain/pitch'
import { noteLetter, noteOctave } from '../../domain/notes'
import { showKey } from '../../domain/format'
import {
  changedStrings,
  forInstrument,
  resolveTuning,
  tunerTunings,
  type Instrument,
  type TunerTuning,
  type TuningRow,
} from '../../domain/tuner'
import { pluck } from '../../services/audio/synth'
import { readTunerMemory, saveTunerMemory } from '../../utils/toolsMemory'

/** A string counts as tuned once it holds in tune this long. */
const HOLD_MS = 300
/** Ignore the mic while a reference note rings. */
const REFERENCE_MS = 1500

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))

/** Red (±50 ¢) → green (in tune). */
const distanceColor = (cents: number | null) => {
  if (cents === null) return 'rgb(var(--ink-3-rgb))'
  if (inTune(cents)) return 'var(--success)'
  const p = Math.round(100 * (1 - Math.min(50, Math.abs(cents)) / 50))
  return `color-mix(in oklch, var(--success) ${p}%, var(--danger))`
}

/** Fold an off-octave reading back onto the string (manual mode). */
const foldCents = (c: number) => c - 1200 * Math.round(c / 1200)

export interface TunerProps {
  /** Starting tuning: id, built-in slug or label (`?tuning=`). */
  tuning?: string
  /** The tuning before; its changed strings show orange (`?prev=`). */
  prev?: string
}

export const Tuner: React.FC<TunerProps> = ({ tuning, prev }) => {
  const desktop = useMediaQuery('(min-width: 1024px)')
  const { currentBandId, currentUser } = useAuth()
  const { builtins, customs } = useTunings()
  const mic = useTuner()
  const [memory] = useState(readTunerMemory)

  // The context's customs only (a band's, or mine in Personal).
  const ctxCustoms = useMemo(
    () =>
      customs.filter(t =>
        currentBandId
          ? t.contextType === 'band' && t.contextId === currentBandId
          : t.contextType === 'personal' && t.contextId === currentUser?.id
      ),
    [customs, currentBandId, currentUser?.id]
  )
  const rows: TuningRow[] = useMemo(
    () => [...builtins, ...ctxCustoms],
    [builtins, ctxCustoms]
  )
  const list = useMemo(() => tunerTunings(ctxCustoms), [ctxCustoms])

  const [instrument, setInstrument] = useState<Instrument>(memory.instrument)
  const [picked, setPicked] = useState<string | null>(null)
  const [auto, setAuto] = useState(memory.auto)
  const [selected, setSelected] = useState(0)
  const [tuned, setTuned] = useState<Set<number>>(() => new Set())
  const [sheet, setSheet] = useState(false)
  const [creating, setCreating] = useState(false)
  const holdStart = useRef<Map<number, number>>(new Map())

  const resolve = useCallback(
    (v: string | null | undefined) => resolveTuning(v, list, rows),
    [list, rows]
  )
  const fallback = list.find(t => t.key === 'standard')!
  const base =
    resolve(picked) ??
    resolve(tuning) ??
    resolve(memory.tuning[instrument]) ??
    fallback
  const current: TunerTuning = forInstrument(base, instrument, list)
  const prevTuning = useMemo(() => {
    const p = resolve(prev)
    return p ? forInstrument(p, instrument, list) : null
  }, [resolve, prev, instrument, list])
  const changed = changedStrings(current, prevTuning)
  const options = list.filter(t => t.instrument === instrument)
  if (!options.some(t => t.key === current.key)) options.unshift(current)
  const pitches = current.pitches
  const count = pitches.length
  const stringNo = (i: number) => count - i

  // Remember the tuning in use; a new tuning starts the count over.
  useEffect(() => {
    saveTunerMemory({
      instrument,
      tuning: { ...readTunerMemory().tuning, [instrument]: current.key },
    })
    setTuned(new Set())
    holdStart.current.clear()
    setSelected(s => Math.min(s, current.pitches.length - 1))
  }, [current.key, instrument, current.pitches.length])

  useEffect(() => saveTunerMemory({ auto }), [auto])

  // Where the reading sits: the nearest string (auto) or the picked one.
  const reading = mic.reading
  let target = selected
  let cents: number | null = null
  if (reading) {
    if (auto) {
      const near = nearestString(reading.hz, pitches)
      if (near) {
        target = near.index
        cents = near.cents
      }
    } else {
      cents = foldCents(centsOff(reading.hz, pitches[selected]))
    }
  }

  useEffect(() => {
    if (auto && reading && target !== selected) setSelected(target)
  }, [auto, reading, target, selected])

  // "N of 6 in tune": a string counts once it holds within ±5 ¢ for ~300 ms.
  useEffect(() => {
    if (cents === null) return
    const now = performance.now()
    const started = holdStart.current.get(target)
    if (inTune(cents)) {
      if (started === undefined) holdStart.current.set(target, now)
      else if (now - started >= HOLD_MS)
        setTuned(t => (t.has(target) ? t : new Set(t).add(target)))
    } else {
      holdStart.current.delete(target)
      if (Math.abs(cents) > 10)
        setTuned(t => {
          if (!t.has(target)) return t
          const n = new Set(t)
          n.delete(target)
          return n
        })
    }
  }, [cents, target])

  const hear = useCallback(
    (i: number) => {
      mic.hold(REFERENCE_MS)
      pluck(pitches[i])
    },
    [mic, pitches]
  )
  const pickString = (i: number) => {
    setSelected(i)
    hear(i)
  }
  const pickTuning = (key: string) => {
    setPicked(key)
    setSheet(false)
  }
  const newTuning = () => {
    setSheet(false)
    setCreating(true)
  }
  // The new tuning comes back picked (decision 11).
  const editor = creating && (
    <TuningEditor
      instrument={instrument}
      onClose={() => setCreating(false)}
      onSaved={t => {
        setCreating(false)
        setInstrument(t.instrument)
        setPicked(t.id)
      }}
    />
  )
  const switchInstrument = (to: Instrument) => {
    if (to === instrument) return
    setPicked(
      to === 'bass'
        ? forInstrument(current, 'bass', list).key
        : (readTunerMemory().tuning.guitar ?? 'standard')
    )
    setInstrument(to)
  }

  // Desktop keys: 1–N string · Space hear · ← → tuning.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (creating) return
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= count) {
        pickString(count - n)
      } else if (e.code === 'Space') {
        e.preventDefault()
        hear(selected)
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault()
        const i = options.findIndex(t => t.key === current.key)
        const step = e.key === 'ArrowRight' ? 1 : options.length - 1
        pickTuning(options[(i + step) % options.length].key)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const midi = pitches[target]
  const lit = cents === null ? 0 : chevrons(cents)
  const ok = cents !== null && lit === 0
  const color = distanceColor(cents)
  const listening = mic.status === 'listening'
  const shown = cents === null ? null : Math.round(cents)
  const statusLine =
    shown === null
      ? listening
        ? auto
          ? 'PLAY A STRING'
          : `PLAY THE ${showKey(noteLetter(midi))} STRING`
        : mic.status === 'starting'
          ? 'STARTING THE MIC…'
          : 'TAP A STRING TO HEAR IT'
      : ok
        ? 'IN TUNE'
        : `${shown < 0 ? 'TUNE UP' : 'TUNE DOWN'} · ${Math.abs(shown)}¢`

  const chev = (side: 'l' | 'r') => {
    const on = ok || (cents !== null && (side === 'l' ? cents < 0 : cents > 0))
    const n = ok ? 1 : on ? lit : 0
    const Icon = side === 'l' ? ChevronRight : ChevronLeft
    return (
      <span
        className={`flex ${side === 'l' ? 'flex-row-reverse' : ''}`}
        data-testid={`tuner-chevrons-${side}`}
        data-lit={n}
        aria-hidden
      >
        {[0, 1, 2].map(i => (
          <Icon
            key={i}
            strokeWidth={3}
            className={`${desktop ? 'w-11 h-11 -mx-1.5' : 'w-8 h-8 -mx-1'} ${i < n ? '' : 'text-border-1'}`}
            style={i < n ? { color } : undefined}
          />
        ))}
      </span>
    )
  }

  const face = (
    <div
      className="flex flex-col items-center w-full max-w-[640px] mx-auto"
      data-testid="tuner-face"
      data-in-tune={ok || undefined}
    >
      <div className="flex items-center justify-center gap-2 md:gap-6">
        {chev('l')}
        <div
          className="flex items-end min-w-[140px] md:min-w-[220px] justify-center"
          data-testid="tuner-note"
          data-note={noteLetter(midi)}
        >
          <b
            className={`font-display font-black leading-[.8] ${desktop ? 'text-[220px]' : 'text-[128px]'}`}
            style={{ color: cents === null ? 'rgb(var(--ink-1-rgb))' : color }}
          >
            <NoteName note={noteLetter(midi)} />
          </b>
          <small className="font-mono text-[22px] text-ink-3 ml-1 mb-1">
            {noteOctave(midi)}
          </small>
        </div>
        {chev('r')}
      </div>

      <div className="relative w-full h-14 mt-3 md:mt-5" aria-hidden>
        <span className="absolute top-[18px] h-[26px] left-[45%] w-[10%] rounded-md bg-success/15" />
        <div className="absolute inset-x-0 top-5 flex justify-between items-start">
          {Array.from({ length: 21 }, (_, i) => (
            <i
              key={i}
              className={
                i === 10
                  ? 'w-1 h-[34px] -mt-2.5 bg-success'
                  : i % 5 === 0
                    ? 'w-0.5 h-[22px] -mt-1 bg-ink-4'
                    : 'w-0.5 h-3.5 bg-border-1'
              }
            />
          ))}
        </div>
        <span
          className="absolute top-1 w-1.5 h-12 rounded-full -translate-x-1/2 transition-[left] duration-300 ease-rock"
          style={{
            left: `${50 + Math.max(-50, Math.min(50, cents ?? 0))}%`,
            background:
              cents === null
                ? 'rgb(var(--ink-4-rgb))'
                : ok
                  ? color
                  : 'rgb(var(--ink-1-rgb))',
          }}
          data-testid="tuner-needle"
        />
      </div>
      <div className="w-full flex justify-between font-mono text-[10px] text-ink-4 -mt-1">
        <span>−50</span>
        <span>−25</span>
        <span>0</span>
        <span>+25</span>
        <span>+50</span>
      </div>
      <p
        className="mt-3 font-mono text-[15px] tracking-[.14em]"
        style={{ color: cents === null ? 'rgb(var(--ink-3-rgb))' : color }}
        data-testid="tuner-cents"
        data-cents={shown ?? undefined}
      >
        {statusLine}
      </p>
    </div>
  )

  const changedAny = changed.some(Boolean)
  const countLine = (
    <p
      className="font-mono text-[11.5px] text-ink-3 tracking-[.04em]"
      data-testid="tuner-in-tune-count"
    >
      <span className={tuned.size === count ? 'text-success' : 'text-ink-1'}>
        {tuned.size} of {count}
      </span>{' '}
      in tune
      {changedAny && prevTuning && (
        <>
          {' · '}
          <span className="text-accent">orange</span> = changed from{' '}
          {prevTuning.label}
        </>
      )}
    </p>
  )

  const strings = (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
      data-testid="tuner-strings"
    >
      {pitches.map((p, i) => {
        const on = i === selected
        return (
          <button
            key={i}
            type="button"
            onClick={() => pickString(i)}
            aria-pressed={on}
            aria-label={`String ${stringNo(i)}, ${noteLetter(p)}${noteOctave(p)}`}
            className={`relative flex flex-col items-center justify-center h-[72px] rounded-2xl transition-colors ${
              on ? 'bg-ink-1 text-bg-1' : 'bg-bg-3 text-ink-1 hover:bg-bg-4'
            }`}
            data-testid={`tuner-string-${stringNo(i)}`}
            data-changed={changed[i] || undefined}
            data-tuned={tuned.has(i) || undefined}
          >
            <b
              className={`font-display font-extrabold text-[28px] leading-none ${
                changed[i] ? 'text-accent' : ''
              }`}
            >
              <NoteName note={noteLetter(p)} />
            </b>
            <small
              className={`font-mono text-[10px] mt-1 ${on ? 'text-bg-1/70' : 'text-ink-3'}`}
            >
              {desktop || count > 6
                ? stringNo(i)
                : `${stringNo(i)} · ${noteLetter(p)}${noteOctave(p)}`}
            </small>
            {tuned.has(i) && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-success" />
            )}
          </button>
        )
      })}
    </div>
  )

  const hearButton = (
    <Button
      size="lg"
      fullWidth
      icon={<Volume2 size={18} />}
      onClick={() => hear(selected)}
      data-testid="tuner-hear"
    >
      Hear {showKey(noteLetter(pitches[selected]))}
    </Button>
  )

  const micButton = listening ? (
    <Button
      size="lg"
      fullWidth
      icon={<MicOff size={18} />}
      onClick={mic.stop}
      data-testid="tuner-stop"
    >
      Stop listening
    </Button>
  ) : (
    <Button
      variant="primary"
      size="lg"
      fullWidth
      icon={<Mic size={18} />}
      onClick={() => void mic.start()}
      disabled={mic.status === 'starting'}
      data-testid="tuner-start"
    >
      {mic.status === 'denied' || mic.status === 'error'
        ? 'Try the mic again'
        : 'Start tuner'}
    </Button>
  )

  const autoRow = (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <b className="block text-[14.5px] text-ink-1">Auto-detect string</b>
        <small className="text-[12.5px] text-ink-3">
          Follows whichever string you play
        </small>
      </div>
      <Switch
        checked={auto}
        onChange={setAuto}
        label="Auto-detect string"
        data-testid="tuner-auto-switch"
      />
    </div>
  )

  const instrumentSwitch = (
    <Segmented
      label="Instrument"
      options={[
        { value: 'guitar', label: 'Guitar' },
        { value: 'bass', label: 'Bass' },
      ]}
      value={instrument}
      onChange={switchInstrument}
      data-testid="tuner-instrument"
    />
  )

  const pill = (t: TunerTuning) => (
    <TuningPill tuning={t.builtin ? t.key : t.name} color={t.color} size="lg" />
  )

  if (desktop)
    return (
      <div
        className="grid grid-cols-[minmax(0,1fr)_340px] gap-6 min-h-[calc(100vh-180px)]"
        data-testid="tuner"
      >
        <div className="flex flex-col items-center justify-center gap-6 rounded-[24px] bg-bg-2/40 px-8 py-10">
          {face}
          <MicState status={mic.status} />
        </div>
        <aside className="flex flex-col gap-3 rounded-[24px] bg-bg-2 p-5">
          {instrumentSwitch}
          <h3 className={PANEL_LABEL}>Tuning</h3>
          <div
            className="flex flex-wrap gap-1.5"
            data-testid="tuner-tuning-picker"
          >
            {options.map(t => (
              <Chip
                key={t.key}
                on={t.key === current.key}
                onClick={() => pickTuning(t.key)}
                className="h-9"
                data-testid={`tuner-tuning-${t.key}`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: t.color }}
                />
                {t.label}
              </Chip>
            ))}
            <Chip
              onClick={newTuning}
              className="h-9"
              data-testid="tuner-tuning-custom"
            >
              <Plus size={14} /> Custom
            </Chip>
          </div>
          <h3 className={PANEL_LABEL}>Strings · low to high</h3>
          {strings}
          {countLine}
          {hearButton}
          {micButton}
          <div className="border-t border-divider pt-3 mt-1">{autoRow}</div>
          <p className="mt-auto font-mono text-[10.5px] tracking-[.06em] leading-relaxed text-ink-3 uppercase">
            Keys · 1–{count} string · Space hear · ← → tuning
          </p>
        </aside>
        {editor}
      </div>
    )

  return (
    <div className="flex flex-col gap-3.5" data-testid="tuner">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSheet(true)}
          className="flex items-center gap-1.5 h-11 pl-2 pr-3 rounded-full bg-bg-2 min-w-0"
          aria-label={`Tuning: ${current.name}. Change`}
          data-testid="tuner-tuning-picker"
        >
          {pill(current)}
          <ChevronDown size={16} className="text-ink-3 shrink-0" />
        </button>
        <div className="ml-auto w-[150px]">{instrumentSwitch}</div>
      </div>
      <div className="pt-2">{face}</div>
      {countLine}
      {strings}
      <div className="rounded-[18px] bg-bg-2 px-4 py-3">{autoRow}</div>
      <MicState status={mic.status} />
      <div className="grid grid-cols-2 gap-2">
        {hearButton}
        {micButton}
      </div>
      {sheet && (
        <Sheet
          onClose={() => setSheet(false)}
          title="Tuning"
          sub={instrument === 'bass' ? 'Bass' : 'Guitar'}
          data-testid="tuner-tuning-sheet"
        >
          <div className="pb-3">
            <TuningList
              items={options}
              value={current.key}
              onPick={pickTuning}
              data-testid="tuner-tuning-list"
            />
            <button
              type="button"
              onClick={newTuning}
              className="w-full flex items-center gap-3 min-h-[48px] px-2.5 rounded-xl text-left text-[15px] font-semibold text-ink-1 hover:bg-bg-3"
              data-testid="tuner-tuning-new"
            >
              <Plus size={18} className="text-ink-3" /> New tuning…
            </button>
          </div>
        </Sheet>
      )}
      {editor}
    </div>
  )
}

const PANEL_LABEL =
  'font-mono text-[11px] font-medium tracking-[.12em] uppercase text-ink-3 mt-2'

/** The mic states that need words (idle and listening speak through the face). */
const MicState: React.FC<{ status: TunerStatus }> = ({ status }) => {
  const copy: Partial<Record<TunerStatus, [string, string, string]>> = {
    denied: [
      'Microphone is off',
      'Turn it on in your browser settings, then try again. Reference notes still work.',
      'tuner-mic-denied',
    ],
    'no-device': [
      'No microphone found',
      'Plug one in or pick one in your browser settings. Reference notes still work.',
      'tuner-mic-none',
    ],
    insecure: [
      'The tuner needs a secure connection',
      'Open Rock On over https (or on localhost) to use the mic.',
      'tuner-mic-insecure',
    ],
    error: [
      "The mic didn't start",
      'Try again, or check your browser settings.',
      'tuner-mic-error',
    ],
  }
  const c = copy[status]
  if (!c) return null
  return (
    <div
      className="flex items-start gap-3 rounded-[18px] bg-warn/10 shadow-[inset_0_0_0_1.5px_rgb(var(--warn-rgb)/.5)] px-4 py-3 w-full max-w-[520px]"
      role="status"
      data-testid={c[2]}
    >
      <MicOff size={18} className="text-warn mt-0.5 shrink-0" />
      <div>
        <b className="block text-[14.5px] text-ink-1">{c[0]}</b>
        <p className="text-[13px] text-ink-2">{c[1]}</p>
      </div>
    </div>
  )
}

/**
 * A note in the display font with its ♭ / ♯ at half size: the font has no
 * accidentals, so a full-size fallback glyph would crowd the letter.
 */
const NoteName: React.FC<{ note: string }> = ({ note }) => {
  const shown = showKey(note)
  return (
    <>
      {shown.charAt(0)}
      {shown.length > 1 && (
        <span className="text-[.5em] align-top">{shown.slice(1)}</span>
      )}
    </>
  )
}
