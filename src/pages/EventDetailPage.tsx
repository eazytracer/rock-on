import { Fragment, Suspense, lazy, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  ArrowLeft,
  MapPin,
  Check,
  X,
  Music,
  Plus,
  Users,
  Globe,
  Link2,
  Lock,
  QrCode,
  Copy,
  List,
  LayoutGrid,
} from 'lucide-react'
import {
  useEventDetail,
  useEventHands,
  useEventParticipants,
} from '../hooks/useEvents'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useGoBack } from '../hooks/useGoBack'
import { useCasting } from '../hooks/useCasting'
import { useViewport } from '../hooks/useResponsive'
import { EventService } from '../services/EventService'
import { formatShowDate } from '../utils/dateHelpers'
import { Avatar } from '../components/common/Avatar'
import { Badge } from '../components/common/Badge'
import { Eyebrow } from '../components/common/Eyebrow'
import { ContentLoadingSpinner } from '../components/common/ContentLoadingSpinner'
import { EmptyState } from '../components/common/EmptyState'
import { SongCastPanel } from '../components/casting/SongCastPanel'
import { EventCastGrid } from '../components/casting/EventCastGrid'
import { LineupCard } from '../components/casting/LineupCard'
import { InviteFriendsSheet } from '../components/events/InviteFriendsSheet'
import { SHOW_TONE, type BadgeTone } from '../utils/tokens'
import type { EventVisibility, LineupSource } from '../models/Event'

// Lazy-load the QR renderer (keeps qrcode.react out of the main bundle).
const QRCodeSVG = lazy(() =>
  import('qrcode.react').then(mod => ({ default: mod.QRCodeSVG }))
)

/** Where a lineup song came from → its display pill (tone + label). */
const SOURCE_PILL: Record<LineupSource, { tone: BadgeTone; label: string }> = {
  mine: { tone: 'accent', label: 'Mine' },
  band: { tone: 'info', label: 'Band' },
  public: { tone: 'success', label: 'Public' },
  external: { tone: 'neutral', label: 'Not linked' },
}

const VISIBILITY_META: Record<
  EventVisibility,
  { icon: typeof Globe; label: string; hint: string }
> = {
  public: {
    icon: Globe,
    label: 'Public',
    hint: 'Anyone can find & request to join',
  },
  unlisted: {
    icon: Link2,
    label: 'Unlisted',
    hint: 'Only people with the link or code',
  },
  private: { icon: Lock, label: 'Private', hint: 'Invite-only, no code' },
}

type EventTab = 'lineup' | 'requests' | 'people' | 'access'

/**
 * Event detail (mobile-redesign-port · fork #5).
 * Tabbed: Lineup (cast + guest raise-a-hand) · Requests (song request → resolve) ·
 * People (participants) · Access (host visibility/code/permissions).
 */
