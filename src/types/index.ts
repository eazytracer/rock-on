export interface SongSection {
  type: 'verse' | 'chorus' | 'bridge' | 'intro' | 'outro' | 'solo' | 'other'
  name?: string
  duration?: number
  chords?: string[]
}

export interface ReferenceLink {
  icon: string // Icon type: 'spotify', 'youtube', 'tabs', 'lyrics', 'drive', 'dropbox', 'soundcloud', 'other'
  url: string
  description?: string
}

export interface SessionAttendee {
  memberId: string
  confirmed: boolean
  attended: boolean
  arrivalTime?: Date
  departureTime?: Date
}

export interface MemberRating {
  memberId: string
  confidence: 1 | 2 | 3 | 4 | 5
  feedback?: string
}

export interface Contact {
  name: string
  role: string
  email?: string
  phone?: string
  notes?: string
}

export interface PaymentInfo {
  amount: number
  currency: string
  status: 'pending' | 'paid' | 'cancelled'
  method?: string
  notes?: string
}

export type MemberRole = 'admin' | 'member' | 'viewer'
export type SessionType =
  | 'rehearsal'
  | 'writing'
  | 'recording'
  | 'audition'
  | 'lesson'
  | 'gig'
export type SessionStatus =
  | 'scheduled'
  | 'in-progress'
  | 'completed'
  | 'cancelled'
export type SongStatus = 'not-started' | 'in-progress' | 'completed' | 'skipped'
export type SetlistStatus = 'draft' | 'active' | 'archived'

export interface BandSettings {
  defaultPracticeTime: number
  reminderMinutes: number[]
  autoSaveInterval: number
}

export interface SessionSong {
  songId: string
  timeSpent: number
  status: SongStatus
  notes?: string
  sectionsWorked: string[]
  improvements: string[]
  needsWork: string[]
  memberRatings: MemberRating[]
}

export interface SetlistSong {
  songId: string
  order: number
  transitionNotes?: string
  keyChange?: string
  tempoChange?: number
  specialInstructions?: string
}

// Version 5: Enhanced setlist items supporting songs, breaks, and sections
export interface SetlistItem {
  id: string
  type: 'song' | 'break' | 'section'
  position: number

  // Song fields (when type='song')
  songId?: string
  notes?: string // Per-song notes in setlist

  // Break fields (when type='break')
  breakDuration?: number // Duration in minutes
  breakNotes?: string // Break description

  // Section fields (when type='section')
  sectionTitle?: string // Section header
}
