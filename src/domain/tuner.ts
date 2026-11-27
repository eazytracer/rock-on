/**
 * The tuner's tunings (docs/redesign/12 · 2.4, decision 7): built-ins (from the
 * client mirror, so it works before the list loads) and the context's customs,
 * resolved from a link's `?tuning=` (slug, id or label), per instrument.
 */
import {
  BUILTIN_TUNINGS,
  FALLBACK_TUNING_COLOR,
  canonicalTuningId,
  tuningColor,
  tuningOrderIndex,
  tuningShortLabel,
} from '../utils/tunings'
import { bassBuiltinFor, bassEquivalent, customColour } from './tuningEdit'

export type Instrument = 'guitar' | 'bass'

export interface TunerTuning {
  /** Built-in slug, a custom tuning's id, or `bass:<key>` when derived. */
  key: string
  name: string
  /** Pill label ("D DROP"). */
  label: string
  /** CSS colour. */
  color: string
  instrument: Instrument
  /** MIDI, low → high. */
  pitches: number[]
  builtin: boolean
}

/** A tuning row as the tunings list gives it (models/Tuning). */
export interface TuningRow {
  id: string
  name: string
  instrument: Instrument
  pitches: number[]
  slug?: string | null
  isBuiltin: boolean
  color?: string | null
}

const builtinLabel = (slug: string, name: string) => {
  const l = tuningShortLabel(slug)
  // A built-in without a short label says its name.
  return l === slug.toUpperCase() ? name.toUpperCase() : l
}

/** Built-ins for an instrument in display order. */
export function builtinTunerTunings(instrument: Instrument): TunerTuning[] {
  return BUILTIN_TUNINGS.filter(t => t.instrument === instrument)
    .map(t => ({
      key: t.slug,
      name: t.name,
      label: builtinLabel(t.slug, t.name),
      color: tuningColor(t.slug),
      instrument: t.instrument,
      pitches: [...t.pitches],
      builtin: true,
    }))
    .sort(
      (a, b) =>
        tuningOrderIndex(a.key) - tuningOrderIndex(b.key) ||
        a.pitches.length - b.pitches.length ||
        a.name.localeCompare(b.name)
    )
}

export function customTunerTuning(t: TuningRow): TunerTuning {
  return {
    key: t.id,
    name: t.name,
    label: t.name.toUpperCase(),
    color: customColour(t) ?? FALLBACK_TUNING_COLOR,
    instrument: t.instrument,
    pitches: [...t.pitches],
    builtin: false,
  }
}

/** Every tuning the tuner can open, both instruments. */
export function tunerTunings(customs: readonly TuningRow[]): TunerTuning[] {
  return [
    ...builtinTunerTunings('guitar'),
    ...builtinTunerTunings('bass'),
    ...customs.filter(t => !t.isBuiltin).map(customTunerTuning),
  ]
}

/**
 * Resolve a link value: a built-in slug, a tuning id (built-in rows map to
 * their slug), a name, or a legacy label ("Standard (EADGBE)"). Null if none.
 */
export function resolveTuning(
  value: string | null | undefined,
  list: readonly TunerTuning[],
  rows: readonly TuningRow[] = []
): TunerTuning | null {
  if (!value) return null
  const v = value.trim()
  if (v.startsWith('bass:')) {
    const base = resolveTuning(v.slice(5), list, rows)
    return base ? forInstrument(base, 'bass', list) : null
  }
  const byKey = list.find(t => t.key === v)
  if (byKey) return byKey
  const row = rows.find(r => r.id === v)
  if (row?.slug) {
    const bySlug = list.find(t => t.key === row.slug)
    if (bySlug) return bySlug
  }
  const lower = v.toLowerCase()
  const byName = list.find(t => t.name.toLowerCase() === lower)
  if (byName) return byName
  const canonical = canonicalTuningId(v)
  return list.find(t => t.builtin && t.key === canonical) ?? null
}

/**
 * The same tuning on the other instrument (decision 7). Guitar → bass: the
 * matching bass built-in, else the four lowest strings an octave down. Bass →
 * guitar: Standard (a bass tuning has no guitar form).
 */
export function forInstrument(
  t: TunerTuning,
  instrument: Instrument,
  list: readonly TunerTuning[]
): TunerTuning {
  if (t.instrument === instrument) return t
  if (instrument === 'bass') {
    const match = list.find(x => x.key === bassBuiltinFor(t.key))
    if (match) return match
    return {
      ...t,
      key: `bass:${t.key}`,
      name: `${t.name} (bass)`,
      instrument: 'bass',
      pitches: bassEquivalent(t.pitches),
    }
  }
  return list.find(x => x.key === 'standard') ?? t
}

/** Strings that differ from the previous tuning (same string count only). */
export function changedStrings(
  cur: TunerTuning,
  prev: TunerTuning | null
): boolean[] {
  if (!prev || prev.pitches.length !== cur.pitches.length)
    return cur.pitches.map(() => false)
  return cur.pitches.map((p, i) => p !== prev.pitches[i])
}

/** The tuning param for a song: its built-in slug, else its tuning id / label. */
export function songTuningParam(song: {
  tuningId?: string | null
  guitarTuning?: string | null
}): string {
  const slug = canonicalTuningId(song.guitarTuning || 'Standard')
  if (BUILTIN_TUNINGS.some(t => t.slug === slug)) return slug
  return song.tuningId || song.guitarTuning || 'standard'
}
