/* eslint-disable @typescript-eslint/no-explicit-any */
import { PracticeSession } from '../models/PracticeSession'
import {
  SessionType,
  SessionStatus,
  SessionSong,
  SessionAttendee,
} from '../types'
import { repository } from './data/RepositoryFactory'
import { getPracticeSessionStatus } from '../utils/dateHelpers'

export interface SessionFilters {
  bandId: string
  startDate?: string
  endDate?: string
  status?: SessionStatus
}

export interface SessionListResponse {
  sessions: PracticeSession[]
  total: number
}

export interface CreateSessionRequest {
  bandId: string
  scheduledDate: string
  duration?: number
  location?: string
  type: SessionType
  songs?: string[]
  invitees?: string[]
  objectives?: string[]
  notes?: string
}

export interface UpdateSessionRequest {
  scheduledDate?: string
  duration?: number
  location?: string
  objectives?: string[]
  notes?: string
  songs?: SessionSong[]
  status?: SessionStatus
  wrapupNotes?: string
}

export interface EndSessionRequest {
  notes?: string
  completedObjectives?: string[]
  sessionRating?: number
}

export interface AddSessionSongRequest {
  songId: string
  notes?: string
}

export interface UpdateSessionSongRequest {
  timeSpent?: number
  status?: 'not-started' | 'in-progress' | 'completed' | 'skipped'
  notes?: string
  sectionsWorked?: string[]
  improvements?: string[]
  needsWork?: string[]
}

export interface AttendanceRequest {
  memberId: string
  attended: boolean
  arrivalTime?: string
  departureTime?: string
}

export class PracticeSessionService {
  static async getSessions(
    filters: SessionFilters
  ): Promise<SessionListResponse> {
    // Get all sessions for the band via repository
    let sessions = await repository.getPracticeSessions(filters.bandId)

    // Reverse for most recent first
    sessions = sessions.reverse()

    // Apply date range filter (client-side)
    if (filters.startDate || filters.endDate) {
      sessions = sessions.filter(session => {
        const sessionDate = session.scheduledDate
        if (filters.startDate && sessionDate < new Date(filters.startDate)) {
          return false
        }
        if (filters.endDate && sessionDate > new Date(filters.endDate)) {
          return false
        }
        return true
      })
    }

    // Apply status filter (client-side)
    if (filters.status) {
      sessions = sessions.filter(
        session => getPracticeSessionStatus(session) === filters.status
      )
    }

    const total = sessions.length

    return {
      sessions,
      total,
    }
  }

  static async getSessionById(
    sessionId: string
  ): Promise<PracticeSession | null> {
    // Use the repository's getPracticeSession method which looks up by ID directly
    return repository.getPracticeSession(sessionId)
  }

  static async startSession(sessionId: string): Promise<PracticeSession> {
    const session = await this.getSessionById(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    const status = getPracticeSessionStatus(session)
    if (status !== 'scheduled') {
      throw new Error('Session cannot be started')
    }

    await repository.updatePracticeSession(sessionId, {
      startTime: new Date(),
    })

    return (await this.getSessionById(sessionId)) as PracticeSession
  }

  static async endSession(
    sessionId: string,
    endData: EndSessionRequest
  ): Promise<PracticeSession> {
    const session = await this.getSessionById(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    if (
      endData.sessionRating &&
      (endData.sessionRating < 1 || endData.sessionRating > 5)
    ) {
      throw new Error('Session rating must be between 1 and 5')
    }

    const updates: Partial<PracticeSession> = {
      endTime: new Date(),
    }

    if (endData.notes !== undefined) {
      updates.notes = endData.notes
    }
    if (endData.completedObjectives) {
      updates.completedObjectives = endData.completedObjectives
    }
    if (endData.sessionRating) {
      updates.sessionRating = endData.sessionRating
    }

    await repository.updatePracticeSession(sessionId, updates)
    return (await this.getSessionById(sessionId)) as PracticeSession
  }

  static async addSongToSession(
    sessionId: string,
    songData: AddSessionSongRequest
  ): Promise<SessionSong> {
    const session = await this.getSessionById(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    const newSessionSong: SessionSong = {
      songId: songData.songId,
      timeSpent: 0,
      status: 'not-started',
      notes: songData.notes,
      sectionsWorked: [],
      improvements: [],
      needsWork: [],
      memberRatings: [],
    }

    const updatedSongs = [...session.songs, newSessionSong]
    await repository.updatePracticeSession(sessionId, { songs: updatedSongs })

    return newSessionSong
  }

  static async updateSessionSong(
    sessionId: string,
    songId: string,
    updateData: UpdateSessionSongRequest
  ): Promise<SessionSong> {
    const session = await this.getSessionById(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    const songIndex = session.songs.findIndex(s => s.songId === songId)
    if (songIndex === -1) {
      throw new Error('Song not found in session')
    }

    if (
      updateData.status &&
      !['not-started', 'in-progress', 'completed', 'skipped'].includes(
        updateData.status
      )
    ) {
      throw new Error('Invalid song status')
    }

    const updatedSongs = [...session.songs]
    const songToUpdate = { ...updatedSongs[songIndex] }

    if (updateData.timeSpent !== undefined) {
      songToUpdate.timeSpent = updateData.timeSpent
    }
    if (updateData.status) {
      songToUpdate.status = updateData.status as any
    }
    if (updateData.notes !== undefined) {
      songToUpdate.notes = updateData.notes
    }
    if (updateData.sectionsWorked) {
      songToUpdate.sectionsWorked = updateData.sectionsWorked
    }
    if (updateData.improvements) {
      songToUpdate.improvements = updateData.improvements
    }
    if (updateData.needsWork) {
      songToUpdate.needsWork = updateData.needsWork
    }

    updatedSongs[songIndex] = songToUpdate
    await repository.updatePracticeSession(sessionId, { songs: updatedSongs })

    return songToUpdate
  }

  static async recordAttendance(
    sessionId: string,
    attendanceData: AttendanceRequest
  ): Promise<SessionAttendee> {
    const session = await this.getSessionById(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    const attendeeIndex = session.attendees.findIndex(
      a => a.memberId === attendanceData.memberId
    )
    const newAttendee: SessionAttendee = {
      memberId: attendanceData.memberId,
      confirmed: true,
      attended: attendanceData.attended,
      arrivalTime: attendanceData.arrivalTime
        ? new Date(attendanceData.arrivalTime)
        : undefined,
      departureTime: attendanceData.departureTime
        ? new Date(attendanceData.departureTime)
        : undefined,
    }

    const updatedAttendees = [...session.attendees]
    if (attendeeIndex >= 0) {
      updatedAttendees[attendeeIndex] = newAttendee
    } else {
      updatedAttendees.push(newAttendee)
    }

    await repository.updatePracticeSession(sessionId, {
      attendees: updatedAttendees,
    })
    return newAttendee
  }
}
