import { db } from './database'
import { PracticeSession } from '../models/PracticeSession'
import { SessionType, SessionStatus, SessionSong, SessionAttendee } from '../types'
import { castingService } from './CastingService'

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
  static async getSessions(filters: SessionFilters): Promise<SessionListResponse> {
    let query = db.practiceSessions
      .where('bandId')
      .equals(filters.bandId)
      .reverse()

    // Apply date range filter
    if (filters.startDate || filters.endDate) {
      query = query.filter(session => {
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

    // Apply status filter
    if (filters.status) {
      query = query.filter(session => this.getSessionStatus(session) === filters.status)
    }

    const sessions = await query.toArray()
    const total = await db.practiceSessions.where('bandId').equals(filters.bandId).count()

    return {
      sessions,
      total
    }
  }

  static async createSession(sessionData: CreateSessionRequest): Promise<PracticeSession> {
    this.validateSessionData(sessionData)

    const newSession: PracticeSession = {
      id: crypto.randomUUID(),
      bandId: sessionData.bandId,
      scheduledDate: new Date(sessionData.scheduledDate),
      duration: sessionData.duration,
      location: sessionData.location,
      type: sessionData.type,
      status: 'scheduled',
      songs: sessionData.songs?.map(songId => ({
        songId,
        timeSpent: 0,
        status: 'not-started',
        sectionsWorked: [],
        improvements: [],
        needsWork: [],
        memberRatings: []
      })) || [],
      attendees: sessionData.invitees?.map(memberId => ({
        memberId,
        confirmed: false,
        attended: false
      })) || [],
      notes: sessionData.notes,
      objectives: sessionData.objectives || [],
      completedObjectives: []
    }

    await db.practiceSessions.add(newSession)
    return newSession
  }

  static async getSessionById(sessionId: string): Promise<PracticeSession | null> {
    const session = await db.practiceSessions.get(sessionId)
    return session || null
  }

  static async updateSession(sessionId: string, updateData: UpdateSessionRequest): Promise<PracticeSession> {
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

    await db.practiceSessions.update(sessionId, updates)
    return await this.getSessionById(sessionId) as PracticeSession
  }

  static async deleteSession(sessionId: string): Promise<void> {
    const session = await this.getSessionById(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    await db.practiceSessions.delete(sessionId)
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

    await db.practiceSessions.update(sessionId, {
      startTime: new Date()
    })

    return await this.getSessionById(sessionId) as PracticeSession
  }

  static async endSession(sessionId: string, endData: EndSessionRequest): Promise<PracticeSession> {
    const session = await this.getSessionById(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    if (endData.sessionRating && (endData.sessionRating < 1 || endData.sessionRating > 5)) {
      throw new Error('Session rating must be between 1 and 5')
    }

    const updates: Partial<PracticeSession> = {
      endTime: new Date()
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

    await db.practiceSessions.update(sessionId, updates)
    return await this.getSessionById(sessionId) as PracticeSession
  }

  static async addSongToSession(sessionId: string, songData: AddSessionSongRequest): Promise<SessionSong> {
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
      memberRatings: []
    }

    const updatedSongs = [...session.songs, newSessionSong]
    await db.practiceSessions.update(sessionId, { songs: updatedSongs })

    return newSessionSong
  }

  static async updateSessionSong(sessionId: string, songId: string, updateData: UpdateSessionSongRequest): Promise<SessionSong> {
    const session = await this.getSessionById(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    const songIndex = session.songs.findIndex(s => s.songId === songId)
    if (songIndex === -1) {
      throw new Error('Song not found in session')
    }

    if (updateData.status && !['not-started', 'in-progress', 'completed', 'skipped'].includes(updateData.status)) {
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
    await db.practiceSessions.update(sessionId, { songs: updatedSongs })

    return songToUpdate
  }

  static async recordAttendance(sessionId: string, attendanceData: AttendanceRequest): Promise<SessionAttendee> {
    const session = await this.getSessionById(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    const attendeeIndex = session.attendees.findIndex(a => a.memberId === attendanceData.memberId)
    const newAttendee: SessionAttendee = {
      memberId: attendanceData.memberId,
      confirmed: true,
      attended: attendanceData.attended,
      arrivalTime: attendanceData.arrivalTime ? new Date(attendanceData.arrivalTime) : undefined,
      departureTime: attendanceData.departureTime ? new Date(attendanceData.departureTime) : undefined
    }

    let updatedAttendees = [...session.attendees]
    if (attendeeIndex >= 0) {
      updatedAttendees[attendeeIndex] = newAttendee
    } else {
      updatedAttendees.push(newAttendee)
    }

    await db.practiceSessions.update(sessionId, { attendees: updatedAttendees })
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
    if (!['rehearsal', 'writing', 'recording', 'audition', 'lesson'].includes(sessionData.type)) {
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
  static async getSessionCasting(sessionId: string): Promise<{ songId: number; casting: any }[]> {
    const session = await this.getSessionById(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    const castings = await castingService.getCastingsForContext('session', sessionId)

    return castings.map(casting => ({
      songId: casting.songId,
      casting
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
      createdDate: new Date()
    })
  }

  /**
   * Get complete session with casting information
   */
  static async getSessionWithCasting(sessionId: string) {
    const session = await this.getSessionById(sessionId)
    if (!session) return null

    const castings = await castingService.getCastingsForContext('session', sessionId)

    const songsWithCasting = await Promise.all(
      session.songs.map(async (sessionSong) => {
        const song = await db.songs.get(sessionSong.songId)
        const casting = castings.find(c => c.songId === parseInt(sessionSong.songId))

        let completeCasting = null
        if (casting && casting.id) {
          completeCasting = await castingService.getCompleteCasting(casting.id)
        }

        return {
          ...sessionSong,
          song,
          casting: completeCasting
        }
      })
    )

    return {
      ...session,
      songsWithCasting
    }
  }

  /**
   * Get member's assigned roles for a session
   */
  static async getMemberAssignments(sessionId: string, memberId: string) {
    return await castingService.getMemberAssignments(memberId, 'session', sessionId)
  }
}