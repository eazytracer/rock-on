import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { IDataRepository } from '../../../src/services/data/IDataRepository'
import type { PracticeSession } from '../../../src/models/PracticeSession'
import type { SessionSong, SessionAttendee } from '../../../src/types'

// Mock the RepositoryFactory module BEFORE importing PracticeSessionService
vi.mock('../../../src/services/data/RepositoryFactory', () => {
  // Create mock functions inside the factory to avoid hoisting issues
  const mockGetPracticeSessions = vi.fn()
  const mockGetPracticeSession = vi.fn()
  const mockAddPracticeSession = vi.fn()
  const mockUpdatePracticeSession = vi.fn()
  const mockDeletePracticeSession = vi.fn()

  const mockRepository = {
    getPracticeSessions: mockGetPracticeSessions,
    getPracticeSession: mockGetPracticeSession,
    addPracticeSession: mockAddPracticeSession,
    updatePracticeSession: mockUpdatePracticeSession,
    deletePracticeSession: mockDeletePracticeSession,
  }

  return {
    repository: mockRepository,
    createRepository: () => mockRepository,
  }
})

// Mock CastingService to avoid dependency issues
vi.mock('../../../src/services/CastingService', () => ({
  castingService: {
    copyCasting: vi.fn(),
    getCastingsForContext: vi.fn(),
    createCasting: vi.fn(),
    getCompleteCasting: vi.fn(),
    getMemberAssignments: vi.fn(),
  },
}))

// Import PracticeSessionService AFTER the mock is set up
import { PracticeSessionService } from '../../../src/services/PracticeSessionService'
// Import the mocked repository to get access to the mock functions
import { repository } from '../../../src/services/data/RepositoryFactory'

// Extract mock functions for test assertions
const mockGetPracticeSessions = repository.getPracticeSessions as ReturnType<
  typeof vi.fn
>
const mockGetPracticeSession = (
  repository as { getPracticeSession: ReturnType<typeof vi.fn> }
).getPracticeSession
const mockAddPracticeSession = repository.addPracticeSession as ReturnType<
  typeof vi.fn
>
const mockUpdatePracticeSession =
  repository.updatePracticeSession as ReturnType<typeof vi.fn>
const mockDeletePracticeSession =
  repository.deletePracticeSession as ReturnType<typeof vi.fn>

