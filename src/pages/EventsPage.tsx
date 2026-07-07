import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  PartyPopper,
  MapPin,
  ChevronRight,
  Plus,
} from 'lucide-react'
import { useEvents } from '../hooks/useEvents'
import { useAuth } from '../contexts/AuthContext'
import { useViewport } from '../hooks/useResponsive'
import { formatShowDate } from '../utils/dateHelpers'
import type { EventSummary } from '../models/Event'
import { Avatar } from '../components/common/Avatar'
import { Badge } from '../components/common/Badge'
import { Eyebrow } from '../components/common/Eyebrow'
import { EmptyState } from '../components/common/EmptyState'
import { ContentLoadingSpinner } from '../components/common/ContentLoadingSpinner'
import { SHOW_TONE, type BadgeTone } from '../utils/tokens'
import { EventDetailContent } from './EventDetailPage'

/**
 * Events list (mobile-redesign-port P12).
 * Events you host or have been invited to play at. Split into Hosting vs Invited
 * to reflect the user-hosted event model (you host some, you're a guest at others).
 */
export function EventsPage() {
  const navigate = useNavigate()
  const { events, loading } = useEvents()
  const { currentUser } = useAuth()
  const { isDesktop } = useViewport()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const hosting = events.filter(e => e.hostUserId === currentUser?.id)
  const invited = events.filter(e => e.hostUserId !== currentUser?.id)

  // On desktop, default the detail pane to the first event once events load
  // — but never override a selection the user already made.
  useEffect(() => {
    if (!isDesktop || selectedId) return
    const first = hosting[0] ?? invited[0] ?? events[0]
    if (first) setSelectedId(first.id)
  }, [isDesktop, selectedId, hosting, invited, events])

  const handleOpen = (ev: EventSummary) => {
    if (isDesktop) {
      setSelectedId(ev.id)
    } else {
      navigate(`/events/${ev.id}`)
    }
  }

  const EventCard = ({
    ev,
    active,
    hosting,
    onOpen,
  }: {
    ev: EventSummary
    active: boolean
    hosting?: boolean
    onOpen: (ev: EventSummary) => void
  }) => (
    <button
      onClick={() => onOpen(ev)}
      data-testid={`event-${ev.id}`}
      className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
        active
          ? 'border-accent bg-accent-soft'
          : hosting
            ? 'border-success/50 bg-success/5 hover:border-success'
            : 'bg-bg-1 border-border-1 hover:border-border-2'
      }`}
    >
      <span
        className={`flex h-11 w-11 flex-shrink-0 flex-col items-center justify-center rounded-lg leading-none ${
          hosting ? 'bg-success/15 text-success' : 'bg-accent-soft text-accent'
        }`}
      >
        <span className="text-[9px] font-bold uppercase tracking-wider">
          {ev.scheduledDate.toLocaleDateString('en-US', { month: 'short' })}
        </span>
        <span className="mt-0.5 text-base font-bold">
          {ev.scheduledDate.getDate()}
        </span>
      </span>
      <span className="flex-1 min-w-0">
        <span className="block truncate font-semibold text-ink-1">
          {ev.name}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-xs text-ink-4">
          <span>{formatShowDate(ev.scheduledDate)}</span>
          {ev.venue && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={11} /> {ev.venue}
            </span>
          )}
          <Badge
            tone={
              (SHOW_TONE[ev.status as keyof typeof SHOW_TONE] ??
                'neutral') as BadgeTone
            }
            size="sm"
          >
            {ev.status}
          </Badge>
        </span>
      </span>
      {ev.participantCount ? (
        <span
          className="flex flex-shrink-0 items-center"
          data-testid={`event-people-${ev.id}`}
        >
          <span className="flex -space-x-2">
            {ev.participantNames?.slice(0, 3).map((n, i) => (
              <Avatar
                key={i}
                label={n}
                size="xs"
                className="ring-2 ring-bg-1"
              />
            ))}
          </span>
          {ev.participantCount > 3 && (
            <span className="ml-1 text-xs text-ink-5">
              +{ev.participantCount - 3}
            </span>
          )}
        </span>
      ) : null}
      <ChevronRight size={18} className="text-ink-5" />
    </button>
  )

  return (
    <div data-testid="events-page" className="max-w-6xl">
      <button
        onClick={() => navigate(-1)}
        data-testid="events-back"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink-1"
      >
        <ArrowLeft size={16} /> Back
      </button>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-1">Events</h1>
        <button
          onClick={() => navigate('/events/new')}
          data-testid="events-new-button"
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white"
        >
          <Plus size={16} /> Host
        </button>
      </div>
      <p className="mt-1 text-sm text-ink-4">
        Host a gig or jam and let people sign up to play
      </p>

      <ContentLoadingSpinner isLoading={loading}>
        {events.length === 0 ? (
          <EmptyState
            icon={PartyPopper}
            title="No events yet"
            description="Events you host or join will appear here."
            size="lg"
          />
        ) : (
          <div className="mt-5 flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(280px,340px)_1fr] lg:gap-6 lg:items-start">
            <div className="flex flex-col gap-5" data-testid="events-list">
              {hosting.length > 0 && (
                <div>
                  <Eyebrow className="mb-2">Hosting ({hosting.length})</Eyebrow>
                  <div
                    className="flex flex-col gap-2"
                    data-testid="events-hosting"
                  >
                    {hosting.map(ev => (
                      <EventCard
                        key={ev.id}
                        ev={ev}
                        hosting
                        active={isDesktop && selectedId === ev.id}
                        onOpen={handleOpen}
                      />
                    ))}
                  </div>
                </div>
              )}
              {invited.length > 0 && (
                <div>
                  <Eyebrow className="mb-2">Invited ({invited.length})</Eyebrow>
                  <div
                    className="flex flex-col gap-2"
                    data-testid="events-invited"
                  >
                    {invited.map(ev => (
                      <EventCard
                        key={ev.id}
                        ev={ev}
                        active={isDesktop && selectedId === ev.id}
                        onOpen={handleOpen}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {isDesktop && (
              <div data-testid="events-detail-pane">
                {selectedId ? (
                  <EventDetailContent eventId={selectedId} embedded />
                ) : (
                  <EmptyState
                    icon={PartyPopper}
                    title="Select an event"
                    description="Pick an event to see its lineup and details."
                    size="lg"
                  />
                )}
              </div>
            )}
          </div>
        )}
      </ContentLoadingSpinner>
    </div>
  )
}
