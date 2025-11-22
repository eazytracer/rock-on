export interface BandMembership {
  id: string
  userId: string
  bandId: string
  role: 'admin' | 'member' | 'viewer'
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
  role: 'admin' | 'member' | 'viewer'
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

export const BandMembershipSchema = {
  '++id': '',
  userId: '',
  bandId: '',
  role: '',
  joinedDate: '',
  status: '',
  '*permissions': '',
}

export const InviteCodeSchema = {
  '++id': '',
  bandId: '',
  code: '',
  createdBy: '',
  expiresAt: '',
  maxUses: '',
  currentUses: '',
  createdDate: '',
}
