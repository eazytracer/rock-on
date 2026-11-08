/**
 * Calendar (FP 1–3, 10, 18; desktop Calendar): one agenda of shows, practices
 * and jams. Filters All · Shows · Practices · Jams (`?type=`); one New whose
 * label follows the filter (on All it asks which type). Upcoming, then Past
 * dimmed; cancelled rows are struck through. On desktop the selected row opens
 * beside the list.
 */
import React, { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CalendarDays,
  ChevronRight,
  Copy,
  ExternalLink,
  MoreHorizontal,
  PartyPopper,
  Plus,
  QrCode,
  Ticket,
  Trash2,
} from 'lucide-react'
import { BandRequiredPrompt } from '../components/common/BandRequiredPrompt'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useConfirm } from '../hooks/useConfirm'
import { useMediaQuery } from '../hooks/useResponsive'
import { useAgenda } from '../hooks/useCalendar'
import { useEvents } from '../hooks/useEvents'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { JoinEventForm } from '../components/events/JoinEventForm'
import { ShowDetail } from '../components/calendar/ShowDetail'
import { PracticeDetail } from '../components/calendar/PracticeDetail'
import {
  Button,
  Chip,
  Empty,
  PageTitle,
  RetryCard,
  Sheet,
  SheetItem,
  SkeletonRow,
  TypeLabel,
} from '../components/ui'
import { repository } from '../services/data/RepositoryFactory'
import { deleteShow, duplicateShow } from '../services/api/calendar'
import { errorText } from '../services/api/errors'
import {
  buildAgenda,
  deleteShowMessage,
  NEW_LABEL,
  type AgendaFilter,
  type AgendaRow,
} from '../domain/calendar'
import { createLogger } from '../utils/logger'

const log = createLogger('CalendarPage')

type At = { x: number; y: number } | null

const FILTERS: { id: AgendaFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'show', label: 'Shows' },
  { id: 'practice', label: 'Practices' },
  { id: 'jam', label: 'Jams' },
]

/** `?type=show`, plus the old `?filter=shows` links. */
const LEGACY: Record<string, AgendaFilter> = {
  shows: 'show',
  practices: 'practice',
  events: 'jam',
}
function readFilter(params: URLSearchParams): AgendaFilter {
  const t = params.get('type') ?? LEGACY[params.get('filter') ?? ''] ?? 'all'
  return FILTERS.some(f => f.id === t) ? (t as AgendaFilter) : 'all'
}

const NEW_TYPES = [
  {
    type: 'show' as const,
    icon: <Ticket size={18} />,
    label: 'Show',
    hint: 'A gig with a venue, set and pay',
  },
  {
    type: 'practice' as const,
    icon: <CalendarDays size={18} />,
    label: 'Practice',
    hint: 'Time, place and songs to work on',
  },
  {
    type: 'jam' as const,
    icon: <PartyPopper size={18} />,
    label: 'Jam',
    hint: 'Open stage with guests, lineup and requests',
  },
]

const NEW_ROUTE = {
  show: '/shows/new',
  practice: '/practices/new',
  jam: '/events/new',
}

