/**
 * FriendService — friend graph, requests, and code/QR discovery.
 *
 * Supabase-only + RLS. Reads are auto-scoped by RLS; the friendship row is written
 * by a SECURITY DEFINER trigger on accept (see the friends migration). Sending
 * goes through `send_friend_request`, which enforces the target's request policy
 * (a friend code skips it). Reads and writes throw so screens can show Retry.
 */

import { getSupabaseClient } from './supabase/client'
import { createLogger } from '../utils/logger'
import { findPeople, sendFriendRequest } from './api/friends'
import { ApiError } from './api/errors'
import type {
  FriendSummary,
  FriendRequestSummary,
  MyFriendProfile,
  FriendRequestPolicy,
  FriendSearchResult,
} from '../models/Friend'

const log = createLogger('FriendService')

function client() {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

async function currentUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await client().auth.getUser()
  return user?.id ?? null
}

/**
 * Resolve real names (public.users.name) for a set of connected user ids via the
 * related_names RPC. Reading users.name directly is blocked by RLS for friends /
 * request counterparties, and user_profiles.display_name is never populated — so
 * the SECURITY DEFINER RPC (scoped to the caller's relationships) is the source.
 */
async function namesFor(userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (userIds.length === 0) return map
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client().rpc as any)('related_names', {
    p_ids: userIds,
  })
  if (error) {
    log.error('related_names failed', error)
    return map
  }
  for (const row of (data as unknown as {
    user_id: string
    name: string | null
  }[]) ?? []) {
    if (row.name) map.set(row.user_id, row.name)
  }
  return map
}

interface PersonExtras {
  instruments: string[]
  color: string | null
}

/**
 * Instruments and personal colour for whoever RLS lets us read (friends and
 * findable people). Missing rows just get no extras.
 */
async function profilesFor(
  userIds: string[]
): Promise<Map<string, PersonExtras>> {
  const map = new Map<string, PersonExtras>()
  if (userIds.length === 0) return map
  const { data, error } = await client()
    .from('user_profiles')
    .select('user_id, instruments, personal_color')
    .in('user_id', userIds)
  if (error) {
    log.error('profilesFor failed', error)
    return map
  }
  for (const row of (data as unknown as {
    user_id: string
    instruments: string[] | null
    personal_color: string | null
  }[]) ?? []) {
    map.set(row.user_id, {
      instruments: row.instruments ?? [],
      color: row.personal_color,
    })
  }
  return map
}

const NO_EXTRAS: PersonExtras = { instruments: [], color: null }

/** User copy for each `send_friend_request` error key. */
export function friendRequestErrorCopy(key: string, byCode: boolean): string {
  switch (key) {
    case 'not_found':
      return byCode
        ? 'No one has that code. Check it and try again.'
        : "We couldn't find them."
    case 'cannot_friend_self':
      return byCode ? "That's your own code." : "That's you."
    case 'already_friends':
      return "You're already friends."
    case 'request_pending':
      return 'Request already sent.'
    case 'requests_closed':
      return "They aren't taking requests this way. Ask for their friend code."
    default:
      return "That didn't send. Try again."
  }
}

export type SendResult =
  | { ok: true; name: string; accepted: boolean }
  | { ok: false; key: string; error: string }

export class FriendService {
  /** Accepted friends of the current user. */
  static async getFriends(): Promise<FriendSummary[]> {
    const me = await currentUserId()
    if (!me) return []
    const { data, error } = await client()
      .from('friendships')
      .select('id, user_a, user_b')
    if (error) throw error
    const rows =
      (data as unknown as { id: string; user_a: string; user_b: string }[]) ??
      []
    const others = rows.map(r => (r.user_a === me ? r.user_b : r.user_a))
    const [names, shared, extras] = await Promise.all([
      namesFor(others),
      FriendService.sharedBandCounts(me, others),
      profilesFor(others),
    ])
    return rows
      .map(r => {
        const otherId = r.user_a === me ? r.user_b : r.user_a
        return {
          friendshipId: r.id,
          userId: otherId,
          name: names.get(otherId) ?? 'Someone',
          sharedBands: shared.get(otherId) ?? 0,
          ...(extras.get(otherId) ?? NO_EXTRAS),
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
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
    if (userIds.length === 0) return counts
    const supabase = client()
    const { data: mine } = await supabase
      .from('band_memberships')
      .select('band_id')
      .eq('user_id', me)
      .eq('status', 'active')
    const myBandIds = ((mine as unknown as { band_id: string }[]) ?? []).map(
      r => r.band_id
    )
    if (myBandIds.length === 0) return counts
    const { data } = await supabase
      .from('band_memberships')
      .select('user_id')
      .in('band_id', myBandIds)
      .in('user_id', userIds)
      .eq('status', 'active')
    for (const row of (data as unknown as { user_id: string }[]) ?? []) {
      counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1)
    }
    return counts
  }

  /** Incoming + outgoing pending requests, newest first. */
  static async getRequests(): Promise<{
    incoming: FriendRequestSummary[]
    outgoing: FriendRequestSummary[]
  }> {
    const me = await currentUserId()
    if (!me) return { incoming: [], outgoing: [] }
    const { data, error } = await client()
      .from('friend_requests')
      .select('id, requester_id, addressee_id, status, created_date')
      .eq('status', 'pending')
      .order('created_date', { ascending: false })
    if (error) throw error
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
    const [names, extras] = await Promise.all([
      namesFor(others),
      profilesFor(others),
    ])
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
        ...(extras.get(otherId) ?? NO_EXTRAS),
      }
      ;(isIncoming ? incoming : outgoing).push(item)
    }
    return { incoming, outgoing }
  }

