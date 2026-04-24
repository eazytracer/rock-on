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

  // "Standard (EADGBE)" and similar → "standard"
  if (dashed.startsWith('standard')) return 'standard'
  if (dashed === 'drop-d') return 'drop-d'
  if (dashed === 'drop-c') return 'drop-c'
  if (dashed === 'drop-b') return 'drop-b'

  if (
    dashed === 'half-step-down' ||
    dashed === 'half-down' ||
    dashed === 'half-step'
  ) {
    return 'half-step-down'
  }

  if (
    dashed === 'whole-step-down' ||
    dashed === 'whole-down' ||
    dashed === 'whole-step'
  ) {
    return 'whole-step-down'
  }

  if (dashed === 'open-g') return 'open-g'
  if (dashed === 'open-d') return 'open-d'
  if (dashed === 'dadgad') return 'dadgad'

  return dashed // custom tuning id
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
