/**
 * New / duplicate / edit practice (New Practice 1–3, desktop editor): one
 * editor for all three. Duplicate (`?from=<id>`) prefills a week later and
 * says where it came from. Start + End are lists; End shows each length and is
 * stored as the duration. Songs come from the song browser (filter by tuning or
 * setlist) and add up against the practice length.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Plus,
  Check,
  X,
} from 'lucide-react'
import { BandRequiredPrompt } from '../components/common/BandRequiredPrompt'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useConfirm } from '../hooks/useConfirm'
import { useMediaQuery } from '../hooks/useResponsive'
import { useSetlistIndex } from '../hooks/useSetlists'
import { useSongs } from '../hooks/useSongs'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { DatePicker } from '../components/common/DatePicker'
import { TimePickerDropdown } from '../components/common/TimePickerDropdown'
import { Button, Sheet, TuningPill } from '../components/ui'
import { SongBrowser } from '../components/setlists/SongBrowser'
import { repository } from '../services/data/RepositoryFactory'
import {
  defaultPracticeDate,
  endOptions,
  practiceTitle,
  weekLater,
} from '../domain/calendar'
import { songLength } from '../domain/setlist'
import {
  formatDateForInput,
  formatTime12Hour,
  parseDateInputAsLocal,
  parseTime12Hour,
} from '../utils/dateHelpers'
import type { PracticeSession } from '../models/PracticeSession'
import type { SessionSong } from '../types'
import { createLogger } from '../utils/logger'

const log = createLogger('PracticeEditorPage')

const label =
  'block font-mono text-[10.5px] font-medium uppercase tracking-[.12em] text-ink-3 mb-1.5'
const input =
  'w-full h-11 px-3.5 rounded-xl bg-bg-3 text-[15px] text-ink-1 placeholder:text-ink-4 outline-none focus:shadow-[inset_0_0_0_1.5px_rgb(var(--accent-rgb))]'

interface Draft {
  name: string
  date: string
  start: string
  minutes: number
  location: string
  focus: string
  songs: SessionSong[]
}

const freshSong = (songId: string, notes?: string): SessionSong => ({
  songId,
  timeSpent: 0,
  status: 'not-started',
  notes,
  sectionsWorked: [],
  improvements: [],
  needsWork: [],
  memberRatings: [],
})

function draftFrom(p: PracticeSession, at: Date, fresh: boolean): Draft {
  return {
    name: p.name ?? '',
    date: formatDateForInput(at),
    start: formatTime12Hour(at),
    minutes: p.duration || 120,
    location: p.location ?? '',
    focus: p.notes ?? '',
    songs: fresh ? p.songs.map(s => freshSong(s.songId, s.notes)) : p.songs,
  }
}

/** End: a list starting after Start, each with its length; the value is minutes. */
const EndPicker: React.FC<{
  start: Date
  minutes: number
  onChange: (m: number) => void
}> = ({ start, minutes, onChange }) => {
  const [at, setAt] = useState<{ x: number; y: number } | null | false>(false)
  const desktop = useMediaQuery('(min-width: 768px)')
  const options = useMemo(() => endOptions(start), [start])
  const current = options.find(o => o.minutes === minutes)
  return (
    <>
      <button
        type="button"
        onClick={e => {
          const r = e.currentTarget.getBoundingClientRect()
          setAt(desktop ? { x: r.left, y: r.bottom + 6 } : null)
        }}
        className={input + ' flex items-center gap-2 text-left'}
        data-testid="practice-end-input"
        id="practice-end"
      >
        <Clock size={16} className="text-ink-3 shrink-0" />
        <span className="flex-1 truncate">
          {current ? (
            <>
              {current.label.replace(/ \(.*/, '')}{' '}
              <em className="not-italic text-ink-3">
                {current.label.match(/\(.*\)/)?.[0]}
              </em>
            </>
          ) : (
            `${minutes} min`
          )}
        </span>
        <ChevronDown size={16} className="text-ink-3" />
      </button>
      {at !== false && (
        <Sheet
          onClose={() => setAt(false)}
          at={at}
          title="Ends"
          width={260}
          data-testid="practice-end-sheet"
        >
          <div
            className="max-h-[50vh] overflow-y-auto custom-scrollbar-thin pb-1"
            ref={el =>
              el
                ?.querySelector('[aria-selected="true"]')
                ?.scrollIntoView({ block: 'center' })
            }
          >
            {options.map(o => (
              <button
                key={o.minutes}
                type="button"
                role="option"
                aria-selected={o.minutes === minutes}
                onClick={() => {
                  onChange(o.minutes)
                  setAt(false)
                }}
                className={`flex items-center w-full px-4 h-10 text-left text-[14.5px] hover:bg-bg-3 ${
                  o.minutes === minutes
                    ? 'text-accent-ink font-semibold'
                    : 'text-ink-1'
                }`}
                data-testid={`practice-end-option-${o.minutes}`}
              >
                {o.label}
                {o.minutes === minutes && (
                  <Check size={15} className="ml-auto" />
                )}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </>
  )
}

export const PracticeEditorPage: React.FC = () => {
  const { practiceId } = useParams<{ practiceId: string }>()
  const [params, setParams] = useSearchParams()
  const fromId = params.get('from')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const { confirm, dialogProps } = useConfirm()
  const { currentBand, currentBandId, currentUser } = useAuth()
  const bandId = currentBandId ?? ''
  const desktop = useMediaQuery('(min-width: 768px)')
  const { songs: catalog } = useSongs(bandId)
  const { rows: sets } = useSetlistIndex('band', bandId)
  const songsById = useMemo(
    () => new Map(catalog.map(s => [s.id!, s])),
    [catalog]
  )

  const mode: 'new' | 'edit' | 'duplicate' = practiceId
    ? 'edit'
    : fromId
      ? 'duplicate'
      : 'new'
  const [draft, setDraft] = useState<Draft | null>(null)
  const [initial, setInitial] = useState<string>('')
  const [source, setSource] = useState<{ title: string; when: string } | null>(
    null
  )
  const [saving, setSaving] = useState(false)
  const browsing = params.get('add') === '1'
  const setBrowsing = (on: boolean) => {
    const next = new URLSearchParams(params)
    if (on) next.set('add', '1')
    else next.delete('add')
    setParams(next, { replace: true })
  }

  useEffect(() => {
    let live = true
    const load = async () => {
      const now = new Date()
      if (mode === 'new') {
        const at = defaultPracticeDate(now)
        const d: Draft = {
          name: '',
          date: formatDateForInput(at),
          start: formatTime12Hour(at),
          minutes: 120,
          location: '',
          focus: '',
          songs: [],
        }
        if (!live) return
        setDraft(d)
        setInitial(JSON.stringify(d))
        return
      }
      const p = await repository.getPracticeSession((practiceId ?? fromId)!)
      if (!live) return
      if (!p) {
        showToast('That practice was deleted.', 'error')
        navigate('/calendar?type=practice', { replace: true })
        return
      }
      const at = new Date(p.scheduledDate)
      if (mode === 'duplicate') {
        setSource({
          title: practiceTitle(p.name, at),
          when: at.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          }),
        })
      }
      const d = draftFrom(
        p,
        mode === 'duplicate' ? weekLater(at) : at,
        mode === 'duplicate'
      )
      setDraft(d)
      setInitial(JSON.stringify(d))
    }
    load().catch(err => {
      log.error('Load practice failed', err)
      showToast("Couldn't load the practice.", 'error')
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceId, fromId])

  const startAt = useMemo(
    () =>
      draft
        ? parseTime12Hour(draft.start, parseDateInputAsLocal(draft.date))
        : new Date(),
    [draft]
  )
  const total = useMemo(() => {
    const s = (draft?.songs ?? []).reduce(
      (t, ps) => t + (songsById.get(ps.songId)?.duration ?? 0),
      0
    )
    return Math.round(s / 60)
  }, [draft?.songs, songsById])
  const inSet = useMemo(
    () => new Set((draft?.songs ?? []).map(s => s.songId)),
    [draft?.songs]
  )

  if (!currentBandId)
    return (
      <BandRequiredPrompt
        feature="Practices"
        testid="practices-band-required"
      />
    )
  if (!draft) return <div data-testid="practice-editor-page" className="h-64" />

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft({ ...draft, [k]: v })
  const dirty = JSON.stringify(draft) !== initial
  const title = {
    new: 'New practice',
    duplicate: 'Duplicate practice',
    edit: 'Edit practice',
  }[mode]
  const over = total > draft.minutes

  const leave = (id?: string) => {
    if (id) navigate(`/practices/${id}`, { replace: true })
    else if (practiceId) navigate(`/practices/${practiceId}`)
    else navigate('/calendar?type=practice')
  }

  const cancel = async () => {
    if (
      dirty &&
      !(await confirm({
        title:
          mode === 'edit' ? 'Discard your changes?' : 'Discard this practice?',
        message:
          mode === 'edit'
            ? 'The practice stays as it was.'
            : "It hasn't been saved.",
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        variant: 'danger',
      }))
    )
      return
    leave()
  }

  const save = async () => {
    if (saving) return
    if (draft.minutes < 15 || draft.minutes > 24 * 60) {
      showToast('End has to be after the start.', 'error')
      return
    }
    setSaving(true)
    const fields: Partial<PracticeSession> = {
      name: draft.name.trim(),
      scheduledDate: startAt,
      duration: draft.minutes,
      location: draft.location.trim(),
      notes: draft.focus,
      songs: draft.songs,
    }
    try {
      let id = practiceId
      if (id) {
        await repository.updatePracticeSession(id, fields)
      } else {
        const saved = await repository.addPracticeSession({
          id: crypto.randomUUID(),
          bandId,
          type: 'rehearsal',
          status: 'scheduled',
          objectives: [],
          completedObjectives: [],
          attendees: [],
          createdDate: new Date(),
          lastModifiedBy: currentUser?.id,
          ...fields,
        } as PracticeSession)
        id = saved.id
      }
      void queryClient.invalidateQueries({ queryKey: ['practices'] })
      void queryClient.invalidateQueries({ queryKey: ['calendar'] })
      showToast(
        `Practice saved · ${startAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`,
        'success'
      )
      setInitial(JSON.stringify(draft))
      leave(id)
    } catch (err) {
      log.error('Save practice failed', err)
      showToast("That didn't save. Try again.", 'error')
    } finally {
      setSaving(false)
    }
  }

  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= draft.songs.length) return
    const next = [...draft.songs]
    ;[next[i], next[j]] = [next[j], next[i]]
    set('songs', next)
  }

  const browser = (m: 'pane' | 'screen') => (
    <SongBrowser
      mode={m}
      setName={draft.name.trim() || practiceTitle(null, startAt)}
      contextType="band"
      contextId={bandId}
      userId={currentUser?.id ?? ''}
      catalogName={currentBand?.name ?? 'band'}
      inSet={inSet}
      otherSets={sets}
      withMine={false}
      onAdd={async ids => {
        setDraft(d =>
          d
            ? {
                ...d,
                songs: [
                  ...d.songs,
                  ...ids.filter(id => !inSet.has(id)).map(id => freshSong(id)),
                ],
              }
            : d
        )
        return true
      }}
      onRemove={async id => {
        setDraft(d =>
          d ? { ...d, songs: d.songs.filter(s => s.songId !== id) } : d
        )
        return true
      }}
      onClose={() => setBrowsing(false)}
    />
  )

  if (browsing && !desktop)
    return <div data-testid="practice-editor-page">{browser('screen')}</div>

  const form = (
    <div className="space-y-4">
      {source && (
        <div
          className="flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-bg-2 text-[13.5px] text-ink-3"
          data-testid="practice-copied-from"
        >
          <Copy size={16} className="text-accent-ink mt-0.5 shrink-0" />
          <span>
            Copied from{' '}
            <b className="text-ink-1">
              {source.title} · {source.when}
            </b>
            . Change anything; the original stays as it was.
          </span>
        </div>
      )}
      <div>
        <label htmlFor="practice-name" className={label}>
          Name{' '}
          <span className="normal-case tracking-normal text-ink-4 ml-1">
            optional
          </span>
        </label>
        <input
          id="practice-name"
          name="practiceName"
          data-testid="practice-name-input"
          value={draft.name}
          placeholder="Falls back to the date"
          onChange={e => set('name', e.target.value)}
          className={input}
        />
      </div>
      <div>
        <span className={label}>Date</span>
        <DatePicker
          value={draft.date}
          onChange={d => d && set('date', d)}
          name="practiceDate"
          id="practice-date"
          data-testid="practice-date-input"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className={label}>Start</span>
          <TimePickerDropdown
            value={draft.start}
            onChange={t => set('start', t)}
            name="practiceStart"
            id="practice-start"
            data-testid="practice-start-input"
          />
        </div>
        <div>
          <span className={label}>End</span>
          <EndPicker
            start={startAt}
            minutes={draft.minutes}
            onChange={m => set('minutes', m)}
          />
        </div>
      </div>
      <div>
        <label htmlFor="practice-location" className={label}>
          Where
        </label>
        <input
          id="practice-location"
          name="practiceLocation"
          data-testid="practice-location-input"
          value={draft.location}
          placeholder="Mike's Garage"
          onChange={e => set('location', e.target.value)}
          className={input}
        />
      </div>
      <div>
        <label htmlFor="practice-focus" className={label}>
          Focus
        </label>
        <textarea
          id="practice-focus"
          name="practiceFocus"
          data-testid="practice-focus-input"
          value={draft.focus}
          placeholder="What do you want to get out of this one?"
          onChange={e => set('focus', e.target.value)}
          rows={3}
          className={input + ' h-auto py-2.5 resize-y custom-scrollbar-thin'}
        />
      </div>
    </div>
  )

  const songs = (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <b className="text-[15px] text-ink-1">Songs</b>
        <span
          className="font-mono text-[12.5px] text-ink-3"
          data-testid="practice-songs-total"
        >
          {draft.songs.length} ·{' '}
          <span
            className={over ? 'text-warn' : ''}
            data-over={over || undefined}
          >
            {total} of {draft.minutes} min
          </span>
        </span>
        {desktop && !browsing && draft.songs.length > 0 && (
          <Button
            icon={<Plus size={17} />}
            onClick={() => setBrowsing(true)}
            className="ml-auto"
            data-testid="practice-editor-add-songs"
          >
            Add songs
          </Button>
        )}
        {desktop && browsing && (
          <Button
            icon={<Check size={17} />}
            onClick={() => setBrowsing(false)}
            className="ml-auto"
            data-testid="practice-editor-done-adding"
          >
            Done adding
          </Button>
        )}
      </div>
      {draft.songs.length === 0 ? (
        <div
          className="px-4 py-6 rounded-2xl bg-bg-2 text-center"
          data-testid="practice-editor-empty"
        >
          <p className="text-[14px] text-ink-3 mb-3">
            No songs yet. Add some, or save and add later.
          </p>
          <Button
            icon={<Plus size={17} />}
            onClick={() => setBrowsing(true)}
            data-testid="practice-editor-add-songs"
          >
            Add songs
          </Button>
        </div>
      ) : (
        <div
          className="rounded-[20px] bg-bg-2 shadow-group divide-y divide-divider overflow-hidden"
          data-testid="practice-editor-songs"
        >
          {draft.songs.map((ps, i) => {
            const s = songsById.get(ps.songId)
            return (
              <div
                key={ps.songId}
                className="flex items-center gap-3 pl-4 pr-2 py-2"
                data-testid={`practice-editor-song-${ps.songId}`}
              >
                <span className="w-4 font-mono text-[12px] text-ink-3 text-right">
                  {i + 1}
                </span>
                <span className="flex-1 min-w-0">
                  <b className="block text-[15px] font-semibold text-ink-1 truncate">
                    {s?.title ?? 'Song'}
                  </b>
                  <small className="block text-[12.5px] text-ink-3 truncate">
                    {s?.artist}
                  </small>
                </span>
                {s?.guitarTuning && (
                  <TuningPill tuning={s.guitarTuning} size="sm" />
                )}
                <span className="font-mono text-[12.5px] text-ink-2 w-10 text-right">
                  {songLength(s?.duration)}
                </span>
                {desktop && (
                  <>
                    <button
                      type="button"
                      aria-label="Move up"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      className="grid place-items-center w-9 h-9 text-ink-3 disabled:opacity-30"
                      data-testid="practice-editor-song-up"
                    >
                      <ChevronUp size={17} />
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      onClick={() => move(i, 1)}
                      disabled={i === draft.songs.length - 1}
                      className="grid place-items-center w-9 h-9 text-ink-3 disabled:opacity-30"
                      data-testid="practice-editor-song-down"
                    >
                      <ChevronDown size={17} />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  aria-label={`Remove ${s?.title ?? 'song'}`}
                  onClick={() =>
                    set(
                      'songs',
                      draft.songs.filter((_, j) => j !== i)
                    )
                  }
                  className="grid place-items-center w-9 h-9 text-ink-3 hover:text-danger"
                  data-testid="practice-editor-song-remove"
                >
                  <X size={17} />
                </button>
              </div>
            )
          })}
        </div>
      )}
      {!desktop && draft.songs.length > 0 && (
        <Button
          fullWidth
          icon={<Plus size={17} />}
          onClick={() => setBrowsing(true)}
          className="mt-3"
          data-testid="practice-editor-add-songs"
        >
          Add songs
        </Button>
      )}
    </div>
  )

  return (
    <div data-testid="practice-editor-page" className="pb-28 md:pb-10">
      {desktop ? (
        <header className="flex items-end gap-4 mb-6">
          <div className="flex-1">
            <p className="font-mono text-[11px] tracking-[.12em] uppercase text-ink-3 mb-1.5">
              {mode === 'duplicate'
                ? 'Duplicate practice'
                : mode === 'edit'
                  ? 'Edit practice'
                  : currentBand?.name}
            </p>
            <h1 className="font-display font-extrabold uppercase leading-[.9] text-ink-1 text-[50px]">
              {mode === 'edit'
                ? practiceTitle(draft.name, startAt)
                : 'New practice'}
            </h1>
          </div>
          <Button onClick={cancel} data-testid="practice-editor-cancel">
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={<Check size={17} />}
            onClick={save}
            disabled={saving}
            data-testid="practice-editor-save"
          >
            Save practice
          </Button>
        </header>
      ) : (
        <header className="flex items-center gap-2 mb-5">
          <Button
            variant="text"
            onClick={cancel}
            data-testid="practice-editor-cancel"
          >
            Cancel
          </Button>
          <b className="flex-1 text-center text-[16px] text-ink-1">{title}</b>
          <Button
            variant="primary"
            onClick={save}
            disabled={saving}
            data-testid="practice-editor-save"
          >
            Save
          </Button>
        </header>
      )}
      {desktop ? (
        <div className="flex gap-7 items-start">
          {!browsing && <div className="w-[440px] shrink-0">{form}</div>}
          <div className="flex-1 min-w-0">{songs}</div>
          {browsing && browser('pane')}
        </div>
      ) : (
        <div className="space-y-6">
          {form}
          {songs}
        </div>
      )}
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}

export default PracticeEditorPage
