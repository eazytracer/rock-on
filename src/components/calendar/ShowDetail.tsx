/**
 * The show, edited in place (Calendar and Shows 5–9, FP 4). Every field saves
 * when you leave it; there's no Edit mode. A new show is this page blank: the
 * first field you fill creates it. Used full page (`/shows/:id`) and in the
 * desktop calendar's detail pane.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check,
  Copy,
  ExternalLink,
  FileText,
  ListMusic,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  RotateCcw,
  Trash2,
  User,
  X,
} from 'lucide-react'
import { useToast } from '../../contexts/ToastContext'
import { useConfirm } from '../../hooks/useConfirm'
import { useShowPage } from '../../hooks/useCalendar'
import { useSetlistEditor, useSetlistIndex } from '../../hooks/useSetlists'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { DatePicker } from '../common/DatePicker'
import { TimePickerDropdown } from '../common/TimePickerDropdown'
import { MarkdownRenderer } from '../notes/MarkdownRenderer'
import { Button, Sheet, SheetItem, TuningPill, TypeLabel } from '../ui'
import { NotesSheet } from '../setlists/SetlistSheets'
import { errorText } from '../../services/api/errors'
import {
  attachSetToShow,
  createShow,
  createShowSet,
  deleteShow,
  duplicateShow,
  recopyShowSet,
  setShowCancelled,
  setShowConfirmed,
  updateShow,
  type ShowPatch,
} from '../../services/api/calendar'
import {
  copiedLine,
  copyEdited,
  countdown,
  defaultShowDate,
  deleteShowMessage,
  formatPay,
  isDraftShow,
  parsePay,
  showTitle,
} from '../../domain/calendar'
import {
  editorRows,
  editorTotals,
  indexTotals,
  songLength,
} from '../../domain/setlist'
import {
  formatDateForInput,
  formatTime12Hour,
  parseDateInputAsLocal,
  parseTime12Hour,
} from '../../utils/dateHelpers'
import type { Show, ShowContact } from '../../models/Show'
import { createLogger } from '../../utils/logger'

const log = createLogger('ShowDetail')

const label =
  'block font-mono text-[10.5px] font-medium uppercase tracking-[.12em] text-ink-3 mb-1.5'
const input =
  'w-full h-11 px-3.5 rounded-xl bg-bg-3 text-[15px] text-ink-1 placeholder:text-ink-4 outline-none focus:shadow-[inset_0_0_0_1.5px_rgb(var(--accent-rgb))]'
const groupLabel =
  'flex items-center px-3 pt-4 pb-2 font-mono text-[10.5px] font-medium uppercase tracking-[.12em] text-ink-3'
const card = 'rounded-[20px] bg-bg-2 shadow-group'

/** A text field that saves when you leave it (or press Enter). */
const Field: React.FC<{
  name: string
  label: React.ReactNode
  value: string
  placeholder?: string
  onCommit: (value: string) => void
  autoFocus?: boolean
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  className?: string
}> = ({
  name,
  label: text,
  value,
  placeholder,
  onCommit,
  autoFocus,
  inputMode,
  className,
}) => {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  const id = `show-${name.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}`
  return (
    <div className={className}>
      <label htmlFor={id} className={label}>
        {text}
      </label>
      <input
        id={id}
        name={name}
        data-testid={`${id}-input`}
        value={v}
        placeholder={placeholder}
        autoFocus={autoFocus}
        inputMode={inputMode}
        onChange={e => setV(e.target.value)}
        onBlur={() => v !== value && onCommit(v)}
        onKeyDown={e =>
          e.key === 'Enter' && (e.target as HTMLInputElement).blur()
        }
        className={input}
      />
    </div>
  )
}

