import { describe, it, expect } from 'vitest'
import {
  canonicalTuningId,
  tuningColor,
  tuningLabel,
  CANONICAL_TUNINGS,
  FALLBACK_TUNING_COLOR,
  BUILTIN_TUNINGS,
  midiToNoteName,
} from '../../../src/utils/tunings'

describe('canonicalTuningId', () => {
  it('maps each built-in label to its id', () => {
    expect(canonicalTuningId('Standard')).toBe('standard')
    expect(canonicalTuningId('Drop D')).toBe('drop-d')
    expect(canonicalTuningId('Drop Db')).toBe('drop-db')
    expect(canonicalTuningId('Drop C#')).toBe('drop-db')
    expect(canonicalTuningId('Drop C')).toBe('drop-c')
    expect(canonicalTuningId('Drop B')).toBe('drop-b')
    expect(canonicalTuningId('Half-step down')).toBe('half-step-down')
    expect(canonicalTuningId('Whole-step down')).toBe('whole-step-down')
    expect(canonicalTuningId('Open G')).toBe('open-g')
    expect(canonicalTuningId('Open D')).toBe('open-d')
    expect(canonicalTuningId('DADGAD')).toBe('dadgad')
  })

  it('normalizes separators and case', () => {
    expect(canonicalTuningId('DROP_D')).toBe('drop-d')
    expect(canonicalTuningId('  Half Step Down  ')).toBe('half-step-down')
    expect(canonicalTuningId('Standard (EADGBE)')).toBe('standard')
  })

  // Parity with the SQL builtin_tuning_slug() normalizer (tunings migration).
  // These legacy labels previously fell through to a custom id (neutral color) —
  // the DB backfills songs.tuning_id from these, so app + DB MUST agree.
  it('resolves legacy labels the DB slug handles (app↔DB parity)', () => {
    // standard aliases
    for (const s of ['E Standard', 'E', 'EADGBE', 'standard-7', 'Standard E'])
      expect(canonicalTuningId(s)).toBe('standard')
    // half-step-down aliases ("Eb Standard" / "Eb")
    for (const s of ['Eb Standard', 'E Flat Standard', 'Eb', 'E flat'])
      expect(canonicalTuningId(s)).toBe('half-step-down')
    // whole-step-down aliases ("D Standard")
    for (const s of ['D Standard', 'D Flat Standard'])
      expect(canonicalTuningId(s)).toBe('whole-step-down')
  })

  it('preserves unrecognized (custom) tunings as a dashed id', () => {
    expect(canonicalTuningId('My Weird Tuning')).toBe('my-weird-tuning')
    expect(canonicalTuningId('CGDGCD')).toBe('cgdgcd')
  })

  it('defaults empty/nullish input to standard', () => {
    expect(canonicalTuningId('')).toBe('standard')
    expect(canonicalTuningId('   ')).toBe('standard')
    expect(canonicalTuningId(undefined)).toBe('standard')
    expect(canonicalTuningId(null)).toBe('standard')
  })
})

describe('tuningColor', () => {
  it('returns the Palette A color for built-ins', () => {
    expect(tuningColor('Standard')).toBe('#60a5fa')
    expect(tuningColor('Drop D')).toBe('#f97316')
  })

  it('resolves legacy Eb/D labels to the correct built-in color (not neutral)', () => {
    expect(tuningColor('Eb Standard')).toBe('#14b8a6') // half-step-down
    expect(tuningColor('D Standard')).toBe('#0ea5e9') // whole-step-down
  })

  it('returns the neutral fallback for genuinely custom tunings', () => {
    expect(tuningColor('My Weird Tuning')).toBe(FALLBACK_TUNING_COLOR)
  })

  it('merges extraTunings (custom color override) when provided', () => {
    const extra = [
      { id: 'my-weird-tuning', label: 'My Weird', color: '#123456' },
    ]
    expect(tuningColor('My Weird Tuning', extra)).toBe('#123456')
  })
})

describe('tuningLabel', () => {
  it('returns the canonical label for built-ins', () => {
    expect(tuningLabel('drop_d')).toBe('Drop D')
    expect(tuningLabel('Eb Standard')).toBe('Half-step down')
  })

  it('falls back to the raw input for custom tunings', () => {
    expect(tuningLabel('My Weird Tuning')).toBe('My Weird Tuning')
  })
})

describe('CANONICAL_TUNINGS registry', () => {
  it('has unique ids', () => {
    const ids = CANONICAL_TUNINGS.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('BUILTIN_TUNINGS (mirrors the DB seed)', () => {
  it('has the 17 seeded built-ins with unique slugs', () => {
    expect(BUILTIN_TUNINGS).toHaveLength(17)
    const slugs = BUILTIN_TUNINGS.map(t => t.slug)
    expect(new Set(slugs).size).toBe(17)
  })

  it('every pitch array length equals its string count (DB CHECK parity)', () => {
    for (const t of BUILTIN_TUNINGS)
      expect(t.pitches).toHaveLength(t.stringCount)
  })

  it('string counts are within the 3–12 DB bound', () => {
    for (const t of BUILTIN_TUNINGS)
      expect(t.stringCount).toBeGreaterThanOrEqual(3)
  })
})

describe('midiToNoteName', () => {
  it('renders standard guitar strings low→high (flats for accidentals)', () => {
    // Standard = E2 A2 D3 G3 B3 E4
    expect([40, 45, 50, 55, 59, 64].map(midiToNoteName)).toEqual([
      'E2',
      'A2',
      'D3',
      'G3',
      'B3',
      'E4',
    ])
  })

  it('uses flats (Eb, not D#)', () => {
    // midi 39 = a half-step below the standard low E2 (40) → Eb2.
    expect(midiToNoteName(39)).toBe('Eb2')
    expect(midiToNoteName(51)).toBe('Eb3')
  })
})
