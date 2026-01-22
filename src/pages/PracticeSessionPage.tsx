import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
} from 'lucide-react'
import { MarkdownRenderer } from '../components/notes/MarkdownRenderer'
import { LinkIcons } from '../components/songs/LinkIcons'
import { db } from '../services/database'
import { useAuth } from '../contexts/AuthContext'
import { useRealtimeSync } from '../hooks/useRealtimeSync'
import type { PracticeSession } from '../models/PracticeSession'
import type { Song } from '../models/Song'

// Format seconds to MM:SS
const formatTimer = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Progress Dots Component
interface ProgressDotsProps {
  currentIndex: number
  totalSongs: number
}

const ProgressDots: React.FC<ProgressDotsProps> = ({
  currentIndex,
  totalSongs,
}) => {
  const maxDots = 10

  // If we have 10 or fewer songs, show all dots
  if (totalSongs <= maxDots) {
    return (
      <div className="flex items-center justify-center gap-1.5 py-2">
        {Array.from({ length: totalSongs }).map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-colors ${
              i === currentIndex
                ? 'bg-[#f17827ff]'
                : i < currentIndex
                  ? 'bg-[#505050]'
                  : 'bg-[#2a2a2a]'
            }`}
          />
        ))}
      </div>
    )
  }

  // More than 10 songs: show dots with ellipsis
  // Show: first few, ellipsis, current area, ellipsis, last few
  const showStart = currentIndex <= 3
  const showEnd = currentIndex >= totalSongs - 4

  return (
    <div className="flex items-center justify-center gap-1.5 py-2">
      {showStart ? (
        // Near the start: show first 7 dots, ..., count
        <>
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === currentIndex
                  ? 'bg-[#f17827ff]'
                  : i < currentIndex
                    ? 'bg-[#505050]'
                    : 'bg-[#2a2a2a]'
              }`}
            />
          ))}
          <span className="text-[#505050] text-xs px-1">...</span>
          <span className="text-[#707070] text-xs">{totalSongs}</span>
        </>
      ) : showEnd ? (
        // Near the end: show count, ..., last 7 dots
        <>
          <span className="text-[#707070] text-xs">{currentIndex + 1}</span>
          <span className="text-[#505050] text-xs px-1">...</span>
          {Array.from({ length: 7 }).map((_, i) => {
            const songIndex = totalSongs - 7 + i
            return (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  songIndex === currentIndex
                    ? 'bg-[#f17827ff]'
                    : songIndex < currentIndex
                      ? 'bg-[#505050]'
                      : 'bg-[#2a2a2a]'
                }`}
              />
            )
          })}
        </>
      ) : (
        // In the middle: show position, ..., 5 dots centered on current, ..., total
        <>
          <span className="text-[#707070] text-xs">{currentIndex + 1}</span>
          <span className="text-[#505050] text-xs px-1">...</span>
          {Array.from({ length: 5 }).map((_, i) => {
            const songIndex = currentIndex - 2 + i
            return (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  songIndex === currentIndex
                    ? 'bg-[#f17827ff]'
                    : songIndex < currentIndex
                      ? 'bg-[#505050]'
                      : 'bg-[#2a2a2a]'
                }`}
              />
            )
          })}
          <span className="text-[#505050] text-xs px-1">...</span>
          <span className="text-[#707070] text-xs">{totalSongs}</span>
        </>
      )}
    </div>
  )
}

// Song Display Component - Now only shows metadata and notes
interface SongDisplayProps {
  song: Song
}

const SongDisplay: React.FC<SongDisplayProps> = ({ song }) => {
  return (
    <div className="flex-1 flex flex-col px-4 py-4 sm:py-6 overflow-hidden">
      {/* Compact Metadata Row */}
      <div className="flex justify-center gap-2 sm:gap-3 mb-4">
        {song.key && (
          <div
            className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-center"
            data-testid="session-song-key"
          >
            <p className="text-[10px] sm:text-xs text-[#707070] uppercase tracking-wider">
              Key
            </p>
            <p className="text-base sm:text-lg font-bold text-white">
              {song.key}
            </p>
          </div>
        )}
        {song.guitarTuning && (
          <div
            className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-center"
            data-testid="session-song-tuning"
          >
            <p className="text-[10px] sm:text-xs text-[#707070] uppercase tracking-wider">
              Tuning
            </p>
            <p className="text-base sm:text-lg font-bold text-white">
              {song.guitarTuning}
            </p>
          </div>
        )}
        {song.bpm && (
          <div
            className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-center"
            data-testid="session-song-bpm"
          >
            <p className="text-[10px] sm:text-xs text-[#707070] uppercase tracking-wider">
              BPM
            </p>
            <p className="text-base sm:text-lg font-bold text-white">
              {song.bpm}
            </p>
          </div>
        )}
      </div>

      {/* Reference Links */}
      {song.referenceLinks && song.referenceLinks.length > 0 && (
        <div
          className="flex justify-center mb-4"
          data-testid="session-reference-links"
        >
          <LinkIcons links={song.referenceLinks} size="md" />
        </div>
      )}

      {/* Band Notes - Takes remaining space */}
      {song.notes && (
        <div
          className="flex-1 w-full max-w-2xl mx-auto bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 sm:p-4 overflow-y-auto custom-scrollbar"
          data-testid="session-notes"
        >
          <h3 className="text-xs font-medium text-[#707070] uppercase tracking-wider mb-2">
            Band Notes
          </h3>
          <MarkdownRenderer content={song.notes} />
        </div>
      )}
    </div>
  )
}

