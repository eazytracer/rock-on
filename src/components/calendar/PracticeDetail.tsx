/**
 * The practice (Practice 1, FP 5). Status comes from the time, never a field.
 * Focus edits in place; songs show every link as a labelled button and the
 * note for this practice. Start practice session is docked. Used full page
 * (`/practices/:id`) and in the desktop calendar's detail pane.
 */
import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  Clock,
  Copy,
  Hash,
  Home,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  StickyNote,
  Trash2,
  Activity,
} from 'lucide-react'
import { useToast } from '../../contexts/ToastContext'
import { useConfirm } from '../../hooks/useConfirm'
import { usePracticePage } from '../../hooks/useCalendar'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { MarkdownRenderer } from '../notes/MarkdownRenderer'
import { Button, Sheet, SheetItem, TuningPill, TypeLabel } from '../ui'
import { NotesSheet } from '../setlists/SetlistSheets'
import { linkGlyph } from '../songs/linkGlyphs'
import { repository } from '../../services/data/RepositoryFactory'
import { errorText } from '../../services/api/errors'
import {
  countdown,
  hoursMinutes,
  practiceStatus,
  practiceTitle,
  untilLine,
} from '../../domain/calendar'
import { songLength } from '../../domain/setlist'
import { showKey } from '../../domain/format'
import type { ReferenceLink } from '../../types'
import { createLogger } from '../../utils/logger'

const log = createLogger('PracticeDetail')

const groupLabel =
  'flex items-center px-3 pt-4 pb-2 font-mono text-[10.5px] font-medium uppercase tracking-[.12em] text-ink-3'
const card = 'rounded-[20px] bg-bg-2 shadow-group'

const LINK_NAMES: Record<string, string> = {
  spotify: 'Spotify',
  youtube: 'YouTube',
  tabs: 'Tabs',
  lyrics: 'Lyrics',
  soundcloud: 'SoundCloud',
  drive: 'Drive',
  dropbox: 'Dropbox',
}

/** One link as a labelled tile (glyph above the service name). */
const LinkTile: React.FC<{ link: ReferenceLink }> = ({ link }) => {
  const g = linkGlyph(link)
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noreferrer"
      onClick={e => e.stopPropagation()}
      className="flex flex-col items-center justify-center gap-0.5 min-w-[60px] h-11 px-2 rounded-xl bg-bg-3 text-[10.5px] font-semibold text-ink-2 [&_svg]:w-4 [&_svg]:h-4"
      data-testid={`practice-link-${link.icon}`}
    >
      <span className={g.tone}>{g.icon}</span>
      {LINK_NAMES[link.icon] ?? (link.description || g.name)}
    </a>
  )
}

