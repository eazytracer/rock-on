/**
 * The metronome (docs/redesign/12 · 2.4; Metronome 1–2; desktop `metro`).
 * Tempo is the hero: ± (hold to repeat), slider, Tap (last 4 taps). Beat
 * squares cycle accent → normal → silent and light in time from a rAF loop
 * reading the audio clock; the clicks themselves are scheduled ahead on that
 * clock (services/audio/metronomeEngine). Flash = an orange edge pulse on
 * beat 1. From a song (`?song=`) it loads the BPM and offers Save to song.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Minus, Music2, Play, Plus, Square } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useSong, useSongFieldSave } from '../../hooks/useSongCatalog'
import { useSongs, usePersonalSongs } from '../../hooks/useSongs'
import { useSetlistIndex } from '../../hooks/useSetlists'
import { useMediaQuery } from '../../hooks/useResponsive'
import { Segmented, Switch } from '../ui'
import {
  BPM_MAX,
  BPM_MIN,
  SIGNATURES,
  addTap,
  clampBpm,
  cycleAccent,
  defaultAccents,
  marking,
  tapTempo,
  type Accent,
  type SigId,
  type Sub,
} from '../../domain/metronome'
import { nextShowSetId } from '../../domain/setlist'
import { MetronomeEngine } from '../../services/audio/metronomeEngine'
import { heardTime, resumeAudio } from '../../services/audio/audioContext'
import {
  readMetronomeMemory,
  saveMetronomeMemory,
} from '../../utils/toolsMemory'

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))

/** Press = one step; hold = repeat (after 400 ms, every 70 ms). */
function useHoldRepeat(step: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fn = useRef(step)
  fn.current = step
  const end = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }, [])
  useEffect(() => end, [end])
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return
      fn.current()
      end()
      const repeat = () => {
        fn.current()
        timer.current = setTimeout(repeat, 70)
      }
      timer.current = setTimeout(repeat, 400)
    },
    onPointerUp: end,
    onPointerLeave: end,
    onPointerCancel: end,
    // Keyboard activation (Enter / Space on the focused button).
    onClick: (e: React.MouseEvent) => {
      if (e.detail === 0) fn.current()
    },
  }
}

export interface MetronomeProps {
  /** `?song=`: load its BPM and offer Save to song. */
  songId?: string
  /** `?bpm=`: start at this tempo. */
  bpm?: number
}

