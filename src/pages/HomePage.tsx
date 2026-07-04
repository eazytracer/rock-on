import { useNavigate } from 'react-router-dom'
import {
  Ticket,
  Calendar as CalendarIcon,
  MapPin,
  Clock,
  Plus,
  ListMusic,
  ChevronRight,
  Disc3,
  Users,
  PartyPopper,
  UserPlus,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useUpcomingShows } from '../hooks/useShows'
import { useUpcomingPractices } from '../hooks/usePractices'
import { useSongs } from '../hooks/useSongs'
import { useSetlists } from '../hooks/useSetlists'
import {
  formatShowDate,
  formatTime12Hour,
  formatCountdown,
} from '../utils/dateHelpers'
import { Badge } from '../components/common/Badge'
import { Eyebrow } from '../components/common/Eyebrow'
import { SHOW_TONE, PRACTICE_TONE, type BadgeTone } from '../utils/tokens'
import { ContentLoadingSpinner } from '../components/common/ContentLoadingSpinner'

function Card({
  children,
  onClick,
  testid,
}: {
  children: React.ReactNode
  onClick?: () => void
  testid?: string
}) {
  return (
    <div
      onClick={onClick}
      data-testid={testid}
      className={`rounded-2xl bg-bg-1 border border-border-1 p-4 ${
        onClick ? 'cursor-pointer transition-colors hover:border-border-2' : ''
      }`}
    >
      {children}
    </div>
  )
}

/**
 * Home / Dashboard (mobile-redesign-port P9).
 * At-a-glance command view: next show, next practice, quick stats, quick actions.
 * Backed by existing data hooks — no new data layer.
 */
