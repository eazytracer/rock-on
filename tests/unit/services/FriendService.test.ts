import { describe, it, expect, vi, beforeEach } from 'vitest'

// Chainable + thenable Supabase builder mock with a per-call result queue, so a
// method that fires several queries (insert → select → update) can return a
// different row each step. auth.getUser resolves the "current user".
const h = vi.hoisted(() => {
  const state: {
    queue: { data: unknown; error: unknown }[]
    fallback: { data: unknown; error: unknown }
    user: { id: string } | null
  } = { queue: [], fallback: { data: null, error: null }, user: { id: 'me' } }
  const pull = () =>
    state.queue.length ? state.queue.shift()! : state.fallback
  const builder: Record<string, unknown> = {}
  for (const m of [
    'select',
    'eq',
    'neq',
    'ilike',
    'in',
    'limit',
    'order',
    'insert',
    'update',
    'delete',
  ]) {
    builder[m] = vi.fn(() => builder)
  }
  builder.single = vi.fn(() => Promise.resolve(pull()))
  builder.maybeSingle = vi.fn(() => Promise.resolve(pull()))
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

import { FriendService } from '../../../src/services/FriendService'

const b = h.builder as Record<string, ReturnType<typeof vi.fn>>

beforeEach(() => {
  h.state.queue = []
  h.state.fallback = { data: null, error: null }
  h.state.user = { id: 'me' }
  vi.clearAllMocks()
})

describe('FriendService.searchByName', () => {
  it('returns nothing for a query shorter than 2 chars (no query fired)', async () => {
    const out = await FriendService.searchByName('a')
    expect(out).toEqual([])
    expect(h.from).not.toHaveBeenCalled()
  })

  it('queries discoverable profiles, excludes self, maps rows', async () => {
    h.state.queue = [
      {
        data: [
          { user_id: 'u2', display_name: 'Zoe Martin' },
          { user_id: 'u3', display_name: null }, // dropped (no name)
        ],
        error: null,
      },
    ]
    const out = await FriendService.searchByName('zoe')

    expect(h.from).toHaveBeenCalledWith('user_profiles')
    expect(b.eq).toHaveBeenCalledWith('discoverable', true)
    expect(b.neq).toHaveBeenCalledWith('user_id', 'me')
    expect(out).toEqual([{ userId: 'u2', name: 'Zoe Martin' }])
  })

  it('escapes LIKE wildcards in the query', async () => {
    h.state.queue = [{ data: [], error: null }]
    await FriendService.searchByName('50%_off')
    expect(b.ilike).toHaveBeenCalledWith('display_name', '%50\\%\\_off%')
  })

  it('returns [] on a query error', async () => {
    h.state.queue = [{ data: null, error: { message: 'boom' } }]
    expect(await FriendService.searchByName('zoe')).toEqual([])
  })
})

describe('FriendService.sendRequestToUser', () => {
  it('inserts a pending request and resolves the target name', async () => {
    h.state.queue = [
      { data: null, error: null }, // insert ok
      { data: [{ user_id: 'u2', display_name: 'Zoe Martin' }], error: null }, // namesFor
    ]
    const res = await FriendService.sendRequestToUser('u2')

    expect(b.insert).toHaveBeenCalledWith({
      requester_id: 'me',
      addressee_id: 'u2',
    })
    expect(res).toEqual({ ok: true, name: 'Zoe Martin' })
  })

  it('refuses to friend yourself', async () => {
    const res = await FriendService.sendRequestToUser('me')
    expect(res.ok).toBe(false)
    expect(b.insert).not.toHaveBeenCalled()
  })

  it('reactivates a stale declined request on unique-violation', async () => {
    h.state.queue = [
      { data: null, error: { code: '23505' } }, // insert conflict
      { data: { id: 'r1', status: 'declined' }, error: null }, // existing row
      { data: null, error: null }, // update → pending
      { data: [{ user_id: 'u2', display_name: 'Zoe' }], error: null }, // namesFor
    ]
    const res = await FriendService.sendRequestToUser('u2')
    expect(b.update).toHaveBeenCalledWith({
      status: 'pending',
      responded_date: null,
    })
    expect(res).toEqual({ ok: true, name: 'Zoe' })
  })

  it('reports an already-pending request without reactivating', async () => {
    h.state.queue = [
      { data: null, error: { code: '23505' } }, // insert conflict
      { data: { id: 'r1', status: 'pending' }, error: null }, // existing pending
    ]
    const res = await FriendService.sendRequestToUser('u2')
    expect(res.ok).toBe(false)
    expect(b.update).not.toHaveBeenCalled()
  })
})
