import React from 'react'
import { Menu, Wifi, WifiOff } from 'lucide-react'
// PHASE 2: Connection status indicator
import { useSyncStatus } from '../../hooks/useSyncStatus'

interface MobileHeaderProps {
  onMenuClick: () => void
  bandName?: string
  userEmail?: string
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  onMenuClick,
  bandName = 'iPod Shuffle',
  userEmail = 'eric@example.com',
}) => {
  // PHASE 2: Get sync status for connection indicator
  const { isOnline, isSyncing } = useSyncStatus()

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-[#141414] border-b border-[#1f1f1f] z-30 flex items-center px-4">
      <button
        onClick={onMenuClick}
        className="w-10 h-10 flex items-center justify-center rounded-lg text-white hover:bg-[#1f1f1f] transition-colors mr-3"
        aria-label="Open menu"
      >
        <Menu size={24} />
      </button>

      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">R</span>
        </div>
        <h1
          className="text-white font-semibold text-base"
          data-testid="sidebar-band-name"
        >
          {bandName}
        </h1>
      </div>

      {/* PHASE 2: User & Connection Status (Right Side) */}
      <div className="ml-auto flex flex-col items-end gap-0.5">
        <p className="text-[#a0a0a0] text-xs truncate max-w-[140px]">
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
    </header>
  )
}
