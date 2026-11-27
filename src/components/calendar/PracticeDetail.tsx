/**
 * The practice (Practice 1, FP 5), edited in place like a setlist with a few
 * more fields: name, date, start, end, where and focus save as you go, and the
 * songs drag by the grip, × out, and each takes a note for this practice. New
 * practice is this page blank: the first change creates it. Status comes from
 * the time, never a field. Start practice session is docked. Used full page
 * (`/practices/:id`, `/practices/new`) and in the desktop calendar's pane.
 */
import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Copy, Maximize2, Plus, Play, Trash2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useConfirm } from '../../hooks/useConfirm'
import {
  createPractice,
  duplicatePractice,
  usePracticePage,
} from '../../hooks/useCalendar'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { DatePicker } from '../common/DatePicker'
import { TimePickerDropdown } from '../common/TimePickerDropdown'
import { Button, Sheet, SheetItem, TypeLabel } from '../ui'
import { NotesSheet } from '../setlists/SetlistSheets'
import { EndPicker } from './EndPicker'
import { PracticeSongRows } from './PracticeSongRows'
import { AddSongsRow } from '../setlists/SongBrowser'
import { repository } from '../../services/data/RepositoryFactory'
import { errorText } from '../../services/api/errors'
import {
  countdown,
  defaultPracticeDate,
  hoursMinutes,
  practiceStatus,
  practiceTitle,
} from '../../domain/calendar'
import {
  formatDateForInput,
  formatTime12Hour,
  parseDateInputAsLocal,
  parseTime12Hour,
} from '../../utils/dateHelpers'
import type { PracticeSession } from '../../models/PracticeSession'
import { DockAction } from '../layout/PhoneDock'
import { MoreButton } from '../common/MoreButton'
import { songHref } from '../../utils/songOrigin'
import { SongPane } from '../songs/SongPane'
import { useMediaQuery } from '../../hooks/useResponsive'
import { createLogger } from '../../utils/logger'

const log = createLogger('PracticeDetail')

const label =
  'block font-mono text-[10.5px] font-medium uppercase tracking-[.12em] text-ink-3 mb-1.5'
const input =
  'w-full h-11 px-3.5 rounded-xl bg-bg-3 text-[15px] text-ink-1 placeholder:text-ink-4 outline-none focus:shadow-[inset_0_0_0_1.5px_rgb(var(--accent-rgb))]'
const groupLabel =
  'flex items-center px-3 pt-4 pb-2 font-mono text-[10.5px] font-medium uppercase tracking-[.12em] text-ink-3'
const card = 'rounded-[20px] bg-bg-2 shadow-group'

export interface PracticeDetailProps {
  /** null = a new, blank practice. */
  practiceId: string | null
  bandId: string
  variant: 'page' | 'pane'
  /** The blank practice was saved for the first time. */
  onCreated: (practiceId: string) => void
  /** Deleted: leave the page / clear the pane. */
  onGone: () => void
  /** Open the song browser (the page shows it; the pane opens the page). */
  onAddSongs: (practiceId: string | null) => void
}

