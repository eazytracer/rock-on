/**
 * Proposed tuning color registry (v1 draft for /dev/ui-preview review).
 *
 * Design principles:
 * - Every canonical tuning gets a unique, identifiable color (no neutral gray
 *   fallback for Standard — all tunings should be easy to spot).
 * - Custom tunings will eventually be user-definable; the registry API is a
 *   lookup function so custom entries can merge in at runtime without touching
 *   component code.
 * - Palettes offered in multiple variants so reviewers can compare.
 *
 * This file lives under src/pages/DevUIPreview/ intentionally — it is a
 * proposal, not the production registry. When the palette is approved, it
 * moves to src/utils/tunings.ts.
 */

export interface TuningEntry {
  id: string
  label: string
  color: string
}

/**
 * Palette A — Bright & saturated (high contrast on dark).
 * Inspired by highlight pens — easy to distinguish in small UI.
 */
export const PALETTE_A: TuningEntry[] = [
  { id: 'standard', label: 'Standard', color: '#60a5fa' }, // sky blue
  { id: 'drop-d', label: 'Drop D', color: '#f97316' }, // orange
  { id: 'drop-c', label: 'Drop C', color: '#ef4444' }, // red
  { id: 'drop-b', label: 'Drop B', color: '#a855f7' }, // purple
  { id: 'half-step-down', label: 'Half-step down', color: '#14b8a6' }, // teal
  { id: 'whole-step-down', label: 'Whole-step down', color: '#0ea5e9' }, // cyan
  { id: 'open-g', label: 'Open G', color: '#eab308' }, // yellow
  { id: 'open-d', label: 'Open D', color: '#ec4899' }, // pink
  { id: 'dadgad', label: 'DADGAD', color: '#10b981' }, // green
]

/**
 * Palette B — Muted / pastel (calmer overall, still distinguishable).
 * Good if colors feel too "neon" on large TVs.
 */
export const PALETTE_B: TuningEntry[] = [
  { id: 'standard', label: 'Standard', color: '#93c5fd' },
  { id: 'drop-d', label: 'Drop D', color: '#fdba74' },
  { id: 'drop-c', label: 'Drop C', color: '#fca5a5' },
  { id: 'drop-b', label: 'Drop B', color: '#d8b4fe' },
  { id: 'half-step-down', label: 'Half-step down', color: '#5eead4' },
  { id: 'whole-step-down', label: 'Whole-step down', color: '#7dd3fc' },
  { id: 'open-g', label: 'Open G', color: '#fde047' },
  { id: 'open-d', label: 'Open D', color: '#f9a8d4' },
  { id: 'dadgad', label: 'DADGAD', color: '#86efac' },
]

/**
 * Palette C — "Guitar string" family.
 * Warms slide along the color wheel in the order guitarists think about
 * tunings (standard → drop tunings → open tunings).
 */
export const PALETTE_C: TuningEntry[] = [
  { id: 'standard', label: 'Standard', color: '#38bdf8' },
  { id: 'drop-d', label: 'Drop D', color: '#818cf8' },
  { id: 'drop-c', label: 'Drop C', color: '#a78bfa' },
  { id: 'drop-b', label: 'Drop B', color: '#c084fc' },
  { id: 'half-step-down', label: 'Half-step down', color: '#f472b6' },
  { id: 'whole-step-down', label: 'Whole-step down', color: '#fb7185' },
  { id: 'open-g', label: 'Open G', color: '#fb923c' },
  { id: 'open-d', label: 'Open D', color: '#fbbf24' },
  { id: 'dadgad', label: 'DADGAD', color: '#a3e635' },
]

export type PaletteKey = 'A' | 'B' | 'C'

export const PALETTES: Record<PaletteKey, TuningEntry[]> = {
  A: PALETTE_A,
  B: PALETTE_B,
  C: PALETTE_C,
}

/**
 * Fallback color for unrecognized / custom tunings (shown until the user
 * picks one via the forthcoming custom-tuning editor).
 */
export const FALLBACK_COLOR = '#6b7280'

/**
 * Normalize a free-text tuning string so legacy label drift
 * ("Standard (EADGBE)" vs "Standard", "Half Step Down" vs "Half-step down")
 * all resolve to the same registry entry.
 */
export function canonicalTuningId(input: string | undefined | null): string {
  if (!input) return 'standard'
  const normalized = input.trim().toLowerCase().replace(/\s+/g, '-')

  if (normalized.startsWith('standard')) return 'standard'
  if (normalized === 'drop-d') return 'drop-d'
  if (normalized === 'drop-c') return 'drop-c'
  if (normalized === 'drop-b') return 'drop-b'
  if (
    normalized === 'half-step-down' ||
    normalized === 'half-step-down' ||
    normalized === 'half-down'
  )
    return 'half-step-down'
  if (normalized === 'whole-step-down' || normalized === 'whole-down')
    return 'whole-step-down'
  if (normalized === 'open-g') return 'open-g'
  if (normalized === 'open-d') return 'open-d'
  if (normalized === 'dadgad') return 'dadgad'

  return normalized // custom tuning
}

/**
 * Resolve a tuning string to its registry color for the given palette.
 * Custom / unrecognized tunings fall back to neutral gray.
 */
export function tuningColor(
  tuning: string | undefined | null,
  palette: PaletteKey = 'A'
): string {
  const id = canonicalTuningId(tuning)
  const entry = PALETTES[palette].find(t => t.id === id)
  return entry?.color ?? FALLBACK_COLOR
}

/** Short human label for a tuning, canonicalized. */
export function tuningLabel(tuning: string | undefined | null): string {
  const id = canonicalTuningId(tuning)
  const entry = PALETTE_A.find(t => t.id === id)
  return entry?.label ?? tuning ?? 'Standard'
}