/** Add or edit one contact. */
const ContactSheet: React.FC<{
  contact: ShowContact | null
  onSave: (c: ShowContact) => void
  onRemove?: () => void
  onClose: () => void
}> = ({ contact, onSave, onRemove, onClose }) => {
  const [c, setC] = useState<ShowContact>(
    contact ?? { id: crypto.randomUUID(), name: '', role: '' }
  )
  const set =
    (k: keyof ShowContact) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setC({ ...c, [k]: e.target.value })
  const fields: [keyof ShowContact, string, string][] = [
    ['name', 'Name', 'Jess Park'],
    ['role', 'Role', 'Booking'],
    ['phone', 'Phone', '206 555 0100'],
    ['email', 'Email', 'jess@venue.com'],
  ]
  return (
    <Sheet
      onClose={onClose}
      title={contact ? 'Contact' : 'Add a contact'}
      width={360}
      data-testid="show-contact-sheet"
    >
      <div className="px-4 pb-4 space-y-3">
        {fields.map(([k, l, ph]) => (
          <div key={k}>
            <label htmlFor={`contact-${k}`} className={label}>
              {l}
            </label>
            <input
              id={`contact-${k}`}
              name={`contact${k[0].toUpperCase()}${k.slice(1)}`}
              data-testid={`show-contact-${k}-input`}
              value={(c[k] as string) ?? ''}
              placeholder={ph}
              inputMode={
                k === 'phone' ? 'tel' : k === 'email' ? 'email' : undefined
              }
              autoFocus={k === 'name'}
              onChange={set(k)}
              className={input}
            />
          </div>
        ))}
        <div className="flex gap-2.5 pt-1">
          {onRemove && (
            <Button
              variant="text"
              onClick={onRemove}
              className="text-danger"
              data-testid="show-contact-remove"
            >
              Remove
            </Button>
          )}
          <Button
            className="ml-auto"
            onClick={onClose}
            data-testid="show-contact-cancel"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!c.name.trim()}
            onClick={() =>
              onSave({ ...c, name: c.name.trim(), role: c.role.trim() })
            }
            data-testid="show-contact-save"
          >
            Save
          </Button>
        </div>
      </div>
    </Sheet>
  )
}

