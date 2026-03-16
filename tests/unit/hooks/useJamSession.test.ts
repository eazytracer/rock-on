/**
 * Unit tests for useJamSession hook
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useJamSession } from '../../../src/hooks/useJamSession'
import type {
  JamSession,
  JamParticipant,
  JamSongMatch,
} from '../../../src/models/JamSession'

// ============================================================================
// Mocks — use factory pattern to avoid hoisting issues
// ============================================================================

vi.mock('../../../src/services/data/RepositoryFactory', () => {
  const repo = {
    getJamSession: vi.fn(),
    getJamParticipants: vi.fn(),
    getJamSongMatches: vi.fn(),
    updateJamParticipant: vi.fn(),
    updateJamSession: vi.fn(),
    addSetlist: vi.fn(),
    updateSetlist: vi.fn(),
    getSetlist: vi.fn(),
    upsertJamSongMatches: vi.fn(),
  }
  return { repository: repo }
})

vi.mock('../../../src/services/JamSessionService', () => ({
  JamSessionService: {
    joinSession: vi.fn(),
    expireSession: vi.fn(),
    confirmMatch: vi.fn(),
    dismissMatch: vi.fn(),
    saveAsSetlist: vi.fn(),
  },
}))

vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ realtimeManager: null })),
}))

import { repository } from '../../../src/services/data/RepositoryFactory'
import { JamSessionService } from '../../../src/services/JamSessionService'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockRepository = repository as any

// ============================================================================
// Helpers
// ============================================================================

function makeSession(overrides: Partial<JamSession> = {}): JamSession {
  return {
    id: 'session-001',
    shortCode: 'ABC123',
    hostUserId: 'host-user',
    status: 'active',
    createdDate: new Date(),
    expiresAt: new Date(Date.now() + 86400000), // +24h
    settings: {},
    version: 1,
    ...overrides,
  }
}

function makeParticipant(
  overrides: Partial<JamParticipant> = {}
): JamParticipant {
  return {
    id: 'part-001',
    jamSessionId: 'session-001',
    userId: 'user-a',
    joinedDate: new Date(),
    status: 'active',
    sharedContexts: [{ type: 'personal', id: 'user-a' }],
    ...overrides,
  }
}

function makeMatch(overrides: Partial<JamSongMatch> = {}): JamSongMatch {
  return {
    id: 'match-001',
    jamSessionId: 'session-001',
    canonicalTitle: 'wonderwall',
    canonicalArtist: 'oasis',
    displayTitle: 'Wonderwall',
    displayArtist: 'Oasis',
    matchConfidence: 'exact',
    isConfirmed: true,
    matchedSongs: [],
    participantCount: 2,
    computedAt: new Date(),
    ...overrides,
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('useJamSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRepository.getJamSession.mockResolvedValue(null)
    mockRepository.getJamParticipants.mockResolvedValue([])
    mockRepository.getJamSongMatches.mockResolvedValue([])
  })

  describe('initial state with null sessionId', () => {
    it('starts with loading=false and null session when sessionId is null', async () => {
      const { result } = renderHook(() => useJamSession(null))

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.session).toBeNull()
      expect(result.current.participants).toEqual([])
      expect(result.current.matches).toEqual([])
      expect(result.current.error).toBeNull()
    })

    it('does not call repository when sessionId is null', async () => {
      renderHook(() => useJamSession(null))

      await waitFor(() => true) // let effects run

      expect(mockRepository.getJamSession).not.toHaveBeenCalled()
    })
  })

  describe('loading a session', () => {
    it('fetches session, participants, and matches in parallel', async () => {
      const session = makeSession()
      const participant = makeParticipant()
      const match = makeMatch()

      mockRepository.getJamSession.mockResolvedValue(session)
      mockRepository.getJamParticipants.mockResolvedValue([participant])
      mockRepository.getJamSongMatches.mockResolvedValue([match])

      const { result } = renderHook(() => useJamSession('session-001'))

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.session?.id).toBe('session-001')
      expect(result.current.participants).toHaveLength(1)
      expect(result.current.matches).toHaveLength(1)
      expect(result.current.error).toBeNull()
    })

    it('starts in loading=true state', () => {
      mockRepository.getJamSession.mockResolvedValue(makeSession())
      mockRepository.getJamParticipants.mockResolvedValue([])
      mockRepository.getJamSongMatches.mockResolvedValue([])

      const { result } = renderHook(() => useJamSession('session-001'))

      expect(result.current.loading).toBe(true)
    })

    it('sets error when repository throws', async () => {
      mockRepository.getJamSession.mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useJamSession('session-001'))

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.error).toBeInstanceOf(Error)
      expect(result.current.error?.message).toBe('Network error')
    })

    it('returns null session when repository returns null (not found)', async () => {
      mockRepository.getJamSession.mockResolvedValue(null)
      mockRepository.getJamParticipants.mockResolvedValue([])
      mockRepository.getJamSongMatches.mockResolvedValue([])

      const { result } = renderHook(() => useJamSession('nonexistent'))

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.session).toBeNull()
      expect(result.current.error).toBeNull() // not found ≠ error
    })
  })

  describe('leaveSession', () => {
    it('updates participant status to "left" optimistically', async () => {
      const participant = makeParticipant({ id: 'part-leave' })
      mockRepository.getJamSession.mockResolvedValue(makeSession())
      mockRepository.getJamParticipants.mockResolvedValue([participant])
      mockRepository.getJamSongMatches.mockResolvedValue([])
      mockRepository.updateJamParticipant.mockResolvedValue({
        ...participant,
        status: 'left',
      })

      const { result } = renderHook(() => useJamSession('session-001'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      await act(async () => {
        await result.current.leaveSession('part-leave')
      })

      const updated = result.current.participants.find(
        p => p.id === 'part-leave'
      )
      expect(updated?.status).toBe('left')
    })
  })

  describe('confirmMatch', () => {
    it('optimistically marks the match as isConfirmed=true', async () => {
      const fuzzyMatch = makeMatch({
        id: 'fuzzy-1',
        isConfirmed: false,
        matchConfidence: 'fuzzy',
      })
      mockRepository.getJamSession.mockResolvedValue(makeSession())
      mockRepository.getJamParticipants.mockResolvedValue([])
      mockRepository.getJamSongMatches.mockResolvedValue([fuzzyMatch])
      vi.mocked(JamSessionService.confirmMatch).mockResolvedValue(undefined)

      const { result } = renderHook(() => useJamSession('session-001'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      await act(async () => {
        await result.current.confirmMatch('fuzzy-1')
      })

      const updated = result.current.matches.find(m => m.id === 'fuzzy-1')
      expect(updated?.isConfirmed).toBe(true)
    })
  })

  describe('dismissMatch', () => {
    it('removes the match from the list', async () => {
      const m1 = makeMatch({ id: 'keep', canonicalTitle: 'wonderwall' })
      const m2 = makeMatch({ id: 'dismiss', canonicalTitle: 'bohemian' })
      mockRepository.getJamSession.mockResolvedValue(makeSession())
      mockRepository.getJamParticipants.mockResolvedValue([])
      mockRepository.getJamSongMatches.mockResolvedValue([m1, m2])
      vi.mocked(JamSessionService.dismissMatch).mockResolvedValue(undefined)

      // dismissMatch calls refetch on error, mock it to avoid cascade
      mockRepository.getJamSongMatches.mockResolvedValue([m1, m2])

      const { result } = renderHook(() => useJamSession('session-001'))
      await waitFor(() => expect(result.current.loading).toBe(false))

      await act(async () => {
        await result.current.dismissMatch('dismiss')
      })

      expect(result.current.matches).toHaveLength(1)
      expect(result.current.matches[0].id).toBe('keep')
    })
  })
})
