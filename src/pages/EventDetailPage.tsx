import {
  Suspense,
  lazy,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Check,
  X,
  Music,
  Plus,
  Pencil,
  Trash2,
  LogOut,
  ShieldCheck,
  ShieldOff,
  Users,
  Globe,
  Link2,
  Lock,
  QrCode,
  Copy,
  List,
  LayoutGrid,
  PartyPopper,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from '@dnd-kit/modifiers'
import {
  useEventDetail,
  useEventHands,
  useEventParticipants,
} from '../hooks/useEvents'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { BackLink } from '../components/common/BackLink'
import { useCasting } from '../hooks/useCasting'
import { useViewport } from '../hooks/useResponsive'
import { EventService } from '../services/EventService'
import {
  formatShowDate,
  formatTime12Hour,
  formatDateForInput,
  parseDateInputAsLocal,
  parseTime12Hour,
} from '../utils/dateHelpers'
import { Avatar } from '../components/common/Avatar'
import { Badge } from '../components/common/Badge'
import { Eyebrow } from '../components/common/Eyebrow'
import { InlineEditableField } from '../components/common/InlineEditableField'
import { ScheduleMetaRow } from '../components/common/ScheduleMetaRow'
import { Dropdown, type DropdownGroup } from '../components/common/Dropdown'
import { ContentLoadingSpinner } from '../components/common/ContentLoadingSpinner'
import { EmptyState } from '../components/common/EmptyState'
import { SongCastPanel } from '../components/casting/SongCastPanel'
import { EventCastGrid } from '../components/casting/EventCastGrid'
import {
  LineupCard,
  type DragHandleListeners,
} from '../components/casting/LineupCard'
import { InviteFriendsSheet } from '../components/events/InviteFriendsSheet'
import { SlideOutTray } from '../components/common/SlideOutTray'
import { KebabMenu, type KebabMenuItem } from '../components/common/KebabMenu'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { useConfirm } from '../hooks/useConfirm'
import CircleOfFifths from '../components/songs/CircleOfFifths'
import { useTunings } from '../hooks/useTunings'
import {
  tuningColor,
  tuningLabel,
  tuningOrderIndex,
  canonicalTuningId,
} from '../utils/tunings'
import { DEFAULT_LINEUP } from '../models/Casting'
import type {
  EventVisibility,
  LineupItem,
  LineupRequest,
  EventParticipant,
} from '../models/Event'

/** The fixed five parts a requester can offer to play ("I'd play" chips). */
const OFFER_PARTS = DEFAULT_LINEUP.filter(r => r.isDefaultPart)
const PART_LABEL: Record<string, string> = Object.fromEntries(
  DEFAULT_LINEUP.map(r => [r.key, r.label])
)

// Lazy-load the QR renderer (keeps qrcode.react out of the main bundle).
const QRCodeSVG = lazy(() =>
  import('qrcode.react').then(mod => ({ default: mod.QRCodeSVG }))
)

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
  const navigate = useNavigate()
  const { confirm, dialogProps } = useConfirm()
  const {
    event,
    lineup,
    requests,
    isManager: isHost,
    loading,
    refetch,
    addRequest,
    addLineupItem,
    reorderLineup,
    updateLineupItem,
    removeLineupItem,
    updateEvent,
    cancelEvent,
    approve,
    reject,
  } = useEventDetail(eventId)
  const { hands, raiseHand, withdrawHand, acceptHand, declineHand } =
    useEventHands(eventId)
  const {
    participants,
    refetch: refetchParticipants,
    removeParticipant,
    leaveEvent,
    setParticipantTier,
  } = useEventParticipants(eventId)

  // Permission split: the HOST can alter/cancel the event + manage co-hosts;
  // MANAGERS (host + co-hosts) can cast, approve requests, and manage the lineup
  // (mirrors the DB `is_event_manager`). `useEventDetail.isManager` is host-only,
  // so co-hosts are folded in here from their participant tier.
  const isCohost = !!(
    user &&
    participants.find(p => p.userId === user.id)?.accessTier === 'cohost'
  )
  const isManager = isHost || isCohost

  // Drag-to-reorder sensors (manager-only lineup list). PointerSensor with a
  // small activation distance so a tap-to-expand card still registers as a click.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const { isMobile } = useViewport()
  // Casting at the detail level drives the header progress bar + the per-guest
  // cast-status line on the People tab (the Grid/panels still own their own edits).
  const { casting, defaultParts } = useCasting('event', eventId, event?.bandId)

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
  const [offerParts, setOfferParts] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [castOpen, setCastOpen] = useState<string | null>(null)
  const [showQR, setShowQR] = useState(false)
  const [castView, setCastView] = useState<'list' | 'grid'>('list')
  const [addSongOpen, setAddSongOpen] = useState(false)
  const [addTitle, setAddTitle] = useState('')
  const [addArtist, setAddArtist] = useState('')
  const [addingSong, setAddingSong] = useState(false)
  // When set, the Add-song tray is in "edit" mode for this lineup item.
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  // Per-song tuning (name string, source of truth) + its Dropdown id, and key.
  const [addTuning, setAddTuning] = useState('')
  const [addTuningId, setAddTuningId] = useState('')
  const [addKey, setAddKey] = useState('')
  const [showKeyPicker, setShowKeyPicker] = useState(false)

  // Tuning picker data (guitar built-ins + the user's customs), reused from the
  // song editor. Guitar-only — bass tunings just clutter the picker.
  const { builtins: builtinTunings, customs: customTunings } =
    useTunings('guitar')

  const tuningGroups: DropdownGroup[] = [
    {
      label: 'Built-in',
      options: [...builtinTunings]
        .sort(
          (a, b) =>
            tuningOrderIndex(a.slug) - tuningOrderIndex(b.slug) ||
            a.name.localeCompare(b.name)
        )
        .map(t => ({
          value: t.id,
          label: t.name,
          color: t.color ?? tuningColor(t.name),
        })),
    },
    ...(customTunings.length
      ? [
          {
            label: 'Your tunings',
            options: customTunings.map(t => ({
              value: t.id,
              label: t.name,
              color: t.color ?? undefined,
              tag: 'custom',
            })),
          },
        ]
      : []),
  ]

  const handleAddTuningChange = (id: string) => {
    const t = [...builtinTunings, ...customTunings].find(x => x.id === id)
    setAddTuningId(id)
    setAddTuning(t?.name ?? '')
  }

  // Edit prefill only has the tuning NAME; once tunings load, resolve the
  // matching built-in id so the Dropdown highlights the selected option.
  useEffect(() => {
    if (addTuningId || !addTuning || builtinTunings.length === 0) return
    const match = builtinTunings.find(
      t => t.slug === canonicalTuningId(addTuning)
    )
    if (match) setAddTuningId(match.id)
  }, [builtinTunings, addTuningId, addTuning])

  const isParticipant = !!participants.find(p => p.userId === user?.id)
  const canRaiseHand = !!event?.allowSuggestions && isParticipant && !isManager
  const myName = user?.name?.trim() || 'Guest'

  // Header display values (date/time/venue) — inline-edited via ScheduleMetaRow.
  const eventDate = event ? formatDateForInput(event.scheduledDate) : ''
  const eventTime = event ? formatTime12Hour(event.scheduledDate) : ''
  const eventDateLabel = event ? formatShowDate(event.scheduledDate) : ''
  const eventEndTime = event?.endTime ? formatTime12Hour(event.endTime) : ''

  const toggleOfferPart = (key: string) =>
    setOfferParts(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )

  const submitRequest = async () => {
    if (!title.trim() || !artist.trim()) return
    setSending(true)
    const res = await addRequest(title, artist, offerParts)
    setSending(false)
    if (res.ok) {
      showToast('Song requested', 'success')
      setTitle('')
      setArtist('')
      setOfferParts([])
    } else {
      showToast(res.error ?? 'Could not request song', 'error')
    }
  }

  const closeSongTray = () => {
    setAddSongOpen(false)
    setEditingItemId(null)
    setAddTitle('')
    setAddArtist('')
    setAddTuning('')
    setAddTuningId('')
    setAddKey('')
  }

  // Open the shared tray in "edit" mode, prefilled from the item (H).
  const openEditSong = (item: LineupItem) => {
    setEditingItemId(item.id)
    setAddTitle(item.displayTitle)
    setAddArtist(item.displayArtist)
    setAddTuning(item.tuning ?? '')
    setAddTuningId('')
    setAddKey(item.key ?? '')
    setAddSongOpen(true)
  }

  const submitAddSong = async () => {
    if (!addTitle.trim()) return
    setAddingSong(true)
    const res = editingItemId
      ? await updateLineupItem(editingItemId, {
          title: addTitle,
          artist: addArtist,
          tuning: addTuning || undefined,
          key: addKey || undefined,
        })
      : await addLineupItem({
          title: addTitle,
          artist: addArtist,
          tuning: addTuning || undefined,
          key: addKey || undefined,
        })
    setAddingSong(false)
    if (res.ok) {
      showToast(editingItemId ? 'Song updated' : 'Song added', 'success')
      closeSongTray()
    } else {
      showToast(
        res.error ??
          (editingItemId ? 'Could not update song' : 'Could not add song'),
        'error'
      )
    }
  }

  // Remove a lineup song (H) — cascades hands + casts. Behind a confirm.
  const removeSong = async (item: LineupItem) => {
    const ok = await confirm({
      title: 'Remove song',
      message: `Remove "${item.displayTitle}" from the lineup? Any casting and raised hands for it will be cleared.`,
      variant: 'danger',
      confirmLabel: 'Remove',
    })
    if (!ok) return
    const res = await removeLineupItem(item.id)
    showToast(
      res.ok ? 'Song removed' : (res.error ?? 'Could not remove song'),
      res.ok ? 'success' : 'error'
    )
  }

  // Manager-only per-card actions (Edit / Remove) for the lineup kebab (H).
  const managerActionsFor = (item: LineupItem): KebabMenuItem[] => [
    {
      label: 'Edit song',
      icon: Pencil,
      onClick: () => openEditSong(item),
      'data-testid': `lineup-edit-${item.id}`,
    },
    {
      label: 'Remove',
      icon: Trash2,
      variant: 'danger',
      dividerBefore: true,
      onClick: () => void removeSong(item),
      'data-testid': `lineup-remove-${item.id}`,
    },
  ]

  // Drag-to-reorder the lineup (G) — manager-only; persists position order.
  const handleLineupDragEnd = async (dragEvent: DragEndEvent) => {
    const { active, over } = dragEvent
    if (!over || active.id === over.id) return
    const oldIndex = lineup.findIndex(i => i.id === active.id)
    const newIndex = lineup.findIndex(i => i.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const orderedIds = arrayMove(lineup, oldIndex, newIndex).map(i => i.id)
    const res = await reorderLineup(orderedIds)
    if (!res.ok) showToast(res.error ?? 'Could not reorder lineup', 'error')
  }

  // Manager remove-a-participant (I) — blocked for the host by the service.
  const onRemoveParticipant = async (p: EventParticipant) => {
    const ok = await confirm({
      title: 'Remove from event',
      message: `Remove ${p.name} from this event? Their raised hands will be cleared.`,
      variant: 'danger',
      confirmLabel: 'Remove',
    })
    if (!ok) return
    const res = await removeParticipant(p.userId)
    showToast(
      res.ok ? `${p.name} removed` : (res.error ?? 'Could not remove'),
      res.ok ? 'success' : 'error'
    )
  }

  // Host promotes/demotes a co-host (EC4 #1). Host-only (service-enforced).
  const onSetTier = async (p: EventParticipant, tier: 'cohost' | 'guest') => {
    const res = await setParticipantTier(p.userId, tier)
    showToast(
      res.ok
        ? tier === 'cohost'
          ? `${p.name} is now a co-host`
          : `${p.name} is no longer a co-host`
        : (res.error ?? 'Could not update co-host'),
      res.ok ? 'success' : 'error'
    )
  }

  // Host cancels the event (K) — soft-cancel (status='cancelled'), behind a
  // confirm. Participants then see it as cancelled.
  const onCancelEvent = async () => {
    if (!event) return
    const ok = await confirm({
      title: 'Cancel event',
      message: `Cancel ${event.name}? Participants will see it as cancelled.`,
      variant: 'danger',
      confirmLabel: 'Cancel event',
    })
    if (!ok) return
    const res = await cancelEvent()
    showToast(
      res.ok ? 'Event cancelled' : (res.error ?? 'Could not cancel event'),
      res.ok ? 'success' : 'error'
    )
  }

  // ── Inline header edits (host-only) → EventService.updateEvent (K/6d) ──────
  const toastSave = (res: { ok: boolean; error?: string }) =>
    showToast(
      res.ok ? 'Saved' : (res.error ?? 'Could not update event'),
      res.ok ? 'success' : 'error'
    )

  const saveName = async (value: string) => {
    if (!value.trim()) return
    toastSave(await updateEvent({ name: value }))
  }

  const saveVenue = async (value: string) => {
    toastSave(await updateEvent({ venue: value || null }))
  }

  // Recombine date + time into scheduledDate (mirrors ShowViewPage.saveDateTime).
  const saveDateTime = async (dateStr: string, timeStr: string) => {
    const baseDate = parseDateInputAsLocal(dateStr)
    const scheduledDate = parseTime12Hour(timeStr, baseDate)
    toastSave(await updateEvent({ scheduledDate }))
  }

  const saveEndTime = async (timeStr: string) => {
    if (!event) return
    const baseDate = parseDateInputAsLocal(
      formatDateForInput(event.scheduledDate)
    )
    const end = timeStr ? parseTime12Hour(timeStr, baseDate) : null
    toastSave(await updateEvent({ endTime: end }))
  }

  // Current user leaves the event (I) — blocked for the host by the service.
  const onLeaveEvent = async () => {
    const ok = await confirm({
      title: 'Leave event',
      message:
        'Leave this event? You can re-join later with the code if it’s shared.',
      variant: 'danger',
      confirmLabel: 'Leave',
    })
    if (!ok) return
    const res = await leaveEvent()
    if (res.ok) {
      showToast('You left the event', 'success')
      navigate('/calendar?filter=events')
    } else {
      showToast(res.error ?? 'Could not leave event', 'error')
    }
  }

  // Approve a request; when the requester offered to play parts, the DB trigger
  // pre-raises their hands — surface that so the host knows a hand is now up.
  const onApprove = async (req: LineupRequest) => {
    const hadParts = (req.parts?.length ?? 0) > 0
    const name =
      participants.find(p => p.userId === req.requesterId)?.name || 'Guest'
    await approve(req.id)
    if (hadParts) showToast(`Added — ${name}'s hand is up`, 'success')
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
    ...(isHost ? [{ key: 'access' as EventTab, label: 'Access' }] : []),
  ]

  return (
    <div
      data-testid="event-detail-page"
      className={embedded ? '' : 'mx-auto max-w-6xl py-6'}
    >
      {!embedded && (
        <BackLink
          to="/calendar?filter=events"
          label="Events"
          className="mb-4"
          data-testid="event-back"
        />
      )}

      <ContentLoadingSpinner isLoading={loading}>
        {!event ? (
          <EmptyState icon={Music} title="Event not found" size="lg" />
        ) : (
          <div className="flex flex-col gap-6">
            {/* Header — activity icon · inline-editable (host) name ·
                date/time/venue. Guests see the same layout, read-only. A
                "Cancelled" badge shows only when the event is cancelled. */}
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-1 pb-5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <PartyPopper
                    size={20}
                    className="flex-shrink-0 text-accent"
                  />
                  <div className="min-w-0 flex-1">
                    {isHost ? (
                      <InlineEditableField
                        value={event.name}
                        onSave={val => saveName(String(val))}
                        type="title"
                        required
                        placeholder="Event name"
                        name="name"
                        data-testid="event-name"
                      />
                    ) : (
                      <h1
                        className="text-2xl font-bold text-ink-1"
                        data-testid="event-name"
                      >
                        {event.name}
                      </h1>
                    )}
                  </div>
                  {event.status === 'cancelled' && (
                    <Badge
                      tone="danger"
                      size="sm"
                      data-testid="event-cancelled-badge"
                    >
                      Cancelled
                    </Badge>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <ScheduleMetaRow
                    testId="event-detail"
                    date={eventDate}
                    dateLabel={eventDateLabel}
                    onDateSave={
                      isHost
                        ? val => saveDateTime(String(val), eventTime)
                        : undefined
                    }
                    time={eventTime}
                    timeLabel={eventTime}
                    onTimeSave={
                      isHost
                        ? val => saveDateTime(eventDate, String(val))
                        : undefined
                    }
                    endTime={eventEndTime || undefined}
                    endTimeLabel={eventEndTime || undefined}
                    onEndTimeSave={
                      isHost ? val => saveEndTime(String(val)) : undefined
                    }
                    venue={event.venue}
                    onVenueSave={
                      isHost ? val => saveVenue(String(val)) : undefined
                    }
                  />
                  <Badge
                    tone={isHost || isCohost ? 'accent' : 'info'}
                    size="sm"
                  >
                    {isHost ? 'Hosting' : isCohost ? 'Co-host' : 'Guest'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Tabs + host Invite (right) — keeps Invite out of the header
                where it collided with the title/metadata. */}
            <div
              className="flex items-end justify-between gap-2 border-b border-border-1"
              data-testid="event-tabs"
            >
              <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto scrollbar-none">
                {TABS.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    data-testid={`event-tab-${t.key}`}
                    aria-current={tab === t.key}
                    className={`-mb-px inline-flex flex-shrink-0 items-center gap-1 border-b-2 px-2.5 py-2 text-sm font-medium transition-colors sm:gap-1.5 sm:px-3 ${
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
              {isManager && eventId && (
                <div className="mb-1.5 flex-shrink-0">
                  <InviteFriendsSheet
                    eventId={eventId}
                    participantIds={new Set(participants.map(p => p.userId))}
                    onInvited={refetchParticipants}
                    position={isMobile ? 'bottom' : 'right'}
                  />
                </div>
              )}
            </div>

            {/* ── Lineup ─────────────────────────────────────────────── */}
            {tab === 'lineup' && (
              <div>
                {(lineup.length > 0 || isManager) && (
                  <div className="mb-3 flex items-center justify-between gap-2">
                    {lineup.length > 0 ? (
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
                    ) : (
                      <span />
                    )}
                    {isManager ? (
                      <button
                        onClick={() => {
                          setEditingItemId(null)
                          setAddTitle('')
                          setAddArtist('')
                          setAddTuning('')
                          setAddTuningId('')
                          setAddKey('')
                          setAddSongOpen(true)
                        }}
                        data-testid="event-add-song-button"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-accent-soft px-3 py-2 text-sm font-medium text-accent hover:brightness-110"
                      >
                        <Plus size={16} /> Add song
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                )}
                {lineup.length === 0 ? (
                  <p className="text-sm text-ink-5">
                    No songs in the lineup yet.
                  </p>
                ) : castView === 'grid' ? (
                  <EventCastGrid
                    eventId={event.id}
                    bandId={event.bandId}
                    lineup={lineup}
                    hands={hands}
                    isManager={isManager}
                    currentUserId={user?.id}
                    canRaiseHand={canRaiseHand}
                    onRaiseHand={(lineupItemId, roleKey) =>
                      void onRaiseHand(lineupItemId, roleKey)
                    }
                    onWithdrawHand={h => void withdrawHand(h)}
                    onResolveHand={resolveHand}
                    onReorder={reorderLineup}
                  />
                ) : (
                  // 2-column card grid (D2). Selecting a card expands the shared
                  // cast panel inline. Managers can drag to reorder (G) and get a
                  // per-card Edit/Remove kebab (H); guests see a static ordered list.
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    modifiers={[
                      restrictToVerticalAxis,
                      restrictToParentElement,
                    ]}
                    onDragEnd={dragEvent => void handleLineupDragEnd(dragEvent)}
                  >
                    <SortableContext
                      items={lineup.map(i => i.id)}
                      strategy={verticalListSortingStrategy}
                      disabled={!isManager || lineup.length <= 1}
                    >
                      <div
                        className="flex flex-col gap-3"
                        data-testid="event-lineup"
                      >
                        {lineup.map(item => (
                          <SortableLineupCard
                            key={item.id}
                            id={item.id}
                            enabled={isManager && lineup.length > 1}
                          >
                            {dragHandleListeners => (
                              <LineupCard
                                item={item}
                                defaultParts={defaultParts}
                                casting={casting}
                                hands={hands}
                                ownerName={
                                  participants.find(
                                    p => p.userId === item.ownerId
                                  )?.name
                                }
                                currentUserId={user?.id}
                                selected={castOpen === item.id}
                                onSelect={() =>
                                  setCastOpen(o =>
                                    o === item.id ? null : item.id
                                  )
                                }
                                dragHandleListeners={dragHandleListeners}
                                actions={
                                  isManager
                                    ? managerActionsFor(item)
                                    : undefined
                                }
                              >
                                <SongCastPanel
                                  embedded
                                  contextType="event"
                                  contextId={event.id}
                                  bandId={event.bandId}
                                  slotId={item.id}
                                  songId={item.songId}
                                  canEdit={isManager}
                                  hands={hands}
                                  currentUserId={user?.id}
                                  canRaiseHand={canRaiseHand}
                                  onRaiseHand={roleKey =>
                                    void onRaiseHand(item.id, roleKey)
                                  }
                                  onWithdrawHand={h => void withdrawHand(h)}
                                  onResolveHand={resolveHand}
                                />
                              </LineupCard>
                            )}
                          </SortableLineupCard>
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
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
                            {req.parts && req.parts.length > 0 && (
                              <span
                                className="mt-0.5 block truncate text-xs font-medium text-info"
                                data-testid={`event-request-offer-${req.id}`}
                              >
                                Offers to play{' '}
                                {req.parts
                                  .map(p => PART_LABEL[p] ?? p)
                                  .join(', ')}
                              </span>
                            )}
                          </span>
                          <Badge tone="warn" size="sm">
                            pending
                          </Badge>
                          {isManager && (
                            <>
                              <button
                                onClick={() => void onApprove(req)}
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
                      <div data-testid="event-request-offer-parts">
                        <span className="mb-2 block text-sm font-medium text-ink-3">
                          I'd play (optional)
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {OFFER_PARTS.map(part => {
                            const on = offerParts.includes(part.key)
                            return (
                              <button
                                key={part.key}
                                type="button"
                                onClick={() => toggleOfferPart(part.key)}
                                data-testid={`event-offer-part-${part.key}`}
                                aria-pressed={on}
                                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                                  on
                                    ? 'border-info bg-info-soft text-info'
                                    : 'border-border-2 text-ink-4 hover:border-info hover:text-info'
                                }`}
                              >
                                {part.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
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
                      const targetIsHost = p.userId === event.hostUserId
                      const isMe = p.userId === user?.id
                      const personActions: KebabMenuItem[] = []
                      // Host promotes/demotes co-hosts (never the host / self).
                      if (isHost && !targetIsHost && !isMe) {
                        personActions.push(
                          p.accessTier === 'cohost'
                            ? {
                                label: 'Remove co-host',
                                icon: ShieldOff,
                                onClick: () => void onSetTier(p, 'guest'),
                                'data-testid': `event-person-demote-${p.userId}`,
                              }
                            : {
                                label: 'Make co-host',
                                icon: ShieldCheck,
                                onClick: () => void onSetTier(p, 'cohost'),
                                'data-testid': `event-person-promote-${p.userId}`,
                              }
                        )
                      }
                      // Manager can remove any non-host; the current user can
                      // leave (their own non-host row). Host is never removable.
                      if (isManager && !targetIsHost && !isMe) {
                        personActions.push({
                          label: 'Remove from event',
                          icon: Trash2,
                          variant: 'danger',
                          onClick: () => void onRemoveParticipant(p),
                          'data-testid': `event-person-remove-${p.userId}`,
                        })
                      }
                      if (isMe && !targetIsHost) {
                        personActions.push({
                          label: 'Leave event',
                          icon: LogOut,
                          variant: 'danger',
                          onClick: () => void onLeaveEvent(),
                          'data-testid': `event-person-leave-${p.userId}`,
                        })
                      }
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
                            {p.accessTier === 'cohost'
                              ? 'Co-host'
                              : p.accessTier.charAt(0).toUpperCase() +
                                p.accessTier.slice(1)}
                          </Badge>
                          <span className="text-xs capitalize text-ink-4">
                            {p.rsvp}
                          </span>
                          {personActions.length > 0 && (
                            <KebabMenu
                              items={personActions}
                              triggerSize="sm"
                              align="right"
                              data-testid={`event-person-actions-${p.userId}`}
                            />
                          )}
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

                {/* Danger zone — soft-cancel the event (host only). Hidden once
                    the event is already cancelled. */}
                {event.status !== 'cancelled' && (
                  <div>
                    <Eyebrow className="mb-2">Danger zone</Eyebrow>
                    <button
                      onClick={() => void onCancelEvent()}
                      data-testid="event-cancel-button"
                      className="flex w-full items-center gap-3 rounded-xl border border-danger/40 bg-danger/5 p-3 text-left transition-colors hover:border-danger"
                    >
                      <X size={18} className="flex-shrink-0 text-danger" />
                      <span className="flex-1">
                        <span className="block text-sm font-semibold text-danger">
                          Cancel event
                        </span>
                        <span className="block text-xs text-ink-4">
                          Participants will see it as cancelled. This can’t be
                          undone here.
                        </span>
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Add-song sheet (host): drop a song straight into the lineup. */}
            {isManager && (
              <SlideOutTray
                isOpen={addSongOpen}
                onClose={closeSongTray}
                title={editingItemId ? 'Edit song' : 'Add a song'}
                position={isMobile ? 'bottom' : 'right'}
                data-testid="event-add-song-sheet"
              >
                <div className="flex flex-col gap-3 px-6 py-4">
                  <div>
                    <label
                      htmlFor="event-add-song-title"
                      className="mb-1 block text-xs text-ink-4"
                    >
                      Song title
                    </label>
                    <input
                      value={addTitle}
                      onChange={e => setAddTitle(e.target.value)}
                      placeholder="Song title"
                      name="addSongTitle"
                      id="event-add-song-title"
                      data-testid="event-add-song-title"
                      className="w-full rounded-lg bg-bg-3 border border-border-1 px-3 py-2 text-sm text-ink-1 placeholder:text-ink-5 focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="event-add-song-artist"
                      className="mb-1 block text-xs text-ink-4"
                    >
                      Artist
                    </label>
                    <input
                      value={addArtist}
                      onChange={e => setAddArtist(e.target.value)}
                      placeholder="Artist"
                      name="addSongArtist"
                      id="event-add-song-artist"
                      data-testid="event-add-song-artist"
                      className="w-full rounded-lg bg-bg-3 border border-border-1 px-3 py-2 text-sm text-ink-1 placeholder:text-ink-5 focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Per-song tuning override (reuses the song editor picker). */}
                    <div>
                      <label
                        htmlFor="event-add-song-tuning"
                        className="mb-1 block text-xs text-ink-4"
                      >
                        Tuning
                      </label>
                      <div data-testid="event-add-song-tuning-select">
                        <Dropdown
                          data-testid="event-add-song-tuning"
                          value={addTuningId}
                          onChange={handleAddTuningChange}
                          groups={tuningGroups}
                          placeholder="Optional"
                          renderTriggerLabel={opt => {
                            const color = opt
                              ? opt.color
                              : addTuning
                                ? tuningColor(addTuning)
                                : undefined
                            const label = opt
                              ? opt.label
                              : addTuning
                                ? tuningLabel(addTuning)
                                : null
                            if (!label)
                              return (
                                <span className="truncate text-ink-5">
                                  Optional
                                </span>
                              )
                            return (
                              <>
                                {color && (
                                  <span
                                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                                    style={{ backgroundColor: color }}
                                  />
                                )}
                                <span className="truncate">{label}</span>
                              </>
                            )
                          }}
                        />
                      </div>
                    </div>
                    {/* Per-song key override (reuses the Circle of Fifths). */}
                    <div>
                      <label className="mb-1 block text-xs text-ink-4">
                        Key
                      </label>
                      <button
                        type="button"
                        id="event-add-song-key"
                        name="addSongKey"
                        data-testid="event-add-song-key"
                        onClick={() => setShowKeyPicker(true)}
                        className="flex h-[38px] w-full items-center justify-between rounded-lg border border-border-1 bg-bg-3 px-3 text-sm text-ink-1 transition-colors hover:border-accent"
                      >
                        <span className={addKey ? 'font-medium' : 'text-ink-5'}>
                          {addKey || 'Optional'}
                        </span>
                        <Music size={16} className="flex-shrink-0 text-ink-4" />
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={submitAddSong}
                    disabled={addingSong || !addTitle.trim()}
                    data-testid="event-add-song-submit"
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {editingItemId ? (
                      <>
                        <Check size={16} /> Save changes
                      </>
                    ) : (
                      <>
                        <Plus size={16} /> Add to lineup
                      </>
                    )}
                  </button>
                </div>
              </SlideOutTray>
            )}

            {/* Key picker (Circle of Fifths) for the add/edit tray — sits above
                the slide-out tray (z-50). */}
            {isManager && showKeyPicker && (
              <div
                className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
                onClick={() => setShowKeyPicker(false)}
                data-testid="event-add-song-key-picker"
              >
                <div
                  className="max-h-[90vh] w-full max-w-[min(90vw,500px)] overflow-y-auto custom-scrollbar-thin rounded-2xl border border-border-1 bg-bg-2 p-4 sm:p-6"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-white sm:text-lg">
                      Select Key
                    </h3>
                    <button
                      onClick={() => setShowKeyPicker(false)}
                      aria-label="Close"
                      className="p-1 text-ink-4 transition-colors hover:text-white"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <CircleOfFifths
                    selectedKey={addKey}
                    onKeySelect={key => {
                      setAddKey(key)
                      setShowKeyPicker(false)
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </ContentLoadingSpinner>

      {/* Shared confirm for remove-song / remove-participant / leave-event. */}
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}

export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>()
  return <EventDetailContent eventId={eventId} />
}

/**
 * Sortable wrapper for a lineup card (G). Holds the dnd-kit node ref + transform
 * on the outer element and passes drag listeners to its child render prop so
 * only the grip handle initiates a drag (clicks on the card/kebab still fire).
 * When `enabled` is false (guests) the card is inert and receives no listeners.
 */
function SortableLineupCard({
  id,
  enabled,
  children,
}: {
  id: string
  enabled: boolean
  children: (listeners: DragHandleListeners | undefined) => ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !enabled })
  const style: CSSProperties = {
    // Vertical-only reorder: zero the X so a card can't be dragged sideways.
    transform: CSS.Transform.toString(
      transform ? { ...transform, x: 0 } : null
    ),
    transition,
    opacity: isDragging ? 0.6 : undefined,
    zIndex: isDragging ? 20 : undefined,
  }
  return (
    <div ref={setNodeRef} style={style} {...(enabled ? attributes : {})}>
      {children(
        enabled
          ? (listeners as unknown as DragHandleListeners | undefined)
          : undefined
      )}
    </div>
  )
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
