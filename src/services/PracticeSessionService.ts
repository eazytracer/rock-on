import { db } from './database'
import { PracticeSession } from '../models/PracticeSession'
import {
  SessionType,
  SessionStatus,
  SessionSong,
  SessionAttendee,
} from '../types'
import { castingService } from './CastingService'
import { repository } from './data/RepositoryFactory'

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
        session => this.getSessionStatus(session) === filters.status
      )
    }

    const total = sessions.length

    return {
      sessions,
      total,
    }
  }

  static async createSession(
    sessionData: CreateSessionRequest
  ): Promise<PracticeSession> {
    this.validateSessionData(sessionData)

    const newSession: PracticeSession = {
      id: crypto.randomUUID(),
      bandId: sessionData.bandId,
      scheduledDate: new Date(sessionData.scheduledDate),
      duration: sessionData.duration || 60,
      location: sessionData.location,
      type: sessionData.type,
      status: 'scheduled',
      createdDate: new Date(),
      songs:
        sessionData.songs?.map(songId => ({
          songId,
          timeSpent: 0,
          status: 'not-started',
          sectionsWorked: [],
          improvements: [],
          needsWork: [],
          memberRatings: [],
        })) || [],
      attendees:
        sessionData.invitees?.map(memberId => ({
          memberId,
          confirmed: false,
          attended: false,
        })) || [],
      notes: sessionData.notes,
      objectives: sessionData.objectives || [],
      completedObjectives: [],
    }

    return await repository.addPracticeSession(newSession)
  }

  static async getSessionById(
    sessionId: string
  ): Promise<PracticeSession | null> {
    // Get all sessions and find the one we need (repository doesn't have getById for sessions)
    const allSessions = await repository.getPracticeSessions('')
    const session = allSessions.find(s => s.id === sessionId)
    return session || null
  }

  static async updateSession(
    sessionId: string,
    updateData: UpdateSessionRequest
  ): Promise<PracticeSession> {
    const existingSession = await this.getSessionById(sessionId)
    if (!existingSession) {
      throw new Error('Session not found')
    }

    const updates: Partial<PracticeSession> = {}
    if (updateData.scheduledDate) {
      updates.scheduledDate = new Date(updateData.scheduledDate)
    }
    if (updateData.duration !== undefined) {
      updates.duration = updateData.duration
    }
    if (updateData.location !== undefined) {
      updates.location = updateData.location
    }
    if (updateData.objectives) {
      updates.objectives = updateData.objectives
    }
    if (updateData.notes !== undefined) {
      updates.notes = updateData.notes
    }

    await repository.updatePracticeSession(sessionId, updates)
    return (await this.getSessionById(sessionId)) as PracticeSession
  }

  static async deleteSession(sessionId: string): Promise<void> {
    const session = await this.getSessionById(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    await repository.deletePracticeSession(sessionId)
  }

  static async startSession(sessionId: string): Promise<PracticeSession> {
    const session = await this.getSessionById(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    const status = this.getSessionStatus(session)
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

  private static validateSessionData(sessionData: CreateSessionRequest): void {
    if (!sessionData.bandId) {
      throw new Error('Band ID is required')
    }
    if (!sessionData.scheduledDate) {
      throw new Error('Scheduled date is required')
    }
    if (!sessionData.type) {
      throw new Error('Session type is required')
    }
    if (
      !['rehearsal', 'writing', 'recording', 'audition', 'lesson'].includes(
        sessionData.type
      )
    ) {
      throw new Error('Invalid session type')
    }
    if (sessionData.duration && sessionData.duration <= 0) {
      throw new Error('Duration must be positive')
    }
  }

  private static getSessionStatus(session: PracticeSession): SessionStatus {
    const now = new Date()
    const scheduledTime = new Date(session.scheduledDate)

    if (session.endTime) {
      return 'completed'
    }
    if (session.startTime) {
      return 'in-progress'
    }
    if (scheduledTime > now) {
      return 'scheduled'
    }
    // Session was scheduled in the past but never started
    return 'cancelled'
  }

  /**
   * Inherit casting from a setlist to a practice session
   */
  static async inheritCastingFromSetlist(
    sessionId: string,
    setlistId: string,
    createdBy: string
  ): Promise<void> {
    await castingService.copyCasting(
      'setlist',
      setlistId,
      'session',
      sessionId,
      createdBy
    )
  }

  /**
   * Get casting for all songs in a practice session
   */
  static async getSessionCasting(
    sessionId: string
  ): Promise<{ songId: number; casting: any }[]> {
    const session = await this.getSessionById(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    const castings = await castingService.getCastingsForContext(
      'session',
      sessionId
    )

    return castings.map(casting => ({
      songId: casting.songId,
      casting,
    }))
  }

  /**
   * Create casting for a song in a practice session
   */
  static async createSongCasting(
    sessionId: string,
    songId: number,
    createdBy: string
  ): Promise<number> {
    const session = await this.getSessionById(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    return await castingService.createCasting({
      contextType: 'session',
      contextId: sessionId,
      songId,
      createdBy,
      createdDate: new Date(),
    })
  }

  /**
   * Get complete session with casting information
   */
  static async getSessionWithCasting(sessionId: string) {
    const session = await this.getSessionById(sessionId)
    if (!session) return null

    const castings = await castingService.getCastingsForContext(
      'session',
      sessionId
    )

    const songsWithCasting = await Promise.all(
      session.songs.map(async sessionSong => {
        const song = await db.songs.get(sessionSong.songId)
        const casting = castings.find(
          c => c.songId === parseInt(sessionSong.songId)
        )

        let completeCasting = null
        if (casting && casting.id) {
          completeCasting = await castingService.getCompleteCasting(casting.id)
        }

        return {
          ...sessionSong,
          song,
          casting: completeCasting,
        }
      })
    )

    return {
      ...session,
      songsWithCasting,
    }
  }

  /**
   * Get member's assigned roles for a session
   */
  static async getMemberAssignments(sessionId: string, memberId: string) {
    return await castingService.getMemberAssignments(
      memberId,
      'session',
      sessionId
    )
  }
}
