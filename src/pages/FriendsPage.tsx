import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MoreHorizontal, Plus, UserMinus, Users, X } from 'lucide-react'
import { useFriends } from '../hooks/useFriends'
import { useToast } from '../contexts/ToastContext'
import { useConfirm } from '../hooks/useConfirm'
import { useMediaQuery } from '../hooks/useResponsive'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { BackCrumb } from '../components/layout/MobileHeader'
import { DockAction } from '../components/layout/PhoneDock'
import {
  Button,
  Empty,
  Group,
  PageTitle,
  RetryCard,
  Sheet,
  SheetItem,
  SkeletonRow,
} from '../components/ui'
import { PersonAvatar } from '../components/friends/PersonAvatar'
import { FriendCodeCard } from '../components/friends/FriendCodeCard'
import { PrivacyPanel } from '../components/friends/PrivacyPanel'
import { AddFriendSheet } from '../components/friends/AddFriendSheet'
import { copyText, friendCodeLink } from '../components/friends/share'
import { formatShowDate } from '../utils/dateHelpers'
import type { FriendSummary } from '../models/Friend'

type At = { x: number; y: number } | null

const smallBtn = '!h-9 !px-3.5 !text-[13px]'

/** "Nov 17" this year, "Nov 17, 2025" before. */
const shortDate = (d: Date) =>
  d.getFullYear() === new Date().getFullYear()
    ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : formatShowDate(d)

const subLine = (...parts: (string | false | undefined)[]) =>
  parts.filter(Boolean).join(' · ')

/** A person row: avatar in their colour, name, a sub line, trailing actions. */
const PersonRow: React.FC<{
  name: string
  color: string | null
  sub: string
  children: React.ReactNode
  'data-testid': string
}> = ({ name, color, sub, children, 'data-testid': testId }) => (
  <div
    className="flex items-center gap-3 min-h-[60px] py-2 pl-4 pr-2.5"
    data-testid={testId}
  >
    <PersonAvatar name={name} color={color} />
    <span className="flex-1 min-w-0">
      <b className="block text-[15px] font-semibold text-ink-1 truncate">
        {name}
      </b>
      {sub && (
        <small className="block text-[12.5px] text-ink-3 truncate">{sub}</small>
      )}
    </span>
    <span className="flex items-center gap-1.5 shrink-0">{children}</span>
  </div>
)

/** A one-line empty state inside a group, with its action. */
const EmptyLine: React.FC<{
  text: string
  action?: React.ReactNode
  'data-testid': string
}> = ({ text, action, 'data-testid': testId }) => (
  <div
    className="flex items-center gap-3 min-h-14 px-4 py-2"
    data-testid={testId}
  >
    <span className="flex-1 text-[14px] text-ink-3">{text}</span>
    {action}
  </div>
)

const Skeletons = ({ n }: { n: number }) => (
  <>
    {Array.from({ length: n }, (_, i) => (
      <SkeletonRow key={i} />
    ))}
  </>
)

const iconBtn =
  'grid place-items-center w-11 h-11 rounded-full text-ink-3 hover:text-ink-1 hover:bg-bg-3'

/**
 * Friends (Phase 6g). Your code + QR and your privacy as a status line that
 * rolls open; Requests · Friends · Sent; Add a friend (by name or code) as a
 * sheet on phones and a dialog on desktop. Two panes from lg: lists left,
 * code and privacy right.
 */
