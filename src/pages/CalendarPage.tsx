import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Ticket,
  Calendar as CalendarIcon,
  Plus,
  PartyPopper,
  Clock,
  MapPin,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useShows } from '../hooks/useShows'
import { usePractices } from '../hooks/usePractices'
import { useEvents } from '../hooks/useEvents'
import { formatTime12Hour, formatCountdown } from '../utils/dateHelpers'
import { Badge } from '../components/common/Badge'
import { EmptyState } from '../components/common/EmptyState'
import { ContentLoadingSpinner } from '../components/common/ContentLoadingSpinner'
import { SHOW_TONE, PRACTICE_TONE, type BadgeTone } from '../utils/tokens'

type Filter = 'all' | 'shows' | 'practices' | 'events'

interface AgendaItem {
  id: string
  kind: 'show' | 'practice' | 'event'
  kindLabel: string
  icon: LucideIcon
  date: Date
  title: string
  subtitle?: string
  status: string
  tone: BadgeTone
  color: string // kind dot color (token var)
  isHosting?: boolean
  to: string
}

/**
 * Calendar (mobile-redesign-port P9).
 * Unified agenda merging Shows (accent) + Practices (info) on one time axis. Events (success)
 * join here once the events feature lands. Shows/Practices are reached through this tab.
 */
