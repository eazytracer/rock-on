import { describe, it, expect } from 'vitest'
import {
  builtinTunerTunings,
  changedStrings,
  forInstrument,
  resolveTuning,
  songTuningParam,
  tunerTunings,
  type TuningRow,
} from '../../../src/domain/tuner'
import { bassBuiltinFor, bassEquivalent } from '../../../src/domain/tuningEdit'

const custom: TuningRow = {
  id: '11111111-2222-3333-4444-555555555555',
  name: 'Open C',
  instrument: 'guitar',
  pitches: [36, 43, 48, 55, 60, 64],
  isBuiltin: false,
  color: '#ff0000',
}
const dbDropD: TuningRow = {
  id: '99999999-2222-3333-4444-555555555555',
  name: 'Drop D',
  instrument: 'guitar',
  pitches: [38, 45, 50, 55, 59, 64],
  slug: 'drop-d',
  isBuiltin: true,
}
const list = tunerTunings([custom, dbDropD])

describe('tuner tunings', () => {
  it('lists built-ins in display order with pill labels', () => {
    const g = builtinTunerTunings('guitar')
    expect(g[0]).toMatchObject({ key: 'standard', label: 'E STD' })
    expect(g.find(t => t.key === 'drop-d')?.label).toBe('D DROP')
    expect(g.find(t => t.key === 'standard-7')?.label).toBe('B STD⁷')
    expect(g.find(t => t.key === 'standard-7')?.color).toBe(
      'var(--tuning-standard)'
    )
    expect(g.find(t => t.key === 'b-standard-baritone')?.color).toBe(
      'var(--tuning-unknown)'
    )
    expect(builtinTunerTunings('bass').map(t => t.key)).toContain(
      'bass-standard'
    )
  })

  it('adds customs once (built-in rows from the DB are not duplicated)', () => {
    expect(list.filter(t => t.key === 'drop-d')).toHaveLength(1)
    expect(list.find(t => t.key === custom.id)).toMatchObject({
      name: 'Open C',
      color: '#ff0000',
      builtin: false,
    })
  })

  it('resolves slugs, ids, names and legacy labels', () => {
    expect(resolveTuning('drop-d', list)?.key).toBe('drop-d')
    expect(resolveTuning(dbDropD.id, list, [dbDropD])?.key).toBe('drop-d')
    expect(resolveTuning(custom.id, list)?.name).toBe('Open C')
    expect(resolveTuning('open c', list)?.key).toBe(custom.id)
    expect(resolveTuning('Standard (EADGBE)', list)?.key).toBe('standard')
    expect(resolveTuning('Half Step Down', list)?.key).toBe('half-step-down')
    expect(resolveTuning('standard-7', list)?.key).toBe('standard-7')
    expect(resolveTuning('Nonsense', list)).toBeNull()
    expect(resolveTuning('', list)).toBeNull()
    expect(resolveTuning('bass:drop-d', list)?.key).toBe('bass-drop-d')
  })

  it('marks the strings that change from the previous tuning', () => {
    const std = resolveTuning('standard', list)!
    const dd = resolveTuning('drop-d', list)!
    expect(changedStrings(dd, std)).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
    ])
    expect(changedStrings(dd, null).every(c => !c)).toBe(true)
    const seven = resolveTuning('standard-7', list)!
    expect(changedStrings(seven, std).every(c => !c)).toBe(true)
  })
})

describe('bass (decision 7)', () => {
  it('maps Standard / Drop D / half step to the bass built-ins', () => {
    expect(bassBuiltinFor('standard')).toBe('bass-standard')
    expect(bassBuiltinFor('drop-d')).toBe('bass-drop-d')
    expect(bassBuiltinFor('half-step-down')).toBe('bass-eb')
    expect(bassBuiltinFor('dadgad')).toBeNull()
    const std = resolveTuning('standard', list)!
    expect(forInstrument(std, 'bass', list).key).toBe('bass-standard')
  })

  it('else takes the four lowest strings an octave down', () => {
    expect(bassEquivalent([36, 43, 48, 53, 57, 62])).toEqual([24, 31, 36, 41])
    const dropC = resolveTuning('drop-c', list)!
    const b = forInstrument(dropC, 'bass', list)
    expect(b).toMatchObject({ key: 'bass:drop-c', instrument: 'bass' })
    expect(b.pitches).toEqual([24, 31, 36, 41])
  })

  it('bass → guitar goes to Standard; same instrument is unchanged', () => {
    const bs = resolveTuning('bass-standard', list)!
    expect(forInstrument(bs, 'guitar', list).key).toBe('standard')
    expect(forInstrument(bs, 'bass', list)).toBe(bs)
  })
})

describe('songTuningParam', () => {
  it('uses the built-in slug, else the tuning id', () => {
    expect(songTuningParam({ guitarTuning: 'Drop D', tuningId: 'x' })).toBe(
      'drop-d'
    )
    expect(
      songTuningParam({ guitarTuning: 'Open C', tuningId: custom.id })
    ).toBe(custom.id)
    expect(songTuningParam({})).toBe('standard')
  })
})
