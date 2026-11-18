/**
 * The one shared AudioContext (docs/redesign/12 · 3.2). Created lazily and
 * resumed from a tap (autoplay rules); iOS's `interrupted` state (a call,
 * Siri) resumes on the next tap the same way. Never create one per sound.
 */
import { createLogger } from '../../utils/logger'

const log = createLogger('audioContext')

type Ctor = typeof AudioContext
let ctx: AudioContext | null = null

/** True where Web Audio exists. */
export function audioSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!(
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext
    )
  )
}

/** The shared context (created on first use). */
export function getAudioContext(): AudioContext {
  if (!ctx) {
    const C =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: Ctor }).webkitAudioContext
    ctx = new C({ latencyHint: 'interactive' })
  }
  return ctx
}

/**
 * Get the context and resume it. Call from inside a tap handler (Start, a
 * string, Play) so the browser lets it make sound.
 */
export function resumeAudio(): AudioContext {
  const c = getAudioContext()
  if (c.state !== 'running')
    c.resume().catch(err => log.warn('AudioContext resume failed', err))
  return c
}

/** Audio-clock time the listener is hearing now (output latency removed). */
export function heardTime(c: BaseAudioContext): number {
  const live = c as AudioContext
  const latency =
    typeof live.outputLatency === 'number' && live.outputLatency > 0
      ? live.outputLatency
      : typeof live.baseLatency === 'number'
        ? live.baseLatency
        : 0
  return c.currentTime - latency
}
