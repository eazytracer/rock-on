/**
 * Pitch detection and tuner maths (docs/redesign/12 · 3.1). Pure: no Web
 * Audio, no DOM, so it ports to Dart and runs in Vitest.
 *
 * `detectPitch` is YIN (de Cheveigné & Kawahara 2002): the difference function
 * computed from an FFT autocorrelation, cumulative-mean normalised, an absolute
 * threshold, then parabolic interpolation around the chosen lag.
 */
import { hzToMidi, midiToHz } from './notes'

export interface PitchReading {
  hz: number
  /** 1 − the normalised difference at the chosen lag (1 = a pure tone). */
  clarity: number
}

export interface DetectOptions {
  /** Lowest pitch looked for (B0 on a 5-string bass is 30.9 Hz). */
  minHz?: number
  maxHz?: number
  /** YIN absolute threshold. */
  threshold?: number
  /** Below this RMS the frame is treated as silence. */
  rmsGate?: number
}

// ── FFT (iterative radix-2, in place) ────────────────────────────────────────

const twiddleCache = new Map<number, { cos: Float64Array; sin: Float64Array }>()

function twiddles(n: number) {
  let t = twiddleCache.get(n)
  if (!t) {
    const cos = new Float64Array(n / 2)
    const sin = new Float64Array(n / 2)
    for (let i = 0; i < n / 2; i++) {
      cos[i] = Math.cos((-2 * Math.PI * i) / n)
      sin[i] = Math.sin((-2 * Math.PI * i) / n)
    }
    t = { cos, sin }
    twiddleCache.set(n, t)
  }
  return t
}

/** In-place FFT of (re, im); `inverse` computes the unscaled inverse. */
export function fft(re: Float64Array, im: Float64Array, inverse = false) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      let t = re[i]
      re[i] = re[j]
      re[j] = t
      t = im[i]
      im[i] = im[j]
      im[j] = t
    }
  }
  const { cos, sin } = twiddles(n)
  const sign = inverse ? -1 : 1
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1
    const step = n / size
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < half; k++) {
        const wr = cos[k * step]
        const wi = sign * sin[k * step]
        const a = start + k
        const b = a + half
        const tr = re[b] * wr - im[b] * wi
        const ti = re[b] * wi + im[b] * wr
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
      }
    }
  }
}

const nextPow2 = (n: number) => 1 << Math.ceil(Math.log2(n))

// ── YIN ──────────────────────────────────────────────────────────────────────

/**
 * Detect the fundamental of `samples` (one frame, e.g. the last 4096 samples).
 * Returns null for silence, noise, or no clear period in range.
 */
