import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  PartyPopper,
  MapPin,
  ChevronRight,
  Plus,
} from 'lucide-react'
import { useEvents } from '../hooks/useEvents'
import { formatShowDate } from '../utils/dateHelpers'
import { Badge } from '../components/common/Badge'
import { EmptyState } from '../components/common/EmptyState'
import { ContentLoadingSpinner } from '../components/common/ContentLoadingSpinner'
import { SHOW_TONE, type BadgeTone } from '../utils/tokens'

/**
 * Events list (mobile-redesign-port P12).
 * Events you host or have been invited to play at.
 */
export function EventsPage() {
  const navigate = useNavigate()
  const { events, loading } = useEvents()

  return (
    <div data-testid="events-page">
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
          <Plus size={16} /> New
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
          <div className="mt-5 flex flex-col gap-2" data-testid="events-list">
            {events.map(ev => (
              <button
                key={ev.id}
                onClick={() => navigate(`/events/${ev.id}`)}
                data-testid={`event-${ev.id}`}
                className="flex items-center gap-3 rounded-xl bg-bg-1 border border-border-1 p-4 text-left transition-colors hover:border-border-2"
              >
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <PartyPopper size={20} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold text-ink-1">
                      {ev.name}
                    </span>
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
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-ink-4">
                    <span>{formatShowDate(ev.scheduledDate)}</span>
                    {ev.venue && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={11} /> {ev.venue}
                      </span>
                    )}
                  </span>
                </span>
                <ChevronRight size={18} className="text-ink-5" />
              </button>
            ))}
          </div>
        )}
      </ContentLoadingSpinner>
    </div>
  )
}
