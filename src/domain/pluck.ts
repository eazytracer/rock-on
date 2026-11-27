/**
 * Karplus-Strong plucked string (docs/redesign/12 · 3.1), the maths of the
 * `design/demo/desktop-tools.js` reference: a noise burst smoothed twice, a
 * two-point average in the loop, decay `.996 − min(.004, f / 50000)` per pass.
 *
 * One addition: a first-order all-pass in the loop tunes the fractional part
 * of the period, so the reference note is in tune (an integer-only delay is up
 * to ~12 ¢ off on the high strings, too much for a tuner's reference).
 */
import { midiToHz } from './notes'

/** Seeded PRNG so a buffer is reproducible in tests. */
function lcg(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

export function karplusStrong(
  midi: number,
  sampleRate: number,
  seconds = 2.4,
  random: () => number = lcg(midi * 7919 + 17)
): Float32Array {
  const f = midiToHz(midi)
  const out = new Float32Array(Math.floor(sampleRate * seconds))
  const period = sampleRate / f
  // Loop delay = ring (n) + two-point average (0.5) + all-pass (frac).
  const n = Math.max(2, Math.floor(period - 0.5 - 0.1))
  const frac = period - 0.5 - n
  const c = (1 - frac) / (1 + frac)

  const ring = new Float32Array(n)
  for (let i = 0; i < n; i++) ring[i] = random() * 2 - 1
  for (let pass = 0; pass < 2; pass++)
    for (let i = 0; i < n; i++) ring[i] = (ring[i] + ring[(i + 1) % n]) * 0.5

  const decay = 0.996 - Math.min(0.004, f / 50000)
  let prev = ring[n - 1]
  let apIn = 0
  let apOut = 0
  let x = 0
  for (let i = 0; i < out.length; i++) {
    const cur = ring[x]
    out[i] = cur
    const avg = decay * 0.5 * (cur + prev)
    prev = cur
    const ap = c * avg + apIn - c * apOut
    apIn = avg
    apOut = ap
    ring[x] = ap
    x = (x + 1) % n
  }
  return out
}
