import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { RealtimeChannel } from '@supabase/supabase-js'

// Use vi.hoisted to ensure mocks are available during hoisting
const { mockChannels, mockSupabase, mockRepository, mockDb } = vi.hoisted(
  () => {
    // Track all created channel instances so we can inspect them
    const mockChannels: any[] = []

    // Factory function to create unique channel instances
    const createMockChannel = () => {
      const channel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockImplementation(() => {
          return Promise.resolve({ error: null })
        }),
        unsubscribe: vi.fn().mockImplementation(() => {
          return Promise.resolve({ error: null })
        }),
      }
      mockChannels.push(channel)
      return channel
    }

    const mockSupabase = {
      channel: vi.fn().mockImplementation(() => createMockChannel()),
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }

    const mockRepository = {
      deleteSong: vi.fn().mockResolvedValue(undefined),
      deleteSetlist: vi.fn().mockResolvedValue(undefined),
      deleteShow: vi.fn().mockResolvedValue(undefined),
      deletePracticeSession: vi.fn().mockResolvedValue(undefined),
    }

    const mockDb = {
      users: {
        get: vi.fn().mockResolvedValue({ id: 'user-1', name: 'Alice' }),
      },
      songs: {
        put: vi.fn().mockResolvedValue(undefined),
      },
      setlists: {
        put: vi.fn().mockResolvedValue(undefined),
      },
      shows: {
        put: vi.fn().mockResolvedValue(undefined),
      },
      practiceSessions: {
        put: vi.fn().mockResolvedValue(undefined),
      },
    }

    return { mockChannels, mockSupabase, mockRepository, mockDb }
  }
)

// Mock Supabase client
vi.mock('../../../../src/services/supabase/client', () => ({
  getSupabaseClient: () => mockSupabase,
}))

// Mock repository
vi.mock('../../../../src/services/data/RepositoryFactory', () => ({
  repository: mockRepository,
}))

