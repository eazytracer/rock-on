import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  Sparkles,
  Activity,
  PartyPopper,
  UserPlus,
  Users,
  X,
  CheckCheck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useNotifications } from '../hooks/useNotifications'
import { useAuth } from '../contexts/AuthContext'
import type { AppNotification, NotificationKind } from '../models/Notification'
import { EmptyState } from '../components/common/EmptyState'
import { Eyebrow } from '../components/common/Eyebrow'
import { ContentLoadingSpinner } from '../components/common/ContentLoadingSpinner'
import { BackLink } from '../components/common/BackLink'
import { MarkdownRenderer } from '../components/notes/MarkdownRenderer'

type NotifTab = 'all' | 'updates' | 'activity'

const isActivityKind = (k: NotificationKind): boolean =>
  k === 'activity' || k === 'event' || k === 'friend'

const KIND_ICON: Record<NotificationKind, LucideIcon> = {
  release: Sparkles,
  activity: Activity,
  event: PartyPopper,
  friend: UserPlus,
}

/** Compact relative time ("just now" / "5m ago" / "3h ago" / "2d ago"). */
function relativeTime(date: Date): string {
  const s = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d === 1 ? 'yesterday' : `${d}d ago`
}

/**
 * Notifications center (mobile-redesign-port P10).
 * Real feed backed by NotificationService — typed items + latest release note.
 */
/**
 * Cross-context provenance (#10, simple version): if a notification carries a
 * band it belongs to (payload.bandId) AND that band is NOT the one currently in
 * context, surface a "from ‹Band›" label so the user knows where it came from
 * (they can switch context manually — we deliberately do NOT auto-switch).
 * Defensive: notifications with no band payload show nothing.
 */
function otherBandLabel(
  n: AppNotification,
  currentBandId: string | null
): string {
  const payload = n.payload as { bandId?: unknown; bandName?: unknown }
  const bandId = typeof payload?.bandId === 'string' ? payload.bandId : ''
  const bandName = typeof payload?.bandName === 'string' ? payload.bandName : ''
  if (!bandId || bandId === currentBandId) return ''
  return bandName.trim()
}

export function NotificationsPage() {
  const navigate = useNavigate()
  const { currentBandId } = useAuth()
  const {
    notifications,
    releaseNotes,
    loading,
    unreadCount,
    markRead,
    markAllRead,
    dismiss,
  } = useNotifications()

  const latestRelease = releaseNotes[0]
  const [tab, setTab] = useState<NotifTab>('all')

  const tabs: { id: NotifTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'updates', label: 'Updates' },
    { id: 'activity', label: 'Activity' },
  ]

  const filtered = notifications.filter(n =>
    tab === 'all'
      ? true
      : tab === 'updates'
        ? n.kind === 'release'
        : isActivityKind(n.kind)
  )

  // Group by recency: last 24h = Recent, older = Earlier (design NotificationCenter).
  const DAY_MS = 86400000
  const now = Date.now()
  const recent = filtered.filter(n => now - n.createdDate.getTime() < DAY_MS)
  const earlier = filtered.filter(n => now - n.createdDate.getTime() >= DAY_MS)
  const showWhatsNew = latestRelease && tab !== 'activity'

  const openItem = (n: AppNotification) => {
    if (!n.readAt) void markRead(n.id)
    if (n.link) navigate(n.link)
  }

  const Row = ({ n }: { n: AppNotification }) => {
    const Icon = KIND_ICON[n.kind]
    const unread = !n.readAt
    const fromBand = otherBandLabel(n, currentBandId)
    return (
      <div
        className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
          unread ? 'bg-bg-1 border-border-2' : 'bg-bg-1 border-border-1'
        }`}
        data-testid={`notification-${n.id}`}
      >
        <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-bg-3 text-ink-2">
          <Icon size={16} />
        </span>
        <button
          onClick={() => openItem(n)}
          className="flex-1 min-w-0 text-left"
          data-testid={`notification-open-${n.id}`}
        >
          <span className="flex items-center gap-2">
            <span className="truncate font-medium text-ink-1">{n.title}</span>
            {unread && (
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
            )}
          </span>
          {n.body && (
            <span className="mt-0.5 block text-xs text-ink-3">{n.body}</span>
          )}
          {fromBand && (
            <span
              data-testid={`notification-band-${n.id}`}
              className="mt-1 inline-flex items-center gap-1 rounded-md bg-bg-3 px-1.5 py-0.5 text-[10px] font-medium text-ink-3"
            >
              <Users size={10} /> from {fromBand}
            </span>
          )}
          <span className="mt-1 block font-mono text-[10px] text-ink-5">
            {relativeTime(n.createdDate)}
          </span>
        </button>
        <button
          onClick={() => dismiss(n.id)}
          aria-label="Dismiss"
          data-testid={`notification-dismiss-${n.id}`}
          className="flex-shrink-0 rounded-md p-1 text-ink-5 hover:text-ink-2 hover:bg-bg-3"
        >
          <X size={15} />
        </button>
      </div>
    )
  }

  return (
    <div data-testid="notifications-page" className="max-w-3xl">
      <BackLink className="mb-4" data-testid="notifications-back" />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-1">Notifications</h1>
        {unreadCount > 0 && (
          <button
            onClick={() => void markAllRead()}
            data-testid="notifications-mark-all"
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-3 hover:text-ink-1 hover:bg-bg-2"
          >
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </div>

      {/* Segmented filter */}
      <div className="mt-4 inline-flex rounded-lg border border-border-1 bg-bg-1 p-0.5">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            data-testid={`notifications-tab-${t.id}`}
            aria-pressed={tab === t.id}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t.id
                ? 'bg-accent-soft text-accent'
                : 'text-ink-4 hover:text-ink-2'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ContentLoadingSpinner isLoading={loading}>
        <div className="mt-4 flex flex-col gap-4">
          {showWhatsNew && (
            <div
              className="rounded-2xl border border-accent-line bg-accent-soft p-4"
              data-testid="notifications-whats-new"
            >
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-accent" />
                <span className="font-semibold text-ink-1">What's new</span>
                <span className="ml-auto font-mono text-[10px] text-ink-4">
                  v{latestRelease.version}
                </span>
              </div>
              <div className="mt-2 text-sm text-ink-2">
                <MarkdownRenderer content={latestRelease.body} />
              </div>
            </div>
          )}

          {filtered.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="You're all caught up"
              description="Band activity, event invites and friend requests will appear here."
              size="lg"
            />
          ) : (
            <div
              className="flex flex-col gap-4"
              data-testid="notifications-feed"
            >
              {recent.length > 0 && (
                <div>
                  <Eyebrow className="mb-2">Recent</Eyebrow>
                  <div className="flex flex-col gap-2">
                    {recent.map(n => (
                      <Row key={n.id} n={n} />
                    ))}
                  </div>
                </div>
              )}
              {earlier.length > 0 && (
                <div>
                  <Eyebrow className="mb-2">Earlier</Eyebrow>
                  <div className="flex flex-col gap-2">
                    {earlier.map(n => (
                      <Row key={n.id} n={n} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </ContentLoadingSpinner>
    </div>
  )
}
