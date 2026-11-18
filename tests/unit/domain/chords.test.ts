import { describe, it, expect } from 'vitest'
import {
  CHORD_ROOTS,
  LOOKUP_QUALITIES,
  PICKER_QUALITIES,
  STANDARD_GUITAR,
  baseFret,
  canonicalQuality,
  chordMidis,
  chordName,
  chordShape,
  fingering,
  normalizeChord,
  parseChord,
  pitchClass,
  showChord,
  spellFor,
  strumNotes,
  transposeChord,
  voiceChord,
} from '../../../src/domain/chords'

const frets = (name: string) => chordShape(name)?.frets.join(',')
const pcs = (midis: number[]) =>
  [...new Set(midis.map(m => m % 12))].sort((a, b) => a - b)
/** Every note is a chord tone and every chord tone sounds (the 5th may be left out, as in open C7). */
const expectSounds = (notes: number[], name: string) => {
  const want = pcs(voiceChord(name))
  const fifth = (pitchClass(parseChord(name)!.root)! + 7) % 12
  const got = pcs(notes)
  expect(
    got.every(p => want.includes(p)),
    name
  ).toBe(true)
  expect(
    want.filter(p => p !== fifth).every(p => got.includes(p)),
    name
  ).toBe(true)
}

describe('parseChord', () => {
  it('splits root, quality and bass', () => {
    expect(parseChord('Fmaj7/A')).toEqual({
      root: 'F',
      quality: 'maj7',
      bass: 'A',
    })
    expect(parseChord('G')).toEqual({ root: 'G', quality: '', bass: null })
    expect(parseChord('Bbm7')).toEqual({
      root: 'Bb',
      quality: 'm7',
      bass: null,
    })
    expect(parseChord('F#m/C#')).toEqual({
      root: 'F#',
      quality: 'm',
      bass: 'C#',
    })
    expect(parseChord('Am7b5')).toEqual({
      root: 'A',
      quality: 'm7b5',
      bass: null,
    })
    expect(parseChord('C7#9')).toEqual({
      root: 'C',
      quality: '7#9',
      bass: null,
    })
    expect(parseChord('Dsus4')).toEqual({
      root: 'D',
      quality: 'sus4',
      bass: null,
    })
    expect(parseChord('Cadd9')).toEqual({
      root: 'C',
      quality: 'add9',
      bass: null,
    })
  })
  it('accepts glyphs and returns ASCII', () => {
    expect(parseChord('B♭')).toEqual({ root: 'Bb', quality: '', bass: null })
    expect(parseChord('C♯m/G♯')).toEqual({
      root: 'C#',
      quality: 'm',
      bass: 'G#',
    })
  })
  it('keeps 6/9 as a quality, not a slash chord', () => {
    expect(parseChord('C6/9')).toEqual({
      root: 'C',
      quality: '6/9',
      bass: null,
    })
  })
  it('rejects things that are not chords', () => {
    for (const s of [
      '',
      'H',
      'Go',
      'Dad',
      'Chorus',
      'am',
      'G/X',
      'Verse 1',
      'x32010',
    ])
      expect(parseChord(s)).toBeNull()
  })
  it('chordName is the inverse', () => {
    for (const s of ['Fmaj7/A', 'G', 'Bbm7', 'C#m/G#', 'Esus4'])
      expect(chordName(parseChord(s)!)).toBe(s)
  })
})

describe('pitchClass', () => {
  it('maps every spelling, enharmonics equal', () => {
    expect(pitchClass('C')).toBe(0)
    expect(pitchClass('C#')).toBe(pitchClass('Db'))
    expect(pitchClass('A♯')).toBe(10)
    expect(pitchClass('Cb')).toBe(11)
    expect(pitchClass('E#')).toBe(5)
    expect(pitchClass('Q')).toBeNull()
  })
})

