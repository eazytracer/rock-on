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
  Wifi,
  WifiOff,
  Radio,
  Bell,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Eyebrow } from '../common/Eyebrow'
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

// PHASE 2: Helper to format relative time
function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath,
  bandName = 'iPod Shuffle',
  userEmail = 'eric@example.com',
  onSignOut,
  onNavigate,
}) => {
  const navigate = useNavigate()
  const unreadCount = useUnreadCount()
  const friendRequestCount = useIncomingRequestCount()

  // PHASE 2: Get sync status for connection indicator
  const { isOnline, isSyncing, pendingCount, lastSyncTime } = useSyncStatus()

  // Mirrors the mobile IA: the first group are the primary tabs (Home · Songs ·
  // Setlists · Calendar) plus the Calendar time-axis detail views (Shows /
  // Practices, reached through Calendar on mobile). The "More" group expands the
  // mobile More hub inline (icons match MorePage for cross-surface consistency).
  const primaryItems: NavItem[] = [
    { label: 'Home', path: '/', icon: <Home size={20} /> },
    { label: 'Songs', path: '/songs', icon: <Disc3 size={20} /> },
    { label: 'Setlists', path: '/setlists', icon: <ListMusic size={20} /> },
    { label: 'Calendar', path: '/calendar', icon: <CalendarDays size={20} /> },
    { label: 'Shows', path: '/shows', icon: <Ticket size={20} /> },
    { label: 'Practices', path: '/practices', icon: <Calendar size={20} /> },
  ]

  const moreItems: NavItem[] = [
    { label: 'Jam', path: '/jam', icon: <Radio size={20} /> },
    { label: 'Band Members', path: '/band-members', icon: <Users size={20} /> },
    { label: 'Events', path: '/events', icon: <PartyPopper size={20} /> },
    {
      label: 'Friends',
      path: '/friends',
      icon: <UserPlus size={20} />,
      badge: friendRequestCount || undefined,
    },
  ]

  const isActive = (path: string) => {
    if (path === '/') return currentPath === '/'
    return currentPath.startsWith(path)
  }

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
            ? 'bg-[#252525] text-white'
            : 'text-[#a0a0a0] hover:bg-[#1f1f1f] hover:text-white'
        }
      `}
    >
      <span className={isActive(item.path) ? 'text-accent' : ''}>
        {item.icon}
      </span>
      <span className="flex-1 text-left">{item.label}</span>
      {item.badge && (
        <span className="bg-blue-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
          {item.badge > 9 ? '9+' : item.badge}
        </span>
      )}
    </button>
  )

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-[#141414] border-r border-[#1f1f1f] flex flex-col p-6 z-50">
      {/* Brand Header & Connection Status */}
      <div className="pb-3 mb-3 border-b border-[#1f1f1f]">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-lg">R</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1
              className="text-white font-semibold text-base leading-tight"
              data-testid="sidebar-band-name"
            >
              {bandName}
            </h1>
            <p className="text-[#707070] text-xs truncate">{userEmail}</p>

            {/* PHASE 2: Connection Status - aligned with text above */}
            <div className="flex items-center gap-1.5 mt-1">
              {isOnline ? (
                <Wifi size={12} className="text-green-500" />
              ) : (
                <WifiOff size={12} className="text-red-500" />
              )}
              <span
                className={`text-xs font-medium ${isOnline ? 'text-green-500' : 'text-red-500'}`}
              >
                {isOnline ? 'Connected' : 'Offline'}
              </span>
              {isSyncing && (
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
              )}
            </div>

            {lastSyncTime && (
              <div className="text-xs text-[#707070] mt-0.5">
                Last synced: {formatRelativeTime(lastSyncTime)}
              </div>
            )}

            {pendingCount > 0 && (
              <div className="mt-1">
                <span className="px-2 py-0.5 text-xs bg-yellow-900/30 text-yellow-400 rounded-full font-medium">
                  {pendingCount} pending
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar-thin">
        {primaryItems.map(renderNavItem)}

        {/* More — mirrors the mobile bottom-nav "More" hub */}
        <Eyebrow className="px-3 pt-4 pb-1.5" data-testid="sidebar-more-label">
          More
        </Eyebrow>
        {moreItems.map(renderNavItem)}
      </nav>

      {/* Bottom Actions */}
      <div className="space-y-1 pt-4 border-t border-[#1f1f1f]">
        <button
          onClick={() => handleNavigation('/notifications')}
          data-testid="notifications-link"
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
            isActive('/notifications')
              ? 'bg-[#252525] text-white'
              : 'text-[#a0a0a0] hover:bg-[#1f1f1f] hover:text-white'
          }`}
        >
          <span className="relative">
            <Bell
              size={20}
              className={isActive('/notifications') ? 'text-accent' : ''}
            />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] px-1 flex items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </span>
          <span className="flex-1 text-left">Notifications</span>
        </button>
        <button
          onClick={() => handleNavigation('/settings')}
          data-testid="settings-link"
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-[#a0a0a0] hover:bg-[#1f1f1f] hover:text-white transition-colors duration-200"
        >
          <Settings size={20} />
          <span>Settings</span>
        </button>
        <button
          onClick={onSignOut}
          data-testid="logout-button"
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-[#a0a0a0] hover:bg-[#1f1f1f] hover:text-white transition-colors duration-200"
        >
          <LogOut size={20} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
