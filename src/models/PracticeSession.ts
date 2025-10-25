import { SessionType, SessionStatus, SessionSong, SessionAttendee } from '../types'

export interface ShowContact {
  id: string
  name: string
  role?: string
  phone?: string
  email?: string
}

export interface PracticeSession {
  id: string
  bandId: string
  scheduledDate: Date
  startTime?: Date
  endTime?: Date
  duration?: number
  location?: string
  type: SessionType
  status: SessionStatus
  songs: SessionSong[]
  attendees: SessionAttendee[]
  notes?: string
  objectives: string[]
  completedObjectives: string[]
  sessionRating?: number

  // Version 5: Show-specific fields (only used when type='gig')
  name?: string              // Show/event name (e.g., "Toys 4 Tots Benefit")
  venue?: string             // Venue name (e.g., "The Crocodile")
  loadInTime?: string        // Load-in time (format: "6:00 PM" or ISO string)
  soundcheckTime?: string    // Soundcheck time (format: "7:00 PM" or ISO string)
  payment?: number           // Payment amount in cents
  contacts?: ShowContact[]   // Contact information - ALWAYS an array of contact objects
  setlistId?: string         // Associated setlist ID (for shows/gigs)
}

export const PracticeSessionSchema = {
  '++id': '',
  bandId: '',
  scheduledDate: '',
  startTime: '',
  endTime: '',
  duration: '',
  location: '',
  type: '',
  songs: '',
  attendees: '',
  notes: '',
  objectives: '',
  completedObjectives: '',
  sessionRating: ''
}