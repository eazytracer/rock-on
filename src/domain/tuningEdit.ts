/**
 * Tuning helpers (docs/redesign/12 · 3.1): the tuner's bass derivation
 * (decision 7) and the neck editor's maths (5g): standards per instrument and
 * string count (decision 6), per-string limits (−12 … +7 from that string's
 * standard), the All strings step, duplicate matching and the colours.
 */

export type TuningInstrument = 'guitar' | 'bass'

/** Guitar built-ins with a matching bass built-in. */
const BASS_FOR: Record<string, string> = {
  standard: 'bass-standard',
  'drop-d': 'bass-drop-d',
  'half-step-down': 'bass-eb',
}

/** The bass built-in that matches a guitar built-in slug, if there is one. */
export function bassBuiltinFor(guitarSlug: string | null | undefined) {
  return guitarSlug ? (BASS_FOR[guitarSlug] ?? null) : null
}

/** A guitar tuning on a 4-string bass: its four lowest strings an octave down. */
export function bassEquivalent(guitarPitches: readonly number[]): number[] {
  return guitarPitches.slice(0, 4).map(p => p - 12)
}

// ── The neck editor ──────────────────────────────────────────────────────────

/** String counts the editor offers (decision 6). */
export const STRING_COUNTS: Record<TuningInstrument, readonly number[]> = {
  guitar: [6, 7, 8],
  bass: [4, 5, 6],
}

/** How far a string may go from its standard (DECISIONS · Custom tuning). */
export const STEP_LIMITS = { down: -12, up: 7 } as const

/** Mirrors `public._standard_tuning` (the server checks the same table). */
const STANDARDS: Record<string, readonly number[]> = {
  guitar6: [40, 45, 50, 55, 59, 64],
  guitar7: [35, 40, 45, 50, 55, 59, 64],
  guitar8: [30, 35, 40, 45, 50, 55, 59, 64],
  bass4: [28, 33, 38, 43],
  bass5: [23, 28, 33, 38, 43],
  bass6: [23, 28, 33, 38, 43, 48],
}

/** The instrument's standard for a string count (MIDI, low → high), or null. */
export function standardFor(
  instrument: TuningInstrument,
  count: number
): number[] | null {
  const s = STANDARDS[`${instrument}${count}`]
  return s ? [...s] : null
}

/** Whether string `i` can move `delta` half steps and stay in its range. */
export function canStep(
  pitches: readonly number[],
  std: readonly number[],
  i: number,
  delta: number
): boolean {
  const off = pitches[i] + delta - std[i]
  return off >= STEP_LIMITS.down && off <= STEP_LIMITS.up
}

/** Move one string; unchanged (same array) at its limit. */
export function stepString(
  pitches: readonly number[],
  std: readonly number[],
  i: number,
  delta: number
): readonly number[] {
  if (!canStep(pitches, std, i, delta)) return pitches
  return pitches.map((p, j) => (j === i ? p + delta : p))
}

/** Whether every string can move together. */
export function canStepAll(
  pitches: readonly number[],
  std: readonly number[],
  delta: number
): boolean {
  return pitches.every((_, i) => canStep(pitches, std, i, delta))
}

/** Move every string; unchanged when any string would pass its limit. */
export function stepAll(
  pitches: readonly number[],
  std: readonly number[],
  delta: number
): readonly number[] {
  return canStepAll(pitches, std, delta) ? pitches.map(p => p + delta) : pitches
}

export interface MatchCandidate {
  instrument: TuningInstrument
  pitches: readonly number[]
}

/**
 * The first tuning with exactly these strings on this instrument (built-ins
 * first when the caller lists them first), or null. `exclude` skips the tuning
 * being edited.
 */
export function matchTuning<T extends MatchCandidate>(
  pitches: readonly number[],
  instrument: TuningInstrument,
  candidates: readonly T[],
  exclude?: T | null
): T | null {
  return (
    candidates.find(
      c =>
        c !== exclude &&
        c.instrument === instrument &&
        c.pitches.length === pitches.length &&
        c.pitches.every((p, i) => p === pitches[i])
    ) ?? null
  )
}