export function HomePage() {
  const navigate = useNavigate()
  const { currentBandId, currentBand } = useAuth()
  const bandId = currentBandId ?? ''
  const hasBand = !!currentBandId

  const { upcomingShows, loading: showsLoading } = useUpcomingShows(bandId)
  const { upcomingPractices, loading: practicesLoading } =
    useUpcomingPractices(bandId)
  const { songs } = useSongs(bandId)
  const { setlists } = useSetlists(bandId)

  const loading = showsLoading || practicesLoading
  const nextShow = upcomingShows[0]
  const nextPractice = upcomingPractices[0]

  // Songs work for personal accounts too; setlists/shows are band-only.
  const stats: { label: string; value: number; onClick: () => void }[] = [
    { label: 'Songs', value: songs.length, onClick: () => navigate('/songs') },
    ...(hasBand
      ? [
          {
            label: 'Setlists',
            value: setlists.length,
            onClick: () => navigate('/setlists'),
          },
          {
            label: 'Upcoming shows',
            value: upcomingShows.length,
            onClick: () => navigate('/shows'),
          },
        ]
      : []),
  ]

  const bandActions: {
    label: string
    icon: LucideIcon
    onClick: () => void
    testid: string
  }[] = [
    {
      label: 'Add song',
      icon: Plus,
      onClick: () => navigate('/songs'),
      testid: 'home-action-song',
    },
    {
      label: 'New setlist',
      icon: ListMusic,
      onClick: () => navigate('/setlists/new'),
      testid: 'home-action-setlist',
    },
    {
      label: 'Schedule practice',
      icon: CalendarIcon,
      onClick: () => navigate('/practices/new'),
      testid: 'home-action-practice',
    },
    {
      label: 'Book show',
      icon: Ticket,
      onClick: () => navigate('/shows/new'),
      testid: 'home-action-show',
    },
  ]

  // Band-less quick actions steer toward the personal surfaces (songs, events,
  // friends) — the band-only creation actions are hidden until they have a band.
  const personalActions: typeof bandActions = [
    {
      label: 'Add song',
      icon: Plus,
      onClick: () => navigate('/songs'),
      testid: 'home-action-song',
    },
    {
      label: 'Host an event',
      icon: PartyPopper,
      onClick: () => navigate('/events/new'),
      testid: 'home-action-event',
    },
    {
      label: 'Find friends',
      icon: UserPlus,
      onClick: () => navigate('/friends'),
      testid: 'home-action-friends',
    },
  ]

  const actions = hasBand ? bandActions : personalActions

  return (
    <div data-testid="home-page" className="max-w-3xl">
      <h1 className="text-2xl font-bold text-ink-1">Home</h1>
      <p className="mt-1 text-sm text-ink-4">
        {currentBand
          ? `${currentBand.name} at a glance`
          : 'Your personal dashboard'}
      </p>

      <ContentLoadingSpinner isLoading={loading}>
        <div className="mt-5 flex flex-col gap-4">
          {/* Band-less: prompt to unlock band features (shows/setlists/practices) */}
          {!hasBand && (
            <button
              onClick={() => navigate('/get-started')}
              data-testid="home-create-band"
              className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent-soft p-4 text-left transition-colors hover:border-accent/60"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white">
                <Users size={20} />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-ink-1">
                  Create or join a band
                </span>
                <span className="block text-xs text-ink-4">
                  Unlock setlists, shows and practices with your bandmates.
                </span>
              </span>
              <ChevronRight size={18} className="text-accent" />
            </button>
          )}

          {/* Next show + next practice — band-only */}
          {hasBand && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Eyebrow className="mb-2">Next show</Eyebrow>
                {nextShow ? (
                  <Card
                    onClick={() => navigate(`/shows/${nextShow.id}`)}
                    testid="home-next-show"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-ink-1">
                        {nextShow.name}
                      </span>
                      <Badge
                        tone={
                          (SHOW_TONE[
                            nextShow.status as keyof typeof SHOW_TONE
                          ] ?? 'neutral') as BadgeTone
                        }
                      >
                        {nextShow.status}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
                      <span className="font-mono text-accent">
                        {formatCountdown(nextShow.scheduledDate)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} />{' '}
                        {formatShowDate(nextShow.scheduledDate)} ·{' '}
                        {formatTime12Hour(nextShow.scheduledDate)}
                      </span>
                      {(nextShow.venue || nextShow.location) && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={12} />{' '}
                          {nextShow.venue ?? nextShow.location}
                        </span>
                      )}
                    </div>
                  </Card>
                ) : (
                  <Card
                    onClick={() => navigate('/shows/new')}
                    testid="home-next-show-empty"
                  >
                    <span className="text-sm text-ink-4">
                      No upcoming shows — book one
                    </span>
                  </Card>
                )}
              </div>

              <div>
                <Eyebrow className="mb-2">Next practice</Eyebrow>
                {nextPractice ? (
                  <Card
                    onClick={() => navigate(`/practices/${nextPractice.id}`)}
                    testid="home-next-practice"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-ink-1">
                        {formatShowDate(nextPractice.scheduledDate)}
                      </span>
                      <Badge
                        tone={
                          (PRACTICE_TONE[
                            nextPractice.status as keyof typeof PRACTICE_TONE
                          ] ?? 'neutral') as BadgeTone
                        }
                      >
                        {nextPractice.status}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
                      <span className="font-mono text-accent">
                        {formatCountdown(nextPractice.scheduledDate)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} />{' '}
                        {formatTime12Hour(nextPractice.scheduledDate)}
                      </span>
                      {nextPractice.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={12} /> {nextPractice.location}
                        </span>
                      )}
                    </div>
                  </Card>
                ) : (
                  <Card
                    onClick={() => navigate('/practices/new')}
                    testid="home-next-practice-empty"
                  >
                    <span className="text-sm text-ink-4">
                      No practice scheduled — plan one
                    </span>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* Quick stats */}
          <div
            className={`grid gap-3 ${stats.length >= 3 ? 'grid-cols-3' : stats.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}
          >
            {stats.map(s => (
              <button
                key={s.label}
                onClick={s.onClick}
                data-testid={`home-stat-${s.label.split(' ')[0].toLowerCase()}`}
                className="rounded-xl bg-bg-1 border border-border-1 p-3 text-left transition-colors hover:border-border-2"
              >
                <div className="font-mono text-2xl font-bold text-ink-1">
                  {s.value}
                </div>
                <div className="mt-0.5 text-[11px] text-ink-4">{s.label}</div>
              </button>
            ))}
          </div>

          {/* Quick actions */}
          <div>
            <Eyebrow className="mb-2">Quick actions</Eyebrow>
            <div className="grid grid-cols-2 gap-3">
              {actions.map(({ label, icon: Icon, onClick, testid }) => (
                <button
                  key={label}
                  onClick={onClick}
                  data-testid={testid}
                  className="flex items-center gap-3 rounded-xl bg-bg-1 border border-border-1 p-3 text-left transition-colors hover:border-border-2"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
                    <Icon size={18} />
                  </span>
                  <span className="flex-1 text-sm font-medium text-ink-2">
                    {label}
                  </span>
                  <ChevronRight size={16} className="text-ink-5" />
                </button>
              ))}
            </div>
          </div>

          {/* Jump to repertoire */}
          <button
            onClick={() => navigate('/songs')}
            data-testid="home-repertoire"
            className="flex items-center gap-3 rounded-xl border border-border-1 p-3 text-left text-ink-3 transition-colors hover:text-ink-1 hover:bg-bg-2"
          >
            <Disc3 size={18} />
            <span className="text-sm font-medium">
              Browse the full repertoire
            </span>
            <ChevronRight size={16} className="ml-auto text-ink-5" />
          </button>
        </div>
      </ContentLoadingSpinner>
    </div>
  )
}
