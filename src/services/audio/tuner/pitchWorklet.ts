/**
 * Mic frames for the tuner (docs/redesign/12 · 3.2). An AudioWorkletProcessor
 * fills a ring buffer from the 128-frame quanta and every ~40 ms posts the last
 * 4096 samples; the page runs `detectPitch` on them (a few ms at 25 Hz). Where
 * `audioWorklet` is missing, an AnalyserNode is polled on rAF instead.
 *
 * The processor is a plain string loaded from a Blob URL: it imports nothing,
 * so there is no worklet bundling to get wrong.
 */
import { createLogger } from '../../../utils/logger'

const log = createLogger('pitchWorklet')

export const FRAME_SIZE = 4096
const EVERY_MS = 40
const NAME = 'rockon-pitch-frames'

const PROCESSOR = `
class PitchFrames extends AudioWorkletProcessor {
  constructor() {
    super()
    this.size = ${FRAME_SIZE}
    this.buf = new Float32Array(this.size)
    this.w = 0
    this.filled = 0
    this.since = 0
    this.every = Math.round(sampleRate * ${EVERY_MS} / 1000)
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0]
    if (!ch) return true
    for (let i = 0; i < ch.length; i++) {
      this.buf[this.w] = ch[i]
      this.w = (this.w + 1) % this.size
    }
    this.filled = Math.min(this.size, this.filled + ch.length)
    this.since += ch.length
    if (this.since >= this.every && this.filled === this.size) {
      this.since = 0
      const out = new Float32Array(this.size)
      out.set(this.buf.subarray(this.w))
      out.set(this.buf.subarray(0, this.w), this.size - this.w)
      this.port.postMessage(out, [out.buffer])
    }
    return true
  }
}
registerProcessor('${NAME}', PitchFrames)
`

const loaded = new WeakSet<BaseAudioContext>()

/**
 * Feed `onFrame` with the last 4096 mic samples ~25 times a second. Returns a
 * function that disconnects everything (the caller stops the stream's tracks).
 */
export async function openPitchFrames(
  ctx: AudioContext,
  stream: MediaStream,
  onFrame: (samples: Float32Array) => void
): Promise<() => void> {
  const source = ctx.createMediaStreamSource(stream)
  // A silent sink keeps the graph pulling in every browser.
  const sink = ctx.createGain()
  sink.gain.value = 0
  sink.connect(ctx.destination)

  if (ctx.audioWorklet) {
    try {
      if (!loaded.has(ctx)) {
        const url = URL.createObjectURL(
          new Blob([PROCESSOR], { type: 'application/javascript' })
        )
        await ctx.audioWorklet.addModule(url)
        URL.revokeObjectURL(url)
        loaded.add(ctx)
      }
      const node = new AudioWorkletNode(ctx, NAME, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
        channelCountMode: 'explicit',
      })
      node.port.onmessage = e => onFrame(e.data as Float32Array)
      source.connect(node).connect(sink)
      return () => {
        node.port.onmessage = null
        source.disconnect()
        node.disconnect()
        sink.disconnect()
      }
    } catch (err) {
      log.warn('AudioWorklet unavailable, using an AnalyserNode', err)
    }
  }

  const analyser = ctx.createAnalyser()
  analyser.fftSize = FRAME_SIZE
  source.connect(analyser).connect(sink)
  const frame = new Float32Array(FRAME_SIZE)
  let raf = 0
  let last = 0
  const poll = (t: number) => {
    raf = requestAnimationFrame(poll)
    if (t - last < EVERY_MS) return
    last = t
    analyser.getFloatTimeDomainData(frame)
    onFrame(frame)
  }
  raf = requestAnimationFrame(poll)
  return () => {
    cancelAnimationFrame(raf)
    source.disconnect()
    analyser.disconnect()
    sink.disconnect()
  }
}