/** Drawn string widths in px, low → high (DECISIONS · Extended-range naming). */
const GAUGES: Record<string, readonly number[]> = {
  guitar6: [46, 36, 26, 17, 13, 10],
  guitar7: [59, 46, 36, 26, 17, 13, 10],
  guitar8: [74, 59, 46, 36, 26, 17, 13, 10],
  bass4: [105, 85, 65, 45],
  bass5: [130, 105, 85, 65, 45],
  bass6: [130, 105, 85, 65, 45, 30],
}

export function stringWidths(
  instrument: TuningInstrument,
  count: number
): number[] {
  const g = GAUGES[`${instrument}${count}`] ?? []
  return g.map(x =>
    Number((instrument === 'guitar' ? 0.8 + x * 0.06 : 1 + x * 0.03).toFixed(1))
  )
}

// ── Colours ──────────────────────────────────────────────────────────────────

/** OKLCH → sRGB hex, reducing chroma until in gamut (kit `rock.js` okhex). */
export function okhex(L: number, C: number, h: number): string {
  for (let c = C; c >= 0; c -= 0.005) {
    const a = c * Math.cos((h * Math.PI) / 180)
    const b = c * Math.sin((h * Math.PI) / 180)
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
    const lin = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ]
    if (lin.every(v => v >= -0.0005 && v <= 1.0005))
      return (
        '#' +
        lin
          .map(v => {
            v = Math.min(1, Math.max(0, v))
            v = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055
            return Math.round(v * 255)
              .toString(16)
              .padStart(2, '0')
          })
          .join('')
      )
  }
  return '#888888'
}

export interface ThemedColour {
  dark: string
  light: string
}

/**
 * Automatic colour from pitch (kit `customTuning`): lower tunings warmer.
 * The average offset from standard, −4 … +1 half steps, runs the hue.
 */
export function autoColour(
  pitches: readonly number[],
  std: readonly number[]
): ThemedColour {
  const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0)
  const off = (sum(pitches) - sum(std)) / pitches.length
  const t = Math.max(0, Math.min(1, (off + 4) / 5))
  const h = 345 - 235 * t
  return {
    dark: okhex(0.64 + 0.24 * t, 0.16, h),
    light: okhex(0.45 + 0.17 * t, 0.16, h),
  }
}

/** The 12 picks (Custom Tuning screen `PAL`), warm → cool. */
export const TUNING_SWATCHES: readonly ThemedColour[] = Array.from(
  { length: 12 },
  (_, i) => {
    const t = i / 11
    const h = 345 - 235 * t
    return {
      dark: okhex(0.66 + 0.22 * t, 0.16, h),
      light: okhex(0.46 + 0.16 * t, 0.16, h),
    }
  }
)

/**
 * Where the colour picker opens for a new tuning: the first swatch no tuning
 * in this context uses yet (DECISIONS Part A · 1), else the first.
 */
export function firstFreeSwatch(used: readonly (string | null | undefined)[]) {
  const taken = new Set(used.filter(Boolean).map(c => c!.toLowerCase()))
  return (
    TUNING_SWATCHES.find(s => !taken.has(s.dark) && !taken.has(s.light)) ??
    TUNING_SWATCHES[0]
  ).dark
}

/** A stored swatch in the theme's shade (other colours are shown as stored). */
export function themedSwatch(colour: string, theme: 'light' | 'dark') {
  const s = TUNING_SWATCHES.find(
    x => x.dark === colour.toLowerCase() || x.light === colour.toLowerCase()
  )
  return s ? s[theme] : colour
}

/**
 * The colour a custom tuning shows: its pick, else automatic from pitch
 * (`color = NULL` in the DB means automatic).
 */
export function customColour(
  t: {
    instrument: TuningInstrument
    pitches: readonly number[]
    color?: string | null
  },
  theme: 'light' | 'dark' = 'dark'
): string | null {
  if (t.color) return themedSwatch(t.color, theme)
  const std = standardFor(t.instrument, t.pitches.length)
  return std ? autoColour(t.pitches, std)[theme] : null
}