/** One agenda row: date block, title, time · place, type (+ confirmed / cancelled). */
const Row: React.FC<{
  row: AgendaRow
  past: boolean
  selected: boolean
  desktop: boolean
  onOpen: () => void
  onMenu: (at: At) => void
}> = ({ row, past, selected, desktop, onOpen, onMenu }) => {
  const mon = row.at
    .toLocaleDateString('en-US', { month: 'short' })
    .toUpperCase()
  const dow = row.at
    .toLocaleDateString('en-US', { weekday: 'short' })
    .toUpperCase()
  const status = row.cancelled ? (
    <span className="text-danger">Cancelled</span>
  ) : row.confirmed ? (
    <span className="text-success">Confirmed</span>
  ) : null
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      onContextMenu={e => {
        if (row.type === 'jam') return
        e.preventDefault()
        onMenu({ x: e.clientX, y: e.clientY })
      }}
      data-testid={`calendar-item-${row.type}-${row.id}`}
      data-selected={selected || undefined}
      data-cancelled={row.cancelled || undefined}
      data-past={past || undefined}
      className={`group flex items-center gap-3.5 w-full px-3 py-2.5 text-left cursor-pointer rounded-2xl ${
        selected
          ? 'bg-accent/15 shadow-[inset_3px_0_0_rgb(var(--accent-rgb))]'
          : 'hover:bg-bg-2'
      } ${past ? 'opacity-55' : ''}`}
    >
      <span className="flex flex-col items-center w-10 shrink-0 font-mono leading-none">
        <small className="text-[10px] tracking-[.1em] text-ink-3">{mon}</small>
        <b className="font-display text-[26px] font-extrabold text-ink-1 my-0.5">
          {row.at.getDate()}
        </b>
        <small className="text-[10px] tracking-[.1em] text-ink-3">{dow}</small>
      </span>
      <span className="flex-1 min-w-0">
        <b
          className={`block text-[15.5px] font-semibold truncate ${
            row.cancelled ? 'line-through text-ink-3' : 'text-ink-1'
          }`}
        >
          {row.title}
        </b>
        <small className="block text-[13px] text-ink-3 truncate">
          {row.sub}
        </small>
        {!desktop && (
          <span className="flex items-center gap-1.5 mt-0.5 font-mono text-[10.5px] font-medium uppercase tracking-[.12em]">
            <TypeLabel type={row.type} />
            {status && <>· {status}</>}
          </span>
        )}
      </span>
      {desktop && (
        <span className="flex items-center gap-1.5 w-[190px] shrink-0 font-mono text-[10.5px] font-medium uppercase tracking-[.12em]">
          <TypeLabel type={row.type} />
          {status && <>· {status}</>}
        </span>
      )}
      {row.type !== 'jam' ? (
        <button
          type="button"
          aria-label={`${row.title} menu`}
          onClick={e => {
            e.stopPropagation()
            const r = e.currentTarget.getBoundingClientRect()
            onMenu(desktop ? { x: r.right - 288, y: r.bottom + 6 } : null)
          }}
          className={`grid place-items-center w-9 h-9 rounded-full text-ink-3 hover:bg-bg-3 shrink-0 ${
            desktop ? 'opacity-0 group-hover:opacity-100 focus:opacity-100' : ''
          }`}
          data-testid={`calendar-item-menu-${row.id}`}
        >
          <MoreHorizontal size={18} />
        </button>
      ) : (
        desktop && <span className="w-9 shrink-0" />
      )}
      {desktop && <ChevronRight size={16} className="text-ink-4 shrink-0" />}
    </div>
  )
}

