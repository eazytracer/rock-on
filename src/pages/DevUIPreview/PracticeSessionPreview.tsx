/**
 * PracticeSessionPreview — proposed practice-viewer layouts (TV, tablet
 * landscape, tablet portrait, mobile) with a shared font S/M/L toggle and a
 * unified MetaPill chip used across all viewports for Key / BPM / Duration /
 * Tuning. Tuning is the only accent-colored chip (via the registry).
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Clock,
  Music,
  Activity,
  Guitar,
  Monitor,
  Tablet,
  Smartphone,
  Type,
  Keyboard,
} from 'lucide-react'
import { MOCK_SONGS } from './mockData'
import { tuningColor, tuningLabel } from './tuningColors'

type FontSize = 'sm' | 'md' | 'lg'

const FONT_SIZES: Record<FontSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
}

const FONT_LABELS: Record<FontSize, string> = {
  sm: 'S',
  md: 'M',
  lg: 'L',
}

export const PracticeSessionPreview: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [fontSize, setFontSize] = useState<FontSize>('md')

  const currentSong = MOCK_SONGS[currentIndex]
  const nextSong = MOCK_SONGS[currentIndex + 1] ?? null

  const go = (dir: -1 | 1) => {
    const nxt = currentIndex + dir
    if (nxt >= 0 && nxt < MOCK_SONGS.length) setCurrentIndex(nxt)
  }

  return (
    <div className="space-y-6">
      {/* Global controls */}
      <div className="bg-[#121212] border border-[#2a2a2a] rounded-lg p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Type size={16} className="text-[#707070]" />
          <span className="text-xs text-[#707070] uppercase tracking-wider">
            Font
          </span>
          <div className="flex bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg overflow-hidden">
            {(['sm', 'md', 'lg'] as FontSize[]).map(s => (
              <button
                key={s}
                onClick={() => setFontSize(s)}
                data-testid={`font-size-${s}`}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  fontSize === s
                    ? 'bg-[#f17827ff] text-white'
                    : 'text-[#a0a0a0] hover:text-white'
                }`}
              >
                {FONT_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="h-5 w-px bg-[#2a2a2a]" />

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#707070] uppercase tracking-wider">
            Song
          </span>
          <button
            onClick={() => go(-1)}
            disabled={currentIndex === 0}
            className="p-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-white disabled:opacity-30"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-sm text-white min-w-[80px] text-center">
            {currentIndex + 1} of {MOCK_SONGS.length}
          </span>
          <button
            onClick={() => go(1)}
            disabled={currentIndex === MOCK_SONGS.length - 1}
            className="p-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-white disabled:opacity-30"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="h-5 w-px bg-[#2a2a2a]" />

        <span className="text-xs text-[#707070]">
          Same state across all four layouts below
        </span>
      </div>

      {/* Notes scroll / BT pedal info */}
      <div className="bg-[#121212] border border-[#2a2a2a] rounded-lg p-4 flex items-start gap-3">
        <Keyboard size={18} className="text-[#f17827ff] flex-shrink-0 mt-0.5" />
        <div className="text-sm text-[#a0a0a0] leading-relaxed">
          <span className="text-white font-semibold">Notes scrolling</span> —
          when band notes overflow, large chevron buttons appear on the right
          edge of the panel (sized per viewport). They scroll by ~70% of the
          panel height so context carries over.
          <div className="mt-2 text-xs text-[#707070]">
            <span className="text-[#d4d4d4] font-medium">
              Keyboard &amp; BT foot-pedal shortcuts:
            </span>{' '}
            <kbd className="px-1.5 py-0.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-[10px] mx-0.5">
              PageDown
            </kbd>{' '}
            or{' '}
            <kbd className="px-1.5 py-0.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-[10px] mx-0.5">
              Space
            </kbd>{' '}
            → scroll down.{' '}
            <kbd className="px-1.5 py-0.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-[10px] mx-0.5">
              PageUp
            </kbd>{' '}
            or{' '}
            <kbd className="px-1.5 py-0.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-[10px] mx-0.5">
              Shift+Space
            </kbd>{' '}
            → scroll up. Most BT foot pedals emit these keys by default. In the
            preview, click a notes panel to focus it first — in production the
            shortcuts are window-scoped while on the session page.
          </div>
        </div>
      </div>

      {/* TV layout */}
      <LayoutFrame
        label="TV / Monitor"
        sub="≥ 1280px, aspect ≥ 3:2 — auto by default, override in session header"
        icon={<Monitor size={16} />}
        aspect="16 / 9"
      >
        <TVLayout song={currentSong} nextSong={nextSong} fontSize={fontSize} />
      </LayoutFrame>

      {/* Tablet landscape */}
      <LayoutFrame
        label="Tablet — landscape"
        sub="600 – 1279px, aspect > 1"
        icon={<Tablet size={16} />}
        aspect="4 / 3"
      >
        <TabletLandscapeLayout
          song={currentSong}
          nextSong={nextSong}
          fontSize={fontSize}
        />
      </LayoutFrame>

      {/* Tablet portrait */}
      <LayoutFrame
        label="Tablet — portrait"
        sub="600 – 1279px, aspect < 1 — maximize vertical real estate for lyrics"
        icon={<Tablet size={16} />}
        aspect="3 / 4"
        maxWidth={520}
      >
        <TabletPortraitLayout
          song={currentSong}
          nextSong={nextSong}
          fontSize={fontSize}
        />
      </LayoutFrame>

      {/* Mobile */}
      <LayoutFrame
        label="Mobile"
        sub="< 600px"
        icon={<Smartphone size={16} />}
        aspect="9 / 19"
        maxWidth={340}
      >
        <MobileLayout
          song={currentSong}
          nextSong={nextSong}
          fontSize={fontSize}
        />
      </LayoutFrame>
    </div>
  )
}

// ---- Layout frame wrapper ----

interface LayoutFrameProps {
  label: string
  sub: string
  icon: React.ReactNode
  aspect: string
  maxWidth?: number
  children: React.ReactNode
}

const LayoutFrame: React.FC<LayoutFrameProps> = ({
  label,
  sub,
  icon,
  aspect,
  maxWidth,
  children,
}) => {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[#f17827ff]">{icon}</span>
        <h3 className="text-white font-semibold">{label}</h3>
        <span className="text-[#707070] text-xs">— {sub}</span>
      </div>
      <div
        className="mx-auto bg-[#0a0a0a] border-2 border-[#2a2a2a] rounded-lg overflow-hidden"
        style={{
          aspectRatio: aspect,
          maxWidth: maxWidth ? `${maxWidth}px` : '100%',
        }}
      >
        <div className="w-full h-full overflow-hidden">{children}</div>
      </div>
    </section>
  )
}

// ---- Unified MetaPill — same shape for Key / BPM / Duration / Tuning ----

interface MetaPillProps {
  icon: React.ReactNode
  label: string // e.g. "Key", "BPM", "Duration", "Tuning"
  value: string // e.g. "Em", "86"
  accentColor?: string // if provided, renders the accent (colored) variant
  size?: 'sm' | 'md'
  block?: boolean // full-width variant for the TV left rail
}

const MetaPill: React.FC<MetaPillProps> = ({
  icon,
  label,
  value,
  accentColor,
  size = 'md',
  block = false,
}) => {
  const hasAccent = Boolean(accentColor)
  const padX = size === 'sm' ? 'px-2' : 'px-2.5'
  const padY = size === 'sm' ? 'py-0.5' : 'py-1'
  const txt = size === 'sm' ? 'text-[11px]' : 'text-xs'

  const bg = hasAccent ? `${accentColor}22` : '#1a1a1a'
  const border = hasAccent ? `${accentColor}66` : '#2a2a2a'
  const iconColor = hasAccent ? accentColor! : '#707070'
  const valueColor = hasAccent ? accentColor! : '#ffffff'

  // Pill is always compact (icon + value). Label renders as a tiny caption
  // above the pill when size="md", hidden on size="sm".
  const showCaption = size !== 'sm'

  const pill = (
    <span
      className={`inline-flex items-center gap-1.5 ${padX} ${padY} rounded-full ${txt} font-medium ${
        block ? 'w-full justify-start' : ''
      }`}
      style={{
        backgroundColor: bg,
        border: `1px solid ${border}`,
      }}
      title={showCaption ? undefined : `${label}: ${value}`}
    >
      <span style={{ color: iconColor }} className="flex-shrink-0">
        {icon}
      </span>
      <span style={{ color: valueColor }} className="font-bold">
        {value}
      </span>
    </span>
  )

  if (!showCaption) return pill

  return (
    <div
      className={`flex flex-col items-start gap-0.5 ${block ? 'w-full' : ''}`}
    >
      <span
        className="text-[9px] uppercase tracking-wider px-1"
        style={{ color: hasAccent ? accentColor : '#707070' }}
      >
        {label}
      </span>
      {pill}
    </div>
  )
}

// Helpers for common pills
const KeyPill: React.FC<{
  value: string
  size?: 'sm' | 'md'
  block?: boolean
}> = ({ value, size, block }) => (
  <MetaPill
    icon={<Music size={12} />}
    label="Key"
    value={value}
    size={size}
    block={block}
  />
)

const BpmPill: React.FC<{
  value: string
  size?: 'sm' | 'md'
  block?: boolean
}> = ({ value, size, block }) => (
  <MetaPill
    icon={<Activity size={12} />}
    label="BPM"
    value={value}
    size={size}
    block={block}
  />
)

const DurationPill: React.FC<{
  value: string
  size?: 'sm' | 'md'
  block?: boolean
}> = ({ value, size, block }) => (
  <MetaPill
    icon={<Clock size={12} />}
    label="Duration"
    value={value}
    size={size}
    block={block}
  />
)

const TuningPill: React.FC<{
  tuning: string
  size?: 'sm' | 'md'
  block?: boolean
}> = ({ tuning, size, block }) => {
  const color = tuningColor(tuning)
  return (
    <MetaPill
      icon={<Guitar size={12} />}
      label="Tuning"
      value={tuningLabel(tuning)}
      accentColor={color}
      size={size}
      block={block}
    />
  )
}

// ---- Shared next-song preview (footer center) ----
// Same visual language across tablet landscape / portrait / mobile footers:
// centered flex with [Next label] [Song title] [TuningPill] [Change badge]

const FooterNextPreview: React.FC<{
  nextSong: (typeof MOCK_SONGS)[number] | null
  currentTuning: string
  compact?: boolean // mobile: drop "Next" label, smaller title
}> = ({ nextSong, currentTuning, compact = false }) => {
  if (!nextSong) {
    return (
      <div className="flex-1 text-center text-xs text-[#505050]">Last song</div>
    )
  }
  const nextTuning = nextSong.tuning ?? 'Standard'
  const changed = currentTuning !== nextTuning
  const changeColor = tuningColor(nextTuning)

  return (
    <div className="flex-1 min-w-0 px-2 flex items-center justify-center gap-2">
      {!compact && (
        <span className="text-[9px] uppercase tracking-wider text-[#505050] flex-shrink-0">
          Next
        </span>
      )}
      <span
        className={`${compact ? 'text-[11px]' : 'text-xs'} text-white font-medium truncate min-w-0`}
      >
        {nextSong.title}
      </span>
      <TuningPill tuning={nextTuning} size="sm" />
      {changed && (
        <span
          className="flex items-center gap-1 flex-shrink-0"
          title="Tuning change"
          aria-label="Tuning change from current song"
        >
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: changeColor }}
          />
          {!compact && (
            <span className="text-[9px] font-semibold uppercase tracking-wider text-amber-400">
              Change
            </span>
          )}
        </span>
      )}
    </div>
  )
}

// ---- Notes renderer ----

/**
 * NotesPanel — scrollable markdown panel with overlay up/down buttons.
 *
 * Scroll behavior:
 * - Buttons render only when content overflows the container.
 * - Up button hides at top, down button hides at bottom.
 * - Clicking scrolls by ~70% of viewport height (smooth).
 * - Focusing the panel (click or Tab) enables keyboard shortcuts:
 *   PageDown / Space  → scroll down one page
 *   PageUp   / Shift+Space → scroll up one page
 * - BT foot pedals and presenter remotes typically emit PageUp/PageDown,
 *   so they work without app-side setup.
 *
 * In production, these listeners would be window-scoped while on the
 * practice session page; here they're element-scoped so the four preview
 * layouts don't fight each other.
 */
const NotesPanel: React.FC<{
  notes: string | undefined
  fontSize: FontSize
  buttonSize?: 'sm' | 'md' | 'lg'
}> = ({ notes, fontSize, buttonSize = 'md' }) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollUp, setCanScrollUp] = useState(false)
  const [canScrollDown, setCanScrollDown] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current
    if (!el) {
      setCanScrollUp(false)
      setCanScrollDown(false)
      return
    }
    const isScrollable = el.scrollHeight > el.clientHeight + 2
    setCanScrollUp(isScrollable && el.scrollTop > 2)
    setCanScrollDown(
      isScrollable && el.scrollTop + el.clientHeight < el.scrollHeight - 2
    )
  }, [])

  useEffect(() => {
    updateScrollState()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', updateScrollState, { passive: true })
    const ro = new ResizeObserver(updateScrollState)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateScrollState)
      ro.disconnect()
    }
  }, [updateScrollState, notes, fontSize])

  const scrollByPage = useCallback((dir: 1 | -1) => {
    const el = scrollRef.current
    if (!el) return
    const pageSize = Math.floor(el.clientHeight * 0.7)
    el.scrollBy({ top: pageSize * dir, behavior: 'smooth' })
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // PageDown / Space → down
    if (e.key === 'PageDown' || (e.code === 'Space' && !e.shiftKey)) {
      e.preventDefault()
      scrollByPage(1)
      return
    }
    // PageUp / Shift+Space → up
    if (e.key === 'PageUp' || (e.code === 'Space' && e.shiftKey)) {
      e.preventDefault()
      scrollByPage(-1)
    }
  }

  if (!notes) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#505050] italic text-sm">
        No notes for this song
      </div>
    )
  }

  // Kindle-style tap zones — full-width bars at top and bottom of the notes
  // panel. Transparent in the middle (so text behind is readable) with a
  // gradient scrim + hairline inner edge demarcating the tap zone.
  const zoneHeight = {
    sm: 'h-9', // 36px
    md: 'h-12', // 48px
    lg: 'h-16', // 64px
  }[buttonSize]
  const iconSize = buttonSize === 'lg' ? 32 : buttonSize === 'md' ? 24 : 18

  return (
    <div className="relative h-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-[#f17827ff]/30">
      <div
        ref={scrollRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className={`prose prose-invert max-w-none h-full overflow-y-auto custom-scrollbar px-4 py-3 focus:outline-none ${FONT_SIZES[fontSize]}`}
        data-testid="notes-scroll-container"
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1 className="text-white font-bold mb-3 mt-2 text-[1.4em]">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-white font-bold mb-2 mt-3 text-[1.2em]">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-white font-semibold mb-2 mt-2 text-[1.1em]">
                {children}
              </h3>
            ),
            p: ({ children }) => (
              <p className="text-[#d4d4d4] mb-3 leading-relaxed">{children}</p>
            ),
            ul: ({ children }) => (
              <ul className="list-disc list-inside text-[#d4d4d4] mb-3 space-y-1">
                {children}
              </ul>
            ),
            strong: ({ children }) => (
              <strong className="font-bold text-white">{children}</strong>
            ),
            em: ({ children }) => (
              <em className="italic text-[#d4d4d4]">{children}</em>
            ),
          }}
        >
          {notes}
        </ReactMarkdown>
      </div>

      {/* Top page-turner zone — tap anywhere in the strip to scroll up.
          Gradient darkens toward the outer edge; hairline inner border
          demarcates where the tap zone ends so the affordance is visible
          without hover (critical for touch devices). */}
      {canScrollUp && (
        <button
          onClick={() => scrollByPage(-1)}
          data-testid="notes-scroll-up"
          aria-label="Scroll notes up"
          className={`absolute top-0 left-0 right-0 ${zoneHeight} flex items-center justify-center text-[#f17827ff] hover:text-white bg-gradient-to-b from-black/70 via-black/30 to-transparent hover:from-[#f17827ff]/30 hover:via-[#f17827ff]/15 transition-colors group`}
        >
          <ChevronUp
            size={iconSize}
            className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] group-hover:scale-110 transition-transform"
          />
        </button>
      )}

      {/* Bottom page-turner zone — tap anywhere in the strip to scroll down */}
      {canScrollDown && (
        <button
          onClick={() => scrollByPage(1)}
          data-testid="notes-scroll-down"
          aria-label="Scroll notes down"
          className={`absolute bottom-0 left-0 right-0 ${zoneHeight} flex items-center justify-center text-[#f17827ff] hover:text-white bg-gradient-to-t from-black/70 via-black/30 to-transparent hover:from-[#f17827ff]/30 hover:via-[#f17827ff]/15 transition-colors group`}
        >
          <ChevronDown
            size={iconSize}
            className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] group-hover:scale-110 transition-transform"
          />
        </button>
      )}
    </div>
  )
}

