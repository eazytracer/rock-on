/**
 * The band (`/band`; Band and Friends 1–4, 8, 9; desktop.js band): band card,
 * the invite card for the owner / admins, Members with search and a ⋯ by
 * permission, and a Danger zone (Transfer…, Leave, Delete band…). Every write
 * is a bands RPC; errors show the server's copy. `?invite` (More → Invite,
 * after Create) puts the invite card on top.
 */
import React, { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ChevronRight,
  Crown,
  LogOut,
  Search,
  Shield,
  ShieldOff,
  Trash2,
  User,
  UserMinus,
  Users,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useConfirm } from '../hooks/useConfirm'
import { useMediaQuery } from '../hooks/useResponsive'
import { useBandMembers } from '../hooks/useBands'
import { useBandActions, useBandRow } from '../hooks/useBandAdmin'
import { BackCrumb } from '../components/layout/MobileHeader'
import { MoreButton } from '../components/common/MoreButton'
import { Avatar } from '../components/common/Avatar'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { ContentLoadingSpinner } from '../components/common/ContentLoadingSpinner'
import {
  BandMark,
  Button,
  Empty,
  Group,
  PageTitle,
  RetryCard,
  Sheet,
  SheetItem,
} from '../components/ui'
import { InviteCard } from '../components/band/InviteCard'
import { ApiError, errorText } from '../services/api/errors'
import type { BandMarkValue } from '../components/ui/bandMarkPalette'
import type { BandMemberWithProfile } from '../models/BandMembership'

type Role = 'owner' | 'admin' | 'member'
const ROLE_ORDER: Record<string, number> = { owner: 0, admin: 1, member: 2 }
const roleLabel = (r: string) =>
  r === 'owner' ? 'Owner' : r === 'admin' ? 'Admin' : 'Member'

const memberName = (m: BandMemberWithProfile) =>
  m.profile?.displayName?.trim() || m.user?.name?.trim() || 'Member'
const firstName = (m: BandMemberWithProfile) => memberName(m).split(/\s+/)[0]
const monthYear = (d: Date) =>
  d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })

/** What the viewer may do to this member (set_member_role / remove_member rules). */
function allowed(me: Role | null, them: Role, self: boolean) {
  if (self || !me || them === 'owner') return []
  const out: ('promote' | 'demote' | 'transfer' | 'remove')[] = []
  if (them === 'member' && (me === 'owner' || me === 'admin'))
    out.push('promote')
  if (them === 'admin' && me === 'owner') out.push('demote')
  if (me === 'owner') out.push('transfer')
  if (me === 'owner' || (me === 'admin' && them === 'member'))
    out.push('remove')
  return out
}

/** Leave or delete: the band is gone for this user, so start over in Personal. */
function exitBand() {
  localStorage.setItem('rockon.context', 'personal')
  localStorage.removeItem('currentBandId')
  window.location.assign('/')
}

