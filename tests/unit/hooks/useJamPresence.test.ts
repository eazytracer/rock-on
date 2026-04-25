/**
 * Unit tests for useJamPresence — anonymous-viewer presence tracking
 * via Supabase Realtime presence channels.
 *
 * The hook has two responsibilities:
 *   1. Subscribe to a per-session presence channel so other clients on
 *      the same channel see this client's presence updates.
 *   2. Exposes the current roster of presences as a stable React state.
 *
 * The two modes — watcher (selfName provided) vs listener (selfName
 * omitted) — diverge only in whether the hook calls `channel.track()`
 * after subscribe; presenceState reading is identical.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

// ============================================================================
// Mocks
// ============================================================================

/**
 * Mock supabase channel — captures registered handlers so the test can
 * synthesise presence events. Mirrors the chainable supabase-js shape
 * (`.on(...).on(...).subscribe(...)`).
 */
type PresenceHandler = () => void
interface MockChannel {
  on: ReturnType<typeof vi.fn>
  subscribe: ReturnType<typeof vi.fn>
  track: ReturnType<typeof vi.fn>
  untrack: ReturnType<typeof vi.fn>
  presenceState: ReturnType<typeof vi.fn>
  __triggerSync: () => void
  __setPresenceState: (state: Record<string, unknown[]>) => void
  __subscribeCb?: (status: string) => void
}

function makeMockChannel(): MockChannel {
  let presenceState: Record<string, unknown[]> = {}
  const handlers: Record<string, PresenceHandler> = {}

  const channel: MockChannel = {
    on: vi.fn((_type, opts, handler) => {
      handlers[opts.event] = handler
      return channel
    }),
    subscribe: vi.fn(cb => {
      channel.__subscribeCb = cb
      return channel
    }),
    track: vi.fn().mockResolvedValue(undefined),
    untrack: vi.fn().mockResolvedValue(undefined),
    presenceState: vi.fn(() => presenceState),
    __triggerSync: () => handlers.sync?.(),
    __setPresenceState: state => {
      presenceState = state
    },
  }

  return channel
}

let mockChannel: MockChannel
const mockSupabase = {
  channel: vi.fn(),
  removeChannel: vi.fn().mockResolvedValue(undefined),
}

vi.mock('../../../src/services/supabase/client', () => ({
  getSupabaseClient: vi.fn(() => mockSupabase),
}))

import { useJamPresence } from '../../../src/hooks/useJamPresence'
import { getSupabaseClient } from '../../../src/services/supabase/client'

// ============================================================================
// Setup
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks()
  // Each test gets a fresh channel; tests that need to inspect calls do
  // so via the captured `mockChannel` reference.
  mockChannel = makeMockChannel()
  mockSupabase.channel.mockReturnValue(mockChannel)
  mockSupabase.removeChannel.mockResolvedValue(undefined)
  // Default to "supabase available" — tests that need the no-supabase
  // path override this.
  vi.mocked(getSupabaseClient).mockReturnValue(
    mockSupabase as unknown as ReturnType<typeof getSupabaseClient>
  )
  // Ensure session storage is consistent between tests. The hook reads
  // a stable per-tab key from sessionStorage so two calls within the
  // same test render get the same key — but across tests we want
  // independence, so clear.
  if (typeof window !== 'undefined') window.sessionStorage.clear()
})

// ============================================================================
// Tests
// ============================================================================

