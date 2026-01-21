import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SyncEngine } from '../../../../src/services/data/SyncEngine'
import { LocalRepository } from '../../../../src/services/data/LocalRepository'
import { RemoteRepository } from '../../../../src/services/data/RemoteRepository'
import {
  AuditLogEntry,
  createEmptyIncrementalSyncResult,
} from '../../../../src/services/data/syncTypes'

// Mock the database with more complete mocking for notifyListeners
vi.mock('../../../../src/services/database', () => ({
  db: {
    syncMetadata: {
      get: vi.fn(),
      put: vi.fn(),
    },
    syncQueue: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve([])),
          count: vi.fn(() => Promise.resolve(0)),
          filter: vi.fn(() => ({
            first: vi.fn(() => Promise.resolve(null)),
          })),
        })),
      })),
    },
    syncConflicts: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          count: vi.fn(() => Promise.resolve(0)),
        })),
      })),
    },
    songs: { put: vi.fn() },
    setlists: { put: vi.fn() },
    shows: { put: vi.fn() },
    practiceSessions: { put: vi.fn() },
  },
}))

// Mock the logger
vi.mock('../../../../src/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

describe('SyncEngine - Audit Log Based Sync', () => {
  let syncEngine: SyncEngine
  let mockLocal: LocalRepository
  let mockRemote: RemoteRepository

  beforeEach(() => {
    vi.clearAllMocks()

    // Create mock repositories
    mockLocal = {
      getSong: vi.fn(),
      addSong: vi.fn(),
      updateSong: vi.fn(),
      deleteSong: vi.fn(),
      getSetlist: vi.fn(),
      addSetlist: vi.fn(),
      updateSetlist: vi.fn(),
      deleteSetlist: vi.fn(),
      getShow: vi.fn(),
      addShow: vi.fn(),
      updateShow: vi.fn(),
      deleteShow: vi.fn(),
      getPracticeSession: vi.fn(),
      addPracticeSession: vi.fn(),
      updatePracticeSession: vi.fn(),
      deletePracticeSession: vi.fn(),
    } as unknown as LocalRepository

    mockRemote = {
      getUserMemberships: vi.fn(),
      getAuditLogSince: vi.fn(),
    } as unknown as RemoteRepository

    syncEngine = new SyncEngine(mockLocal, mockRemote)

    // Spy on notifyListeners to prevent it from calling getStatus() which needs real db
    vi.spyOn(
      syncEngine as unknown as { notifyListeners: () => void },
      'notifyListeners'
    ).mockImplementation(() => {})
  })

  describe('applyAuditEntry', () => {
    const baseAuditEntry: Partial<AuditLogEntry> = {
      id: 'audit-1',
      band_id: 'band-abc',
      user_id: 'user-123',
      user_name: 'Test User',
      changed_at: '2026-01-15T10:00:00.000Z',
    }

    describe('INSERT operations', () => {
      it('should add a new song via INSERT', async () => {
        const entry: AuditLogEntry = {
          ...baseAuditEntry,
          table_name: 'songs',
          record_id: 'song-123',
          action: 'INSERT',
          old_values: null,
          new_values: {
            id: 'song-123',
            title: 'New Song',
            artist: 'Test Artist',
            tempo: 120,
            created_date: '2026-01-15T10:00:00.000Z',
          },
        } as AuditLogEntry

        vi.mocked(mockLocal.getSong).mockResolvedValue(null)

        const counts = createEmptyIncrementalSyncResult()
        const pendingIds = new Set<string>()

        // Access private method through any
        const result = await (syncEngine as any).applyAuditEntry(
          entry,
          pendingIds,
          counts
        )

        expect(result).toBe(true)
        expect(mockLocal.addSong).toHaveBeenCalled()
        expect(counts.newSongs).toBe(1)
      })

      it('should add a new setlist via INSERT', async () => {
        const entry: AuditLogEntry = {
          ...baseAuditEntry,
          table_name: 'setlists',
          record_id: 'setlist-123',
          action: 'INSERT',
          old_values: null,
          new_values: {
            id: 'setlist-123',
            name: 'New Setlist',
            band_id: 'band-abc',
            created_date: '2026-01-15T10:00:00.000Z',
            last_modified: '2026-01-15T10:00:00.000Z',
          },
        } as AuditLogEntry

        vi.mocked(mockLocal.getSetlist).mockResolvedValue(null)

        const counts = createEmptyIncrementalSyncResult()
        const pendingIds = new Set<string>()

        const result = await (syncEngine as any).applyAuditEntry(
          entry,
          pendingIds,
          counts
        )

        expect(result).toBe(true)
        expect(mockLocal.addSetlist).toHaveBeenCalled()
        expect(counts.newSetlists).toBe(1)
      })

      it('should add a new show via INSERT', async () => {
        const entry: AuditLogEntry = {
          ...baseAuditEntry,
          table_name: 'shows',
          record_id: 'show-123',
          action: 'INSERT',
          old_values: null,
          new_values: {
            id: 'show-123',
            name: 'New Show',
            venue: 'Test Venue',
            scheduled_date: '2026-06-15T20:00:00.000Z',
            created_date: '2026-01-15T10:00:00.000Z',
            updated_date: '2026-01-15T10:00:00.000Z',
          },
        } as AuditLogEntry

        vi.mocked(mockLocal.getShow).mockResolvedValue(null)

        const counts = createEmptyIncrementalSyncResult()
        const pendingIds = new Set<string>()

        const result = await (syncEngine as any).applyAuditEntry(
          entry,
          pendingIds,
          counts
        )

        expect(result).toBe(true)
        expect(mockLocal.addShow).toHaveBeenCalled()
        expect(counts.newShows).toBe(1)
      })

      it('should add a new practice via INSERT', async () => {
        const entry: AuditLogEntry = {
          ...baseAuditEntry,
          table_name: 'practice_sessions',
          record_id: 'practice-123',
          action: 'INSERT',
          old_values: null,
          new_values: {
            id: 'practice-123',
            scheduled_date: '2026-01-20T19:00:00.000Z',
            band_id: 'band-abc',
            created_date: '2026-01-15T10:00:00.000Z',
          },
        } as AuditLogEntry

        vi.mocked(mockLocal.getPracticeSession).mockResolvedValue(null)

        const counts = createEmptyIncrementalSyncResult()
        const pendingIds = new Set<string>()

        const result = await (syncEngine as any).applyAuditEntry(
          entry,
          pendingIds,
          counts
        )

        expect(result).toBe(true)
        expect(mockLocal.addPracticeSession).toHaveBeenCalled()
        expect(counts.newPractices).toBe(1)
      })
    })

    describe('UPDATE operations', () => {
      it('should update an existing song via UPDATE', async () => {
        const entry: AuditLogEntry = {
          ...baseAuditEntry,
          table_name: 'songs',
          record_id: 'song-123',
          action: 'UPDATE',
          old_values: { id: 'song-123', title: 'Old Title' },
          new_values: {
            id: 'song-123',
            title: 'Updated Title',
            artist: 'Test Artist',
            tempo: 120,
            created_date: '2026-01-10T10:00:00.000Z',
          },
        } as AuditLogEntry

        // Song already exists locally
        vi.mocked(mockLocal.getSong).mockResolvedValue({
          id: 'song-123',
          title: 'Old Title',
        } as any)

        const counts = createEmptyIncrementalSyncResult()
        const pendingIds = new Set<string>()

        const result = await (syncEngine as any).applyAuditEntry(
          entry,
          pendingIds,
          counts
        )

        expect(result).toBe(true)
        expect(mockLocal.updateSong).toHaveBeenCalled()
        expect(counts.updatedSongs).toBe(1)
      })

      it('should insert if UPDATE targets non-existent record', async () => {
        const entry: AuditLogEntry = {
          ...baseAuditEntry,
          table_name: 'songs',
          record_id: 'song-new',
          action: 'UPDATE',
          old_values: null,
          new_values: {
            id: 'song-new',
            title: 'New Song',
            artist: 'Artist',
            tempo: 100,
            created_date: '2026-01-15T10:00:00.000Z',
          },
        } as AuditLogEntry

        // Song doesn't exist locally
        vi.mocked(mockLocal.getSong).mockResolvedValue(null)

        const counts = createEmptyIncrementalSyncResult()
        const pendingIds = new Set<string>()

        const result = await (syncEngine as any).applyAuditEntry(
          entry,
          pendingIds,
          counts
        )

        expect(result).toBe(true)
        expect(mockLocal.addSong).toHaveBeenCalled()
        expect(counts.newSongs).toBe(1)
      })
    })

    describe('DELETE operations', () => {
      it('should delete a song via DELETE', async () => {
        const entry: AuditLogEntry = {
          ...baseAuditEntry,
          table_name: 'songs',
          record_id: 'song-123',
          action: 'DELETE',
          old_values: { id: 'song-123', title: 'Deleted Song' },
          new_values: null,
        } as AuditLogEntry

        const counts = createEmptyIncrementalSyncResult()
        const pendingIds = new Set<string>()

        const result = await (syncEngine as any).applyAuditEntry(
          entry,
          pendingIds,
          counts
        )

        expect(result).toBe(true)
        expect(mockLocal.deleteSong).toHaveBeenCalledWith('song-123')
        expect(counts.deletedSongs).toBe(1)
      })

      it('should delete a setlist via DELETE', async () => {
        const entry: AuditLogEntry = {
          ...baseAuditEntry,
          table_name: 'setlists',
          record_id: 'setlist-123',
          action: 'DELETE',
          old_values: { id: 'setlist-123', name: 'Deleted Setlist' },
          new_values: null,
        } as AuditLogEntry

        const counts = createEmptyIncrementalSyncResult()
        const pendingIds = new Set<string>()

        const result = await (syncEngine as any).applyAuditEntry(
          entry,
          pendingIds,
          counts
        )

        expect(result).toBe(true)
        expect(mockLocal.deleteSetlist).toHaveBeenCalledWith('setlist-123')
        expect(counts.deletedSetlists).toBe(1)
      })
    })

    describe('Pending changes protection', () => {
      it('should skip records with pending local changes', async () => {
        const entry: AuditLogEntry = {
          ...baseAuditEntry,
          table_name: 'songs',
          record_id: 'song-pending',
          action: 'UPDATE',
          old_values: { title: 'Old' },
          new_values: { id: 'song-pending', title: 'Remote Update' },
        } as AuditLogEntry

        const counts = createEmptyIncrementalSyncResult()
        const pendingIds = new Set<string>(['song-pending'])

        const result = await (syncEngine as any).applyAuditEntry(
          entry,
          pendingIds,
          counts
        )

        expect(result).toBe(false)
        expect(counts.skippedDueToPending).toBe(1)
        expect(mockLocal.updateSong).not.toHaveBeenCalled()
      })
    })

    describe('Error handling', () => {
      it('should return false for missing new_values on INSERT', async () => {
        const entry: AuditLogEntry = {
          ...baseAuditEntry,
          table_name: 'songs',
          record_id: 'song-123',
          action: 'INSERT',
          old_values: null,
          new_values: null, // Missing!
        } as AuditLogEntry

        const counts = createEmptyIncrementalSyncResult()
        const pendingIds = new Set<string>()

        const result = await (syncEngine as any).applyAuditEntry(
          entry,
          pendingIds,
          counts
        )

        expect(result).toBe(false)
        expect(mockLocal.addSong).not.toHaveBeenCalled()
      })
    })
  })

  describe('pullFromAuditLog', () => {
    beforeEach(async () => {
      // Import and mock database module
      const dbModule = await import('../../../../src/services/database')
      vi.mocked(dbModule.db.syncMetadata!.get).mockResolvedValue({
        id: 'lastIncrementalSync',
        value: '2026-01-14T00:00:00.000Z',
        updatedAt: new Date(),
      })
      vi.mocked(dbModule.db.syncQueue!.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
      } as any)
    })

    it('should process audit log entries for all bands', async () => {
      vi.mocked(mockRemote.getUserMemberships).mockResolvedValue([
        { bandId: 'band-1', userId: 'user-1' } as any,
        { bandId: 'band-2', userId: 'user-1' } as any,
      ])

      vi.mocked(mockRemote.getAuditLogSince).mockImplementation(
        async (bandId: string) => {
          if (bandId === 'band-1') {
            return [
              {
                id: 'audit-1',
                table_name: 'songs' as const,
                record_id: 'song-1',
                action: 'INSERT' as const,
                user_id: 'user-2',
                user_name: 'Other User',
                changed_at: '2026-01-15T10:00:00.000Z',
                old_values: null,
                new_values: {
                  id: 'song-1',
                  title: 'Song 1',
                  tempo: 120,
                  created_date: '2026-01-15T10:00:00.000Z',
                },
                band_id: 'band-1',
              },
            ]
          }
          return []
        }
      )

      vi.mocked(mockLocal.getSong).mockResolvedValue(null)

      const result = await syncEngine.pullFromAuditLog('user-1')

      expect(mockRemote.getAuditLogSince).toHaveBeenCalledTimes(2)
      expect(result.newSongs).toBe(1)
    })

    it('should apply entries in chronological order', async () => {
      vi.mocked(mockRemote.getUserMemberships).mockResolvedValue([
        { bandId: 'band-1', userId: 'user-1' } as any,
      ])

      const callOrder: string[] = []

      vi.mocked(mockRemote.getAuditLogSince).mockResolvedValue([
        {
          id: 'audit-1',
          table_name: 'songs' as const,
          record_id: 'song-1',
          action: 'INSERT' as const,
          user_id: 'user-2',
          user_name: 'User',
          changed_at: '2026-01-15T10:00:00.000Z',
          old_values: null,
          new_values: {
            id: 'song-1',
            title: 'First',
            tempo: 100,
            created_date: '2026-01-15T10:00:00.000Z',
          },
          band_id: 'band-1',
        },
        {
          id: 'audit-2',
          table_name: 'songs' as const,
          record_id: 'song-1',
          action: 'UPDATE' as const,
          user_id: 'user-2',
          user_name: 'User',
          changed_at: '2026-01-15T11:00:00.000Z',
          old_values: { title: 'First' },
          new_values: {
            id: 'song-1',
            title: 'Second',
            tempo: 100,
            created_date: '2026-01-15T10:00:00.000Z',
          },
          band_id: 'band-1',
        },
      ])

      vi.mocked(mockLocal.getSong).mockImplementation(async () => {
        // After first call (INSERT), song exists
        if (callOrder.length > 0) {
          return { id: 'song-1', title: 'First' } as any
        }
        return null
      })

      vi.mocked(mockLocal.addSong).mockImplementation(async () => {
        callOrder.push('add')
        return {} as any
      })

      vi.mocked(mockLocal.updateSong).mockImplementation(async () => {
        callOrder.push('update')
        return {} as any
      })

      await syncEngine.pullFromAuditLog('user-1')

      // Should add first, then update
      expect(callOrder).toEqual(['add', 'update'])
    })

    it('should skip entries for records with pending changes', async () => {
      // Import and mock database module
      const dbModule = await import('../../../../src/services/database')
      vi.mocked(dbModule.db.syncQueue!.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi
            .fn()
            .mockResolvedValue([
              { data: { id: 'song-pending' }, status: 'pending' },
            ]),
        }),
      } as any)

      vi.mocked(mockRemote.getUserMemberships).mockResolvedValue([
        { bandId: 'band-1', userId: 'user-1' } as any,
      ])

      vi.mocked(mockRemote.getAuditLogSince).mockResolvedValue([
        {
          id: 'audit-1',
          table_name: 'songs' as const,
          record_id: 'song-pending',
          action: 'UPDATE' as const,
          user_id: 'user-2',
          user_name: 'User',
          changed_at: '2026-01-15T10:00:00.000Z',
          old_values: { title: 'Old' },
          new_values: {
            id: 'song-pending',
            title: 'Remote Update',
            tempo: 100,
            created_date: '2026-01-10T00:00:00.000Z',
          },
          band_id: 'band-1',
        },
      ])

      const result = await syncEngine.pullFromAuditLog('user-1')

      expect(result.skippedDueToPending).toBe(1)
      expect(mockLocal.updateSong).not.toHaveBeenCalled()
    })

    it('should return result with timing information', async () => {
      vi.mocked(mockRemote.getUserMemberships).mockResolvedValue([
        { bandId: 'band-1', userId: 'user-1' } as any,
      ])
      vi.mocked(mockRemote.getAuditLogSince).mockResolvedValue([])

      const result = await syncEngine.pullFromAuditLog('user-1')

      expect(result.lastSyncTime).toBeInstanceOf(Date)
      expect(result.syncDurationMs).toBeGreaterThanOrEqual(0)
    })
  })
})
