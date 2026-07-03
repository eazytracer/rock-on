/**
 * NotificationService — in-app notification feed + release notes.
 *
 * Supabase-only + RLS: every read is auto-scoped to the current auth user
 * (`auth.uid() = user_id`), so we never pass a user id for reads. Rows are
 * minted server-side (INSERT is service_role only), so there is no client
 * `create` here. Mirrors the JamSessionService pattern of talking to the
 * Supabase client directly for non-band-scoped data.
 */

import { getSupabaseClient } from './supabase/client'
import { createLogger } from '../utils/logger'
import type {
  AppNotification,
  NotificationKind,
  ReleaseNote,
} from '../models/Notification'

const log = createLogger('NotificationService')

interface NotificationRow {
  id: string
  user_id: string
  kind: NotificationKind
  title: string
  body: string | null
  link: string | null
  payload: Record<string, unknown> | null
  read_at: string | null
  created_date: string
}

interface ReleaseNoteRow {
  version: string
  title: string
  body: string
  published_at: string
}

function mapNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    title: row.title,
    body: row.body ?? undefined,
    link: row.link ?? undefined,
    payload: row.payload ?? {},
    readAt: row.read_at ? new Date(row.read_at) : null,
    createdDate: new Date(row.created_date),
  }
}

export class NotificationService {
  /** Recent notifications for the current user (RLS-scoped), newest first. */
  static async list(limit = 50): Promise<AppNotification[]> {
    const supabase = getSupabaseClient()
    if (!supabase) return []
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_date', { ascending: false })
      .limit(limit)
    if (error) {
      log.error('list failed', error)
      return []
    }
    return ((data as unknown as NotificationRow[]) ?? []).map(mapNotification)
  }

  /** Count of unread notifications for the current user. */
  static async unreadCount(): Promise<number> {
    const supabase = getSupabaseClient()
    if (!supabase) return 0
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null)
    if (error) {
      log.error('unreadCount failed', error)
      return 0
    }
    return count ?? 0
  }

  /** Mark a single notification read. */
  static async markRead(id: string): Promise<void> {
    const supabase = getSupabaseClient()
    if (!supabase) return
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() } as never)
      .eq('id', id)
      .is('read_at', null)
    if (error) log.error('markRead failed', error)
  }

  /** Mark all of the current user's notifications read. */
  static async markAllRead(): Promise<void> {
    const supabase = getSupabaseClient()
    if (!supabase) return
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() } as never)
      .is('read_at', null)
    if (error) log.error('markAllRead failed', error)
  }

  /** Dismiss (delete) a notification. */
  static async dismiss(id: string): Promise<void> {
    const supabase = getSupabaseClient()
    if (!supabase) return
    const { error } = await supabase.from('notifications').delete().eq('id', id)
    if (error) log.error('dismiss failed', error)
  }

  /** Product release notes, newest first. */
  static async getReleaseNotes(): Promise<ReleaseNote[]> {
    const supabase = getSupabaseClient()
    if (!supabase) return []
    const { data, error } = await supabase
      .from('release_notes')
      .select('*')
      .order('published_at', { ascending: false })
    if (error) {
      log.error('getReleaseNotes failed', error)
      return []
    }
    return ((data as unknown as ReleaseNoteRow[]) ?? []).map(r => ({
      version: r.version,
      title: r.title,
      body: r.body,
      publishedAt: new Date(r.published_at),
    }))
  }
}