// ---- Shared shape ----

interface SongProps {
  song: (typeof MOCK_SONGS)[number]
  nextSong: (typeof MOCK_SONGS)[number] | null
  fontSize: FontSize
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

// ---- TV Layout — 240px left rail, stacked metadata, full-width notes ----

const TVLayout: React.FC<SongProps> = ({ song, nextSong, fontSize }) => {
  const currentTuning = song.tuning ?? 'Standard'
  const nextTuning = nextSong?.tuning ?? 'Standard'
  const tuningChanges = nextSong && currentTuning !== nextTuning
  const idx = MOCK_SONGS.indexOf(song)

  return (
    <div className="h-full flex flex-col bg-[#0f0f0f]">
      {/* Header — matches other layouts' proportions */}
      <header className="flex items-center justify-between px-4 py-3 bg-[#0a0a0a] border-b border-[#2a2a2a]">
        <button className="text-[#a0a0a0] hover:text-white">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-3 text-[#a0a0a0] text-sm">
          <span className="font-semibold text-white">PRACTICE</span>
          <span className="text-[#505050]">•</span>
          <span>
            Song {idx + 1} of {MOCK_SONGS.length}
          </span>
          <span className="text-[#505050]">•</span>
          <span className="flex items-center gap-1.5">
            <Clock size={14} />
            22:14
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="p-1.5 bg-[#1a1a1a] rounded text-[#f17827ff]"
            title="Layout"
          >
            <Monitor size={14} />
          </button>
          <button
            className="p-1.5 bg-[#1a1a1a] rounded text-[#a0a0a0]"
            title="Font size"
          >
            <Type size={14} />
          </button>
        </div>
      </header>

      {/* Body: narrow left rail + wide notes */}
      <div className="flex-1 flex min-h-0">
        <aside className="w-[240px] flex-shrink-0 border-r border-[#2a2a2a] p-4 flex flex-col gap-3 overflow-y-auto bg-[#0a0a0a]">
          <div>
            <div className="text-white font-bold text-lg leading-tight">
              {song.title}
            </div>
            <div className="text-[#a0a0a0] text-sm">{song.artist}</div>
          </div>

          {/* Metadata — stacked vertically, full-width pills */}
          <div className="flex flex-col gap-2">
            {song.key && <KeyPill value={song.key} block />}
            {song.bpm && <BpmPill value={String(song.bpm)} block />}
            <DurationPill value={formatDuration(song.durationSeconds)} block />
            <TuningPill tuning={currentTuning} block />
          </div>

          <div className="flex-1" />

          {/* Next song */}
          {nextSong && (
            <div className="pt-3 border-t border-[#2a2a2a]">
              <div className="text-[10px] uppercase tracking-wider text-[#707070] mb-1">
                Up next
              </div>
              <div className="text-white text-sm font-medium leading-tight">
                {nextSong.title}
              </div>
              <div className="text-[#a0a0a0] text-xs mb-2">
                {nextSong.artist}
              </div>
              <div className="flex flex-col gap-2">
                <TuningPill tuning={nextTuning} size="sm" block />
                {tuningChanges && (
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full animate-pulse"
                      style={{
                        backgroundColor: tuningColor(nextTuning),
                        boxShadow: `0 0 0 3px ${tuningColor(nextTuning)}55`,
                      }}
                    />
                    <span className="text-amber-400 text-[10px] font-semibold uppercase tracking-wider">
                      Tuning change!
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>

        {/* Notes panel */}
        <div className="flex-1 min-w-0 p-6 flex flex-col min-h-0">
          <div className="text-[10px] uppercase tracking-wider text-[#707070] mb-2">
            Band notes
          </div>
          <div className="flex-1 min-h-0">
            <NotesPanel
              notes={song.notes}
              fontSize={fontSize}
              buttonSize="lg"
            />
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex items-center justify-between px-4 py-2 bg-[#0a0a0a] border-t border-[#2a2a2a]">
        <button className="flex items-center gap-1 px-3 py-1.5 bg-[#1a1a1a] rounded text-white text-xs">
          <ChevronLeft size={12} />
          Previous
        </button>
        <div className="flex items-center gap-1">
          {MOCK_SONGS.map((_, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${
                i === idx
                  ? 'bg-[#f17827ff]'
                  : i < idx
                    ? 'bg-[#505050]'
                    : 'bg-[#2a2a2a]'
              }`}
            />
          ))}
        </div>
        <button className="flex items-center gap-1 px-3 py-1.5 bg-[#f17827ff] rounded text-white text-xs">
          Next
          <ChevronRight size={12} />
        </button>
      </nav>
    </div>
  )
}

// ---- Tablet Landscape — compact header, metadata row above notes ----

const TabletLandscapeLayout: React.FC<SongProps> = ({
  song,
  nextSong,
  fontSize,
}) => {
  const currentTuning = song.tuning ?? 'Standard'

  return (
    <div className="h-full flex flex-col bg-[#0f0f0f]">
      <header className="flex items-center justify-between px-4 py-3 bg-[#0a0a0a] border-b border-[#2a2a2a]">
        <ArrowLeft size={18} className="text-[#a0a0a0]" />
        <div className="text-center flex-1 px-2 min-w-0">
          <div className="text-white font-bold truncate">{song.title}</div>
          <div className="text-[#a0a0a0] text-xs truncate">{song.artist}</div>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#a0a0a0]">
          <Clock size={14} />
          22:14
        </div>
      </header>

      {/* Metadata row — all four chips */}
      <div className="flex items-center justify-center flex-wrap gap-2 px-4 py-2 bg-[#0a0a0a] border-b border-[#2a2a2a]">
        {song.key && <KeyPill value={song.key} />}
        {song.bpm && <BpmPill value={String(song.bpm)} />}
        <DurationPill value={formatDuration(song.durationSeconds)} />
        <TuningPill tuning={currentTuning} />
      </div>

      {/* Notes — full width */}
      <div className="flex-1 min-h-0 p-4 overflow-hidden">
        <NotesPanel notes={song.notes} fontSize={fontSize} buttonSize="md" />
      </div>

      <nav className="flex items-center justify-between px-4 py-2 bg-[#0a0a0a] border-t border-[#2a2a2a]">
        <button className="flex items-center gap-1 px-3 py-1.5 bg-[#1a1a1a] rounded text-white text-xs">
          <ChevronLeft size={12} />
          Prev
        </button>
        <FooterNextPreview nextSong={nextSong} currentTuning={currentTuning} />
        <button className="flex items-center gap-1 px-3 py-1.5 bg-[#f17827ff] rounded text-white text-xs">
          Next
          <ChevronRight size={12} />
        </button>
      </nav>
    </div>
  )
}

// ---- Tablet Portrait — tall, note-focused ----

const TabletPortraitLayout: React.FC<SongProps> = ({
  song,
  nextSong,
  fontSize,
}) => {
  const currentTuning = song.tuning ?? 'Standard'

  return (
    <div className="h-full flex flex-col bg-[#0f0f0f]">
      <header className="flex items-center justify-between px-3 py-2.5 bg-[#0a0a0a] border-b border-[#2a2a2a]">
        <ArrowLeft size={16} className="text-[#a0a0a0]" />
        <div className="text-center flex-1 px-2 min-w-0">
          <div className="text-white text-sm font-bold truncate">
            {song.title}
          </div>
          <div className="text-[#a0a0a0] text-[11px] truncate">
            {song.artist}
          </div>
        </div>
        <div className="text-[11px] text-[#a0a0a0] flex items-center gap-1">
          <Clock size={12} />
          22:14
        </div>
      </header>

      {/* Metadata row — compact chips, two columns if needed */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 px-3 py-2 bg-[#0a0a0a] border-b border-[#2a2a2a]">
        {song.key && <KeyPill value={song.key} size="sm" />}
        {song.bpm && <BpmPill value={String(song.bpm)} size="sm" />}
        <DurationPill value={formatDuration(song.durationSeconds)} size="sm" />
        <TuningPill tuning={currentTuning} size="sm" />
      </div>

      {/* Notes — huge, takes most of the vertical space */}
      <div className="flex-1 min-h-0 p-3 overflow-hidden">
        <NotesPanel notes={song.notes} fontSize={fontSize} buttonSize="md" />
      </div>

      {/* Nav with next-song hint */}
      <nav className="flex items-center gap-2 px-2 py-2 bg-[#0a0a0a] border-t border-[#2a2a2a]">
        <button className="p-2 bg-[#1a1a1a] rounded text-white">
          <ChevronLeft size={14} />
        </button>
        <FooterNextPreview nextSong={nextSong} currentTuning={currentTuning} />
        <button className="p-2 bg-[#f17827ff] rounded text-white">
          <ChevronRight size={14} />
        </button>
      </nav>
    </div>
  )
}

// ---- Mobile ----

const MobileLayout: React.FC<SongProps> = ({ song, nextSong, fontSize }) => {
  const currentTuning = song.tuning ?? 'Standard'
  const idx = MOCK_SONGS.indexOf(song)

  return (
    <div className="h-full flex flex-col bg-[#0f0f0f]">
      <header className="flex items-center justify-between px-3 py-2 bg-[#0a0a0a] border-b border-[#2a2a2a]">
        <ArrowLeft size={14} className="text-[#a0a0a0]" />
        <div className="text-center flex-1 px-2 min-w-0">
          <div className="text-white text-sm font-bold truncate">
            {song.title}
          </div>
          <div className="text-[#a0a0a0] text-[10px] truncate">
            {song.artist}
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-[#a0a0a0]">
          <Clock size={11} />
          <span>22:14</span>
        </div>
      </header>

      {/* Progress dots */}
      <div className="flex justify-center items-center gap-1 py-1.5 bg-[#0a0a0a] border-b border-[#2a2a2a]">
        {MOCK_SONGS.slice(0, 8).map((_, i) => (
          <span
            key={i}
            className={`w-1.5 h-1.5 rounded-full ${
              i === idx
                ? 'bg-[#f17827ff]'
                : i < idx
                  ? 'bg-[#505050]'
                  : 'bg-[#2a2a2a]'
            }`}
          />
        ))}
      </div>

      {/* Metadata row — centered, wraps if needed */}
      <div className="flex items-center justify-center flex-wrap gap-1 px-2 py-2">
        {song.key && <KeyPill value={song.key} size="sm" />}
        {song.bpm && <BpmPill value={String(song.bpm)} size="sm" />}
        <DurationPill value={formatDuration(song.durationSeconds)} size="sm" />
        <TuningPill tuning={currentTuning} size="sm" />
      </div>

      {/* Notes */}
      <div className="flex-1 min-h-0 px-3 pb-2 overflow-hidden">
        <NotesPanel notes={song.notes} fontSize={fontSize} buttonSize="sm" />
      </div>

      {/* Nav */}
      <nav className="flex items-center justify-between px-2 py-2 bg-[#0a0a0a] border-t border-[#2a2a2a]">
        <button className="p-2 bg-[#1a1a1a] rounded text-white">
          <ChevronLeft size={14} />
        </button>
        <FooterNextPreview
          nextSong={nextSong}
          currentTuning={currentTuning}
          compact
        />
        <button className="p-2 bg-[#f17827ff] rounded text-white">
          <ChevronRight size={14} />
        </button>
      </nav>
    </div>
  )
}
