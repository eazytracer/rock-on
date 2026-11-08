import React from 'react'
import { WifiOff } from 'lucide-react'
import { useSyncStatus } from '../../hooks/useSyncStatus'

/**
 * The one offline banner (FP 19). The app is online-only: while the
 * connection is down, changes can't be saved.
 */
export const OfflineBanner: React.FC = () => {
  const { isOnline } = useSyncStatus()
  if (isOnline) return null
  return (
    <div
      role="status"
      data-testid="offline-banner"
      className="mb-4 flex items-center gap-3 rounded-2xl bg-warn/15 px-4 py-3 text-[14px] text-ink-1"
    >
      <WifiOff size={18} className="text-warn shrink-0" />
      <span>
        <b>You're offline.</b> Changes need a connection.
      </span>
    </div>
  )
}
