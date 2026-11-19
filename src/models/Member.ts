import { MemberRole } from '../types'

export interface Member {
  id: string
  name: string
  email: string
  phone?: string
  instruments: string[]
  role: MemberRole
  joinDate: Date
  isActive: boolean
}

export const MemberSchema = {
  '++id': '',
  name: '',
  email: '',
  phone: '',
  instruments: '',
  role: '',
  joinDate: '',
  isActive: '',
}
