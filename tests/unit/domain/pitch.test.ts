import { describe, it, expect } from 'vitest'
import {
  centsOff,
  chevrons,
  detectPitch,
  inTune,
  median,
  nearestNote,
  nearestString,
} from '../../../src/domain/pitch'
import { karplusStrong } from '../../../src/domain/pluck'
import { midiToHz } from '../../../src/domain/notes'

const SR = 48000
const FRAME = 4096

const sine = (hz: number, n = FRAME, sr = SR, amp = 0.5) =>
  Float32Array.from(
    { length: n },
    (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / sr)
  )

/** Band-limited sawtooth (first 12 harmonics, 1/k). */
const saw = (hz: number, n = FRAME, sr = SR) =>
  Float32Array.from({ length: n }, (_, i) => {
    let v = 0
    for (let k = 1; k <= 12 && k * hz < sr / 2; k++)
      v += Math.sin((2 * Math.PI * k * hz * i) / sr) / k
    return 0.3 * v
  })

const cents = (a: number, b: number) => 1200 * Math.log2(a / b)

describe('detectPitch', () => {
  const notes: [string, number][] = [
    ['B0', 30.868],
    ['E1', 41.203],
    ['A2', 110],
    ['E4', 329.628],
  ]
  for (const [name, hz] of notes) {
    it(`reads a sine at ${name} within ±1 ¢`, () => {
      const r = detectPitch(sine(hz), SR)
      expect(r).not.toBeNull()
      expect(Math.abs(cents(r!.hz, hz))).toBeLessThan(1)
    })
    it(`reads a sawtooth at ${name} within ±1 ¢`, () => {
      const r = detectPitch(saw(hz), SR)
      expect(r).not.toBeNull()
      expect(Math.abs(cents(r!.hz, hz))).toBeLessThan(1)
    })
  }

  it('works at 44.1 kHz too', () => {
    const r = detectPitch(sine(82.407, FRAME, 44100), 44100)
    expect(Math.abs(cents(r!.hz, 82.407))).toBeLessThan(1)
  })

  for (const [midi, name] of [
    [28, 'E1'],
    [45, 'A2'],
    [64, 'E4'],
  ] as const) {
    it(`reads a Karplus-Strong pluck at ${name} within ±1 ¢`, () => {
      const buf = karplusStrong(midi, SR, 0.6)
      const r = detectPitch(buf.subarray(2400, 2400 + FRAME), SR)
      expect(r).not.toBeNull()
      expect(Math.abs(cents(r!.hz, midiToHz(midi)))).toBeLessThan(1)
    })
  }

  it('returns null for silence', () => {
    expect(detectPitch(new Float32Array(FRAME), SR)).toBeNull()
    expect(detectPitch(sine(110, FRAME, SR, 0.001), SR)).toBeNull()
  })

  it('returns null for white noise', () => {
    let s = 12345
    const rnd = () =>
      ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31) * 2 - 1
    const noise = Float32Array.from({ length: FRAME }, () => 0.4 * rnd())
    expect(detectPitch(noise, SR)).toBeNull()
  })

  it('does not jump an octave on a strong 2nd harmonic', () => {
    const hz = 82.407
    const buf = Float32Array.from(
      { length: FRAME },
      (_, i) =>
        0.15 * Math.sin((2 * Math.PI * hz * i) / SR) +
        0.3 * Math.sin((2 * Math.PI * 2 * hz * i) / SR)
    )
    const r = detectPitch(buf, SR)
    expect(Math.abs(cents(r!.hz, hz))).toBeLessThan(1)
  })
})

describe('tuner maths', () => {
  it('centsOff', () => {
    expect(centsOff(110, 45)).toBeCloseTo(0, 6)
    expect(centsOff(107, 45)).toBeCloseTo(-47.9, 1)
    expect(centsOff(midiToHz(45.1), 45)).toBeCloseTo(10, 6)
  })

  it('nearestNote', () => {
    expect(nearestNote(110)).toEqual({ midi: 45, cents: 0 })
    expect(nearestNote(107).midi).toBe(45)
  })

  it('nearestString picks the closest string', () => {
    const std = [40, 45, 50, 55, 59, 64]
    expect(nearestString(110, std)?.index).toBe(1)
    expect(nearestString(107, std)?.index).toBe(1)
    expect(nearestString(midiToHz(63.7), std)?.index).toBe(5)
    expect(nearestString(0, std)).toBeNull()
    expect(nearestString(110, [])).toBeNull()
  })

  it('nearestString folds an octave when far from every string', () => {
    const std = [40, 45, 50, 55, 59, 64]
    // Low E read an octave low (E1), and high E read an octave high (E5).
    expect(nearestString(midiToHz(28), std)).toMatchObject({ index: 0 })
    expect(Math.abs(nearestString(midiToHz(28), std)!.cents)).toBeLessThan(0.01)
    expect(nearestString(midiToHz(76), std)).toMatchObject({ index: 5 })
    // Within 3.5 semitones of a string: no folding.
    expect(nearestString(midiToHz(52), std)).toMatchObject({ index: 2 })
  })

  it('chevron thresholds: 25 / 12 / 5 (DECISIONS)', () => {
    expect(chevrons(0)).toBe(0)
    expect(chevrons(5)).toBe(0)
    expect(chevrons(-5)).toBe(0)
    expect(chevrons(5.1)).toBe(1)
    expect(chevrons(12)).toBe(1)
    expect(chevrons(-12.5)).toBe(2)
    expect(chevrons(25)).toBe(2)
    expect(chevrons(25.1)).toBe(3)
    expect(chevrons(-48)).toBe(3)
  })

  it('inTune within ±5 ¢', () => {
    expect(inTune(4.9)).toBe(true)
    expect(inTune(-5)).toBe(true)
    expect(inTune(5.2)).toBe(false)
  })

  it('median', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 2, 3])).toBe(2.5)
    expect(median([])).toBeNaN()
  })
})

describe('karplusStrong', () => {
  it('has the period of the note, decays, and has no NaN', () => {
    const buf = karplusStrong(45, SR, 2)
    expect(buf.length).toBe(2 * SR)
    expect(buf.every(Number.isFinite)).toBe(true)
    const rms = (a: number, b: number) =>
      Math.sqrt(buf.subarray(a, b).reduce((s, x) => s + x * x, 0) / (b - a))
    expect(rms(SR * 1.5, SR * 2)).toBeLessThan(rms(0, SR * 0.5) / 4)
    const r = detectPitch(buf.subarray(4800, 4800 + FRAME), SR)
    expect(r!.hz).toBeCloseTo(SR / (SR / 110), 0)
  })
})