describe('PracticeSessionService - Migrated to Repository Pattern', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks()
  })

  describe('getSessions', () => {
    it('should get all sessions for a band via repository', async () => {
      // Arrange
      const mockSessions: PracticeSession[] = [
        {
          id: 'session-1',
          bandId: 'band-1',
          scheduledDate: new Date('2025-10-26'),
          type: 'rehearsal',
          status: 'scheduled',
          songs: [],
          attendees: [],
          objectives: [],
          completedObjectives: [],
        },
        {
          id: 'session-2',
          bandId: 'band-1',
          scheduledDate: new Date('2025-10-27'),
          type: 'rehearsal',
          status: 'scheduled',
          songs: [],
          attendees: [],
          objectives: [],
          completedObjectives: [],
        },
      ]

      mockGetPracticeSessions.mockResolvedValue(mockSessions)

      // Act
      const result = await PracticeSessionService.getSessions({
        bandId: 'band-1',
      })

      // Assert
      expect(mockGetPracticeSessions).toHaveBeenCalledWith('band-1')
      expect(result.sessions).toEqual(mockSessions.reverse()) // Reversed order
      expect(result.total).toBe(2)
    })

    it('should filter sessions by date range', async () => {
      // Arrange
      const mockSessions: PracticeSession[] = [
        {
          id: 'session-1',
          bandId: 'band-1',
          scheduledDate: new Date('2025-10-25'),
          type: 'rehearsal',
          status: 'scheduled',
          songs: [],
          attendees: [],
          objectives: [],
          completedObjectives: [],
        },
        {
          id: 'session-2',
          bandId: 'band-1',
          scheduledDate: new Date('2025-10-27'),
          type: 'rehearsal',
          status: 'scheduled',
          songs: [],
          attendees: [],
          objectives: [],
          completedObjectives: [],
        },
        {
          id: 'session-3',
          bandId: 'band-1',
          scheduledDate: new Date('2025-10-30'),
          type: 'rehearsal',
          status: 'scheduled',
          songs: [],
          attendees: [],
          objectives: [],
          completedObjectives: [],
        },
      ]

      mockGetPracticeSessions.mockResolvedValue(mockSessions)

      // Act
      const result = await PracticeSessionService.getSessions({
        bandId: 'band-1',
        startDate: '2025-10-26',
        endDate: '2025-10-28',
      })

      // Assert
      expect(result.sessions).toHaveLength(1)
      expect(result.sessions[0].id).toBe('session-2')
    })

    it('should filter sessions by status', async () => {
      // Arrange
      const now = new Date()
      const future = new Date(now.getTime() + 86400000) // 1 day ahead
      const past = new Date(now.getTime() - 86400000) // 1 day ago

      const mockSessions: PracticeSession[] = [
        {
          id: 'session-1',
          bandId: 'band-1',
          scheduledDate: future,
          type: 'rehearsal',
          status: 'scheduled',
          songs: [],
          attendees: [],
          objectives: [],
          completedObjectives: [],
        },
        {
          id: 'session-2',
          bandId: 'band-1',
          scheduledDate: past,
          startTime: past,
          endTime: past,
          type: 'rehearsal',
          status: 'scheduled',
          songs: [],
          attendees: [],
          objectives: [],
          completedObjectives: [],
        },
      ]

      mockGetPracticeSessions.mockResolvedValue(mockSessions)

      // Act
      const result = await PracticeSessionService.getSessions({
        bandId: 'band-1',
        status: 'completed',
      })

      // Assert
      // Should filter to sessions with endTime set (completed status)
      expect(result.sessions).toHaveLength(1)
      expect(result.sessions[0].id).toBe('session-2')
    })

    it('keeps a practice scheduled while inside its window (start passed, end not)', async () => {
      // BUG FIX: categorize on effective end (start + duration), not start.
      const now = new Date()
      const startedAgo = new Date(now.getTime() - 30 * 60 * 1000) // 30 min ago

      const inWindow: PracticeSession = {
        id: 'in-window',
        bandId: 'band-1',
        scheduledDate: startedAgo,
        duration: 120, // ends 90 min from now → still upcoming
        type: 'rehearsal',
        status: 'scheduled',
        songs: [],
        attendees: [],
        objectives: [],
        completedObjectives: [],
        createdDate: new Date(),
      }

      mockGetPracticeSessions.mockResolvedValue([inWindow])

      // Its computed status is still 'scheduled' (not 'cancelled'), so it
      // survives a scheduled-status filter even though its start is in the past.
      const result = await PracticeSessionService.getSessions({
        bandId: 'band-1',
        status: 'scheduled',
      })

      expect(result.sessions).toHaveLength(1)
      expect(result.sessions[0].id).toBe('in-window')
    })

    it('marks a past, never-started practice completed (NOT cancelled) — cancelled is user-set only', async () => {
      const now = new Date()
      const longAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000) // 5h ago

      const expired: PracticeSession = {
        id: 'expired',
        bandId: 'band-1',
        scheduledDate: longAgo,
        duration: 60, // ended 4h ago
        type: 'rehearsal',
        status: 'scheduled',
        songs: [],
        attendees: [],
        objectives: [],
        completedObjectives: [],
        createdDate: new Date(),
      }

      mockGetPracticeSessions.mockResolvedValue([expired])

      // It should be 'completed', never auto-'cancelled'.
      const asCompleted = await PracticeSessionService.getSessions({
        bandId: 'band-1',
        status: 'completed',
      })
      expect(asCompleted.sessions).toHaveLength(1)
      expect(asCompleted.sessions[0].id).toBe('expired')

      // And it must NOT be derived as cancelled.
      mockGetPracticeSessions.mockResolvedValue([expired])
      const asCancelled = await PracticeSessionService.getSessions({
        bandId: 'band-1',
        status: 'cancelled',
      })
      expect(asCancelled.sessions).toHaveLength(0)
    })

    it('honors an explicitly user-set cancelled status', async () => {
      const now = new Date()
      const future = new Date(now.getTime() + 86400000)

      const userCancelled: PracticeSession = {
        id: 'user-cancelled',
        bandId: 'band-1',
        scheduledDate: future,
        duration: 60,
        type: 'rehearsal',
        status: 'cancelled', // deliberately set by a user
        songs: [],
        attendees: [],
        objectives: [],
        completedObjectives: [],
        createdDate: new Date(),
      }

      mockGetPracticeSessions.mockResolvedValue([userCancelled])

      const result = await PracticeSessionService.getSessions({
        bandId: 'band-1',
        status: 'cancelled',
      })

      expect(result.sessions).toHaveLength(1)
      expect(result.sessions[0].id).toBe('user-cancelled')
    })
  })

  describe('createSession', () => {
    it('should create a new session via repository', async () => {
      // Arrange
      const mockCreatedSession: PracticeSession = {
        id: 'new-session',
        bandId: 'band-1',
        scheduledDate: new Date('2025-10-28'),
        duration: 120,
        location: 'Studio A',
        type: 'rehearsal',
        status: 'scheduled',
        songs: [],
        attendees: [],
        notes: 'Test session',
        objectives: ['Learn new song'],
        completedObjectives: [],
      }

      mockAddPracticeSession.mockResolvedValue(mockCreatedSession)

      // Act
      const result = await PracticeSessionService.createSession({
        bandId: 'band-1',
        scheduledDate: '2025-10-28',
        duration: 120,
        location: 'Studio A',
        type: 'rehearsal',
        objectives: ['Learn new song'],
        notes: 'Test session',
      })

      // Assert
      expect(mockAddPracticeSession).toHaveBeenCalledTimes(1)
      expect(mockAddPracticeSession).toHaveBeenCalledWith(
        expect.objectContaining({
          bandId: 'band-1',
          type: 'rehearsal',
          status: 'scheduled',
        })
      )
      expect(result).toEqual(mockCreatedSession)
    })

    it('should throw error for missing band ID', async () => {
      // Act & Assert
      await expect(
        PracticeSessionService.createSession({
          bandId: '',
          scheduledDate: '2025-10-28',
          type: 'rehearsal',
        })
      ).rejects.toThrow('Band ID is required')
    })

    it('should throw error for missing scheduled date', async () => {
      // Act & Assert
      await expect(
        PracticeSessionService.createSession({
          bandId: 'band-1',
          scheduledDate: '',
          type: 'rehearsal',
        })
      ).rejects.toThrow('Scheduled date is required')
    })

    it('should throw error for invalid session type', async () => {
      // Act & Assert
      await expect(
        PracticeSessionService.createSession({
          bandId: 'band-1',
          scheduledDate: '2025-10-28',
          type: 'invalid' as any,
        })
      ).rejects.toThrow('Invalid session type')
    })

    it('should throw error for invalid duration', async () => {
      // Act & Assert
      await expect(
        PracticeSessionService.createSession({
          bandId: 'band-1',
          scheduledDate: '2025-10-28',
          type: 'rehearsal',
          duration: -10,
        })
      ).rejects.toThrow('Duration must be positive')
    })

    it('should create session with songs and invitees', async () => {
      // Arrange
      const mockCreatedSession: PracticeSession = {
        id: 'new-session',
        bandId: 'band-1',
        scheduledDate: new Date('2025-10-28'),
        type: 'rehearsal',
        status: 'scheduled',
        songs: [
          {
            songId: 'song-1',
            timeSpent: 0,
            status: 'not-started',
            sectionsWorked: [],
            improvements: [],
            needsWork: [],
            memberRatings: [],
          },
        ],
        attendees: [
          {
            memberId: 'member-1',
            confirmed: false,
            attended: false,
          },
        ],
        objectives: [],
        completedObjectives: [],
      }

      mockAddPracticeSession.mockResolvedValue(mockCreatedSession)

      // Act
      const result = await PracticeSessionService.createSession({
        bandId: 'band-1',
        scheduledDate: '2025-10-28',
        type: 'rehearsal',
        songs: ['song-1'],
        invitees: ['member-1'],
      })

      // Assert
      expect(result.songs).toHaveLength(1)
      expect(result.attendees).toHaveLength(1)
    })
  })

  describe('duplicateSession', () => {
    const buildSource = (): PracticeSession => ({
      id: 'source-1',
      bandId: 'band-1',
      setlistId: 'setlist-1',
      scheduledDate: new Date('2025-10-28T18:00:00'),
      startTime: new Date('2025-10-28T18:05:00'),
      endTime: new Date('2025-10-28T20:00:00'),
      duration: 120,
      location: 'Studio A',
      type: 'rehearsal',
      status: 'completed',
      songs: [
        {
          songId: 'song-1',
          timeSpent: 3600,
          status: 'completed',
          sectionsWorked: ['verse'],
          improvements: ['tighter'],
          needsWork: ['bridge'],
          memberRatings: [],
        },
      ],
      attendees: [{ memberId: 'member-1', confirmed: true, attended: true }],
      notes: 'Focus on the bridge',
      wrapupNotes: 'Went well',
      objectives: ['Nail the bridge'],
      completedObjectives: ['Nail the bridge'],
      sessionRating: 5,
      createdDate: new Date('2025-10-01'),
      version: 3,
      lastModifiedBy: 'user-9',
    })

    it('copies template content but resets session-specific fields', async () => {
      mockGetPracticeSession.mockResolvedValue(buildSource())
      mockAddPracticeSession.mockImplementation((s: PracticeSession) =>
        Promise.resolve(s)
      )

      const result = await PracticeSessionService.duplicateSession('source-1')

      // Template content copied
      expect(result.bandId).toBe('band-1')
      expect(result.setlistId).toBe('setlist-1')
      expect(result.duration).toBe(120)
      expect(result.location).toBe('Studio A')
      expect(result.type).toBe('rehearsal')
      expect(result.notes).toBe('Focus on the bridge')
      expect(result.objectives).toEqual(['Nail the bridge'])

      // Fresh identity + planned status
      expect(result.id).not.toBe('source-1')
      expect(result.status).toBe('scheduled')
      expect(result.startTime).toBeUndefined()
      expect(result.endTime).toBeUndefined()
      expect(result.wrapupNotes).toBeUndefined()
      expect(result.sessionRating).toBeUndefined()
      expect(result.completedObjectives).toEqual([])
      expect(result.version).toBeUndefined()
      expect(result.lastModifiedBy).toBeUndefined()

      // Song references copied, progress reset
      expect(result.songs).toHaveLength(1)
      expect(result.songs[0].songId).toBe('song-1')
      expect(result.songs[0].timeSpent).toBe(0)
      expect(result.songs[0].status).toBe('not-started')
      expect(result.songs[0].needsWork).toEqual([])

      // Attendees copied, confirmation/attendance reset
      expect(result.attendees).toHaveLength(1)
      expect(result.attendees[0].memberId).toBe('member-1')
      expect(result.attendees[0].confirmed).toBe(false)
      expect(result.attendees[0].attended).toBe(false)

      expect(mockAddPracticeSession).toHaveBeenCalledTimes(1)
    })

    it('defaults scheduledDate to one week after the source', async () => {
      mockGetPracticeSession.mockResolvedValue(buildSource())
      mockAddPracticeSession.mockImplementation((s: PracticeSession) =>
        Promise.resolve(s)
      )

      const result = await PracticeSessionService.duplicateSession('source-1')

      const expected =
        new Date('2025-10-28T18:00:00').getTime() + 7 * 24 * 60 * 60 * 1000
      expect(new Date(result.scheduledDate).getTime()).toBe(expected)
    })

    it('lets an overridden scheduledDate win', async () => {
      mockGetPracticeSession.mockResolvedValue(buildSource())
      mockAddPracticeSession.mockImplementation((s: PracticeSession) =>
        Promise.resolve(s)
      )

      const chosen = new Date('2025-12-01T19:00:00')
      const result = await PracticeSessionService.duplicateSession('source-1', {
        scheduledDate: chosen,
      })

      expect(new Date(result.scheduledDate).getTime()).toBe(chosen.getTime())
    })

    it('throws when the source session does not exist', async () => {
      mockGetPracticeSession.mockResolvedValue(null)

      await expect(
        PracticeSessionService.duplicateSession('missing')
      ).rejects.toThrow('Session not found')
    })
  })

  describe('getSessionById', () => {
    it('should get session by id via repository', async () => {
      // Arrange
      const mockSession: PracticeSession = {
        id: 'session-123',
        bandId: 'band-1',
        scheduledDate: new Date('2025-10-28'),
        type: 'rehearsal',
        status: 'scheduled',
        songs: [],
        attendees: [],
        objectives: [],
        completedObjectives: [],
      }

      mockGetPracticeSession.mockResolvedValue(mockSession)

      // Act
      const result = await PracticeSessionService.getSessionById('session-123')

      // Assert
      expect(mockGetPracticeSession).toHaveBeenCalledWith('session-123')
      expect(result).toEqual(mockSession)
    })

    it('should return null for non-existent session', async () => {
      // Arrange
      mockGetPracticeSession.mockResolvedValue(null)

      // Act
      const result = await PracticeSessionService.getSessionById('non-existent')

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('updateSession', () => {
    it('should update session via repository', async () => {
      // Arrange
      const existingSession: PracticeSession = {
        id: 'session-123',
        bandId: 'band-1',
        scheduledDate: new Date('2025-10-28'),
        location: 'Studio A',
        type: 'rehearsal',
        status: 'scheduled',
        songs: [],
        attendees: [],
        objectives: [],
        completedObjectives: [],
      }

      const updatedSession: PracticeSession = {
        ...existingSession,
        location: 'Studio B',
      }

      // First call returns existing session, second call returns updated session
      mockGetPracticeSession
        .mockResolvedValueOnce(existingSession)
        .mockResolvedValueOnce(updatedSession)
      mockUpdatePracticeSession.mockResolvedValue(updatedSession)

      // Act
      const result = await PracticeSessionService.updateSession('session-123', {
        location: 'Studio B',
      })

      // Assert
      expect(mockUpdatePracticeSession).toHaveBeenCalledWith('session-123', {
        location: 'Studio B',
      })
      expect(result.location).toBe('Studio B')
    })

    it('should throw error when updating non-existent session', async () => {
      // Arrange
      mockGetPracticeSession.mockResolvedValue(null)

      // Act & Assert
      await expect(
        PracticeSessionService.updateSession('non-existent', {
          location: 'Studio B',
        })
      ).rejects.toThrow('Session not found')
    })
  })

  describe('deleteSession', () => {
    it('should delete session via repository', async () => {
      // Arrange
      const existingSession: PracticeSession = {
        id: 'session-123',
        bandId: 'band-1',
        scheduledDate: new Date('2025-10-28'),
        type: 'rehearsal',
        status: 'scheduled',
        songs: [],
        attendees: [],
        objectives: [],
        completedObjectives: [],
      }

      mockGetPracticeSession.mockResolvedValue(existingSession)
      mockDeletePracticeSession.mockResolvedValue(undefined)

      // Act
      await PracticeSessionService.deleteSession('session-123')

      // Assert
      expect(mockDeletePracticeSession).toHaveBeenCalledWith('session-123')
    })

    it('should throw error when deleting non-existent session', async () => {
      // Arrange
      mockGetPracticeSession.mockResolvedValue(null)

      // Act & Assert
      await expect(
        PracticeSessionService.deleteSession('non-existent')
      ).rejects.toThrow('Session not found')
    })
  })

  describe('startSession', () => {
    it('should start a scheduled session via repository', async () => {
      // Arrange
      const futureDate = new Date(Date.now() + 86400000) // 1 day ahead
      const existingSession: PracticeSession = {
        id: 'session-123',
        bandId: 'band-1',
        scheduledDate: futureDate,
        type: 'rehearsal',
        status: 'scheduled',
        songs: [],
        attendees: [],
        objectives: [],
        completedObjectives: [],
      }

      const startedSession: PracticeSession = {
        ...existingSession,
        startTime: new Date(),
      }

      // First call returns existing session, second call returns started session
      mockGetPracticeSession
        .mockResolvedValueOnce(existingSession)
        .mockResolvedValueOnce(startedSession)
      mockUpdatePracticeSession.mockResolvedValue(startedSession)

      // Act
      const result = await PracticeSessionService.startSession('session-123')

      // Assert
      expect(mockUpdatePracticeSession).toHaveBeenCalledWith(
        'session-123',
        expect.objectContaining({ startTime: expect.any(Date) })
      )
      expect(result.startTime).toBeDefined()
    })

    it('should throw error when starting non-existent session', async () => {
      // Arrange
      mockGetPracticeSession.mockResolvedValue(null)

      // Act & Assert
      await expect(
        PracticeSessionService.startSession('non-existent')
      ).rejects.toThrow('Session not found')
    })
  })

  describe('endSession', () => {
    it('should end a session via repository', async () => {
      // Arrange
      const existingSession: PracticeSession = {
        id: 'session-123',
        bandId: 'band-1',
        scheduledDate: new Date('2025-10-28'),
        startTime: new Date(),
        type: 'rehearsal',
        status: 'scheduled',
        songs: [],
        attendees: [],
        objectives: ['Practice chorus'],
        completedObjectives: [],
      }

      const endedSession: PracticeSession = {
        ...existingSession,
        endTime: new Date(),
        completedObjectives: ['Practice chorus'],
        sessionRating: 4,
      }

      // First call returns existing session, second call returns ended session
      mockGetPracticeSession
        .mockResolvedValueOnce(existingSession)
        .mockResolvedValueOnce(endedSession)
      mockUpdatePracticeSession.mockResolvedValue(endedSession)

      // Act
      const result = await PracticeSessionService.endSession('session-123', {
        completedObjectives: ['Practice chorus'],
        sessionRating: 4,
      })

      // Assert
      expect(mockUpdatePracticeSession).toHaveBeenCalledWith(
        'session-123',
        expect.objectContaining({
          endTime: expect.any(Date),
          completedObjectives: ['Practice chorus'],
          sessionRating: 4,
        })
      )
      expect(result.endTime).toBeDefined()
      expect(result.sessionRating).toBe(4)
    })

    it('should throw error for invalid session rating', async () => {
      // Arrange
      const existingSession: PracticeSession = {
        id: 'session-123',
        bandId: 'band-1',
        scheduledDate: new Date('2025-10-28'),
        type: 'rehearsal',
        status: 'scheduled',
        songs: [],
        attendees: [],
        objectives: [],
        completedObjectives: [],
      }

      mockGetPracticeSession.mockResolvedValue(existingSession)

      // Act & Assert
      await expect(
        PracticeSessionService.endSession('session-123', {
          sessionRating: 10, // Invalid rating
        })
      ).rejects.toThrow('Session rating must be between 1 and 5')
    })
  })

  describe('addSongToSession', () => {
    it('should add a song to a session via repository', async () => {
      // Arrange
      const existingSession: PracticeSession = {
        id: 'session-123',
        bandId: 'band-1',
        scheduledDate: new Date('2025-10-28'),
        type: 'rehearsal',
        status: 'scheduled',
        songs: [],
        attendees: [],
        objectives: [],
        completedObjectives: [],
      }

      const updatedSession: PracticeSession = {
        ...existingSession,
        songs: [
          {
            songId: 'song-1',
            timeSpent: 0,
            status: 'not-started',
            notes: 'Focus on intro',
            sectionsWorked: [],
            improvements: [],
            needsWork: [],
            memberRatings: [],
          },
        ],
      }

      mockGetPracticeSession.mockResolvedValue(existingSession)
      mockUpdatePracticeSession.mockResolvedValue(updatedSession)

      // Act
      const result = await PracticeSessionService.addSongToSession(
        'session-123',
        {
          songId: 'song-1',
          notes: 'Focus on intro',
        }
      )

      // Assert
      expect(mockUpdatePracticeSession).toHaveBeenCalledWith(
        'session-123',
        expect.objectContaining({
          songs: expect.arrayContaining([
            expect.objectContaining({ songId: 'song-1' }),
          ]),
        })
      )
      expect(result.songId).toBe('song-1')
    })
  })

  describe('updateSessionSong', () => {
    it('should update a song in a session via repository', async () => {
      // Arrange
      const existingSession: PracticeSession = {
        id: 'session-123',
        bandId: 'band-1',
        scheduledDate: new Date('2025-10-28'),
        type: 'rehearsal',
        status: 'scheduled',
        songs: [
          {
            songId: 'song-1',
            timeSpent: 0,
            status: 'not-started',
            sectionsWorked: [],
            improvements: [],
            needsWork: [],
            memberRatings: [],
          },
        ],
        attendees: [],
        objectives: [],
        completedObjectives: [],
      }

      const updatedSession: PracticeSession = {
        ...existingSession,
        songs: [
          {
            songId: 'song-1',
            timeSpent: 15,
            status: 'completed',
            sectionsWorked: ['intro', 'chorus'],
            improvements: ['Better timing'],
            needsWork: ['Bridge transition'],
            memberRatings: [],
          },
        ],
      }

      mockGetPracticeSession.mockResolvedValue(existingSession)
      mockUpdatePracticeSession.mockResolvedValue(updatedSession)

      // Act
      const result = await PracticeSessionService.updateSessionSong(
        'session-123',
        'song-1',
        {
          timeSpent: 15,
          status: 'completed',
          sectionsWorked: ['intro', 'chorus'],
          improvements: ['Better timing'],
          needsWork: ['Bridge transition'],
        }
      )

      // Assert
      expect(mockUpdatePracticeSession).toHaveBeenCalledWith(
        'session-123',
        expect.objectContaining({ songs: expect.any(Array) })
      )
      expect(result.timeSpent).toBe(15)
      expect(result.status).toBe('completed')
    })

    it('should throw error for invalid song status', async () => {
      // Arrange
      const existingSession: PracticeSession = {
        id: 'session-123',
        bandId: 'band-1',
        scheduledDate: new Date('2025-10-28'),
        type: 'rehearsal',
        status: 'scheduled',
        songs: [
          {
            songId: 'song-1',
            timeSpent: 0,
            status: 'not-started',
            sectionsWorked: [],
            improvements: [],
            needsWork: [],
            memberRatings: [],
          },
        ],
        attendees: [],
        objectives: [],
        completedObjectives: [],
      }

      mockGetPracticeSession.mockResolvedValue(existingSession)

      // Act & Assert
      await expect(
        PracticeSessionService.updateSessionSong('session-123', 'song-1', {
          status: 'invalid' as any,
        })
      ).rejects.toThrow('Invalid song status')
    })

    it('should throw error when song not found in session', async () => {
      // Arrange
      const existingSession: PracticeSession = {
        id: 'session-123',
        bandId: 'band-1',
        scheduledDate: new Date('2025-10-28'),
        type: 'rehearsal',
        status: 'scheduled',
        songs: [],
        attendees: [],
        objectives: [],
        completedObjectives: [],
      }

      mockGetPracticeSession.mockResolvedValue(existingSession)

      // Act & Assert
      await expect(
        PracticeSessionService.updateSessionSong('session-123', 'song-999', {
          timeSpent: 15,
        })
      ).rejects.toThrow('Song not found in session')
    })
  })

  describe('recordAttendance', () => {
    it('should record attendance for a member via repository', async () => {
      // Arrange
      const existingSession: PracticeSession = {
        id: 'session-123',
        bandId: 'band-1',
        scheduledDate: new Date('2025-10-28'),
        type: 'rehearsal',
        status: 'scheduled',
        songs: [],
        attendees: [
          {
            memberId: 'member-1',
            confirmed: false,
            attended: false,
          },
        ],
        objectives: [],
        completedObjectives: [],
      }

      const updatedSession: PracticeSession = {
        ...existingSession,
        attendees: [
          {
            memberId: 'member-1',
            confirmed: true,
            attended: true,
            arrivalTime: new Date('2025-10-28T18:00:00'),
            departureTime: new Date('2025-10-28T20:00:00'),
          },
        ],
      }

      mockGetPracticeSession.mockResolvedValue(existingSession)
      mockUpdatePracticeSession.mockResolvedValue(updatedSession)

      // Act
      const result = await PracticeSessionService.recordAttendance(
        'session-123',
        {
          memberId: 'member-1',
          attended: true,
          arrivalTime: '2025-10-28T18:00:00',
          departureTime: '2025-10-28T20:00:00',
        }
      )

      // Assert
      expect(mockUpdatePracticeSession).toHaveBeenCalledWith(
        'session-123',
        expect.objectContaining({ attendees: expect.any(Array) })
      )
      expect(result.attended).toBe(true)
    })

    it('should add new attendee if not in list', async () => {
      // Arrange
      const existingSession: PracticeSession = {
        id: 'session-123',
        bandId: 'band-1',
        scheduledDate: new Date('2025-10-28'),
        type: 'rehearsal',
        status: 'scheduled',
        songs: [],
        attendees: [],
        objectives: [],
        completedObjectives: [],
      }

      const updatedSession: PracticeSession = {
        ...existingSession,
        attendees: [
          {
            memberId: 'member-1',
            confirmed: true,
            attended: true,
          },
        ],
      }

      mockGetPracticeSession.mockResolvedValue(existingSession)
      mockUpdatePracticeSession.mockResolvedValue(updatedSession)

      // Act
      const result = await PracticeSessionService.recordAttendance(
        'session-123',
        {
          memberId: 'member-1',
          attended: true,
        }
      )

      // Assert
      expect(result.memberId).toBe('member-1')
      expect(result.attended).toBe(true)
    })
  })
})
