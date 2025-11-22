import { useSyncStatus } from '../../hooks/useSyncStatus'
import { LoadingSpinner } from '../common/LoadingSpinner'
import { getRelativeTimeString } from '../../utils/dateHelpers'

/**
 * SyncStatusIndicator Component
 *
 * Displays the current synchronization status with visual indicators.
 * Shows different states: syncing, synced, offline, and error conditions.
 * Provides real-time feedback on pending changes and last sync time.
 */
export function SyncStatusIndicator() {
  const { isSyncing, lastSyncTime, pendingCount, isOnline, syncError } =
    useSyncStatus()

  // Map hook fields to component expectations
  const lastSyncedAt = lastSyncTime
  const pendingChanges = pendingCount
  const error = syncError ? new Error(syncError) : null

  return (
    <div
      className="flex items-center gap-2 text-sm"
      role="status"
      aria-label="Sync status"
    >
      {/* Connection Indicator */}
      <div
        data-testid="connection-indicator"
        className={`h-2 w-2 rounded-full ${
          isOnline ? 'bg-green-500' : 'bg-red-500'
        }`}
        aria-hidden="true"
      />

      {/* Status Text */}
      <div className="flex items-center gap-2">
        {/* Syncing State */}
        {isSyncing && (
          <span className="flex items-center gap-1.5 text-gray-600">
            <LoadingSpinner size="xs" color="secondary" />
            <span>Syncing...</span>
          </span>
        )}

        {/* Error State */}
        {!isSyncing && error && (
          <div className="flex items-center gap-1.5 text-red-600">
            <svg
              data-testid="error-icon"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div className="flex flex-col">
              <span className="font-medium">Sync failed</span>
              <span className="text-xs text-red-500">{error.message}</span>
            </div>
          </div>
        )}

        {/* Offline with Pending Changes */}
        {!isSyncing && !error && !isOnline && pendingChanges > 0 && (
          <div className="flex items-center gap-1.5 text-yellow-600">
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7h6m0 0v6m0-6l-6 6"
              />
            </svg>
            <div className="flex items-center gap-1.5">
              <span>Offline</span>
              <span
                data-testid="pending-badge"
                className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800"
              >
                {pendingChanges} changes pending
              </span>
            </div>
          </div>
        )}

        {/* Offline without Pending Changes */}
        {!isSyncing && !error && !isOnline && pendingChanges === 0 && (
          <div className="flex items-center gap-1.5 text-gray-500">
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
              />
            </svg>
            <span>Offline</span>
          </div>
        )}

        {/* Synced State with Pending Changes */}
        {!isSyncing && !error && isOnline && pendingChanges > 0 && (
          <div className="flex items-center gap-1.5 text-blue-600">
            <span
              data-testid="pending-badge"
              className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
            >
              {pendingChanges} changes pending
            </span>
          </div>
        )}

        {/* Fully Synced State */}
        {!isSyncing &&
          !error &&
          isOnline &&
          pendingChanges === 0 &&
          lastSyncedAt && (
            <div className="flex items-center gap-1.5 text-gray-500">
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>Synced {getRelativeTimeString(lastSyncedAt)}</span>
            </div>
          )}
      </div>
    </div>
  )
}