export function CalendarPage() {
  const navigate = useNavigate()
  const { currentBandId, currentUser } = useAuth()
  const bandId = currentBandId ?? ''
  const [filter, setFilter] = useState<Filter>('all')
  const [newMenuOpen, setNewMenuOpen] = useState(false)

  const { shows, loading: showsLoading } = useShows(bandId)
  const { practices, loading: practicesLoading } = usePractices(bandId)
  const { events, loading: eventsLoading } = useEvents()
  const loading = showsLoading || practicesLoading || eventsLoading

  const items = useMemo<AgendaItem[]>(() => {
    const showItems: AgendaItem[] =
      filter === 'practices'
        ? []
        : shows.map(s => ({
            id: s.id,
            kind: 'show' as const,
            kindLabel: 'Show',
            icon: Ticket,
            date: new Date(s.scheduledDate),
            title: s.name,
            subtitle: s.venue ?? s.location,
            status: s.status,
            tone: (SHOW_TONE[s.status as keyof typeof SHOW_TONE] ??
              'neutral') as BadgeTone,
            color: 'var(--accent)',
            to: `/shows/${s.id}`,
          }))
    const practiceItems: AgendaItem[] =
      filter === 'shows' || filter === 'events'
        ? []
        : practices.map(p => ({
            id: p.id,
            kind: 'practice' as const,
            kindLabel: 'Practice',
            icon: CalendarIcon,
            date: new Date(p.scheduledDate),
            title: 'Practice',
            subtitle: p.location,
            status: p.status,
            tone: (PRACTICE_TONE[p.status as keyof typeof PRACTICE_TONE] ??
              'neutral') as BadgeTone,
            color: 'var(--info)',
            to: `/practices/${p.id}`,
          }))
    const eventItems: AgendaItem[] =
      filter === 'shows' || filter === 'practices'
        ? []
        : events.map(e => ({
            id: e.id,
            kind: 'event' as const,
            kindLabel: 'Event',
            icon: PartyPopper,
            date: new Date(e.scheduledDate),
            title: e.name,
            subtitle: e.venue,
            status: e.status,
            tone: (SHOW_TONE[e.status as keyof typeof SHOW_TONE] ??
              'neutral') as BadgeTone,
            color: 'var(--success)',
            isHosting: !!currentUser && e.hostUserId === currentUser.id,
            to: `/events/${e.id}`,
          }))
    // showItems already excludes when filter==='practices'; also exclude for 'events'.
    const shows2 = filter === 'events' ? [] : showItems
    return [...shows2, ...practiceItems, ...eventItems]
  }, [shows, practices, events, filter, currentUser])

  const now = Date.now()
  const upcoming = items
    .filter(i => i.date.getTime() >= now)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
  const past = items
    .filter(i => i.date.getTime() < now)
    .sort((a, b) => b.date.getTime() - a.date.getTime())

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'shows', label: 'Shows' },
    { id: 'practices', label: 'Practices' },
    { id: 'events', label: 'Events' },
  ]

  const newActions = [
    {
      label: 'New event',
      icon: PartyPopper,
      to: '/events/new',
      testid: 'calendar-new-event',
    },
    {
      label: 'New show',
      icon: Ticket,
      to: '/shows/new',
      testid: 'calendar-new-show',
    },
    {
      label: 'New practice',
      icon: CalendarIcon,
      to: '/practices/new',
      testid: 'calendar-new-practice',
    },
  ]

  const Row = ({ item }: { item: AgendaItem }) => {
    const Icon = item.icon
    const month = item.date
      .toLocaleDateString('en-US', { month: 'short' })
      .toUpperCase()
    const day = item.date.getDate()
    return (
      <button
        onClick={() => navigate(item.to)}
        data-testid={`calendar-item-${item.kind}-${item.id}`}
        className="flex w-full items-stretch gap-3 rounded-xl border border-l-[3px] border-border-1 bg-bg-1 p-3 text-left transition-colors hover:border-border-2"
        style={{ borderLeftColor: item.color }}
      >
        {/* Date tile */}
        <span
          className="flex h-12 w-12 flex-shrink-0 flex-col items-center justify-center rounded-lg"
          style={{
            background: `color-mix(in srgb, ${item.color} 14%, transparent)`,
          }}
        >
          <span
            className="font-mono text-[9px] font-bold leading-none tracking-wider"
            style={{ color: item.color }}
          >
            {month}
          </span>
          <span className="mt-0.5 text-lg font-bold leading-none text-ink-1">
            {day}
          </span>
        </span>

        <span className="flex flex-1 min-w-0 flex-col justify-center">
          {/* Kind eyebrow + countdown */}
          <span className="flex items-center gap-1.5">
            <Icon size={12} style={{ color: item.color }} />
            <span
              className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em]"
              style={{ color: item.color }}
            >
              {item.kindLabel}
              {item.isHosting ? ' · Hosting' : ''}
            </span>
            <span className="ml-auto flex-shrink-0 font-mono text-[10px] text-ink-5">
              {formatCountdown(item.date)}
            </span>
          </span>
          {/* Title */}
          <span className="mt-0.5 truncate font-semibold text-ink-1">
            {item.title}
          </span>
          {/* Meta: time · place · status */}
          <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-4">
            <span className="inline-flex items-center gap-1">
              <Clock size={11} /> {formatTime12Hour(item.date)}
            </span>
            {item.subtitle && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin size={11} className="flex-shrink-0" />
                <span className="truncate">{item.subtitle}</span>
              </span>
            )}
            <Badge tone={item.tone} size="sm">
              {item.status}
            </Badge>
          </span>
        </span>
      </button>
    )
  }

  return (
    <div data-testid="calendar-page" className="max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-1">Calendar</h1>
        <div className="relative">
          <button
            onClick={() => setNewMenuOpen(o => !o)}
            data-testid="calendar-new-button"
            aria-expanded={newMenuOpen}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white"
          >
            <Plus size={16} /> New
          </button>
          {newMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setNewMenuOpen(false)}
              />
              <div
                className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-border-1 bg-bg-2 shadow-xl"
                data-testid="calendar-new-menu"
              >
                {newActions.map(({ label, icon: Icon, to, testid }) => (
                  <button
                    key={to}
                    onClick={() => {
                      setNewMenuOpen(false)
                      navigate(to)
                    }}
                    data-testid={testid}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-ink-2 hover:bg-bg-3 hover:text-ink-1"
                  >
                    <Icon size={16} className="text-accent" />
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <p className="mt-1 text-sm text-ink-4">
        Shows, practices &amp; events on one timeline
      </p>

      {/* Filter segmented control */}
      <div className="mt-4 inline-flex rounded-lg border border-border-1 bg-bg-1 p-0.5">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            data-testid={`calendar-filter-${f.id}`}
            aria-pressed={filter === f.id}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f.id
                ? 'bg-accent-soft text-accent'
                : 'text-ink-4 hover:text-ink-2'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <ContentLoadingSpinner isLoading={loading}>
        {upcoming.length === 0 && past.length === 0 ? (
          <EmptyState
            icon={CalendarIcon}
            title="Nothing on the calendar"
            description="Book a show or schedule a practice to see it here."
            size="lg"
            action={{
              label: 'Book a show',
              icon: Ticket,
              onClick: () => navigate('/shows/new'),
            }}
            secondaryAction={{
              label: 'Schedule practice',
              icon: CalendarIcon,
              onClick: () => navigate('/practices/new'),
            }}
          />
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {upcoming.length > 0 && (
              <div>
                <h2 className="mb-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-4">
                  Upcoming
                </h2>
                <div
                  className="flex flex-col gap-2"
                  data-testid="calendar-upcoming"
                >
                  {upcoming.map(item => (
                    <Row key={`${item.kind}-${item.id}`} item={item} />
                  ))}
                </div>
              </div>
            )}
            {past.length > 0 && (
              <div>
                <h2 className="mb-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-4">
                  Past
                </h2>
                <div
                  className="flex flex-col gap-2 opacity-70"
                  data-testid="calendar-past"
                >
                  {past.slice(0, 20).map(item => (
                    <Row key={`${item.kind}-${item.id}`} item={item} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </ContentLoadingSpinner>
    </div>
  )
}
