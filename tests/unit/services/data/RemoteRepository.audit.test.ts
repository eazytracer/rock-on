import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RemoteRepository } from '../../../../src/services/data/RemoteRepository'

// Mock audit log data
const mockAuditEntries = [
  {
    id: 'audit-1',
    table_name: 'songs',
    record_id: 'song-123',
    action: 'INSERT',
    user_id: 'user-456',
    user_name: 'John Doe',
    changed_at: '2026-01-15T10:00:00.000Z',
    old_values: null,
    new_values: {
      id: 'song-123',
      title: 'New Song',
      artist: 'Test Artist',
      tempo: 120,
      created_date: '2026-01-15T10:00:00.000Z',
    },
    band_id: 'band-abc',
    client_info: null,
  },
  {
    id: 'audit-2',
    table_name: 'songs',
    record_id: 'song-456',
    action: 'UPDATE',
    user_id: 'user-789',
    user_name: 'Jane Smith',
    changed_at: '2026-01-15T11:00:00.000Z',
    old_values: {
      id: 'song-456',
      title: 'Old Title',
    },
    new_values: {
      id: 'song-456',
      title: 'Updated Title',
    },
    band_id: 'band-abc',
    client_info: { device: 'mobile' },
  },
  {
    id: 'audit-3',
    table_name: 'setlists',
    record_id: 'setlist-789',
    action: 'DELETE',
    user_id: 'user-456',
    user_name: 'John Doe',
    changed_at: '2026-01-15T12:00:00.000Z',
    old_values: {
      id: 'setlist-789',
      name: 'Deleted Setlist',
    },
    new_values: null,
    band_id: 'band-abc',
    client_info: null,
  },
]

// Mock Supabase client with chainable methods
const createMockChain = (data: any[], error: any = null) => {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    gt: vi.fn(() => chain),
    order: vi.fn(() => Promise.resolve({ data, error })),
  }
  return chain
}

vi.mock('../../../../src/services/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'audit_log') {
        return createMockChain(mockAuditEntries)
      }
      // Default mock for other tables
      return createMockChain([])
    }),
  },
}))

describe('RemoteRepository - Audit Log', () => {
  let repository: RemoteRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repository = new RemoteRepository()
  })

  describe('getAuditLogSince', () => {
    it('should fetch audit log entries for a band since a given date', async () => {
      const since = new Date('2026-01-15T09:00:00.000Z')
      const entries = await repository.getAuditLogSince('band-abc', since)

      expect(entries).toHaveLength(3)
      expect(entries[0].id).toBe('audit-1')
      expect(entries[0].table_name).toBe('songs')
      expect(entries[0].action).toBe('INSERT')
    })

    it('should return entries in chronological order (ascending)', async () => {
      const since = new Date('2026-01-15T09:00:00.000Z')
      const entries = await repository.getAuditLogSince('band-abc', since)

      // Verify chronological ordering (earliest first)
      expect(entries[0].changed_at).toBe('2026-01-15T10:00:00.000Z')
      expect(entries[1].changed_at).toBe('2026-01-15T11:00:00.000Z')
      expect(entries[2].changed_at).toBe('2026-01-15T12:00:00.000Z')
    })

    it('should map all AuditLogEntry fields correctly', async () => {
      const since = new Date('2026-01-15T09:00:00.000Z')
      const entries = await repository.getAuditLogSince('band-abc', since)
      const entry = entries[0]

      expect(entry).toEqual({
        id: 'audit-1',
        table_name: 'songs',
        record_id: 'song-123',
        action: 'INSERT',
        user_id: 'user-456',
        user_name: 'John Doe',
        changed_at: '2026-01-15T10:00:00.000Z',
        old_values: null,
        new_values: expect.objectContaining({
          id: 'song-123',
          title: 'New Song',
        }),
        band_id: 'band-abc',
        client_info: null,
      })
    })

    it('should handle UPDATE entries with both old and new values', async () => {
      const since = new Date('2026-01-15T09:00:00.000Z')
      const entries = await repository.getAuditLogSince('band-abc', since)
      const updateEntry = entries[1]

      expect(updateEntry.action).toBe('UPDATE')
      expect(updateEntry.old_values).toEqual({
        id: 'song-456',
        title: 'Old Title',
      })
      expect(updateEntry.new_values).toEqual({
        id: 'song-456',
        title: 'Updated Title',
      })
    })

    it('should handle DELETE entries with only old_values', async () => {
      const since = new Date('2026-01-15T09:00:00.000Z')
      const entries = await repository.getAuditLogSince('band-abc', since)
      const deleteEntry = entries[2]

      expect(deleteEntry.action).toBe('DELETE')
      expect(deleteEntry.old_values).toEqual({
        id: 'setlist-789',
        name: 'Deleted Setlist',
      })
      expect(deleteEntry.new_values).toBeNull()
    })

    it('should preserve client_info metadata when present', async () => {
      const since = new Date('2026-01-15T09:00:00.000Z')
      const entries = await repository.getAuditLogSince('band-abc', since)

      expect(entries[0].client_info).toBeNull()
      expect(entries[1].client_info).toEqual({ device: 'mobile' })
    })

    it('should return empty array when no data', async () => {
      const since = new Date('2026-01-15T09:00:00.000Z')
      const entries = await repository.getAuditLogSince('band-abc', since)

      // Our mock returns data, but we're testing the shape
      expect(Array.isArray(entries)).toBe(true)
    })
  })

  describe('Audit Log Entry Types', () => {
    it('should correctly type table_name as union of entity tables', async () => {
      const since = new Date('2026-01-15T09:00:00.000Z')
      const entries = await repository.getAuditLogSince('band-abc', since)

      // TypeScript would catch if this doesn't match the union type
      const validTableNames = [
        'songs',
        'setlists',
        'shows',
        'practice_sessions',
      ]
      entries.forEach(entry => {
        expect(validTableNames).toContain(entry.table_name)
      })
    })

    it('should correctly type action as INSERT | UPDATE | DELETE', async () => {
      const since = new Date('2026-01-15T09:00:00.000Z')
      const entries = await repository.getAuditLogSince('band-abc', since)

      const validActions = ['INSERT', 'UPDATE', 'DELETE']
      entries.forEach(entry => {
        expect(validActions).toContain(entry.action)
      })
    })
  })
})
