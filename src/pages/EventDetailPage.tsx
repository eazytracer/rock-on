import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin, Check, X, Music, Plus } from 'lucide-react'
import { useEventDetail } from '../hooks/useEvents'
import { useToast } from '../contexts/ToastContext'
import { formatShowDate } from '../utils/dateHelpers'
import { Badge } from '../components/common/Badge'
import { Eyebrow } from '../components/common/Eyebrow'
import { ContentLoadingSpinner } from '../components/common/ContentLoadingSpinner'
import { EmptyState } from '../components/common/EmptyState'
import { SongCastPanel } from '../components/casting/SongCastPanel'
import { SHOW_TONE, type BadgeTone } from '../utils/tokens'
import type { LineupSource } from '../models/Event'

/** Where a lineup song came from → its display pill (tone + label). */
const SOURCE_PILL: Record<LineupSource, { tone: BadgeTone; label: string }> = {
  mine: { tone: 'accent', label: 'Mine' },
  band: { tone: 'info', label: 'Band' },
  public: { tone: 'success', label: 'Public' },
  external: { tone: 'neutral', label: 'Not linked' },
}

/**
 * Event detail (mobile-redesign-port P12).
 * Shows the confirmed lineup and the song-request → host-approve flow: any
 * participant can request a song; the host approves (→ it joins the lineup) or rejects.
 */
