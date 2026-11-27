import type { User, UserProfile } from './User'

export interface BandMembership {
  id: string
  userId: string
  bandId: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  joinedDate: Date
  status: 'active' | 'pending' | 'inactive'
  permissions: string[]
}

/**
 * Supabase database schema for band_memberships table (snake_case)
 */
export interface BandMembershipRow {
  id: string
  user_id: string
  band_id: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  joined_date: string
  status: 'active' | 'pending' | 'inactive'
  permissions: string[] | null
}

export interface InviteCode {
  id: string
  bandId: string
  code: string
  createdBy: string
  expiresAt?: Date
  maxUses?: number
  currentUses: number
  createdDate: Date
  isActive: boolean
}

/** A band membership joined with the member's user row and profile */
export interface BandMemberWithProfile {
  membership: BandMembership
  user: User | null
  profile: UserProfile | null
}
