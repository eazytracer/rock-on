import { describe, it, expect, vi, beforeEach } from 'vitest'

// A fake user_preferences table: select(col).eq().maybeSingle() and upsert().
const db = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  upserts: [] as Record<string, unknown>[],
}))

vi.mock('../../../../src/services/api/client', () => ({
  api: () => ({
    from: () => ({
      select: (col: string) => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: db.row ? { [col]: db.row[col] } : null,
              error: null,
            }),
        }),
      }),
      upsert: (row: Record<string, unknown>) => {
        db.upserts.push(row)
        return Promise.resolve({ error: null })
      },
    }),
  }),
}))

import {
  getMetronomePrefs,
  getPushPrefs,
  setMetronomePrefs,
  setPushPrefs,
} from '../../../../src/services/api/preferences'

beforeEach(() => {
  db.row = null
  db.upserts = []
})

describe('metronome prefs', () => {
  it('defaults to Beep and ignores unknown sounds', async () => {
    expect(await getMetronomePrefs('u1')).toEqual({ click: 'beep' })
    db.row = { metronome: { click: 'cowbell' } }
    expect(await getMetronomePrefs('u1')).toEqual({ click: 'beep' })
    db.row = { metronome: { click: 'hihat' } }
    expect(await getMetronomePrefs('u1')).toEqual({ click: 'hihat' })
  })

  it('merges into the column and writes only that column', async () => {
    db.row = { metronome: { other: 'kept', click: 'beep' } }
    await setMetronomePrefs('u1', { click: 'woodblock' })
    expect(db.upserts).toEqual([
      { user_id: 'u1', metronome: { other: 'kept', click: 'woodblock' } },
    ])
  })
})

describe('push prefs', () => {
  it('fills defaults: everything on, quiet hours 23:00–08:00', async () => {
    const p = await getPushPrefs('u1')
    expect(p.enabled).toBe(true)
    expect(Object.values(p.types).every(Boolean)).toBe(true)
    expect(p.mutedBands).toEqual([])
    expect(p.quietHours).toMatchObject({
      enabled: true,
      start: '23:00',
      end: '08:00',
    })
    expect(typeof p.quietHours.tz).toBe('string')
  })

  it('reads stored values and drops malformed ones', async () => {
    db.row = {
      push: {
        enabled: false,
        types: { shows: false, practices: 'yes' },
        mutedBands: ['b1', 7],
        quietHours: { start: '22:30', end: '25:00', tz: 'Europe/Oslo' },
      },
    }
    const p = await getPushPrefs('u1')
    expect(p.enabled).toBe(false)
    expect(p.types.shows).toBe(false)
    expect(p.types.practices).toBe(true)
    expect(p.mutedBands).toEqual(['b1'])
    expect(p.quietHours).toMatchObject({
      start: '22:30',
      end: '08:00',
      tz: 'Europe/Oslo',
    })
  })

  it('merges top-level keys, keeping the others', async () => {
    db.row = { push: { legacy: 1, enabled: true } }
    await setPushPrefs('u1', { enabled: false })
    expect(db.upserts).toEqual([
      { user_id: 'u1', push: { legacy: 1, enabled: false } },
    ])
  })
})
