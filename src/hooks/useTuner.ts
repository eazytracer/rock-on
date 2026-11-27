/**
 * The tuner's mic (docs/redesign/12 · 3.2–3.3). `start()` must run from a tap:
 * it asks for the mic (raw: no echo cancelling, noise suppression or gain
 * control), streams frames into `detectPitch`, and smooths the last readings
 * (median of 5). Every track stops on `stop()`, unmount, or the tab hiding.
 * `hold(ms)` ignores the mic while a reference note plays, so the tuner
 * doesn't tune to itself.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { detectPitch, median } from '../domain/pitch'
import { resumeAudio } from '../services/audio/audioContext'
import { openPitchFrames } from '../services/audio/tuner/pitchWorklet'
import { createLogger } from '../utils/logger'

const log = createLogger('useTuner')

export type TunerStatus =
  | 'idle'
  | 'starting'
  | 'listening'
  | 'denied'
  | 'no-device'
  | 'insecure'
  | 'error'

export interface TunerReading {
  hz: number
  clarity: number
}

/** A reading goes stale this long after the last clear frame. */
const STALE_MS = 350
const SMOOTH = 5

export function useTuner() {
  const [status, setStatus] = useState<TunerStatus>('idle')
  const [reading, setReading] = useState<TunerReading | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const close = useRef<(() => void) | null>(null)
  const recent = useRef<{ hz: number; clarity: number; at: number }[]>([])
  const holdUntil = useRef(0)
  const alive = useRef(true)

  const release = useCallback(() => {
    close.current?.()
    close.current = null
    stream.current?.getTracks().forEach(t => t.stop())
    stream.current = null
    recent.current = []
    setReading(null)
  }, [])

  const stop = useCallback(() => {
    release()
    setStatus(s => (s === 'listening' || s === 'starting' ? 'idle' : s))
  }, [release])

  const onFrame = useCallback((samples: Float32Array, sampleRate: number) => {
    const now = performance.now()
    if (now < holdUntil.current) return
    const r = detectPitch(samples, sampleRate)
    const list = recent.current.filter(x => now - x.at < STALE_MS)
    if (r) list.push({ ...r, at: now })
    recent.current = list.slice(-SMOOTH)
    const last = recent.current[recent.current.length - 1]
    setReading(prev => {
      if (!last) return prev ? null : prev
      // Wait for two agreeing frames before showing a new note.
      if (!prev && recent.current.length < 2) return prev
      return {
        hz: median(recent.current.map(x => x.hz)),
        clarity: last.clarity,
      }
    })
  }, [])

  const start = useCallback(async () => {
    if (stream.current) return
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setStatus('insecure')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('no-device')
      return
    }
    setStatus('starting')
    const ctx = resumeAudio()
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
      if (!alive.current) {
        s.getTracks().forEach(t => t.stop())
        return
      }
      stream.current = s
      close.current = await openPitchFrames(ctx, s, f =>
        onFrame(f, ctx.sampleRate)
      )
      setStatus('listening')
    } catch (err) {
      release()
      const name = (err as DOMException)?.name
      if (name === 'NotAllowedError' || name === 'SecurityError')
        setStatus('denied')
      else if (name === 'NotFoundError' || name === 'OverconstrainedError')
        setStatus('no-device')
      else {
        log.error('Starting the tuner failed', err)
        setStatus('error')
      }
    }
  }, [onFrame, release])

  const hold = useCallback((ms: number) => {
    holdUntil.current = performance.now() + ms
    recent.current = []
    setReading(null)
  }, [])

  useEffect(() => {
    alive.current = true
    const onHide = () => document.visibilityState === 'hidden' && stop()
    document.addEventListener('visibilitychange', onHide)
    return () => {
      alive.current = false
      document.removeEventListener('visibilitychange', onHide)
      release()
    }
  }, [release, stop])

  return { status, reading, start, stop, hold }
}