export const Metronome: React.FC<MetronomeProps> = ({
  songId,
  bpm: linkBpm,
}) => {
  const desktop = useMediaQuery('(min-width: 1024px)')
  const [memory] = useState(readMetronomeMemory)
  const { song } = useSong(songId ?? '')
  const saveField = useSongFieldSave(song)

  const [chosen, setChosen] = useState<number | null>(null)
  const [sig, setSig] = useState<SigId>(memory.sig)
  const [sub, setSub] = useState<Sub>(memory.sub)
  const [accents, setAccents] = useState<Accent[]>(() =>
    defaultAccents(memory.sig)
  )
  const [flash, setFlash] = useState(memory.flash)
  const [running, setRunning] = useState(false)
  const [lit, setLit] = useState<number | null>(null)
  const [pulse, setPulse] = useState(false)
  const taps = useRef<number[]>([])
  const engine = useRef<MetronomeEngine | null>(null)
  const raf = useRef(0)

  const songBpm = song?.bpm ? clampBpm(song.bpm) : null
  const bpm = chosen ?? (songId ? songBpm : null) ?? linkBpm ?? memory.bpm
  const setBpm = useCallback((n: number) => setChosen(clampBpm(n)), [])
  const bpmRef = useRef(bpm)
  bpmRef.current = bpm

  // Remember the settings on this device.
  useEffect(
    () => saveMetronomeMemory({ bpm, sig, sub, flash }),
    [bpm, sig, sub, flash]
  )

  // Changes reach the running engine from the next click.
  useEffect(() => {
    engine.current?.update({ bpm, sig, sub, accents })
  }, [bpm, sig, sub, accents])

  const stop = useCallback(() => {
    engine.current?.stop()
    cancelAnimationFrame(raf.current)
    setRunning(false)
    setLit(null)
    setPulse(false)
  }, [])

  const flashRef = useRef(flash)
  flashRef.current = flash

  const start = useCallback(() => {
    const ctx = resumeAudio()
    engine.current ??= new MetronomeEngine(ctx)
    const e = engine.current
    e.start({ bpm: bpmRef.current, sig, sub, accents })
    setRunning(true)
    let shown: number | null = null
    let pulsing = false
    const frame = () => {
      raf.current = requestAnimationFrame(frame)
      const t = heardTime(ctx)
      const c = e.clickBefore(t)
      const beat = c ? c.beat : null
      if (beat !== shown) setLit((shown = beat))
      const p =
        flashRef.current &&
        !!c &&
        c.beat === 0 &&
        c.sub === 0 &&
        c.kind !== 'mute' &&
        t - c.when < 0.1
      if (p !== pulsing) setPulse((pulsing = p))
    }
    raf.current = requestAnimationFrame(frame)
  }, [sig, sub, accents])

  // Leaving the tab (unmount) stops the clicks.
  useEffect(() => stop, [stop])

  const toggle = useCallback(
    () => (running ? stop() : start()),
    [running, start, stop]
  )
  const tap = useCallback(() => {
    taps.current = addTap(taps.current, performance.now())
    const t = tapTempo(taps.current)
    if (t !== null) setBpm(t)
  }, [setBpm])

  const pickSig = (s: SigId) => {
    setSig(s)
    setAccents(defaultAccents(s))
  }

  // Keys: Space start · T tap · ↑ ↓ tempo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.code === 'Space') {
        e.preventDefault()
        toggle()
      } else if (e.key === 't' || e.key === 'T') tap()
      else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        setBpm(bpmRef.current + (e.key === 'ArrowUp' ? 1 : -1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, tap, setBpm])

  const minus = useHoldRepeat(() => setBpm(bpmRef.current - 1))
  const plus = useHoldRepeat(() => setBpm(bpmRef.current + 1))

  const fromSong = song && songId && (
    <div
      className="flex items-center gap-3 rounded-[18px] bg-bg-2 pl-4 pr-2 py-2.5"
      data-testid="metro-from-song"
    >
      <Music2 size={18} className="text-ink-3 shrink-0" />
      <div className="flex-1 min-w-0">
        <small className="block font-mono text-[10px] tracking-[.14em] uppercase text-ink-3">
          From song
        </small>
        <b className="block text-[15px] text-ink-1 truncate">
          {song.title} ·{' '}
          <span className="font-normal text-ink-2">
            {songBpm ? `saved at ${songBpm}` : 'no BPM yet'}
          </span>
        </b>
      </div>
      {bpm !== songBpm && (
        <button
          type="button"
          onClick={() => void saveField('BPM', { bpm })}
          className="h-10 px-4 rounded-full bg-bg-3 text-[14px] font-bold text-ink-1 shrink-0"
          data-testid="metro-save-to-song"
        >
          Save to song
        </button>
      )}
    </div>
  )

  const beats = (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-2 md:gap-3 flex-wrap justify-center">
        {accents.map((a, i) => {
          const on = lit === i
          return (
            <button
              key={i}
              type="button"
              onClick={() =>
                setAccents(list =>
                  list.map((x, j) => (j === i ? cycleAccent(x) : x))
                )
              }
              aria-label={`Beat ${i + 1}: ${a === 'mute' ? 'silent' : a}`}
              className={`grid place-items-center rounded-[18px] md:rounded-[22px] font-mono font-bold text-[18px] transition-[background-color,transform] duration-[60ms] ${
                accents.length > 4
                  ? 'w-[46px] h-[54px] md:w-16 md:h-16'
                  : 'w-[58px] h-[58px] md:w-[76px] md:h-[76px]'
              } ${
                on
                  ? a === 'accent'
                    ? 'bg-accent text-on-accent scale-105'
                    : 'bg-ink-1 text-bg-1 scale-105'
                  : 'bg-bg-2 text-ink-3'
              } ${a === 'accent' && !on ? 'shadow-[inset_0_0_0_3px_rgb(var(--accent-rgb))] text-ink-1' : ''} ${
                a === 'mute' ? 'opacity-30' : ''
              }`}
              data-testid={`metro-beat-${i}`}
              data-accent={a}
              data-lit={on || undefined}
            >
              {i + 1}
            </button>
          )
        })}
      </div>
      <p className="text-[12px] text-ink-3">
        {desktop ? 'Click' : 'Tap'} a beat: accent · normal · silent
      </p>
    </div>
  )

  const stepButton = (
    label: string,
    icon: React.ReactNode,
    handlers: ReturnType<typeof useHoldRepeat>,
    testId: string
  ) => (
    <button
      type="button"
      aria-label={label}
      {...handlers}
      className="grid place-items-center w-14 h-14 md:w-[72px] md:h-[72px] rounded-full bg-bg-2 text-ink-1 touch-none select-none active:scale-95 transition-transform"
      data-testid={testId}
    >
      {icon}
    </button>
  )

  const hero = (
    <div className="flex flex-col items-center w-full">
      <div className="flex items-center justify-center gap-4 md:gap-8">
        {stepButton(
          'Slower',
          <Minus size={24} strokeWidth={2.5} />,
          minus,
          'metro-minus'
        )}
        <div className="text-center min-w-[180px] md:min-w-[260px]">
          <b
            className="block font-display font-black leading-[.8] text-ink-1 text-[108px] md:text-[200px] tabular-nums"
            data-testid="metro-bpm"
          >
            {bpm}
          </b>
          <small className="block mt-2 font-mono text-[12px] tracking-[.16em] text-ink-3">
            BPM · {marking(bpm)}
          </small>
        </div>
        {stepButton(
          'Faster',
          <Plus size={24} strokeWidth={2.5} />,
          plus,
          'metro-plus'
        )}
      </div>
      <label htmlFor="metro-slider" className="sr-only">
        Tempo
      </label>
      <input
        type="range"
        id="metro-slider"
        name="tempo"
        min={BPM_MIN}
        max={BPM_MAX}
        value={bpm}
        onChange={e => setBpm(Number(e.target.value))}
        className="w-full max-w-[560px] mt-4 md:mt-6 accent-accent"
        data-testid="metro-slider"
      />
    </div>
  )

  const sigControl = (
    <Segmented
      label="Time signature"
      options={SIGNATURES.map(s => ({ value: s.id, label: s.id }))}
      value={sig}
      onChange={pickSig}
      data-testid="metro-sig"
    />
  )
  const subControl = (
    <Segmented
      label="Clicks per beat"
      options={(['1', '2', '3', '4'] as const).map(v => ({
        value: v,
        label: v,
      }))}
      value={String(sub) as '1' | '2' | '3' | '4'}
      onChange={v => setSub(Number(v) as Sub)}
      data-testid="metro-sub"
    />
  )
  const flashRow = (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <b className="block text-[14.5px] text-ink-1">Flash on the beat</b>
        <small className="text-[12.5px] text-ink-3">
          Edge pulse on beat 1, for loud rooms
        </small>
      </div>
      <Switch
        checked={flash}
        onChange={setFlash}
        label="Flash on the beat"
        data-testid="metro-flash-switch"
      />
    </div>
  )

  const tapButton = (
    <button
      type="button"
      onClick={tap}
      className="flex flex-col items-center justify-center rounded-[22px] bg-bg-2 text-ink-1 h-[84px] md:h-[72px] active:scale-[.97] transition-transform"
      data-testid="metro-tap"
    >
      <b className="text-[17px]">Tap</b>
      <small className="font-mono text-[10px] tracking-[.12em] uppercase text-ink-3">
        Tempo
      </small>
    </button>
  )
  const startButton = (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={running}
      className={`flex items-center justify-center gap-2.5 rounded-[22px] h-[84px] md:h-[72px] text-[19px] font-extrabold active:scale-[.98] transition-transform ${
        running ? 'bg-bg-3 text-ink-1' : 'bg-accent text-on-accent'
      }`}
      data-testid="metro-start"
    >
      {running ? (
        <Square size={20} fill="currentColor" />
      ) : (
        <Play size={22} fill="currentColor" />
      )}
      {running ? 'Stop' : 'Start'}
    </button>
  )

  const flashEdge = (
    <div
      aria-hidden
      className={`fixed inset-0 z-[70] pointer-events-none shadow-[inset_0_0_0_10px_rgb(var(--accent-rgb))] ${
        pulse ? 'opacity-100' : 'opacity-0 transition-opacity duration-150'
      }`}
      data-testid="metro-flash"
      data-on={pulse || undefined}
    />
  )

  if (desktop)
    return (
      <div
        className="grid grid-cols-[minmax(0,1fr)_340px] gap-6 min-h-[calc(100vh-180px)]"
        data-testid="metronome"
      >
        <div className="flex flex-col items-center justify-center gap-6 rounded-[24px] bg-bg-2/40 px-8 py-10">
          {fromSong && <div className="w-full max-w-[560px]">{fromSong}</div>}
          {beats}
          {hero}
          <div className="grid grid-cols-[140px_1fr] gap-3 w-full max-w-[560px]">
            {tapButton}
            {startButton}
          </div>
        </div>
        <aside className="flex flex-col gap-3 rounded-[24px] bg-bg-2 p-5">
          <h3 className={PANEL_LABEL}>Time</h3>
          {sigControl}
          <h3 className={PANEL_LABEL}>Clicks per beat</h3>
          {subControl}
          <div className="border-t border-divider pt-3 mt-2">{flashRow}</div>
          <SetlistTempos onPick={setBpm} />
          <p className="mt-auto font-mono text-[10.5px] tracking-[.06em] leading-relaxed text-ink-3 uppercase">
            Keys · Space start · T tap · ↑ ↓ tempo
          </p>
        </aside>
        {flashEdge}
      </div>
    )

  return (
    <div className="flex flex-col gap-4" data-testid="metronome">
      {fromSong}
      <div className="pt-1">{beats}</div>
      {hero}
      <div className="rounded-[18px] bg-bg-2 p-3 flex flex-col gap-2">
        <div className="grid grid-cols-[64px_1fr] items-center gap-2">
          <h3 className={`${PANEL_LABEL} mt-0`}>Time</h3>
          {sigControl}
        </div>
        <div className="grid grid-cols-[64px_1fr] items-center gap-2">
          <h3 className={`${PANEL_LABEL} mt-0 leading-tight`}>Clicks / beat</h3>
          {subControl}
        </div>
      </div>
      <div className="rounded-[18px] bg-bg-2 px-4 py-3">{flashRow}</div>
      <div
        className="sticky z-30 grid grid-cols-[110px_1fr] gap-2 mt-1"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 92px)' }}
      >
        {tapButton}
        {startButton}
      </div>
      {flashEdge}
    </div>
  )
}

