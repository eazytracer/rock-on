import { describe, it, expect } from 'vitest'
import {
  transposeKey,
  chartKey,
  readChord,
  noteInKey,
  noteWithOctave,
  degreeInKey,
  pageStep,
  lineHeightFor,
  lineUnits,
  wordGroups,
  chartIsEmpty,
} from '../../../src/domain/chartView'
import { parse, parseLine } from '../../../src/domain/chordpro'

describe('transposeKey', () => {
  it('spells the new key the way players write it', () => {
    expect(transposeKey('G', 2)).toBe('A')
    expect(transposeKey('F', 1)).toBe('F#')
    expect(transposeKey('E', 1)).toBe('F')
    expect(transposeKey('C', -1)).toBe('B')
    expect(transposeKey('G', -6)).toBe('Db')
  })
  it('keeps minor keys minor', () => {
    expect(transposeKey('Em', 1)).toBe('Fm')
    expect(transposeKey('Am', -1)).toBe('G#m')
    expect(transposeKey('Bbm', 0)).toBe('Bbm')
  })
  it('leaves anything else alone', () => {
    expect(transposeKey('nope', 3)).toBe('nope')
  })
})

describe('chartKey', () => {
  it("uses the song's key first", () => {
    expect(chartKey('G', ['Em'])).toBe('G')
  })
  it("falls back to the chart's first chord (root and minor)", () => {
    expect(chartKey(null, ['Em7', 'C'])).toBe('Em')
    expect(chartKey('', ['N.C.', 'Dsus4'])).toBe('D')
    expect(chartKey(undefined, [])).toBeNull()
  })
})

describe('readChord', () => {
  it('leaves chords exactly as written at 0', () => {
    expect(readChord('F#m7', 0, 'A')).toBe('F#m7')
  })
  it('spells for the transposed key', () => {
    // G → A (sharp key): C → D, G7 → A7, Em → F#m
    expect(readChord('Em', 2, 'G')).toBe('F#m')
    // G → F (flat key): D → C, A7 → G7, Em → Dm, B → A, C → Bb
    expect(readChord('C', -2, 'G')).toBe('Bb')
    expect(readChord('D/F#', -2, 'G')).toBe('C/E')
  })
})

describe('starting note', () => {
  it('names the note in the key', () => {
    expect(noteInKey(62, 'G')).toBe('D')
    expect(noteInKey(66, 'G')).toBe('F♯')
    expect(noteInKey(70, 'F')).toBe('B♭')
    expect(noteWithOctave(62, 'G')).toBe('D4')
    expect(noteWithOctave(48, 'C')).toBe('C3')
  })
  it('reads relative to the key', () => {
    expect(degreeInKey(62, 'G')).toBe('5th')
    expect(degreeInKey(67, 'G')).toBe('root')
    expect(degreeInKey(70, 'G')).toBe('♭3rd')
    expect(degreeInKey(62, null)).toBe('')
  })
})

describe('pageStep', () => {
  it('moves most of a screen and keeps two lines', () => {
    expect(pageStep(600, 50)).toBe(500)
  })
  it('always moves at least a line', () => {
    expect(pageStep(80, 50)).toBe(50)
  })
  it('lines are shorter with chords hidden', () => {
    expect(lineHeightFor(20, false)).toBeLessThan(lineHeightFor(20, true))
  })
})

describe('wordGroups', () => {
  it('keeps the pieces of a mid-word chord together', () => {
    const groups = wordGroups(lineUnits(parseLine('name in[A]side [D]now')))
    expect(groups.map(g => g.map(u => u.text))).toEqual([
      ['name '],
      ['in', 'side '],
      ['now'],
    ])
  })
  it('a chord after the last letter stays its own group', () => {
    const groups = wordGroups(lineUnits(parseLine('re[A7]lieved[D]')))
    expect(groups.map(g => g.map(u => u.chord))).toEqual([[null, 'A7'], ['D']])
  })
})

describe('lineUnits', () => {
  it('puts each chord over its first letter and splits words', () => {
    const units = lineUnits(parseLine('[G]Amazing [G7]grace, how [C]sweet'))
    expect(units).toEqual([
      { chord: 'G', at: 0, text: 'Amazing ' },
      { chord: 'G7', at: 8, text: 'grace, ' },
      { chord: null, at: 15, text: 'how ' },
      { chord: 'C', at: 19, text: 'sweet' },
    ])
  })
  it('keeps a mid-word chord and a chord after the last letter', () => {
    const units = lineUnits(parseLine('re[A7]lieved[D]'))
    expect(units.map(u => [u.chord, u.text])).toEqual([
      [null, 're'],
      ['A7', 'lieved'],
      ['D', ''],
    ])
  })
  it('a plain line is one unit per word', () => {
    expect(lineUnits(parseLine('no chords here')).map(u => u.text)).toEqual([
      'no ',
      'chords ',
      'here',
    ])
  })
})

describe('chartIsEmpty', () => {
  it('is empty with no text or chords', () => {
    expect(chartIsEmpty(parse(''))).toBe(true)
    expect(chartIsEmpty(parse('{title: X}'))).toBe(true)
    expect(chartIsEmpty(parse('[G]'))).toBe(false)
  })
})
