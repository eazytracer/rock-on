/**
 * SongHiddenService — per-user hide/re-add for the song catalog.
 *
 * Supabase-only + RLS. `song_hidden` is own-rows-only: a user may
 * SELECT/INSERT/DELETE only rows where `user_id = auth.uid()`. Hiding a song
 * inserts a row; re-adding (un-hiding) deletes it. No UPDATE — the table has
 * no mutable state beyond presence/absence of the row.
 */

import { getSupabaseClient } from './supabase/client'
import { createLogger } from '../utils/logger'

const log = createLogger('SongHiddenService')

async function currentUserId(): Promise<string | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

export class SongHiddenService {
  /** song_ids the current user has hidden from their catalog. */
  static async listHidden(): Promise<string[]> {
    const supabase = getSupabaseClient()
    if (!supabase) return []
    const me = await currentUserId()
    if (!me) return []
    const { data, error } = await supabase.from('song_hidden').select('song_id')
    if (error) {
      log.error('listHidden failed', error)
      return []
    }
    return ((data as unknown as { song_id: string }[]) ?? []).map(
      r => r.song_id
    )
  }

  /** Hide a song from the current user's catalog. Idempotent. */
  static async hide(songId: string): Promise<boolean> {
    const supabase = getSupabaseClient()
    if (!supabase) return false
    const me = await currentUserId()
    if (!me) return false
    const { error } = await supabase
      .from('song_hidden')
      .upsert({ user_id: me, song_id: songId } as never, {
        onConflict: 'user_id,song_id',
        ignoreDuplicates: true,
      })
    if (error) {
      log.error('hide failed', error)
      return false
    }
    return true
  }

  /** Re-add a previously hidden song. */
  static async unhide(songId: string): Promise<boolean> {
    const supabase = getSupabaseClient()
    if (!supabase) return false
    const me = await currentUserId()
    if (!me) return false
    const { error } = await supabase
      .from('song_hidden')
      .delete()
      .eq('user_id', me)
      .eq('song_id', songId)
    if (error) {
      log.error('unhide failed', error)
      return false
    }
    return true
  }
}
