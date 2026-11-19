/**
 * Friend requests and people search (design/OPERATIONS.md §5). The request
 * policy is enforced server-side; errors: `not_found`, `cannot_friend_self`,
 * `already_friends`, `request_pending`, `requests_closed` (one neutral key for
 * every policy refusal).
 */
import { api } from './client'
import { toApiError } from './errors'
import type { Database } from '../../types/database.types'

export type FriendRequestRow =
  Database['public']['Tables']['friend_requests']['Row']
export type PersonMatch =
  Database['public']['Functions']['find_people']['Returns'][number]

/**
 * By user id, by friend code, or both (a code skips the policy). If they
 * already asked you, their request is accepted and returned.
 */
export async function sendFriendRequest(target: {
  userId?: string
  code?: string
}) {
  const { data, error } = await api().rpc('send_friend_request', {
    p_target_user_id: target.userId,
    p_code: target.code,
  })
  if (error) throw toApiError(error)
  return data as FriendRequestRow
}

/** Findable people by name, with ordered instruments and shared-friend count. */
export async function findPeople(query: string): Promise<PersonMatch[]> {
  const { data, error } = await api().rpc('find_people', { p_query: query })
  if (error) throw toApiError(error)
  return data ?? []
}
