/**
 * EventHandsService — the guest "raise a hand" signal + host resolve (fork #5).
 *
 * A participant raises a hand to volunteer for a part (a lineup item + a role);
 * the host resolves it (accept → the app also casts them, or decline). Supabase-
 * only + RLS: the event_hands policies let a non-manager touch only their OWN
 * hand ('raised'/'withdrawn'), and only a manager can accept/decline. When the
 * event has auto_approve, a freshly-raised hand lands 'accepted' via a DB trigger.
 */

import { getSupabaseClient } from './supabase/client'
import { createLogger } from '../utils/logger'
import type { RaisedHand, RaisedHandStatus } from '../models/Event'

const log = createLogger('EventHandsService')

async function currentUserId(): Promise<string | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

interface HandRow {
  id: string
  event_lineup_item_id: string
  role_key: string
  user_id: string
  user_name: string | null
  status: RaisedHandStatus
}

function mapHand(r: HandRow): RaisedHand {
  return {
    id: r.id,
    lineupItemId: r.event_lineup_item_id,
    roleKey: r.role_key,
    userId: r.user_id,
    userName: r.user_name?.trim() || 'Guest',
    status: r.status,
  }
}

export class EventHandsService {
  /** All hands for an event (RLS-scoped to participants). */
  static async getHands(eventId: string): Promise<RaisedHand[]> {
    const supabase = getSupabaseClient()
    if (!supabase) return []
    const { data, error } = await supabase
      .from('event_hands')
      .select('id, event_lineup_item_id, role_key, user_id, user_name, status')
      .eq('event_id', eventId)
      .order('created_date', { ascending: true })
    if (error) {
      log.error('getHands failed', error)
      return []
    }
    return ((data as unknown as HandRow[]) ?? []).map(mapHand)
  }

  /** Raise the current user's hand for a part. Blocked by RLS if not allowed. */
  static async raiseHand(input: {
    eventId: string
    lineupItemId: string
    roleKey: string
    userName: string
  }): Promise<{ ok: boolean; error?: string }> {
    const supabase = getSupabaseClient()
    if (!supabase) return { ok: false, error: 'Offline' }
    const me = await currentUserId()
    if (!me) return { ok: false, error: 'Not signed in' }
    const { error } = await supabase.from('event_hands').insert({
      event_id: input.eventId,
      event_lineup_item_id: input.lineupItemId,
      role_key: input.roleKey,
      user_id: me,
      user_name: input.userName,
    } as never)
    if (!error) return { ok: true }
    // A prior hand for this (item, role, user) already exists — e.g. one the host
    // declined, or a legacy 'withdrawn' row from before withdraw started deleting.
    // "Raise again" should just work, so reactivate it instead of failing.
    if ((error as { code?: string }).code === '23505') {
      const { error: upErr } = await supabase
        .from('event_hands')
        .update({
          status: 'raised',
          user_name: input.userName,
          resolved_by: null,
          resolved_date: null,
        } as never)
        .eq('event_lineup_item_id', input.lineupItemId)
        .eq('role_key', input.roleKey)
        .eq('user_id', me)
      if (!upErr) return { ok: true }
      log.error('raiseHand reactivate failed', upErr)
    }
    log.error('raiseHand failed', error)
    return { ok: false, error: 'Could not raise hand' }
  }

  /**
   * Withdraw (retract) the current user's own hand. Deletes the row rather than
   * marking it 'withdrawn' so the unique (item, role, user) slot is freed — a
   * left-behind 'withdrawn' row would block the user from ever raising again.
   */
  static async withdrawHand(handId: string): Promise<void> {
    const supabase = getSupabaseClient()
    if (!supabase) return
    const { error } = await supabase
      .from('event_hands')
      .delete()
      .eq('id', handId)
    if (error) log.error('withdrawHand failed', error)
  }

  /** Host: mark a hand accepted (casting is orchestrated by the caller). */
  static async acceptHand(handId: string): Promise<void> {
    await EventHandsService.setStatus(handId, 'accepted', true)
  }

  /** Host: decline a hand. */
  static async declineHand(handId: string): Promise<void> {
    await EventHandsService.setStatus(handId, 'declined', true)
  }

  private static async setStatus(
    handId: string,
    status: RaisedHandStatus,
    resolve = false
  ): Promise<void> {
    const supabase = getSupabaseClient()
    if (!supabase) return
    const row: Record<string, unknown> = { status }
    if (resolve) {
      row.resolved_by = await currentUserId()
      row.resolved_date = new Date().toISOString()
    }
    const { error } = await supabase
      .from('event_hands')
      .update(row as never)
      .eq('id', handId)
    if (error) log.error(`setStatus(${status}) failed`, error)
  }
}
