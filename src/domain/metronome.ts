/**
 * Metronome maths (docs/redesign/12 · 3.1, DECISIONS · Metronome). Pure: the
 * engine in services/audio schedules what these functions return.
 *
 * Click times are always computed from an anchor, never accumulated:
 * `when = anchor + (n − anchorIndex) · interval`, so a 5-minute run has no
 * drift. A change re-anchors at the next click (`retime`).
 */

/** Tempo range everywhere (decision 10). */
export const BPM_MIN = 30
export const BPM_MAX = 260
export const DEFAULT_BPM = 120

export function clampBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return DEFAULT_BPM
  return Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(bpm)))
}

/** Italian marking for the tempo hero (124 → MODERATO, 164 → ALLEGRO). */
const MARKINGS: [number, string][] = [
  [200, 'PRESTO'],
  [168, 'VIVACE'],
  [132, 'ALLEGRO'],
  [108, 'MODERATO'],
  [76, 'ANDANTE'],
  [66, 'ADAGIO'],
]
export function marking(bpm: number): string {
  return MARKINGS.find(([min]) => bpm >= min)?.[1] ?? 'LARGO'
}

// ── Time signatures, subdivisions, accents ───────────────────────────────────

export type SigId = '2/4' | '3/4' | '4/4' | '6/8'
export interface Signature {
  id: SigId
  beats: number
  /** 8 = the beat is an eighth note (half the quarter-note BPM interval). */
  unit: 4 | 8
}
export const SIGNATURES: readonly Signature[] = [
  { id: '2/4', beats: 2, unit: 4 },
  { id: '3/4', beats: 3, unit: 4 },
  { id: '4/4', beats: 4, unit: 4 },
  { id: '6/8', beats: 6, unit: 8 },
]
export const signature = (id: SigId): Signature =>
  SIGNATURES.find(s => s.id === id) ?? SIGNATURES[2]

/** Clicks per beat: quarter, eighth, triplet, sixteenth. */
export type Sub = 1 | 2 | 3 | 4
export const SUBS: readonly Sub[] = [1, 2, 3, 4]

export type Accent = 'accent' | 'normal' | 'mute'

/** A new signature's accents: beat 1 (6/8: beats 1 and 4). */
export function defaultAccents(sig: SigId): Accent[] {
  const s = signature(sig)
  return Array.from({ length: s.beats }, (_, i) =>
    i === 0 || (s.unit === 8 && i === 3) ? 'accent' : 'normal'
  )
}

/** Tapping a beat cycles accent → normal → silent → accent. */
export function cycleAccent(a: Accent): Accent {
  return a === 'accent' ? 'normal' : a === 'normal' ? 'mute' : 'accent'
}

/** Seconds per beat at a tempo (6/8 counts eighths at twice the rate). */
export function beatSeconds(bpm: number, sig: SigId): number {
  return (60 / bpm) * (signature(sig).unit === 8 ? 0.5 : 1)
}

// ── The click grid ───────────────────────────────────────────────────────────

export interface ClickGrid {
  /** Audio-clock time of click `anchorIndex`. */
  anchor: number
  anchorIndex: number
  bpm: number
  sig: SigId
  sub: Sub
  accents: readonly Accent[]
}

export type ClickKind = 'accent' | 'beat' | 'sub' | 'mute'

export interface Click {
  /** Click number since the grid's bar 1 (sub-clicks count). */
  n: number
  when: number
  /** Beat in the bar, 0-based. */
  beat: number
  /** Sub-click within the beat, 0 = on the beat. */
  sub: number
  kind: ClickKind
}

export const clickInterval = (g: ClickGrid) => beatSeconds(g.bpm, g.sig) / g.sub

/** The click numbered `n` on the grid. */
export function clickAt(g: ClickGrid, n: number): Click {
  const beats = signature(g.sig).beats
  const beatIndex = Math.floor(n / g.sub)
  const beat = ((beatIndex % beats) + beats) % beats
  const sub = n - beatIndex * g.sub
  const accent = g.accents[beat] ?? 'normal'
  const kind: ClickKind =
    accent === 'mute'
      ? 'mute'
      : sub > 0
        ? 'sub'
        : accent === 'accent'
          ? 'accent'
          : 'beat'
  return {
    n,
    when: g.anchor + (n - g.anchorIndex) * clickInterval(g),
    beat,
    sub,
    kind,
  }
}

/** The first click number whose time is ≥ `t` (never before the anchor). */
export function firstClickAtOrAfter(g: ClickGrid, t: number): number {
  const k = Math.ceil((t - g.anchor) / clickInterval(g) - 1e-9)
  return g.anchorIndex + Math.max(0, k)
}

/** Every click with `from ≤ when < until`. */
export function clickTimes(g: ClickGrid, from: number, until: number): Click[] {
  const out: Click[] = []
  for (let n = firstClickAtOrAfter(g, from); ; n++) {
    const c = clickAt(g, n)
    if (c.when >= until) break
    out.push(c)
  }
  return out
}

/**
 * Re-anchor for a change, at the first click after `now` (the one not yet
 * heard). A tempo or accent change keeps the count; a new subdivision waits
 * for the next beat; a new signature starts a new bar on the next beat.
 */
export function retime(
  g: ClickGrid,
  now: number,
  change: Partial<Pick<ClickGrid, 'bpm' | 'sig' | 'sub' | 'accents'>>
): ClickGrid {
  const next = { ...g, ...change }
  if (change.bpm !== undefined) next.bpm = clampBpm(change.bpm)
  const subChanged = change.sub !== undefined && change.sub !== g.sub
  const sigChanged = change.sig !== undefined && change.sig !== g.sig
  let n = firstClickAtOrAfter(g, now)
  if (clickAt(g, n).when <= now) n++
  if (subChanged || sigChanged) {
    // Wait for the next beat boundary on the old grid.
    while (n % g.sub !== 0) n++
    const beatIndex = n / g.sub
    const when = clickAt(g, n).when
    return {
      ...next,
      anchor: when,
      anchorIndex: sigChanged ? 0 : beatIndex * next.sub,
    }
  }
  return { ...next, anchor: clickAt(g, n).when, anchorIndex: n }
}

// ── Tap tempo ────────────────────────────────────────────────────────────────

/** Taps older than this (since the last one) start over. */
export const TAP_RESET_MS = 2500

/** Add a tap (ms timestamp), keeping the last 4 within the reset window. */
export function addTap(taps: readonly number[], now: number): number[] {
  const last = taps[taps.length - 1]
  const kept = last !== undefined && now - last <= TAP_RESET_MS ? [...taps] : []
  kept.push(now)
  return kept.slice(-4)
}

/** Tempo from the taps (average gap), clamped; null under two taps. */
export function tapTempo(taps: readonly number[]): number | null {
  if (taps.length < 2) return null
  const gap = (taps[taps.length - 1] - taps[0]) / (taps.length - 1)
  if (!(gap > 0)) return null
  return clampBpm(60000 / gap)
}
