/**
 * Unit tests for JamSessionService
 * Tests session creation, tier gating stub, share URL generation,
 * and match confirmation/dismissal logic.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { JamSession, JamSongMatch } from '../../../src/models/JamSession'

// ============================================================================
// Mock repository — must use factory pattern (no top-level vars before mock)
// ============================================================================

vi.mock('../../../src/services/data/RepositoryFactory', () => {
  const repo = {
    getJamSession: vi.fn(),
    getJamSessionByCode: vi.fn(),
    createJamSession: vi.fn(),
    updateJamSession: vi.fn(),
    addJamParticipant: vi.fn(),
    getJamParticipants: vi.fn(),
    getJamSongMatches: vi.fn(),
    upsertJamSongMatches: vi.fn(),
    getSetlist: vi.fn(),
    addSetlist: vi.fn(),
    updateSetlist: vi.fn(),
  }
  return { repository: repo }
})

vi.mock('../../../src/services/SongService', () => ({
  SongService: {
    getPersonalSongs: vi
      .fn()
      .mockResolvedValue({ songs: [], total: 0, filtered: 0 }),
  },
}))

import { JamSessionService } from '../../../src/services/JamSessionService'
import { repository } from '../../../src/services/data/RepositoryFactory'

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
    expiresAt: new Date(Date.now() + 86400000),
    settings: {},
    version: 1,
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
    matchedSongs: [
      {
        userId: 'user-a',
        songId: 'song-1',
        rawTitle: 'Wonderwall',
        rawArtist: 'Oasis',
      },
      {
        userId: 'user-b',
        songId: 'song-2',
        rawTitle: 'Wonderwall',
        rawArtist: 'Oasis',
      },
    ],
    participantCount: 2,
    computedAt: new Date(),
    ...overrides,
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('JamSessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // --------------------------------------------------------------------------
  // canCreateJamSession — tier stub
  // --------------------------------------------------------------------------

  describe('canCreateJamSession', () => {
    it('returns { allowed: true } for any user (tier stub always allows)', async () => {
      const result = await JamSessionService.canCreateJamSession('any-user-id')
      expect(result.allowed).toBe(true)
      expect(result.reason).toBeUndefined()
    })

    it('returns { allowed: true } even with empty userId', async () => {
      const result = await JamSessionService.canCreateJamSession('')
      expect(result.allowed).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // createSession
  // --------------------------------------------------------------------------

  describe('createSession', () => {
    beforeEach(() => {
      // No existing session with the generated code
      mockRepository.getJamSessionByCode.mockResolvedValue(null)
      mockRepository.createJamSession.mockImplementation(
        (session: Omit<JamSession, 'id'>) =>
          Promise.resolve({ ...session, id: 'new-session-id' })
      )
      mockRepository.addJamParticipant.mockResolvedValue({ id: 'part-001' })
    })

    it('generates a 6-character alphanumeric short code', async () => {
      const { session } = await JamSessionService.createSession('host-user')
      expect(session.shortCode).toMatch(/^[A-Z0-9]{6}$/)
    })

    it('sets expires_at approximately 24 hours in the future', async () => {
      const before = Date.now()
      const { session } = await JamSessionService.createSession('host-user')
      const after = Date.now()
      const expiresMs = new Date(session.expiresAt).getTime()
      const expectedMin = before + 23.9 * 3600000
      const expectedMax = after + 24.1 * 3600000
      expect(expiresMs).toBeGreaterThan(expectedMin)
      expect(expiresMs).toBeLessThan(expectedMax)
    })

    it('returns a rawViewToken (non-empty string)', async () => {
      const { rawViewToken } =
        await JamSessionService.createSession('host-user')
      expect(rawViewToken).toBeTruthy()
      expect(typeof rawViewToken).toBe('string')
      expect(rawViewToken.length).toBeGreaterThan(10)
    })

    it('stores a hashed (different) view token in the DB, not the raw one', async () => {
      const { rawViewToken } =
        await JamSessionService.createSession('host-user')
      const storedSession = mockRepository.createJamSession.mock
        .calls[0][0] as Omit<JamSession, 'id'>
      expect(storedSession.viewToken).not.toBe(rawViewToken)
      expect(storedSession.viewToken).toMatch(/^[a-f0-9]{64}$/) // SHA-256 hex
    })

    it('sets hostUserId on the session', async () => {
      const { session } = await JamSessionService.createSession('my-host-id')
      expect(session.hostUserId).toBe('my-host-id')
    })

    it('auto-adds host as a participant sharing their personal catalog', async () => {
      await JamSessionService.createSession('host-user')
      expect(mockRepository.addJamParticipant).toHaveBeenCalledOnce()
      const participantArg = mockRepository.addJamParticipant.mock.calls[0][0]
      expect(participantArg.userId).toBe('host-user')
      expect(participantArg.sharedContexts).toEqual([
        { type: 'personal', id: 'host-user' },
      ])
    })

    it('uses a provided session name', async () => {
      const { session } = await JamSessionService.createSession(
        'host-user',
        'Friday Night Jam'
      )
      expect(session.name).toBe('Friday Night Jam')
    })

    it('sets status to "active"', async () => {
      const { session } = await JamSessionService.createSession('host-user')
      expect(session.status).toBe('active')
    })

    it('throws if canCreateJamSession returns disallowed (mocked)', async () => {
      // Patch the method temporarily for this test
      const spy = vi
        .spyOn(JamSessionService, 'canCreateJamSession')
        .mockResolvedValueOnce({ allowed: false, reason: 'Limit reached' })
      await expect(
        JamSessionService.createSession('host-user')
      ).rejects.toThrow('Limit reached')
      spy.mockRestore()
    })
  })

  // --------------------------------------------------------------------------
  // generateShareUrl
  // --------------------------------------------------------------------------

  describe('generateShareUrl', () => {
    it('generates correct URL with code and token', () => {
      const url = JamSessionService.generateShareUrl(
        'ABC123',
        'raw-token-xyz',
        'https://rockon.app'
      )
      expect(url).toBe('https://rockon.app/jam/view/ABC123?t=raw-token-xyz')
    })

    it('URL contains the short code in the path', () => {
      const url = JamSessionService.generateShareUrl(
        'XYZ789',
        'tok',
        'https://example.com'
      )
      expect(url).toContain('/jam/view/XYZ789')
    })

    it('URL contains the raw token as query param t=', () => {
      const url = JamSessionService.generateShareUrl(
        'CODE01',
        'my-token',
        'https://example.com'
      )
      expect(url).toContain('t=my-token')
    })
  })

  // --------------------------------------------------------------------------
  // expireSession
  // --------------------------------------------------------------------------

  describe('expireSession', () => {
    it('calls updateJamSession with status=expired', async () => {
      mockRepository.updateJamSession.mockResolvedValue(
        makeSession({ status: 'expired' })
      )
      await JamSessionService.expireSession('session-001')
      expect(mockRepository.updateJamSession).toHaveBeenCalledWith(
        'session-001',
        { status: 'expired' }
      )
    })
  })

  // --------------------------------------------------------------------------
  // confirmMatch / dismissMatch
  // --------------------------------------------------------------------------

  describe('confirmMatch', () => {
    it('marks the target match as isConfirmed=true and re-upserts', async () => {
      const fuzzyMatch = makeMatch({
        id: 'match-fuzzy',
        isConfirmed: false,
        matchConfidence: 'fuzzy',
      })
      const otherMatch = makeMatch({ id: 'match-exact', isConfirmed: true })
      mockRepository.getJamSongMatches.mockResolvedValue([
        fuzzyMatch,
        otherMatch,
      ])
      mockRepository.upsertJamSongMatches.mockResolvedValue([])

      await JamSessionService.confirmMatch('session-001', 'match-fuzzy')

      const upsertArg = mockRepository.upsertJamSongMatches.mock
        .calls[0][1] as Omit<JamSongMatch, 'id'>[]
      // The fuzzy match should now be confirmed
      const confirmedMatch = upsertArg.find(
        m => m.canonicalTitle === fuzzyMatch.canonicalTitle
      )
      expect(confirmedMatch?.isConfirmed).toBe(true)
    })

    it('does not affect other matches', async () => {
      const fuzzy = makeMatch({ id: 'match-fuzzy', isConfirmed: false })
      const exact = makeMatch({
        id: 'match-exact',
        isConfirmed: true,
        canonicalTitle: 'other',
      })
      mockRepository.getJamSongMatches.mockResolvedValue([fuzzy, exact])
      mockRepository.upsertJamSongMatches.mockResolvedValue([])

      await JamSessionService.confirmMatch('session-001', 'match-fuzzy')

      const upsertArg = mockRepository.upsertJamSongMatches.mock
        .calls[0][1] as Omit<JamSongMatch, 'id'>[]
      expect(upsertArg).toHaveLength(2)
    })
  })

  describe('dismissMatch', () => {
    it('removes the target match from the session', async () => {
      const m1 = makeMatch({ id: 'keep', canonicalTitle: 'wonderwall' })
      const m2 = makeMatch({ id: 'remove', canonicalTitle: 'bohemian' })
      mockRepository.getJamSongMatches.mockResolvedValue([m1, m2])
      mockRepository.upsertJamSongMatches.mockResolvedValue([])

      await JamSessionService.dismissMatch('session-001', 'remove')

      const upsertArg = mockRepository.upsertJamSongMatches.mock
        .calls[0][1] as Omit<JamSongMatch, 'id'>[]
      expect(upsertArg).toHaveLength(1)
      expect(upsertArg[0].canonicalTitle).toBe('wonderwall')
    })
  })

  // --------------------------------------------------------------------------
  // saveAsSetlist
  // --------------------------------------------------------------------------

  describe('saveAsSetlist', () => {
    beforeEach(() => {
      mockRepository.getJamSession.mockResolvedValue(makeSession())
      mockRepository.getJamSongMatches.mockResolvedValue([
        makeMatch({ id: 'm1', isConfirmed: true }),
        makeMatch({ id: 'm2', isConfirmed: false }), // unconfirmed — should not be included
      ])
      mockRepository.addSetlist.mockResolvedValue(undefined)
      mockRepository.updateSetlist.mockResolvedValue(undefined)
      mockRepository.updateJamSession.mockResolvedValue(
        makeSession({ status: 'saved' })
      )
      mockRepository.getSetlist.mockResolvedValue({
        id: 'setlist-001',
        name: 'Test Jam',
        contextType: 'personal',
        contextId: 'host-user',
        tags: ['jam'],
        items: [],
        status: 'draft',
        createdDate: new Date(),
        lastModified: new Date(),
      })
    })

    it('creates a setlist with contextType=personal and contextId=hostUserId', async () => {
      await JamSessionService.saveAsSetlist(
        'session-001',
        'host-user',
        'My Jam'
      )

      expect(mockRepository.addSetlist).toHaveBeenCalledOnce()
      const addArg = mockRepository.addSetlist.mock.calls[0][0]
      expect(addArg.contextType).toBe('personal')
      expect(addArg.contextId).toBe('host-user')
    })

    it('tags the setlist with "jam"', async () => {
      await JamSessionService.saveAsSetlist('session-001', 'host-user')

      const addArg = mockRepository.addSetlist.mock.calls[0][0]
      expect(addArg.tags).toContain('jam')
    })

    it('sets jamSessionId on the setlist', async () => {
      await JamSessionService.saveAsSetlist('session-001', 'host-user')

      const addArg = mockRepository.addSetlist.mock.calls[0][0]
      expect(addArg.jamSessionId).toBe('session-001')
    })

    it('only includes confirmed matches in setlist items', async () => {
      await JamSessionService.saveAsSetlist('session-001', 'host-user')

      const addArg = mockRepository.addSetlist.mock.calls[0][0]
      // Only 1 confirmed match (m1)
      expect(addArg.items).toHaveLength(1)
    })

    it('marks the session as saved with saved_setlist_id', async () => {
      await JamSessionService.saveAsSetlist('session-001', 'host-user')

      expect(mockRepository.updateJamSession).toHaveBeenCalledWith(
        'session-001',
        expect.objectContaining({
          status: 'saved',
          savedSetlistId: expect.any(String),
        })
      )
    })
  })
})