// Session Navigation Component - Now includes next song preview in center
interface SessionNavigationProps {
  currentIndex: number
  totalSongs: number
  onPrev: () => void
  onNext: () => void
  onEnd: () => void
  canGoPrev: boolean
  canGoNext: boolean
  isLastSong: boolean
  nextSong: Song | null
  currentTuning?: string
}

const SessionNavigation: React.FC<SessionNavigationProps> = ({
  onPrev,
  onNext,
  onEnd,
  canGoPrev,
  canGoNext,
  isLastSong,
  nextSong,
  currentTuning,
}) => {
  const tuningChanged =
    nextSong &&
    currentTuning &&
    nextSong.guitarTuning &&
    currentTuning !== nextSong.guitarTuning

  return (
    <div className="bg-[#0a0a0a] border-t border-[#2a2a2a] px-4 py-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <button
          onClick={onPrev}
          disabled={!canGoPrev}
          className={`flex items-center gap-2 px-4 sm:px-6 py-3 rounded-lg font-medium transition-colors min-h-[48px] ${
            canGoPrev
              ? 'bg-[#1a1a1a] text-white hover:bg-[#252525]'
              : 'bg-[#1a1a1a]/50 text-[#505050] cursor-not-allowed'
          }`}
          data-testid="session-prev-button"
        >
          <ChevronLeft size={20} />
          <span className="hidden sm:inline">Previous</span>
        </button>

        {/* Center: Next song preview or "Practice Complete" on last song */}
        <div
          className="flex-1 flex flex-col items-center justify-center px-2"
          data-testid="session-progress"
        >
          {isLastSong ? (
            <span className="text-[#707070] text-sm">Last song!</span>
          ) : nextSong ? (
            <>
              <span className="text-[10px] text-[#505050] uppercase tracking-wider">
                Next
              </span>
              <span className="text-white text-sm font-medium truncate max-w-[150px] sm:max-w-none">
                {nextSong.title}
              </span>
              {nextSong.guitarTuning && (
                <span
                  className={`text-xs ${
                    tuningChanged
                      ? 'text-amber-400 font-medium'
                      : 'text-[#505050]'
                  }`}
                >
                  {nextSong.guitarTuning}
                  {tuningChanged && ' ⚠'}
                </span>
              )}
            </>
          ) : null}
        </div>

        {isLastSong ? (
          <button
            onClick={onEnd}
            className="flex items-center gap-2 px-4 sm:px-6 py-3 rounded-lg font-medium transition-colors min-h-[48px] bg-green-600 text-white hover:bg-green-700"
            data-testid="session-end-button"
          >
            <CheckCircle size={20} />
            <span className="hidden sm:inline">End Practice</span>
            <span className="sm:hidden">End</span>
          </button>
        ) : (
          <button
            onClick={onNext}
            disabled={!canGoNext}
            className={`flex items-center gap-2 px-4 sm:px-6 py-3 rounded-lg font-medium transition-colors min-h-[48px] ${
              canGoNext
                ? 'bg-[#f17827ff] text-white hover:bg-[#d66920]'
                : 'bg-[#f17827ff]/50 text-white/50 cursor-not-allowed'
            }`}
            data-testid="session-next-button"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight size={20} />
          </button>
        )}
      </div>
    </div>
  )
}