describe('canonicalQuality / normalizeChord', () => {
  it('folds common aliases', () => {
    expect(canonicalQuality('')).toBe('')
    expect(canonicalQuality('M')).toBe('')
    expect(canonicalQuality('maj')).toBe('')
    expect(canonicalQuality('min')).toBe('m')
    expect(canonicalQuality('-7')).toBe('m7')
    expect(canonicalQuality('M7')).toBe('maj7')
    expect(canonicalQuality('Δ')).toBe('maj7')
    expect(canonicalQuality('°')).toBe('dim')
    expect(canonicalQuality('+')).toBe('aug')
    expect(canonicalQuality('7')).toBe('7')
  })
  it('tidies typed text', () => {
    expect(normalizeChord(' f♯m7/a ')).toBe('F#m7/A')
    expect(normalizeChord('Fmaj7/A')).toBe('Fmaj7/A')
    expect(normalizeChord('CM7')).toBe('Cmaj7')
    expect(normalizeChord('Amin')).toBe('Am')
    expect(normalizeChord('Cmaj')).toBe('C')
    expect(normalizeChord('C/C')).toBe('C')
    expect(normalizeChord('D/Gb')).toBe('D/Gb')
    expect(normalizeChord('hello')).toBeNull()
    expect(normalizeChord('')).toBeNull()
  })
})

describe('showChord', () => {
  it('adds glyphs to root and bass only', () => {
    expect(showChord('Bb')).toBe('B♭')
    expect(showChord('F#m7/C#')).toBe('F♯m7/C♯')
    expect(showChord('Ebmaj7/Bb')).toBe('E♭maj7/B♭')
    expect(showChord('Bm')).toBe('Bm')
  })
})

describe('spellFor', () => {
  it('flats for flat keys and F', () => {
    for (const k of [
      'F',
      'Bb',
      'Eb',
      'Ab',
      'Db',
      'Gb',
      'B♭',
      'Dm',
      'Gm',
      'Cm',
      'Fm',
      'Bbm',
    ])
      expect(spellFor(k)).toBe(true)
  })
  it('sharps for sharp keys', () => {
    for (const k of [
      'G',
      'D',
      'A',
      'E',
      'B',
      'F#',
      'C#',
      'Em',
      'Bm',
      'F#m',
      'C#m',
      'G#m',
    ])
      expect(spellFor(k)).toBe(false)
  })
  it('C and Am (and no key) spell flats, as KEY_ROOTS', () => {
    expect(spellFor('C')).toBe(true)
    expect(spellFor('Am')).toBe(true)
    expect(spellFor('')).toBe(true)
    expect(spellFor(null)).toBe(true)
  })
})

describe('transposeChord', () => {
  it('moves root and bass, keeps the quality as typed', () => {
    expect(transposeChord('G', 2)).toBe('A')
    expect(transposeChord('Fmaj7/A', 2)).toBe('Gmaj7/B')
    expect(transposeChord('CM7', 1, true)).toBe('DbM7')
    expect(transposeChord('Em7', -2)).toBe('Dm7')
    expect(transposeChord('G', -8)).toBe('B')
  })
  it('spells per preferFlats', () => {
    expect(transposeChord('G', 1, true)).toBe('Ab')
    expect(transposeChord('G', 1, false)).toBe('G#')
    expect(transposeChord('D/F#', 1, true)).toBe('Eb/G')
    expect(transposeChord('A/C#', 1, false)).toBe('A#/D')
  })
  it('defaults to the source spelling (sharps only if written sharp)', () => {
    expect(transposeChord('C#m', 2)).toBe('D#m')
    expect(transposeChord('C', 1)).toBe('Db')
    expect(transposeChord('Bb', 1)).toBe('B')
  })
  it('round-trips ±12 and n then -n', () => {
    for (const c of ['C', 'F#m7/C#', 'Bbmaj7', 'Ebsus4', 'G/B', 'Am7b5'])
      for (const n of [12, -12, 24]) expect(transposeChord(c, n)).toBe(c)
    for (let n = -11; n <= 11; n++)
      for (const c of ['Dm7', 'Ebmaj7/G', 'F#7'])
        expect(
          transposeChord(
            transposeChord(c, n, c.includes('b')),
            -n,
            c.includes('b')
          )
        ).toBe(c)
  })
  it('leaves non-chords alone', () => {
    expect(transposeChord('N.C.', 3)).toBe('N.C.')
  })
})

// Every open shape in the design tables, plus the slash shapes.
const OPEN_TABLE: Record<string, string> = {
  C: 'x32010',
  D: 'xx0232',
  E: '022100',
  G: '320003',
  A: 'x02220',
  Am: 'x02210',
  Em: '022000',
  Dm: 'xx0231',
  E7: '020100',
  A7: 'x02020',
  D7: 'xx0212',
  G7: '320001',
  B7: 'x21202',
  C7: 'x32310',
  F: '133211',
  Bm: 'x24432',
  Fmaj7: 'xx3210',
  Cadd9: 'x32033',
  Dsus4: 'xx0233',
  Asus2: 'x02200',
  Am7: 'x02010',
  Em7: '020000',
  Dsus2: 'xx0230',
  Esus4: '022200',
  Cmaj7: 'x32000',
  Gmaj7: '320002',
  Amaj7: 'x02120',
  Dmaj7: 'xx0222',
  Asus4: 'x02230',
  Dm7: 'xx0211',
  'D/F#': '200232',
  'G/B': 'x20003',
  'C/G': '332010',
  'C/E': '032010',
  'Am/G': '3x2210',
  'F/C': 'x33211',
}

