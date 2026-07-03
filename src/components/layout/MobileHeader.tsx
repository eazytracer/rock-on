import React from 'react'
import { Wifi, WifiOff, Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
// PHASE 2: Connection status indicator
import { useSyncStatus } from '../../hooks/useSyncStatus'
import { useUnreadCount } from '../../hooks/useNotifications'

interface MobileHeaderProps {
  bandName?: string
  userEmail?: string
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  bandName = 'iPod Shuffle',
  userEmail = 'eric@example.com',
}) => {
  const navigate = useNavigate()
  const unreadCount = useUnreadCount()
  // PHASE 2: Get sync status for connection indicator
  const { isOnline, isSyncing } = useSyncStatus()

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-[#141414] border-b border-[#1f1f1f] z-30 flex items-center px-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">R</span>
        </div>
        <h1
          className="text-white font-semibold text-base"
          data-testid="sidebar-band-name"
        >
          {bandName}
        </h1>
      </div>

      {/* PHASE 2: User & Connection Status + notifications (Right Side) */}
      <div className="ml-auto flex items-center gap-2">
        <div className="flex flex-col items-end gap-0.5">
          <p className="text-[#a0a0a0] text-xs truncate max-w-[120px]">
            {userEmail}
          </p>
          <div className="flex items-center gap-1.5">
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
        </div>

        <button
          onClick={() => navigate('/notifications')}
          className="relative w-10 h-10 flex items-center justify-center rounded-lg text-ink-2 hover:text-ink-1 hover:bg-[#1f1f1f] transition-colors"
          aria-label="Notifications"
          data-testid="mobile-header-notifications"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span
              className="absolute top-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white"
              data-testid="notifications-unread-badge"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  )
}
