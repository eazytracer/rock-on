/**
 * Notifications (design/OPERATIONS.md §3 list_notifications /
 * mark_notifications_read, §14 list_release_notes).
 */
import { api } from './client'
import { toApiError } from './errors'
import type { Database } from '../../types/database.types'

export type NotificationItem =
  Database['public']['Functions']['list_notifications']['Returns'][number]

export interface ReleaseNoteItem {
  version: string
  title: string
  body: string
  publishedAt: string
}

export async function listNotifications(
  before?: string
): Promise<NotificationItem[]> {
  const { data, error } = await api().rpc('list_notifications', {
    p_before: before,
  })
  if (error) throw toApiError(error)
  return data ?? []
}

/** No ids: mark everything read. */
export async function markNotificationsRead(ids?: string[]): Promise<void> {
  const { error } = await api().rpc('mark_notifications_read', {
    p_ids: ids,
  })
  if (error) throw toApiError(error)
}

export async function listReleaseNotes(): Promise<ReleaseNoteItem[]> {
  const { data, error } = await api()
    .from('release_notes')
    .select('version, title, body, published_at')
    .order('published_at', { ascending: false })
  if (error) throw toApiError(error)
  return (data ?? []).map(r => ({
    version: r.version,
    title: r.title,
    body: r.body,
    publishedAt: r.published_at,
  }))
}