/** Copy from a setlist: the band's sets with their size. */
const CopySetSheet: React.FC<{
  bandId: string
  onPick: (setlistId: string) => void
  onNew: () => void
  onClose: () => void
}> = ({ bandId, onPick, onNew, onClose }) => {
  const { rows, loading } = useSetlistIndex('band', bandId)
  return (
    <Sheet
      onClose={onClose}
      title="Add a set"
      sub="The show gets its own copy. Edits here never change the setlist."
      width={380}
      data-testid="show-copy-sheet"
    >
      <div className="pb-2">
        <SheetItem
          icon={<Plus size={18} />}
          label="New set for this show"
          onClick={onNew}
          data-testid="show-copy-new"
        />
        <p className={groupLabel + ' px-5'}>Copy from a setlist</p>
        {loading && <p className="px-5 py-3 text-sm text-ink-3">Loading…</p>}
        {!loading && rows.length === 0 && (
          <p className="px-5 py-3 text-sm text-ink-3">No setlists yet.</p>
        )}
        <div className="max-h-[50vh] overflow-y-auto custom-scrollbar-thin">
          {rows.map(r => {
            const t = indexTotals(r)
            const empty = t.songs === 0
            return (
              <button
                key={r.id}
                type="button"
                disabled={empty}
                onClick={() => onPick(r.id)}
                className="flex items-center gap-3 w-full px-5 py-2.5 text-left hover:bg-bg-3 disabled:opacity-50"
                data-testid={`show-copy-option-${r.id}`}
              >
                <ListMusic size={17} className="text-ink-3 shrink-0" />
                <span className="flex-1 min-w-0">
                  <b className="block text-[15px] font-semibold text-ink-1 truncate">
                    {r.name}
                  </b>
                  <small className="block text-[12.5px] text-ink-3">
                    {empty
                      ? 'Empty'
                      : `${t.songs} ${t.songs === 1 ? 'song' : 'songs'} · ${t.minutes} min`}
                  </small>
                </span>
                {!empty && (
                  <span className="font-mono text-[11.5px] text-ink-2">
                    Copy
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </Sheet>
  )
}

/** The show's set: its copy line, totals against the slot, the songs, Open set. */
const ShowSet: React.FC<{
  show: Show
  onOpen: (setlistId: string) => void
  onRecopy: (edited: boolean) => void
  onAdd: () => void
  onNew: () => void
  /** Phone page: Open set docks above the tab bar. */
  docked: boolean
}> = ({ show, onOpen, onRecopy, onAdd, onNew, docked }) => {
  const { setlist, songsById, loading } = useSetlistEditor(show.setlistId ?? '')
  const rows = useMemo(
    () =>
      editorRows(setlist?.items ?? [], id => {
        const s = songsById.get(id)
        return s
          ? { title: s.title, tuning: s.guitarTuning, seconds: s.duration || 0 }
          : undefined
      }),
    [setlist?.items, songsById]
  )
  const totals = editorTotals(rows, show.duration)

  if (!show.setlistId || (!loading && !setlist))
    return (
      <div className={card + ' p-4'} data-testid="show-no-set">
        <p className="text-[14px] text-ink-3 mb-3">
          No set yet. The show gets its own copy, so edits here never change the
          setlist.
        </p>
        <div className="flex gap-2.5">
          <Button
            variant="primary"
            icon={<Copy size={17} />}
            onClick={onAdd}
            className="flex-1"
            data-testid="show-copy-set"
          >
            Copy a setlist
          </Button>
          <Button
            icon={<Plus size={17} />}
            onClick={onNew}
            className="flex-1"
            data-testid="show-new-set"
          >
            New set
          </Button>
        </div>
      </div>
    )
  if (!setlist) return <div className={card + ' h-24'} />

  const copied = copiedLine(setlist)
  return (
    <>
      <div
        className={card + ' divide-y divide-divider overflow-hidden'}
        data-testid="show-set"
      >
        {copied && (
          <div className="flex items-center gap-2 px-4 py-2.5 font-mono text-[12px] text-ink-3">
            <Copy size={14} className="shrink-0" />
            <span
              className="flex-1 min-w-0 truncate"
              data-testid="show-set-copied"
            >
              {copied}
            </span>
            <button
              type="button"
              onClick={() => onRecopy(copyEdited(setlist))}
              className="text-accent-ink tracking-[.06em] uppercase"
              data-testid="show-recopy"
            >
              Re-copy
            </button>
          </div>
        )}
        <div
          className="px-4 py-2.5 font-mono text-[12px] uppercase text-ink-3"
          data-testid="show-set-totals"
        >
          {totals.songs} {totals.songs === 1 ? 'song' : 'songs'} ·{' '}
          <span
            className={totals.over ? 'text-warn' : ''}
            data-over={totals.over || undefined}
            data-testid="show-set-runtime"
          >
            {totals.slot
              ? `${totals.minutes} of ${totals.slot} min`
              : `${totals.minutes} min`}
          </span>
        </div>
        {rows.map(r =>
          r.kind === 'song' ? (
            <div
              key={r.item.id}
              className="flex items-center gap-3 px-4 py-2.5"
            >
              <span className="w-5 font-mono text-[12px] text-ink-3 text-right">
                {r.number}
              </span>
              <span className="flex-1 min-w-0 truncate text-[15px] font-semibold text-ink-1">
                {r.song?.title ?? 'Song'}
              </span>
              {r.song?.tuning && (
                <TuningPill tuning={r.song.tuning} size="sm" />
              )}
              <span className="font-mono text-[12.5px] text-ink-2 w-10 text-right">
                {songLength(r.song?.seconds)}
              </span>
            </div>
          ) : r.kind === 'break' ? (
            <div
              key={r.item.id}
              className="px-4 py-2 pl-12 font-mono text-[11.5px] uppercase text-ink-3"
            >
              Break · {r.item.breakDuration ?? 15} min
            </div>
          ) : (
            <div
              key={r.item.id}
              className="px-4 py-2 pl-12 font-mono text-[11.5px] uppercase tracking-[.12em] text-ink-2"
            >
              {r.item.sectionTitle || 'Section'}
            </div>
          )
        )}
      </div>
      <div
        className={
          docked
            ? 'fixed inset-x-4 bottom-[104px] z-30 md:static md:mt-3'
            : 'mt-3'
        }
      >
        <Button
          variant="primary"
          size="lg"
          fullWidth
          icon={<ListMusic size={18} />}
          onClick={() => onOpen(setlist.id)}
          className={docked ? 'shadow-float md:shadow-none' : ''}
          data-testid="show-open-set"
        >
          Open set
        </Button>
      </div>
    </>
  )
}

export interface ShowDetailProps {
  /** null = a new, blank show. */
  showId: string | null
  bandId: string
  variant: 'page' | 'pane'
  /** The blank show was saved for the first time. */
  onCreated: (showId: string) => void
  /** Deleted or discarded: leave the page / clear the pane. */
  onGone: () => void
}

export const ShowDetail: React.FC<ShowDetailProps> = ({
  showId,
  bandId,
  variant,
  onCreated,
  onGone,
}) => {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { confirm, dialogProps } = useConfirm()
  const { show: saved, loading, error, run } = useShowPage(showId)
  const [sheet, setSheet] = useState<
    null | 'menu' | 'copy' | 'notes' | { contact: ShowContact | null }
  >(null)
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)
  const [creating, setCreating] = useState(false)
  const now = useMemo(() => new Date(), [])
  const draftDate = useMemo(() => defaultShowDate(now), [now])

  // A blank show reads like one with defaults until it's saved.
  const show: Show =
    saved ??
    ({
      id: '',
      bandId,
      name: '',
      scheduledDate: draftDate,
      duration: 45,
      status: 'scheduled',
      confirmed: false,
      contacts: [],
      createdDate: now,
      updatedDate: now,
    } as Show)
  const isNew = !showId
  const cancelled = show.status === 'cancelled'
  const draft = isDraftShow(show)
  const title = showTitle(show.name, show.venue)
  const at = new Date(show.scheduledDate)

  const fail = (what: string) => (err: unknown) => {
    log.error(what, err)
    showToast(errorText(err), 'error')
  }

  /** Save fields; the first save of a blank show creates it. */
  const save = async (patch: ShowPatch) => {
    if (isNew) {
      if (creating) return
      setCreating(true)
      try {
        const id = await createShow(bandId, {
          scheduledDate: draftDate.toISOString(),
          ...patch,
        })
        onCreated(id)
      } catch (err) {
        fail('Create show failed')(err)
      } finally {
        setCreating(false)
      }
      return
    }
    const local: Partial<Show> = { ...patch } as Partial<Show>
    if (patch.scheduledDate) local.scheduledDate = new Date(patch.scheduledDate)
    if ('payment' in patch) local.payment = patch.payment ?? undefined
    await run(() => updateShow(show.id, patch), local).catch(
      fail('Update show failed')
    )
  }

  const setWhen = (dateStr: string, time: string) => {
    const base = parseDateInputAsLocal(dateStr)
    const d = parseTime12Hour(time, base)
    void save({ scheduledDate: d.toISOString() })
  }

  const ensureSaved = async (): Promise<string | null> => {
    if (!isNew) return show.id
    showToast('Add a venue or a name first.', 'info')
    return null
  }

  const toggleConfirmed = async () => {
    const id = await ensureSaved()
    if (!id) return
    const next = !show.confirmed
    await run(() => setShowConfirmed(id, next), { confirmed: next }).catch(
      fail('Confirm failed')
    )
  }

  const toggleCancelled = async () => {
    setSheet(null)
    const next = !cancelled
    await run(() => setShowCancelled(show.id, next), {
      status: next ? 'cancelled' : 'scheduled',
    }).then(
      () =>
        showToast(
          next
            ? `${title} is cancelled. Undo from the menu.`
            : `${title} is back on.`,
          'success'
        ),
      fail('Cancel failed')
    )
  }

  const remove = async () => {
    setSheet(null)
    const ok = await confirm({
      title: `Delete ${title}?`,
      message: deleteShowMessage(sourceName),
      confirmLabel: 'Delete',
      cancelLabel: 'Keep',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await deleteShow(show.id)
      showToast(`Deleted ${title}`, 'success')
      onGone()
    } catch (err) {
      fail('Delete show failed')(err)
    }
  }

  const discard = async () => {
    if (!isNew) await deleteShow(show.id).catch(fail('Discard failed'))
    onGone()
  }

  const duplicate = async () => {
    setSheet(null)
    try {
      const id = await duplicateShow(show.id)
      showToast(`Duplicated ${title}, a week later`, 'success')
      navigate(`/shows/${id}`)
    } catch (err) {
      fail('Duplicate show failed')(err)
    }
  }

  const openSet = (setlistId: string) =>
    navigate(`/setlists/${setlistId}?from=show:${show.id}`)

  const copySet = async (setlistId: string) => {
    setSheet(null)
    const id = await ensureSaved()
    if (!id) return
    await run(() => attachSetToShow(id, setlistId)).then(
      () => showToast('Set copied. Edits here stay with this show.', 'success'),
      fail('Copy set failed')
    )
  }

  const newSet = async () => {
    setSheet(null)
    const id = await ensureSaved()
    if (!id) return
    try {
      openSet(await createShowSet(id))
    } catch (err) {
      fail('New set failed')(err)
    }
  }

  const recopy = async (edited: boolean) => {
    if (
      edited &&
      !(await confirm({
        title: 'Re-copy the set?',
        message:
          "This show's set was changed since it was copied. Re-copying replaces those changes.",
        confirmLabel: 'Re-copy',
        cancelLabel: 'Keep mine',
      }))
    )
      return
    await run(() => recopyShowSet(show.id)).then(
      () => showToast('Set re-copied', 'success'),
      fail('Re-copy failed')
    )
  }

  const saveContacts = (contacts: ShowContact[]) => {
    setSheet(null)
    void save({ contacts })
  }

  // The source's name for the delete confirm (the copy keeps it).
  const { setlist: copy } = useSetlistEditor(show.setlistId ?? '')
  const sourceName = copy?.sourceSetlistId ? copy.name : null

  if (!isNew && loading)
    return <div className="h-64" data-testid="show-loading" />
  if (!isNew && (error || !saved))
    return (
      <div className="py-16 text-center" data-testid="show-missing">
        <b className="block text-lg text-ink-1 mb-1">This show was deleted.</b>
        <p className="text-ink-3 mb-4">It's no longer on the calendar.</p>
        <Button onClick={onGone}>Back to Calendar</Button>
      </div>
    )

  const kicker = isNew
    ? 'New · saves as you go'
    : cancelled
      ? 'Cancelled'
      : countdown(at, now)
  const contacts = show.contacts ?? []
  const page = variant === 'page'

  return (
    <div data-testid="show-detail" data-show-id={show.id || undefined}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[.12em] text-ink-3 mb-1.5">
            <TypeLabel type="show" /> ·{' '}
            <span data-testid="show-kicker">{kicker}</span>
          </p>
          <input
            name="showName"
            id="show-name"
            aria-label="Show name"
            data-testid="show-name-input"
            defaultValue={show.name}
            key={show.id + show.name}
            placeholder={show.venue || 'Show name'}
            onBlur={e =>
              e.target.value.trim() !== show.name &&
              void save({ name: e.target.value })
            }
            onKeyDown={e =>
              e.key === 'Enter' && (e.target as HTMLInputElement).blur()
            }
            className={`w-full bg-transparent font-display font-extrabold uppercase leading-[.95] text-ink-1 placeholder:text-ink-4 outline-none ${
              page ? 'text-[44px] md:text-[50px]' : 'text-[34px]'
            } ${cancelled ? 'line-through decoration-[3px] text-ink-3' : ''}`}
          />
        </div>
        {!isNew && (
          <button
            type="button"
            aria-label="Show menu"
            onClick={e => {
              const r = e.currentTarget.getBoundingClientRect()
              setMenuAt({ x: r.right - 288, y: r.bottom + 8 })
              setSheet('menu')
            }}
            className="grid place-items-center w-10 h-10 rounded-full bg-bg-2 text-ink-2 shrink-0"
            data-testid="show-menu"
          >
            <MoreHorizontal size={18} />
          </button>
        )}
      </div>

      {page && (
        <div className="flex gap-5 mt-3 font-mono" data-testid="show-meta">
          {[
            [
              'Date',
              at.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              }),
            ],
            ['Start', formatTime12Hour(at).replace(/ [AP]M$/, '')],
            ['Set', `${show.duration ?? 45} min`],
          ].map(([k, v]) => (
            <span key={k} className="flex flex-col">
              <small className="text-[10px] uppercase tracking-[.12em] text-ink-3">
                {k}
              </small>
              <b className="text-[17px] uppercase text-ink-1">{v}</b>
            </span>
          ))}
        </div>
      )}

      {cancelled && (
        <div
          className="flex items-start gap-3 mt-4 p-3.5 rounded-2xl shadow-[inset_0_0_0_1.5px_rgb(var(--warn-rgb))] bg-bg-2"
          data-testid="show-cancelled-banner"
        >
          <X size={18} className="text-warn mt-0.5 shrink-0" />
          <span className="flex-1">
            <b className="block text-[15px] text-ink-1">Cancelled</b>
            <small className="block text-[13px] text-ink-3">
              Kept on the calendar, struck through.
            </small>
          </span>
          <Button
            size="md"
            icon={<RotateCcw size={16} />}
            onClick={toggleCancelled}
            data-testid="show-undo-cancel"
          >
            Undo
          </Button>
        </div>
      )}

      <button
        type="button"
        role="checkbox"
        aria-checked={!!show.confirmed}
        onClick={toggleConfirmed}
        className={`${card} flex items-center gap-3 w-full mt-4 px-4 py-3 text-left`}
        data-testid="show-confirmed"
      >
        <span
          className={`grid place-items-center w-7 h-7 rounded-lg shrink-0 ${
            show.confirmed ? 'bg-success text-white' : 'bg-bg-4 text-ink-4'
          }`}
        >
          <Check size={17} strokeWidth={3} />
        </span>
        <span>
          <b className="block text-[15px] text-ink-1">Confirmed</b>
          <small className="block text-[12.5px] text-ink-3">
            {show.confirmed
              ? 'Venue has said yes'
              : 'Tick when the venue says yes'}
          </small>
        </span>
      </button>

      <p className={groupLabel}>Where</p>
      <div className={card + ' p-4 space-y-3'}>
        <Field
          name="venue"
          label={
            <>
              Venue
              {draft && (
                <em className="not-italic text-accent-ink ml-2">
                  Fill this first
                </em>
              )}
            </>
          }
          value={show.venue ?? ''}
          placeholder="e.g. Neumos"
          autoFocus={isNew}
          onCommit={v => void save({ venue: v })}
        />
        <div className="flex items-end gap-2">
          <Field
            name="location"
            label="Address"
            value={show.location ?? ''}
            placeholder="Street, city"
            onCommit={v => void save({ location: v })}
            className="flex-1"
          />
          {show.location && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(show.location)}`}
              target="_blank"
              rel="noreferrer"
              aria-label="Directions"
              className="grid place-items-center w-11 h-11 rounded-xl bg-bg-3 text-ink-2"
              data-testid="show-directions"
            >
              <ExternalLink size={17} />
            </a>
          )}
        </div>
      </div>

      <p className={groupLabel}>When</p>
      <div className={card + ' p-4 space-y-3'}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={label}>Date</span>
            <DatePicker
              value={formatDateForInput(at)}
              onChange={d => d && setWhen(d, formatTime12Hour(at))}
              name="showDate"
              id="show-date"
              data-testid="show-date-input"
            />
          </div>
          <div>
            <span className={label}>Start</span>
            <TimePickerDropdown
              value={formatTime12Hour(at)}
              onChange={t => setWhen(formatDateForInput(at), t)}
              name="showStart"
              id="show-start"
              data-testid="show-start-input"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <span className={label}>Load-in</span>
            <TimePickerDropdown
              value={show.loadInTime ?? ''}
              onChange={t => void save({ loadInTime: t })}
              placeholder="—"
              name="showLoadIn"
              id="show-load-in"
              data-testid="show-load-in-input"
            />
          </div>
          <div>
            <span className={label}>Soundcheck</span>
            <TimePickerDropdown
              value={show.soundcheckTime ?? ''}
              onChange={t => void save({ soundcheckTime: t })}
              placeholder="—"
              name="showSoundcheck"
              id="show-soundcheck"
              data-testid="show-soundcheck-input"
            />
          </div>
          <div className="col-span-2 md:col-span-1">
            <span className={label}>Set length</span>
            <div
              className="flex items-center h-11 rounded-xl bg-bg-3"
              data-testid="show-set-length"
            >
              <button
                type="button"
                aria-label="5 minutes shorter"
                onClick={() =>
                  void save({
                    duration: Math.max(5, (show.duration ?? 45) - 5),
                  })
                }
                className="w-11 h-11 text-lg text-ink-2"
                data-testid="show-set-length-down"
              >
                −
              </button>
              <b
                className="flex-1 text-center font-mono text-[14px] text-ink-1 whitespace-nowrap"
                data-testid="show-set-length-value"
              >
                {show.duration ?? 45} <small className="text-ink-3">MIN</small>
              </b>
              <button
                type="button"
                aria-label="5 minutes longer"
                onClick={() =>
                  void save({
                    duration: Math.min(600, (show.duration ?? 45) + 5),
                  })
                }
                className="w-11 h-11 text-lg text-ink-2"
                data-testid="show-set-length-up"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      <p className={groupLabel}>Money and people</p>
      <div className={card + ' divide-y divide-divider overflow-hidden'}>
        <div className="p-4">
          <Field
            name="payment"
            label="Pay"
            value={formatPay(show.payment)}
            placeholder="$0"
            inputMode="decimal"
            onCommit={v => {
              const cents = parsePay(v)
              if (Number.isNaN(cents))
                showToast('Pay is a number, like $300.', 'error')
              else void save({ payment: cents })
            }}
          />
        </div>
        {contacts.map((c, i) => (
          <div
            key={c.id}
            className="flex items-center gap-3 pl-4 pr-2 py-2"
            data-testid={`show-contact-${i}`}
          >
            <span className="grid place-items-center w-9 h-9 rounded-full bg-accent/20 text-accent-ink font-bold shrink-0">
              {c.name[0]?.toUpperCase() ?? <User size={16} />}
            </span>
            <button
              type="button"
              onClick={() => setSheet({ contact: c })}
              className="flex-1 min-w-0 text-left"
              data-testid={`show-contact-${i}-edit`}
            >
              <b className="block text-[15px] text-ink-1 truncate">{c.name}</b>
              <small className="block text-[12.5px] text-ink-3 truncate">
                {[c.role, c.email || c.phone].filter(Boolean).join(' · ')}
              </small>
            </button>
            {c.phone && (
              <a
                href={`tel:${c.phone}`}
                aria-label={`Call ${c.name}`}
                className="grid place-items-center w-10 h-10 text-ink-2"
                data-testid={`show-contact-${i}-call`}
              >
                <Phone size={17} />
              </a>
            )}
            {c.email && (
              <a
                href={`mailto:${c.email}`}
                aria-label={`Email ${c.name}`}
                className="grid place-items-center w-10 h-10 text-ink-2"
                data-testid={`show-contact-${i}-email`}
              >
                <Mail size={17} />
              </a>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            isNew ? void ensureSaved() : setSheet({ contact: null })
          }
          className="flex items-center gap-2 w-full px-4 py-3 text-[14.5px] font-semibold text-accent-ink"
          data-testid="show-contact-add"
        >
          <Plus size={17} /> Add a contact
        </button>
      </div>

      <p className={groupLabel}>
        Set
        {show.setlistId && (
          <button
            type="button"
            onClick={() => openSet(show.setlistId!)}
            className="ml-auto text-accent-ink tracking-[.06em]"
            data-testid="show-edit-set"
          >
            Edit set
          </button>
        )}
      </p>
      <ShowSet
        show={show}
        onOpen={openSet}
        onRecopy={recopy}
        onAdd={() => (isNew ? void ensureSaved() : setSheet('copy'))}
        onNew={newSet}
        docked={page}
      />

      <p className={groupLabel}>
        Notes
        <button
          type="button"
          onClick={() => (isNew ? void ensureSaved() : setSheet('notes'))}
          className="ml-auto text-accent-ink tracking-[.06em]"
          data-testid="show-notes-edit"
        >
          {show.notes ? 'Edit' : '+ Add'}
        </button>
      </p>
      {show.notes ? (
        <button
          type="button"
          onClick={() => setSheet('notes')}
          className={
            card + ' flex items-start gap-3 w-full px-4 py-3 text-left'
          }
          data-testid="show-notes-card"
        >
          <FileText size={17} className="text-ink-3 mt-0.5 shrink-0" />
          <span className="flex-1 min-w-0 text-[14.5px] text-ink-2 max-h-40 overflow-hidden [&_h1]:text-[15px] [&_h2]:text-[15px] [&_h3]:text-[14.5px] [&_*]:my-1">
            <MarkdownRenderer content={show.notes} />
          </span>
        </button>
      ) : (
        <p className="px-3 text-[13.5px] text-ink-4">
          Parking, set order notes, who brings what.
        </p>
      )}

      <div className="flex flex-wrap gap-2.5 mt-6">
        {draft ? (
          <Button onClick={discard} data-testid="show-discard">
            Discard draft
          </Button>
        ) : (
          <>
            <Button
              icon={cancelled ? <RotateCcw size={16} /> : <X size={16} />}
              onClick={toggleCancelled}
              data-testid="show-cancel-toggle"
            >
              {cancelled ? 'Undo cancel' : 'Mark cancelled'}
            </Button>
            <Button onClick={remove} data-testid="show-delete">
              Delete…
            </Button>
          </>
        )}
      </div>

      {sheet === 'menu' && (
        <Sheet
          onClose={() => setSheet(null)}
          at={menuAt}
          title={title}
          data-testid="show-menu-sheet"
        >
          <div role="menu" className="pb-1">
            <SheetItem
              icon={cancelled ? <RotateCcw size={18} /> : <X size={18} />}
              label={cancelled ? 'Undo cancel' : 'Mark cancelled'}
              hint={
                cancelled ? undefined : 'Kept on the calendar, struck through'
              }
              onClick={toggleCancelled}
              data-testid="show-menu-cancel"
            />
            <SheetItem
              icon={<Copy size={18} />}
              label="Duplicate"
              hint="Same venue and set, a week later"
              onClick={duplicate}
              data-testid="show-menu-duplicate"
            />
            <SheetItem
              icon={<Trash2 size={18} />}
              label="Delete…"
              danger
              onClick={remove}
              data-testid="show-menu-delete"
            />
          </div>
        </Sheet>
      )}
      {sheet === 'copy' && (
        <CopySetSheet
          bandId={show.bandId}
          onPick={copySet}
          onNew={newSet}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'notes' && (
        <NotesSheet
          title="Show notes"
          sub={title}
          value={show.notes ?? ''}
          markdown
          onSave={v => void save({ notes: v })}
          onClose={() => setSheet(null)}
          data-testid="show-notes-sheet"
        />
      )}
      {sheet && typeof sheet === 'object' && (
        <ContactSheet
          contact={sheet.contact}
          onClose={() => setSheet(null)}
          onSave={c =>
            saveContacts(
              sheet.contact
                ? contacts.map(x => (x.id === c.id ? c : x))
                : [...contacts, c]
            )
          }
          onRemove={
            sheet.contact
              ? () =>
                  saveContacts(contacts.filter(x => x.id !== sheet.contact!.id))
              : undefined
          }
        />
      )}
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
