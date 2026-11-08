import React, { useEffect, useRef, useState } from 'react'
import {
  Home,
  CalendarDays,
  ListMusic,
  Music2,
  Users,
  UserPlus,
  PartyPopper,
  Settings,
  LogOut,
  Bell,
  Search,
  Moon,
  Sun,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ContextSwitcher } from './ContextSwitcher'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { useHasUnread } from '../../hooks/useNotifications'
import { useIncomingRequestCount } from '../../hooks/useFriends'
import { NotificationsPopout } from '../notifications/NotificationsPopout'

interface SidebarProps {
  currentPath: string
  onSignOut?: () => void
  onSearch?: () => void
}

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
  testId: string
  badge?: number
  /** Other route prefixes that light this item. */
  match?: string[]
}

/**
 * Desktop sidebar (design/demo/desktop.css `.sb`): context chip, Search ⌘K,
 * Home · Songs · Setlists · Calendar · Jam, BAND, YOU, and a footer with you,
 * the theme toggle and the bell. Shows / Practices / Events are Calendar
 * filters now, not separate items.
 */
export const Sidebar: React.FC<SidebarProps> = ({
  currentPath,
  onSignOut,
  onSearch,
}) => {
  const navigate = useNavigate()
  const hasUnread = useHasUnread()
  const friendRequestCount = useIncomingRequestCount()
  const { currentBandId, currentUser, currentUserProfile } = useAuth()
  const { resolvedTheme, setTheme } = useTheme()
  const [bellOpen, setBellOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

  const primary: NavItem[] = [
    { label: 'Home', path: '/', icon: <Home />, testId: 'home-link' },
    { label: 'Songs', path: '/songs', icon: <Music2 />, testId: 'songs-link' },
    {
      label: 'Setlists',
      path: '/setlists',
      icon: <ListMusic />,
      testId: 'setlists-link',
    },
    {
      label: 'Calendar',
      path: '/calendar',
      icon: <CalendarDays />,
      testId: 'calendar-link',
      match: ['/shows', '/practices', '/events'],
    },
    { label: 'Jam', path: '/jam', icon: <PartyPopper />, testId: 'jam-link' },
  ]
  const band: NavItem[] = currentBandId
    ? [
        {
          label: 'Members & profile',
          path: '/band-members',
          icon: <Users />,
          testId: 'band-members-link',
        },
      ]
    : []
  const you: NavItem[] = [
    {
      label: 'Friends',
      path: '/friends',
      icon: <UserPlus />,
      testId: 'friends-link',
      badge: friendRequestCount || undefined,
    },
    {
      label: 'Settings',
      path: '/settings',
      icon: <Settings />,
      testId: 'settings-link',
    },
  ]

  const isActive = (item: NavItem) =>
    item.path === '/'
      ? currentPath === '/'
      : [item.path, ...(item.match ?? [])].some(
          p => currentPath === p || currentPath.startsWith(p + '/')
        )

  const renderItem = (item: NavItem) => {
    const on = isActive(item)
    return (
      <button
        key={item.path}
        onClick={() => navigate(item.path)}
        data-testid={item.testId}
        aria-current={on ? 'page' : undefined}
        className={`w-full flex items-center gap-3 h-[42px] px-3 rounded-xl text-[14.5px] font-semibold transition-colors [&>svg]:w-[19px] [&>svg]:h-[19px] ${
          on
            ? 'bg-[color-mix(in_srgb,var(--accent)_16%,var(--bg-2))] text-ink-1 [&>svg]:text-accent-ink'
            : 'text-ink-2 hover:bg-bg-3 hover:text-ink-1 [&>svg]:text-ink-3'
        }`}
      >
        {item.icon}
        <span className="flex-1 text-left truncate">{item.label}</span>
        {item.badge && (
          <span className="rounded-lg bg-accent text-on-accent px-1.5 font-mono text-[10.5px]">
            {item.badge > 9 ? '9+' : item.badge}
          </span>
        )}
      </button>
    )
  }

  const label = (text: string) => (
    <p className="font-mono text-[10px] tracking-[.12em] uppercase text-ink-4 px-3 pt-3.5 pb-1.5">
      {text}
    </p>
  )

  const name = currentUser?.name || currentUserProfile?.displayName || ''
  const instruments = currentUserProfile?.instruments?.join(', ') ?? ''

  return (
    <aside className="fixed left-0 top-0 h-screen w-[248px] bg-bg-2 border-r border-border-1 flex flex-col z-50">
      <div className="px-3 pt-3.5 pb-2">
        <ContextSwitcher variant="sidebar" />
      </div>

      <button
        onClick={onSearch}
        data-testid="sidebar-search"
        className="mx-3 mb-2.5 h-10 rounded-xl bg-bg-3 flex items-center gap-2 px-3 text-sm text-ink-3 hover:text-ink-2"
      >
        <Search size={16} />
        Search
        <kbd className="ml-auto font-mono text-[10.5px] text-ink-4 bg-bg-4 rounded-md px-1.5 py-0.5">
          ⌘K
        </kbd>
      </button>

      <nav className="flex-1 overflow-y-auto custom-scrollbar-thin px-2 py-1 space-y-0.5">
        {primary.map(renderItem)}
        {band.length > 0 && label('Band')}
        {band.map(renderItem)}
        {label('You')}
        {you.map(renderItem)}
      </nav>

      <div className="relative border-t border-border-1 px-3 py-2.5 flex items-center gap-2.5">
        <AccountMenu
          open={accountOpen}
          onOpenChange={setAccountOpen}
          name={name}
          sub={instruments}
          onProfile={() => navigate('/settings')}
          onSignOut={onSignOut}
        />
        <button
          onClick={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')}
          aria-label={
            resolvedTheme === 'light' ? 'Use dark theme' : 'Use light theme'
          }
          data-testid="sidebar-theme-toggle"
          className="w-9 h-9 rounded-full grid place-items-center text-ink-2 hover:bg-bg-3"
        >
          {resolvedTheme === 'light' ? <Moon size={19} /> : <Sun size={19} />}
        </button>
        <button
          onClick={() => setBellOpen(o => !o)}
          aria-label="Notifications"
          aria-expanded={bellOpen}
          data-testid="notifications-link"
          className="relative w-9 h-9 rounded-full grid place-items-center text-ink-2 hover:bg-bg-3"
        >
          <Bell size={19} />
          {hasUnread && (
            <span
              className="absolute top-[7px] right-2 w-2 h-2 rounded-full bg-accent ring-2 ring-bg-2"
              data-testid="notifications-unread-dot"
            />
          )}
        </button>
        {bellOpen && (
          <NotificationsPopout
            onClose={() => setBellOpen(false)}
            className="left-full bottom-2 ml-2"
          />
        )}
      </div>
    </aside>
  )
}

const AccountMenu: React.FC<{
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  sub: string
  onProfile: () => void
  onSignOut?: () => void
}> = ({ open, onOpenChange, name, sub, onProfile, onSignOut }) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        onOpenChange(false)
    }
    const onKey = (e: KeyboardEvent) =>
      e.key === 'Escape' && onOpenChange(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onOpenChange])

  return (
    <div ref={ref} className="flex-1 min-w-0">
      <button
        onClick={() => onOpenChange(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="sidebar-account-button"
        className="w-full flex items-center gap-2.5 min-w-0 rounded-xl text-left"
      >
        <span className="w-[34px] h-[34px] rounded-full bg-bg-4 grid place-items-center font-extrabold text-xs text-ink-1 shrink-0">
          {name.charAt(0).toUpperCase() || '?'}
        </span>
        <span className="min-w-0">
          <span className="block text-[13.5px] font-bold text-ink-1 truncate">
            {name}
          </span>
          {sub && (
            <span className="block text-[11.5px] text-ink-3 truncate">
              {sub}
            </span>
          )}
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-3 right-3 bottom-full mb-2 rounded-2xl bg-bg-2 p-1.5 shadow-float ring-1 ring-border-1 z-50"
        >
          <button
            role="menuitem"
            onClick={() => {
              onOpenChange(false)
              onProfile()
            }}
            data-testid="account-menu-settings"
            className="w-full flex items-center gap-2.5 h-11 px-3 rounded-xl text-sm font-semibold text-ink-1 hover:bg-bg-3"
          >
            <Settings size={18} className="text-ink-3" /> Profile & settings
          </button>
          <button
            role="menuitem"
            onClick={onSignOut}
            data-testid="logout-button"
            className="w-full flex items-center gap-2.5 h-11 px-3 rounded-xl text-sm font-semibold text-ink-1 hover:bg-bg-3"
          >
            <LogOut size={18} className="text-ink-3" /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}