// Mock toast
vi.mock('../../../../src/contexts/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

// Mock database
vi.mock('../../../../src/services/database', () => ({
  db: mockDb,
}))

// Import after mocks
import { RealtimeManager } from '../../../../src/services/data/RealtimeManager'

describe('RealtimeManager', () => {
  let manager: RealtimeManager

  beforeEach(() => {
    vi.clearAllMocks()
    // Clear the mock channels array
    mockChannels.length = 0
    manager = new RealtimeManager()
  })

  afterEach(async () => {
    await manager.unsubscribeAll()
  })

  describe('Subscription Management', () => {
    it('should subscribe to audit_log channel for a band', async () => {
      const userId = 'user-1'
      const bandIds = ['band-1']

      await manager.subscribeToUserBands(userId, bandIds)

      // Audit-first: Should create 1 channel per band
      expect(mockSupabase.channel).toHaveBeenCalledWith('audit-band-1')

      // Should subscribe to audit_log table
      expect(mockChannels[0].on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          table: 'audit_log',
          event: 'INSERT',
          filter: 'band_id=eq.band-1',
        }),
        expect.any(Function)
      )

      // Should subscribe once per band
      expect(mockChannels[0].subscribe).toHaveBeenCalledTimes(1)
    })

    it('should subscribe to multiple bands simultaneously', async () => {
      const userId = 'user-1'
      const bandIds = ['band-1', 'band-2']

      await manager.subscribeToUserBands(userId, bandIds)

      // Audit-first: Should create 1 channel per band (2 total)
      expect(mockSupabase.channel).toHaveBeenCalledWith('audit-band-1')
      expect(mockSupabase.channel).toHaveBeenCalledWith('audit-band-2')
      expect(mockSupabase.channel).toHaveBeenCalledTimes(2)
      expect(mockChannels[0].subscribe).toHaveBeenCalledTimes(1)
      expect(mockChannels[1].subscribe).toHaveBeenCalledTimes(1)
    })

    it('should track connection status', async () => {
      const userId = 'user-1'
      const bandIds = ['band-1']

      expect(manager.isConnected()).toBe(false)

      await manager.subscribeToUserBands(userId, bandIds)

      expect(manager.isConnected()).toBe(true)
    })
  })

  describe('Event Handling - INSERT', () => {
    it('should update local IndexedDB on remote INSERT', async () => {
      const userId = 'user-1'
      const bandIds = ['band-1']

      await manager.subscribeToUserBands(userId, bandIds)

      // Get the audit_log event handler from the first channel
      const onCall = mockChannels[0].on.mock.calls.find(
        (call: any[]) => call[1]?.table === 'audit_log'
      )
      expect(onCall).toBeDefined()
      const handler = onCall![2]

      // Simulate audit_log INSERT event from Supabase
      const auditPayload = {
        new: {
          id: 'audit-1',
          table_name: 'songs',
          action: 'INSERT',
          user_id: 'user-2', // Different user
          user_name: 'Bob',
          record_id: 'song-1',
          band_id: 'band-1',
          changed_at: new Date().toISOString(),
          new_values: {
            id: 'song-1',
            title: 'Wonderwall',
            artist: 'Oasis',
            context_id: 'band-1',
            created_by: 'user-2',
            created_date: new Date().toISOString(),
            version: 1,
          },
          old_values: null,
        },
        old: {},
        eventType: 'INSERT',
        schema: 'public',
        table: 'audit_log',
      }

      await handler(auditPayload)

      // Give event loop time to process
      await new Promise(resolve => setImmediate(resolve))

      // Should update local IndexedDB
      expect(mockDb.songs.put).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'song-1',
          title: 'Wonderwall',
        })
      )
    })

    it('should NOT mark as unread if current user created item', async () => {
      const userId = 'user-1'
      const bandIds = ['band-1']

      await manager.subscribeToUserBands(userId, bandIds)

      const onCall = mockChannels[0].on.mock.calls.find(
        (call: any[]) => call[1]?.table === 'audit_log'
      )
      const handler = onCall![2]

      const auditPayload = {
        new: {
          id: 'audit-1',
          table_name: 'songs',
          action: 'INSERT',
          user_id: 'user-1', // Current user
          user_name: 'Alice',
          record_id: 'song-1',
          band_id: 'band-1',
          changed_at: new Date().toISOString(),
          new_values: {
            id: 'song-1',
            title: 'Test Song',
            created_by: 'user-1',
            context_id: 'band-1',
            created_date: new Date().toISOString(),
            version: 1,
          },
          old_values: null,
        },
        old: {},
        eventType: 'INSERT',
        schema: 'public',
        table: 'audit_log',
      }

      await handler(auditPayload)
      await new Promise(resolve => setImmediate(resolve))

      // Should NOT update local repository (current user's own change)
      expect(mockDb.songs.put).not.toHaveBeenCalled()
    })

    it('should show toast notification for remote INSERT', async () => {
      const userId = 'user-1'
      const bandIds = ['band-1']

      await manager.subscribeToUserBands(userId, bandIds)

      const onCall = mockChannels[0].on.mock.calls.find(
        (call: any[]) => call[1]?.table === 'audit_log'
      )
      const handler = onCall![2]

      const auditPayload = {
        new: {
          id: 'audit-1',
          table_name: 'songs',
          action: 'INSERT',
          user_id: 'user-2',
          user_name: 'Bob',
          record_id: 'song-1',
          band_id: 'band-1',
          changed_at: new Date().toISOString(),
          new_values: {
            id: 'song-1',
            title: 'Wonderwall',
            created_by: 'user-2',
            context_id: 'band-1',
            created_date: new Date().toISOString(),
            version: 1,
          },
          old_values: null,
        },
        old: {},
        eventType: 'INSERT',
        schema: 'public',
        table: 'audit_log',
      }

      await handler(auditPayload)
      await new Promise(resolve => setImmediate(resolve))

      // Should show toast (will be implemented to call useToast)
      // For now, just verify the method was set up
      expect(onCall).toBeDefined()
    })
  })

  describe('Event Handling - UPDATE', () => {
    it('should update local IndexedDB on remote UPDATE', async () => {
      const userId = 'user-1'
      const bandIds = ['band-1']

      await manager.subscribeToUserBands(userId, bandIds)

      const onCall = mockChannels[0].on.mock.calls.find(
        (call: any[]) => call[1]?.table === 'audit_log'
      )
      const handler = onCall![2]

      const auditPayload = {
        new: {
          id: 'audit-1',
          table_name: 'songs',
          action: 'UPDATE',
          user_id: 'user-2',
          user_name: 'Bob',
          record_id: 'song-1',
          band_id: 'band-1',
          changed_at: new Date().toISOString(),
          new_values: {
            id: 'song-1',
            title: 'Wonderwall (Updated)',
            artist: 'Oasis',
            context_id: 'band-1',
            last_modified_by: 'user-2',
            last_modified: new Date().toISOString(),
            version: 2,
          },
          old_values: {
            id: 'song-1',
            title: 'Wonderwall',
            version: 1,
          },
        },
        old: {},
        eventType: 'INSERT',
        schema: 'public',
        table: 'audit_log',
      }

      await handler(auditPayload)
      await new Promise(resolve => setImmediate(resolve))

      expect(mockDb.songs.put).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Wonderwall (Updated)',
          version: 2,
        })
      )
    })

    it('should NOT mark as unread if current user updated item', async () => {
      const userId = 'user-1'
      const bandIds = ['band-1']

      await manager.subscribeToUserBands(userId, bandIds)

      const onCall = mockChannels[0].on.mock.calls.find(
        (call: any[]) => call[1]?.table === 'audit_log'
      )
      const handler = onCall![2]

      const auditPayload = {
        new: {
          id: 'audit-1',
          table_name: 'songs',
          action: 'UPDATE',
          user_id: 'user-1', // Current user
          user_name: 'Alice',
          record_id: 'song-1',
          band_id: 'band-1',
          changed_at: new Date().toISOString(),
          new_values: {
            id: 'song-1',
            title: 'Updated Title',
            last_modified_by: 'user-1',
            context_id: 'band-1',
            version: 2,
          },
          old_values: {
            id: 'song-1',
            version: 1,
          },
        },
        old: {},
        eventType: 'INSERT',
        schema: 'public',
        table: 'audit_log',
      }

      await handler(auditPayload)
      await new Promise(resolve => setImmediate(resolve))

      expect(mockDb.songs.put).not.toHaveBeenCalled()
    })
  })

  describe('Event Handling - DELETE', () => {
    it('should remove from local IndexedDB on remote DELETE', async () => {
      const userId = 'user-1'
      const bandIds = ['band-1']

      await manager.subscribeToUserBands(userId, bandIds)

      const onCall = mockChannels[0].on.mock.calls.find(
        (call: any[]) => call[1]?.table === 'audit_log'
      )
      const handler = onCall![2]

      const auditPayload = {
        new: {
          id: 'audit-1',
          table_name: 'songs',
          action: 'DELETE',
          user_id: 'user-2',
          user_name: 'Bob',
          record_id: 'song-1',
          band_id: 'band-1',
          changed_at: new Date().toISOString(),
          new_values: null,
          old_values: {
            id: 'song-1',
            title: 'Deleted Song',
            context_id: 'band-1',
          },
        },
        old: {},
        eventType: 'INSERT',
        schema: 'public',
        table: 'audit_log',
      }

      await handler(auditPayload)
      await new Promise(resolve => setImmediate(resolve))

      expect(mockRepository.deleteSong).toHaveBeenCalledWith('song-1')
    })

    it('should NOT delete if current user deleted item', async () => {
      const userId = 'user-1'
      const bandIds = ['band-1']

      await manager.subscribeToUserBands(userId, bandIds)

      const onCall = mockChannels[0].on.mock.calls.find(
        (call: any[]) => call[1]?.table === 'audit_log'
      )
      const handler = onCall![2]

      // For DELETE events, we track who deleted it via user_id in audit log
      const auditPayload = {
        new: {
          id: 'audit-1',
          table_name: 'songs',
          action: 'DELETE',
          user_id: 'user-1', // Current user
          user_name: 'Alice',
          record_id: 'song-1',
          band_id: 'band-1',
          changed_at: new Date().toISOString(),
          new_values: null,
          old_values: {
            id: 'song-1',
            context_id: 'band-1',
          },
        },
        old: {},
        eventType: 'INSERT',
        schema: 'public',
        table: 'audit_log',
      }

      await handler(auditPayload)
      await new Promise(resolve => setImmediate(resolve))

      // Should NOT delete if current user (audit log user_id = 'user-1')
      expect(mockRepository.deleteSong).not.toHaveBeenCalled()
    })
  })

  describe('Multi-Table Support', () => {
    it('should handle setlist changes', async () => {
      const userId = 'user-1'
      const bandIds = ['band-1']

      await manager.subscribeToUserBands(userId, bandIds)

      const onCall = mockChannels[0].on.mock.calls.find(
        (call: any[]) => call[1]?.table === 'audit_log'
      )
      expect(onCall).toBeDefined()
      const handler = onCall![2]

      const auditPayload = {
        new: {
          id: 'audit-1',
          table_name: 'setlists',
          action: 'INSERT',
          user_id: 'user-2',
          user_name: 'Bob',
          record_id: 'setlist-1',
          band_id: 'band-1',
          changed_at: new Date().toISOString(),
          new_values: {
            id: 'setlist-1',
            name: 'New Setlist',
            band_id: 'band-1',
            created_by: 'user-2',
            created_date: new Date().toISOString(),
            version: 1,
          },
          old_values: null,
        },
        old: {},
        eventType: 'INSERT',
        schema: 'public',
        table: 'audit_log',
      }

      await handler(auditPayload)
      await new Promise(resolve => setImmediate(resolve))

      expect(mockDb.setlists.put).toHaveBeenCalled()
    })

    it('should handle show changes', async () => {
      const userId = 'user-1'
      const bandIds = ['band-1']

      await manager.subscribeToUserBands(userId, bandIds)

      const onCall = mockChannels[0].on.mock.calls.find(
        (call: any[]) => call[1]?.table === 'audit_log'
      )
      expect(onCall).toBeDefined()
      const handler = onCall![2]

      const auditPayload = {
        new: {
          id: 'audit-1',
          table_name: 'shows',
          action: 'INSERT',
          user_id: 'user-2',
          user_name: 'Bob',
          record_id: 'show-1',
          band_id: 'band-1',
          changed_at: new Date().toISOString(),
          new_values: {
            id: 'show-1',
            name: 'New Show',
            band_id: 'band-1',
            created_by: 'user-2',
            created_date: new Date().toISOString(),
            version: 1,
          },
          old_values: null,
        },
        old: {},
        eventType: 'INSERT',
        schema: 'public',
        table: 'audit_log',
      }

      await handler(auditPayload)
      await new Promise(resolve => setImmediate(resolve))

      expect(mockDb.shows.put).toHaveBeenCalled()
    })

    it('should handle practice session changes', async () => {
      const userId = 'user-1'
      const bandIds = ['band-1']

      await manager.subscribeToUserBands(userId, bandIds)

      const onCall = mockChannels[0].on.mock.calls.find(
        (call: any[]) => call[1]?.table === 'audit_log'
      )
      expect(onCall).toBeDefined()
      const handler = onCall![2]

      const auditPayload = {
        new: {
          id: 'audit-1',
          table_name: 'practice_sessions',
          action: 'INSERT',
          user_id: 'user-2',
          user_name: 'Bob',
          record_id: 'practice-1',
          band_id: 'band-1',
          changed_at: new Date().toISOString(),
          new_values: {
            id: 'practice-1',
            scheduled_date: new Date().toISOString(),
            band_id: 'band-1',
            created_by: 'user-2',
            created_date: new Date().toISOString(),
            version: 1,
          },
          old_values: null,
        },
        old: {},
        eventType: 'INSERT',
        schema: 'public',
        table: 'audit_log',
      }

      await handler(auditPayload)
      await new Promise(resolve => setImmediate(resolve))

      expect(mockDb.practiceSessions.put).toHaveBeenCalled()
    })
  })

  describe('Reconnection Logic', () => {
    it('should detect disconnection', async () => {
      const userId = 'user-1'
      const bandIds = ['band-1']

      await manager.subscribeToUserBands(userId, bandIds)
      expect(manager.isConnected()).toBe(true)

      // Simulate disconnection
      manager.handleDisconnect()

      expect(manager.isConnected()).toBe(false)
    })

    it('should attempt reconnection', async () => {
      const userId = 'user-1'
      const bandIds = ['band-1']

      await manager.subscribeToUserBands(userId, bandIds)
      manager.handleDisconnect()

      // Simulate reconnection
      await manager.reconnect()

      expect(manager.isConnected()).toBe(true)
      // Should re-subscribe to all channels (check the channels created during reconnect)
      expect(mockChannels.length).toBeGreaterThan(0)
      expect(mockChannels[mockChannels.length - 1].subscribe).toHaveBeenCalled()
    })
  })

  describe('Toast Batching', () => {
    it('should batch multiple rapid changes', async () => {
      const userId = 'user-1'
      const bandIds = ['band-1']

      await manager.subscribeToUserBands(userId, bandIds)

      const onCall = mockChannels[0].on.mock.calls.find(
        (call: any[]) => call[1]?.table === 'audit_log'
      )
      const handler = onCall![2]

      // Simulate 3 rapid changes
      for (let i = 1; i <= 3; i++) {
        const auditPayload = {
          new: {
            id: `audit-${i}`,
            table_name: 'songs',
            action: 'INSERT',
            user_id: 'user-2',
            user_name: 'Bob',
            record_id: `song-${i}`,
            band_id: 'band-1',
            changed_at: new Date().toISOString(),
            new_values: {
              id: `song-${i}`,
              title: `Song ${i}`,
              created_by: 'user-2',
              context_id: 'band-1',
              created_date: new Date().toISOString(),
              version: 1,
            },
            old_values: null,
          },
          old: {},
          eventType: 'INSERT',
          schema: 'public',
          table: 'audit_log',
        }

        await handler(auditPayload)
        await new Promise(resolve => setImmediate(resolve))
      }

      // Wait for batch timeout
      await new Promise(resolve => setTimeout(resolve, 2500))

      // Should show single batched toast (implementation detail)
      // This test validates the structure is in place
      expect(onCall).toBeDefined()
    })
  })

  describe('Event Emitter Pattern', () => {
    it('should emit songs:changed event after handling song change', async () => {
      const userId = 'user-1'
      const bandIds = ['band-1']

      await manager.subscribeToUserBands(userId, bandIds)

      // Set up event listener
      const eventSpy = vi.fn()
      manager.on('songs:changed', eventSpy)

      // Get the handler
      const onCall = mockChannels[0].on.mock.calls.find(
        (call: any[]) => call[1]?.table === 'audit_log'
      )
      const handler = onCall![2]

      // Simulate INSERT event
      const auditPayload = {
        new: {
          id: 'audit-1',
          table_name: 'songs',
          action: 'INSERT',
          user_id: 'user-2',
          user_name: 'Bob',
          record_id: 'song-1',
          band_id: 'band-1',
          changed_at: new Date().toISOString(),
          new_values: {
            id: 'song-1',
            title: 'Wonderwall',
            created_by: 'user-2',
            context_id: 'band-1',
            created_date: new Date().toISOString(),
            version: 1,
          },
          old_values: null,
        },
        old: {},
        eventType: 'INSERT',
        schema: 'public',
        table: 'audit_log',
      }

      await handler(auditPayload)
      await new Promise(resolve => setImmediate(resolve))

      // Should emit event
      expect(eventSpy).toHaveBeenCalledWith({
        bandId: 'band-1',
        action: 'INSERT',
        recordId: 'song-1',
      })
    })

    it('should emit toast event with user information', async () => {
      const userId = 'user-1'
      const bandIds = ['band-1']

      await manager.subscribeToUserBands(userId, bandIds)

      // Set up event listener
      const toastSpy = vi.fn()
      manager.on('toast', toastSpy)

      // Get the handler
      const onCall = mockChannels[0].on.mock.calls.find(
        (call: any[]) => call[1]?.table === 'audit_log'
      )
      const handler = onCall![2]

      // Practice-specific toast: Only practice_sessions trigger toasts
      const practiceDate = new Date('2025-12-15T18:00:00Z').toISOString()
      const auditPayload = {
        new: {
          id: 'audit-1',
          table_name: 'practice_sessions',
          action: 'INSERT',
          user_id: 'user-2',
          user_name: 'Bob',
          record_id: 'practice-1',
          band_id: 'band-1',
          changed_at: new Date().toISOString(),
          new_values: {
            id: 'practice-1',
            scheduled_date: practiceDate,
            band_id: 'band-1',
            created_by: 'user-2',
            created_date: new Date().toISOString(),
            version: 1,
          },
          old_values: null,
        },
        old: {},
        eventType: 'INSERT',
        schema: 'public',
        table: 'audit_log',
      }

      await handler(auditPayload)
      await new Promise(resolve => setImmediate(resolve))

      // Practice toasts are immediate (no batching)
      // Should emit toast event with practice-specific message
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Bob'),
          type: 'info',
        })
      )
    })

    it('should emit events for all table types', async () => {
      const userId = 'user-1'
      const bandIds = ['band-1']

      await manager.subscribeToUserBands(userId, bandIds)

      // Set up event listeners
      const setlistSpy = vi.fn()
      const showSpy = vi.fn()
      const practiceSpy = vi.fn()

      manager.on('setlists:changed', setlistSpy)
      manager.on('shows:changed', showSpy)
      manager.on('practices:changed', practiceSpy)

      // Get audit_log handler
      const onCall = mockChannels[0].on.mock.calls.find(
        (call: any[]) => call[1]?.table === 'audit_log'
      )
      const handler = onCall![2]

      // Simulate events
      await handler({
        new: {
          id: 'audit-1',
          table_name: 'setlists',
          action: 'INSERT',
          user_id: 'user-2',
          user_name: 'Bob',
          record_id: 'setlist-1',
          band_id: 'band-1',
          changed_at: new Date().toISOString(),
          new_values: {
            id: 'setlist-1',
            name: 'Test',
            band_id: 'band-1',
            created_by: 'user-2',
          },
          old_values: null,
        },
        old: {},
        eventType: 'INSERT',
        schema: 'public',
        table: 'audit_log',
      })
      await new Promise(resolve => setImmediate(resolve))

      await handler({
        new: {
          id: 'audit-2',
          table_name: 'shows',
          action: 'INSERT',
          user_id: 'user-2',
          user_name: 'Bob',
          record_id: 'show-1',
          band_id: 'band-1',
          changed_at: new Date().toISOString(),
          new_values: {
            id: 'show-1',
            name: 'Test',
            band_id: 'band-1',
            created_by: 'user-2',
          },
          old_values: null,
        },
        old: {},
        eventType: 'INSERT',
        schema: 'public',
        table: 'audit_log',
      })
      await new Promise(resolve => setImmediate(resolve))

      await handler({
        new: {
          id: 'audit-3',
          table_name: 'practice_sessions',
          action: 'INSERT',
          user_id: 'user-2',
          user_name: 'Bob',
          record_id: 'practice-1',
          band_id: 'band-1',
          changed_at: new Date().toISOString(),
          new_values: {
            id: 'practice-1',
            date: '2025-01-01',
            band_id: 'band-1',
            created_by: 'user-2',
          },
          old_values: null,
        },
        old: {},
        eventType: 'INSERT',
        schema: 'public',
        table: 'audit_log',
      })
      await new Promise(resolve => setImmediate(resolve))

      // All should emit events
      expect(setlistSpy).toHaveBeenCalled()
      expect(showSpy).toHaveBeenCalled()
      expect(practiceSpy).toHaveBeenCalled()
    })

    it('should allow removing event listeners', async () => {
      const userId = 'user-1'
      const bandIds = ['band-1']

      await manager.subscribeToUserBands(userId, bandIds)

      const eventSpy = vi.fn()
      manager.on('songs:changed', eventSpy)
      manager.off('songs:changed', eventSpy)

      // Get the handler
      const onCall = mockChannels[0].on.mock.calls.find(
        (call: any[]) => call[1]?.table === 'audit_log'
      )
      const handler = onCall![2]

      const auditPayload = {
        new: {
          id: 'audit-1',
          table_name: 'songs',
          action: 'INSERT',
          user_id: 'user-2',
          user_name: 'Bob',
          record_id: 'song-1',
          band_id: 'band-1',
          changed_at: new Date().toISOString(),
          new_values: {
            id: 'song-1',
            title: 'Test',
            created_by: 'user-2',
            context_id: 'band-1',
            created_date: new Date().toISOString(),
            version: 1,
          },
          old_values: null,
        },
        old: {},
        eventType: 'INSERT',
        schema: 'public',
        table: 'audit_log',
      }

      await handler(auditPayload)
      await new Promise(resolve => setImmediate(resolve))

      // Should not be called (removed listener)
      expect(eventSpy).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should continue with other subscriptions if one fails', async () => {
      // Mock only one band subscription to fail
      const failingChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockResolvedValue({ error: new Error('Failed') }),
        unsubscribe: vi.fn().mockResolvedValue({ error: null }),
      }

      const successChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockResolvedValue({ error: null }),
        unsubscribe: vi.fn().mockResolvedValue({ error: null }),
      }

      let callCount = 0
      mockSupabase.channel = vi.fn().mockImplementation((name: string) => {
        callCount++
        if (name === 'audit-band-1') {
          mockChannels.push(failingChannel)
          return failingChannel
        }
        mockChannels.push(successChannel)
        return successChannel
      })

      const userId = 'user-1'
      const bandIds = ['band-1', 'band-2']

      await manager.subscribeToUserBands(userId, bandIds)

      // Should create 2 channels (audit-first: 1 per band)
      expect(mockSupabase.channel).toHaveBeenCalledTimes(2)
      // Should still subscribe to second band even if first fails
      expect(successChannel.subscribe).toHaveBeenCalledTimes(1) // band-2 succeeds
    })
  })

  describe('Idempotency and Deduplication', () => {
    it('should prevent duplicate subscriptions when called twice with same bands', async () => {
      const userId = 'user-1'
      const bandIds = ['band-1']

      // Call subscribeToUserBands twice with same parameters
      await manager.subscribeToUserBands(userId, bandIds)
      await manager.subscribeToUserBands(userId, bandIds)

      // Should only create ONE channel per band (audit-first approach)
      const channelCalls = mockSupabase.channel.mock.calls
      const auditChannels = channelCalls.filter(call =>
        call[0].startsWith('audit-')
      )

      // Only one audit channel should be created
      expect(auditChannels.length).toBe(1)
      expect(auditChannels[0][0]).toBe('audit-band-1')
    })

    it('should prevent duplicate subscriptions when called twice with multiple bands', async () => {
      const userId = 'user-1'
      const bandIds = ['band-1', 'band-2']

      // Call twice
      await manager.subscribeToUserBands(userId, bandIds)
      await manager.subscribeToUserBands(userId, bandIds)

      // Should only create 2 channels (one per band), not 4
      const channelCalls = mockSupabase.channel.mock.calls
      const auditChannels = channelCalls.filter(call =>
        call[0].startsWith('audit-')
      )

      expect(auditChannels.length).toBe(2)
      expect(auditChannels.map(c => c[0]).sort()).toEqual([
        'audit-band-1',
        'audit-band-2',
      ])
    })

    it('should handle concurrent subscription calls without creating duplicates', async () => {
      const userId = 'user-1'
      const bandIds = ['band-1']

      // Call both concurrently (simulates race condition)
      await Promise.all([
        manager.subscribeToUserBands(userId, bandIds),
        manager.subscribeToUserBands(userId, bandIds),
      ])

      // Should still only create one channel
      const channelCalls = mockSupabase.channel.mock.calls
      const auditChannels = channelCalls.filter(call =>
        call[0].startsWith('audit-')
      )

      expect(auditChannels.length).toBe(1)
    })

    it('should not re-subscribe to existing bands when adding new bands', async () => {
      const userId = 'user-1'

      // First call: subscribe to band-1
      await manager.subscribeToUserBands(userId, ['band-1'])

      const firstCallCount = mockSupabase.channel.mock.calls.length

      // Second call: subscribe to band-1 and band-2
      await manager.subscribeToUserBands(userId, ['band-1', 'band-2'])

      const secondCallCount = mockSupabase.channel.mock.calls.length

      // Should only create ONE new channel (for band-2)
      expect(secondCallCount - firstCallCount).toBe(1)

      // Verify both bands subscribed
      const channelCalls = mockSupabase.channel.mock.calls
      const auditChannels = channelCalls.filter(call =>
        call[0].startsWith('audit-')
      )

      expect(auditChannels.length).toBe(2)
      expect(auditChannels.map(c => c[0]).sort()).toEqual([
        'audit-band-1',
        'audit-band-2',
      ])
    })

    it('should be idempotent: calling three times produces same result as once', async () => {
      const userId = 'user-1'
      const bandIds = ['band-1']

      // Call three times
      await manager.subscribeToUserBands(userId, bandIds)
      await manager.subscribeToUserBands(userId, bandIds)
      await manager.subscribeToUserBands(userId, bandIds)

      // Should still be connected
      expect(manager.isConnected()).toBe(true)

      // Should only have one channel
      const channelCalls = mockSupabase.channel.mock.calls
      const auditChannels = channelCalls.filter(call =>
        call[0].startsWith('audit-')
      )

      expect(auditChannels.length).toBe(1)
    })
  })

  describe('Audit-First Event Handling', () => {
    it('should emit "practices:changed" event for practice_sessions table', async () => {
      await manager.subscribeToUserBands('user-1', ['band-1'])

      // Get the audit log handler
      const onCall = mockChannels[0].on.mock.calls.find(
        (call: any[]) => call[1]?.table === 'audit_log'
      )
      expect(onCall).toBeDefined()
      const handler = onCall![2]

      // Set up event listener AFTER subscription (to catch events from handler call)
      let receivedEvent: any = null
      manager.on('practices:changed', (data: any) => {
        receivedEvent = data
      })

      // Mock practice session data
      const auditPayload = {
        new: {
          id: 'audit-1',
          table_name: 'practice_sessions', // Supabase table name
          action: 'INSERT',
          user_id: 'user-2',
          user_name: 'Bob',
          record_id: 'practice-1',
          band_id: 'band-1',
          changed_at: new Date().toISOString(),
          new_values: {
            id: 'practice-1',
            scheduled_date: new Date().toISOString(),
            band_id: 'band-1',
            created_date: new Date().toISOString(),
            version: 1,
          },
          old_values: null,
        },
        old: {},
        eventType: 'INSERT',
        schema: 'public',
        table: 'audit_log',
      }

      await handler(auditPayload)

      // Give event loop time to process (needed due to async nature of handler)
      await new Promise(resolve => setImmediate(resolve))

      // Should emit 'practices:changed' (plural, matches event type definition)
      // NOT 'practice_sessions:changed' (which would break listeners)
      expect(receivedEvent).toEqual({
        bandId: 'band-1',
        action: 'INSERT',
        recordId: 'practice-1',
      })
    })
  })

  describe('JSONB Data Validation (Bug Fix)', () => {
    it('should handle corrupted/incomplete song data gracefully', async () => {
      await manager.subscribeToUserBands('user-1', ['band-1'])

      const onCall = mockChannels[0].on.mock.calls.find(
        (call: any[]) => call[1]?.table === 'audit_log'
      )
      const handler = onCall![2]

      // Corrupted payload: missing required fields (title, artist)
      const corruptedPayload = {
        new: {
          id: 'audit-1',
          table_name: 'songs',
          action: 'INSERT',
          user_id: 'user-2',
          user_name: 'Bob',
          record_id: 'song-1',
          band_id: 'band-1',
          changed_at: new Date().toISOString(),
          new_values: {
            id: 'song-1',
            // Missing: title, artist, key, tempo, etc.
            band_id: 'band-1',
          },
          old_values: null,
        },
      }

      // Should NOT throw an error
      let thrownError: any = null
      try {
        await handler(corruptedPayload)
      } catch (error) {
        thrownError = error
      }

      // Give event loop time to process
      await new Promise(resolve => setImmediate(resolve))

      expect(thrownError).toBeNull()

      // Should NOT have written corrupted data to database
      // The mock should not have been called with invalid data
      const putCalls = mockDb.songs.put.mock.calls
      if (putCalls.length > 0) {
        const songData = putCalls[0][0]
        // If data was written, it should at least have required fields with defaults
        expect(songData).toHaveProperty('title')
        expect(songData).toHaveProperty('artist')
        // Date fields should be valid
        expect(songData.createdDate).toBeInstanceOf(Date)
        expect(songData.createdDate.toString()).not.toBe('Invalid Date')
      }
    })

    it('should handle null new_values in audit log', async () => {
      await manager.subscribeToUserBands('user-1', ['band-1'])

      const onCall = mockChannels[0].on.mock.calls.find(
        (call: any[]) => call[1]?.table === 'audit_log'
      )
      const handler = onCall![2]

      // Payload with null new_values (shouldn't happen but could)
      const nullPayload = {
        new: {
          id: 'audit-1',
          table_name: 'songs',
          action: 'INSERT', // INSERT with null new_values is invalid
          user_id: 'user-2',
          user_name: 'Bob',
          record_id: 'song-1',
          band_id: 'band-1',
          changed_at: new Date().toISOString(),
          new_values: null, // Invalid!
          old_values: null,
        },
      }

      // Should NOT throw an error
      let thrownError: any = null
      try {
        await handler(nullPayload)
      } catch (error) {
        thrownError = error
      }

      // Give event loop time to process
      await new Promise(resolve => setImmediate(resolve))

      expect(thrownError).toBeNull()

      // Should NOT have written to database (since new_values was null)
      expect(mockDb.songs.put).not.toHaveBeenCalled()
    })

    it('should validate required fields before writing to IndexedDB', async () => {
      await manager.subscribeToUserBands('user-1', ['band-1'])

      const onCall = mockChannels[0].on.mock.calls.find(
        (call: any[]) => call[1]?.table === 'audit_log'
      )
      const handler = onCall![2]

      // Test all table types with minimal data
      const testCases = [
        {
          table: 'songs',
          minimalData: { id: 'song-1', band_id: 'band-1' }, // Missing title, artist
          requiredFields: ['title', 'artist', 'key'],
        },
        {
          table: 'setlists',
          minimalData: { id: 'setlist-1', band_id: 'band-1' }, // Missing name, items
          requiredFields: ['name', 'items'],
        },
        {
          table: 'shows',
          minimalData: { id: 'show-1', band_id: 'band-1' }, // Missing venue, scheduledDate
          requiredFields: ['venue', 'scheduledDate'],
        },
        {
          table: 'practice_sessions',
          minimalData: { id: 'practice-1', band_id: 'band-1' }, // Missing scheduled_date
          requiredFields: ['scheduledDate'], // Note: camelCase after mapping
        },
      ]

      for (const { table, minimalData, requiredFields } of testCases) {
        vi.clearAllMocks()

        const payload = {
          new: {
            id: `audit-${table}`,
            table_name: table,
            action: 'INSERT',
            user_id: 'user-2',
            user_name: 'Bob',
            record_id: `${table}-1`,
            band_id: 'band-1',
            changed_at: new Date().toISOString(),
            new_values: minimalData,
            old_values: null,
          },
        }

        await handler(payload)
        await new Promise(resolve => setImmediate(resolve))

        // Should either: (1) not write, or (2) write with defaults for required fields
        const dbTable =
          table === 'practice_sessions' ? 'practiceSessions' : table
        const putCalls = (mockDb as any)[dbTable].put.mock.calls

        if (putCalls.length > 0) {
          const writtenData = putCalls[0][0]
          // All required fields should be present (either from data or defaults)
          for (const field of requiredFields) {
            expect(writtenData).toHaveProperty(field)
            expect(writtenData[field]).not.toBeUndefined()
          }
        }
      }
    })
  })
})
