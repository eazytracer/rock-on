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
    const [names, shared] = await Promise.all([
      namesFor(others),
      FriendService.sharedBandCounts(me, others),
    ])
    return rows.map(r => {
      const otherId = r.user_a === me ? r.user_b : r.user_a
      return {
        friendshipId: r.id,
        userId: otherId,
        name: names.get(otherId) ?? 'Someone',
        sharedBands: shared.get(otherId) ?? 0,
      }
    })
  }

  /**
   * How many bands each of `userIds` shares with the current user. RLS lets a
   * member read co-members' memberships for bands they belong to, so we scope
   * the lookup to the current user's own bands.
   */
  private static async sharedBandCounts(
    me: string,
    userIds: string[]
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>()
    const supabase = getSupabaseClient()
    if (!supabase || userIds.length === 0) return counts
    const { data: mine } = await supabase
      .from('band_memberships')
      .select('band_id')
      .eq('user_id', me)
    const myBandIds = ((mine as unknown as { band_id: string }[]) ?? []).map(
      r => r.band_id
    )
    if (myBandIds.length === 0) return counts
    const { data } = await supabase
      .from('band_memberships')
      .select('user_id')
      .in('band_id', myBandIds)
      .in('user_id', userIds)
    for (const row of (data as unknown as { user_id: string }[]) ?? []) {
      counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1)
    }
    return counts
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

  /** Who may send you a friend request (everyone / friends_of_friends / code_only). */
  static async setPolicy(policy: FriendRequestPolicy): Promise<void> {
    const supabase = getSupabaseClient()
    if (!supabase) return
    const me = await currentUserId()
    if (!me) return
    const { error } = await supabase
      .from('user_profiles')
      .update({ friend_request_policy: policy } as never)
      .eq('user_id', me)
    if (error) log.error('setPolicy failed', error)
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
    const insName = match.display_name ?? match.name
    const { error: insErr } = await supabase
      .from('friend_requests')
      .insert({ requester_id: me, addressee_id: match.user_id } as never)
    if (!insErr) return { ok: true, name: insName }
    if ((insErr as { code?: string }).code !== '23505') {
      log.error('sendRequest insert failed', insErr)
      return { ok: false, error: 'Could not send request' }
    }
    // A request row already exists for this exact direction (the UNIQUE
    // requester/addressee pair). If it's a stale declined/cancelled one,
    // reactivate it so the user can re-request; otherwise report its state.
    const { data: existing } = await supabase
      .from('friend_requests')
      .select('id, status')
      .eq('requester_id', me)
      .eq('addressee_id', match.user_id)
      .maybeSingle()
    const row = existing as { id: string; status: string } | null
    if (row && (row.status === 'declined' || row.status === 'cancelled')) {
      const { error: upErr } = await supabase
        .from('friend_requests')
        .update({ status: 'pending', responded_date: null } as never)
        .eq('id', row.id)
      if (!upErr) return { ok: true, name: insName }
      log.error('sendRequest reactivate failed', upErr)
      return { ok: false, error: 'Could not send request' }
    }
    return {
      ok: false,
      error:
        row?.status === 'accepted'
          ? "You're already friends"
          : 'Request already pending',
    }
  }

  static async acceptRequest(id: string): Promise<void> {
    // Must be an UPDATE: the BEFORE-UPDATE trigger writes the friendship row
    // when status flips to 'accepted'.
    const supabase = getSupabaseClient()
    if (!supabase) return
    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'accepted' } as never)
      .eq('id', id)
    if (error) log.error('acceptRequest failed', error)
  }

  // Decline/cancel DELETE the row (not a status flip) so the UNIQUE
  // (requester, addressee) slot is freed — a left-behind 'declined'/'cancelled'
  // row would block either party from ever sending a fresh request again.
  static async declineRequest(id: string): Promise<void> {
    await FriendService.deleteRequest(id)
  }
  static async cancelRequest(id: string): Promise<void> {
    await FriendService.deleteRequest(id)
  }

  private static async deleteRequest(id: string): Promise<void> {
    const supabase = getSupabaseClient()
    if (!supabase) return
    const { error } = await supabase
      .from('friend_requests')
      .delete()
      .eq('id', id)
    if (error) log.error('deleteRequest failed', error)
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