describe('chordShape · open shapes', () => {
  it.each(Object.entries(OPEN_TABLE))('%s is %s', (name, s) => {
    const shape = chordShape(name)!
    expect(fingering(shape.frets).replace(/ /g, '')).toBe(s)
  })
  it('each open shape sounds its own chord', () => {
    for (const name of Object.keys(OPEN_TABLE)) {
      const c = parseChord(name)!
      const notes = strumNotes(chordShape(name)!.frets)
      expectSounds(notes, name)
      // The lowest note is the bass (or the root).
      expect(notes[0] % 12).toBe(pitchClass(c.bass ?? c.root))
    }
  })
  it('F and Bm carry their barre; open chords none', () => {
    expect(chordShape('F')!.barre).toBe(1)
    expect(chordShape('Bm')!.barre).toBe(2)
    expect(chordShape('G')!.barre).toBeNull()
  })
  it('finds shapes through aliases and enharmonics', () => {
    expect(frets('CM7')).toBe(frets('Cmaj7'))
    expect(frets('Amin')).toBe(frets('Am'))
    expect(frets('D/Gb')).toBe(frets('D/F#'))
  })
})

describe('chordShape · computed barres', () => {
  it('picks the lower of the E- and A-shape', () => {
    expect(chordShape('Bb')).toEqual({ frets: [-1, 1, 3, 3, 3, 1], barre: 1 })
    expect(chordShape('F#')).toEqual({ frets: [2, 4, 4, 3, 2, 2], barre: 2 })
    expect(chordShape('C#m')).toEqual({ frets: [-1, 4, 6, 6, 5, 4], barre: 4 })
    expect(chordShape('Gm')).toEqual({ frets: [3, 5, 5, 3, 3, 3], barre: 3 })
    expect(chordShape('Fm')).toEqual({ frets: [1, 3, 3, 1, 1, 1], barre: 1 })
    expect(chordShape('Ab7')).toEqual({ frets: [4, 6, 4, 5, 4, 4], barre: 4 })
    expect(chordShape('Ebm7')).toEqual({ frets: [-1, 6, 8, 6, 7, 6], barre: 6 })
  })
  it('sus2 only has an A-shape', () => {
    expect(chordShape('Esus2')).toEqual({
      frets: [-1, 7, 9, 9, 7, 7],
      barre: 7,
    })
  })
  it('power chords: open E5 / A5 / D5, else a root-and-fifth shape, no barre', () => {
    expect(frets('E5')).toBe('0,2,2,-1,-1,-1')
    expect(frets('D5')).toBe('-1,-1,0,2,3,-1')
    expect(chordShape('G5')).toEqual({
      frets: [3, 5, 5, -1, -1, -1],
      barre: null,
    })
    expect(chordShape('C5')).toEqual({
      frets: [-1, 3, 5, 5, -1, -1],
      barre: null,
    })
    expect(chordShape('Bb5')).toEqual({
      frets: [-1, 1, 3, 3, -1, -1],
      barre: null,
    })
  })
  it('E/A roots use fret 12 only when the other shape is higher', () => {
    // Emaj7 has no open shape: A-shape at 7 beats E-shape at 12.
    expect(chordShape('Emaj7')!.barre).toBe(7)
    // A♯m: A-shape at 1 beats E-shape at 6.
    expect(chordShape('A#m')!.barre).toBe(1)
  })
  const COMPUTED = ['', 'm', '7', 'm7', 'maj7', 'sus4', 'sus2']
  it('every root × computed quality has a shape that sounds the chord', () => {
    for (const r of CHORD_ROOTS)
      for (const q of COMPUTED) {
        const name = r + q
        const shape = chordShape(name)
        expect(shape, name).not.toBeNull()
        const notes = strumNotes(shape!.frets)
        expectSounds(notes, name)
        expect(notes[0] % 12, name).toBe(pitchClass(r))
        // Playable span: at most 4 frets between the lowest and highest fretted note.
        const fr = shape!.frets.filter(f => f > 0)
        if (fr.length)
          expect(Math.max(...fr) - Math.min(...fr), name).toBeLessThanOrEqual(3)
      }
  })
  it('every Chords-tab root × quality has a diagram', () => {
    for (const r of CHORD_ROOTS)
      for (const { value } of LOOKUP_QUALITIES)
        expect(chordShape(r + value)).not.toBeNull()
  })
  it('no shape for unusual chords, slash chords without a table entry, or junk', () => {
    expect(chordShape('Cdim')).toBeNull()
    expect(chordShape('G9')).toBeNull()
    expect(chordShape('Bb/D')).toBeNull()
    expect(chordShape('nope')).toBeNull()
  })
})