  /**
   * The current user's own friend code + privacy. Creates the profile row /
   * fills a blank code first (ensure_friend_code), so a code always shows.
   */
  static async getMyProfile(): Promise<MyFriendProfile | null> {
    const me = await currentUserId()
    if (!me) return null
    const read = async () => {
      const { data, error } = await client()
        .from('user_profiles')
        .select('friend_code, discoverable, friend_request_policy')
        .eq('user_id', me)
        .maybeSingle()
      if (error) throw error
      return data as unknown as {
        friend_code: string | null
        discoverable: boolean
        friend_request_policy: FriendRequestPolicy
      } | null
    }
    let row = await read()
    if (!row?.friend_code) {
      await FriendService.ensureFriendCode()
      row = await read()
    }
    if (!row) return null
    return {
      friendCode: row.friend_code ?? '',
      discoverable: row.discoverable,
      policy: row.friend_request_policy,
    }
  }

  /**
   * Guarantee the current user has a profile row WITH a friend code, and return
   * it. The ensure_friend_code RPC creates-or-fills it server-side. Idempotent.
   */
  static async ensureFriendCode(): Promise<string | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (client().rpc as any)('ensure_friend_code')
    if (error) {
      log.error('ensure_friend_code failed', error)
      return null
    }
    return (data as string | null) ?? null
  }

  /** Findable by name, and who may send you a request. */
  static async savePrivacy(changes: {
    discoverable?: boolean
    policy?: FriendRequestPolicy
  }): Promise<void> {
    const me = await currentUserId()
    if (!me) throw new Error('Not signed in')
    const row: Record<string, unknown> = {}
    if (changes.discoverable !== undefined)
      row.discoverable = changes.discoverable
    if (changes.policy !== undefined) row.friend_request_policy = changes.policy
    const { error } = await client()
      .from('user_profiles')
      .update(row as never)
      .eq('user_id', me)
    if (error) throw error
  }

  /** Findable people by name (2+ chars), with instruments and mutual friends. */
  static async searchByName(query: string): Promise<FriendSearchResult[]> {
    const q = query.trim()
    if (q.length < 2) return []
    const rows = await findPeople(q)
    return rows
      .filter(r => r.name)
      .map(r => ({
        userId: r.user_id,
        name: r.name as string,
        instruments: r.instruments ?? [],
        color: r.personal_color,
        mutualCount: r.mutual_count ?? 0,
      }))
  }

  /**
   * Send a request by user id (name search) or friend code. If they had
   * already asked you, the server accepts theirs instead (`accepted`).
   */
  static async sendRequest(target: {
    userId?: string
    code?: string
  }): Promise<SendResult> {
    const byCode = !!target.code
    try {
      const row = await sendFriendRequest({
        userId: target.userId,
        // Codes are letters and digits; forgive a pasted space or hyphen.
        code: target.code?.replace(/[^a-z0-9]/gi, '').toUpperCase(),
      })
      const me = await currentUserId()
      const otherId =
        row.requester_id === me ? row.addressee_id : row.requester_id
      const names = await namesFor([otherId])
      return {
        ok: true,
        name: names.get(otherId) ?? 'them',
        accepted: row.status === 'accepted',
      }
    } catch (err) {
      const key = err instanceof ApiError ? err.key : 'unknown'
      if (key === 'unknown') log.error('send_friend_request failed', err)
      return { ok: false, key, error: friendRequestErrorCopy(key, byCode) }
    }
  }

  static async acceptRequest(id: string): Promise<void> {
    // Must be an UPDATE: the BEFORE-UPDATE trigger writes the friendship row
    // when status flips to 'accepted'.
    const { error } = await client()
      .from('friend_requests')
      .update({ status: 'accepted' } as never)
      .eq('id', id)
    if (error) throw error
  }

  // Decline/cancel DELETE the row (not a status flip) so the UNIQUE
  // (requester, addressee) slot is freed.
  static async declineRequest(id: string): Promise<void> {
    await FriendService.deleteRequest(id)
  }
  static async cancelRequest(id: string): Promise<void> {
    await FriendService.deleteRequest(id)
  }

  private static async deleteRequest(id: string): Promise<void> {
    const { error } = await client()
      .from('friend_requests')
      .delete()
      .eq('id', id)
    if (error) throw error
  }

  static async unfriend(friendshipId: string): Promise<void> {
    const { error } = await client()
      .from('friendships')
      .delete()
      .eq('id', friendshipId)
    if (error) throw error
  }
}