export function EventDetailContent({
  eventId,
  embedded = false,
}: {
  eventId?: string
  embedded?: boolean
}) {
  const { showToast } = useToast()
  const { user } = useAuth()
  const goBack = useGoBack('/calendar?filter=events')
  const {
    event,
    lineup,
    requests,
    isManager,
    loading,
    refetch,
    addRequest,
    approve,
    reject,
  } = useEventDetail(eventId)
  const { hands, raiseHand, withdrawHand, acceptHand, declineHand } =
    useEventHands(eventId)
  const { participants, refetch: refetchParticipants } =
    useEventParticipants(eventId)
  const { isMobile } = useViewport()
  // Casting at the detail level drives the header progress bar + the per-guest
  // cast-status line on the People tab (the Grid/panels still own their own edits).
  const { casting, defaultParts } = useCasting('event', eventId, event?.bandId)

  const castTotal = defaultParts.length * lineup.length
  const castFilled = lineup.reduce(
    (sum, item) =>
      sum +
      defaultParts.filter(part =>
        casting.some(
          c => c.slotId === item.id && c.roleKey === part.key && c.isPrimary
        )
      ).length,
    0
  )
  const castPct = castTotal > 0 ? Math.round((castFilled / castTotal) * 100) : 0

  /** "Cast for N parts" / "Hand up · Role" sublabel for a participant. */
  const castStatusFor = (userId: string): string | null => {
    const parts = casting.filter(
      c => c.memberId === userId && c.isPrimary
    ).length
    if (parts > 0) return `Cast for ${parts} part${parts === 1 ? '' : 's'}`
    const hand = hands.find(h => h.userId === userId && h.status === 'raised')
    if (hand) {
      const role = defaultParts.find(p => p.key === hand.roleKey)
      return `Hand up · ${role?.label ?? hand.roleKey}`
    }
    return null
  }

  const [tab, setTab] = useState<EventTab>('lineup')
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [sending, setSending] = useState(false)
  const [castOpen, setCastOpen] = useState<string | null>(null)
  const [showQR, setShowQR] = useState(false)
  const [castView, setCastView] = useState<'list' | 'grid'>('list')

  const isParticipant = !!participants.find(p => p.userId === user?.id)
  const canRaiseHand = !!event?.allowSuggestions && isParticipant && !isManager
  const myName = user?.name?.trim() || 'Guest'
  const selectedLineupItem = lineup.find(i => i.id === castOpen) ?? null
  // Insert the cast panel right after the selected card's row so it opens
  // inline under the chosen song (not at the bottom of the whole grid).
  const selectedIdx = lineup.findIndex(i => i.id === castOpen)
  const panelAfterIdx =
    selectedIdx < 0
      ? -1
      : isMobile
        ? selectedIdx
        : selectedIdx % 2 === 0
          ? Math.min(selectedIdx + 1, lineup.length - 1)
          : selectedIdx

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

  const onRaiseHand = async (lineupItemId: string, roleKey: string) => {
    const res = await raiseHand({ lineupItemId, roleKey, userName: myName })
    showToast(
      res.ok ? 'Hand raised' : (res.error ?? 'Could not raise hand'),
      res.ok ? 'success' : 'error'
    )
  }

  const resolveHand = async (handId: string, accept: boolean) => {
    if (accept) await acceptHand(handId)
    else await declineHand(handId)
  }

  const updateAccess = async (
    patch: Parameters<typeof EventService.updateAccess>[1]
  ) => {
    if (!eventId) return
    const ok = await EventService.updateAccess(eventId, patch)
    if (ok) await refetch()
    else showToast('Could not update access', 'error')
  }

  const joinUrl =
    event?.shortCode && event.visibility !== 'private'
      ? `${window.location.origin}/events?join=${event.shortCode}`
      : ''

  const copy = (text: string, label: string) => {
    void navigator.clipboard?.writeText(text)
    showToast(`${label} copied`, 'success')
  }

  const TABS: { key: EventTab; label: string; badge?: number }[] = [
    { key: 'lineup', label: 'Lineup' },
    { key: 'requests', label: 'Requests', badge: requests.length || undefined },
    { key: 'people', label: 'People' },
    ...(isManager ? [{ key: 'access' as EventTab, label: 'Access' }] : []),
  ]

  return (
    <div
      data-testid="event-detail-page"
      className={embedded ? '' : 'max-w-3xl'}
    >
      {!embedded && (
        <button
          onClick={goBack}
          data-testid="event-back"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink-1"
        >
          <ArrowLeft size={16} /> Back
        </button>
      )}

      <ContentLoadingSpinner isLoading={loading}>
        {!event ? (
          <EmptyState icon={Music} title="Event not found" size="lg" />
        ) : (
          <div className="flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-ink-1">
                    {event.name}
                  </h1>
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
                  <Badge tone={isManager ? 'accent' : 'info'} size="sm">
                    {isManager ? 'Hosting' : 'Guest'}
                  </Badge>
                </div>
              </div>
              {isManager && eventId && (
                <InviteFriendsSheet
                  eventId={eventId}
                  participantIds={new Set(participants.map(p => p.userId))}
                  onInvited={refetchParticipants}
                  position={isMobile ? 'bottom' : 'right'}
                />
              )}
            </div>

            {/* Cast progress + List/Grid toggle (host, above the tabs) */}
            {isManager && lineup.length > 0 && (
              <div
                className="flex items-center gap-4"
                data-testid="event-cast-progress"
              >
                <div className="flex-1">
                  <div className="mb-1.5 flex justify-between text-xs text-ink-3">
                    <span>
                      <b className="text-ink-1">{castFilled}</b> of {castTotal}{' '}
                      parts cast
                    </span>
                    <span className="font-mono">{castPct}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-3">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${castPct}%` }}
                      data-testid="event-cast-progress-bar"
                    />
                  </div>
                </div>
                <div
                  className="inline-flex flex-shrink-0 rounded-lg border border-border-1 bg-bg-1 p-0.5"
                  data-testid="cast-view-toggle"
                >
                  <button
                    onClick={() => setCastView('list')}
                    data-testid="cast-view-list"
                    aria-pressed={castView === 'list'}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      castView === 'list'
                        ? 'bg-accent-soft text-accent'
                        : 'text-ink-4 hover:text-ink-2'
                    }`}
                  >
                    <List size={14} /> List
                  </button>
                  <button
                    onClick={() => setCastView('grid')}
                    data-testid="cast-view-grid"
                    aria-pressed={castView === 'grid'}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      castView === 'grid'
                        ? 'bg-accent-soft text-accent'
                        : 'text-ink-4 hover:text-ink-2'
                    }`}
                  >
                    <LayoutGrid size={14} /> Grid
                  </button>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div
              className="flex gap-1 border-b border-border-1"
              data-testid="event-tabs"
            >
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  data-testid={`event-tab-${t.key}`}
                  aria-current={tab === t.key}
                  className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                    tab === t.key
                      ? 'border-accent text-ink-1'
                      : 'border-transparent text-ink-4 hover:text-ink-2'
                  }`}
                >
                  {t.label}
                  {t.badge != null && (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-warn-soft px-1 text-[10px] font-bold text-warn">
                      {t.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── Lineup ─────────────────────────────────────────────── */}
            {tab === 'lineup' && (
              <div>
                {lineup.length === 0 ? (
                  <p className="text-sm text-ink-5">
                    No songs in the lineup yet.
                  </p>
                ) : isManager && castView === 'grid' ? (
                  <EventCastGrid
                    eventId={event.id}
                    bandId={event.bandId}
                    lineup={lineup}
                    hands={hands}
                    isManager={isManager}
                    currentUserId={user?.id}
                    onResolveHand={resolveHand}
                  />
                ) : (
                  // 2-column card grid (D2). Selecting a card opens the shared
                  // cast panel inline, right after that song's row.
                  <div
                    className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                    data-testid="event-lineup"
                  >
                    {lineup.map((item, idx) => (
                      <Fragment key={item.id}>
                        <LineupCard
                          item={item}
                          defaultParts={defaultParts}
                          casting={casting}
                          hands={hands}
                          isManager={isManager}
                          selected={castOpen === item.id}
                          sourcePill={SOURCE_PILL[item.source]}
                          onSelect={() =>
                            setCastOpen(o => (o === item.id ? null : item.id))
                          }
                        />
                        {idx === panelAfterIdx && selectedLineupItem && (
                          <div
                            className="sm:col-span-2"
                            data-testid={`lineup-item-${selectedLineupItem.id}`}
                          >
                            <div className="flex items-center gap-2">
                              <Music size={15} className="text-ink-4" />
                              <span className="truncate text-sm font-semibold text-ink-1">
                                {selectedLineupItem.displayTitle}
                              </span>
                              <span className="truncate text-xs text-ink-4">
                                {selectedLineupItem.displayArtist}
                              </span>
                              <button
                                onClick={() => setCastOpen(null)}
                                data-testid="lineup-cast-close"
                                aria-label="Close casting"
                                className="ml-auto flex-shrink-0 rounded-lg p-1 text-ink-4 hover:text-ink-1 hover:bg-bg-3"
                              >
                                <X size={16} />
                              </button>
                            </div>
                            <SongCastPanel
                              contextType="event"
                              contextId={event.id}
                              bandId={event.bandId}
                              slotId={selectedLineupItem.id}
                              songId={selectedLineupItem.songId}
                              canEdit={isManager}
                              hands={hands}
                              currentUserId={user?.id}
                              canRaiseHand={canRaiseHand}
                              onRaiseHand={roleKey =>
                                void onRaiseHand(selectedLineupItem.id, roleKey)
                              }
                              onWithdrawHand={h => void withdrawHand(h)}
                              onResolveHand={resolveHand}
                            />
                          </div>
                        )}
                      </Fragment>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Requests ───────────────────────────────────────────── */}
            {tab === 'requests' && (
              <div className="flex flex-col gap-5">
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

                {event.allowSuggestions ? (
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
                      {event.autoApprove && (
                        <p className="text-[11px] text-ink-5">
                          Auto-approve is on — requests go straight to the
                          lineup.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  requests.length === 0 && (
                    <EmptyState
                      icon={Music}
                      title="Requests are closed"
                      description="The host isn't taking song requests for this event."
                      size="md"
                    />
                  )
                )}
              </div>
            )}

            {/* ── People ─────────────────────────────────────────────── */}
            {tab === 'people' && (
              <div>
                <Eyebrow className="mb-2">
                  Participants ({participants.length})
                </Eyebrow>
                {participants.length === 0 ? (
                  <EmptyState icon={Users} title="No one yet" size="md" />
                ) : (
                  <div
                    className="flex flex-col gap-2"
                    data-testid="event-people"
                  >
                    {participants.map(p => {
                      const status = castStatusFor(p.userId)
                      return (
                        <div
                          key={p.userId}
                          className="flex items-center gap-3 rounded-xl bg-bg-1 border border-border-1 p-3"
                          data-testid={`event-person-${p.userId}`}
                        >
                          <Avatar label={p.name} size="sm" />
                          <span className="flex-1 min-w-0">
                            <span className="block truncate font-medium text-ink-1">
                              {p.name}
                            </span>
                            {status && (
                              <span className="block truncate text-xs text-ink-4">
                                {status}
                              </span>
                            )}
                          </span>
                          <Badge
                            tone={
                              p.accessTier === 'host' ||
                              p.accessTier === 'cohost'
                                ? 'accent'
                                : 'neutral'
                            }
                            size="sm"
                          >
                            {p.accessTier}
                          </Badge>
                          <span className="text-xs capitalize text-ink-4">
                            {p.rsvp}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Access (host only) ─────────────────────────────────── */}
            {tab === 'access' && isManager && (
              <div className="flex flex-col gap-5" data-testid="event-access">
                {/* Visibility */}
                <div>
                  <Eyebrow className="mb-2">Who can see this</Eyebrow>
                  <div className="flex flex-col gap-2">
                    {(
                      ['public', 'unlisted', 'private'] as EventVisibility[]
                    ).map(v => {
                      const meta = VISIBILITY_META[v]
                      const Icon = meta.icon
                      const active = event.visibility === v
                      return (
                        <button
                          key={v}
                          onClick={() => void updateAccess({ visibility: v })}
                          data-testid={`access-visibility-${v}`}
                          aria-pressed={active}
                          className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                            active
                              ? 'border-accent bg-accent-soft'
                              : 'border-border-1 hover:border-border-2'
                          }`}
                        >
                          <Icon
                            size={18}
                            className={active ? 'text-accent' : 'text-ink-4'}
                          />
                          <span className="flex-1">
                            <span
                              className={`block text-sm font-semibold ${
                                active ? 'text-accent' : 'text-ink-1'
                              }`}
                            >
                              {meta.label}
                            </span>
                            <span className="block text-xs text-ink-4">
                              {meta.hint}
                            </span>
                          </span>
                          {active && (
                            <Check size={16} className="text-accent" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Join code + QR */}
                {joinUrl && event.shortCode && (
                  <div>
                    <Eyebrow className="mb-2">Join code</Eyebrow>
                    <div className="rounded-xl bg-bg-1 border border-border-1 p-4">
                      <div className="flex items-center gap-3">
                        <span
                          className="flex-1 font-mono text-xl font-bold tracking-widest text-accent"
                          data-testid="access-join-code"
                        >
                          {event.shortCode}
                        </span>
                        <button
                          onClick={() => copy(event.shortCode!, 'Code')}
                          data-testid="access-copy-code"
                          aria-label="Copy code"
                          className="rounded-lg p-2 text-ink-3 hover:text-ink-1 hover:bg-bg-3"
                        >
                          <Copy size={16} />
                        </button>
                        <button
                          onClick={() => setShowQR(v => !v)}
                          data-testid="access-qr-toggle"
                          aria-pressed={showQR}
                          aria-label="Show QR code"
                          className={`rounded-lg p-2 hover:bg-bg-3 ${
                            showQR
                              ? 'text-accent'
                              : 'text-ink-3 hover:text-ink-1'
                          }`}
                        >
                          <QrCode size={16} />
                        </button>
                      </div>
                      {showQR && (
                        <div
                          className="mt-3 flex flex-col items-center gap-2"
                          data-testid="access-qr"
                        >
                          <Suspense
                            fallback={
                              <div className="h-[168px] w-[168px] animate-pulse rounded-xl bg-bg-3" />
                            }
                          >
                            <div className="rounded-xl bg-white p-3">
                              <QRCodeSVG value={joinUrl} size={168} level="M" />
                            </div>
                          </Suspense>
                        </div>
                      )}
                      <button
                        onClick={() => copy(joinUrl, 'Link')}
                        data-testid="access-copy-link"
                        className="mt-3 w-full rounded-lg border border-border-1 py-2 text-sm text-ink-2 hover:border-border-2"
                      >
                        Copy invite link
                      </button>
                    </div>
                  </div>
                )}

                {/* Guest permissions */}
                <div>
                  <Eyebrow className="mb-2">Guest permissions</Eyebrow>
                  <div className="flex flex-col gap-2">
                    <AccessToggle
                      testid="access-allow-suggestions"
                      label="Allow song requests"
                      hint="Requests come to you to approve"
                      on={event.allowSuggestions}
                      onToggle={() =>
                        void updateAccess({
                          allowSuggestions: !event.allowSuggestions,
                        })
                      }
                    />
                    <AccessToggle
                      testid="access-auto-approve"
                      label="Auto-approve requests"
                      hint="Off = you resolve each one"
                      on={event.autoApprove}
                      onToggle={() =>
                        void updateAccess({ autoApprove: !event.autoApprove })
                      }
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ContentLoadingSpinner>
    </div>
  )
}

export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>()
  return <EventDetailContent eventId={eventId} />
}

/** A themed on/off switch row for the Access tab. */
function AccessToggle({
  testid,
  label,
  hint,
  on,
  onToggle,
}: {
  testid: string
  label: string
  hint: string
  on: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-bg-1 border border-border-1 p-3">
      <span className="flex-1">
        <span className="block text-sm font-medium text-ink-1">{label}</span>
        <span className="block text-xs text-ink-4">{hint}</span>
      </span>
      <button
        onClick={onToggle}
        data-testid={testid}
        aria-pressed={on}
        aria-label={label}
        className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
          on ? 'bg-accent' : 'bg-bg-4'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            on ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
