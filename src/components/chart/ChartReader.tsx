/**
 * The chart reader (Song Chart 2 + 4, Sound Tools 1; desktop `chart`): a
 * stage screen. Phones: one continuous scroll, big Back / Next that move most
 * of a screen keeping two lines, tap the top / bottom half to page, an orange
 * progress bar, and Controls in a sheet (Key −/+, Size, 🔈 starting note,
 * Chords viewer, Hide chords). Rotated phones and desktop read in two columns
 * that page sideways; desktop adds the toolbar, the "Chords in this song"
 * panel, the pager and Full screen.
 *
 * A component so the practice session can open it as a layer over itself
 * (`layer`: no Edit / Add / Tune, since those would leave the session). Pedal
 * keys: every arrow, PgUp / PgDn and Space page; Esc closes; transpose has no
 * keys (decision 5). Transpose, size and chords on / off are saved per user.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Expand,
  FileText,
  Grid3x3,
  Minimize,
  Music2,
  Pencil,
  SlidersHorizontal,
  Volume2,
  X,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useChart, useSetStartingNote } from '../../hooks/useChart'
import { useChartPrefs } from '../../hooks/useChartPrefs'
import { useLinkedChartCopy } from '../../hooks/useLinkedChartCopy'
import { useMediaQuery } from '../../hooks/useResponsive'
import { useWakeLock } from '../../hooks/useWakeLock'
import {
  BACK_PAGE_KEYS,
  NEXT_PAGE_KEYS,
  useStageKeys,
} from '../../hooks/useStageKeys'
import { Button, Chip, Empty, RetryCard, Sheet, TuningPill } from '../ui'
import { ChartText } from './ChartText'
import { ChordViewer } from './ChordViewer'
import { ChordDiagram } from './ChordDiagram'
import { StartingNoteSheet } from './StartingNoteSheet'
import { SongNotesView } from '../songs/SongNotesView'
import { ForkIcon } from '../setlists/SetlistStats'
import { chordsInOrder, parse } from '../../domain/chordpro'
import { chordShape, showChord } from '../../domain/chords'
import { formatSeconds } from '../../domain/format'
import {
  SIZE_MAX,
  SIZE_MIN,
  SIZE_STEP,
  TRANSPOSE_MAX,
  TRANSPOSE_MIN,
  chartIsEmpty,
  chartKey,
  lineHeightFor,
  noteInKey,
  pageStep,
  readChord,
  transposeKey,
} from '../../domain/chartView'
import { toolsHref } from '../../domain/toolsLink'
import { songTuningParam } from '../../domain/tuner'
import { errorText } from '../../services/api/errors'
import { note as playNote } from '../../services/audio/synth'
import type { Song } from '../../models/Song'
import { createLogger } from '../../utils/logger'
import { tuningShortLabel } from '../../utils/tunings'

const log = createLogger('ChartReader')

/** Column gap for the paged two-column layouts (px). */
const COL_GAP = 48
/** Room the phone pager takes over the text (px). */
const PAGER_COVER = 132
const HOLD_MS = 450

export interface ChartReaderProps {
  song: Song
  /** × on phones and in a layer; Back on the desktop page. */
  onClose: () => void
  /** Desktop page Back label ("Song"). */
  closeLabel?: string
  /** Opened over the practice session. */
  layer?: boolean
  /** The song page's `?from=…`, carried onto the editor link. */
  linkSearch?: string
  'data-testid'?: string
}

type StartSheet = { at: { x: number; y: number } | null } | null

