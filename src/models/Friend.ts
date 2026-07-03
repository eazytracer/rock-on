/**
 * Friend models (mobile-redesign-port).
 * Supabase-only tables (friend_requests, friendships) + user_profiles friend fields.
 */

export type FriendRequestPolicy =
  | 'everyone'
  | 'friends_of_friends'
  | 'code_only'
export type FriendRequestStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'cancelled'

export interface FriendSummary {
  friendshipId: string
  userId: string
  name: string
}

export interface FriendRequestSummary {
  id: string
  /** The other party's user id. */
  userId: string
  name: string
  direction: 'incoming' | 'outgoing'
  status: FriendRequestStatus
  createdDate: Date
}

export interface MyFriendProfile {
  friendCode: string
  discoverable: boolean
  policy: FriendRequestPolicy
}
