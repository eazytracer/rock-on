import { SetlistStatus, SetlistSong, SetlistItem } from '../types'

// Re-export SetlistItem for convenience
export type { SetlistItem } from '../types'

export interface Setlist {
  id: string
  name: string
  bandId: string
  /** @deprecated Use showId instead */
  showDate?: Date
  showId?: string  // Version 5: Reference to show (practiceSessions with type='gig')
  sourceSetlistId?: string  // Version 6: Reference to original setlist this was forked from
  /** @deprecated Venue is now on show (practiceSessions.venue) */
  venue?: string
  /** @deprecated Use items instead */
  songs?: SetlistSong[]
  items: SetlistItem[]  // Version 5: Songs, breaks, and sections
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