export function FriendsPage() {
  const { showToast } = useToast()
  const { confirm, dialogProps } = useConfirm()
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const twoPane = useMediaQuery('(min-width: 1024px)')
  const f = useFriends()
  const [searchParams, setSearchParams] = useSearchParams()
  const sharedCode = searchParams.get('code')?.toUpperCase() ?? ''
  // Arriving from a shared QR / link (`/friends?code=XXXX`) opens Add a friend.
  const [adding, setAdding] = useState(!!sharedCode)
  const [menu, setMenu] = useState<{ friend: FriendSummary; at: At } | null>(
    null
  )

  const closeAdd = useCallback(() => {
    setAdding(false)
    if (sharedCode) setSearchParams({}, { replace: true })
  }, [sharedCode, setSearchParams])

  const run = async (fn: () => Promise<void>, done?: string) => {
    try {
      await fn()
      if (done) showToast(done, 'success')
    } catch {
      showToast("That didn't save. Try again.", 'error')
    }
  }

  const removeFriend = async (friend: FriendSummary) => {
    setMenu(null)
    const ok = await confirm({
      title: `Remove ${friend.name}?`,
      message:
        "You'll stop seeing each other in Friends. You can add each other again later.",
      confirmLabel: 'Remove',
      variant: 'danger',
    })
    if (ok)
      await run(
        () => f.unfriend(friend.friendshipId),
        `${friend.name} removed from friends`
      )
  }

  const shareMine = async () => {
    if (!f.profile?.friendCode) return
    const ok = await copyText(friendCodeLink(f.profile.friendCode))
    showToast(
      ok ? 'Link copied' : "Couldn't copy. Share your code instead.",
      ok ? 'success' : 'error'
    )
  }

  const friendIds = new Set(f.friends.map(x => x.userId))
  const sentIds = new Set(f.outgoing.map(r => r.userId))
  const incomingIds = new Set(f.incoming.map(r => r.userId))
  const relationOf = (userId: string) =>
    friendIds.has(userId)
      ? ('friend' as const)
      : sentIds.has(userId)
        ? ('sent' as const)
        : incomingIds.has(userId)
          ? ('incoming' as const)
          : ('none' as const)

  const addButton = (
    <Button
      variant="primary"
      size="lg"
      icon={<Plus size={19} />}
      onClick={() => setAdding(true)}
      className={isDesktop ? '' : 'w-full'}
      data-testid="friends-add-button"
    >
      Add a friend
    </Button>
  )

  const count = (n: number) => (f.requestsLoading ? '' : ` · ${n}`)

  // ── Requests ───────────────────────────────────────────────────────────────
  const requests = f.requestsError ? (
    <Group label="Requests">
      <div className="pt-2.5">
        <RetryCard
          message="Couldn't load requests."
          onRetry={() => void f.refetchRequests()}
        />
      </div>
    </Group>
  ) : (
    <Group label={`Requests${count(f.incoming.length)}`}>
      {f.requestsLoading ? (
        <Skeletons n={2} />
      ) : f.incoming.length === 0 ? (
        <EmptyLine
          text="No requests waiting."
          action={
            <Button
              className={smallBtn}
              onClick={() => void shareMine()}
              disabled={!f.profile?.friendCode}
              data-testid="friends-requests-share"
            >
              Share my code
            </Button>
          }
          data-testid="friends-requests-empty"
        />
      ) : (
        <div className="divide-y divide-divider" data-testid="friends-incoming">
          {f.incoming.map(req => (
            <PersonRow
              key={req.id}
              name={req.name}
              color={req.color}
              sub={
                req.instruments.slice(0, 2).join(', ') || 'Wants to be friends'
              }
              data-testid={`friend-request-${req.id}`}
            >
              <Button
                variant="primary"
                className={smallBtn}
                onClick={() =>
                  void run(
                    () => f.accept(req.id),
                    `You and ${req.name} are now friends`
                  )
                }
                data-testid={`friend-accept-${req.id}`}
              >
                Accept
              </Button>
              <Button
                className={smallBtn}
                onClick={() => void run(() => f.decline(req.id), 'Declined')}
                data-testid={`friend-decline-${req.id}`}
              >
                Decline
              </Button>
            </PersonRow>
          ))}
        </div>
      )}
    </Group>
  )

  // ── Friends ────────────────────────────────────────────────────────────────
  const friends = f.friendsError ? (
    <Group label="Friends">
      <div className="pt-2.5">
        <RetryCard
          message="Couldn't load your friends."
          onRetry={() => void f.refetchFriends()}
        />
      </div>
    </Group>
  ) : (
    <Group label={`Friends${f.loading ? '' : ` · ${f.friends.length}`}`}>
      {f.loading ? (
        <Skeletons n={3} />
      ) : f.friends.length === 0 ? (
        <Empty
          icon={<Users size={28} />}
          title="No friends yet"
          why="Add bandmates and people you jam with, by name or with their friend code."
          action={
            <Button
              variant="primary"
              icon={<Plus size={18} />}
              onClick={() => setAdding(true)}
              data-testid="friends-empty-add"
            >
              Add a friend
            </Button>
          }
          data-testid="friends-list-empty"
        />
      ) : (
        <div className="divide-y divide-divider" data-testid="friends-list">
          {f.friends.map(friend => (
            <PersonRow
              key={friend.friendshipId}
              name={friend.name}
              color={friend.color}
              sub={subLine(
                friend.instruments.slice(0, 2).join(', '),
                friend.sharedBands > 0 &&
                  `${friend.sharedBands} shared band${friend.sharedBands === 1 ? '' : 's'}`
              )}
              data-testid={`friend-${friend.friendshipId}`}
            >
              <button
                type="button"
                aria-label={`More for ${friend.name}`}
                onClick={e => {
                  const r = e.currentTarget.getBoundingClientRect()
                  setMenu({
                    friend,
                    at: isDesktop
                      ? { x: r.right - 220, y: r.bottom + 6 }
                      : null,
                  })
                }}
                className={iconBtn}
                data-testid={`friend-menu-${friend.friendshipId}`}
              >
                <MoreHorizontal size={20} />
              </button>
            </PersonRow>
          ))}
        </div>
      )}
    </Group>
  )

  // ── Sent ───────────────────────────────────────────────────────────────────
  const sent = f.requestsError ? null : (
    <Group label={`Sent${count(f.outgoing.length)}`}>
      {f.requestsLoading ? (
        <Skeletons n={1} />
      ) : f.outgoing.length === 0 ? (
        <EmptyLine
          text="No requests out."
          action={
            <Button
              className={smallBtn}
              onClick={() => setAdding(true)}
              data-testid="friends-sent-add"
            >
              Add a friend
            </Button>
          }
          data-testid="friends-sent-empty"
        />
      ) : (
        <div className="divide-y divide-divider" data-testid="friends-outgoing">
          {f.outgoing.map(req => (
            <PersonRow
              key={req.id}
              name={req.name}
              color={req.color}
              sub={`Pending · sent ${shortDate(req.createdDate)}`}
              data-testid={`friend-sent-${req.id}`}
            >
              <button
                type="button"
                aria-label={`Cancel request to ${req.name}`}
                title="Cancel request"
                onClick={() =>
                  void run(() => f.cancel(req.id), 'Request cancelled')
                }
                className={iconBtn}
                data-testid={`friend-cancel-${req.id}`}
              >
                <X size={19} />
              </button>
            </PersonRow>
          ))}
        </div>
      )}
    </Group>
  )

  // ── Your code + privacy ────────────────────────────────────────────────────
  const mine = f.profileError ? (
    <RetryCard
      message="Couldn't load your friend code."
      onRetry={() => void f.refetchProfile()}
    />
  ) : (
    <>
      <Group label={twoPane ? 'Your friend code' : undefined}>
        <FriendCodeCard
          code={f.profile?.friendCode ?? ''}
          loading={f.profileLoading}
          desktop={twoPane}
        />
      </Group>
      <Group label={twoPane ? 'Privacy' : undefined}>
        <PrivacyPanel profile={f.profile} onSave={f.savePrivacy} />
      </Group>
    </>
  )

  return (
    <div data-testid="friends-page" className="max-w-5xl pb-28 md:pb-8">
      {!isDesktop && (
        <BackCrumb to="/more" label="More" data-testid="friends-back" />
      )}
      <PageTitle
        eyebrow={isDesktop ? 'You' : undefined}
        title="Friends"
        count={f.loading ? undefined : f.friends.length}
        actions={isDesktop ? addButton : undefined}
      />

      <div className="-mx-3 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-4 lg:items-start">
        <aside className="lg:col-start-2 lg:row-start-1 mb-2 lg:mb-0">
          {mine}
        </aside>
        <div className="lg:col-start-1 lg:row-start-1">
          {requests}
          {friends}
          {sent}
        </div>
      </div>

      {!isDesktop && <DockAction>{addButton}</DockAction>}

      {adding && (
        <AddFriendSheet
          onClose={closeAdd}
          myCode={f.profile?.friendCode ?? ''}
          initialCode={sharedCode}
          relationOf={relationOf}
          search={f.searchByName}
          send={f.send}
        />
      )}

      {menu && (
        <Sheet
          onClose={() => setMenu(null)}
          at={menu.at}
          width={220}
          title={menu.friend.name}
          data-testid="friend-menu-sheet"
        >
          <div role="menu" className="pb-1">
            <SheetItem
              icon={<UserMinus />}
              label="Remove friend"
              danger
              onClick={() => void removeFriend(menu.friend)}
              data-testid="friend-remove"
            />
          </div>
        </Sheet>
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
