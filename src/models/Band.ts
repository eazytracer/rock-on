import { BandSettings } from '../types'

export interface Band {
  id: string
  name: string
  description?: string
  createdDate: Date
  settings: BandSettings
  memberIds: string[]
}

export const BandSchema = {
  '++id': '',
  name: '',
  description: '',
  createdDate: '',
  settings: '',
  memberIds: '',
}
