/**
 * One notification (Core Navigation 9–11): big mark = the band, small badge =
 * what kind of thing, title "Mike added Hash Pipe", context line, time.
 */
import React from 'react'
import {
  Music2,
  ListMusic,
  Ticket,
  CalendarDays,
  Users,
  UserPlus,
  PartyPopper,
  Bell,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { NotificationItem } from '../../services/api/notifications'
import {
  notificationPath,
  notificationTitle,
  shortTime,
} from '../../domain/notifications'
import { BandMark } from '../ui/BandMark'
import { useAuth } from '../../contexts/AuthContext'
import { useSwitchPrompt } from '../../contexts/SwitchPromptContext'

const TYPE_ICON: Record<string, LucideIcon> = {
  song: Music2,
  setlist: ListMusic,
  show: Ticket,
  practice: CalendarDays,
  band: Users,
  friend: UserPlus,
  event: PartyPopper,
}

const OBJECT_WORD: Record<string, string> = {
  song: 'This song',
  setlist: 'This setlist',
  show: 'This show',
  practice: 'This practice',
}

interface NotificationRowProps {
  n: NotificationItem
  onOpen?: () => void
  compact?: boolean
}

export const NotificationRow: React.FC<NotificationRowProps> = ({
  n,
  onOpen,
  compact = false,
}) => {
  const { currentBandId } = useAuth()
  const { openIn } = useSwitchPrompt()
  const Icon = TYPE_ICON[n.object_type ?? ''] ?? Bell
  const path = notificationPath(n)
  const sub = [
    n.detail,
    n.band_id && n.band_id !== currentBandId ? n.band_name : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const open = () => {
    onOpen?.()
    if (!path) return
    openIn({
      bandId: n.band_id ?? currentBandId,
      name: n.band_name ?? 'Personal',
      path,
      what: OBJECT_WORD[n.object_type ?? ''],
    })
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={!path}
      data-testid={`notification-${n.id}`}
      className={`relative w-full flex items-start gap-3 text-left border-b border-divider last:border-0 disabled:cursor-default ${
        compact ? 'px-3 py-2.5' : 'px-4 py-3'
      } ${path ? 'hover:bg-bg-3/60' : ''}`}
    >
      {!n.is_read && (
        <span
          className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-accent"
          aria-label="Unread"
        />
      )}
      <span className="relative shrink-0">
        {n.band_name ? (
          <BandMark name={n.band_name} size={34} />
        ) : (
          <span className="grid place-items-center w-[34px] h-[34px] rounded-[11px] bg-bg-3 text-ink-2">
            <Icon size={17} />
          </span>
        )}
        {n.band_name && (
          <span className="absolute -right-1.5 -bottom-1.5 grid place-items-center w-[18px] h-[18px] rounded-full bg-bg-4 ring-2 ring-bg-2 text-ink-2">
            <Icon size={11} />
          </span>
        )}
      </span>
      <span className="flex-1 min-w-0">
        <span
          className={`block truncate text-[14.5px] font-bold ${n.is_read ? 'text-ink-2' : 'text-ink-1'}`}
        >
          {notificationTitle(n)}
        </span>
        {sub && (
          <span className="block truncate text-[12.5px] text-ink-3">{sub}</span>
        )}
      </span>
      <span className="shrink-0 font-mono text-[11px] text-ink-3 pt-0.5">
        {shortTime(n.created_at)}
      </span>
    </button>
  )
}