describe('useJamPresence', () => {
  describe('subscription lifecycle', () => {
    it('does not subscribe when disabled', () => {
      renderHook(() => useJamPresence({ shortCode: 'ABC123', enabled: false }))
      expect(mockSupabase.channel).not.toHaveBeenCalled()
    })

    it('does not subscribe when shortCode is missing', () => {
      renderHook(() => useJamPresence({ shortCode: undefined, enabled: true }))
      expect(mockSupabase.channel).not.toHaveBeenCalled()
    })

    it('subscribes to jam:presence:<shortCode> when enabled', () => {
      renderHook(() => useJamPresence({ shortCode: 'ABC123', enabled: true }))
      expect(mockSupabase.channel).toHaveBeenCalledWith(
        'jam:presence:ABC123',
        expect.objectContaining({
          config: expect.objectContaining({
            presence: expect.objectContaining({
              key: expect.any(String),
            }),
          }),
        })
      )
    })

    it('cleans up the channel on unmount', () => {
      const { unmount } = renderHook(() =>
        useJamPresence({ shortCode: 'ABC123', enabled: true })
      )
      unmount()
      expect(mockChannel.untrack).toHaveBeenCalled()
      expect(mockSupabase.removeChannel).toHaveBeenCalledWith(mockChannel)
    })

    it('returns an empty list and does not throw when supabase client is unavailable', () => {
      vi.mocked(getSupabaseClient).mockImplementationOnce(() => {
        throw new Error('Supabase auth not enabled')
      })
      const { result } = renderHook(() =>
        useJamPresence({ shortCode: 'ABC123', enabled: true })
      )
      expect(result.current.watchers).toEqual([])
      expect(mockSupabase.channel).not.toHaveBeenCalled()
    })
  })

  describe('watcher vs listener modes', () => {
    it('tracks self when selfName is provided', async () => {
      renderHook(() =>
        useJamPresence({
          shortCode: 'ABC123',
          selfName: 'Alice',
          enabled: true,
        })
      )
      // Trigger the subscribe callback the way supabase would.
      await act(async () => {
        await mockChannel.__subscribeCb?.('SUBSCRIBED')
      })
      expect(mockChannel.track).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Alice',
          joinedAt: expect.any(Number),
        })
      )
    })

    it('tracks an empty name (lurker) when selfName is the empty string', async () => {
      renderHook(() =>
        useJamPresence({
          shortCode: 'ABC123',
          selfName: '',
          enabled: true,
        })
      )
      await act(async () => {
        await mockChannel.__subscribeCb?.('SUBSCRIBED')
      })
      expect(mockChannel.track).toHaveBeenCalledWith(
        expect.objectContaining({ name: '' })
      )
    })

    it('does NOT track self when selfName is omitted (listener mode)', async () => {
      renderHook(() => useJamPresence({ shortCode: 'ABC123', enabled: true }))
      await act(async () => {
        await mockChannel.__subscribeCb?.('SUBSCRIBED')
      })
      expect(mockChannel.track).not.toHaveBeenCalled()
    })

    it('does not track when subscribe status is not SUBSCRIBED', async () => {
      renderHook(() =>
        useJamPresence({
          shortCode: 'ABC123',
          selfName: 'Alice',
          enabled: true,
        })
      )
      await act(async () => {
        await mockChannel.__subscribeCb?.('CHANNEL_ERROR')
      })
      expect(mockChannel.track).not.toHaveBeenCalled()
    })
  })

  describe('watchers state', () => {
    it('exposes the current presence roster', async () => {
      const { result } = renderHook(() =>
        useJamPresence({ shortCode: 'ABC123', enabled: true })
      )

      mockChannel.__setPresenceState({
        'key-alice': [{ name: 'Alice', joinedAt: 1000 }],
        'key-bob': [{ name: 'Bob', joinedAt: 2000 }],
      })
      await act(async () => {
        mockChannel.__triggerSync()
      })

      await waitFor(() => {
        expect(result.current.watchers).toHaveLength(2)
      })
      // Sorted by joinedAt ascending — Alice joined first.
      expect(result.current.watchers[0].name).toBe('Alice')
      expect(result.current.watchers[1].name).toBe('Bob')
    })

    it('renders empty-string name as a lurker (kept in roster)', async () => {
      const { result } = renderHook(() =>
        useJamPresence({ shortCode: 'ABC123', enabled: true })
      )

      mockChannel.__setPresenceState({
        'key-lurker': [{ name: '', joinedAt: 500 }],
      })
      await act(async () => {
        mockChannel.__triggerSync()
      })

      await waitFor(() => {
        expect(result.current.watchers).toHaveLength(1)
      })
      expect(result.current.watchers[0].name).toBe('')
    })

    it('handles a key with multiple payloads by taking the most recent', async () => {
      // Edge case: a single client tracks twice (rare, but documented as
      // a possibility in the supabase docs). The hook flattens by key
      // and keeps the *latest* payload — which is what the user-visible
      // name should be.
      const { result } = renderHook(() =>
        useJamPresence({ shortCode: 'ABC123', enabled: true })
      )
      mockChannel.__setPresenceState({
        'key-alice': [
          { name: 'Alice (old)', joinedAt: 1000 },
          { name: 'Alice (new)', joinedAt: 1500 },
        ],
      })
      await act(async () => {
        mockChannel.__triggerSync()
      })
      await waitFor(() => {
        expect(result.current.watchers[0]?.name).toBe('Alice (new)')
      })
    })

    it('coerces non-string names to empty string defensively', async () => {
      // Supabase realtime is JSON-over-the-wire, so a malformed client
      // could send a non-string. The hook should not crash.
      const { result } = renderHook(() =>
        useJamPresence({ shortCode: 'ABC123', enabled: true })
      )
      mockChannel.__setPresenceState({
        'key-bad': [{ name: 42 as unknown as string, joinedAt: 100 }],
      })
      await act(async () => {
        mockChannel.__triggerSync()
      })
      await waitFor(() => {
        expect(result.current.watchers).toHaveLength(1)
      })
      expect(result.current.watchers[0].name).toBe('')
    })

    it('filters out keys with empty payload arrays', async () => {
      const { result } = renderHook(() =>
        useJamPresence({ shortCode: 'ABC123', enabled: true })
      )
      mockChannel.__setPresenceState({
        'key-ghost': [],
        'key-alice': [{ name: 'Alice', joinedAt: 100 }],
      })
      await act(async () => {
        mockChannel.__triggerSync()
      })
      await waitFor(() => {
        expect(result.current.watchers).toHaveLength(1)
      })
      expect(result.current.watchers[0].name).toBe('Alice')
    })
  })

  describe('changing selfName', () => {
    it('re-tracks the new name when selfName changes', async () => {
      const { rerender } = renderHook(
        ({ selfName }) =>
          useJamPresence({
            shortCode: 'ABC123',
            selfName,
            enabled: true,
          }),
        { initialProps: { selfName: 'Alice' } }
      )

      await act(async () => {
        await mockChannel.__subscribeCb?.('SUBSCRIBED')
      })
      expect(mockChannel.track).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Alice' })
      )

      // Renaming → effect re-runs → new channel + new track call.
      const newChannel = makeMockChannel()
      mockSupabase.channel.mockReturnValueOnce(newChannel)
      rerender({ selfName: 'Alice 2' })

      await act(async () => {
        await newChannel.__subscribeCb?.('SUBSCRIBED')
      })
      expect(newChannel.track).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Alice 2' })
      )
    })
  })
})