export function CalendarPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { confirm, dialogProps } = useConfirm()
  const { currentBand, currentBandId } = useAuth()
  const bandId = currentBandId ?? ''
  const desktop = useMediaQuery('(min-width: 768px)')
  const [params, setParams] = useSearchParams()
  const filter = readFilter(params)
  const selectedParam = params.get('selected')

  const { rows, loading, error, refetch } = useAgenda(bandId)
  const { events, loading: jamsLoading, refetch: refetchJams } = useEvents()
  const [newAt, setNewAt] = useState<At | false>(false)
  const [menu, setMenu] = useState<{ row: AgendaRow; at: At } | null>(null)
  const [joining, setJoining] = useState(false)

  const now = useMemo(() => new Date(), [])
  const { upcoming, past } = useMemo(
    () => buildAgenda(rows, events, filter, now),
    [rows, events, filter, now]
  )
  const empty = upcoming.length === 0 && past.length === 0

  const setQuery = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    next.delete('filter')
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: true })
  }

  // Desktop: the selected row (or the first upcoming one) opens beside the list.
  const selected =
    selectedParam === 'new-show'
      ? 'new-show'
      : ([...upcoming, ...past].find(r => r.id === selectedParam) ??
        upcoming.find(r => r.type !== 'jam') ??
        past.find(r => r.type !== 'jam') ??
        null)

  const open = (row: AgendaRow) => {
    if (desktop && row.type !== 'jam') setQuery({ selected: row.id })
    else navigate(row.to)
  }

  const create = (type: AgendaFilter) => {
    setNewAt(false)
    if (type === 'all') return
    if (type === 'show' && desktop) setQuery({ selected: 'new-show' })
    else navigate(NEW_ROUTE[type])
  }

  const fail = (what: string) => (err: unknown) => {
    log.error(what, err)
    showToast(errorText(err), 'error')
  }

  const duplicate = async (row: AgendaRow) => {
    setMenu(null)
    if (row.type === 'practice') {
      navigate(`/practices/new?from=${row.id}`)
      return
    }
    try {
      const id = await duplicateShow(row.id)
      showToast(`Duplicated ${row.title}, a week later`, 'success')
      void refetch()
      open({ ...row, id, to: `/shows/${id}` })
    } catch (err) {
      fail('Duplicate show failed')(err)
    }
  }

  const remove = async (row: AgendaRow) => {
    setMenu(null)
    const ok = await confirm({
      title: `Delete ${row.title}?`,
      message:
        row.type === 'show'
          ? deleteShowMessage(null)
          : 'The practice and its song list go. The songs stay in your catalog.',
      confirmLabel: 'Delete',
      cancelLabel: 'Keep',
      variant: 'danger',
    })
    if (!ok) return
    try {
      if (row.type === 'show') await deleteShow(row.id)
      else await repository.deletePracticeSession(row.id)
      showToast(`Deleted ${row.title}`, 'success')
      if (selectedParam === row.id) setQuery({ selected: null })
      void refetch()
    } catch (err) {
      fail('Delete failed')(err)
    }
  }

  const newButton = (
    <Button
      variant="primary"
      icon={<Plus size={18} />}
      onClick={e => {
        if (filter !== 'all') return create(filter)
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
        setNewAt(desktop ? { x: r.right - 300, y: r.bottom + 8 } : null)
      }}
      className={
        desktop ? '' : 'fixed right-4 bottom-[104px] z-30 shadow-float'
      }
      data-testid="calendar-new-button"
    >
      {NEW_LABEL[filter]}
    </Button>
  )

  const list = () => {
    if (loading || (filter === 'jam' && jamsLoading))
      return (
        <div className="rounded-[20px] bg-bg-2 shadow-group">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      )
    if (error)
      return (
        <RetryCard
          message="Couldn't load the calendar."
          onRetry={() => {
            void refetch()
            void refetchJams()
          }}
        />
      )
    if (empty && filter === 'all')
      return (
        <Empty
          icon={<CalendarDays size={28} />}
          title="Nothing on the calendar"
          why="Book your next gig or get a practice in."
          action={
            <div className="flex flex-col gap-2.5 w-full max-w-[320px] mt-2">
              <Button
                variant="primary"
                size="lg"
                icon={<Plus size={19} />}
                onClick={() => create('show')}
                data-testid="calendar-empty-show"
              >
                Book a show
              </Button>
              <Button
                size="lg"
                icon={<Plus size={19} />}
                onClick={() => create('practice')}
                data-testid="calendar-empty-practice"
              >
                Schedule practice
              </Button>
            </div>
          }
          data-testid="calendar-empty"
        />
      )
    if (empty)
      return (
        <Empty
          icon={<CalendarDays size={28} />}
          title={`No ${FILTERS.find(f => f.id === filter)!.label.toLowerCase()} yet`}
          why={`${NEW_LABEL[filter]} adds one.`}
          data-testid="calendar-empty"
        />
      )
    const section = (
      label: string,
      items: AgendaRow[],
      isPast: boolean,
      testid: string
    ) => (
      <section data-testid={testid}>
        <p className="px-3 pt-3 pb-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[.12em] text-ink-3">
          {label}
        </p>
        {items.length === 0 ? (
          <p className="px-3 pb-2 text-[13.5px] text-ink-4">
            Nothing coming up.
          </p>
        ) : (
          <div
            className={
              desktop
                ? 'space-y-1'
                : 'rounded-[20px] bg-bg-2 shadow-group divide-y divide-divider overflow-hidden'
            }
          >
            {items.map(row => (
              <Row
                key={row.type + row.id}
                row={row}
                past={isPast}
                desktop={desktop}
                selected={
                  desktop && selected !== 'new-show' && selected?.id === row.id
                }
                onOpen={() => open(row)}
                onMenu={at => setMenu({ row, at })}
              />
            ))}
          </div>
        )}
      </section>
    )
    return (
      <>
        {section('Upcoming', upcoming, false, 'calendar-upcoming')}
        {past.length > 0 && section('Past', past, true, 'calendar-past')}
      </>
    )
  }

  const pane = () => {
    if (selected === 'new-show')
      return (
        <ShowDetail
          key="new"
          showId={null}
          bandId={bandId}
          variant="pane"
          onCreated={id => setQuery({ selected: id })}
          onGone={() => setQuery({ selected: null })}
        />
      )
    if (!selected) return null
    if (selected.type === 'show')
      return (
        <ShowDetail
          key={selected.id}
          showId={selected.id}
          bandId={bandId}
          variant="pane"
          onCreated={() => {}}
          onGone={() => setQuery({ selected: null })}
        />
      )
    if (selected.type === 'practice')
      return (
        <PracticeDetail
          key={selected.id}
          practiceId={selected.id}
          variant="pane"
          onGone={() => setQuery({ selected: null })}
        />
      )
    return null
  }

  const chips = (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 mb-3">
      {FILTERS.map(f => (
        <Chip
          key={f.id}
          on={filter === f.id}
          onClick={() => setQuery({ type: f.id === 'all' ? null : f.id })}
          data-testid={`calendar-filter-${f.id}`}
        >
          {f.label}
        </Chip>
      ))}
      {filter === 'jam' && (
        <Chip
          icon={<QrCode size={15} />}
          onClick={() => setJoining(true)}
          data-testid="calendar-join-code"
        >
          Join with a code
        </Chip>
      )}
    </div>
  )

  // Shows and practices are band features; jams work band-less.
  if (!currentBandId && filter === 'show')
    return <BandRequiredPrompt feature="Shows" testid="shows-band-required" />
  if (!currentBandId && filter === 'practice')
    return (
      <BandRequiredPrompt
        feature="Practices"
        testid="practices-band-required"
      />
    )

  return (
    <div data-testid="calendar-page" className="pb-28 md:pb-8">
      <PageTitle
        eyebrow={currentBand?.name}
        title="Calendar"
        actions={desktop ? newButton : undefined}
      />
      {chips}
      {desktop ? (
        <div className="flex gap-6 items-start">
          <div className="flex-1 min-w-0">{list()}</div>
          <aside
            className="w-[440px] shrink-0 sticky top-6 max-h-[calc(100vh-48px)] overflow-y-auto custom-scrollbar-thin pl-6 border-l border-divider"
            data-testid="calendar-detail-pane"
          >
            {pane()}
          </aside>
        </div>
      ) : (
        list()
      )}
      {!desktop && !empty && newButton}

      {newAt !== false && (
        <Sheet
          onClose={() => setNewAt(false)}
          at={newAt}
          title="New"
          width={300}
          data-testid="calendar-new-sheet"
        >
          <div role="menu" className="pb-1">
            {NEW_TYPES.map(t => (
              <SheetItem
                key={t.type}
                icon={t.icon}
                label={t.label}
                hint={t.hint}
                onClick={() => create(t.type)}
                data-testid={`calendar-new-${t.type}`}
              />
            ))}
          </div>
        </Sheet>
      )}

      {menu && (
        <Sheet
          onClose={() => setMenu(null)}
          at={menu.at}
          title={menu.row.title}
          sub={`${menu.row.type === 'show' ? 'Show' : 'Practice'} · ${menu.row.at.toLocaleDateString(
            'en-US',
            {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            }
          )} · ${menu.row.at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
          data-testid="calendar-row-sheet"
        >
          <div role="menu" className="pb-1">
            <SheetItem
              icon={<ExternalLink size={18} />}
              label="Open"
              onClick={() => {
                setMenu(null)
                navigate(menu.row.to)
              }}
              data-testid="calendar-row-open"
            />
            <SheetItem
              icon={<Copy size={18} />}
              label="Duplicate"
              hint={
                menu.row.type === 'show'
                  ? 'Same venue and set, a week later'
                  : 'Same songs and place, next week by default'
              }
              onClick={() => void duplicate(menu.row)}
              data-testid="calendar-row-duplicate"
            />
            <SheetItem
              icon={<Trash2 size={18} />}
              label="Delete…"
              danger
              onClick={() => void remove(menu.row)}
              data-testid="calendar-row-delete"
            />
          </div>
        </Sheet>
      )}

      {joining && (
        <Sheet
          onClose={() => setJoining(false)}
          title="Join with a code"
          width={380}
          data-testid="calendar-join-sheet"
        >
          <div className="px-4 pb-4">
            <JoinEventForm />
          </div>
        </Sheet>
      )}
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
