/**
 * The Jam hub (`/jam`; Jam Plan 1, FP 20, desktop hub): a live jam you're in
 * as the hero (Return to jam; hosts on desktop: Return to console), then
 * Hosting · N, Invited · N (Join accepts the invite), Friends' jams (Join),
 * Past, Host a jam (the phone dock) and Join with a code (a code field that
 * opens `/j/CODE`), one line on what it's for. Empty, loading, retry states.
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, PartyPopper, Plus, QrCode } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useMediaQuery } from '../../hooks/useResponsive'
import { useJamAction, useMyJams } from '../../hooks/useJam'
import { joinJamById, type MyJam } from '../../services/api/jams'
import { errorText } from '../../services/api/errors'
import { DockAction } from '../../components/layout/PhoneDock'
import {
  Button,
  Empty,
  Group,
  PageTitle,
  RetryCard,
  Sheet,
  SkeletonRow,
  TypeLabel,
} from '../../components/ui'
import { JoinCodeForm } from '../../components/jams/JoinCodeForm'
import { isEnded, partsFromInstruments } from '../../components/jams/parts'
import { formatTime12Hour } from '../../utils/dateHelpers'

const LiveMark: React.FC = () => (
  <span
    className="inline-flex items-center gap-1.5 font-mono text-[10.5px] font-bold tracking-[.12em] uppercase text-danger"
    data-testid="jam-live-mark"
  >
    <span
      className="w-2 h-2 rounded-full bg-danger animate-pulse"
      aria-hidden
    />
    Live
  </span>
)

const JamRow: React.FC<{
  jam: MyJam
  onOpen: () => void
  action?: React.ReactNode
}> = ({ jam, onOpen, action }) => {
  const at = new Date(jam.scheduled_date)
  const status =
    jam.status === 'live'
      ? null
      : jam.status === 'completed'
        ? 'ended'
        : jam.status === 'cancelled'
          ? 'called off'
          : jam.section === 'invited'
            ? jam.joined
              ? 'going'
              : 'invited'
            : jam.section === 'friends'
              ? `hosted by ${jam.host_name.split(' ')[0]}`
              : 'scheduled'
  const sub = [jam.venue?.trim(), formatTime12Hour(at), status]
    .filter(Boolean)
    .join(' · ')
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => e.key === 'Enter' && onOpen()}
      className="flex items-center gap-3.5 w-full px-3 py-2.5 text-left cursor-pointer hover:bg-bg-3/40"
      data-testid={`jam-row-${jam.short_code}`}
      data-section={jam.section}
    >
      <span className="flex flex-col items-center w-10 shrink-0 font-mono leading-none">
        <small className="text-[10px] tracking-[.1em] text-ink-3">
          {at.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
        </small>
        <b className="font-display text-[26px] font-extrabold text-ink-1 my-0.5">
          {at.getDate()}
        </b>
        <small className="text-[10px] tracking-[.1em] text-ink-3">
          {at.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
        </small>
      </span>
      <span className="flex-1 min-w-0">
        <b
          className={`block text-[15.5px] font-semibold truncate ${
            jam.status === 'cancelled'
              ? 'line-through text-ink-3'
              : 'text-ink-1'
          }`}
        >
          {jam.name}
        </b>
        <small className="block text-[13px] text-ink-3 truncate">{sub}</small>
        <span className="flex items-center gap-2 mt-0.5">
          {jam.status === 'live' ? <LiveMark /> : <TypeLabel type="jam" />}
          {jam.section === 'hosting' && jam.pending_count > 0 && (
            <span className="font-mono text-[10.5px] tracking-[.08em] uppercase text-accent-ink">
              · {jam.pending_count}{' '}
              {jam.pending_count === 1 ? 'request' : 'requests'}
            </span>
          )}
        </span>
      </span>
      {action && (
        <span className="shrink-0" onClick={e => e.stopPropagation()}>
          {action}
        </span>
      )}
    </div>
  )
}

export const JamHubPage: React.FC = () => {
  const navigate = useNavigate()
  const desktop = useMediaQuery('(min-width: 768px)')
  const { showToast } = useToast()
  const { currentUserProfile } = useAuth()
  const { data, isLoading, isError, refetch } = useMyJams()
  const [joining, setJoining] = useState(false)
  const join = useJamAction((id: string) =>
    joinJamById(id, partsFromInstruments(currentUserProfile?.instruments ?? []))
  )

  const jams = data ?? []
  const active = jams.filter(j => !isEnded(j.status))
  const hosting = active.filter(j => j.section === 'hosting')
  const invited = active.filter(j => j.section === 'invited')
  const friends = active.filter(j => j.section === 'friends')
  const past = jams
    .filter(j => j.section !== 'friends' && isEnded(j.status))
    .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date))
  const live = active.find(
    j => j.status === 'live' && j.section !== 'friends' && j.joined
  )
  const liveHost = live?.section === 'hosting'

  const accept = async (j: MyJam) => {
    try {
      await join.mutateAsync(j.id)
      showToast(`You're in ${j.name}`, 'success')
      navigate(`/jam/${j.id}`)
    } catch (err) {
      showToast(errorText(err), 'error')
    }
  }
  const joinBtn = (j: MyJam) => (
    <Button
      variant="primary"
      className="!h-9 !text-[13px]"
      disabled={join.isPending}
      onClick={() => void accept(j)}
      data-testid={`jam-join-${j.short_code}`}
    >
      Join
    </Button>
  )
  const open = (j: MyJam) =>
    j.section === 'friends' ? void accept(j) : navigate(`/jam/${j.id}`)

  const hostBtn = (
    <Button
      variant="primary"
      size={desktop ? 'md' : 'lg'}
      fullWidth={!desktop}
      icon={<Plus size={18} />}
      onClick={() => navigate('/jam/new')}
      data-testid="jam-host-button"
    >
      Host a jam
    </Button>
  )
  const joinCodeBtn = (
    <Button
      size={desktop ? 'md' : 'lg'}
      icon={<QrCode size={18} />}
      onClick={() => setJoining(true)}
      data-testid="jam-join-code-button"
    >
      Join with a code
    </Button>
  )

  const group = (
    label: string,
    list: MyJam[],
    testId: string,
    action?: (j: MyJam) => React.ReactNode
  ) =>
    list.length > 0 && (
      <Group label={`${label} · ${list.length}`} data-testid={testId}>
        {list.map(j => (
          <JamRow
            key={j.id}
            jam={j}
            onOpen={() => open(j)}
            action={action?.(j)}
          />
        ))}
      </Group>
    )

  let body: React.ReactNode
  if (isLoading) {
    body = (
      <Group>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </Group>
    )
  } else if (isError) {
    body = (
      <RetryCard
        message="Couldn't load your jams."
        onRetry={() => void refetch()}
      />
    )
  } else if (
    !hosting.length &&
    !invited.length &&
    !friends.length &&
    !past.length
  ) {
    body = (
      <Empty
        icon={<PartyPopper size={28} />}
        title="No jams yet"
        why="Host one in two fields: a name and a time. Lineup, requests and the way in come after."
        action={
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {desktop && hostBtn}
            {joinCodeBtn}
          </div>
        }
        data-testid="jam-hub-empty"
      />
    )
  } else {
    body = (
      <>
        {live && (
          <section
            className="mx-3 mb-3 rounded-[20px] bg-bg-2 p-4 shadow-[inset_0_0_0_2px_rgb(var(--danger-rgb)/.6)]"
            data-testid="jam-live-hero"
          >
            <LiveMark />
            <b className="block mt-1 font-display text-[28px] font-extrabold uppercase leading-none text-ink-1">
              {live.name}
            </b>
            <p className="mt-1 text-[13px] text-ink-3">
              {[
                live.venue,
                `${live.people_count} here`,
                `${live.lineup_count} songs`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <Button
              variant="primary"
              size="lg"
              fullWidth={!desktop}
              icon={<ArrowRight size={18} />}
              className="mt-3"
              onClick={() =>
                navigate(liveHost ? `/jam/${live.id}/live` : `/jam/${live.id}`)
              }
              data-testid="jam-live-return"
            >
              {liveHost && desktop ? 'Return to console' : 'Return to jam'}
            </Button>
          </section>
        )}
        {group('Hosting', hosting, 'jam-hub-hosting')}
        {group('Invited', invited, 'jam-hub-invited', j =>
          j.joined ? undefined : joinBtn(j)
        )}
        {group("Friends' jams", friends, 'jam-hub-friends', joinBtn)}
        {group('Past', past, 'jam-hub-past')}
      </>
    )
  }

  return (
    <div data-testid="jam-hub-page" className="max-w-3xl pb-28 md:pb-8">
      <PageTitle
        title="Jam"
        actions={
          desktop ? (
            <>
              {joinCodeBtn}
              {hostBtn}
            </>
          ) : undefined
        }
      />
      <div className="-mx-3 mt-4">{body}</div>
      {!desktop && !isLoading && (
        <div className="mt-2 flex flex-col">{joinCodeBtn}</div>
      )}
      <p
        className="mt-5 px-1 text-[13.5px] leading-snug text-ink-3"
        data-testid="jam-hub-explainer"
      >
        Find songs you all know, sign up for parts and keep a running list.
        Everything still works on a clipboard; the app just makes it easier.
      </p>
      {!desktop && <DockAction>{hostBtn}</DockAction>}
      {joining && (
        <Sheet
          onClose={() => setJoining(false)}
          title="Join with a code"
          width={380}
          data-testid="jam-join-sheet"
        >
          <div className="pb-3">
            <p className="text-[13px] text-ink-3 pb-3">
              The host's code, like ABCD-EFGH.
            </p>
            <JoinCodeForm autoFocus />
          </div>
        </Sheet>
      )}
    </div>
  )
}

export default JamHubPage