export const PracticeDetail: React.FC<PracticeDetailProps> = ({
  practiceId,
  bandId,
  variant,
  onCreated,
  onGone,
  onAddSongs,
}) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { currentUser } = useAuth()
  const { showToast } = useToast()
  const { confirm, dialogProps } = useConfirm()
  const {
    practice: saved,
    songsById,
    loading,
    error,
    save: update,
  } = usePracticePage(practiceId)
  const [sheet, setSheet] = useState<null | 'menu' | { note: number }>(null)
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)
  const [creating, setCreating] = useState(false)
  // The song pane (page, from 1440 px): a click previews, a double-click opens.
  const hasPane = useMediaQuery('(min-width: 1440px)') && variant === 'page'
  const [paneId, setPaneId] = useState<string | null>(null)
  const now = useMemo(() => new Date(), [])
  const draftDate = useMemo(() => defaultPracticeDate(now), [now])

  // A blank practice reads like one with defaults until it's saved.
  const practice: PracticeSession =
    saved ??
    ({
      id: '',
      bandId,
      name: '',
      scheduledDate: draftDate,
      duration: 120,
      location: '',
      notes: '',
      songs: [],
    } as unknown as PracticeSession)
  const isNew = !practiceId

  const fail = (what: string) => (err: unknown) => {
    log.error(what, err)
    showToast(errorText(err), 'error')
  }

  /** Save fields; the first save of a blank practice creates it. */
  const save = async (patch: Partial<PracticeSession>) => {
    if (!isNew) return update(patch).catch(fail('Save practice failed'))
    if (creating) return
    setCreating(true)
    try {
      const id = await createPractice(bandId, currentUser?.id, {
        scheduledDate: draftDate,
        ...patch,
      })
      void queryClient.invalidateQueries({ queryKey: ['practices'] })
      void queryClient.invalidateQueries({ queryKey: ['calendar'] })
      onCreated(id)
    } catch (err) {
      fail('Create practice failed')(err)
    } finally {
      setCreating(false)
    }
  }

  if (!isNew && loading)
    return <div className="h-64" data-testid="practice-loading" />
  if (!isNew && (error || !saved))
    return (
      <div className="py-16 text-center" data-testid="practice-missing">
        <b className="block text-lg text-ink-1 mb-1">
          This practice was deleted.
        </b>
        <p className="text-ink-3 mb-4">It's no longer on the calendar.</p>
        <Button onClick={onGone}>Back to Calendar</Button>
      </div>
    )

  const at = new Date(practice.scheduledDate)
  const minutes = practice.duration || 120
  const status = practiceStatus(at, minutes, now)
  const title = practiceTitle(practice.name, at)
  const page = variant === 'page'
  const paneSong =
    hasPane && paneId && practice.songs.some(s => s.songId === paneId)
      ? songsById.get(paneId)
      : undefined
  const played =
    practice.startTime && practice.endTime
      ? (new Date(practice.endTime).getTime() -
          new Date(practice.startTime).getTime()) /
        60000
      : null
  // Wrap-up once it was played in a session or its time has passed; its notes
  // edit in place.
  const wrapUp = !isNew && (played !== null || status === 'done')
  const reached = practice.songs.filter(s => s.status === 'completed').length
  const total = Math.round(
    practice.songs.reduce(
      (t, ps) => t + (songsById.get(ps.songId)?.duration ?? 0),
      0
    ) / 60
  )
  const over = total > minutes

  const setWhen = (dateStr: string, time: string) =>
    void save({
      scheduledDate: parseTime12Hour(time, parseDateInputAsLocal(dateStr)),
    })

  const remove = async () => {
    setSheet(null)
    const ok = await confirm({
      title: `Delete ${title}?`,
      message:
        'The practice and its song list go. The songs stay in your catalog.',
      confirmLabel: 'Delete',
      cancelLabel: 'Keep',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await repository.deletePracticeSession(practice.id)
      void queryClient.invalidateQueries({ queryKey: ['calendar'] })
      showToast(`Deleted ${title}`, 'success')
      onGone()
    } catch (err) {
      fail('Delete practice failed')(err)
    }
  }

  const duplicate = async () => {
    setSheet(null)
    try {
      const id = await duplicatePractice(practice.id, currentUser?.id)
      void queryClient.invalidateQueries({ queryKey: ['calendar'] })
      showToast(`Duplicated ${title}, a week later`, 'success')
      navigate(`/practices/${id}`)
    } catch (err) {
      fail('Duplicate practice failed')(err)
    }
  }

  const saveNote = (i: number, notes: string) =>
    void save({
      songs: practice.songs.map((s, j) => (j === i ? { ...s, notes } : s)),
    })

  const kicker = isNew
    ? 'New · saves as you go'
    : status === 'done'
      ? `Done · ${countdown(at, now).replace('Tonight', 'today')}`
      : status === 'now'
        ? 'Now'
        : `Upcoming · ${countdown(at, now).replace('Tonight', 'today')}`

  // Full page: in the phone dock beside the tucked tab bar; from tablet up,
  // after the songs and stuck to the bottom of the screen until you scroll
  // there, over a fade. Pane: under the title, so it's in view without
  // scrolling.
  const startButton = !isNew && (
    <div
      className={
        page
          ? 'w-full md:sticky md:bottom-0 md:z-20 md:mt-2 md:pt-6 md:pb-5 md:bg-gradient-to-t md:from-bg-1 md:from-60% md:to-transparent'
          : 'mt-4'
      }
    >
      <Button
        variant="primary"
        size="lg"
        fullWidth
        icon={<Play size={18} className="fill-current" />}
        onClick={() => navigate(`/practices/${practice.id}/session`)}
        disabled={practice.songs.length === 0}
        data-testid="practice-start-session"
      >
        Start practice session
      </Button>
    </div>
  )

  // ⋯ ends the first line under the name, so the name keeps the full width.
  const menu = !isNew && (
    <span className="ml-auto -mt-3 -mb-2 normal-case tracking-normal">
      <MoreButton
        label="Practice menu"
        onClick={e => {
          const r = e.currentTarget.getBoundingClientRect()
          setMenuAt({ x: r.right - 288, y: r.bottom + 8 })
          setSheet('menu')
        }}
        data-testid="practice-menu"
      />
    </span>
  )

  return (
    <div
      data-testid="practice-detail"
      className={paneSong ? 'min-[1440px]:mr-[400px] 2xl:mr-[480px]' : ''}
      data-practice-id={practice.id || undefined}
      data-status={isNew ? 'new' : status}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[.12em] mb-1.5">
            {status === 'done' || isNew ? (
              <>
                <TypeLabel type="practice" />
                <span className="text-ink-3">·</span>
              </>
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            )}
            <span
              className={
                status === 'done' || isNew ? 'text-ink-3' : 'text-accent-ink'
              }
              data-testid="practice-kicker"
            >
              {kicker}
            </span>
          </p>
          <NameInput
            name={practice.name ?? ''}
            fallback={practiceTitle(null, at)}
            big={page}
            onCommit={name => void save({ name })}
          />
        </div>
        {!page && !isNew && (
          <button
            type="button"
            onClick={() => navigate(`/practices/${practice.id}`)}
            className="shrink-0 h-10 px-3.5 rounded-full bg-bg-3 text-ink-1 font-semibold flex items-center gap-1.5 hover:bg-bg-4"
            data-testid="practice-pane-open"
          >
            <Maximize2 size={15} /> Open
          </button>
        )}
        {page && (
          <span className="hidden md:block shrink-0">
            <Button
              variant="primary"
              size="md"
              icon={<Plus size={17} />}
              onClick={() => onAddSongs(practice.id || null)}
              className="h-11"
              data-testid="practice-header-add-songs"
            >
              Add songs
            </Button>
          </span>
        )}
      </div>
      {!page && startButton}

      {wrapUp && (
        <>
          <label htmlFor="practice-wrapup-notes" className={groupLabel}>
            Wrap-up{menu}
          </label>
          {played !== null && (
            <p
              className="px-1 pb-2 font-mono text-[12.5px] text-ink-2"
              data-testid="practice-wrapup"
            >
              {hoursMinutes(played)} played · {reached} of{' '}
              {practice.songs.length} songs
            </p>
          )}
          <NotesField
            id="practice-wrapup-notes"
            name="wrapupNotes"
            value={practice.wrapupNotes ?? ''}
            placeholder="What's tight now, what needs another run"
            onCommit={wrapupNotes => void save({ wrapupNotes })}
          />
        </>
      )}

      <p className={groupLabel}>
        When and where
        {!wrapUp && menu}
      </p>
      <div
        className={`${card} p-4 grid grid-cols-2 gap-3 ${page ? 'xl:grid-cols-4' : ''}`}
        data-testid="practice-when"
      >
        <div>
          <span className={label}>Date</span>
          <DatePicker
            value={formatDateForInput(at)}
            onChange={d => d && setWhen(d, formatTime12Hour(at))}
            name="practiceDate"
            id="practice-date"
            data-testid="practice-date-input"
          />
        </div>
        <div>
          <span className={label}>Start</span>
          <TimePickerDropdown
            value={formatTime12Hour(at)}
            onChange={t => setWhen(formatDateForInput(at), t)}
            name="practiceStart"
            id="practice-start"
            data-testid="practice-start-input"
          />
        </div>
        <div>
          <span className={label}>End</span>
          <EndPicker
            start={at}
            minutes={minutes}
            onChange={m => void save({ duration: m })}
            className={input}
          />
        </div>
        <TextField
          id="practice-location"
          name="practiceLocation"
          label="Where"
          value={practice.location ?? ''}
          placeholder="Mike's Garage"
          onCommit={location => void save({ location })}
        />
      </div>

      <label htmlFor="practice-focus" className={groupLabel}>
        Focus
      </label>
      <NotesField
        id="practice-focus"
        name="practiceFocus"
        placeholder="What do you want to get out of this one?"
        value={practice.notes ?? ''}
        onCommit={notes => void save({ notes })}
      />

      <p className={groupLabel}>
        Songs · {practice.songs.length}
        {practice.songs.length > 0 && (
          <span
            className={`ml-1.5 ${over ? 'text-warn' : ''}`}
            data-testid="practice-songs-total"
            data-over={over || undefined}
          >
            · {total} of {minutes} min
          </span>
        )}
      </p>
      {practice.songs.length > 0 && (
        <PracticeSongRows
          songs={practice.songs}
          songsById={songsById}
          onChange={songs => void save({ songs })}
          onOpenSong={id =>
            navigate(songHref(id, { kind: 'practice', id: practice.id }))
          }
          onNote={i => setSheet({ note: i })}
          selectedId={paneSong ? paneId : null}
          onSelect={hasPane ? setPaneId : undefined}
        />
      )}
      <AddSongsRow
        onClick={() => onAddSongs(practice.id || null)}
        className={practice.songs.length ? 'mt-3' : ''}
        data-testid="practice-add-songs"
      />

      {page && startButton && <DockAction>{startButton}</DockAction>}

      {sheet === 'menu' && (
        <Sheet
          onClose={() => setSheet(null)}
          at={menuAt}
          title={title}
          data-testid="practice-menu-sheet"
        >
          <div role="menu" className="pb-1">
            <SheetItem
              icon={<Copy size={18} />}
              label="Duplicate"
              hint="Same songs and place, a week later"
              onClick={duplicate}
              data-testid="practice-menu-duplicate"
            />
            <SheetItem
              icon={<Trash2 size={18} />}
              label="Delete…"
              danger
              onClick={remove}
              data-testid="practice-menu-delete"
            />
          </div>
        </Sheet>
      )}
      {sheet && typeof sheet === 'object' && (
        <NotesSheet
          title="Note for this practice"
          sub={songsById.get(practice.songs[sheet.note]?.songId)?.title}
          value={practice.songs[sheet.note]?.notes ?? ''}
          markdown={false}
          onSave={v => saveNote(sheet.note, v)}
          onClose={() => setSheet(null)}
          data-testid="practice-song-note-sheet"
        />
      )}
      {paneSong && (
        <SongPane
          song={paneSong}
          userId={currentUser?.id ?? ''}
          origin={{ kind: 'practice', id: practice.id }}
          onClose={() => setPaneId(null)}
        />
      )}
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}

/** The title is the name, edited in place; empty falls back to the date. */
const NameInput: React.FC<{
  name: string
  fallback: string
  big: boolean
  onCommit: (name: string) => void
}> = ({ name, fallback, big, onCommit }) => {
  const [v, setV] = useState(name)
  useEffect(() => setV(name), [name])
  return (
    <input
      name="practiceName"
      id="practice-name"
      aria-label="Practice name"
      data-testid="practice-name-input"
      value={v}
      placeholder={fallback}
      onChange={e => setV(e.target.value)}
      onBlur={() => v.trim() !== name && onCommit(v.trim())}
      onKeyDown={e =>
        e.key === 'Enter' && (e.target as HTMLInputElement).blur()
      }
      className={`w-full bg-transparent font-display font-extrabold uppercase leading-[.95] text-ink-1 placeholder:text-ink-3 outline-none ${
        big ? 'text-[44px] md:text-[50px]' : 'text-[34px]'
      }`}
    />
  )
}

/** Focus, wrap-up notes: plain text, edited in place; it grows with its lines and saves on leave. */
const NotesField: React.FC<{
  id: string
  name: string
  placeholder: string
  value: string
  onCommit: (value: string) => void
}> = ({ id, name, placeholder, value, onCommit }) => {
  const [v, setV] = useState(value)
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => setV(value), [value])
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [v])
  return (
    <textarea
      ref={ref}
      id={id}
      name={name}
      data-testid={`${id}-input`}
      rows={2}
      value={v}
      placeholder={placeholder}
      onChange={e => setV(e.target.value)}
      onBlur={() => v.trim() !== value && onCommit(v.trim())}
      className={`${card} block w-full resize-none overflow-hidden px-4 py-3 text-[14.5px] leading-relaxed text-ink-1 placeholder:text-ink-4 outline-none focus:shadow-[inset_0_0_0_1.5px_rgb(var(--accent-rgb))]`}
    />
  )
}

/** A text field that saves when you leave it (or press Enter). */
const TextField: React.FC<{
  id: string
  name: string
  label: string
  value: string
  placeholder?: string
  onCommit: (value: string) => void
}> = ({ id, name, label: text, value, placeholder, onCommit }) => {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  return (
    <div>
      <label htmlFor={id} className={label}>
        {text}
      </label>
      <input
        id={id}
        name={name}
        data-testid={`${id}-input`}
        value={v}
        placeholder={placeholder}
        onChange={e => setV(e.target.value)}
        onBlur={() => v.trim() !== value && onCommit(v.trim())}
        onKeyDown={e =>
          e.key === 'Enter' && (e.target as HTMLInputElement).blur()
        }
        className={input}
      />
    </div>
  )
}
