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
  /** Count of bands this friend and the current user both belong to. */
  sharedBands: number
  /** Ordered, primary first; empty when their profile isn't readable. */
  instruments: string[]
  /** `user_profiles.personal_color` (hex), when set and readable. */
  color: string | null
}

export interface FriendRequestSummary {
  id: string
  /** The other party's user id. */
  userId: string
  name: string
  direction: 'incoming' | 'outgoing'
  status: FriendRequestStatus
  createdDate: Date
  instruments: string[]
  color: string | null
}

export interface MyFriendProfile {
  friendCode: string
  discoverable: boolean
  policy: FriendRequestPolicy
}

/** A findable person from `find_people`. */
export interface FriendSearchResult {
  userId: string
  name: string
  instruments: string[]
  color: string | null
  /** Friends you share. */
  mutualCount: number
}
