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

const SOUND = {
  accent: { hz: 1568, gain: 0.4 },
  beat: { hz: 1046, gain: 0.24 },
  sub: { hz: 784, gain: 0.1 },
} as const

interface Queued {
  click: Click
  osc?: OscillatorNode
  gain?: GainNode
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
    const { hz, gain: v } = SOUND[click.kind]
    const t = click.when
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = hz
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(v, t + 0.002)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06)
    osc.connect(gain).connect(this.out)
    osc.start(t)
    osc.stop(t + 0.08)
    return { click, osc, gain }
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
