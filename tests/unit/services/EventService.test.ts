import { describe, it, expect, vi, beforeEach } from 'vitest'

// Chainable + thenable Supabase builder with a per-call result queue (see
// FriendService.test.ts). getEvents fires two queries: events (nested
// participants + lineup count), then casting_assignments.
const h = vi.hoisted(() => {
  const state: {
    queue: { data: unknown; error: unknown }[]
    fallback: { data: unknown; error: unknown }
    user: { id: string } | null
  } = { queue: [], fallback: { data: null, error: null }, user: { id: 'me' } }
  const pull = () =>
    state.queue.length ? state.queue.shift()! : state.fallback
  const builder: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'in', 'order', 'insert', 'update']) {
    builder[m] = vi.fn(() => builder)
  }
  builder.then = (resolve: (v: unknown) => void) => resolve(pull())
  const from = vi.fn(() => builder)
  const auth = {
    getUser: vi.fn(() => Promise.resolve({ data: { user: state.user } })),
  }
  return { state, builder, from, auth }
})

vi.mock('../../../src/services/supabase/client', () => ({
  getSupabaseClient: () => ({ from: h.from, auth: h.auth }),
}))

import { EventService } from '../../../src/services/EventService'

const b = h.builder as Record<string, ReturnType<typeof vi.fn>>

const eventRow = (
  id: string,
  participants: { user_id: string; rsvp: string; name: string }[],
  lineupCount: number
) => ({
  id,
  name: `Event ${id}`,
  venue: null,
  scheduled_date: '2026-08-01T00:00:00Z',
  status: 'scheduled',
  visibility: 'unlisted',
  host_user_id: 'me',
  band_id: null,
  allow_suggestions: true,
  auto_approve: false,
  short_code: 'ABC123',
  event_participants: participants.map(p => ({
    user_id: p.user_id,
    rsvp: p.rsvp,
    users: { name: p.name },
  })),
  event_lineup_items: [{ count: lineupCount }],
})

beforeEach(() => {
  h.state.queue = []
  h.state.fallback = { data: null, error: null }
  h.state.user = { id: 'me' }
  vi.clearAllMocks()
})

describe('EventService.getEvents', () => {
  it('requests rsvp + lineup count and the primary-cast query', async () => {
    h.state.queue = [
      { data: [eventRow('ev1', [], 0)], error: null },
      { data: [], error: null },
    ]
    await EventService.getEvents()

    const selectArg = b.select.mock.calls[0][0] as string
    expect(selectArg).toContain('event_participants(user_id, rsvp')
    expect(selectArg).toContain('event_lineup_items(count)')
    // The casting query is scoped to event primaries.
    expect(b.eq).toHaveBeenCalledWith('context_type', 'event')
    expect(b.eq).toHaveBeenCalledWith('is_primary', true)
    expect(b.in).toHaveBeenCalledWith('context_id', ['ev1'])
  })

  it('counts "going" RSVPs and the caller’s own RSVP', async () => {
    h.state.queue = [
      {
        data: [
          eventRow(
            'ev1',
            [
              { user_id: 'me', rsvp: 'going', name: 'Me' },
              { user_id: 'u2', rsvp: 'maybe', name: 'U2' },
              { user_id: 'u3', rsvp: 'going', name: 'U3' },
            ],
            2
          ),
        ],
        error: null,
      },
      { data: [], error: null },
    ]
    const [ev] = await EventService.getEvents()
    expect(ev.goingCount).toBe(2)
    expect(ev.myRsvp).toBe('going')
    expect(ev.participantCount).toBe(3)
  })

  it('computes castPct from distinct (slot, role) primaries ÷ (lineup × 5)', async () => {
    h.state.queue = [
      { data: [eventRow('ev1', [], 2)], error: null }, // 2 songs × 5 = 10 parts
      {
        data: [
          { context_id: 'ev1', event_lineup_item_id: 's1', role_key: 'bass' },
          { context_id: 'ev1', event_lineup_item_id: 's1', role_key: 'vox' },
          // Duplicate primary on the same (slot, role) counts once.
          { context_id: 'ev1', event_lineup_item_id: 's1', role_key: 'vox' },
          { context_id: 'ev1', event_lineup_item_id: 's2', role_key: 'guitar' },
          { context_id: 'ev1', event_lineup_item_id: 's2', role_key: 'keys' },
          // Slot-less rows are ignored.
          { context_id: 'ev1', event_lineup_item_id: null, role_key: 'drums' },
        ],
        error: null,
      },
    ]
    const [ev] = await EventService.getEvents()
    // 4 distinct slot+role pairs ÷ 10 = 40%
    expect(ev.castPct).toBe(40)
  })

  it('leaves castPct undefined when the lineup is empty', async () => {
    h.state.queue = [
      { data: [eventRow('ev1', [], 0)], error: null },
      { data: [], error: null },
    ]
    const [ev] = await EventService.getEvents()
    expect(ev.castPct).toBeUndefined()
  })

  it('caps castPct at 100 when assignments exceed the estimate', async () => {
    h.state.queue = [
      { data: [eventRow('ev1', [], 1)], error: null }, // 5 parts
      {
        // 8 distinct slot+role pairs > 5 estimated parts.
        data: Array.from({ length: 8 }, (_, i) => ({
          context_id: 'ev1',
          event_lineup_item_id: `s${i}`,
          role_key: 'guitar',
        })),
        error: null,
      },
    ]
    const [ev] = await EventService.getEvents()
    expect(ev.castPct).toBe(100)
  })

  it('returns [] on a query error', async () => {
    h.state.queue = [{ data: null, error: { message: 'boom' } }]
    expect(await EventService.getEvents()).toEqual([])
  })
})
