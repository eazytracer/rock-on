import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import {
  listNotifications,
  listReleaseNotes,
  markNotificationsRead,
  type NotificationItem,
} from '../services/api/notifications'
import { queryKeys } from '../services/queryClient'
import { useRealtimeInvalidate } from './useRealtimeInvalidate'

/**
 * Activity stream (bandmates' changes + friend / event notices), newest first.
 * Bandmates' writes arrive through audit_log realtime, so the feed refreshes
 * when any band content changes.
 */
export function useNotificationFeed() {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  useRealtimeInvalidate({
    events: [
      'songs:changed',
      'setlists:changed',
      'shows:changed',
      'practices:changed',
    ],
    queryKey: queryKeys.notifications.feed(userId),
  })

  return useQuery({
    queryKey: queryKeys.notifications.feed(userId),
    queryFn: () => listNotifications(),
    enabled: !!userId,
    staleTime: 30_000,
  })
}

export function useReleaseNotes() {
  return useQuery({
    queryKey: queryKeys.notifications.releases,
    queryFn: listReleaseNotes,
    staleTime: 5 * 60_000,
  })
}

/** The bell's dot: anything unread in the stream. */
export function useHasUnread(): boolean {
  const { data } = useNotificationFeed()
  return (data ?? []).some(n => !n.is_read)
}

export function useMarkAllRead() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const key = queryKeys.notifications.feed(user?.id ?? '')
  return useMutation({
    mutationFn: () => markNotificationsRead(),
    onMutate: () => {
      queryClient.setQueryData<NotificationItem[]>(key, prev =>
        prev?.map(n => ({ ...n, is_read: true }))
      )
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key })
      void queryClient.invalidateQueries({ queryKey: ['contexts'] })
    },
  })
}
