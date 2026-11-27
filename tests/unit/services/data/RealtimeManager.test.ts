import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Use vi.hoisted to ensure mocks are available during hoisting
const { mockChannels, mockSupabase } = vi.hoisted(() => {
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

  return { mockChannels, mockSupabase }
})

// Mock Supabase client
vi.mock('../../../../src/services/supabase/client', () => ({
  getSupabaseClient: () => mockSupabase,
}))

// Import after mocks
import { RealtimeManager } from '../../../../src/services/data/RealtimeManager'

/**
 * RealtimeManager is a pure change-notifier after the Phase 2 data-layer
 * simplification: it subscribes to each band's audit_log channel and, on a
 * matching event, emits a `{entity}:changed` event (consumed by
 * useRealtimeInvalidate) plus a toast for other users' changes. It no longer
 * keeps a local IndexedDB mirror, so these tests assert emission + toast
 * behaviour, NOT data application.
 */
describe('RealtimeManager', () => {
  let manager: RealtimeManager

  const auditEvent = (overrides: Record<string, any> = {}) => ({
    new: {
      id: 'audit-1',
      table_name: 'songs',
      action: 'INSERT',
      user_id: 'user-2',
      user_name: 'Bob',
      record_id: 'song-1',
      band_id: 'band-1',
      changed_at: new Date().toISOString(),
      new_values: { id: 'song-1', title: 'Wonderwall' },
      old_values: null,
      ...overrides,
    },
    old: {},
    eventType: 'INSERT',
    schema: 'public',
    table: 'audit_log',
  })

  const getAuditHandler = () => {
    const onCall = mockChannels[0].on.mock.calls.find(
      (call: any[]) => call[1]?.table === 'audit_log'
    )
    expect(onCall).toBeDefined()
    return onCall![2]
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockChannels.length = 0
    manager = new RealtimeManager()
  })

  afterEach(async () => {
    await manager.unsubscribeAll()
  })

  describe('Subscription Management', () => {
    it('should subscribe to one audit_log channel per band', async () => {
      await manager.subscribeToUserBands('user-1', ['band-1'])

      expect(mockSupabase.channel).toHaveBeenCalledWith('audit-band-1')
      expect(mockChannels[0].on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          table: 'audit_log',
          event: 'INSERT',
          filter: 'band_id=eq.band-1',
        }),
        expect.any(Function)
      )
      expect(mockChannels[0].subscribe).toHaveBeenCalledTimes(1)
    })

    it('should subscribe to multiple bands simultaneously', async () => {
      await manager.subscribeToUserBands('user-1', ['band-1', 'band-2'])

      expect(mockSupabase.channel).toHaveBeenCalledWith('audit-band-1')
      expect(mockSupabase.channel).toHaveBeenCalledWith('audit-band-2')
      expect(mockSupabase.channel).toHaveBeenCalledTimes(2)
    })

    it('should track connection status', async () => {
      expect(manager.isConnected()).toBe(false)
      await manager.subscribeToUserBands('user-1', ['band-1'])
      expect(manager.isConnected()).toBe(true)
    })
  })

  describe('Change event emission', () => {
    it('should emit songs:changed with the actor userId on a remote change', async () => {
      await manager.subscribeToUserBands('user-1', ['band-1'])
      const eventSpy = vi.fn()
      manager.on('songs:changed', eventSpy)

      await getAuditHandler()(auditEvent())
      await new Promise(resolve => setImmediate(resolve))

      expect(eventSpy).toHaveBeenCalledWith({
        bandId: 'band-1',
        action: 'INSERT',
        recordId: 'song-1',
        userId: 'user-2',
      })
    })

    it('should still emit change events for the current user (cross-device sync)', async () => {
      await manager.subscribeToUserBands('user-1', ['band-1'])
      const eventSpy = vi.fn()
      manager.on('songs:changed', eventSpy)

      await getAuditHandler()(
        auditEvent({ user_id: 'user-1', user_name: 'Alice' })
      )
      await new Promise(resolve => setImmediate(resolve))

      // Same user on another device still needs the invalidation signal.
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({ recordId: 'song-1', userId: 'user-1' })
      )
    })

    it('should map practice_sessions to the practices:changed event', async () => {
      await manager.subscribeToUserBands('user-1', ['band-1'])
      const practiceSpy = vi.fn()
      manager.on('practices:changed', practiceSpy)

      await getAuditHandler()(
        auditEvent({
          table_name: 'practice_sessions',
          record_id: 'practice-1',
          new_values: { id: 'practice-1', scheduled_date: '2025-01-01' },
        })
      )
      await new Promise(resolve => setImmediate(resolve))

      expect(practiceSpy).toHaveBeenCalledWith(
        expect.objectContaining({ recordId: 'practice-1' })
      )
    })

    it('should emit change events for setlists, shows, and practices', async () => {
      await manager.subscribeToUserBands('user-1', ['band-1'])
      const setlistSpy = vi.fn()
      const showSpy = vi.fn()
      const practiceSpy = vi.fn()
      manager.on('setlists:changed', setlistSpy)
      manager.on('shows:changed', showSpy)
      manager.on('practices:changed', practiceSpy)
      const handler = getAuditHandler()

      await handler(
        auditEvent({ table_name: 'setlists', record_id: 'setlist-1' })
      )
      await handler(auditEvent({ table_name: 'shows', record_id: 'show-1' }))
      await handler(
        auditEvent({ table_name: 'practice_sessions', record_id: 'practice-1' })
      )
      await new Promise(resolve => setImmediate(resolve))

      expect(setlistSpy).toHaveBeenCalled()
      expect(showSpy).toHaveBeenCalled()
      expect(practiceSpy).toHaveBeenCalled()
    })

    it('should allow removing event listeners', async () => {
      await manager.subscribeToUserBands('user-1', ['band-1'])
      const eventSpy = vi.fn()
      manager.on('songs:changed', eventSpy)
      manager.off('songs:changed', eventSpy)

      await getAuditHandler()(auditEvent())
      await new Promise(resolve => setImmediate(resolve))

      expect(eventSpy).not.toHaveBeenCalled()
    })

    it('should ignore malformed audit payloads without throwing', async () => {
      await manager.subscribeToUserBands('user-1', ['band-1'])
      const eventSpy = vi.fn()
      manager.on('songs:changed', eventSpy)

      await getAuditHandler()({ new: { id: 'x' }, old: {} })
      await new Promise(resolve => setImmediate(resolve))

      expect(eventSpy).not.toHaveBeenCalled()
    })
  })

  describe('Toast notifications', () => {
    it("should emit a toast for another user's practice change (immediate)", async () => {
      await manager.subscribeToUserBands('user-1', ['band-1'])
      const toastSpy = vi.fn()
      manager.on('toast', toastSpy)

      await getAuditHandler()(
        auditEvent({
          table_name: 'practice_sessions',
          record_id: 'practice-1',
          new_values: {
            id: 'practice-1',
            scheduled_date: new Date('2025-12-15T18:00:00Z').toISOString(),
          },
        })
      )
      await new Promise(resolve => setImmediate(resolve))

      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Bob'),
          type: 'info',
        })
      )
    })

    it("should NOT emit a toast for the current user's own change", async () => {
      await manager.subscribeToUserBands('user-1', ['band-1'])
      const toastSpy = vi.fn()
      manager.on('toast', toastSpy)

      await getAuditHandler()(
        auditEvent({
          table_name: 'practice_sessions',
          user_id: 'user-1',
          user_name: 'Alice',
          new_values: { id: 'practice-1', scheduled_date: '2025-01-01' },
        })
      )
      await new Promise(resolve => setImmediate(resolve))

      expect(toastSpy).not.toHaveBeenCalled()
    })

    it('should batch multiple rapid song changes into one toast', async () => {
      await manager.subscribeToUserBands('user-1', ['band-1'])
      const toastSpy = vi.fn()
      manager.on('toast', toastSpy)
      const handler = getAuditHandler()

      for (let i = 1; i <= 3; i++) {
        await handler(
          auditEvent({
            id: `audit-${i}`,
            record_id: `song-${i}`,
            new_values: { id: `song-${i}`, title: `Song ${i}` },
          })
        )
        await new Promise(resolve => setImmediate(resolve))
      }

      // Batch window flushes into a single "3 changes by Bob" toast.
      await new Promise(resolve => setTimeout(resolve, 2500))

      expect(toastSpy).toHaveBeenCalledTimes(1)
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Bob') })
      )
    })
  })

  describe('Reconnection Logic', () => {
    it('should detect disconnection', async () => {
      await manager.subscribeToUserBands('user-1', ['band-1'])
      expect(manager.isConnected()).toBe(true)

      manager.handleDisconnect()
      expect(manager.isConnected()).toBe(false)
    })

    it('should attempt reconnection', async () => {
      await manager.subscribeToUserBands('user-1', ['band-1'])
      manager.handleDisconnect()

      await manager.reconnect()
      expect(manager.isConnected()).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should continue with other subscriptions if one fails', async () => {
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
      mockSupabase.channel = vi.fn().mockImplementation(() => {
        callCount++
        return callCount === 1 ? failingChannel : successChannel
      })

      await manager.subscribeToUserBands('user-1', ['band-1', 'band-2'])

      // Both bands attempted despite the first failing.
      expect(mockSupabase.channel).toHaveBeenCalledTimes(2)
    })
  })
})