export const BandPage: React.FC = () => {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const desktop = useMediaQuery('(min-width: 768px)')
  const { currentBand, currentBandId, currentUser } = useAuth()
  const { showToast } = useToast()
  const { confirm, dialogProps } = useConfirm()
  const bandId = currentBandId ?? ''
  const { members, loading, error } = useBandMembers(bandId)
  const { data: band } = useBandRow(bandId)
  const actions = useBandActions(bandId)
  const [query, setQuery] = useState('')
  const [menuFor, setMenuFor] = useState<{
    m: BandMemberWithProfile
    at: { x: number; y: number } | null
  } | null>(null)
  const [picking, setPicking] = useState(false)

  const sorted = useMemo(
    () =>
      [...members].sort(
        (a, b) =>
          (ROLE_ORDER[a.membership.role] ?? 3) -
            (ROLE_ORDER[b.membership.role] ?? 3) ||
          memberName(a).localeCompare(memberName(b))
      ),
    [members]
  )
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter(m =>
      [memberName(m), ...(m.profile?.instruments ?? [])]
        .join(' ')
        .toLowerCase()
        .includes(q)
    )
  }, [sorted, query])

  if (!currentBandId || !currentBand) {
    return (
      <div data-testid="band-page" className="max-w-[720px]">
        <BackCrumb to="/more" label="More" data-testid="band-back" />
        <Empty
          icon={<Users size={26} />}
          title="You're not in a band here"
          why="Switch to a band from the header, or start one."
          action={
            <div className="flex gap-2 mt-2">
              <Button
                variant="primary"
                onClick={() => navigate('/band/new')}
                data-testid="band-empty-create"
              >
                Create a band
              </Button>
              <Button
                onClick={() => navigate('/j')}
                data-testid="band-empty-join"
              >
                Join a band
              </Button>
            </div>
          }
          data-testid="band-page-empty"
        />
      </div>
    )
  }

  const mine = members.find(m => m.membership.userId === currentUser?.id)
  const myRole = (mine?.membership.role as Role | undefined) ?? null
  const isOwner = myRole === 'owner'
  const canInvite = isOwner || myRole === 'admin'
  const count = members.length
  const sole = isOwner && count <= 1
  const name = band?.name ?? currentBand.name
  const mark = (band?.mark ?? null) as BandMarkValue | null
  const others = sorted.filter(m => m.membership.userId !== currentUser?.id)
  const inviteOnTop = canInvite && (params.has('invite') || count <= 1)

  const fail = (err: unknown) => showToast(errorText(err), 'error')

  const doRole = async (m: BandMemberWithProfile, role: 'admin' | 'member') => {
    setMenuFor(null)
    try {
      await actions.setRole.mutateAsync({ userId: m.membership.userId, role })
      showToast(
        `${firstName(m)} is now ${role === 'admin' ? 'an admin' : 'a member'}`,
        'success'
      )
    } catch (err) {
      fail(err)
    }
  }

  const doTransfer = async (m: BandMemberWithProfile) => {
    setMenuFor(null)
    setPicking(false)
    const ok = await confirm({
      title: `Transfer ${name} to ${firstName(m)}?`,
      message: `${memberName(m)} becomes the owner of ${name}. You stay in the band as an admin. Only the owner can delete the band or transfer it again.`,
      confirmLabel: `Transfer to ${firstName(m)}`,
    })
    if (!ok) return
    try {
      await actions.transfer.mutateAsync(m.membership.userId)
      showToast(`${firstName(m)} owns ${name} now`, 'success')
    } catch (err) {
      fail(err)
    }
  }

  const doRemove = async (m: BandMemberWithProfile) => {
    setMenuFor(null)
    const ok = await confirm({
      title: `Remove ${firstName(m)} from ${name}?`,
      message: `${firstName(m)} loses access to the band's songs, setlists and calendar. The songs ${firstName(m)} added stay with the band.`,
      confirmLabel: 'Remove',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await actions.remove.mutateAsync(m.membership.userId)
      showToast(`${firstName(m)} was removed`, 'success')
    } catch (err) {
      fail(err)
    }
  }

  const startTransfer = () => {
    if (others.length === 1) doTransfer(others[0])
    else setPicking(true)
  }

  const doDelete = async () => {
    const ok = await confirm({
      title: `Delete ${name}?`,
      message: `The band, its setlists, shows and calendar go for everyone in it. Songs members copied to My Songs stay. Type the band's name to confirm.`,
      confirmLabel: 'Delete band',
      variant: 'danger',
      typedConfirm: name,
    })
    if (!ok) return
    try {
      await actions.deleteBand.mutateAsync(name)
      exitBand()
    } catch (err) {
      fail(err)
    }
  }

  const doLeave = async () => {
    if (sole) return doDelete()
    if (isOwner) {
      const ok = await confirm({
        title: `Leave ${name}?`,
        message: `Your songs in the band stay with the band. You'll lose access to its setlists and calendar. You own this band, so transfer it first.`,
        confirmLabel: 'Transfer first',
      })
      if (ok) startTransfer()
      return
    }
    const ok = await confirm({
      title: `Leave ${name}?`,
      message: `Your songs in the band stay with the band. You'll lose access to its setlists and calendar.`,
      confirmLabel: 'Leave band',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await actions.leave.mutateAsync()
      exitBand()
    } catch (err) {
      if (err instanceof ApiError && err.key === 'owner_must_transfer')
        startTransfer()
      else if (err instanceof ApiError && err.key === 'owner_must_delete')
        doDelete()
      else fail(err)
    }
  }

  const openMenu = (
    m: BandMemberWithProfile,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    const r = e.currentTarget.getBoundingClientRect()
    setMenuFor({
      m,
      at: desktop ? { x: r.right - 240, y: r.bottom + 6 } : null,
    })
  }

  const bandCard = (
    <div
      className="flex items-center gap-4 rounded-[20px] bg-bg-2 shadow-group p-4"
      data-testid="band-card"
    >
      <BandMark
        name={name}
        mark={mark}
        size={desktop ? 72 : 56}
        data-testid="band-card-mark"
      />
      <div className="flex-1 min-w-0">
        <p
          className="text-[13px] text-ink-3 font-semibold"
          data-testid="band-card-sub"
        >
          {myRole ? roleLabel(myRole) : 'Member'} · {count} member
          {count === 1 ? '' : 's'}
        </p>
        {band?.description && (
          <p className="text-[14.5px] text-ink-2 mt-1 line-clamp-2">
            {band.description}
          </p>
        )}
        <Link
          to="/band/profile"
          className="inline-block mt-1.5 font-mono text-[10.5px] tracking-[.1em] uppercase text-accent-ink"
          data-testid="band-edit-info"
        >
          {canInvite ? 'Edit band info' : 'Band profile'}
        </Link>
      </div>
    </div>
  )

  const invite = canInvite && (
    <InviteCard bandId={bandId} bandName={name} mark={mark} solo={count <= 1} />
  )

  const memberRows = (
    <Group label={`Members · ${count}`} data-testid="band-members">
      {shown.map(m => {
        const self = m.membership.userId === currentUser?.id
        const role = m.membership.role as Role
        const can = allowed(myRole, role, self)
        const ins = m.profile?.instruments?.filter(Boolean).join(', ')
        return (
          <div
            key={m.membership.id}
            className="flex items-center gap-3 min-h-[68px] py-2 pl-4 pr-2.5"
            data-testid={`member-row-${m.membership.userId}`}
          >
            <Avatar size="md" label={memberName(m)} />
            <div className="flex-1 min-w-0">
              <b className="flex items-center gap-2 text-[15px] font-semibold text-ink-1">
                <span className="truncate" data-testid="member-name">
                  {memberName(m)}
                  {self && (
                    <span className="text-ink-3 font-normal"> (you)</span>
                  )}
                </span>
                {role !== 'member' && (
                  <span
                    className={`shrink-0 font-mono text-[10px] tracking-[.08em] uppercase px-[7px] py-[3px] rounded-md ${
                      role === 'owner'
                        ? 'bg-accent text-on-accent'
                        : 'bg-bg-3 text-ink-2'
                    }`}
                    data-testid="member-role"
                  >
                    {role}
                  </span>
                )}
              </b>
              <small className="block text-[12.5px] text-ink-3 leading-snug">
                {ins && <span className="text-ink-2">{ins} · </span>}
                joined {monthYear(m.membership.joinedDate)}
                {canInvite && m.user?.email && (
                  <span className="block truncate">{m.user.email}</span>
                )}
              </small>
            </div>
            {(can.length > 0 || self) && (
              <MoreButton
                label={`Actions for ${memberName(m)}`}
                onClick={e => openMenu(m, e)}
                data-testid={`member-actions-${m.membership.userId}`}
              />
            )}
          </div>
        )
      })}
      {shown.length === 0 && (
        <p className="px-4 py-4 text-[14px] text-ink-3">
          No one matches “{query}”.
        </p>
      )}
    </Group>
  )

  const search = count > 1 && (
    <label
      htmlFor="band-member-search"
      className="mx-3 mb-2 flex items-center gap-2.5 h-11 rounded-full bg-bg-3 px-4 text-ink-3"
    >
      <Search size={18} />
      <input
        id="band-member-search"
        name="memberSearch"
        data-testid="member-search-input"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search members"
        className="flex-1 min-w-0 bg-transparent text-[15px] text-ink-1 outline-none placeholder:text-ink-3"
      />
    </label>
  )

  const danger = (
    <Group label="Danger zone" data-testid="band-danger-zone">
      {isOwner && !sole && (
        <DangerRow
          icon={<Crown size={20} />}
          label="Transfer ownership…"
          sub="You become an admin"
          onClick={startTransfer}
          testid="band-transfer"
        />
      )}
      {!sole && (
        <DangerRow
          icon={<LogOut size={20} />}
          label="Leave band"
          sub={isOwner ? 'Transfer it first' : undefined}
          onClick={doLeave}
          testid="band-leave"
        />
      )}
      {isOwner && (
        <DangerRow
          icon={<Trash2 size={20} />}
          label="Delete band…"
          sub="Typed confirmation. Songs copied to members' catalogs stay."
          onClick={doDelete}
          danger
          testid="band-delete"
        />
      )}
    </Group>
  )

  const menuM = menuFor?.m
  const menuCan = menuM
    ? allowed(
        myRole,
        menuM.membership.role as Role,
        menuM.membership.userId === currentUser?.id
      )
    : []

  return (
    <div data-testid="band-page" className={desktop ? '' : 'pb-28'}>
      <BackCrumb
        to="/more"
        label="More"
        className="mb-4"
        data-testid="band-back"
      />
      <PageTitle
        eyebrow={`Band · since ${monthYear(currentBand.createdDate)}`}
        title={name}
        testId="band-title"
      />
      <ContentLoadingSpinner isLoading={loading}>
        {error ? (
          <RetryCard
            message="The band didn't load."
            onRetry={() => window.location.reload()}
          />
        ) : desktop ? (
          <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4 items-start">
            <div className="-mx-3">
              <div className="px-3 mb-3">{bandCard}</div>
              {search}
              {memberRows}
            </div>
            <div className="flex flex-col gap-3">
              {invite}
              <div className="-mx-3">{danger}</div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {inviteOnTop && invite}
            {bandCard}
            {!inviteOnTop && invite}
            <div className="-mx-3">
              {search}
              {memberRows}
              {danger}
            </div>
          </div>
        )}
      </ContentLoadingSpinner>

      {menuM && (
        <Sheet
          onClose={() => setMenuFor(null)}
          at={menuFor?.at}
          width={240}
          title={memberName(menuM)}
          sub={[
            menuM.profile?.instruments?.join(', '),
            roleLabel(menuM.membership.role),
          ]
            .filter(Boolean)
            .join(' · ')}
          data-testid="band-member-sheet"
        >
          {menuM.membership.userId === currentUser?.id && (
            <SheetItem
              icon={<User />}
              label="Edit your profile"
              onClick={() => navigate('/settings')}
              data-testid="band-member-edit-profile"
            />
          )}
          {menuCan.includes('promote') && (
            <SheetItem
              icon={<Shield />}
              label="Make admin"
              hint="Can invite"
              onClick={() => doRole(menuM, 'admin')}
              data-testid="band-member-make-admin"
            />
          )}
          {menuCan.includes('demote') && (
            <SheetItem
              icon={<ShieldOff />}
              label="Make member"
              onClick={() => doRole(menuM, 'member')}
              data-testid="band-member-make-member"
            />
          )}
          {menuCan.includes('transfer') && (
            <SheetItem
              icon={<Crown />}
              label={`Transfer to ${firstName(menuM)}…`}
              onClick={() => doTransfer(menuM)}
              data-testid="band-member-transfer"
            />
          )}
          {menuCan.includes('remove') && (
            <SheetItem
              icon={<UserMinus />}
              label="Remove from band…"
              danger
              onClick={() => doRemove(menuM)}
              data-testid="band-member-remove"
            />
          )}
        </Sheet>
      )}

      {picking && (
        <Sheet
          onClose={() => setPicking(false)}
          title="Transfer ownership"
          sub="Pick the new owner. You stay as an admin."
          data-testid="band-transfer-sheet"
        >
          {others.map(m => (
            <SheetItem
              key={m.membership.id}
              icon={<Crown />}
              label={memberName(m)}
              hint={roleLabel(m.membership.role)}
              onClick={() => doTransfer(m)}
              data-testid={`band-transfer-to-${m.membership.userId}`}
            />
          ))}
        </Sheet>
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  )
}

const DangerRow: React.FC<{
  icon: React.ReactNode
  label: string
  sub?: string
  onClick: () => void
  danger?: boolean
  testid: string
}> = ({ icon, label, sub, onClick, danger, testid }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testid}
    className={`w-full flex items-center gap-3.5 min-h-[56px] px-4 py-2 text-left hover:bg-bg-3/60 ${
      danger ? 'text-danger' : 'text-ink-1'
    }`}
  >
    <span className={danger ? 'text-danger' : 'text-ink-3'}>{icon}</span>
    <span className="flex-1 min-w-0">
      <b className="block text-[15px] font-semibold">{label}</b>
      {sub && <small className="block text-[12.5px] text-ink-3">{sub}</small>}
    </span>
    <ChevronRight size={17} className="text-ink-4" />
  </button>
)

export default BandPage
