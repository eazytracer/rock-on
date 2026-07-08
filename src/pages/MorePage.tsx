import { useNavigate } from 'react-router-dom'
import {
  Radio,
  Users,
  Settings,
  LogOut,
  PartyPopper,
  UserPlus,
  HelpCircle,
  Disc3,
  ChevronRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useBandMembers } from '../hooks/useBands'
import { Avatar } from '../components/common/Avatar'
import { Eyebrow } from '../components/common/Eyebrow'

const APP_VERSION = '0.3.3'

interface MenuRowProps {
  label: string
  sub?: string
  icon: LucideIcon
  iconClass?: string
  tintClass?: string
  onClick: () => void
  danger?: boolean
  last?: boolean
  testid: string
}

function MenuRow({
  label,
  sub,
  icon: Icon,
  iconClass = 'text-ink-2',
  tintClass = 'bg-bg-3',
  onClick,
  danger,
  last,
  testid,
}: MenuRowProps) {
  return (
    <button
      onClick={onClick}
      data-testid={testid}
      className={`flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-bg-2 ${
        last ? '' : 'border-b border-border-1'
      }`}
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-[10px] ${tintClass}`}
      >
        <Icon size={17} className={iconClass} />
      </span>
      <span className="flex-1 min-w-0">
        <span
          className={`block text-sm font-medium ${danger ? 'text-danger' : 'text-ink-1'}`}
        >
          {label}
        </span>
        {sub && <span className="block text-xs text-ink-4">{sub}</span>}
      </span>
      {!danger && <ChevronRight size={17} className="text-ink-5" />}
    </button>
  )
}

/**
 * More (mobile-redesign-port).
 * The mobile hub for everything outside the 4 primary tabs. Mirrors the design's
 * More screen: band identity card → Account → grouped Features / App sections,
 * with a version footer. Desktop parity lives in the sidebar's "More" group.
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

  const bandName = currentBand?.name ?? 'Your band'
  const tagline = currentBand?.description?.trim()
  const youName =
    currentUserProfile?.displayName?.trim() ||
    currentUser?.name?.trim() ||
    currentUser?.email ||
    'You'
  const roleLabel =
    currentUserRole === 'admin'
      ? 'Band admin'
      : currentUserRole === 'viewer'
        ? 'Viewer'
        : 'Member'

  return (
    <div data-testid="more-page" className="max-w-3xl">
      <h1 className="text-2xl font-bold text-ink-1">More</h1>

      {/* Band identity — or a create/join CTA when the user has no band */}
      {!currentBandId ? (
        <button
          onClick={() => navigate('/get-started')}
          data-testid="more-band-card"
          className="mt-4 w-full rounded-2xl border border-accent/40 bg-gradient-to-br from-accent/15 to-transparent p-4 text-left transition-colors hover:border-accent/60"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-accent">
              <Users size={24} className="text-white" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-lg font-bold text-ink-1">
                Create or join a band
              </span>
              <span className="block text-xs text-ink-3">
                Unlock setlists, shows &amp; practices with your bandmates
              </span>
            </span>
            <ChevronRight size={18} className="text-accent" />
          </div>
        </button>
      ) : (
        <button
          onClick={() => navigate('/band-members')}
          data-testid="more-band-card"
          className="mt-4 w-full rounded-2xl border border-accent/40 bg-gradient-to-br from-accent/15 to-transparent p-4 text-left transition-colors hover:border-accent/60"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-accent">
              <Disc3 size={24} className="text-white" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block truncate text-lg font-bold text-ink-1">
                {bandName}
              </span>
              {tagline && (
                <span className="block truncate text-xs text-ink-3">
                  {tagline}
                </span>
              )}
            </span>
            <ChevronRight size={18} className="text-accent" />
          </div>
          <div className="mt-3.5 flex items-center gap-2.5 border-t border-accent/40 pt-3.5">
            <span className="flex">
              {members.slice(0, 5).map((m, i) => (
                <span
                  key={m.membership.id}
                  className={`rounded-full border-2 border-bg-0 ${i ? '-ml-2' : ''}`}
                >
                  <Avatar
                    size="xs"
                    label={m.profile?.displayName || m.user?.name || '?'}
                  />
                </span>
              ))}
            </span>
            <span className="text-xs font-medium text-ink-2">
              {members.length} {members.length === 1 ? 'member' : 'members'}
            </span>
            <span className="ml-auto text-xs font-semibold text-accent">
              Manage band →
            </span>
          </div>
        </button>
      )}

      {/* Account */}
      <Eyebrow className="mb-2 ml-0.5 mt-5">Account</Eyebrow>
      <div className="overflow-hidden rounded-2xl border border-border-1 bg-bg-1">
        <button
          onClick={() => navigate('/settings')}
          data-testid="more-account"
          className="flex w-full items-center gap-3 p-3.5 text-left transition-colors hover:bg-bg-2"
        >
          <Avatar size="md" label={youName} />
          <span className="flex-1 min-w-0">
            <span className="block truncate text-[15px] font-semibold text-ink-1">
              {youName}
            </span>
            <span className="block text-xs text-ink-4">
              {currentBandId
                ? `${roleLabel} · in ${bandName}`
                : 'Personal account'}
            </span>
          </span>
          <ChevronRight size={17} className="text-ink-5" />
        </button>
      </div>

      {/* Features */}
      <Eyebrow className="mb-2 ml-0.5 mt-5">Features</Eyebrow>
      <div className="overflow-hidden rounded-2xl border border-border-1 bg-bg-1">
        <MenuRow
          label="Jam Sessions"
          sub="Play together, live"
          icon={Radio}
          iconClass="text-accent"
          tintClass="bg-accent/15"
          onClick={() => navigate('/jam')}
          testid="more-jam"
        />
        <MenuRow
          label="Events"
          sub="Host & sign-up lineups"
          icon={PartyPopper}
          onClick={() => navigate('/events')}
          testid="more-events"
        />
        <MenuRow
          label="Friends"
          sub="Find & connect with musicians"
          icon={UserPlus}
          onClick={() => navigate('/friends')}
          testid="more-friends"
        />
        <MenuRow
          label="Band Members"
          sub={`${members.length} ${members.length === 1 ? 'musician' : 'musicians'}`}
          icon={Users}
          onClick={() => navigate('/band-members')}
          last
          testid="more-band"
        />
      </div>

      {/* App */}
      <Eyebrow className="mb-2 ml-0.5 mt-5">App</Eyebrow>
      <div className="overflow-hidden rounded-2xl border border-border-1 bg-bg-1">
        <MenuRow
          label="Settings"
          icon={Settings}
          onClick={() => navigate('/settings')}
          testid="more-settings"
        />
        <MenuRow
          label="Help & feedback"
          icon={HelpCircle}
          onClick={() => showToast('Help & feedback is coming soon', 'info')}
          testid="more-help"
        />
        <MenuRow
          label="Sign out"
          icon={LogOut}
          onClick={signOut}
          danger
          last
          testid="more-sign-out"
        />
      </div>

      <div className="mt-5 text-center font-mono text-[11px] text-ink-5">
        Rock On · v{APP_VERSION}
      </div>
    </div>
  )
}
