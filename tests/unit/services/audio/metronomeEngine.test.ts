import { describe, it, expect } from 'vitest'
import { playClick } from '../../../../src/services/audio/metronomeEngine'

/** Records the nodes playClick builds (jsdom has no Web Audio). */
function fakeCtx() {
  const made: string[] = []
  const param = () => ({
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
  })
  const node = (kind: string, extra: Record<string, unknown> = {}) => {
    made.push(kind)
    const n: Record<string, unknown> = {
      connect: (x: unknown) => x,
      start() {},
      stop() {},
      ...extra,
    }
    return n
  }
  const ctx = {
    sampleRate: 8000,
    createGain: () => node('gain', { gain: param() }),
    createOscillator: () =>
      node('osc', { type: '', frequency: param() }) as unknown,
    createBiquadFilter: () =>
      node('filter', { type: '', frequency: param() }) as unknown,
    createBufferSource: () => node('noise', { buffer: null }) as unknown,
    createBuffer: (_c: number, len: number) => ({
      getChannelData: () => new Float32Array(len),
    }),
  }
  return { ctx: ctx as unknown as BaseAudioContext, made }
}

describe('playClick', () => {
  it('Beep stays the original triangle oscillator', () => {
    const { ctx, made } = fakeCtx()
    const { osc } = playClick(ctx, {} as AudioNode, 'beep', 'accent', 1)
    expect(made).toEqual(['gain', 'osc'])
    expect((osc as OscillatorNode).type).toBe('triangle')
    expect((osc as OscillatorNode).frequency.value).toBe(1568)
  })

  it('Woodblock is a sine knock', () => {
    const { ctx, made } = fakeCtx()
    const { osc } = playClick(ctx, {} as AudioNode, 'woodblock', 'beat', 1)
    expect(made).toEqual(['gain', 'osc'])
    expect((osc as OscillatorNode).type).toBe('sine')
  })

  it('Hi-hat is high-passed noise', () => {
    const { ctx, made } = fakeCtx()
    playClick(ctx, {} as AudioNode, 'hihat', 'sub', 1)
    expect(made).toEqual(['gain', 'noise', 'filter'])
  })
})
