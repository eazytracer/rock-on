export interface BandMembership {
  id: string
  userId: string
  bandId: string
  role: 'admin' | 'member' | 'viewer'
  joinedDate: Date
  status: 'active' | 'pending' | 'inactive'
  permissions: string[]
}

export interface InviteCode {
  id: string
  bandId: string
  code: string
  createdBy: string
  expiresAt?: Date
  maxUses: number
  currentUses: number
  createdDate: Date
}

export const BandMembershipSchema = {
  '++id': '',
  userId: '',
  bandId: '',
  role: '',
  joinedDate: '',
  status: '',
  '*permissions': ''
}

export const InviteCodeSchema = {
  '++id': '',
  bandId: '',
  code: '',
  createdBy: '',
  expiresAt: '',
  maxUses: '',
  currentUses: '',
  createdDate: ''
}