export const PracticeDetail: React.FC<{
  practiceId: string
  variant: 'page' | 'pane'
  onGone: () => void
}> = ({ practiceId, variant, onGone }) => {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { confirm, dialogProps } = useConfirm()
  const { practice, songsById, loading, error, save } =
    usePracticePage(practiceId)
  const [sheet, setSheet] = useState<
    null | 'menu' | 'focus' | { note: number }
  >(null)
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)
  const now = useMemo(() => new Date(), [])

  if (loading) return <div className="h-64" data-testid="practice-loading" />
  if (error || !practice)
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
  const minutes = practice.duration || 0
  const status = practiceStatus(at, minutes, now)
  const title = practiceTitle(practice.name, at)
  const page = variant === 'page'
  const played =
    practice.startTime && practice.endTime
      ? (new Date(practice.endTime).getTime() -
          new Date(practice.startTime).getTime()) /
        60000
      : null
  const reached = practice.songs.filter(s => s.status === 'completed').length

  const fail = (what: string) => (err: unknown) => {
    log.error(what, err)
    showToast(errorText(err), 'error')
  }

  const edit = (q = '') => navigate(`/practices/${practice.id}/edit${q}`)

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
      showToast(`Deleted ${title}`, 'success')
      onGone()
    } catch (err) {
      fail('Delete practice failed')(err)
    }
  }

  const saveNote = (i: number, notes: string) =>
    void save({
      songs: practice.songs.map((s, j) => (j === i ? { ...s, notes } : s)),
    }).catch(fail('Save note failed'))

  const kicker =
    status === 'done'
      ? `Done · ${countdown(at, now).replace('Tonight', 'today')}`
      : status === 'now'
        ? 'Now'
        : `Upcoming · ${countdown(at, now).replace('Tonight', 'today')}`

  return (
    <div
      data-testid="practice-detail"
      data-practice-id={practice.id}
      data-status={status}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[.12em] mb-1.5">
            {status === 'done' ? (
              <TypeLabel type="practice" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            )}
            <span
              className={status === 'done' ? 'text-ink-3' : 'text-accent-ink'}
              data-testid="practice-kicker"
            >
              {kicker}
            </span>
          </p>
          <h1
            className={`font-display font-extrabold uppercase leading-[.95] text-ink-1 ${
              page ? 'text-[44px] md:text-[50px]' : 'text-[34px]'
            }`}
            data-testid="practice-title"
          >
            {title}
          </h1>
        </div>
        <button
          type="button"
          aria-label="Practice menu"
          onClick={e => {
            const r = e.currentTarget.getBoundingClientRect()
            setMenuAt({ x: r.right - 288, y: r.bottom + 8 })
            setSheet('menu')
          }}
          className="grid place-items-center w-10 h-10 rounded-full bg-bg-2 text-ink-2 shrink-0"
          data-testid="practice-menu"
        >
          <MoreHorizontal size={18} />
        </button>
      </div>

      <button
        type="button"
        onClick={() => edit()}
        className={
          card +
          ' block w-full mt-4 divide-y divide-divider text-left overflow-hidden'
        }
        data-testid="practice-when"
      >
        <span className="flex items-center gap-3 px-4 py-3">
          <CalendarDays size={18} className="text-ink-3 shrink-0" />
          <span>
            <b className="block text-[15px] text-ink-1">
              {at.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}{' '}
              ·{' '}
              {at.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </b>
            <small className="block text-[12.5px] text-ink-3">
              {untilLine(at, minutes)}
            </small>
          </span>
        </span>
        {practice.location && (
          <span className="flex items-center gap-3 px-4 py-3">
            <Home size={18} className="text-ink-3 shrink-0" />
            <b className="text-[15px] text-ink-1">{practice.location}</b>
          </span>
        )}
      </button>

      {played !== null && (
        <>
          <p className={groupLabel}>Wrap-up</p>
          <div className={card + ' px-4 py-3'} data-testid="practice-wrapup">
            <p className="font-mono text-[12.5px] text-ink-2">
              {hoursMinutes(played)} played · {reached} of{' '}
              {practice.songs.length} songs
            </p>
            {practice.wrapupNotes && (
              <p className="mt-1.5 text-[14.5px] text-ink-1 whitespace-pre-wrap">
                {practice.wrapupNotes}
              </p>
            )}
          </div>
        </>
      )}

      <p className={groupLabel}>
        Focus
        <button
          type="button"
          onClick={() => setSheet('focus')}
          className="ml-auto inline-flex items-center gap-1 text-accent-ink tracking-[.06em]"
          data-testid="practice-focus-edit"
        >
          <Pencil size={12} /> {practice.notes ? 'Edit' : 'Add'}
        </button>
      </p>
      {practice.notes ? (
        <button
          type="button"
          onClick={() => setSheet('focus')}
          className={
            card +
            ' block w-full px-4 py-3 text-left text-[14.5px] text-ink-1 [&_*]:my-0'
          }
          data-testid="practice-focus"
        >
          <MarkdownRenderer content={practice.notes} />
        </button>
      ) : (
        <p className="px-3 text-[13.5px] text-ink-4">
          What do you want to get out of this one?
        </p>
      )}

      <p className={groupLabel}>
        Songs · {practice.songs.length}
        <button
          type="button"
          onClick={() => edit('?add=1')}
          className="ml-auto text-accent-ink tracking-[.06em]"
          data-testid="practice-add-songs"
        >
          + Add
        </button>
      </p>
      {practice.songs.length === 0 ? (
        <div
          className={card + ' px-4 py-5 text-center'}
          data-testid="practice-no-songs"
        >
          <p className="text-[14px] text-ink-3 mb-3">No songs yet.</p>
          <Button icon={<Plus size={16} />} onClick={() => edit('?add=1')}>
            Add songs
          </Button>
        </div>
      ) : (
        <div
          className={card + ' divide-y divide-divider overflow-hidden'}
          data-testid="practice-songs"
        >
          {practice.songs.map((ps, i) => {
            const s = songsById.get(ps.songId)
            const links = s?.referenceLinks ?? []
            return (
              <div
                key={ps.songId + i}
                className="px-4 py-3 cursor-pointer hover:bg-bg-3/40"
                onClick={() => navigate(`/songs/${ps.songId}`)}
                data-testid={`practice-song-${ps.songId}`}
              >
                <div className="flex items-baseline gap-2.5">
                  <span className="w-4 font-mono text-[12px] text-ink-3 text-right">
                    {i + 1}
                  </span>
                  <b className="flex-1 min-w-0 truncate text-[15.5px] font-semibold text-ink-1">
                    {s?.title ?? 'Song'}
                  </b>
                  {ps.status === 'completed' && (
                    <span className="font-mono text-[10.5px] uppercase text-success">
                      Played
                    </span>
                  )}
                  {ps.status === 'skipped' && (
                    <span className="font-mono text-[10.5px] uppercase text-ink-3">
                      Skipped
                    </span>
                  )}
                </div>
                {s && (
                  <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5 pl-6 font-mono text-[12.5px] text-ink-2">
                    {s.guitarTuning && (
                      <TuningPill tuning={s.guitarTuning} size="sm" />
                    )}
                    {!!s.duration && (
                      <span className="inline-flex items-center gap-1">
                        <Clock size={13} className="text-ink-3" />
                        {songLength(s.duration)}
                      </span>
                    )}
                    {s.key && (
                      <span className="inline-flex items-center gap-1">
                        <Hash size={13} className="text-ink-3" />
                        {showKey(s.key)}
                      </span>
                    )}
                    {!!s.bpm && (
                      <span className="inline-flex items-center gap-1">
                        <Activity size={13} className="text-ink-3" />
                        {s.bpm}
                      </span>
                    )}
                  </div>
                )}
                {links.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 pl-6">
                    {links.map((l, j) => (
                      <LinkTile key={j} link={l} />
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    setSheet({ note: i })
                  }}
                  className={`flex items-start gap-2 mt-2 ml-6 text-left text-[13.5px] ${
                    ps.notes ? 'text-ink-2' : 'text-ink-4'
                  }`}
                  data-testid="practice-song-note"
                >
                  <StickyNote size={14} className="mt-0.5 shrink-0" />
                  {ps.notes || 'Note for this practice'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {status !== 'done' && (
        <div
          className={
            page
              ? 'fixed inset-x-4 bottom-[104px] z-30 md:static md:mt-6'
              : 'mt-6'
          }
        >
          <Button
            variant="primary"
            size="lg"
            fullWidth
            icon={<Play size={18} className="fill-current" />}
            onClick={() => navigate(`/practices/${practice.id}/session`)}
            disabled={practice.songs.length === 0}
            className="shadow-float md:shadow-none"
            data-testid="practice-start-session"
          >
            Start practice session
          </Button>
        </div>
      )}

      {sheet === 'menu' && (
        <Sheet
          onClose={() => setSheet(null)}
          at={menuAt}
          title={title}
          data-testid="practice-menu-sheet"
        >
          <div role="menu" className="pb-1">
            <SheetItem
              icon={<Pencil size={18} />}
              label="Edit"
              hint="Time, place and songs"
              onClick={() => edit()}
              data-testid="practice-menu-edit"
            />
            <SheetItem
              icon={<Copy size={18} />}
              label="Duplicate"
              hint="Same songs and place, next week by default"
              onClick={() => navigate(`/practices/new?from=${practice.id}`)}
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
      {sheet === 'focus' && (
        <NotesSheet
          title="Focus"
          sub={title}
          value={practice.notes ?? ''}
          markdown
          onSave={v => void save({ notes: v }).catch(fail('Save focus failed'))}
          onClose={() => setSheet(null)}
          data-testid="practice-focus-sheet"
        />
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
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
