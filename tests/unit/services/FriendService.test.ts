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
  const rpc = vi.fn(() => Promise.resolve(pull()))
  return { state, builder, from, auth, rpc }
})

vi.mock('../../../src/services/supabase/client', () => ({
  getSupabaseClient: () => ({ from: h.from, auth: h.auth, rpc: h.rpc }),
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
  it('returns nothing for a query shorter than 2 chars (no RPC fired)', async () => {
    const out = await FriendService.searchByName('a')
    expect(out).toEqual([])
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('maps findable people from find_people', async () => {
    h.state.queue = [
      {
        data: [
          {
            user_id: 'u2',
            name: 'Zoe Martin',
            instruments: ['Bass', 'Vocals'],
            personal_color: '#4ade80',
            mutual_count: 2,
          },
          {
            user_id: 'u3',
            name: null,
            instruments: [],
            personal_color: null,
            mutual_count: 0,
          }, // dropped (no name)
        ],
        error: null,
      },
    ]
    const out = await FriendService.searchByName(' zoe ')

    expect(h.rpc).toHaveBeenCalledWith('find_people', { p_query: 'zoe' })
    expect(out).toEqual([
      {
        userId: 'u2',
        name: 'Zoe Martin',
        instruments: ['Bass', 'Vocals'],
        color: '#4ade80',
        mutualCount: 2,
      },
    ])
  })

  it('throws on an RPC error (the sheet shows Retry)', async () => {
    h.state.queue = [{ data: null, error: { message: 'boom' } }]
    await expect(FriendService.searchByName('zoe')).rejects.toThrow()
  })
})

describe('FriendService.ensureFriendCode', () => {
  it('returns the code from the ensure_friend_code RPC', async () => {
    h.state.queue = [{ data: 'ABCD1234', error: null }]
    const code = await FriendService.ensureFriendCode()
    expect(h.rpc).toHaveBeenCalledWith('ensure_friend_code')
    expect(code).toBe('ABCD1234')
  })

  it('returns null when the RPC errors', async () => {
    h.state.queue = [{ data: null, error: { message: 'boom' } }]
    expect(await FriendService.ensureFriendCode()).toBeNull()
  })
})

const rpcError = (key: string, hint = 'server copy') => ({
  data: null,
  error: { code: 'P0001', message: key, hint },
})

describe('FriendService.sendRequest', () => {
  it('sends by user id and resolves the name', async () => {
    h.state.queue = [
      {
        data: {
          id: 'r1',
          requester_id: 'me',
          addressee_id: 'u2',
          status: 'pending',
        },
        error: null,
      },
      { data: [{ user_id: 'u2', name: 'Zoe Martin' }], error: null },
    ]
    const res = await FriendService.sendRequest({ userId: 'u2' })

    expect(h.rpc).toHaveBeenCalledWith('send_friend_request', {
      p_target_user_id: 'u2',
      p_code: undefined,
    })
    expect(b.insert).not.toHaveBeenCalled()
    expect(res).toEqual({ ok: true, name: 'Zoe Martin', accepted: false })
  })

  it('sends by code, cleaned up and upper-cased', async () => {
    h.state.queue = [
      {
        data: {
          id: 'r1',
          requester_id: 'me',
          addressee_id: 'u4',
          status: 'pending',
        },
        error: null,
      },
      { data: [{ user_id: 'u4', name: 'Dana Park' }], error: null },
    ]
    const res = await FriendService.sendRequest({ code: ' dana-2345 ' })
    expect(h.rpc).toHaveBeenCalledWith('send_friend_request', {
      p_target_user_id: undefined,
      p_code: 'DANA2345',
    })
    expect(res).toEqual({ ok: true, name: 'Dana Park', accepted: false })
  })

  it('reports when their earlier request was accepted instead', async () => {
    h.state.queue = [
      {
        data: {
          id: 'r9',
          requester_id: 'u2',
          addressee_id: 'me',
          status: 'accepted',
        },
        error: null,
      },
      { data: [{ user_id: 'u2', name: 'Zoe Martin' }], error: null },
    ]
    const res = await FriendService.sendRequest({ userId: 'u2' })
    expect(res).toEqual({ ok: true, name: 'Zoe Martin', accepted: true })
  })

  it.each([
    ['already_friends', false, "You're already friends."],
    ['request_pending', false, 'Request already sent.'],
    [
      'requests_closed',
      false,
      "They aren't taking requests this way. Ask for their friend code.",
    ],
    ['not_found', true, 'No one has that code. Check it and try again.'],
    ['not_found', false, "We couldn't find them."],
    ['cannot_friend_self', true, "That's your own code."],
    ['something_new', false, "That didn't send. Try again."],
  ])('maps %s (by code: %s) to friendly copy', async (key, byCode, copy) => {
    h.state.queue = [rpcError(key)]
    const res = await FriendService.sendRequest(
      byCode ? { code: 'ABCD2345' } : { userId: 'u2' }
    )
    expect(res).toEqual({ ok: false, key, error: copy })
  })
})

describe('FriendService reads throw (screens show Retry)', () => {
  it('getFriends rejects on a table error', async () => {
    h.state.queue = [{ data: null, error: { message: 'boom' } }]
    await expect(FriendService.getFriends()).rejects.toBeTruthy()
  })

  it('getRequests rejects on a table error', async () => {
    h.state.queue = [{ data: null, error: { message: 'boom' } }]
    await expect(FriendService.getRequests()).rejects.toBeTruthy()
  })
})

describe('FriendService.savePrivacy', () => {
  it('writes only the changed columns', async () => {
    h.state.queue = [{ data: null, error: null }]
    await FriendService.savePrivacy({ policy: 'code_only' })
    expect(b.update).toHaveBeenCalledWith({
      friend_request_policy: 'code_only',
    })
    expect(b.eq).toHaveBeenCalledWith('user_id', 'me')
  })

  it('rejects when the update fails', async () => {
    h.state.queue = [{ data: null, error: { message: 'boom' } }]
    await expect(
      FriendService.savePrivacy({ discoverable: false })
    ).rejects.toBeTruthy()
  })
})
