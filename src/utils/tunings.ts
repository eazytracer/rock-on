/**
 * Canonical guitar-tuning registry.
 *
 * Single source of truth for:
 * - The built-in tuning list shown in song creation/editing UI.
 * - The color each tuning gets on song cards, metadata pills, and the
 *   practice session viewer.
 * - String canonicalization for legacy values stored in the database
 *   (e.g. "Standard (EADGBE)", "Half Step Down", "half-step-down" all
 *   resolve to the same entry).
 *
 * Future custom-tuning feature: user-defined tunings layer on top of this
 * built-in list (with optional per-color override). The lookup helpers
 * accept an optional second argument that merges user entries in.
 *
 * Palette A was approved in the UI unification review (2026-04-22).
 * See `.claude/specifications/2025-10-22T14:01_design-style-guide.md`
 * "2026-04-22 Update" section for the rationale.
 */

export interface TuningEntry {
  id: string
  label: string
  color: string
}

/** Built-in canonical tunings — Palette A. */
export const CANONICAL_TUNINGS: readonly TuningEntry[] = [
  { id: 'standard', label: 'Standard', color: '#60a5fa' },
  { id: 'drop-d', label: 'Drop D', color: '#f97316' },
  { id: 'drop-c', label: 'Drop C', color: '#ef4444' },
  { id: 'drop-b', label: 'Drop B', color: '#a855f7' },
  { id: 'half-step-down', label: 'Half-step down', color: '#14b8a6' },
  { id: 'whole-step-down', label: 'Whole-step down', color: '#0ea5e9' },
  { id: 'open-g', label: 'Open G', color: '#eab308' },
  { id: 'open-d', label: 'Open D', color: '#ec4899' },
  { id: 'dadgad', label: 'DADGAD', color: '#10b981' },
] as const

/** Fallback color for custom / unrecognized tunings. */
export const FALLBACK_TUNING_COLOR = '#6b7280'

/**
 * Normalize a free-text tuning string so legacy label drift all resolves
 * to the same canonical id:
 * - "Standard (EADGBE)" → "standard"
 * - "Standard" → "standard"
 * - "Half Step Down", "Half-step down", "half_step_down" → "half-step-down"
 * - Custom strings are preserved as lowercased-dashed ids.
 */
export function canonicalTuningId(input: string | undefined | null): string {
  if (!input) return 'standard'
  const lowered = input.trim().toLowerCase()
  if (!lowered) return 'standard'

  // Normalize separators to dashes
  const dashed = lowered.replace(/[_\s]+/g, '-')

  // Mirror the SQL `builtin_tuning_slug()` normalizer (tunings migration) EXACTLY
  // so a legacy free-text label resolves to the SAME built-in on both the app and
  // DB sides (the DB backfills songs.tuning_id from this). Keep the two in
  // lock-step — parity is asserted in tests/unit/utils/tunings.test.ts.
  if (
    dashed.startsWith('standard') ||
    ['e-standard', 'e', 'eadgbe'].includes(dashed)
  )
    return 'standard'
  if (dashed === 'drop-d') return 'drop-d'
  if (dashed === 'drop-c') return 'drop-c'
  if (dashed === 'drop-b') return 'drop-b'

  // ½-step down is commonly labelled "Eb Standard" / "Eb".
  if (
    [
      'half-step-down',
      'half-down',
      'half-step',
      'eb-standard',
      'e-flat-standard',
      'eb',
      'e-flat',
    ].includes(dashed)
  )
    return 'half-step-down'

  // Whole-step down is commonly labelled "D Standard".
  if (
    [
      'whole-step-down',
      'whole-down',
      'whole-step',
      'd-standard',
      'd-flat-standard',
    ].includes(dashed)
  )
    return 'whole-step-down'

  if (dashed === 'open-g') return 'open-g'
  if (dashed === 'open-d') return 'open-d'
  if (dashed === 'dadgad') return 'dadgad'

  // SQL returns NULL for unmatched; the app keeps a dashed custom id.
  return dashed
}

/**
 * Resolve a tuning string to its display color.
 * Custom / unrecognized tunings return the neutral fallback.
 */
export function tuningColor(
  tuning: string | undefined | null,
  extraTunings?: readonly TuningEntry[]
): string {
  const id = canonicalTuningId(tuning)
  const registry = extraTunings
    ? [...CANONICAL_TUNINGS, ...extraTunings]
    : CANONICAL_TUNINGS
  const entry = registry.find(t => t.id === id)
  return entry?.color ?? FALLBACK_TUNING_COLOR
}

/** Canonical display label for a tuning string. */
export function tuningLabel(
  tuning: string | undefined | null,
  extraTunings?: readonly TuningEntry[]
): string {
  const id = canonicalTuningId(tuning)
  const registry = extraTunings
    ? [...CANONICAL_TUNINGS, ...extraTunings]
    : CANONICAL_TUNINGS
  const entry = registry.find(t => t.id === id)
  // Fall back to the raw input if it's a custom tuning; default to "Standard"
  return entry?.label ?? tuning ?? 'Standard'
}

