import { useState, useEffect } from 'react'

/**
 * OfflineIndicator Component
 *
 * Displays a banner at the top of the screen when the user is offline.
 * Automatically shows/hides based on network connectivity status.
 *
 * Features:
 * - Listens to browser online/offline events
 * - Non-intrusive warning banner
 * - Accessible with ARIA attributes
 * - Auto-dismisses when back online
 */
export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline) return null

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-50 animate-slide-down"
    >
      <div className="bg-amber-50 border-b-2 border-amber-400 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-3">
          {/* Warning Icon */}
          <svg
            className="h-5 w-5 text-amber-600 flex-shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>

          {/* Message */}
          <p className="text-sm font-medium text-amber-900">
            You are offline. Changes will sync when connection is restored.
          </p>
        </div>
      </div>
    </div>
  )
}
