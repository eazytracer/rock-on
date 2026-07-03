import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { NotificationService } from '../services/NotificationService'
import type { AppNotification, ReleaseNote } from '../models/Notification'

/**
 * Full notification feed + actions (for the Notifications center).
 * Reads are RLS-scoped to the current user by the DB.
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [releaseNotes, setReleaseNotes] = useState<ReleaseNote[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    const [items, notes] = await Promise.all([
      NotificationService.list(),
      NotificationService.getReleaseNotes(),
    ])
    setNotifications(items)
    setReleaseNotes(notes)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const markRead = useCallback(async (id: string) => {
    setNotifications(prev =>
      prev.map(n =>
        n.id === id && !n.readAt ? { ...n, readAt: new Date() } : n
      )
    )
    await NotificationService.markRead(id)
  }, [])

  const markAllRead = useCallback(async () => {
    setNotifications(prev =>
      prev.map(n => (n.readAt ? n : { ...n, readAt: new Date() }))
    )
    await NotificationService.markAllRead()
  }, [])

  const dismiss = useCallback(async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    await NotificationService.dismiss(id)
  }, [])

  const unreadCount = notifications.filter(n => !n.readAt).length

  return {
    notifications,
    releaseNotes,
    unreadCount,
    loading,
    refetch,
    markRead,
    markAllRead,
    dismiss,
  }
}

/**
 * Lightweight unread count for the header bell. Refetches on route change so the
 * badge stays roughly live without a realtime subscription.
 */
export function useUnreadCount(): number {
  const [count, setCount] = useState(0)
  const location = useLocation()

  useEffect(() => {
    let cancelled = false
    NotificationService.unreadCount().then(c => {
      if (!cancelled) setCount(c)
    })
    return () => {
      cancelled = true
    }
  }, [location.pathname])

  return count
}
