/**
 * Desktop bell popout (Core Navigation 9): unread first, one action (Mark all
 * read), and a way to the full stream.
 */
import React, { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useMarkAllRead,
  useNotificationFeed,
} from '../../hooks/useNotifications'
import { NotificationRow } from './NotificationRow'
import { SkeletonRow } from '../ui/States'

interface NotificationsPopoutProps {
  onClose: () => void
  className?: string
}

export const NotificationsPopout: React.FC<NotificationsPopoutProps> = ({
  onClose,
  className = '',
}) => {
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { data, isLoading } = useNotificationFeed()
  const markAll = useMarkAllRead()
  const items = (data ?? []).slice(0, 8)
  const unread = items.filter(n => !n.is_read).length

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    // Defer so the click that opened it doesn't close it.
    const t = setTimeout(() => document.addEventListener('mousedown', onDown))
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Notifications"
      data-testid="notifications-popout"
      className={`absolute z-[60] w-[380px] rounded-[20px] bg-bg-2 shadow-float ring-1 ring-border-1 overflow-hidden ${className}`}
    >
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <h2 className="font-display font-extrabold uppercase text-2xl leading-none text-ink-1">
          Notifications
        </h2>
        {unread > 0 && (
          <button
            onClick={() => markAll.mutate()}
            data-testid="notifications-mark-all-read"
            className="text-[13px] font-semibold text-ink-2 hover:text-ink-1"
          >
            Mark all read
          </button>
        )}
      </div>
      <div className="max-h-[420px] overflow-y-auto custom-scrollbar-thin">
        {isLoading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink-3">
            Nothing yet. When bandmates add or change things, it shows up here.
          </p>
        ) : (
          items.map(n => (
            <NotificationRow key={n.id} n={n} compact onOpen={onClose} />
          ))
        )}
      </div>
      <button
        onClick={() => {
          onClose()
          navigate('/notifications')
        }}
        data-testid="notifications-see-all"
        className="w-full h-11 border-t border-divider text-[13.5px] font-semibold text-accent-ink hover:bg-bg-3/60"
      >
        See all
      </button>
    </div>
  )
}
