import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  Clock,
  Home as HomeIcon,
  ListMusic,
  Music2,
  Plus,
  Ticket,
  ChevronRight,
  Check,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useUpcomingShows } from '../hooks/useShows'
import { useUpcomingPractices } from '../hooks/usePractices'
import { useEvents } from '../hooks/useEvents'
import { useSongs, usePersonalSongs } from '../hooks/useSongs'
import { useSetlists, usePersonalSetlists } from '../hooks/useSetlists'
import { useBandMembers } from '../hooks/useBands'
import { useNotificationFeed } from '../hooks/useNotifications'
import {
  formatCountdown,
  formatShowDate,
  formatTime12Hour,
} from '../utils/dateHelpers'
import { setlistStats } from '../domain/setlist'
import { Button, PageTitle, TypeLabel, SkeletonRow } from '../components/ui'
import type { EventType } from '../components/ui'
import { NotificationRow } from '../components/notifications/NotificationRow'
import type { Show } from '../models/Show'
import type { PracticeSession } from '../models/PracticeSession'

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}
function writeFlag(key: string) {
  try {
    localStorage.setItem(key, '1')
  } catch {
    // storage unavailable: the card comes back next visit
  }
}

const label =
  'font-mono text-[10.5px] tracking-[.12em] uppercase text-ink-3 font-medium'

const Section: React.FC<{
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}> = ({ title, action, children }) => (
  <section className="min-w-0">
    <div className="flex items-center justify-between px-1 pb-2">
      <h2 className={label}>{title}</h2>
      {action}
    </div>
    {children}
  </section>
)

const Meta: React.FC<{ icon: LucideIcon; children: React.ReactNode }> = ({
  icon: Icon,
  children,
}) => (
  <p className="flex items-center gap-2 text-[14px] text-ink-2 min-w-0">
    <Icon size={15} className="text-ink-3 shrink-0" />
    <span className="truncate">{children}</span>
  </p>
)

/**
 * Home (Core Navigation 1–3; desktop Home). Answers "what's next": the next
 * show and practice as big cards with countdowns, what's coming up, and quick
 * actions. New bands and Personal get a self-ticking walkthrough. No stats.
 */