describe('fingering / baseFret', () => {
  it('renders frets as text', () => {
    expect(fingering([-1, 3, 2, 0, 1, 0])).toBe('x 3 2 0 1 0')
    expect(fingering([-1, 10, 12, 12, 12, 10])).toBe('x 10 12 12 12 10')
  })
  it('starts at the nut unless the shape reaches past fret 4', () => {
    expect(baseFret([-1, 3, 2, 0, 1, 0])).toBe(1)
    expect(baseFret([1, 3, 3, 1, 1, 1])).toBe(1)
    expect(baseFret([3, 5, 5, 3, 3, 3])).toBe(3)
    expect(baseFret([-1, 7, 9, 9, 7, 7])).toBe(7)
    expect(baseFret([0, 0, 0, 0, 0, 0])).toBe(1)
  })
})

describe('strumNotes / voiceChord / chordMidis', () => {
  it('maps a shape onto standard tuning, skipping muted strings', () => {
    expect(strumNotes([-1, 3, 2, 0, 1, 0])).toEqual([48, 52, 55, 60, 64])
    expect(strumNotes([3, 2, 0, 0, 0, 3])).toEqual([43, 47, 50, 55, 59, 67])
  })
  it('uses the top six strings of a 7-string tuning, standard for fewer strings', () => {
    expect(strumNotes([-1, 3, 2, 0, 1, 0], [35, ...STANDARD_GUITAR])).toEqual([
      48, 52, 55, 60, 64,
    ])
    expect(strumNotes([-1, 3, 2, 0, 1, 0], [28, 33, 38, 43])).toEqual([
      48, 52, 55, 60, 64,
    ])
  })
  it('follows the given tuning', () => {
    const dropD = [38, 45, 50, 55, 59, 64]
    expect(strumNotes([0, 0, 0, 2, 3, 2], dropD)[0]).toBe(38)
  })
  it('voices any chord low → high with the slash bass at the bottom', () => {
    const v = voiceChord('Cdim')
    expect(pcs(v)).toEqual([0, 3, 6])
    expect(v).toEqual([...v].sort((a, b) => a - b))
    expect(v.length).toBeGreaterThanOrEqual(3)
    expect(v.every(m => m >= 40 && m < 72)).toBe(true)
    expect(voiceChord('Bb/D')[0] % 12).toBe(2)
    expect(voiceChord('E')[0]).toBe(40)
    expect(voiceChord('D#')[0]).toBe(51)
    // Every chord tone sounds, even close ones (the 2 of add9, the 3rd of a 9).
    expect(pcs(voiceChord('C9'))).toEqual([0, 2, 4, 7, 10])
    expect(pcs(voiceChord('Cadd9'))).toEqual([0, 2, 4, 7])
    expect(pcs(voiceChord('Csus4'))).toEqual([0, 5, 7])
    expect(pcs(voiceChord('Csus2'))).toEqual([0, 2, 7])
    expect(pcs(voiceChord('Cdim7'))).toEqual([0, 3, 6, 9])
    // Unknown qualities fall back to a triad.
    expect(pcs(voiceChord('Cm11b13'))).toEqual([0, 3, 7])
    expect(voiceChord('junk')).toEqual([])
  })
  it('chordMidis prefers the shape, else the voicing', () => {
    expect(chordMidis('C')).toEqual([48, 52, 55, 60, 64])
    expect(chordMidis('Caug')).toEqual(voiceChord('Caug'))
    expect(chordMidis('nope')).toEqual([])
  })
  it('every picker quality on every root strums something', () => {
    for (const r of CHORD_ROOTS)
      for (const q of PICKER_QUALITIES) {
        const name = normalizeChord(r + q)!
        expect(chordMidis(name).length, name).toBeGreaterThanOrEqual(3)
      }
  })
})