export function detectPitch(
  samples: ArrayLike<number>,
  sampleRate: number,
  {
    minHz = 27,
    maxHz = 1400,
    threshold = 0.12,
    rmsGate = 0.01,
  }: DetectOptions = {}
): PitchReading | null {
  const size = samples.length
  const w = Math.floor(size / 2) // integration window
  if (w < 32) return null

  let energy = 0
  for (let i = 0; i < size; i++) energy += samples[i] * samples[i]
  if (Math.sqrt(energy / size) < rmsGate) return null

  const minTau = Math.max(2, Math.floor(sampleRate / maxHz))
  const maxTau = Math.min(w - 1, Math.ceil(sampleRate / minHz))
  if (maxTau <= minTau) return null

  // r(τ) = Σ_{j<w} x[j]·x[j+τ], via FFT cross-correlation of the first w
  // samples with the whole frame.
  const n = nextPow2(size * 2)
  const aRe = new Float64Array(n)
  const aIm = new Float64Array(n)
  const bRe = new Float64Array(n)
  const bIm = new Float64Array(n)
  for (let i = 0; i < size; i++) bRe[i] = samples[i]
  for (let i = 0; i < w; i++) aRe[i] = samples[i]
  fft(aRe, aIm)
  fft(bRe, bIm)
  for (let i = 0; i < n; i++) {
    // conj(A) · B
    const re = aRe[i] * bRe[i] + aIm[i] * bIm[i]
    const im = aRe[i] * bIm[i] - aIm[i] * bRe[i]
    aRe[i] = re
    aIm[i] = im
  }
  fft(aRe, aIm, true)

  // Prefix sums of x² for the window energies.
  const sq = new Float64Array(size + 1)
  for (let i = 0; i < size; i++) sq[i + 1] = sq[i] + samples[i] * samples[i]
  const e0 = sq[w]

  // Cumulative-mean-normalised difference d'(τ), τ = 1 … maxTau + 1.
  const cmnd = new Float64Array(maxTau + 2)
  cmnd[0] = 1
  let running = 0
  for (let tau = 1; tau <= maxTau + 1; tau++) {
    const et = sq[tau + w] - sq[tau]
    const d = Math.max(0, e0 + et - (2 * aRe[tau]) / n)
    running += d
    cmnd[tau] = running > 0 ? (d * tau) / running : 1
  }

  let tau = -1
  for (let t = minTau; t <= maxTau; t++) {
    if (cmnd[t] < threshold) {
      while (t + 1 <= maxTau && cmnd[t + 1] < cmnd[t]) t++
      tau = t
      break
    }
  }
  if (tau < 0) return null

  // Parabolic interpolation around the minimum.
  const y0 = cmnd[tau - 1]
  const y1 = cmnd[tau]
  const y2 = cmnd[tau + 1]
  const denom = y0 - 2 * y1 + y2
  const shift = denom !== 0 ? (0.5 * (y0 - y2)) / denom : 0
  const period = tau + (Math.abs(shift) < 1 ? shift : 0)
  const hz = sampleRate / period
  if (hz < minHz * 0.97 || hz > maxHz * 1.03) return null
  return { hz, clarity: Math.max(0, Math.min(1, 1 - y1)) }
}

// ── Tuner maths ──────────────────────────────────────────────────────────────

/** Cents from the MIDI note's pitch to `hz` (negative = flat). */
export function centsOff(hz: number, midi: number): number {
  return 1200 * Math.log2(hz / midiToHz(midi))
}

/**
 * The string nearest to `hz` and how far off it is. Octave-aware: when the
 * reading is far from every string (> 3.5 semitones), an octave up or down is
 * tried, since a weak fundamental can read an octave off.
 */
export function nearestString(
  hz: number,
  pitches: readonly number[]
): { index: number; cents: number } | null {
  if (!pitches.length || !(hz > 0)) return null
  const best = (f: number) => {
    let index = 0
    let cents = Infinity
    pitches.forEach((p, i) => {
      const c = centsOff(f, p)
      if (Math.abs(c) < Math.abs(cents)) {
        index = i
        cents = c
      }
    })
    return { index, cents }
  }
  let pick = best(hz)
  if (Math.abs(pick.cents) > 350) {
    for (const f of [hz / 2, hz * 2]) {
      const alt = best(f)
      if (Math.abs(alt.cents) < Math.abs(pick.cents)) pick = alt
    }
  }
  return pick
}

/** The note nearest to `hz` (MIDI) and the cents off it. */
export function nearestNote(hz: number): { midi: number; cents: number } {
  const midi = Math.round(hzToMidi(hz))
  return { midi, cents: centsOff(hz, midi) }
}

/** Within ±5 ¢ (DECISIONS · Tuner arrows). */
export const IN_TUNE_CENTS = 5

export function inTune(cents: number): boolean {
  return Math.abs(cents) <= IN_TUNE_CENTS
}

/** Lit chevrons: 3 beyond ±25 ¢, 2 at ±12–25, 1 at ±5–12, 0 in tune. */
export function chevrons(cents: number): 0 | 1 | 2 | 3 {
  const a = Math.abs(cents)
  if (a > 25) return 3
  if (a > 12) return 2
  if (a > IN_TUNE_CENTS) return 1
  return 0
}

/** Median of a short list (the tuner smooths 3–5 readings). */
export function median(values: readonly number[]): number {
  if (!values.length) return NaN
  const s = [...values].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
