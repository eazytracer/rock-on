import { describe, it, expect, beforeEach, vi } from 'vitest'

const { from, select, inFn, eq, rpc } = vi.hoisted(() => {
  const inFn = vi.fn()
  const eq = vi.fn()
  const select = vi.fn(() => ({ in: inFn, eq }))
  const from = vi.fn(() => ({ select }))
  const rpc = vi.fn()
  return { from, select, inFn, eq, rpc }
})

vi.mock('../../../../src/services/supabase/client', () => ({
  supabase: { from, rpc },
}))

import { RemoteRepository } from '../../../../src/services/data/RemoteRepository'

describe('RemoteRepository batched reads', () => {
  let repository: RemoteRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repository = new RemoteRepository()
  })

  describe('getSongsByIds', () => {
    it('fetches all songs in one id IN (...) query', async () => {
      inFn.mockResolvedValue({
        data: [
          { id: 's1', title: 'One', artist: 'A' },
          { id: 's2', title: 'Two', artist: 'B' },
        ],
        error: null,
      })

      const songs = await repository.getSongsByIds(['s1', 's2', 's1'])

      expect(from).toHaveBeenCalledTimes(1)
      expect(from).toHaveBeenCalledWith('songs')
      expect(inFn).toHaveBeenCalledWith('id', ['s1', 's2'])
      expect(songs.map(s => s.title)).toEqual(['One', 'Two'])
    })

    it('makes no request for an empty id list', async () => {
      expect(await repository.getSongsByIds([])).toEqual([])
      expect(from).not.toHaveBeenCalled()
    })

    it('throws on a Supabase error', async () => {
      const error = { message: 'boom' }
      inFn.mockResolvedValue({ data: null, error })

      await expect(repository.getSongsByIds(['s1'])).rejects.toBe(error)
    })
  })

  describe('getBandMembersWithProfiles', () => {
    it('embeds users (no email column) and profiles, then merges visible emails', async () => {
      const eqStatus = vi.fn().mockResolvedValue({
        data: [
          {
            id: 'm1',
            user_id: 'u1',
            band_id: 'b1',
            role: 'admin',
            permissions: ['owner'],
            status: 'active',
            users: {
              id: 'u1',
              name: 'Eric Johnson',
              email: 'eric@example.com',
              user_profiles: {
                id: 'p1',
                user_id: 'u1',
                display_name: 'Eric',
                instruments: ['Guitar'],
                primary_instrument: 'Guitar',
              },
            },
          },
          {
            id: 'm2',
            user_id: 'u2',
            band_id: 'b1',
            role: 'member',
            status: 'active',
            users: {
              id: 'u2',
              name: 'No Profile',
              email: 'np@example.com',
              user_profiles: null,
            },
          },
        ],
        error: null,
      })
      eq.mockReturnValue({ eq: eqStatus })
      // Only emails the caller may see come back (e.g. an admin, or self)
      rpc.mockResolvedValue({
        data: [{ user_id: 'u1', email: 'eric@example.com' }],
        error: null,
      })

      const members = await repository.getBandMembersWithProfiles('b1')

      expect(from).toHaveBeenCalledTimes(1)
      expect(from).toHaveBeenCalledWith('band_memberships')
      expect(select).toHaveBeenCalledWith(
        '*, users(id, name, created_date, auth_provider, user_profiles(*))'
      )
      expect(rpc).toHaveBeenCalledWith('get_user_emails', {
        p_user_ids: ['u1', 'u2'],
      })
      expect(eq).toHaveBeenCalledWith('band_id', 'b1')
      expect(eqStatus).toHaveBeenCalledWith('status', 'active')

      expect(members).toHaveLength(2)
      expect(members[0].membership).toMatchObject({
        id: 'm1',
        userId: 'u1',
        role: 'admin',
      })
      expect(members[0].user).toMatchObject({
        id: 'u1',
        email: 'eric@example.com',
      })
      expect(members[0].profile).toMatchObject({
        displayName: 'Eric',
        instruments: ['Guitar'],
        primaryInstrument: 'Guitar',
      })
      expect(members[1].profile).toBeNull()
      // No visible email → empty, never another user's raw row value
      expect(members[1].user?.email).toBe('')
    })
  })

  describe('jam sessions by code', () => {
    const row = {
      id: 'j1',
      short_code: 'ABC123',
      host_user_id: 'h1',
      status: 'active',
      created_date: '2026-10-25T00:00:00Z',
      expires_at: '2026-10-26T00:00:00Z',
      settings: {},
    }

    it('looks a session up via get_jam_session_by_code', async () => {
      rpc.mockResolvedValue({ data: [row], error: null })

      const session = await repository.getJamSessionByCode('ABC123')

      expect(rpc).toHaveBeenCalledWith('get_jam_session_by_code', {
        p_code: 'ABC123',
      })
      expect(from).not.toHaveBeenCalled()
      expect(session?.id).toBe('j1')
    })

    it('joins via join_jam_session', async () => {
      rpc.mockResolvedValue({ data: [row], error: null })

      const session = await repository.joinJamSession('ABC123')

      expect(rpc).toHaveBeenCalledWith('join_jam_session', { p_code: 'ABC123' })
      expect(session?.shortCode).toBe('ABC123')
    })

    it('returns null when join_jam_session finds no session', async () => {
      rpc.mockResolvedValue({ data: [], error: null })

      expect(await repository.joinJamSession('NOPE00')).toBeNull()
    })
  })
})