export const ChartReader: React.FC<ChartReaderProps> = ({
  song,
  onClose,
  closeLabel = 'Song',
  layer = false,
  linkSearch = '',
  'data-testid': testId = 'chart-page',
}) => {
  const { currentUser } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const isBand = song.contextType === 'band'
  const bandId = isBand ? song.contextId : ''
  const { chart, loading, error, refetch } = useChart(song.id, bandId)
  const prefs = useChartPrefs(song.id)
  const { setStartingNote } = useSetStartingNote(song.id)
  const desktop = useMediaQuery('(min-width: 1024px)')
  const landscape = useMediaQuery(
    '(orientation: landscape) and (max-height: 520px)'
  )
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const columns = desktop || landscape

  const [controls, setControls] = useState(false)
  const [notes, setNotes] = useState(false)
  const [start, setStart] = useState<StartSheet>(null)
  const [viewer, setViewer] = useState<number | null>(null)
  const [progress, setProgress] = useState({ p: 0, start: true, end: true })
  const [fullscreen, setFullscreen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  // Two-column layouts: the multi-column box inside the scroller, and how
  // many full pages it fills (the last page is padded out so it can be reached).
  const colRef = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState({ count: 1, step: 0 })
  const target = useRef<number | null>(null)
  const targetTimer = useRef<number>()

  useWakeLock()

  const text = chart?.chordpro ?? ''
  const parsed = useMemo(() => parse(text), [text])
  const hasChart = !!text.trim() && !chartIsEmpty(parsed)
  const copy = useLinkedChartCopy(song, loading || hasChart)
  const written = useMemo(() => chordsInOrder(parsed), [parsed])
  const key = chartKey(song.key, written)
  const n = prefs.transpose
  const readKey = key ? transposeKey(key, n) : null
  const chords = useMemo(
    () => [...new Set(written.map(c => readChord(c, n, key)))],
    [written, n, key]
  )
  const startNote = chart?.startingNote ?? null
  const size = prefs.size
  const editHref = `/songs/${song.id}/chart/edit${linkSearch}`

  // ── paging ────────────────────────────────────────────────────────────────
  const measure = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    let max = el.scrollHeight - el.clientHeight
    if (columns) {
      const step = el.clientWidth + COL_GAP
      const w = colRef.current?.scrollWidth ?? el.clientWidth
      const count = Math.max(1, Math.ceil((w + COL_GAP) / step - 0.01))
      setPages(p =>
        p.count === count && p.step === step ? p : { count, step }
      )
      max = (count - 1) * step
    }
    const pos = columns ? el.scrollLeft : el.scrollTop
    setProgress({
      p: max > 0 ? Math.min(1, pos / max) : 0,
      start: pos < 2,
      end: pos >= max - 2,
    })
  }, [columns])

  useEffect(() => {
    measure()
    const el = scrollRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure, size, prefs.chords, text, hasChart])

  const page = useCallback(
    (dir: 1 | -1) => {
      const el = scrollRef.current
      if (!el) return
      const behavior: ScrollBehavior = reduced ? 'auto' : 'smooth'
      if (columns) {
        // Count from the page a smooth scroll is heading to, so quick presses
        // add up instead of rounding back to where the animation is now.
        const step = el.clientWidth + COL_GAP
        const at = target.current ?? Math.round(el.scrollLeft / step)
        const to = Math.max(0, Math.min(pages.count - 1, at + dir))
        target.current = to
        window.clearTimeout(targetTimer.current)
        targetTimer.current = window.setTimeout(() => {
          target.current = null
        }, 700)
        el.scrollTo({ left: to * step, behavior })
      } else {
        const visible = el.clientHeight - PAGER_COVER
        el.scrollBy({
          top: dir * pageStep(visible, lineHeightFor(size, prefs.chords)),
          behavior,
        })
      }
    },
    [columns, reduced, size, prefs.chords, pages.count]
  )

  const sheetOpen = controls || notes || !!start || viewer != null
  const keys: Partial<Record<string, () => void>> = {
    Escape: onClose,
    n: () => setNotes(true),
    N: () => setNotes(true),
  }
  NEXT_PAGE_KEYS.forEach(k => (keys[k] = () => page(1)))
  BACK_PAGE_KEYS.forEach(k => (keys[k] = () => page(-1)))
  if (!layer && desktop && hasChart) {
    keys.e = () => navigate(editHref)
    keys.E = keys.e
  }
  useStageKeys(keys, !sheetOpen)

  // ── full screen (desktop, on press only) ──────────────────────────────────
  useEffect(() => {
    const on = () =>
      setFullscreen(document.fullscreenElement === rootRef.current)
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else
      rootRef.current
        ?.requestFullscreen?.()
        .catch(err => log.warn('Full screen refused', err))
  }

  // ── starting note ─────────────────────────────────────────────────────────
  const hold = useRef<{ timer?: number; fired: boolean }>({ fired: false })
  const openStart = (el?: HTMLElement | null) => {
    const r = desktop && el ? el.getBoundingClientRect() : null
    setControls(false)
    setStart({ at: r ? { x: r.left, y: r.bottom + 8 } : null })
  }
  const pickStart = (stored: number) =>
    setStartingNote(stored).catch(err => {
      log.error('Starting note failed', err)
      showToast(errorText(err), 'error')
    })
  const startPill = (
    <button
      type="button"
      title="Tap to hear · hold to change"
      aria-label={
        startNote == null
          ? 'Set the starting note'
          : `Starting note ${noteInKey(startNote + n, readKey)}`
      }
      onPointerDown={e => {
        const el = e.currentTarget
        hold.current.fired = false
        hold.current.timer = window.setTimeout(() => {
          hold.current.fired = true
          openStart(el)
        }, HOLD_MS)
      }}
      onPointerUp={() => window.clearTimeout(hold.current.timer)}
      onPointerLeave={() => window.clearTimeout(hold.current.timer)}
      onPointerCancel={() => window.clearTimeout(hold.current.timer)}
      onContextMenu={e => {
        e.preventDefault()
        openStart(e.currentTarget)
      }}
      onClick={e => {
        if (hold.current.fired) return
        if (startNote == null) openStart(e.currentTarget)
        else playNote(startNote + n)
      }}
      className="h-10 pl-1.5 pr-2.5 rounded-full flex items-center gap-1 font-mono text-[13px] font-bold text-ink-1 hover:bg-bg-4 select-none touch-none"
      data-testid="chart-start-note"
    >
      <Volume2 size={20} className="shrink-0" />
      {startNote == null ? '—' : noteInKey(startNote + n, readKey)}
    </button>
  )

  // ── controls ──────────────────────────────────────────────────────────────
  const stepBtn =
    'w-9 h-10 rounded-full grid place-items-center font-bold text-ink-1 hover:bg-bg-4 active:bg-bg-4 disabled:opacity-35'
  const keyStepper = (
    <div className="flex items-center rounded-full bg-bg-3 h-11 px-0.5">
      <button
        type="button"
        aria-label="Key down"
        className={`${stepBtn} text-[16px]`}
        disabled={n <= TRANSPOSE_MIN}
        onClick={() => prefs.stepTranspose(t => Math.max(TRANSPOSE_MIN, t - 1))}
        data-testid="chart-key-down"
      >
        −
      </button>
      <span
        className="min-w-[40px] px-0.5 flex flex-col items-center leading-[1.1] font-mono font-bold text-[12.5px] text-ink-1"
        data-testid="chart-key-value"
      >
        {readKey ? showChord(readKey) : n ? `${n > 0 ? '+' : ''}${n}` : '—'}
        <small className="text-[8.5px] font-medium tracking-[.08em] text-ink-3">
          KEY{n ? ` ${n > 0 ? '+' : ''}${n}` : ''}
        </small>
      </span>
      <button
        type="button"
        aria-label="Key up"
        className={`${stepBtn} text-[16px]`}
        disabled={n >= TRANSPOSE_MAX}
        onClick={() => prefs.stepTranspose(t => Math.min(TRANSPOSE_MAX, t + 1))}
        data-testid="chart-key-up"
      >
        +
      </button>
    </div>
  )
  const sizeStepper = (
    <div className="flex items-center rounded-full bg-bg-3 h-11 px-0.5">
      <button
        type="button"
        aria-label="Smaller text"
        className={`${stepBtn} text-[13px]`}
        disabled={size <= SIZE_MIN}
        onClick={() => prefs.stepSize(s => Math.max(SIZE_MIN, s - SIZE_STEP))}
        data-testid="chart-size-down"
      >
        A
      </button>
      <span
        className="min-w-[34px] flex flex-col items-center leading-[1.1] font-mono font-bold text-[12.5px] text-ink-1"
        data-testid="chart-size-value"
      >
        {size}
        <small className="text-[8.5px] font-medium tracking-[.08em] text-ink-3">
          SIZE
        </small>
      </span>
      <button
        type="button"
        aria-label="Larger text"
        className={`${stepBtn} text-[19px]`}
        disabled={size >= SIZE_MAX}
        onClick={() => prefs.stepSize(s => Math.min(SIZE_MAX, s + SIZE_STEP))}
        data-testid="chart-size-up"
      >
        A
      </button>
    </div>
  )
  const chordsToggle = (
    <Chip
      on={prefs.chords}
      icon={<Grid3x3 size={18} />}
      onClick={() => prefs.setChords(!prefs.chords)}
      className="h-11"
      data-testid="chart-chords-toggle"
    >
      {prefs.chords ? 'Hide chords' : 'Show chords'}
    </Chip>
  )
  const viewerButton = (
    <button
      type="button"
      aria-label="Chords in this song"
      disabled={!chords.length}
      onClick={() => {
        setControls(false)
        setViewer(0)
      }}
      className="w-11 h-10 rounded-full grid place-items-center text-ink-1 hover:bg-bg-4 disabled:opacity-35"
      data-testid="chart-chords-viewer"
    >
      <Grid3x3 size={22} />
    </button>
  )

  const openChord = (name: string) => {
    const i = chords.indexOf(name)
    setViewer(i < 0 ? 0 : i)
  }

  // ── pieces ────────────────────────────────────────────────────────────────
  const sub = (
    <span className="flex items-center gap-2 mt-0.5 font-mono text-[11px] text-ink-3">
      <TuningPill tuning={song.guitarTuning || 'Standard'} size="sm" />
      {song.duration ? <span>{formatSeconds(song.duration)}</span> : null}
      {landscape && readKey ? <span>KEY {showChord(readKey)}</span> : null}
    </span>
  )
  const roundBtn =
    'grid place-items-center w-11 h-11 rounded-full shrink-0 bg-bg-3 text-ink-1 shadow-[inset_0_0_0_1.5px_rgb(var(--border-1-rgb))]'
  const notesButton = (
    <button
      type="button"
      aria-label="Notes"
      aria-pressed={notes}
      onClick={() => setNotes(true)}
      className={`${roundBtn} ${notes ? '!bg-ink-1 !text-bg-1 !shadow-none' : ''}`}
      data-testid="chart-notes"
    >
      <FileText size={20} />
    </button>
  )
  const controlsButton = (
    <button
      type="button"
      onClick={() => setControls(true)}
      aria-expanded={controls}
      className={`h-11 pl-2.5 pr-3.5 rounded-full flex items-center gap-1.5 font-bold text-[14px] shrink-0 ${
        controls
          ? 'bg-ink-1 text-bg-1'
          : 'bg-bg-3 text-ink-1 shadow-[inset_0_0_0_1.5px_rgb(var(--border-1-rgb))]'
      }`}
      data-testid="chart-controls"
    >
      <SlidersHorizontal size={19} /> Controls
    </button>
  )

  const body = (() => {
    if (loading)
      return (
        <div className="px-5 pt-4 space-y-4" data-testid="chart-loading">
          {[70, 45, 82, 60, 76, 40].map((w, i) => (
            <div key={i} className="space-y-1.5">
              <span
                className="block h-3 rounded bg-bg-3 animate-pulse"
                style={{ width: `${w / 2}%` }}
              />
              <span
                className="block h-5 rounded bg-bg-2 animate-pulse"
                style={{ width: `${w}%` }}
              />
            </div>
          ))}
        </div>
      )
    if (error)
      return (
        <div className="pt-6">
          <RetryCard
            message="Couldn't load the chart."
            onRetry={() => void refetch()}
          />
        </div>
      )
    if (!hasChart)
      return (
        <Empty
          icon={<Music2 size={28} />}
          title="No chords yet"
          why={
            layer
              ? 'Add chords and lyrics from the song page after practice.'
              : 'Paste chords over lyrics, or type the words and tap chords on.'
          }
          action={
            layer ? undefined : (
              <div className="flex flex-col items-center gap-2 mt-2">
                <Link
                  to={editHref}
                  className="h-[52px] px-6 rounded-full bg-accent text-on-accent font-bold flex items-center gap-2"
                  data-testid="chart-add"
                >
                  <Music2 size={18} /> Add chords & lyrics
                </Link>
                {copy.available && (
                  <Button
                    size="lg"
                    disabled={copy.copying}
                    onClick={() => void copy.copy()}
                    data-testid="chart-copy-linked"
                  >
                    Copy {copy.bandName}&apos;s chart
                  </Button>
                )}
              </div>
            )
          }
          data-testid="chart-empty"
        />
      )
    return null
  })()

  const text$ = (
    <ChartText
      chart={parsed}
      transpose={n}
      chartKey={key}
      size={size}
      chords={prefs.chords}
      onChord={openChord}
    />
  )

  const progressBar = (style: string) => (
    <div
      className={`absolute w-[3px] rounded-full bg-bg-3 z-[2] pointer-events-none ${style}`}
      aria-hidden
    >
      <i
        className="absolute inset-x-0 top-0 rounded-full bg-accent transition-[height] duration-300 ease-rock"
        style={{ height: `${Math.round(progress.p * 100)}%` }}
        data-testid="chart-progress"
      />
    </div>
  )

  // Tap the top / bottom half of the text to page (phones).
  const onTapZone = (e: React.MouseEvent<HTMLDivElement>) => {
    if (desktop) return
    if ((e.target as HTMLElement).closest('button, a')) return
    if (window.getSelection()?.toString()) return
    const r = e.currentTarget.getBoundingClientRect()
    page(e.clientY - r.top < r.height / 2 ? -1 : 1)
  }

  const pagerButton = (dir: 1 | -1, className: string) => (
    <button
      type="button"
      onClick={() => page(dir)}
      onMouseDown={e => e.preventDefault()}
      aria-label={dir > 0 ? 'Next page' : 'Previous page'}
      disabled={!hasChart}
      className={`flex flex-col items-center justify-center gap-0.5 font-extrabold select-none transition-transform duration-100 ease-rock active:scale-[.97] ${
        dir > 0 ? 'bg-accent text-on-accent' : 'bg-bg-3 text-ink-1'
      } ${(dir > 0 ? progress.end : progress.start) ? 'opacity-35' : ''} ${className}`}
      data-at-edge={dir > 0 ? progress.end : progress.start}
      data-testid={dir > 0 ? 'chart-next' : 'chart-back'}
    >
      {dir > 0 ? (
        <ChevronDown size={32} strokeWidth={2.4} />
      ) : (
        <ChevronUp size={32} strokeWidth={2.4} />
      )}
      {!desktop && (
        <small className="font-mono text-[10px] font-medium tracking-[.08em] opacity-75">
          {dir > 0 ? 'NEXT' : 'BACK'}
        </small>
      )}
    </button>
  )

  const columnsScroller = (
    inner: string,
    handlers: Pick<
      React.HTMLAttributes<HTMLDivElement>,
      'onClick' | 'onWheel'
    > = {}
  ) => (
    <div
      ref={scrollRef}
      onScroll={measure}
      {...handlers}
      className="relative h-full overflow-x-auto overflow-y-hidden no-scrollbar"
      data-testid="chart-scroll"
    >
      <div
        ref={colRef}
        className={`h-full ${inner}`}
        style={{
          columns: desktop ? '2 260px' : 2,
          columnGap: COL_GAP,
          columnFill: 'auto',
        }}
      >
        {text$}
      </div>
      <span
        aria-hidden
        className="absolute top-0 w-px h-px"
        style={{
          left: Math.max(0, pages.count * pages.step - COL_GAP - 1),
        }}
      />
    </div>
  )

  // ── sheets and overlays ───────────────────────────────────────────────────
  const overlays = (
    <>
      {controls && (
        <Sheet
          onClose={() => setControls(false)}
          title="Controls"
          data-testid="chart-controls-sheet"
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            {keyStepper}
            {sizeStepper}
            <div className="ml-auto flex items-center rounded-full bg-bg-3 h-11 px-0.5">
              {startPill}
              {viewerButton}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2.5">
            {chordsToggle}
            {!layer && (
              <Link
                to={editHref}
                className="ml-auto h-11 px-4 rounded-full bg-bg-3 text-ink-1 font-bold flex items-center gap-2"
                data-testid="chart-edit"
              >
                <Pencil size={16} /> Edit
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={() => setControls(false)}
            className="w-full h-12 mt-2 font-bold text-[15px] text-ink-2"
            data-testid="chart-controls-done"
          >
            Done
          </button>
        </Sheet>
      )}
      {notes && (
        <Sheet onClose={() => setNotes(false)} data-testid="chart-notes-sheet">
          <div className="flex items-center pt-1 pb-1 md:pt-4">
            <b className="flex-1 text-[19px] font-bold text-ink-1">Notes</b>
            <button
              type="button"
              aria-label="Close notes"
              onClick={() => setNotes(false)}
              className="grid place-items-center w-11 h-11 rounded-full bg-bg-3 text-ink-1"
              data-testid="chart-notes-close"
            >
              <X size={18} />
            </button>
          </div>
          <div className="h-[52vh] md:h-auto md:max-h-[60vh] overflow-y-auto custom-scrollbar-thin pt-2 pb-6">
            <SongNotesView
              song={song}
              userId={currentUser?.id ?? ''}
              bandId={bandId}
              size="text-[19px]"
              testIdPrefix="chart"
            />
          </div>
        </Sheet>
      )}
      {start && (
        <StartingNoteSheet
          value={startNote}
          readKey={readKey}
          transpose={n}
          at={start.at}
          onPick={pickStart}
          onClose={() => setStart(null)}
        />
      )}
      {viewer != null && chords.length > 0 && (
        <ChordViewer
          chords={chords}
          index={viewer}
          onIndex={setViewer}
          onClose={() => setViewer(null)}
        />
      )}
    </>
  )

  // ── desktop ───────────────────────────────────────────────────────────────
  if (desktop) {
    const shell = layer
      ? 'fixed inset-0 z-[58]'
      : fullscreen
        ? 'h-screen'
        : '-mx-7 lg:-mx-8 -my-6 h-screen'
    return (
      <div
        ref={rootRef}
        className={`${shell} flex flex-col bg-bg-1 text-ink-1 overscroll-x-none`}
        data-testid={testId}
      >
        <div className="flex items-center gap-2 px-8 pt-5">
          <button
            type="button"
            onClick={onClose}
            className="h-10 pl-2 pr-3.5 rounded-full bg-bg-3 text-ink-1 font-semibold flex items-center gap-1 hover:bg-bg-4"
            data-testid="chart-close"
          >
            {layer ? <X size={18} /> : <ChevronLeft size={19} />}
            {layer ? 'Close' : closeLabel}
          </button>
          <span className="ml-auto" />
          {!layer && hasChart && (
            <Link
              to={editHref}
              title="Edit (E)"
              className="h-10 px-4 rounded-full bg-bg-3 text-ink-1 font-bold flex items-center gap-2 hover:bg-bg-4"
              data-testid="chart-edit"
            >
              <Pencil size={15} /> Edit
            </Link>
          )}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="h-10 px-4 rounded-full bg-bg-3 text-ink-1 font-bold flex items-center gap-2 hover:bg-bg-4"
            data-testid="chart-fullscreen"
          >
            {fullscreen ? <Minimize size={15} /> : <Expand size={15} />}
            {fullscreen ? 'Exit full screen' : 'Full screen'}
          </button>
        </div>
        <div className="px-8 pt-2">
          <p className="font-mono text-[11.5px] tracking-[.14em] uppercase text-ink-3 truncate">
            {[
              song.artist,
              tuningShortLabel(song.guitarTuning),
              formatSeconds(song.duration),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <h1
            className="font-display font-extrabold uppercase leading-[.9] text-[52px] break-words"
            data-testid="chart-title"
          >
            {song.title}
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap px-8 pt-3 pb-3">
          {keyStepper}
          {sizeStepper}
          {chordsToggle}
          <div className="flex items-center rounded-full bg-bg-3 h-11 px-0.5">
            {startPill}
            <button
              type="button"
              onClick={e => openStart(e.currentTarget)}
              className="h-10 px-3 rounded-full text-[13px] font-semibold text-ink-2 hover:bg-bg-4"
              data-testid="chart-start-note-change"
            >
              Starting note
            </button>
          </div>
          <Button
            icon={<FileText size={16} />}
            onClick={() => setNotes(true)}
            data-testid="chart-notes"
          >
            Notes
          </Button>
          {!layer && (
            <Link
              to={toolsHref('tuner', { tuning: songTuningParam(song) })}
              className="h-11 px-[18px] rounded-full bg-bg-3 text-ink-1 font-bold text-sm flex items-center gap-2 hover:bg-bg-4"
              data-testid="chart-tune"
            >
              <ForkIcon size={15} /> Tune
            </Link>
          )}
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_280px] border-t border-divider">
          <div className="relative min-w-0">
            {body ?? (
              <>
                <div className="absolute inset-0 pt-6 pb-6 pl-10 pr-[124px]">
                  {columnsScroller('', {
                    onWheel: e => {
                      if (Math.abs(e.deltaY) > Math.abs(e.deltaX))
                        e.currentTarget.scrollLeft += e.deltaY
                    },
                  })}
                </div>
                <div className="absolute right-5 bottom-5 flex flex-col gap-2.5 z-[3]">
                  {pagerButton(
                    -1,
                    'w-[84px] h-[84px] rounded-[26px] shadow-float'
                  )}
                  {pagerButton(
                    1,
                    'w-[84px] h-[120px] rounded-[26px] shadow-float'
                  )}
                </div>
              </>
            )}
          </div>
          <aside
            className="border-l border-divider bg-bg-2 overflow-y-auto custom-scrollbar-thin p-4"
            data-testid="chart-chords-panel"
          >
            <h3 className="font-mono text-[10.5px] tracking-[.12em] uppercase text-ink-3 font-medium mb-2.5">
              Chords in this song
            </h3>
            {chords.length === 0 ? (
              <p className="text-[13px] text-ink-3">No chords yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {chords.map((c, i) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setViewer(i)}
                    className={`flex flex-col items-center rounded-2xl px-2 pt-2 pb-1 hover:bg-bg-4 ${
                      viewer === i ? 'bg-accent/15' : 'bg-bg-3'
                    }`}
                    data-testid={`chart-panel-chord-${i}`}
                  >
                    <b className="font-mono text-[15px] font-bold text-chord">
                      {showChord(c)}
                    </b>
                    <ChordDiagram
                      shape={chordShape(c)}
                      label={showChord(c)}
                      className="w-[104px]"
                    />
                  </button>
                ))}
              </div>
            )}
          </aside>
        </div>
        <p
          className="px-8 py-2.5 font-mono text-[11px] text-ink-3"
          data-testid="chart-keys-hint"
        >
          <Kbd>Space</Kbd> <Kbd>↓</Kbd> <Kbd>→</Kbd> next · <Kbd>↑</Kbd>{' '}
          <Kbd>←</Kbd> back · <Kbd>N</Kbd> notes
          {!layer && hasChart && (
            <>
              {' '}
              · <Kbd>E</Kbd> edit
            </>
          )}{' '}
          · <Kbd>Esc</Kbd> {layer ? 'close' : 'back'} · pedals page
        </p>
        {overlays}
      </div>
    )
  }

  // ── phones (portrait: one scroll; rotated: two columns) ───────────────────
  const header = (
    <header
      className={`flex items-center gap-2.5 shrink-0 ${
        landscape
          ? 'pt-3.5 pb-1.5'
          : 'px-3.5 pt-[max(10px,env(safe-area-inset-top))] pb-2'
      }`}
    >
      <button
        type="button"
        aria-label={layer ? 'Close chart' : 'Close'}
        onClick={onClose}
        className="grid place-items-center w-11 h-11 rounded-full bg-bg-2 shrink-0"
        data-testid="chart-close"
      >
        <X size={19} />
      </button>
      <div className="flex-1 min-w-0">
        <b
          className="block text-[17px] font-bold truncate"
          data-testid="chart-title"
        >
          {song.title}
        </b>
        {sub}
      </div>
      {notesButton}
      {controlsButton}
    </header>
  )

  return (
    <div
      ref={rootRef}
      className={`fixed inset-0 ${layer ? 'z-[58]' : 'z-[55]'} bg-bg-0 text-ink-1 flex overscroll-none ${
        landscape ? 'flex-row' : 'flex-col'
      }`}
      data-testid={testId}
    >
      {landscape ? (
        <>
          <div className="flex-1 min-w-0 flex flex-col pl-[max(24px,env(safe-area-inset-left))]">
            {header}
            <div className="relative flex-1 min-h-0">
              {body ?? columnsScroller('pb-4', { onClick: onTapZone })}
            </div>
          </div>
          <div className="w-[132px] shrink-0 flex flex-col gap-2.5 py-4 pl-4 pr-[max(16px,env(safe-area-inset-right))] box-content">
            {pagerButton(-1, 'flex-[2] w-full rounded-[30px]')}
            {pagerButton(1, 'flex-[3] w-full rounded-[30px]')}
          </div>
        </>
      ) : (
        <>
          {header}
          <div className="relative flex-1 min-h-0">
            {body ?? (
              <>
                <div
                  ref={scrollRef}
                  onScroll={measure}
                  onClick={onTapZone}
                  className="absolute inset-0 overflow-y-auto no-scrollbar px-5 pt-1.5 pb-[150px]"
                  data-testid="chart-scroll"
                >
                  {text$}
                </div>
                {progressBar('right-1.5 top-1 bottom-[130px]')}
              </>
            )}
            <div className="absolute inset-x-0 bottom-0 z-[3] flex gap-2.5 px-3.5 pt-4 pb-[max(24px,env(safe-area-inset-bottom))] bg-gradient-to-b from-transparent to-bg-0 to-[22%]">
              {pagerButton(-1, 'flex-[2] h-[88px] rounded-[30px]')}
              {pagerButton(1, 'flex-[3] h-[88px] rounded-[30px]')}
            </div>
          </div>
        </>
      )}
      {overlays}
    </div>
  )
}

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="rounded-[5px] bg-bg-3 px-1.5 py-px text-ink-2">
    {children}
  </kbd>
)
