/**
 * /dev/audio-harness (dev builds only): drives the real metronome engine for
 * tests/e2e/tools/metronome-drift.spec.ts (docs/redesign/12 · 3.4).
 *
 * `__runMetronome` renders an OfflineAudioContext, pumping the engine every
 * 25 ms of audio time through `suspend()` exactly as the live pump does, then
 * finds each click's onset in the rendered audio and compares it with the
 * ideal grid (computed here independently of `domain/metronome`).
 * `__runRealMetronome` runs a live AudioContext (worker pump) for a few
 * seconds and reports the spacing of what it scheduled.
 */
import React, { useEffect, useState } from 'react'
import {
  beatSeconds,
  defaultAccents,
  type Click,
  type SigId,
  type Sub,
} from '../domain/metronome'
import { MetronomeEngine, PUMP_MS } from '../services/audio/metronomeEngine'
import { getAudioContext } from '../services/audio/audioContext'

export interface OfflineRun {
  bpm: number
  sig?: SigId
  sub?: Sub
  seconds: number
  /** Change the tempo once, at this audio time. */
  changeAt?: { time: number; bpm: number }
}

export interface OfflineResult {
  clicks: number
  expected: number
  maxErrorMs: number
  /** When the change was applied (audio time), if any. */
  changedAt: number | null
}

const SR = 48000
const START = 0.05

function onsets(data: Float32Array, threshold = 0.003, quietMs = 5): number[] {
  const quiet = Math.round((quietMs / 1000) * SR)
  const out: number[] = []
  let silent = quiet
  for (let i = 0; i < data.length; i++) {
    if (Math.abs(data[i]) > threshold) {
      if (silent >= quiet) out.push(i / SR)
      silent = 0
    } else silent++
  }
  return out
}

async function runOffline({
  bpm,
  sig = '4/4',
  sub = 1,
  seconds,
  changeAt,
}: OfflineRun): Promise<OfflineResult> {
  const ctx = new OfflineAudioContext(1, Math.ceil(seconds * SR), SR)
  const engine = new MetronomeEngine(ctx, { autoPump: false })
  const accents = defaultAccents(sig)
  const step = PUMP_MS / 1000
  let changedAt: number | null = null

  const tick = (t: number) => {
    void ctx.suspend(t).then(() => {
      if (changeAt && changedAt === null && ctx.currentTime >= changeAt.time) {
        changedAt = ctx.currentTime
        engine.update({ bpm: changeAt.bpm })
      }
      engine.pump()
      if (t + step < seconds) tick(t + step)
      void ctx.resume()
    })
  }
  engine.start({ bpm, sig, sub, accents }, START)
  tick(step)
  const rendered = await ctx.startRendering()
  const got = onsets(rendered.getChannelData(0))

  // The ideal grid, from first principles (the last 0.1 s is left out).
  const limit = seconds - 0.1
  const oldStep = beatSeconds(bpm, sig) / sub
  const ideal: number[] = []
  for (let k = 0; ; k++) {
    const t = START + k * oldStep
    if (t >= limit || (changedAt !== null && t > changedAt)) break
    ideal.push(t)
  }
  if (changeAt && changedAt !== null) {
    const newStep = beatSeconds(changeAt.bpm, sig) / sub
    const a = START + (Math.floor((changedAt - START) / oldStep) + 1) * oldStep
    for (let j = 0; a + j * newStep < limit; j++) ideal.push(a + j * newStep)
  }
  const matched = got.filter(x => x < limit)
  let maxErrorMs = matched.length === ideal.length ? 0 : Infinity
  if (matched.length === ideal.length)
    matched.forEach((x, i) => {
      maxErrorMs = Math.max(maxErrorMs, Math.abs(x - ideal[i]) * 1000)
    })
  return {
    clicks: matched.length,
    expected: ideal.length,
    maxErrorMs,
    changedAt,
  }
}

export interface RealResult {
  scheduled: number
  maxSpacingErrorMs: number
  /** Smallest gap between scheduling a click and its time (ms). */
  minLeadMs: number
  state: string
}

async function runReal({
  bpm,
  seconds,
}: {
  bpm: number
  seconds: number
}): Promise<RealResult> {
  const ctx = getAudioContext()
  await ctx.resume()
  const quiet = ctx.createGain()
  quiet.gain.value = 0
  quiet.connect(ctx.destination)
  const engine = new MetronomeEngine(ctx, { destination: quiet })
  const seen: { c: Click; at: number }[] = []
  engine.onSchedule = c => seen.push({ c, at: ctx.currentTime })
  engine.start({ bpm, sig: '4/4', sub: 1, accents: defaultAccents('4/4') })
  await new Promise(r => setTimeout(r, seconds * 1000))
  engine.stop()
  quiet.disconnect()
  const step = 60 / bpm
  let maxSpacingErrorMs = 0
  let minLeadMs = Infinity
  seen.forEach(({ c, at }, i) => {
    if (i > 0)
      maxSpacingErrorMs = Math.max(
        maxSpacingErrorMs,
        Math.abs(c.when - seen[i - 1].c.when - step) * 1000
      )
    if (c.when > seen[0].c.when + 1)
      minLeadMs = Math.min(minLeadMs, (c.when - at) * 1000)
  })
  return {
    scheduled: seen.length,
    maxSpacingErrorMs,
    minLeadMs,
    state: ctx.state,
  }
}

declare global {
  interface Window {
    __runMetronome?: typeof runOffline
    __runRealMetronome?: typeof runReal
  }
}

export const DevAudioHarnessPage: React.FC = () => {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    window.__runMetronome = runOffline
    window.__runRealMetronome = runReal
    setReady(true)
    return () => {
      delete window.__runMetronome
      delete window.__runRealMetronome
    }
  }, [])
  return (
    <div
      className="p-6 font-mono text-[13px] text-ink-2"
      data-testid="dev-audio-harness-page"
      data-ready={ready || undefined}
    >
      Audio harness: window.__runMetronome / __runRealMetronome
    </div>
  )
}

export default DevAudioHarnessPage