export function HomePage() {
  const navigate = useNavigate()
  const { currentBandId, currentBand, currentUser } = useAuth()
  const userId = currentUser?.id ?? ''
  const bandId = currentBandId ?? ''
  const hasBand = !!currentBandId

  const { upcomingShows, loading: showsLoading } = useUpcomingShows(bandId)
  const { upcomingPractices, loading: practicesLoading } =
    useUpcomingPractices(bandId)
  const { songs: bandSongs } = useSongs(bandId)
  const { songs: personalSongs } = usePersonalSongs(hasBand ? '' : userId)
  const { setlists: bandSetlists } = useSetlists(bandId)
  const { setlists: personalSetlists } = usePersonalSetlists(
    hasBand ? '' : userId
  )
  const { members } = useBandMembers(bandId)
  const { events } = useEvents()
  const feed = useNotificationFeed()

  const songs = hasBand ? bandSongs : personalSongs
  const setlists = hasBand ? bandSetlists : personalSetlists
  const loading = hasBand && (showsLoading || practicesLoading)
  const nextShow = upcomingShows[0]
  const nextPractice = upcomingPractices[0]
  const songById = useMemo(() => new Map(songs.map(s => [s.id, s])), [songs])

  const upcoming = useMemo(() => {
    const now = Date.now()
    const rows: {
      key: string
      type: EventType
      title: string
      when: Date
      where?: string
      path: string
    }[] = [
      ...upcomingShows.map(s => ({
        key: `show-${s.id}`,
        type: 'show' as const,
        title: s.name,
        when: s.scheduledDate,
        where: s.venue,
        path: `/shows/${s.id}`,
      })),
      ...upcomingPractices.map(p => ({
        key: `practice-${p.id}`,
        type: 'practice' as const,
        title: practiceTitle(p),
        when: p.startTime ?? p.scheduledDate,
        where: p.location,
        path: `/practices/${p.id}`,
      })),
      ...events
        .filter(
          e =>
            e.status !== 'cancelled' &&
            e.scheduledDate.getTime() >= now &&
            (hasBand ? e.bandId === bandId || !e.bandId : true)
        )
        .map(e => ({
          key: `jam-${e.id}`,
          type: 'jam' as const,
          title: e.name,
          when: e.scheduledDate,
          where: e.venue,
          path: `/events/${e.id}`,
        })),
    ]
    return rows.sort((a, b) => a.when.getTime() - b.when.getTime()).slice(0, 4)
  }, [upcomingShows, upcomingPractices, events, hasBand, bandId])

  // Walkthroughs tick themselves off from real data.
  const walkKey = `rockon.walkthrough.${hasBand ? bandId : 'personal'}`
  const [walkDismissed, setWalkDismissed] = useState(() => readFlag(walkKey))
  const steps = hasBand
    ? [
        { label: 'Create the band', done: true },
        {
          label: 'Invite your bandmates',
          done: members.length > 1,
          to: '/band-members',
        },
        {
          label: 'Add 5 songs',
          done: songs.length >= 5,
          to: '/songs?add=song',
        },
        {
          label: 'Build a setlist',
          done: setlists.length > 0,
          to: '/setlists/new',
        },
        {
          label: 'Schedule a practice',
          done: upcomingPractices.length > 0,
          to: '/practices/new',
        },
      ]
    : [
        {
          label: 'Add your first song',
          done: songs.length > 0,
          to: '/songs?add=song',
        },
        {
          label: 'Add 5 songs',
          done: songs.length >= 5,
          to: '/songs?add=song',
        },
        {
          label: 'Build a setlist',
          done: setlists.length > 0,
          to: '/setlists/new',
        },
      ]
  const doneCount = steps.filter(s => s.done).length
  // Bands get it while they're new (a month); Personal until it's done.
  const isNewBand =
    !!currentBand &&
    Date.now() - currentBand.createdDate.getTime() < 30 * 86_400_000
  const showWalkthrough =
    !walkDismissed &&
    doneCount < steps.length &&
    !loading &&
    (!hasBand || isNewBand)
  const [bandCardDismissed, setBandCardDismissed] = useState(() =>
    readFlag('rockon.playingWithOthersDismissed')
  )

  const contextName = hasBand ? (currentBand?.name ?? '') : 'Personal'

  return (
    <div data-testid="home-page" className="max-w-[1100px]">
      <PageTitle
        title="Home"
        eyebrow={contextName}
        actions={
          <span className="hidden md:block">
            <Button
              icon={<Plus size={18} />}
              onClick={() => navigate('/songs?add=song')}
              data-testid="home-add-song"
            >
              Add song
            </Button>
          </span>
        }
      />

      <div className="flex flex-col gap-5">
        {showWalkthrough && (
          <Walkthrough
            title={
              hasBand ? `Get ${contextName} ready` : 'Get your songs ready'
            }
            steps={steps}
            doneCount={doneCount}
            onDismiss={() => {
              writeFlag(walkKey)
              setWalkDismissed(true)
            }}
            onGo={to => navigate(to)}
          />
        )}

        {hasBand && (
          <div className="grid gap-3 md:grid-cols-2">
            {loading ? (
              <>
                <CardShell>
                  <SkeletonRow lines={3} />
                </CardShell>
                <CardShell>
                  <SkeletonRow lines={3} />
                </CardShell>
              </>
            ) : (
              <>
                {nextShow ? (
                  <ShowCard
                    show={nextShow}
                    setlistLine={(() => {
                      const sl = setlists.find(s => s.id === nextShow.setlistId)
                      if (!sl) return undefined
                      const { songCount, seconds } = setlistStats(
                        sl.items ?? [],
                        id => songById.get(id)?.duration
                      )
                      const mins = Math.round(seconds / 60)
                      return [
                        sl.name,
                        `${songCount} song${songCount === 1 ? '' : 's'}`,
                        mins ? `${mins} min` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    })()}
                    onOpen={() => navigate(`/shows/${nextShow.id}`)}
                  />
                ) : (
                  <EmptyCard
                    icon={Ticket}
                    title="No show booked"
                    sub="Add the next gig and its set."
                    action="Book"
                    onAction={() => navigate('/shows/new')}
                    testId="home-empty-show"
                  />
                )}
                {nextPractice ? (
                  <PracticeCard
                    practice={nextPractice}
                    songTitles={nextPractice.songs
                      .map(s => songById.get(s.songId)?.title)
                      .filter((t): t is string => !!t)}
                    onOpen={() => navigate(`/practices/${nextPractice.id}`)}
                  />
                ) : (
                  <EmptyCard
                    icon={CalendarDays}
                    title="No practice scheduled"
                    sub="Pick a time and what to run."
                    action="Schedule"
                    onAction={() => navigate('/practices/new')}
                    testId="home-empty-practice"
                  />
                )}
              </>
            )}
          </div>
        )}

        {!hasBand && !bandCardDismissed && (
          <div
            className="relative rounded-[20px] bg-bg-2 shadow-group p-5"
            data-testid="home-create-band"
          >
            <button
              onClick={() => {
                writeFlag('rockon.playingWithOthersDismissed')
                setBandCardDismissed(true)
              }}
              aria-label="Dismiss"
              data-testid="home-create-band-dismiss"
              className="absolute right-3 top-3 w-8 h-8 grid place-items-center text-ink-3"
            >
              <X size={16} />
            </button>
            <p className={label}>Playing with others?</p>
            <h3 className="mt-1.5 font-display font-extrabold uppercase text-[30px] leading-[.95] text-ink-1">
              Create or join a band
            </h3>
            <p className="mt-2 text-[14.5px] text-ink-2 max-w-md">
              Share songs, setlists and a calendar with your bandmates. Your
              personal songs stay yours.
            </p>
            <Button
              variant="primary"
              className="mt-4"
              onClick={() => navigate('/get-started')}
              data-testid="home-create-band-button"
            >
              Get started
            </Button>
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-5 min-w-0">
            {upcoming.length > 0 && (
              <Section
                title="Upcoming"
                action={
                  <button
                    onClick={() => navigate('/calendar')}
                    className="font-mono text-[10.5px] tracking-[.12em] uppercase text-accent-ink"
                    data-testid="home-upcoming-all"
                  >
                    View all
                  </button>
                }
              >
                <div className="rounded-[20px] bg-bg-2 shadow-group overflow-hidden">
                  {upcoming.map(u => (
                    <button
                      key={u.key}
                      onClick={() => navigate(u.path)}
                      data-testid={`home-upcoming-${u.key}`}
                      className="w-full flex items-center gap-3.5 px-4 py-2.5 text-left border-b border-divider last:border-0 hover:bg-bg-3/60"
                    >
                      <span className="w-9 shrink-0 text-center leading-none">
                        <span className="block font-mono text-[10px] uppercase text-ink-3">
                          {u.when.toLocaleDateString(undefined, {
                            month: 'short',
                          })}
                        </span>
                        <span className="block font-display font-extrabold text-[26px] text-ink-1">
                          {u.when.getDate()}
                        </span>
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-[15px] font-bold text-ink-1">
                          {u.title}
                        </span>
                        <span className="block truncate text-[12.5px] text-ink-3">
                          {[formatTime12Hour(u.when), u.where]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                      <TypeLabel type={u.type} />
                      <ChevronRight size={16} className="text-ink-4" />
                    </button>
                  ))}
                </div>
              </Section>
            )}

            <Section title="Quick actions">
              <div className="grid grid-cols-2 gap-2.5">
                {(hasBand
                  ? [
                      ['Add song', Plus, '/songs?add=song', 'home-action-song'],
                      [
                        'New setlist',
                        ListMusic,
                        '/setlists/new',
                        'home-action-setlist',
                      ],
                      [
                        'Schedule practice',
                        CalendarDays,
                        '/practices/new',
                        'home-action-practice',
                      ],
                      ['Book show', Ticket, '/shows/new', 'home-action-show'],
                    ]
                  : [
                      ['Add song', Plus, '/songs?add=song', 'home-action-song'],
                      [
                        'New setlist',
                        ListMusic,
                        '/setlists/new',
                        'home-action-setlist',
                      ],
                    ]
                ).map(([text, Icon, to, testId]) => {
                  const I = Icon as LucideIcon
                  return (
                    <button
                      key={testId as string}
                      onClick={() => navigate(to as string)}
                      data-testid={testId as string}
                      className="flex items-center gap-3 h-[60px] px-3.5 rounded-[18px] bg-bg-2 shadow-group text-left text-[14.5px] font-bold text-ink-1 hover:bg-bg-3"
                    >
                      <span className="grid place-items-center w-9 h-9 rounded-xl bg-accent-soft text-accent-ink shrink-0">
                        <I size={18} />
                      </span>
                      <span className="leading-tight">{text as string}</span>
                    </button>
                  )
                })}
              </div>
            </Section>
          </div>

          {hasBand && (feed.data?.length ?? 0) > 0 && (
            <div className="hidden md:block min-w-0">
              <Section title="Activity">
                <div className="rounded-[20px] bg-bg-2 shadow-group overflow-hidden">
                  {feed.data!.slice(0, 4).map(n => (
                    <NotificationRow key={n.id} n={n} compact />
                  ))}
                </div>
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function practiceTitle(p: PracticeSession): string {
  const when = p.startTime ?? p.scheduledDate
  return `${when.toLocaleDateString(undefined, { weekday: 'long' })} practice`
}

const CardShell: React.FC<{
  children: React.ReactNode
  onClick?: () => void
  testId?: string
}> = ({ children, onClick, testId }) => (
  <div
    onClick={onClick}
    data-testid={testId}
    className={`rounded-[20px] bg-bg-2 shadow-group p-[18px] min-w-0 ${onClick ? 'cursor-pointer hover:bg-bg-3/70 transition-colors' : ''}`}
  >
    {children}
  </div>
)

const ShowCard: React.FC<{
  show: Show
  setlistLine?: string
  onOpen: () => void
}> = ({ show, setlistLine, onOpen }) => (
  <CardShell onClick={onOpen} testId="home-next-show">
    <div className="flex items-center justify-between gap-2">
      <p className={label}>
        Next show
        {show.status === 'confirmed' && (
          <span className="ml-2 text-success">● Confirmed</span>
        )}
      </p>
      <p className="font-mono text-[10.5px] tracking-[.12em] uppercase text-accent-ink">
        {formatCountdown(show.scheduledDate)}
      </p>
    </div>
    <h3 className="mt-1.5 font-display font-extrabold uppercase text-[34px] leading-[.95] text-ink-1 truncate">
      {show.name}
    </h3>
    <div className="mt-2.5 space-y-1">
      <Meta icon={CalendarDays}>
        {[
          formatShowDate(show.scheduledDate),
          formatTime12Hour(show.scheduledDate),
          show.loadInTime ? `load-in ${show.loadInTime}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Meta>
      {show.venue && <Meta icon={HomeIcon}>{show.venue}</Meta>}
      {setlistLine && <Meta icon={ListMusic}>{setlistLine}</Meta>}
      {!!show.payment && (
        <p className="pt-0.5 font-mono text-[12px] tracking-[.06em] text-ink-2">
          PAY ${Math.round(show.payment / 100)}
        </p>
      )}
    </div>
  </CardShell>
)

const PracticeCard: React.FC<{
  practice: PracticeSession
  songTitles: string[]
  onOpen: () => void
}> = ({ practice, songTitles, onOpen }) => {
  const start = practice.startTime ?? practice.scheduledDate
  const end =
    practice.endTime ??
    (practice.duration
      ? new Date(start.getTime() + practice.duration * 60_000)
      : undefined)
  return (
    <CardShell onClick={onOpen} testId="home-next-practice">
      <div className="flex items-center justify-between gap-2">
        <p className={label}>Next practice</p>
        <p className="font-mono text-[10.5px] tracking-[.12em] uppercase text-accent-ink">
          {formatCountdown(start)}
        </p>
      </div>
      <h3 className="mt-1.5 font-display font-extrabold uppercase text-[30px] leading-[.95] text-ink-1 truncate">
        {practiceTitle(practice)}
      </h3>
      <div className="mt-2.5 space-y-1">
        <Meta icon={Clock}>
          {formatShowDate(start)} · {formatTime12Hour(start)}
          {end ? ` – ${formatTime12Hour(end)}` : ''}
        </Meta>
        {practice.location && <Meta icon={HomeIcon}>{practice.location}</Meta>}
        {songTitles.length > 0 && (
          <Meta icon={Music2}>
            {songTitles.length} song{songTitles.length === 1 ? '' : 's'} ·{' '}
            {songTitles.slice(0, 3).join(', ')}
            {songTitles.length > 3 ? '…' : ''}
          </Meta>
        )}
      </div>
    </CardShell>
  )
}

const EmptyCard: React.FC<{
  icon: LucideIcon
  title: string
  sub: string
  action: string
  onAction: () => void
  testId: string
}> = ({ icon: Icon, title, sub, action, onAction, testId }) => (
  <div
    data-testid={testId}
    className="flex items-center gap-3 rounded-[20px] p-4 shadow-[inset_0_0_0_1.5px_rgb(var(--border-1-rgb))]"
  >
    <Icon size={20} className="text-ink-3 shrink-0" />
    <span className="flex-1 min-w-0">
      <span className="block text-[15px] font-bold text-ink-1">{title}</span>
      <span className="block text-[13px] text-ink-3">{sub}</span>
    </span>
    <Button icon={<Plus size={16} />} onClick={onAction}>
      {action}
    </Button>
  </div>
)

const Walkthrough: React.FC<{
  title: string
  steps: { label: string; done: boolean; to?: string }[]
  doneCount: number
  onDismiss: () => void
  onGo: (to: string) => void
}> = ({ title, steps, doneCount, onDismiss, onGo }) => (
  <div
    className="rounded-[20px] bg-bg-2 shadow-group p-[18px] md:max-w-xl"
    data-testid="home-walkthrough"
  >
    <div className="flex items-center justify-between">
      <h3 className="text-[17px] font-bold text-ink-1">{title}</h3>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        data-testid="home-walkthrough-dismiss"
        className="w-8 h-8 grid place-items-center text-ink-2"
      >
        <X size={18} />
      </button>
    </div>
    <div className="mt-3 h-1.5 rounded-full bg-bg-4 overflow-hidden">
      <div
        className="h-full bg-accent rounded-full transition-all"
        style={{ width: `${(doneCount / steps.length) * 100}%` }}
      />
    </div>
    <p className="mt-2 font-mono text-[11px] tracking-[.12em] text-ink-3">
      {doneCount} OF {steps.length}
    </p>
    <ul className="mt-1">
      {steps.map(s => (
        <li
          key={s.label}
          className="flex items-center gap-3 min-h-[44px] border-b border-divider last:border-0"
        >
          {s.done ? (
            <span className="grid place-items-center w-[22px] h-[22px] rounded-full bg-success text-bg-1">
              <Check size={14} strokeWidth={3} />
            </span>
          ) : (
            <span className="w-[22px] h-[22px] rounded-full ring-[1.5px] ring-border-2" />
          )}
          <span
            className={`flex-1 text-[15px] ${s.done ? 'line-through text-ink-4' : 'font-semibold text-ink-1'}`}
          >
            {s.label}
          </span>
          {!s.done && s.to && (
            <button
              onClick={() => onGo(s.to!)}
              className="text-[13.5px] font-semibold text-accent-ink"
            >
              Add →
            </button>
          )}
        </li>
      ))}
    </ul>
  </div>
)
