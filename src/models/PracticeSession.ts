import { SessionType, SessionStatus, SessionSong, SessionAttendee } from '../types'

/**
 * PracticeSession Model
 *
 * Represents rehearsals, writing sessions, recording sessions, etc.
 * NOTE: Shows/gigs are now in the separate Show model (see src/models/Show.ts)
 *
 * Based on: .claude/specifications/proposed-unified-schema-v2.md (lines 250-298)
 */
export interface PracticeSession {
  id: string
  bandId: string
  setlistId?: string         // Associated setlist ID for practices
  scheduledDate: Date
  startTime?: Date
  endTime?: Date
  duration: number           // Planned duration in minutes
  location?: string
  type: SessionType          // 'rehearsal' | 'writing' | 'recording' | 'audition' | 'lesson'
  status: SessionStatus      // 'scheduled' | 'in-progress' | 'completed' | 'cancelled'
  notes?: string
  objectives: string[]       // Practice goals
  completedObjectives: string[]
  sessionRating?: number     // Rating 1-5
  songs: SessionSong[]       // Songs practiced
  attendees: SessionAttendee[]
  createdDate: Date
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