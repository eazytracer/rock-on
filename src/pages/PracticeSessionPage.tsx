/**
 * PracticeSessionPage — live practice session viewer.
 *
 * Full-screen on all viewports. Four responsive layouts auto-selected by
 * viewport dimensions, with a manual override that persists in localStorage:
 *
 * - TV / Monitor (≥1280px, aspect ≥ 3:2): 240px left rail + wide notes
 * - Tablet landscape (600–1279px, aspect > 1): compact header + full-width notes
 * - Tablet portrait (600–1279px, aspect < 1): vertical-space optimized
 * - Mobile (< 600px): minimal chrome
 *
 * Font size (S/M/L) also persists in localStorage. Scroll controls on the
 * notes panel respond to keyboard + BT foot pedal (PageUp/PageDown,
 * Space/Shift+Space). Song stepping uses ArrowLeft/ArrowRight/Home/End.
 * Escape returns to the practice detail page.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Monitor,
  Tablet,
  Smartphone,
  Type,
} from 'lucide-react'
import {
  KeyPill,
  BpmPill,
  DurationPill,
  TuningPill,
} from '../components/common/MetaPill'
import {
  ScrollableNotes,
  NotesFontSize,
  NotesButtonSize,
} from '../components/practice/ScrollableNotes'
import { FooterNextPreview } from '../components/practice/FooterNextPreview'
import { tuningColor } from '../utils/tunings'
import { db } from '../services/database'
import { useAuth } from '../contexts/AuthContext'
import { useRealtimeSync } from '../hooks/useRealtimeSync'
import { createLogger } from '../utils/logger'
import type { PracticeSession } from '../models/PracticeSession'
import type { Song } from '../models/Song'

const log = createLogger('PracticeSessionPage')

// ---- Viewport detection ----

type LayoutMode = 'tv' | 'tablet-landscape' | 'tablet-portrait' | 'mobile'

const LAYOUT_STORAGE_KEY = 'practice-session-layout-override'
const FONT_STORAGE_KEY = 'practice-session-font-size'

const detectLayout = (): LayoutMode => {
  if (typeof window === 'undefined') return 'mobile'
  const w = window.innerWidth
  const h = window.innerHeight
  const aspect = w / h
  if (w >= 1280 && aspect >= 1.5) return 'tv'
  if (w < 600) return 'mobile'
  return aspect >= 1 ? 'tablet-landscape' : 'tablet-portrait'
}

const isValidLayout = (s: string | null): s is LayoutMode =>
  s === 'tv' ||
  s === 'tablet-landscape' ||
  s === 'tablet-portrait' ||
  s === 'mobile'

const isValidFontSize = (s: string | null): s is NotesFontSize =>
  s === 'sm' || s === 'md' || s === 'lg'

// ---- Helpers ----

const formatTimer = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ---- Main component ----

export const PracticeSessionPage: React.FC = () => {
  const navigate = useNavigate()
  const { practiceId } = useParams<{ practiceId: string }>()
  const { currentBandId } = useAuth()

  // Data state
  const [, setPractice] = useState<PracticeSession | null>(null)
  const [songs, setSongs] = useState<Song[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // Layout + font state — persisted to localStorage
  const [autoLayout, setAutoLayout] = useState<LayoutMode>(detectLayout)
  const [layoutOverride, setLayoutOverride] = useState<LayoutMode | null>(
    () => {
      try {
        const stored = localStorage.getItem(LAYOUT_STORAGE_KEY)
        return isValidLayout(stored) ? stored : null
      } catch {
        return null
      }
    }
  )
  const [fontSize, setFontSize] = useState<NotesFontSize>(() => {
    try {
      const stored = localStorage.getItem(FONT_STORAGE_KEY)
      return isValidFontSize(stored) ? stored : 'md'
    } catch {
      return 'md'
    }
  })
  const layout: LayoutMode = layoutOverride ?? autoLayout

  // Persist font-size changes
  useEffect(() => {
    try {
      localStorage.setItem(FONT_STORAGE_KEY, fontSize)
    } catch {
      /* ignore */
    }
  }, [fontSize])

  // Persist layout override changes
  useEffect(() => {
    try {
      if (layoutOverride) {
        localStorage.setItem(LAYOUT_STORAGE_KEY, layoutOverride)
      } else {
        localStorage.removeItem(LAYOUT_STORAGE_KEY)
      }
    } catch {
      /* ignore */
    }
  }, [layoutOverride])

  // Watch viewport for auto-layout updates
  useEffect(() => {
    const onResize = () => setAutoLayout(detectLayout())
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [])

  // Derived state
  const currentSong = songs[currentIndex]
  const nextSong = songs[currentIndex + 1] ?? null
  const canGoPrev = currentIndex > 0
  const canGoNext = currentIndex < songs.length - 1

  // Load practice + songs
  const loadData = useCallback(async () => {
    if (!practiceId) {
      setError('No practice ID provided')
      setLoading(false)
      return
    }
    try {
      const practiceSession = await db.practiceSessions.get(practiceId)
      if (!practiceSession) {
        setError('Practice not found')
        setLoading(false)
        return
      }
      setPractice(practiceSession)

      const loaded: Song[] = []
      if (practiceSession.songs && practiceSession.songs.length > 0) {
        for (const sessionSong of practiceSession.songs) {
          const song = await db.songs.get(sessionSong.songId)
          if (song) loaded.push(song)
        }
      }
      if (loaded.length === 0) {
        setError('No songs in this practice')
        setLoading(false)
        return
      }
      setSongs(loaded)
      setLoading(false)
    } catch (err) {
      log.error('Error loading practice', err)
      setError('Failed to load practice')
      setLoading(false)
    }
  }, [practiceId])

  useEffect(() => {
    loadData()
  }, [loadData])

  useRealtimeSync({
    events: ['songs:changed', 'practices:changed'],
    bandId: currentBandId || '',
    onSync: () => {
      loadData()
    },
  })

  // Timer
  useEffect(() => {
    const i = setInterval(() => setElapsedSeconds(p => p + 1), 1000)
    return () => clearInterval(i)
  }, [])

  // Prevent body scroll while session is active
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  // Keyboard: song stepping + exit
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          if (canGoPrev) setCurrentIndex(i => i - 1)
          break
        case 'ArrowRight':
          if (canGoNext) setCurrentIndex(i => i + 1)
          break
        case 'Escape':
          navigate(`/practices/${practiceId}`)
          break
        case 'Home':
          setCurrentIndex(0)
          break
        case 'End':
          setCurrentIndex(songs.length - 1)
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [canGoPrev, canGoNext, songs.length, navigate, practiceId])

  const handlePrev = useCallback(() => {
    if (canGoPrev) setCurrentIndex(i => i - 1)
  }, [canGoPrev])
  const handleNext = useCallback(() => {
    if (canGoNext) setCurrentIndex(i => i + 1)
  }, [canGoNext])
  const handleExit = useCallback(() => {
    navigate(`/practices/${practiceId}`)
  }, [navigate, practiceId])

  // Layout cycle button — cycles through the four modes as a manual override
  const handleLayoutCycle = () => {
    const order: LayoutMode[] = [
      'tv',
      'tablet-landscape',
      'tablet-portrait',
      'mobile',
    ]
    const nextIdx = (order.indexOf(layout) + 1) % order.length
    setLayoutOverride(order[nextIdx])
  }

  const handleFontCycle = () => {
    const order: NotesFontSize[] = ['sm', 'md', 'lg']
    const nextIdx = (order.indexOf(fontSize) + 1) % order.length
    setFontSize(order[nextIdx])
  }

  // ---- Loading / error states ----
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0f0f0f] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f17827ff] mx-auto mb-4" />
          <p className="text-[#a0a0a0] text-sm">Loading practice session...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0f0f0f] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">{error}</p>
          <button
            onClick={() => navigate('/practices')}
            className="px-4 py-2 bg-[#1a1a1a] text-white rounded-lg hover:bg-[#252525] transition-colors"
          >
            Back to Practices
          </button>
        </div>
      </div>
    )
  }

  if (!currentSong) return null

  const notesButtonSize: NotesButtonSize =
    layout === 'tv' ? 'lg' : layout === 'mobile' ? 'sm' : 'md'

  const layoutIcon =
    layout === 'tv' ? (
      <Monitor size={14} />
    ) : layout === 'mobile' ? (
      <Smartphone size={14} />
    ) : (
      <Tablet size={14} />
    )

  const commonHeaderControls = (
    <div className="flex items-center gap-2">
      <button
        onClick={handleFontCycle}
        className="flex items-center gap-1 px-2 py-1.5 bg-[#1a1a1a] rounded text-[#a0a0a0] hover:text-white transition-colors text-xs"
        title={`Font size: ${fontSize.toUpperCase()} (click to cycle)`}
        data-testid="session-font-toggle"
      >
        <Type size={14} />
        <span className="font-semibold">{fontSize.toUpperCase()}</span>
      </button>
      <button
        onClick={handleLayoutCycle}
        className="flex items-center gap-1 px-2 py-1.5 bg-[#1a1a1a] rounded text-[#f17827ff] hover:text-white transition-colors text-xs"
        title={`Layout: ${layout} (click to cycle)`}
        data-testid="session-layout-toggle"
      >
        {layoutIcon}
      </button>
    </div>
  )

  // Shared props for each layout
  const layoutProps: LayoutProps = {
    song: currentSong,
    nextSong,
    songs,
    currentIndex,
    elapsedSeconds,
    fontSize,
    notesButtonSize,
    onPrev: handlePrev,
    onNext: handleNext,
    onExit: handleExit,
    canGoPrev,
    canGoNext,
    isLastSong: !canGoNext,
    headerControls: commonHeaderControls,
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#0f0f0f] flex flex-col">
      {layout === 'tv' ? (
        <TVLayout {...layoutProps} />
      ) : layout === 'tablet-landscape' ? (
        <TabletLandscapeLayout {...layoutProps} />
      ) : layout === 'tablet-portrait' ? (
        <TabletPortraitLayout {...layoutProps} />
      ) : (
        <MobileLayout {...layoutProps} />
      )}
    </div>
  )
}

