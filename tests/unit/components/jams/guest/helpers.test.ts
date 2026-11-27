import { describe, expect, it } from 'vitest'
import {
  neededParts,
  partOptions,
  partsText,
} from '../../../../../src/components/jams/guest/parts'
import {
  isRefusal,
  kioskLink,
  tvPath,
  whenText,
} from '../../../../../src/components/jams/guest/helpers'
import { ApiError } from '../../../../../src/services/api/errors'

describe('guest part helpers', () => {
  it('offers the base parts, the jam’s custom ones and picked extras, once each', () => {
    const opts = partOptions(
      [{ key: 'vox' }, { key: 'other', label: 'Harmonica' }],
      [
        { key: 'other', label: 'harmonica' },
        { key: 'other', label: 'Banjo' },
      ]
    )
    expect(opts.map(p => p.label ?? p.key)).toEqual([
      'vox',
      'guitar',
      'bass',
      'drums',
      'keys',
      'Harmonica',
      'Banjo',
    ])
  })

  it('names parts, or "Just listening" for none', () => {
    expect(partsText([{ key: 'bass' }, { key: 'other', label: 'Harp' }])).toBe(
      'Bass, Harp'
    )
    expect(partsText([])).toBe('Just listening')
  })

  it('a song’s parts without its duplicate slots', () => {
    expect(
      neededParts({
        parts_needed: [{ key: 'guitar' }, { key: 'guitar' }, { key: 'vox' }],
      })
    ).toEqual([{ key: 'guitar' }, { key: 'vox' }])
  })
})

describe('guest helpers', () => {
  it('links: the TV by code, the kiosk token only in the hash', () => {
    expect(tvPath('abcd-efgh')).toBe('/j/ABCDEFGH/tv')
    expect(kioskLink('t+k/=', 'e1', 'https://rockon.band')).toBe(
      'https://rockon.band/kiosk#k=t%2Bk%2F%3D&e=e1'
    )
  })

  it('code refusals vs errors worth a retry', () => {
    expect(isRefusal(new ApiError('no_jam', 'x'))).toBe(true)
    expect(isRefusal(new ApiError('invite_only', 'x'))).toBe(true)
    expect(isRefusal(new ApiError('rate_limited', 'x'))).toBe(false)
    expect(isRefusal(new Error('x'))).toBe(false)
  })

  it('when: nothing while live, "Tonight" today', () => {
    expect(whenText('live', new Date().toISOString())).toBeNull()
    const tonight = new Date()
    tonight.setHours(20, 0, 0, 0)
    expect(whenText('scheduled', tonight.toISOString())).toBe('Tonight 8:00 PM')
  })
})
