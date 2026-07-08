import React from 'react'
import { Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ContextSwitcher } from './ContextSwitcher'
// PHASE 2: Connection status indicator
import { useSyncStatus } from '../../hooks/useSyncStatus'
import { useUnreadCount } from '../../hooks/useNotifications'

interface MobileHeaderProps {
  bandName?: string
  userEmail?: string
}

export const MobileHeader: React.FC<MobileHeaderProps> = () => {
  const navigate = useNavigate()
  const unreadCount = useUnreadCount()
  // PHASE 2: Get sync status — surfaced as a subtle dot on the bell (design row 00 / m-1),
  // not the old email + "Connected" text block that cluttered a 320px bar.
  const { isOnline } = useSyncStatus()

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-bg-1 border-b border-bg-3 z-30 flex items-center px-4">
      <div className="flex items-center gap-3">
        <ContextSwitcher variant="mobile" />
      </div>

      {/* Quiet header (design row 00): brand + bell only. Unread count = info badge;
          connection = a small danger dot on the bell, shown only when offline. */}
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => navigate('/notifications')}
          className="relative w-10 h-10 flex items-center justify-center rounded-lg text-ink-2 hover:text-ink-1 hover:bg-bg-3 transition-colors"
          aria-label="Notifications"
          data-testid="mobile-header-notifications"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span
              className="absolute top-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-info text-[10px] font-bold text-white"
              data-testid="notifications-unread-badge"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
          {!isOnline && (
            <span
              className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-danger ring-2 ring-bg-1"
              aria-label="Offline"
              data-testid="mobile-header-offline-dot"
            />
          )}
        </button>
      </div>
    </header>
  )
}
