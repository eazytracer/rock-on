import { CloudCheck, CloudUpload, CloudOff, Clock, Loader2 } from 'lucide-react'

export type SyncStatus = 'synced' | 'syncing' | 'pending' | 'error' | 'unread'

interface SyncIconProps {
  status: SyncStatus
  size?: 'sm' | 'md'
  className?: string
}

/**
 * SyncIcon Component
 *
 * Displays sync status for individual items (songs, setlists, etc.)
 *
 * States:
 * - synced: Green checkmark - item is synchronized
 * - syncing: Blue spinning loader - currently syncing
 * - pending: Yellow clock - waiting to sync
 * - error: Red X - sync failed
 * - unread: Green checkmark with blue badge - synced but has unread updates
 */
export function SyncIcon({ status, size = 'sm', className = '' }: SyncIconProps) {
  const iconSize = size === 'sm' ? 16 : 20

  const getIcon = () => {
    switch (status) {
      case 'synced':
        return (
          <CloudCheck
            data-icon="synced"
            className={`text-green-500 ${className}`}
            width={iconSize}
            height={iconSize}
          >
            <title>Synced</title>
          </CloudCheck>
        )

      case 'syncing':
        return (
          <Loader2
            data-icon="syncing"
            className={`text-blue-500 animate-spin ${className}`}
            width={iconSize}
            height={iconSize}
          >
            <title>Syncing...</title>
          </Loader2>
        )

      case 'pending':
        return (
          <Clock
            data-icon="pending"
            className={`text-yellow-500 ${className}`}
            width={iconSize}
            height={iconSize}
          >
            <title>Pending sync</title>
          </Clock>
        )

      case 'error':
        return (
          <CloudOff
            data-icon="error"
            className={`text-red-500 ${className}`}
            width={iconSize}
            height={iconSize}
          >
            <title>Sync error</title>
          </CloudOff>
        )

      case 'unread':
        return (
          <div className="relative inline-flex">
            <CloudCheck
              className={`text-green-500 ${className}`}
              width={iconSize}
              height={iconSize}
            >
              <title>Synced (unread changes)</title>
            </CloudCheck>
            <div
              data-testid="unread-badge"
              className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-blue-500 ring-1 ring-white"
              aria-label="Has unread updates"
            />
          </div>
        )
    }
  }

  return getIcon()
}
