/**
 * Notification display rules (no I/O; ports to Dart line for line).
 */
interface NotificationLike {
  source: string
  actor_name: string | null
  verb: string | null
  object_type: string | null
  object_id: string | null
  object_name: string | null
  link: string | null
}

/** "12m", "1h", "Mon", "Oct 3" */
export function shortTime(iso: string, now: number = Date.now()): string {
  const d = new Date(iso)
  const s = Math.max(0, (now - d.getTime()) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  if (s < 6 * 86400)
    return d.toLocaleDateString(undefined, { weekday: 'short' })
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function notificationTitle(n: NotificationLike): string {
  if (n.source !== 'activity') return n.object_name ?? ''
  const who = (n.actor_name ?? 'Someone').split(' ')[0]
  if (n.verb === 'joined') return `${who} joined ${n.object_name}`
  return `${who} ${n.verb} ${n.object_name}`
}

export function notificationPath(n: NotificationLike): string | null {
  if (n.link) return n.link
  if (n.verb === 'deleted' || !n.object_id) return null
  switch (n.object_type) {
    case 'song':
      return `/songs?song=${n.object_id}`
    case 'setlist':
      return `/setlists/${n.object_id}`
    case 'show':
      return `/shows/${n.object_id}`
    case 'practice':
      return `/practices/${n.object_id}`
    case 'band':
      return '/band-members'
    default:
      return null
  }
}
