import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight,
  Users,
  UserPlus,
  PartyPopper,
  Settings,
  LogOut,
  HelpCircle,
  CalendarDays,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useBandMembers } from '../hooks/useBands'
import { useIncomingRequestCount } from '../hooks/useFriends'
import { Avatar } from '../components/common/Avatar'
import { BandMark, Button, PageTitle } from '../components/ui'
import { VERSION } from '../config/buildInfo'

const Row: React.FC<{
  label: string
  icon: LucideIcon
  onClick: () => void
  testid: string
  badge?: number
  danger?: boolean
}> = ({ label, icon: Icon, onClick, testid, badge, danger }) => (
  <button
    onClick={onClick}
    data-testid={testid}
    className={`w-full flex items-center gap-3.5 min-h-[56px] px-4 text-left border-b border-divider last:border-0 hover:bg-bg-3/60 text-[15.5px] font-semibold ${
      danger ? 'text-danger' : 'text-ink-1'
    }`}
  >
    <Icon size={20} className={danger ? 'text-danger' : 'text-ink-3'} />
    <span className="flex-1">{label}</span>
    {!!badge && (
      <span className="rounded-lg bg-accent text-on-accent px-1.5 font-mono text-[11px]">
        {badge}
      </span>
    )}
    {!danger && <ChevronRight size={17} className="text-ink-4" />}
  </button>
)

const Group: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-[20px] bg-bg-2 shadow-group overflow-hidden">
    {children}
  </div>
)

/**
 * More (Core Navigation 8): band card with Manage band, your row (→ profile),
 * then everything outside the four main tabs.
 */
export function MorePage() {
  const navigate = useNavigate()
  const {
    signOut,
    currentBand,
    currentBandId,
    currentUser,
    currentUserProfile,
    currentUserRole,
  } = useAuth()
  const { showToast } = useToast()
  const { members } = useBandMembers(currentBandId ?? '')
  const friendRequests = useIncomingRequestCount()

  const youName =
    currentUserProfile?.displayName?.trim() ||
    currentUser?.name?.trim() ||
    currentUser?.email ||
    'You'
  const youSub = [
    currentUserProfile?.instruments?.join(', '),
    currentBandId ? (currentUserRole === 'admin' ? 'Admin' : 'Member') : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div data-testid="more-page" className="max-w-2xl flex flex-col gap-3">
      <PageTitle title="More" />

      {currentBand ? (
        <div
          className="rounded-[20px] bg-bg-2 shadow-group p-4"
          data-testid="more-band-card"
        >
          <div className="flex items-center gap-3.5">
            <BandMark name={currentBand.name} size={48} />
            <div className="min-w-0">
              <p className="text-[18px] font-bold text-ink-1 truncate">
                {currentBand.name}
              </p>
              <p className="text-[13px] text-ink-3">
                {members.length} member{members.length === 1 ? '' : 's'} · since{' '}
                {currentBand.createdDate.toLocaleDateString(undefined, {
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
          <div className="mt-3.5 flex items-center justify-between">
            <span className="flex">
              {members.slice(0, 5).map((m, i) => (
                <span
                  key={m.membership.id}
                  className={`rounded-full ring-2 ring-bg-2 ${i ? '-ml-2' : ''}`}
                >
                  <Avatar
                    size="xs"
                    label={m.profile?.displayName || m.user?.name || '?'}
                  />
                </span>
              ))}
            </span>
            <Button
              onClick={() => navigate('/band-members')}
              data-testid="more-manage-band"
            >
              Manage band
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => navigate('/get-started')}
          data-testid="more-band-card"
          className="flex items-center gap-3.5 rounded-[20px] bg-bg-2 shadow-group p-4 text-left"
        >
          <span className="grid place-items-center w-12 h-12 rounded-2xl bg-accent-soft text-accent-ink">
            <Users size={22} />
          </span>
          <span className="flex-1">
            <span className="block text-[16px] font-bold text-ink-1">
              Create or join a band
            </span>
            <span className="block text-[13px] text-ink-3">
              Share songs, setlists and a calendar.
            </span>
          </span>
          <ChevronRight size={17} className="text-ink-4" />
        </button>
      )}

      <Group>
        <button
          onClick={() => navigate('/settings')}
          data-testid="more-account"
          className="w-full flex items-center gap-3.5 px-4 py-3 text-left hover:bg-bg-3/60"
        >
          <Avatar size="md" label={youName} />
          <span className="flex-1 min-w-0">
            <span className="block truncate text-[15.5px] font-bold text-ink-1">
              {youName}
            </span>
            {youSub && (
              <span className="block truncate text-[12.5px] text-ink-3">
                {youSub}
              </span>
            )}
          </span>
          <ChevronRight size={17} className="text-ink-4" />
        </button>
      </Group>

      <Group>
        <Row
          label="Jam"
          icon={PartyPopper}
          onClick={() => navigate('/jam')}
          testid="more-jam"
        />
        <Row
          label="Events"
          icon={CalendarDays}
          onClick={() => navigate('/events')}
          testid="more-events"
        />
        <Row
          label="Friends"
          icon={UserPlus}
          badge={friendRequests}
          onClick={() => navigate('/friends')}
          testid="more-friends"
        />
        {currentBandId && (
          <Row
            label="Band members"
            icon={Users}
            onClick={() => navigate('/band-members')}
            testid="more-band"
          />
        )}
      </Group>

      <Group>
        <Row
          label="Settings"
          icon={Settings}
          onClick={() => navigate('/settings')}
          testid="more-settings"
        />
        <Row
          label="Help & feedback"
          icon={HelpCircle}
          onClick={() => showToast('Help & feedback is coming soon', 'info')}
          testid="more-help"
        />
        <Row
          label="Sign out"
          icon={LogOut}
          onClick={signOut}
          danger
          testid="more-sign-out"
        />
      </Group>

      <p className="mt-2 text-center font-mono text-[11px] text-ink-4">
        Rock On · v{VERSION}
      </p>
    </div>
  )
}