// Main Practice Session Page
export const PracticeSessionPage: React.FC = () => {
  const navigate = useNavigate()
  const { practiceId } = useParams<{ practiceId: string }>()
  const { currentBandId } = useAuth()

  // State
  const [, setPractice] = useState<PracticeSession | null>(null)
  const [songs, setSongs] = useState<Song[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // Derived state
  const currentSong = songs[currentIndex]
  const nextSong = songs[currentIndex + 1] || null
  const canGoPrev = currentIndex > 0
  const canGoNext = currentIndex < songs.length - 1

  // Load practice and songs
  const loadData = useCallback(async () => {
    if (!practiceId) {
      setError('No practice ID provided')
      setLoading(false)
      return
    }

    try {
      // Load practice session
      const practiceSession = await db.practiceSessions.get(practiceId)
      if (!practiceSession) {
        setError('Practice not found')
        setLoading(false)
        return
      }

      setPractice(practiceSession)

      // Load songs in order
      const loadedSongs: Song[] = []
      if (practiceSession.songs && practiceSession.songs.length > 0) {
        for (const sessionSong of practiceSession.songs) {
          const song = await db.songs.get(sessionSong.songId)
          if (song) {
            loadedSongs.push(song)
          }
        }
      }

      if (loadedSongs.length === 0) {
        setError('No songs in this practice')
        setLoading(false)
        return
      }

      setSongs(loadedSongs)
      setLoading(false)
    } catch (err) {
      console.error('Error loading practice:', err)
      setError('Failed to load practice')
      setLoading(false)
    }
  }, [practiceId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Subscribe to real-time sync events
  useRealtimeSync({
    events: ['songs:changed', 'practices:changed'],
    bandId: currentBandId || '',
    onSync: () => {
      // Reload practice session and songs when changes are detected
      loadData()
    },
  })

  // Timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(prev => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Body scroll prevention
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [canGoPrev, canGoNext, songs.length, navigate, practiceId])

  // Navigation handlers
  const handlePrev = useCallback(() => {
    if (canGoPrev) setCurrentIndex(i => i - 1)
  }, [canGoPrev])

  const handleNext = useCallback(() => {
    if (canGoNext) setCurrentIndex(i => i + 1)
  }, [canGoNext])

  const handleExit = useCallback(() => {
    navigate(`/practices/${practiceId}`)
  }, [navigate, practiceId])

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 md:left-60 bg-[#0f0f0f] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f17827ff] mx-auto mb-4"></div>
          <p className="text-[#a0a0a0] text-sm">Loading practice session...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="fixed inset-0 md:left-60 bg-[#0f0f0f] flex items-center justify-center">
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

  return (
    <div className="fixed inset-0 md:left-60 bg-[#0f0f0f] flex flex-col">
      {/* Header - Now shows song title and artist */}
      <header className="bg-[#0a0a0a] border-b border-[#2a2a2a] px-4 py-3">
        <div className="flex items-center justify-between">
          <button
            onClick={handleExit}
            className="flex items-center gap-2 text-[#a0a0a0] hover:text-white transition-colors p-2 -ml-2"
            data-testid="session-exit-button"
            aria-label="Exit session"
          >
            <ArrowLeft size={20} />
          </button>

          {/* Song title and artist in center */}
          <div className="flex-1 text-center min-w-0 px-2">
            <h1
              className="text-white font-bold text-lg sm:text-xl truncate"
              data-testid="session-song-title"
            >
              {currentSong.title}
            </h1>
            {currentSong.artist && (
              <p
                className="text-[#707070] text-sm truncate"
                data-testid="session-song-artist"
              >
                {currentSong.artist}
              </p>
            )}
          </div>

          {/* Timer */}
          <div
            className="flex items-center gap-1.5 text-[#a0a0a0] bg-[#1a1a1a] px-2.5 py-1.5 rounded-lg"
            data-testid="session-timer"
          >
            <Clock size={14} />
            <span className="font-mono text-sm">
              {formatTimer(elapsedSeconds)}
            </span>
          </div>
        </div>
      </header>

      {/* Progress Dots */}
      <div className="bg-[#0a0a0a] border-b border-[#2a2a2a]">
        <ProgressDots currentIndex={currentIndex} totalSongs={songs.length} />
      </div>

      {/* Main Content - Song metadata and notes */}
      <SongDisplay song={currentSong} />

      {/* Navigation with next song preview in center */}
      <SessionNavigation
        currentIndex={currentIndex}
        totalSongs={songs.length}
        onPrev={handlePrev}
        onNext={handleNext}
        onEnd={handleExit}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        isLastSong={!canGoNext}
        nextSong={nextSong}
        currentTuning={currentSong.guitarTuning}
      />
    </div>
  )
}
