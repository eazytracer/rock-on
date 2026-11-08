import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import {
  useMarkAllRead,
  useNotificationFeed,
  useReleaseNotes,
} from '../hooks/useNotifications'
import { NotificationRow } from '../components/notifications/NotificationRow'
import { MarkdownRenderer } from '../components/notes/MarkdownRenderer'
import { PageTitle, Segmented, SkeletonRow, RetryCard } from '../components/ui'
import { formatShowDate } from '../utils/dateHelpers'

type Tab = 'activity' | 'updates'

/**
 * Notifications (Core Navigation 10–11): a stream. Activity = what bandmates
 * changed (never your own), plus friend and event notices; App updates = the
 * release notes. Opening the page reads everything, so the bell's dot clears;
 * what was new stays marked until you leave.
 */
export function NotificationsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('activity')
  const feed = useNotificationFeed()
  const releases = useReleaseNotes()
  const markAll = useMarkAllRead()

  // Snapshot what was unread on arrival, then mark everything read.
  const [newIds, setNewIds] = useState<Set<string> | null>(null)
  const marked = useRef(false)
  useEffect(() => {
    if (!feed.data || marked.current) return
    marked.current = true
    const unread = feed.data.filter(n => !n.is_read).map(n => n.id)
    setNewIds(new Set(unread))
    if (unread.length > 0) markAll.mutate()
  }, [feed.data, markAll])

  const items = (feed.data ?? []).map(n => ({
    ...n,
    is_read: newIds ? !newIds.has(n.id) : n.is_read,
  }))
  const fresh = items.filter(n => !n.is_read)
  const earlier = items.filter(n => n.is_read)
  const latest = releases.data?.[0]

  const section = (label: string) => (
    <p className="px-4 pt-4 pb-1.5 font-mono text-[10.5px] tracking-[.12em] uppercase text-ink-3">
      {label}
    </p>
  )

  return (
    <div className="max-w-2xl" data-testid="notifications-page">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 h-9 pl-2 pr-3 rounded-full bg-bg-3 text-sm font-semibold text-ink-2 hover:text-ink-1"
          data-testid="notifications-back"
        >
          <ChevronLeft size={16} /> Home
        </button>
      </div>
      <PageTitle title="Notifications" />

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'activity', label: 'Activity' },
          { value: 'updates', label: 'App updates' },
        ]}
        label="Notifications"
        data-testid="notifications-tabs"
      />

      {tab === 'activity' ? (
        <div className="mt-3">
          {feed.isError ? (
            <RetryCard
              message="Couldn't load notifications."
              onRetry={() => void feed.refetch()}
            />
          ) : feed.isLoading ? (
            <div className="rounded-[20px] bg-bg-2 shadow-group">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : items.length === 0 ? (
            <p
              className="px-1 py-6 text-[15px] text-ink-3"
              data-testid="notifications-empty"
            >
              Nothing yet. When bandmates add or change songs, setlists, shows
              or practices, it shows up here.
            </p>
          ) : (
            <>
              {fresh.length > 0 && section('New')}
              {fresh.length > 0 && (
                <div className="rounded-[20px] bg-bg-2 shadow-group overflow-hidden">
                  {fresh.map(n => (
                    <NotificationRow key={n.id} n={n} />
                  ))}
                </div>
              )}
              {earlier.length > 0 && section('Earlier')}
              {earlier.length > 0 && (
                <div className="rounded-[20px] bg-bg-2 shadow-group overflow-hidden">
                  {earlier.map(n => (
                    <NotificationRow key={n.id} n={n} />
                  ))}
                </div>
              )}
            </>
          )}

          {latest && (
            <button
              onClick={() => setTab('updates')}
              className="mt-4 w-full rounded-[20px] bg-bg-2 shadow-group p-4 text-left"
              data-testid="notifications-whats-new"
            >
              <p className="font-mono text-[10.5px] tracking-[.12em] uppercase text-accent-ink">
                What's new · {latest.version}
              </p>
              <p className="mt-1 text-[16px] font-bold text-ink-1">
                {latest.title}
              </p>
              <p className="mt-1 text-[13.5px] font-semibold text-accent-ink">
                Release notes →
              </p>
            </button>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-3" data-testid="notifications-updates">
          {releases.isLoading ? (
            <div className="rounded-[20px] bg-bg-2">
              <SkeletonRow lines={3} />
            </div>
          ) : (
            (releases.data ?? []).map(r => (
              <article
                key={r.version}
                className="rounded-[20px] bg-bg-2 shadow-group p-4"
                data-testid={`release-${r.version}`}
              >
                <p className="font-mono text-[10.5px] tracking-[.12em] uppercase text-ink-3">
                  {r.version} · {formatShowDate(new Date(r.publishedAt))}
                </p>
                <h2 className="mt-1 text-[17px] font-bold text-ink-1">
                  {r.title}
                </h2>
                <div className="mt-2 text-[14.5px] text-ink-2">
                  <MarkdownRenderer content={r.body} />
                </div>
              </article>
            ))
          )}
        </div>
      )}
    </div>
  )
}
