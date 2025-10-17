import { SetlistStatus, SetlistSong } from '../types'

export interface Setlist {
  id: string
  name: string
  bandId: string
  showDate?: Date
  venue?: string
  songs: SetlistSong[]
  totalDuration: number
  notes?: string
  status: SetlistStatus
  createdDate: Date
  lastModified: Date
}

export const SetlistSchema = {
  '++id': '',
  name: '',
  bandId: '',
  showDate: '',
  venue: '',
  songs: '',
  totalDuration: '',
  notes: '',
  status: '',
  createdDate: '',
  lastModified: ''
}