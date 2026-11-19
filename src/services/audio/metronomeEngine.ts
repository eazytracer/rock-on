/**
 * Metronome engine (docs/redesign/12 · 3.2): a lookahead scheduler on the audio
 * clock. A pump (a Web Worker timer, so background tabs don't starve it) tops
 * up ~1 s of clicks every 25 ms; every click is scheduled at its exact audio
 * time from `domain/metronome`, never from a JS timer. A change stops the
 * queued clicks not yet heard and re-anchors (`retime`), so it is instant.
 */
import {
  clickAt,
  retime,
  type Accent,
  type Click,
  type ClickGrid,
  type SigId,
  type Sub,
} from '../../domain/metronome'

export interface MetronomeSettings {
  bpm: number
  sig: SigId
  sub: Sub
  accents: readonly Accent[]
}

/** Seconds of clicks kept queued, and how often the pump tops it up. */
export const LOOKAHEAD = 1
export const PUMP_MS = 25

/** The click sounds Settings → Music offers (decision 6). Beep is the original. */
export type ClickSound = 'beep' | 'woodblock' | 'hihat'

const SOUND = {
  accent: { hz: 1568, gain: 0.4 },
  beat: { hz: 1046, gain: 0.24 },
  sub: { hz: 784, gain: 0.1 },
} as const

/** Woodblock: a pitched sine knock, falling a little, ~45 ms. */
const WOOD = {
  accent: { hz: 1250, gain: 0.55 },
  beat: { hz: 880, gain: 0.4 },
  sub: { hz: 700, gain: 0.16 },
} as const

/** Hi-hat: high-passed noise, ~40 ms (accent a touch longer). */
const HAT = {
  accent: { gain: 0.5, decay: 0.06 },
  beat: { gain: 0.32, decay: 0.035 },
  sub: { gain: 0.14, decay: 0.025 },
} as const

interface Queued {
  click: Click
  osc?: AudioScheduledSourceNode
  gain?: GainNode
}

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>()

function noise(ctx: BaseAudioContext): AudioBuffer {
  let b = noiseBuffers.get(ctx)
  if (!b) {
    b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.1), ctx.sampleRate)
    const d = b.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    noiseBuffers.set(ctx, b)
  }
  return b
}

/** Schedule one click of `sound` at audio time `t` into `out`. */
export function playClick(
  ctx: BaseAudioContext,
  out: AudioNode,
  sound: ClickSound,
  kind: 'accent' | 'beat' | 'sub',
  t: number
): { osc: AudioScheduledSourceNode; gain: GainNode } {
  const gain = ctx.createGain()
  if (sound === 'hihat') {
    const { gain: v, decay } = HAT[kind]
    const src = ctx.createBufferSource()
    src.buffer = noise(ctx)
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 7000
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(v, t + 0.001)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + decay)
    src.connect(hp).connect(gain).connect(out)
    src.start(t)
    src.stop(t + decay + 0.02)
    return { osc: src, gain }
  }
  const osc = ctx.createOscillator()
  if (sound === 'woodblock') {
    const { hz, gain: v } = WOOD[kind]
    osc.type = 'sine'
    osc.frequency.setValueAtTime(hz, t)
    osc.frequency.exponentialRampToValueAtTime(hz * 0.8, t + 0.04)
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(v, t + 0.001)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.045)
    osc.connect(gain).connect(out)
    osc.start(t)
    osc.stop(t + 0.06)
    return { osc, gain }
  }
  const { hz, gain: v } = SOUND[kind]
  osc.type = 'triangle'
  osc.frequency.value = hz
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(v, t + 0.002)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06)
  osc.connect(gain).connect(out)
  osc.start(t)
  osc.stop(t + 0.08)
  return { osc, gain }
}

/** A 25 ms tick from a Worker (falls back to setInterval). Returns stop. */
export function startPump(tick: () => void, ms = PUMP_MS): () => void {
  try {
    const src = `setInterval(function(){postMessage(0)},${ms})`
    const url = URL.createObjectURL(
      new Blob([src], { type: 'application/javascript' })
    )
    const w = new Worker(url)
    URL.revokeObjectURL(url)
    w.onmessage = tick
    return () => w.terminate()
  } catch {
    const id = setInterval(tick, ms)
    return () => clearInterval(id)
  }
}

export class MetronomeEngine {
  readonly ctx: BaseAudioContext
  private readonly out: AudioNode
  private readonly autoPump: boolean
  private grid: ClickGrid | null = null
  private nextN = 0
  private queue: Queued[] = []
  private stopPump: (() => void) | null = null
  /** Click sound for clicks scheduled from now on (Settings → Music). */
  sound: ClickSound = 'beep'
  /** Every click as it is scheduled (tests, the harness). */
  onSchedule?: (c: Click) => void

  constructor(
    ctx: BaseAudioContext,
    opts: { destination?: AudioNode; autoPump?: boolean } = {}
  ) {
    this.ctx = ctx
    this.out = opts.destination ?? ctx.destination
    this.autoPump = opts.autoPump ?? true
  }

  get running(): boolean {
    return this.grid !== null
  }

  start(s: MetronomeSettings, at = this.ctx.currentTime + 0.06) {
    this.stop()
    this.grid = { ...s, anchor: at, anchorIndex: 0 }
    this.nextN = 0
    this.pump()
    if (this.autoPump) this.stopPump = startPump(() => this.pump())
  }

  stop() {
    this.stopPump?.()
    this.stopPump = null
    this.cancelFrom(-Infinity)
    this.queue = []
    this.grid = null
  }

  /** Apply a change from the next click on. */
  update(change: Partial<MetronomeSettings>) {
    if (!this.grid) return
    const g = retime(this.grid, this.ctx.currentTime, change)
    this.cancelFrom(g.anchor - 1e-6)
    this.grid = g
    this.nextN = g.anchorIndex
    this.pump()
  }

  /** Top the queue up to `currentTime + LOOKAHEAD`. */
  pump() {
    const g = this.grid
    if (!g) return
    const now = this.ctx.currentTime
    this.queue = this.queue.filter(q => q.click.when > now - 1)
    for (;;) {
      const c = clickAt(g, this.nextN)
      if (c.when >= now + LOOKAHEAD) break
      this.nextN++
      // A starved pump drops a late click rather than playing it late.
      if (c.when < now - 0.005) continue
      this.queue.push(this.schedule(c))
      this.onSchedule?.(c)
    }
  }

  /** The last click at or before audio time `t` (for the beat lights). */
  clickBefore(t: number): Click | null {
    let hit: Click | null = null
    for (const q of this.queue) {
      if (q.click.when > t) break
      hit = q.click
    }
    return hit
  }

  private schedule(click: Click): Queued {
    if (click.kind === 'mute') return { click }
    return {
      click,
      ...playClick(this.ctx, this.out, this.sound, click.kind, click.when),
    }
  }

  /** Silence queued clicks at or after `t` and drop them from the queue. */
  private cancelFrom(t: number) {
    const keep: Queued[] = []
    for (const q of this.queue) {
      if (q.click.when < t) {
        keep.push(q)
        continue
      }
      try {
        q.gain?.disconnect()
        q.osc?.stop()
      } catch {
        /* already stopped */
      }
    }
    this.queue = keep
  }
}
