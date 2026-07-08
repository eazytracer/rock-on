/**
 * A tuning: a named list of per-string MIDI pitches for an instrument.
 * Mirrors public.tunings (camelCase). Built-ins are global + read-only
 * (slug set, no owner); customs are context-owned (owner set, no slug).
 */
export interface Tuning {
  id: string
  instrument: 'guitar' | 'bass'
  stringCount: number
  /** MIDI note numbers, low → high string. */
  pitches: number[]
  name: string
  /** Built-ins only (matches the canonical slug); null for customs. */
  slug?: string | null
  isBuiltin: boolean
  color?: string | null
  /** Ownership (customs only). */
  contextType?: 'personal' | 'band' | null
  contextId?: string | null
  createdBy?: string | null
  createdDate?: string
  updatedDate?: string
}

/** Fields a user supplies when creating a custom tuning. */
export interface NewCustomTuning {
  instrument: 'guitar' | 'bass'
  stringCount: number
  pitches: number[]
  name: string
  color?: string | null
}
