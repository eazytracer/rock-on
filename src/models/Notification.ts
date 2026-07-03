/**
 * Notification models (mobile-redesign-port).
 *
 * Supabase-only tables (notifications, release_notes) — see
 * supabase/migrations/20260702140919_notifications.sql. Not part of the
 * local-first band sync engine.
 */

export type NotificationKind = 'release' | 'activity' | 'event' | 'friend'

/** Named `AppNotification` to avoid colliding with the DOM `Notification` global. */
export interface AppNotification {
  id: string
  userId: string
  kind: NotificationKind
  title: string
  body?: string
  link?: string
  payload: Record<string, unknown>
  readAt?: Date | null
  createdDate: Date
}

export interface ReleaseNote {
  version: string
  title: string
  body: string
  publishedAt: Date
}
