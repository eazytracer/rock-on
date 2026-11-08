/**
 * Practice session (FP 7–8, Practice 2–4; desktop full-window session): a
 * stage screen. Big Prev / Next name the song they go to; on the last song Next
 * becomes End practice. Notes is a button: a sheet on phones, a side panel from
 * tablet up. The Up next card turns warn when the tuning changes. The screen
 * stays awake; ← → / PgUp PgDn (pedals) change songs, N opens notes.
 * Ending shows the wrap-up (time played, songs reached, skipped marked) and
 * saves it with shared wrap-up notes.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Lock,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { usePracticePage } from '../hooks/useCalendar'
import { usePersonalNote } from '../hooks/useNotes'
import { MarkdownRenderer } from '../components/notes/MarkdownRenderer'
import { ForkIcon } from '../components/setlists/SetlistStats'
import { Button, Sheet, TuningPill } from '../components/ui'
import { repository } from '../services/data/RepositoryFactory'
import { hoursMinutes, practiceTitle } from '../domain/calendar'
import { songLength } from '../domain/setlist'
import { showKey } from '../domain/format'
import { canonicalTuningId } from '../utils/tunings'
import type { Song } from '../models/Song'
import type { SessionSong } from '../types'
import { createLogger } from '../utils/logger'

const log = createLogger('PracticeSessionPage')

const SIZES = ['text-[17px]', 'text-[20px]', 'text-[24px]', 'text-[29px]']
const SIZE_KEY = 'practice-session-text-size'

const clock = (s: number) => {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** Keeps the screen on while mounted (re-acquired when the tab comes back). */
function useWakeLock() {
  useEffect(() => {
    type Sentinel = { release: () => Promise<void> }
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: 'screen') => Promise<Sentinel> }
    }
    let lock: Sentinel | null = null
    const take = () => {
      if (document.visibilityState !== 'visible' || !nav.wakeLock) return
      nav.wakeLock
        .request('screen')
        .then(l => (lock = l))
        .catch(() => {})
    }
    take()
    document.addEventListener('visibilitychange', take)
    return () => {
      document.removeEventListener('visibilitychange', take)
      void lock?.release().catch(() => {})
    }
  }, [])
}

/** Band notes and my notes for the current song. */
const SongNotes: React.FC<{
  song: Song
  userId: string
  bandId: string
  size: string
}> = ({ song, userId, bandId, size }) => {
  const { personalNote } = usePersonalNote(song.id!, userId, bandId)
  const mine = personalNote?.content?.trim()
  const band = song.notes?.trim()
  const head =
    'flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[.12em] text-ink-3 mb-2'
  if (!band && !mine)
    return (
      <p className="text-ink-3 text-[15px]" data-testid="session-notes-empty">
        No notes for this song yet.
      </p>
    )
  return (
    <div className={`space-y-5 ${size} leading-snug text-ink-1`}>
      {band && (
        <section data-testid="session-band-notes">
          <p className={head}>
            <Users size={13} /> Band notes
          </p>
          <MarkdownRenderer content={band} />
        </section>
      )}
      {mine && (
        <section data-testid="session-my-notes">
          <p className={head}>
            <Lock size={13} /> My notes
          </p>
          <MarkdownRenderer content={mine} />
        </section>
      )}
    </div>
  )
}

