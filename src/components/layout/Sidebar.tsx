import React from 'react'
import {
  Home,
  Calendar,
  CalendarDays,
  ListMusic,
  Ticket,
  Disc3,
  Users,
  UserPlus,
  PartyPopper,
  Settings,
  LogOut,
  Radio,
  Bell,
} from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Eyebrow } from '../common/Eyebrow'
import { ContextSwitcher } from './ContextSwitcher'
import { useAuth } from '../../contexts/AuthContext'
// PHASE 2: Connection status indicator
import { useSyncStatus } from '../../hooks/useSyncStatus'
import { useUnreadCount } from '../../hooks/useNotifications'
import { useIncomingRequestCount } from '../../hooks/useFriends'

interface SidebarProps {
  currentPath: string
  bandName?: string
  userEmail?: string
  onSignOut?: () => void
  onNavigate?: () => void
}

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
  badge?: number
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath,
  userEmail = 'eric@example.com',
  onSignOut,
  onNavigate,
}) => {
  const navigate = useNavigate()
  const location = useLocation()
  const currentFilter =
    new URLSearchParams(location.search).get('filter') || 'all'
  const unreadCount = useUnreadCount()
  const friendRequestCount = useIncomingRequestCount()
  const { currentBandId } = useAuth()

  // Slimmed sync status (m-3): a single status dot in the rail; full detail lives in
  // Settings. pendingCount kept as a compact inline count when there's a backlog.
  const { isOnline, isSyncing, pendingCount } = useSyncStatus()

  // Calendar is the single time axis (spec row 00): Shows · Practices · Events are
  // nested under it and deep-link to the pre-filtered agenda (/calendar?filter=…).
  const primaryItems: NavItem[] = [
    { label: 'Home', path: '/', icon: <Home size={20} /> },
    { label: 'Songs', path: '/songs', icon: <Disc3 size={20} /> },
    { label: 'Setlists', path: '/setlists', icon: <ListMusic size={20} /> },
  ]

  // Nested under Calendar. Each opens the Calendar filtered to that kind; a child
  // is also active on its standalone route (/shows, /practices, /events/:id).
  const calendarChildren: {
    label: string
    filter: string
    route: string
    icon: React.ReactNode
    badge?: number
  }[] = [
    {
      label: 'Shows',
      filter: 'shows',
      route: '/shows',
      icon: <Ticket size={18} />,
    },
    {
      label: 'Practices',
      filter: 'practices',
      route: '/practices',
      icon: <Calendar size={18} />,
    },
    {
      label: 'Events',
      filter: 'events',
      route: '/events',
      icon: <PartyPopper size={18} />,
    },
  ]

  const moreItems: NavItem[] = [
    { label: 'Jam', path: '/jam', icon: <Radio size={20} /> },
    { label: 'Band Members', path: '/band-members', icon: <Users size={20} /> },
    {
      label: 'Friends',
      path: '/friends',
      icon: <UserPlus size={20} />,
      badge: friendRequestCount || undefined,
    },
  ]

  const isActive = (path: string) => {
    if (path === '/') return currentPath === '/'
    if (path === '/calendar') {
      // Parent highlights only for the unfiltered agenda; children own the filters.
      return currentPath.startsWith('/calendar') && currentFilter === 'all'
    }
    return currentPath.startsWith(path)
  }

  const isChildActive = (child: { filter: string; route: string }) =>
    (currentPath.startsWith('/calendar') && currentFilter === child.filter) ||
    currentPath.startsWith(child.route)

  const handleNavigation = (path: string) => {
    navigate(path)
    onNavigate?.()
  }

  const renderNavItem = (item: NavItem) => (
    <button
      key={item.path}
      onClick={() => handleNavigation(item.path)}
      data-testid={`${item.label.toLowerCase().replace(/\s+/g, '-')}-link`}
      className={`
        w-full flex items-center gap-3 px-3 py-2 rounded-lg
        text-sm font-medium transition-colors duration-200
        ${
          isActive(item.path)
            ? 'bg-bg-4 text-white'
            : 'text-ink-3 hover:bg-bg-3 hover:text-white'
        }
      `}
    >
      <span className={isActive(item.path) ? 'text-accent' : ''}>
        {item.icon}
      </span>
      <span className="flex-1 text-left">{item.label}</span>
      {item.badge && (
        <span className="bg-info text-white text-xs font-semibold px-2 py-0.5 rounded-full">
          {item.badge > 9 ? '9+' : item.badge}
        </span>
      )}
    </button>
  )

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-bg-1 border-r border-bg-3 flex flex-col p-6 z-50">
      {/* Brand Header & Connection Status */}
      <div className="pb-3 mb-3 border-b border-bg-3">
        <ContextSwitcher variant="sidebar" />
        <div className="mt-2 min-w-0">
          <p className="text-ink-4 text-xs truncate">{userEmail}</p>
          {!currentBandId && (
            <button
              onClick={() => handleNavigation('/get-started')}
              data-testid="sidebar-create-band"
              className="mt-0.5 text-xs font-semibold text-accent hover:underline"
            >
              Create or join a band →
            </button>
          )}

          {/* Slim connection status (m-3): one status dot + word; backlog inline. */}
          <div
            className="flex items-center gap-1.5 mt-1"
            data-testid="sidebar-sync-status"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isOnline ? 'bg-success' : 'bg-danger'
              } ${isSyncing ? 'animate-pulse' : ''}`}
            />
            <span
              className={`text-xs font-medium ${isOnline ? 'text-success' : 'text-danger'}`}
            >
              {isSyncing ? 'Syncing…' : isOnline ? 'Connected' : 'Offline'}
            </span>
            {pendingCount > 0 && (
              <span className="text-xs text-ink-4">
                · {pendingCount} pending
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar-thin">
        {primaryItems.map(renderNavItem)}

        {/* Calendar (parent) + its nested filtered views */}
        {renderNavItem({
          label: 'Calendar',
          path: '/calendar',
          icon: <CalendarDays size={20} />,
        })}
        <div className="ml-4 space-y-1 border-l border-bg-3 pl-2">
          {calendarChildren.map(child => (
            <button
              key={child.route}
              onClick={() =>
                handleNavigation(`/calendar?filter=${child.filter}`)
              }
              data-testid={`${child.label.toLowerCase()}-link`}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                isChildActive(child)
                  ? 'bg-bg-4 text-white'
                  : 'text-ink-3 hover:bg-bg-3 hover:text-white'
              }`}
            >
              <span className={isChildActive(child) ? 'text-accent' : ''}>
                {child.icon}
              </span>
              <span className="flex-1 text-left">{child.label}</span>
              {child.badge && (
                <span className="bg-info text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                  {child.badge > 9 ? '9+' : child.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* More — mirrors the mobile bottom-nav "More" hub */}
        <Eyebrow className="px-3 pt-4 pb-1.5" data-testid="sidebar-more-label">
          More
        </Eyebrow>
        {moreItems.map(renderNavItem)}
      </nav>

      {/* Bottom Actions */}
      <div className="space-y-1 pt-4 border-t border-bg-3">
        <button
          onClick={() => handleNavigation('/notifications')}
          data-testid="notifications-link"
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
            isActive('/notifications')
              ? 'bg-bg-4 text-white'
              : 'text-ink-3 hover:bg-bg-3 hover:text-white'
          }`}
        >
          <span className="relative">
            <Bell
              size={20}
              className={isActive('/notifications') ? 'text-accent' : ''}
            />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] px-1 flex items-center justify-center rounded-full bg-info text-[9px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </span>
          <span className="flex-1 text-left">Notifications</span>
        </button>
        <button
          onClick={() => handleNavigation('/settings')}
          data-testid="settings-link"
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-ink-3 hover:bg-bg-3 hover:text-white transition-colors duration-200"
        >
          <Settings size={20} />
          <span>Settings</span>
        </button>
        <button
          onClick={onSignOut}
          data-testid="logout-button"
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-ink-3 hover:bg-bg-3 hover:text-white transition-colors duration-200"
        >
          <LogOut size={20} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
