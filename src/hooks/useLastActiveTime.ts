import { useState, useEffect, useCallback } from 'react'
import { RemoteRepository } from '../services/data/RemoteRepository'
import { useAuth } from '../contexts/AuthContext'

interface UseLastActiveTimeResult {
  lastActiveAt: Date | undefined
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

/**
 * Hook to get and track a user's last active timestamp
 * Used for multi-device sync optimization and activity awareness
 */
export function useLastActiveTime(userId?: string): UseLastActiveTimeResult {
  const { currentUser } = useAuth()
  const targetUserId = userId || currentUser?.id

  const [lastActiveAt, setLastActiveAt] = useState<Date | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchLastActiveTime = useCallback(async () => {
    if (!targetUserId) {
      setLastActiveAt(undefined)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const remoteRepo = new RemoteRepository()
      const lastActive = await remoteRepo.getUserLastActiveAt(targetUserId)
      setLastActiveAt(lastActive)
    } catch (err) {
      const error =
        err instanceof Error
          ? err
          : new Error('Failed to fetch last active time')
      setError(error)
      console.warn('Failed to fetch last active time:', error)
    } finally {
      setIsLoading(false)
    }
  }, [targetUserId])

  // Fetch on mount and when userId changes
  useEffect(() => {
    fetchLastActiveTime()
  }, [fetchLastActiveTime])

  return {
    lastActiveAt,
    isLoading,
    error,
    refresh: fetchLastActiveTime,
  }
}

/**
 * Format last active time as a human-readable relative string
 * e.g., "Just now", "5 minutes ago", "2 hours ago", "Yesterday", "3 days ago"
 */
export function formatLastActive(lastActiveAt: Date | undefined): string {
  if (!lastActiveAt) return 'Never'

  const now = new Date()
  const diffMs = now.getTime() - lastActiveAt.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) {
    return 'Just now'
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return `${diffDays} days ago`
  } else {
    return lastActiveAt.toLocaleDateString()
  }
}
