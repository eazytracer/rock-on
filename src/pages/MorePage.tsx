import { useNavigate } from 'react-router-dom'
import {
  Radio,
  Users,
  Settings,
  LogOut,
  PartyPopper,
  UserPlus,
  ChevronRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

/**
 * More (mobile-redesign-port).
 * The mobile hub for everything outside the 4 primary tabs. Jam and Band exist today;
 * Events and Friends are net-new (P11/P12) and shown as disabled "coming soon" rows.
 */
export function MorePage() {
  const navigate = useNavigate()
  const { signOut } = useAuth()

  interface Row {
    label: string
    desc: string
    icon: LucideIcon
    path?: string
    soon?: boolean
    testid: string
  }

  const rows: Row[] = [
    {
      label: 'Jam',
      desc: 'Play together, live',
      icon: Radio,
      path: '/jam',
      testid: 'more-jam',
    },
    {
      label: 'Band',
      desc: 'Members & roles',
      icon: Users,
      path: '/band-members',
      testid: 'more-band',
    },
    {
      label: 'Events',
      desc: 'Host & sign-up lineups',
      icon: PartyPopper,
      path: '/events',
      testid: 'more-events',
    },
    {
      label: 'Friends',
      desc: 'Your network',
      icon: UserPlus,
      path: '/friends',
      testid: 'more-friends',
    },
    {
      label: 'Settings',
      desc: 'Account & app',
      icon: Settings,
      path: '/settings',
      testid: 'more-settings',
    },
  ]

  return (
    <div data-testid="more-page">
      <h1 className="text-2xl font-bold text-ink-1">More</h1>

      <div className="mt-5 flex flex-col gap-2">
        {rows.map(({ label, desc, icon: Icon, path, soon, testid }) => (
          <button
            key={label}
            disabled={soon}
            onClick={() => path && navigate(path)}
            data-testid={testid}
            className={`flex items-center gap-3 rounded-xl bg-bg-1 border border-border-1 p-4 text-left transition-colors ${
              soon ? 'opacity-50 cursor-not-allowed' : 'hover:border-border-2'
            }`}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg-3 text-ink-2">
              <Icon size={20} />
            </span>
            <span className="flex-1">
              <span className="block font-semibold text-ink-1">{label}</span>
              <span className="block text-xs text-ink-4">
                {soon ? 'Coming soon' : desc}
              </span>
            </span>
            {!soon && <ChevronRight size={18} className="text-ink-5" />}
          </button>
        ))}

        <button
          onClick={signOut}
          data-testid="more-sign-out"
          className="mt-2 flex items-center gap-3 rounded-xl border border-border-1 p-4 text-left text-ink-3 transition-colors hover:text-ink-1 hover:bg-bg-2"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg-3">
            <LogOut size={18} />
          </span>
          <span className="font-semibold">Sign Out</span>
        </button>
      </div>
    </div>
  )
}