/**
 * Convenience list of labels for rendering a <select> of tunings in song
 * creation / editing UIs. Returns just the built-in labels in registry
 * order.
 */
export function builtInTuningLabels(): string[] {
  return CANONICAL_TUNINGS.map(t => t.label)
}

// ── Full built-in tuning data (mirrors the seed in the tunings migration) ─────
// Local copy so the picker + custom-tuning create flow work offline and can
// pre-fill from a matching standard. Pitches are MIDI, low→high string.
// `slug` matches public.tunings.slug (and CANONICAL_TUNINGS ids for color).
export interface BuiltinTuning {
  slug: string
  name: string
  instrument: 'guitar' | 'bass'
  stringCount: number
  pitches: number[]
  color: string | null
}

export const BUILTIN_TUNINGS: readonly BuiltinTuning[] = [
  // Guitar (6-string)
  {
    slug: 'standard',
    name: 'Standard',
    instrument: 'guitar',
    stringCount: 6,
    pitches: [40, 45, 50, 55, 59, 64],
    color: '#60a5fa',
  },
  {
    slug: 'drop-d',
    name: 'Drop D',
    instrument: 'guitar',
    stringCount: 6,
    pitches: [38, 45, 50, 55, 59, 64],
    color: '#f97316',
  },
  {
    slug: 'half-step-down',
    name: 'Eb / Half-step down',
    instrument: 'guitar',
    stringCount: 6,
    pitches: [39, 44, 49, 54, 58, 63],
    color: '#14b8a6',
  },
  {
    slug: 'whole-step-down',
    name: 'D / Whole-step down',
    instrument: 'guitar',
    stringCount: 6,
    pitches: [38, 43, 48, 53, 57, 62],
    color: '#0ea5e9',
  },
  {
    slug: 'drop-c',
    name: 'Drop C',
    instrument: 'guitar',
    stringCount: 6,
    pitches: [36, 43, 48, 53, 57, 62],
    color: '#ef4444',
  },
  {
    slug: 'drop-b',
    name: 'Drop B',
    instrument: 'guitar',
    stringCount: 6,
    pitches: [35, 42, 47, 52, 56, 61],
    color: '#a855f7',
  },
  {
    slug: 'open-g',
    name: 'Open G',
    instrument: 'guitar',
    stringCount: 6,
    pitches: [38, 43, 50, 55, 59, 62],
    color: '#eab308',
  },
  {
    slug: 'open-d',
    name: 'Open D',
    instrument: 'guitar',
    stringCount: 6,
    pitches: [38, 45, 50, 54, 57, 62],
    color: '#ec4899',
  },
  {
    slug: 'dadgad',
    name: 'DADGAD',
    instrument: 'guitar',
    stringCount: 6,
    pitches: [38, 45, 50, 55, 57, 62],
    color: '#10b981',
  },
  // Guitar (extended range)
  {
    slug: 'standard-7',
    name: '7-string standard',
    instrument: 'guitar',
    stringCount: 7,
    pitches: [35, 40, 45, 50, 55, 59, 64],
    color: null,
  },
  {
    slug: 'standard-8',
    name: '8-string standard',
    instrument: 'guitar',
    stringCount: 8,
    pitches: [30, 35, 40, 45, 50, 55, 59, 64],
    color: null,
  },
  // Bass
  {
    slug: 'bass-standard',
    name: 'Bass standard',
    instrument: 'bass',
    stringCount: 4,
    pitches: [28, 33, 38, 43],
    color: null,
  },
  {
    slug: 'bass-drop-d',
    name: 'Bass Drop D',
    instrument: 'bass',
    stringCount: 4,
    pitches: [26, 33, 38, 43],
    color: null,
  },
  {
    slug: 'bass-eb',
    name: 'Bass Eb / Half-step down',
    instrument: 'bass',
    stringCount: 4,
    pitches: [27, 32, 37, 42],
    color: null,
  },
  {
    slug: 'bass-5',
    name: '5-string bass',
    instrument: 'bass',
    stringCount: 5,
    pitches: [23, 28, 33, 38, 43],
    color: null,
  },
  {
    slug: 'bass-6',
    name: '6-string bass',
    instrument: 'bass',
    stringCount: 6,
    pitches: [23, 28, 33, 38, 43, 48],
    color: null,
  },
] as const

/** MIDI note number → note name with octave (flats for accidentals, e.g. Eb3). */
export function midiToNoteName(midi: number): string {
  const names = [
    'C',
    'Db',
    'D',
    'Eb',
    'E',
    'F',
    'Gb',
    'G',
    'Ab',
    'A',
    'Bb',
    'B',
  ]
  const octave = Math.floor(midi / 12) - 1
  return `${names[((midi % 12) + 12) % 12]}${octave}`
}