export const PracticeSessionPage: React.FC = () => {
  const { practiceId = '' } = useParams<{ practiceId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const { currentUser } = useAuth()
  const { practice, songsById, loading } = usePracticePage(practiceId)
  const wide =
    typeof window !== 'undefined' &&
    window.matchMedia('(min-width: 768px)').matches
  const [index, setIndex] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [notesOpen, setNotesOpen] = useState(wide)
  const [ending, setEnding] = useState(false)
  const [wrapNotes, setWrapNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [size, setSize] = useState(() => {
    try {
      const n = Number(localStorage.getItem(SIZE_KEY))
      return n >= 0 && n < SIZES.length ? n : 1
    } catch {
      return 1
    }
  })
  // Seconds spent per song and which songs were reached.
  const spent = useRef<number[]>([])
  const reached = useRef<Set<number>>(new Set([0]))
  const songStart = useRef(Date.now())
  const startedAt = useRef(new Date())

  useWakeLock()

  const items: { ps: SessionSong; song: Song }[] = useMemo(
    () =>
      (practice?.songs ?? []).flatMap(ps => {
        const song = songsById.get(ps.songId)
        return song ? [{ ps, song }] : []
      }),
    [practice?.songs, songsById]
  )
  const count = items.length

  useEffect(() => {
    const t = setInterval(
      () =>
        setElapsed(
          Math.floor((Date.now() - startedAt.current.getTime()) / 1000)
        ),
      1000
    )
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(SIZE_KEY, String(size))
    } catch {
      /* per-viewer convenience only */
    }
  }, [size])

  // Record the session's start once the practice is loaded.
  const started = useRef(false)
  useEffect(() => {
    if (!practice || started.current) return
    started.current = true
    if (practice.startTime) return
    void repository
      .updatePracticeSession(practice.id, { startTime: startedAt.current })
      .catch(err => log.error('Record start failed', err))
  }, [practice])

  const go = useCallback(
    (to: number) => {
      if (to < 0 || to >= count || to === index) return
      spent.current[index] =
        (spent.current[index] ?? 0) + (Date.now() - songStart.current) / 1000
      songStart.current = Date.now()
      reached.current.add(to)
      setIndex(to)
    },
    [count, index]
  )

  const end = useCallback(() => {
    spent.current[index] =
      (spent.current[index] ?? 0) + (Date.now() - songStart.current) / 1000
    songStart.current = Date.now()
    setEnding(true)
  }, [index])

  const exit = () => navigate(`/practices/${practiceId}`)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (ending || t.tagName === 'TEXTAREA' || t.tagName === 'INPUT') return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault()
        if (index === count - 1) end()
        else go(index + 1)
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        go(index - 1)
      } else if (e.key === 'n' || e.key === 'N') {
        setNotesOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, end, index, count, ending])

  const saveWrapUp = async () => {
    if (!practice || saving) return
    setSaving(true)
    const songs: SessionSong[] = practice.songs.map(ps => {
      const i = items.findIndex(x => x.ps === ps)
      if (i < 0) return ps
      return {
        ...ps,
        timeSpent: Math.round((ps.timeSpent ?? 0) + (spent.current[i] ?? 0)),
        status: reached.current.has(i) ? 'completed' : 'skipped',
      }
    })
    try {
      await repository.updatePracticeSession(practice.id, {
        startTime: practice.startTime ?? startedAt.current,
        endTime: new Date(),
        wrapupNotes: wrapNotes.trim() || undefined,
        songs,
      })
      void queryClient.invalidateQueries({ queryKey: ['practices'] })
      void queryClient.invalidateQueries({ queryKey: ['calendar'] })
      showToast('Practice saved', 'success')
      exit()
    } catch (err) {
      log.error('Save wrap-up failed', err)
      showToast("That didn't save. Try again.", 'error')
      setSaving(false)
    }
  }

  const shell = (children: React.ReactNode) => (
    <div
      className="fixed inset-0 z-[55] bg-bg-0 text-ink-1 flex flex-col"
      data-testid="practice-session-page"
    >
      {children}
    </div>
  )

  if (loading) return shell(<div className="flex-1" />)
  if (!practice || count === 0)
    return shell(
      <div className="m-auto text-center px-6" data-testid="session-empty">
        <b className="block text-lg mb-1">
          {practice ? 'No songs in this practice' : 'This practice was deleted'}
        </b>
        <p className="text-ink-3 mb-4">
          {practice
            ? 'Add songs to the practice first.'
            : "It's no longer on the calendar."}
        </p>
        <Button onClick={exit}>Back</Button>
      </div>
    )

  const cur = items[index]
  const prev = items[index - 1]
  const next = items[index + 1]
  const last = index === count - 1
  const retune =
    next &&
    canonicalTuningId(next.song.guitarTuning) !==
      canonicalTuningId(cur.song.guitarTuning)

  const facts = (
    <div className="flex items-end gap-5 font-mono" data-testid="session-facts">
      {cur.song.guitarTuning && (
        <TuningPill tuning={cur.song.guitarTuning} size="lg" />
      )}
      {[
        ['Key', cur.song.key ? showKey(cur.song.key) : '—'],
        ['BPM', cur.song.bpm ? String(cur.song.bpm) : '—'],
        ['Length', songLength(cur.song.duration)],
      ].map(([k, v]) => (
        <span key={k} className="flex flex-col">
          <small className="text-[10px] uppercase tracking-[.12em] text-ink-3">
            {k}
          </small>
          <b className="text-[19px] text-ink-1">{v}</b>
        </span>
      ))}
    </div>
  )

  const upNext = next ? (
    <div
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${
        retune
          ? 'bg-warn/10 shadow-[inset_0_0_0_1.5px_rgb(var(--warn-rgb))]'
          : 'bg-bg-2'
      }`}
      data-testid="session-up-next"
      data-retune={retune || undefined}
    >
      <span className="flex-1 min-w-0">
        <small
          className={`block font-mono text-[10.5px] uppercase tracking-[.12em] ${
            retune ? 'text-warn' : 'text-ink-3'
          }`}
        >
          Up next{retune && ' · tuning change'}
        </small>
        <b className="block text-[16px] truncate">{next.song.title}</b>
        {retune && (
          <span className="flex items-center gap-1.5 mt-1">
            <TuningPill
              tuning={cur.song.guitarTuning || 'Standard'}
              size="sm"
            />
            <span className="text-ink-3">→</span>
            <TuningPill
              tuning={next.song.guitarTuning || 'Standard'}
              size="sm"
            />
          </span>
        )}
      </span>
      {retune && (
        <Button
          size="md"
          disabled
          title="Tuner arrives with Tools"
          icon={<ForkIcon size={16} />}
          className="bg-warn text-bg-0"
          data-testid="session-tune-now"
        >
          Tune now
        </Button>
      )}
    </div>
  ) : (
    <div
      className="rounded-2xl bg-bg-2 px-4 py-3 text-[14px] text-ink-3"
      data-testid="session-up-next"
    >
      Last song. Next ends the practice.
    </div>
  )

  const navButtons = (
    <div className="grid grid-cols-[1fr_1.6fr] gap-2.5">
      <button
        type="button"
        onClick={() => go(index - 1)}
        disabled={!prev}
        className="flex flex-col items-center justify-center gap-1 h-24 rounded-[22px] bg-bg-3 text-ink-1 disabled:opacity-35"
        data-testid="session-prev"
      >
        <ChevronLeft size={26} />
        <span className="font-mono text-[11px] uppercase tracking-[.1em] text-ink-2 truncate max-w-[90%]">
          {prev ? prev.song.title : 'Start'}
        </span>
      </button>
      <button
        type="button"
        onClick={() => (last ? end() : go(index + 1))}
        className="flex flex-col items-center justify-center gap-1 h-24 rounded-[22px] bg-accent text-on-accent"
        data-testid="session-next"
      >
        {last ? <Check size={26} /> : <ChevronRight size={26} />}
        <span className="font-mono text-[11px] uppercase tracking-[.1em] truncate max-w-[90%]">
          {last ? 'End practice' : next.song.title}
        </span>
      </button>
    </div>
  )

  const sizeControl = (
    <span className="flex items-center rounded-full bg-bg-3">
      <button
        type="button"
        aria-label="Smaller text"
        onClick={() => setSize(s => Math.max(0, s - 1))}
        className="w-11 h-11 text-[13px] font-bold"
        data-testid="session-text-smaller"
      >
        A
      </button>
      <button
        type="button"
        aria-label="Larger text"
        onClick={() => setSize(s => Math.min(SIZES.length - 1, s + 1))}
        className="w-11 h-11 text-[19px] font-bold"
        data-testid="session-text-larger"
      >
        A
      </button>
    </span>
  )

  const toolButtons = (
    <div className="flex items-center gap-2">
      <Button
        size="md"
        icon={<FileText size={16} />}
        onClick={() => setNotesOpen(o => !o)}
        className={
          notesOpen && wide
            ? 'shadow-[inset_0_0_0_1.5px_rgb(var(--accent-rgb))]'
            : ''
        }
        aria-pressed={notesOpen}
        data-testid="session-notes-toggle"
      >
        Notes
      </Button>
      <Button
        size="md"
        disabled
        title="Charts arrive with Tools"
        data-testid="session-chart"
      >
        Chart
      </Button>
      <Button
        size="md"
        disabled
        title="Tuner arrives with Tools"
        icon={<ForkIcon size={15} />}
        data-testid="session-tune"
      >
        Tune
      </Button>
      {wide && <span className="ml-auto">{sizeControl}</span>}
    </div>
  )

  const practiceNote = cur.ps.notes && (
    <p
      className="flex items-start gap-2 text-[15px] text-ink-2"
      data-testid="session-practice-note"
    >
      <FileText size={16} className="mt-0.5 shrink-0 text-ink-3" />
      {cur.ps.notes}
    </p>
  )

  const notes = (
    <SongNotes
      song={cur.song}
      userId={currentUser?.id ?? ''}
      bandId={practice.bandId}
      size={SIZES[size]}
    />
  )

  const reachedList = items.map((x, i) => ({
    title: x.song.title,
    min: Math.round((spent.current[i] ?? 0) / 60),
    hit: reached.current.has(i),
  }))

  return shell(
    <>
      <header className="flex items-center gap-3 px-4 md:px-6 pt-[max(12px,env(safe-area-inset-top))] pb-2">
        <button
          type="button"
          aria-label="Leave session"
          onClick={exit}
          className="grid place-items-center w-11 h-11 rounded-full bg-bg-2 shrink-0"
          data-testid="session-exit"
        >
          <X size={19} />
        </button>
        <div className="flex-1 text-center md:text-left md:flex md:items-baseline md:gap-3 font-mono">
          <small
            className="block text-[11px] uppercase tracking-[.14em] text-ink-3"
            data-testid="session-position"
          >
            Song {index + 1} of {count}
          </small>
          <b className="text-[20px]" data-testid="session-elapsed">
            {clock(elapsed)}
          </b>
        </div>
        <Button size="md" onClick={end} data-testid="session-end">
          End
        </Button>
      </header>
      <div className="flex gap-1.5 px-4 md:px-6 pb-3" aria-hidden>
        {items.map((_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full ${
              i === index
                ? 'bg-accent'
                : reached.current.has(i)
                  ? 'bg-ink-3'
                  : 'bg-bg-3'
            }`}
          />
        ))}
      </div>

      {wide ? (
        <div className="flex-1 min-h-0 flex gap-8 px-6">
          <div className="w-[min(42%,460px)] shrink-0 flex flex-col gap-4 min-h-0">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[.14em] text-ink-3">
                {cur.song.artist}
              </p>
              <h1
                className="font-display font-extrabold uppercase leading-[.9] text-[64px] break-words"
                data-testid="session-title"
              >
                {cur.song.title}
              </h1>
            </div>
            {facts}
            {practiceNote}
            {toolButtons}
            <div className="mt-auto pb-3">{upNext}</div>
          </div>
          {notesOpen && (
            <div
              className="flex-1 min-w-0 overflow-y-auto custom-scrollbar pb-6"
              data-testid="session-notes-panel"
            >
              {notes}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar-thin px-4 flex flex-col gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[.14em] text-ink-3">
              {cur.song.artist}
            </p>
            <h1
              className="font-display font-extrabold uppercase leading-[.9] text-[48px] break-words"
              data-testid="session-title"
            >
              {cur.song.title}
            </h1>
          </div>
          {facts}
          {toolButtons}
          {practiceNote}
          <div className="mt-auto">{upNext}</div>
        </div>
      )}

      <footer className="px-4 md:px-6 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
        {navButtons}
      </footer>

      {notesOpen && !wide && (
        <Sheet
          onClose={() => setNotesOpen(false)}
          title={cur.song.title}
          sub="Notes"
          data-testid="session-notes-sheet"
        >
          <div className="flex justify-end -mt-1 mb-2">{sizeControl}</div>
          <div className="pb-5 max-h-[55vh] overflow-y-auto custom-scrollbar-thin">
            {notes}
          </div>
        </Sheet>
      )}

      {ending && (
        <Sheet
          onClose={() => setEnding(false)}
          title="Practice done"
          sub={practiceTitle(practice.name, new Date(practice.scheduledDate))}
          width={440}
          data-testid="session-wrapup"
        >
          <div className="pb-5">
            <p
              className="font-mono text-[13px] text-ink-2 mb-3"
              data-testid="session-wrapup-summary"
            >
              {hoursMinutes(elapsed / 60)} played ·{' '}
              {reachedList.filter(r => r.hit).length} of {count} songs
            </p>
            <div className="max-h-[32vh] overflow-y-auto custom-scrollbar-thin -mx-1 mb-3">
              {reachedList.map((r, i) => (
                <div key={i} className="flex items-center gap-3 px-1 py-1.5">
                  <span
                    className={`grid place-items-center w-6 h-6 rounded-full shrink-0 ${
                      r.hit ? 'bg-success text-white' : 'bg-bg-3'
                    }`}
                  >
                    {r.hit && <Check size={14} strokeWidth={3} />}
                  </span>
                  <span
                    className={`flex-1 truncate ${r.hit ? 'text-ink-1' : 'text-ink-3'}`}
                  >
                    {r.title}
                  </span>
                  <span className="font-mono text-[12px] text-ink-3">
                    {r.hit ? `${r.min} min` : 'skipped'}
                  </span>
                </div>
              ))}
            </div>
            <label
              htmlFor="session-wrapup-notes"
              className="block font-mono text-[10.5px] uppercase tracking-[.12em] text-ink-3 mb-1.5"
            >
              Wrap-up notes · shared with the band
            </label>
            <textarea
              id="session-wrapup-notes"
              name="wrapupNotes"
              data-testid="session-wrapup-notes"
              value={wrapNotes}
              onChange={e => setWrapNotes(e.target.value)}
              rows={3}
              placeholder="What's tight now, what needs another run"
              className="w-full px-3.5 py-2.5 rounded-xl bg-bg-3 text-[15px] text-ink-1 placeholder:text-ink-4 outline-none resize-none custom-scrollbar-thin"
            />
            <div className="grid grid-cols-2 gap-2.5 mt-3">
              <Button
                size="lg"
                onClick={() => setEnding(false)}
                data-testid="session-wrapup-back"
              >
                Back
              </Button>
              <Button
                variant="primary"
                size="lg"
                onClick={saveWrapUp}
                disabled={saving}
                data-testid="session-wrapup-save"
              >
                Save wrap-up
              </Button>
            </div>
          </div>
        </Sheet>
      )}
    </>
  )
}

export default PracticeSessionPage