export function EventDetailPage() {
  const navigate = useNavigate()
  const { eventId } = useParams<{ eventId: string }>()
  const { showToast } = useToast()
  const {
    event,
    lineup,
    requests,
    isManager,
    loading,
    addRequest,
    approve,
    reject,
  } = useEventDetail(eventId)

  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [sending, setSending] = useState(false)
  const [castOpen, setCastOpen] = useState<string | null>(null)

  const submitRequest = async () => {
    if (!title.trim() || !artist.trim()) return
    setSending(true)
    const res = await addRequest(title, artist)
    setSending(false)
    if (res.ok) {
      showToast('Song requested', 'success')
      setTitle('')
      setArtist('')
    } else {
      showToast(res.error ?? 'Could not request song', 'error')
    }
  }

  return (
    <div data-testid="event-detail-page" className="max-w-3xl">
      <button
        onClick={() => navigate('/events')}
        data-testid="event-back"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink-1"
      >
        <ArrowLeft size={16} /> Events
      </button>

      <ContentLoadingSpinner isLoading={loading}>
        {!event ? (
          <EmptyState icon={Music} title="Event not found" size="lg" />
        ) : (
          <div className="flex flex-col gap-6">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-ink-1">{event.name}</h1>
                <Badge
                  tone={
                    (SHOW_TONE[event.status as keyof typeof SHOW_TONE] ??
                      'neutral') as BadgeTone
                  }
                  size="sm"
                >
                  {event.status}
                </Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-ink-4">
                <span>{formatShowDate(event.scheduledDate)}</span>
                {event.venue && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={13} /> {event.venue}
                  </span>
                )}
                {isManager && (
                  <Badge tone="accent" size="sm">
                    Hosting
                  </Badge>
                )}
              </div>
            </div>

            {/* Lineup */}
            <div>
              <Eyebrow className="mb-2">Lineup ({lineup.length})</Eyebrow>
              {lineup.length === 0 ? (
                <p className="text-sm text-ink-5">
                  No songs in the lineup yet.
                </p>
              ) : (
                <div className="flex flex-col gap-2" data-testid="event-lineup">
                  {lineup.map(item => (
                    <div key={item.id} data-testid={`lineup-item-${item.id}`}>
                      <div className="flex items-center gap-3 rounded-xl bg-bg-1 border border-border-1 p-3">
                        <span className="font-mono text-xs text-ink-5 w-5 text-right">
                          {item.position}
                        </span>
                        <Music size={16} className="text-ink-4" />
                        <span className="flex-1 min-w-0">
                          <span className="block truncate font-medium text-ink-1">
                            {item.displayTitle}
                          </span>
                          <span className="block truncate text-xs text-ink-4">
                            {item.displayArtist}
                          </span>
                        </span>
                        <Badge
                          tone={SOURCE_PILL[item.source].tone}
                          size="sm"
                          dot={false}
                          data-testid={`lineup-source-${item.id}`}
                          className="flex-shrink-0"
                        >
                          {SOURCE_PILL[item.source].label}
                        </Badge>
                        <button
                          onClick={() =>
                            setCastOpen(o => (o === item.id ? null : item.id))
                          }
                          data-testid={`cast-toggle-${item.id}`}
                          className="flex-shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-ink-3 hover:text-accent"
                        >
                          {castOpen === item.id ? 'Hide' : 'Cast'}
                        </button>
                      </div>
                      {castOpen === item.id && (
                        <SongCastPanel
                          contextType="event"
                          contextId={event.id}
                          bandId={event.bandId}
                          slotId={item.id}
                          songId={item.songId}
                          canEdit={isManager}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pending song requests */}
            {requests.length > 0 && (
              <div>
                <Eyebrow className="mb-2">
                  {isManager
                    ? `Requests to review (${requests.length})`
                    : `Your requests (${requests.length})`}
                </Eyebrow>
                <div
                  className="flex flex-col gap-2"
                  data-testid="event-requests"
                >
                  {requests.map(req => (
                    <div
                      key={req.id}
                      className="flex items-center gap-3 rounded-xl bg-bg-1 border border-border-2 p-3"
                      data-testid={`event-request-${req.id}`}
                    >
                      <span className="flex-1 min-w-0">
                        <span className="block truncate font-medium text-ink-1">
                          {req.displayTitle}
                        </span>
                        <span className="block truncate text-xs text-ink-4">
                          {req.displayArtist}
                        </span>
                      </span>
                      <Badge tone="warn" size="sm">
                        pending
                      </Badge>
                      {isManager && (
                        <>
                          <button
                            onClick={() => void approve(req.id)}
                            data-testid={`event-approve-${req.id}`}
                            aria-label="Approve"
                            className="rounded-lg bg-accent-soft p-2 text-accent hover:brightness-110"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => void reject(req.id)}
                            data-testid={`event-reject-${req.id}`}
                            aria-label="Reject"
                            className="rounded-lg p-2 text-ink-4 hover:text-ink-1 hover:bg-bg-3"
                          >
                            <X size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Request a song */}
            <div>
              <Eyebrow className="mb-2">Request a song</Eyebrow>
              <div className="flex flex-col gap-2 rounded-xl bg-bg-1 border border-border-1 p-3">
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Song title"
                  name="requestTitle"
                  id="event-request-title"
                  data-testid="event-request-title"
                  className="rounded-lg bg-bg-2 border border-border-1 px-3 py-2 text-sm text-ink-1 placeholder:text-ink-5 focus:border-accent focus:outline-none"
                />
                <input
                  value={artist}
                  onChange={e => setArtist(e.target.value)}
                  placeholder="Artist"
                  name="requestArtist"
                  id="event-request-artist"
                  data-testid="event-request-artist"
                  className="rounded-lg bg-bg-2 border border-border-1 px-3 py-2 text-sm text-ink-1 placeholder:text-ink-5 focus:border-accent focus:outline-none"
                />
                <button
                  onClick={submitRequest}
                  disabled={sending || !title.trim() || !artist.trim()}
                  data-testid="event-request-submit"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent-soft px-3 py-2 text-sm font-medium text-accent disabled:opacity-50"
                >
                  <Plus size={16} /> Request song
                </button>
                {isManager && (
                  <p className="text-[11px] text-ink-5">
                    You're hosting — your request will appear above to approve.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </ContentLoadingSpinner>
    </div>
  )
}
