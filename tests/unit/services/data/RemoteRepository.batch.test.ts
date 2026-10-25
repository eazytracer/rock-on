import { describe, it, expect, beforeEach, vi } from 'vitest'

const { from, select, inFn, eq } = vi.hoisted(() => {
  const inFn = vi.fn()
  const eq = vi.fn()
  const select = vi.fn(() => ({ in: inFn, eq }))
  const from = vi.fn(() => ({ select }))
  return { from, select, inFn, eq }
})

vi.mock('../../../../src/services/supabase/client', () => ({
  supabase: { from },
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
    it('embeds users and profiles in one query and maps them', async () => {
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

      const members = await repository.getBandMembersWithProfiles('b1')

      expect(from).toHaveBeenCalledTimes(1)
      expect(from).toHaveBeenCalledWith('band_memberships')
      expect(select).toHaveBeenCalledWith('*, users(*, user_profiles(*))')
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
    })
  })
})
