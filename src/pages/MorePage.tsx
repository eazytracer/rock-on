import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight,
  Users,
  UserPlus,
  PartyPopper,
  Music2,
  Settings,
  LogOut,
  HelpCircle,
  Moon,
  Share2,
  Star,
  Sun,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useBandMembers } from '../hooks/useBands'
import { useIncomingRequestCount } from '../hooks/useFriends'
import { Avatar } from '../components/common/Avatar'
import { BandMark, IconButton, PageTitle } from '../components/ui'
import type { BandMarkValue } from '../components/ui/bandMarkPalette'
import { useTheme } from '../contexts/ThemeContext'
import { useMyContexts } from '../hooks/useMyContexts'
import { useInviteCode } from '../hooks/useBandAdmin'
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

const BandRow: React.FC<{
  lead: React.ReactNode
  title: string
  sub: string
  onClick: () => void
  testid: string
}> = ({ lead, title, sub, onClick, testid }) => (
  <button
    onClick={onClick}
    data-testid={testid}
    className="w-full flex items-center gap-3.5 min-h-[60px] px-4 py-2 text-left border-b border-divider last:border-0 hover:bg-bg-3/60"
  >
    <span className="w-[52px] grid place-items-center shrink-0">{lead}</span>
    <span className="flex-1 min-w-0">
      <span className="block text-[15.5px] font-semibold text-ink-1">
        {title}
      </span>
      <span className="block truncate text-[12.5px] text-ink-3">{sub}</span>
    </span>
    <ChevronRight size={17} className="text-ink-4" />
  </button>
)

const Group: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-[20px] bg-bg-2 shadow-group overflow-hidden">
    {children}
  </div>
)

/**
 * More (Core Navigation 8; Tools on Home 4): the Band section (band card,
 * Members, Band profile, Invite), your row (→ profile), Jam, Friends, then
 * Settings, Help, Sign out. Sun / moon top right switches dark and light.
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
  const { resolvedTheme, setTheme } = useTheme()
  const { data: contexts } = useMyContexts()
  const bandMark = (contexts?.find(c => c.band_id === currentBandId)?.mark ??
    null) as BandMarkValue | null
  const canInvite = currentUserRole === 'owner' || currentUserRole === 'admin'
  const { data: invite } = useInviteCode(currentBandId ?? '', canInvite)
  const roleName =
    currentUserRole === 'owner'
      ? 'Owner'
      : currentUserRole === 'admin'
        ? 'Admin'
        : 'Member'

  const youName =
    currentUserProfile?.displayName?.trim() ||
    currentUser?.name?.trim() ||
    currentUser?.email ||
    'You'
  const youSub = [
    currentUserProfile?.instruments?.join(', '),
    currentBandId
      ? currentUserRole === 'owner'
        ? 'Owner'
        : currentUserRole === 'admin'
          ? 'Admin'
          : 'Member'
      : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div data-testid="more-page" className="max-w-2xl flex flex-col gap-3">
      <PageTitle
        title="More"
        actions={
          <IconButton
            aria-label={
              resolvedTheme === 'dark' ? 'Switch to light' : 'Switch to dark'
            }
            title="Dark / light"
            onClick={() =>
              setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
            }
            data-testid="more-theme-toggle"
          >
            {resolvedTheme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </IconButton>
        }
      />

      {currentBand ? (
        <section data-testid="more-band-section">
          <p className="px-3 pb-2 font-mono text-[10.5px] font-medium uppercase tracking-[.12em] text-ink-3">
            Band
          </p>
          <div className="rounded-[20px] bg-bg-2 shadow-group overflow-hidden">
            <button
              onClick={() => navigate('/band')}
              data-testid="more-band-card"
              className="w-full flex items-center gap-3.5 p-4 text-left border-b border-divider hover:bg-bg-3/60"
            >
              <BandMark
                name={currentBand.name}
                mark={bandMark}
                size={48}
                data-testid="more-band-mark"
              />
              <span className="flex-1 min-w-0">
                <span className="block text-[18px] font-bold text-ink-1 truncate">
                  {currentBand.name}
                </span>
                <span
                  className="block text-[13px] text-ink-3"
                  data-testid="more-band-sub"
                >
                  {roleName} · {members.length} member
                  {members.length === 1 ? '' : 's'} · since{' '}
                  {currentBand.createdDate.toLocaleDateString(undefined, {
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </span>
            </button>
            <BandRow
              lead={
                <span className="flex w-[52px]">
                  {members.slice(0, 3).map((m, i) => (
                    <span
                      key={m.membership.id}
                      className={`rounded-full ring-2 ring-bg-2 ${i ? '-ml-2.5' : ''}`}
                    >
                      <Avatar
                        size="xs"
                        label={m.profile?.displayName || m.user?.name || '?'}
                      />
                    </span>
                  ))}
                </span>
              }
              title="Members"
              sub="Roles, invite, remove"
              onClick={() => navigate('/band')}
              testid="more-band-members"
            />
            <BandRow
              lead={<Star size={20} className="text-ink-3" />}
              title="Band profile"
              sub="Mark, genres, location, links"
              onClick={() => navigate('/band/profile')}
              testid="more-band-profile"
            />
            {canInvite && (
              <BandRow
                lead={<Share2 size={20} className="text-ink-3" />}
                title="Invite"
                sub={invite?.code ? `Code ${invite.code}` : 'Link, QR and code'}
                onClick={() => navigate('/band?invite')}
                testid="more-band-invite"
              />
            )}
          </div>
        </section>
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
          label="Jam songs"
          icon={Music2}
          onClick={() => navigate('/jam/songs')}
          testid="more-jam-songs"
        />
        <Row
          label="Friends"
          icon={UserPlus}
          badge={friendRequests}
          onClick={() => navigate('/friends')}
          testid="more-friends"
        />
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