// ---- Shared layout props ----

interface LayoutProps {
  song: Song
  nextSong: Song | null
  songs: Song[]
  currentIndex: number
  elapsedSeconds: number
  fontSize: NotesFontSize
  notesButtonSize: NotesButtonSize
  onPrev: () => void
  onNext: () => void
  onExit: () => void
  canGoPrev: boolean
  canGoNext: boolean
  isLastSong: boolean
  headerControls: React.ReactNode
}

// ---- TV layout ----

const TVLayout: React.FC<LayoutProps> = ({
  song,
  nextSong,
  songs,
  currentIndex,
  elapsedSeconds,
  fontSize,
  notesButtonSize,
  onPrev,
  onNext,
  onExit,
  canGoPrev,
  canGoNext,
  isLastSong,
  headerControls,
}) => {
  const currentTuning = song.guitarTuning ?? 'Standard'
  const nextTuning = nextSong?.guitarTuning ?? 'Standard'
  const tuningChanges = Boolean(nextSong) && currentTuning !== nextTuning

  return (
    <>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-[#0a0a0a] border-b border-[#2a2a2a]">
        <button
          onClick={onExit}
          className="text-[#a0a0a0] hover:text-white transition-colors p-2 -ml-2"
          aria-label="Exit session"
          data-testid="session-exit-button"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-3 text-[#a0a0a0] text-sm">
          <span className="font-semibold text-white">PRACTICE</span>
          <span className="text-[#505050]">•</span>
          <span>
            Song {currentIndex + 1} of {songs.length}
          </span>
          <span className="text-[#505050]">•</span>
          <span className="flex items-center gap-1.5">
            <Clock size={14} />
            <span className="font-mono" data-testid="session-timer">
              {formatTimer(elapsedSeconds)}
            </span>
          </span>
        </div>
        {headerControls}
      </header>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        <aside className="w-[240px] flex-shrink-0 border-r border-[#2a2a2a] p-4 flex flex-col gap-3 overflow-y-auto custom-scrollbar bg-[#0a0a0a]">
          <div>
            <div
              className="text-white font-bold text-lg leading-tight"
              data-testid="session-song-title"
            >
              {song.title}
            </div>
            {song.artist && (
              <div
                className="text-[#a0a0a0] text-sm"
                data-testid="session-song-artist"
              >
                {song.artist}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {song.key && <KeyPill value={song.key} block />}
            {song.bpm && <BpmPill value={String(song.bpm)} block />}
            <DurationPill value={formatDuration(song.duration)} block />
            <TuningPill tuning={currentTuning} block />
          </div>

          <div className="flex-1" />

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

        <div className="flex-1 min-w-0 p-6 flex flex-col min-h-0">
          <div className="text-[10px] uppercase tracking-wider text-[#707070] mb-2">
            Band notes
          </div>
          <div className="flex-1 min-h-0">
            <ScrollableNotes
              notes={song.notes}
              fontSize={fontSize}
              buttonSize={notesButtonSize}
              windowShortcuts
              data-testid="session-notes"
            />
          </div>
        </div>
      </div>

      {/* Nav */}
      <SessionFooter
        currentIndex={currentIndex}
        songs={songs}
        onPrev={onPrev}
        onNext={onNext}
        onEnd={onExit}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        isLastSong={isLastSong}
        variant="dots"
      />
    </>
  )
}

// ---- Tablet landscape ----

const TabletLandscapeLayout: React.FC<LayoutProps> = ({
  song,
  nextSong,
  songs,
  currentIndex,
  elapsedSeconds,
  fontSize,
  notesButtonSize,
  onPrev,
  onNext,
  onExit,
  canGoPrev,
  canGoNext,
  isLastSong,
  headerControls,
}) => {
  const currentTuning = song.guitarTuning ?? 'Standard'
  return (
    <>
      <header className="flex items-center justify-between px-4 py-3 bg-[#0a0a0a] border-b border-[#2a2a2a]">
        <button
          onClick={onExit}
          className="text-[#a0a0a0] hover:text-white p-2 -ml-2"
          aria-label="Exit session"
          data-testid="session-exit-button"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="text-center flex-1 px-2 min-w-0">
          <div
            className="text-white font-bold truncate"
            data-testid="session-song-title"
          >
            {song.title}
          </div>
          {song.artist && (
            <div
              className="text-[#a0a0a0] text-xs truncate"
              data-testid="session-song-artist"
            >
              {song.artist}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-[#a0a0a0]">
            <Clock size={14} />
            <span className="font-mono" data-testid="session-timer">
              {formatTimer(elapsedSeconds)}
            </span>
          </div>
          {headerControls}
        </div>
      </header>

      <div className="flex items-center justify-center flex-wrap gap-2 px-4 py-2 bg-[#0a0a0a] border-b border-[#2a2a2a]">
        {song.key && <KeyPill value={song.key} />}
        {song.bpm && <BpmPill value={String(song.bpm)} />}
        <DurationPill value={formatDuration(song.duration)} />
        <TuningPill tuning={currentTuning} />
      </div>

      <div className="flex-1 min-h-0 p-4 overflow-hidden">
        <ScrollableNotes
          notes={song.notes}
          fontSize={fontSize}
          buttonSize={notesButtonSize}
          windowShortcuts
          data-testid="session-notes"
        />
      </div>

      <SessionFooter
        currentIndex={currentIndex}
        songs={songs}
        onPrev={onPrev}
        onNext={onNext}
        onEnd={onExit}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        isLastSong={isLastSong}
        variant="next-preview"
        nextSong={nextSong}
        currentTuning={currentTuning}
      />
    </>
  )
}

// ---- Tablet portrait ----

const TabletPortraitLayout: React.FC<LayoutProps> = ({
  song,
  nextSong,
  songs,
  currentIndex,
  elapsedSeconds,
  fontSize,
  notesButtonSize,
  onPrev,
  onNext,
  onExit,
  canGoPrev,
  canGoNext,
  isLastSong,
  headerControls,
}) => {
  const currentTuning = song.guitarTuning ?? 'Standard'
  return (
    <>
      <header className="flex items-center justify-between px-3 py-2.5 bg-[#0a0a0a] border-b border-[#2a2a2a]">
        <button
          onClick={onExit}
          className="text-[#a0a0a0] hover:text-white p-1.5"
          aria-label="Exit session"
          data-testid="session-exit-button"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="text-center flex-1 px-2 min-w-0">
          <div
            className="text-white text-sm font-bold truncate"
            data-testid="session-song-title"
          >
            {song.title}
          </div>
          {song.artist && (
            <div
              className="text-[#a0a0a0] text-[11px] truncate"
              data-testid="session-song-artist"
            >
              {song.artist}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="text-[11px] text-[#a0a0a0] flex items-center gap-1">
            <Clock size={12} />
            <span className="font-mono" data-testid="session-timer">
              {formatTimer(elapsedSeconds)}
            </span>
          </div>
          {headerControls}
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-center gap-1.5 px-3 py-2 bg-[#0a0a0a] border-b border-[#2a2a2a]">
        {song.key && <KeyPill value={song.key} size="sm" />}
        {song.bpm && <BpmPill value={String(song.bpm)} size="sm" />}
        <DurationPill value={formatDuration(song.duration)} size="sm" />
        <TuningPill tuning={currentTuning} size="sm" />
      </div>

      <div className="flex-1 min-h-0 p-3 overflow-hidden">
        <ScrollableNotes
          notes={song.notes}
          fontSize={fontSize}
          buttonSize={notesButtonSize}
          windowShortcuts
          data-testid="session-notes"
        />
      </div>

      <SessionFooter
        currentIndex={currentIndex}
        songs={songs}
        onPrev={onPrev}
        onNext={onNext}
        onEnd={onExit}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        isLastSong={isLastSong}
        variant="next-preview"
        nextSong={nextSong}
        currentTuning={currentTuning}
      />
    </>
  )
}

// ---- Mobile ----

const MobileLayout: React.FC<LayoutProps> = ({
  song,
  nextSong,
  songs,
  currentIndex,
  elapsedSeconds,
  fontSize,
  notesButtonSize,
  onPrev,
  onNext,
  onExit,
  canGoPrev,
  canGoNext,
  isLastSong,
  headerControls,
}) => {
  const currentTuning = song.guitarTuning ?? 'Standard'
  return (
    <>
      <header className="flex items-center justify-between px-3 py-2 bg-[#0a0a0a] border-b border-[#2a2a2a]">
        <button
          onClick={onExit}
          className="text-[#a0a0a0] hover:text-white p-1"
          aria-label="Exit session"
          data-testid="session-exit-button"
        >
          <ArrowLeft size={14} />
        </button>
        <div className="text-center flex-1 px-2 min-w-0">
          <div
            className="text-white text-sm font-bold truncate"
            data-testid="session-song-title"
          >
            {song.title}
          </div>
          {song.artist && (
            <div
              className="text-[#a0a0a0] text-[10px] truncate"
              data-testid="session-song-artist"
            >
              {song.artist}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 text-[10px] text-[#a0a0a0]">
            <Clock size={11} />
            <span className="font-mono" data-testid="session-timer">
              {formatTimer(elapsedSeconds)}
            </span>
          </div>
          {headerControls}
        </div>
      </header>

      <div className="flex justify-center items-center gap-1 py-1.5 bg-[#0a0a0a] border-b border-[#2a2a2a]">
        {songs.slice(0, 8).map((_, i) => (
          <span
            key={i}
            className={`w-1.5 h-1.5 rounded-full ${
              i === currentIndex
                ? 'bg-[#f17827ff]'
                : i < currentIndex
                  ? 'bg-[#505050]'
                  : 'bg-[#2a2a2a]'
            }`}
          />
        ))}
      </div>

      <div className="flex items-center justify-center flex-wrap gap-1 px-2 py-2">
        {song.key && <KeyPill value={song.key} size="sm" />}
        {song.bpm && <BpmPill value={String(song.bpm)} size="sm" />}
        <DurationPill value={formatDuration(song.duration)} size="sm" />
        <TuningPill tuning={currentTuning} size="sm" />
      </div>

      <div className="flex-1 min-h-0 px-3 pb-2 overflow-hidden">
        <ScrollableNotes
          notes={song.notes}
          fontSize={fontSize}
          buttonSize={notesButtonSize}
          windowShortcuts
          data-testid="session-notes"
        />
      </div>

      <SessionFooter
        currentIndex={currentIndex}
        songs={songs}
        onPrev={onPrev}
        onNext={onNext}
        onEnd={onExit}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        isLastSong={isLastSong}
        variant="next-preview"
        nextSong={nextSong}
        currentTuning={currentTuning}
        compactFooter
      />
    </>
  )
}

// ---- Session footer (shared) ----

interface SessionFooterProps {
  currentIndex: number
  songs: Song[]
  onPrev: () => void
  onNext: () => void
  onEnd: () => void
  canGoPrev: boolean
  canGoNext: boolean
  isLastSong: boolean
  variant: 'dots' | 'next-preview'
  nextSong?: Song | null
  currentTuning?: string
  compactFooter?: boolean
}

const SessionFooter: React.FC<SessionFooterProps> = ({
  currentIndex,
  songs,
  onPrev,
  onNext,
  onEnd,
  canGoPrev,
  canGoNext,
  isLastSong,
  variant,
  nextSong,
  currentTuning,
  compactFooter = false,
}) => {
  const PrevBtn = (
    <button
      onClick={onPrev}
      disabled={!canGoPrev}
      className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
        canGoPrev
          ? 'bg-[#1a1a1a] text-white hover:bg-[#252525]'
          : 'bg-[#1a1a1a]/50 text-[#505050] cursor-not-allowed'
      }`}
      data-testid="session-prev-button"
      aria-label="Previous song"
    >
      <ChevronLeft size={14} />
      {!compactFooter && <span>Prev</span>}
    </button>
  )

  const NextBtn = isLastSong ? (
    <button
      onClick={onEnd}
      className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-green-600 text-white hover:bg-green-700"
      data-testid="session-end-button"
    >
      {!compactFooter && <span>End</span>}
      <ChevronRight size={14} />
    </button>
  ) : (
    <button
      onClick={onNext}
      disabled={!canGoNext}
      className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
        canGoNext
          ? 'bg-[#f17827ff] text-white hover:bg-[#d66920]'
          : 'bg-[#f17827ff]/50 text-white/50 cursor-not-allowed'
      }`}
      data-testid="session-next-button"
      aria-label="Next song"
    >
      {!compactFooter && <span>Next</span>}
      <ChevronRight size={14} />
    </button>
  )

  return (
    <nav className="flex items-center justify-between gap-2 px-3 py-2 bg-[#0a0a0a] border-t border-[#2a2a2a]">
      {PrevBtn}
      {variant === 'dots' ? (
        <div
          className="flex items-center gap-1"
          data-testid="session-progress"
          aria-label={`Song ${currentIndex + 1} of ${songs.length}`}
        >
          {songs.map((_, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${
                i === currentIndex
                  ? 'bg-[#f17827ff]'
                  : i < currentIndex
                    ? 'bg-[#505050]'
                    : 'bg-[#2a2a2a]'
              }`}
            />
          ))}
        </div>
      ) : (
        <FooterNextPreview
          nextSong={nextSong}
          currentTuning={currentTuning}
          compact={compactFooter}
          data-testid="session-next-preview"
        />
      )}
      {NextBtn}
    </nav>
  )
}
