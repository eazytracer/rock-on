import { SessionType, SessionStatus, SessionSong, SessionAttendee } from '../types'

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