const PANEL_LABEL =
  'font-mono text-[11px] font-medium tracking-[.12em] uppercase text-ink-3 mt-2'

/** Desktop: "From ‹next setlist›", each song's tempo; click = set it. */
const SetlistTempos: React.FC<{ onPick: (bpm: number) => void }> = ({
  onPick,
}) => {
  const { currentBandId, currentUser } = useAuth()
  const isBand = !!currentBandId
  const contextId = (isBand ? currentBandId : currentUser?.id) ?? ''
  const { rows } = useSetlistIndex(isBand ? 'band' : 'personal', contextId)
  const band = useSongs(isBand ? contextId : '')
  const mine = usePersonalSongs(isBand ? '' : contextId)
  const songs = isBand ? band.songs : mine.songs
  const set = useMemo(() => {
    const id = nextShowSetId(rows, new Date())
    return rows.find(r => r.id === id) ?? null
  }, [rows])
  const tempos = useMemo(() => {
    if (!set) return []
    const bpmOf = new Map(songs.map(s => [s.id, s.bpm]))
    return set.songs.flatMap(s => {
      const b = bpmOf.get(s.id)
      return b ? [{ id: s.id, title: s.title, bpm: clampBpm(b) }] : []
    })
  }, [set, songs])
  if (!set || tempos.length === 0) return null
  return (
    <>
      <h3 className={`${PANEL_LABEL} truncate`}>From {set.name}</h3>
      <div
        className="flex flex-col max-h-[260px] overflow-y-auto custom-scrollbar-thin -mx-1"
        data-testid="metro-setlist"
      >
        {tempos.map((s, i) => (
          <button
            key={`${s.id}-${i}`}
            type="button"
            onClick={() => onPick(s.bpm)}
            className="flex items-center gap-2.5 h-10 px-2.5 rounded-[10px] text-left text-[14px] hover:bg-bg-3"
            data-testid="metro-setlist-song"
          >
            <span className="flex-1 truncate text-ink-1">{s.title}</span>
            <b className="font-mono font-medium text-[13px] text-ink-2">
              {s.bpm}
            </b>
          </button>
        ))}
      </div>
    </>
  )
}
