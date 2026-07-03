/**
 * FriendService — friend graph, requests, and code/QR discovery.
 *
 * Supabase-only + RLS. Reads are auto-scoped by RLS; the friendship row is written
 * by a SECURITY DEFINER trigger on accept (see the friends migration), and hidden-user
 * lookup goes through the resolve_friend_code RPC.
 */

import { getSupabaseClient } from './supabase/client'
import { createLogger } from '../utils/logger'
import type {
  FriendSummary,
  FriendRequestSummary,
  MyFriendProfile,
  FriendRequestPolicy,
} from '../models/Friend'

const log = createLogger('FriendService')

async function currentUserId(): Promise<string | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

/** Resolve display names for a set of user ids via user_profiles (RLS-permitting). */
async function namesFor(userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const supabase = getSupabaseClient()
  if (!supabase || userIds.length === 0) return map
  const { data } = await supabase
    .from('user_profiles')
    .select('user_id, display_name')
    .in('user_id', userIds)
  for (const row of (data as unknown as {
    user_id: string
    display_name: string | null
  }[]) ?? []) {
    if (row.display_name) map.set(row.user_id, row.display_name)
  }
  return map
}

export class FriendService {
  /** Accepted friends of the current user. */
  static async getFriends(): Promise<FriendSummary[]> {
    const supabase = getSupabaseClient()
    if (!supabase) return []
    const me = await currentUserId()
    if (!me) return []
    const { data, error } = await supabase
      .from('friendships')
      .select('id, user_a, user_b')
    if (error) {
      log.error('getFriends failed', error)
      return []
    }
    const rows =
      (data as unknown as { id: string; user_a: string; user_b: string }[]) ??
      []
    const others = rows.map(r => (r.user_a === me ? r.user_b : r.user_a))
    const names = await namesFor(others)
    return rows.map(r => {
      const otherId = r.user_a === me ? r.user_b : r.user_a
      return {
        friendshipId: r.id,
        userId: otherId,
        name: names.get(otherId) ?? 'Someone',
      }
    })
  }

  /** Incoming + outgoing pending requests. */
  static async getRequests(): Promise<{
    incoming: FriendRequestSummary[]
    outgoing: FriendRequestSummary[]
  }> {
    const supabase = getSupabaseClient()
    if (!supabase) return { incoming: [], outgoing: [] }
    const me = await currentUserId()
    if (!me) return { incoming: [], outgoing: [] }
    const { data, error } = await supabase
      .from('friend_requests')
      .select('id, requester_id, addressee_id, status, created_date')
      .eq('status', 'pending')
    if (error) {
      log.error('getRequests failed', error)
      return { incoming: [], outgoing: [] }
    }
    const rows =
      (data as unknown as {
        id: string
        requester_id: string
        addressee_id: string
        status: FriendRequestSummary['status']
        created_date: string
      }[]) ?? []
    const others = rows.map(r =>
      r.requester_id === me ? r.addressee_id : r.requester_id
    )
    const names = await namesFor(others)
    const incoming: FriendRequestSummary[] = []
    const outgoing: FriendRequestSummary[] = []
    for (const r of rows) {
      const isIncoming = r.addressee_id === me
      const otherId = isIncoming ? r.requester_id : r.addressee_id
      const item: FriendRequestSummary = {
        id: r.id,
        userId: otherId,
        name: names.get(otherId) ?? 'Someone',
        direction: isIncoming ? 'incoming' : 'outgoing',
        status: r.status,
        createdDate: new Date(r.created_date),
      }
      ;(isIncoming ? incoming : outgoing).push(item)
    }
    return { incoming, outgoing }
  }

  /** The current user's own friend code + discovery settings. */
  static async getMyProfile(): Promise<MyFriendProfile | null> {
    const supabase = getSupabaseClient()
    if (!supabase) return null
    const me = await currentUserId()
    if (!me) return null
    const { data, error } = await supabase
      .from('user_profiles')
      .select('friend_code, discoverable, friend_request_policy')
      .eq('user_id', me)
      .maybeSingle()
    if (error || !data) {
      log.error('getMyProfile failed', error)
      return null
    }
    const row = data as unknown as {
      friend_code: string | null
      discoverable: boolean
      friend_request_policy: FriendRequestPolicy
    }
    return {
      friendCode: row.friend_code ?? '',
      discoverable: row.discoverable,
      policy: row.friend_request_policy,
    }
  }

  static async setDiscoverable(discoverable: boolean): Promise<void> {
    const supabase = getSupabaseClient()
    if (!supabase) return
    const me = await currentUserId()
    if (!me) return
    const { error } = await supabase
      .from('user_profiles')
      .update({ discoverable } as never)
      .eq('user_id', me)
    if (error) log.error('setDiscoverable failed', error)
  }

  /**
   * Send a friend request to whoever owns `code`. Returns the resolved name on
   * success, or an error string.
   */
  static async sendRequestToCode(
    code: string
  ): Promise<{ ok: boolean; name?: string; error?: string }> {
    const supabase = getSupabaseClient()
    if (!supabase) return { ok: false, error: 'Offline' }
    const me = await currentUserId()
    if (!me) return { ok: false, error: 'Not signed in' }
    // rpc is untyped here (no generated DB types) — cast the call.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('resolve_friend_code', {
      p_code: code.trim().toUpperCase(),
    })
    if (error) {
      log.error('resolve_friend_code failed', error)
      return { ok: false, error: 'Lookup failed' }
    }
    const match = (
      data as unknown as {
        user_id: string
        name: string
        display_name: string | null
      }[]
    )?.[0]
    if (!match) return { ok: false, error: 'No one found for that code' }
    if (match.user_id === me)
      return { ok: false, error: "That's your own code" }
    const { error: insErr } = await supabase
      .from('friend_requests')
      .insert({ requester_id: me, addressee_id: match.user_id } as never)
    if (insErr) {
      const dup = (insErr as { code?: string }).code === '23505'
      return {
        ok: false,
        error: dup ? 'Request already exists' : 'Could not send request',
      }
    }
    return { ok: true, name: match.display_name ?? match.name }
  }

  static async acceptRequest(id: string): Promise<void> {
    await FriendService.setRequestStatus(id, 'accepted')
  }
  static async declineRequest(id: string): Promise<void> {
    await FriendService.setRequestStatus(id, 'declined')
  }
  static async cancelRequest(id: string): Promise<void> {
    await FriendService.setRequestStatus(id, 'cancelled')
  }

  private static async setRequestStatus(
    id: string,
    status: string
  ): Promise<void> {
    const supabase = getSupabaseClient()
    if (!supabase) return
    const { error } = await supabase
      .from('friend_requests')
      .update({ status } as never)
      .eq('id', id)
    if (error) log.error(`setRequestStatus(${status}) failed`, error)
  }

  static async unfriend(friendshipId: string): Promise<void> {
    const supabase = getSupabaseClient()
    if (!supabase) return
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId)
    if (error) log.error('unfriend failed', error)
  }
}
