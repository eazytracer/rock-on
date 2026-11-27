import { describe, it, expect, vi, beforeEach } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())

vi.mock('../../../../src/services/api/client', () => ({
  api: () => ({ rpc }),
}))

import {
  createJam,
  jamPreviewByCode,
  jamTvFeed,
  joinJamAsWebGuest,
  pairKiosk,
  raiseHand,
  resolveCode,
  jamState,
} from '../../../../src/services/api/jams'

beforeEach(() => vi.clearAllMocks())

describe('jams api', () => {
  it('maps camelCase input to the RPC params', async () => {
    rpc.mockResolvedValue({ data: { id: 'e1' }, error: null })
    await createJam({
      name: 'Friday',
      at: '2026-11-21T20:00:00Z',
      whoCanJoin: 'friends',
      defaultParts: ['vox', { key: 'other', label: 'Harmonica' }],
    })
    expect(rpc).toHaveBeenCalledWith('create_jam', {
      p_name: 'Friday',
      p_at: '2026-11-21T20:00:00Z',
      p_timezone: undefined,
      p_where: undefined,
      p_band_id: undefined,
      p_who_can_join: 'friends',
      p_default_parts: ['vox', { key: 'other', label: 'Harmonica' }],
    })
  })

  it('passes the guest token through', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    await raiseHand('i1', ['bass'], 'tok')
    expect(rpc).toHaveBeenCalledWith('raise_hand', {
      p_item: 'i1',
      p_parts: ['bass'],
      p_guest_token: 'tok',
    })
  })

  it('unwraps single-row table results', async () => {
    rpc.mockResolvedValue({
      data: [{ event_id: 'e1', participant_id: 'p1', token: 't' }],
      error: null,
    })
    await expect(joinJamAsWebGuest('ABCD-EFGH', 'Robin')).resolves.toEqual({
      event_id: 'e1',
      participant_id: 'p1',
      token: 't',
    })
    rpc.mockResolvedValue({ data: [{ kind: null }], error: null })
    await expect(resolveCode('nope')).resolves.toBeNull()
  })

  it('turns a refusal row into the same ApiError a RAISE gives', async () => {
    const refusal = {
      event_id: null,
      participant_id: null,
      token: null,
      error: 'no_jam',
      hint: 'No jam with that code.',
    }
    rpc.mockResolvedValue({ data: [refusal], error: null })
    await expect(joinJamAsWebGuest('WRONG', 'Robin')).rejects.toMatchObject({
      key: 'no_jam',
      message: 'No jam with that code.',
    })
    await expect(jamPreviewByCode('WRONG')).rejects.toMatchObject({
      key: 'no_jam',
    })
    rpc.mockResolvedValue({
      data: [{ ...refusal, error: 'pairing_invalid' }],
      error: null,
    })
    await expect(pairKiosk('WRONG')).rejects.toMatchObject({
      key: 'pairing_invalid',
    })
    rpc.mockResolvedValue({
      data: { error: 'invite_only', hint: 'This jam is invite only.' },
      error: null,
    })
    await expect(jamTvFeed('WRONG')).rejects.toMatchObject({
      key: 'invite_only',
    })
  })

  it('returns the row without the refusal fields when it worked', async () => {
    rpc.mockResolvedValue({
      data: [{ event_id: 'e1', name: 'Jam', error: null, hint: null }],
      error: null,
    })
    await expect(jamPreviewByCode('ABCDEFGH')).resolves.toEqual({
      event_id: 'e1',
      name: 'Jam',
    })
  })

  it('throws the server error key', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        code: 'P0001',
        message: 'forbidden',
        hint: "You don't have access to this.",
      },
    })
    await expect(jamState('e1')).rejects.toMatchObject({
      key: 'forbidden',
      message: "You don't have access to this.",
    })
  })
})
