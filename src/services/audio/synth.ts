/**
 * The in-app synth (docs/redesign/12 · 3.2): Karplus-Strong plucks for strings
 * and chords, and a soft "felt piano" note. All sound goes through the shared
 * context; call from a tap (the first sound must follow a user gesture).
 *
 *   pluck(midi, when?)   one string (tuner reference, the neck editor)
 *   strum(midis, when?)  a chord, low → high, 42 ms apart (chord card, chart)
 *   note(midi, when?)    the starting note
 */
import { karplusStrong } from '../../domain/pluck'
import { midiToHz } from '../../domain/notes'
import { resumeAudio } from './audioContext'

/** Gap between strings in a strum (seconds). */
export const STRUM_GAP = 0.042

const buffers = new Map<string, AudioBuffer>()

function ksBuffer(ctx: BaseAudioContext, midi: number): AudioBuffer {
  const key = `${ctx.sampleRate}:${midi}`
  let b = buffers.get(key)
  if (!b) {
    const data = karplusStrong(midi, ctx.sampleRate, 2.4)
    b = ctx.createBuffer(1, data.length, ctx.sampleRate)
    b.getChannelData(0).set(data)
    buffers.set(key, b)
  }
  return b
}

/** Pluck one string. `when` is audio-clock time (default: now). */
export function pluck(midi: number, when?: number, ctx?: BaseAudioContext) {
  const c = ctx ?? resumeAudio()
  const at = when ?? c.currentTime
  const src = c.createBufferSource()
  const lp = c.createBiquadFilter()
  const g = c.createGain()
  src.buffer = ksBuffer(c, midi)
  lp.type = 'lowpass'
  lp.frequency.value = 2300
  g.gain.value = 0.35
  src.connect(lp).connect(g).connect(c.destination)
  src.start(at)
}

/** Strum a chord: MIDI notes low → high (muted strings left out). */
export function strum(midis: readonly number[], when?: number) {
  const c = resumeAudio()
  const at = when ?? c.currentTime
  ;[...midis]
    .sort((a, b) => a - b)
    .forEach((m, i) => pluck(m, at + i * STRUM_GAP, c))
}

/** A soft piano-like note: sine + quiet 2nd / 3rd harmonics, 12 ms attack. */
export function note(midi: number, when?: number) {
  const c = resumeAudio()
  const at = when ?? c.currentTime
  const f = midiToHz(midi)
  const out = c.createGain()
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = Math.min(4000, f * 6)
  out.gain.setValueAtTime(0, at)
  out.gain.linearRampToValueAtTime(0.32, at + 0.012)
  out.gain.exponentialRampToValueAtTime(0.0001, at + 2.2)
  lp.connect(out).connect(c.destination)
  ;[
    [1, 1],
    [2, 0.18],
    [3, 0.06],
  ].forEach(([h, v]) => {
    const o = c.createOscillator()
    const g = c.createGain()
    o.frequency.value = f * h
    g.gain.value = v
    o.connect(g).connect(lp)
    o.start(at)
    o.stop(at + 2.3)
  })
}
