/**
 * Per-device memory for the Tools screen (decision 13): the tuner's last
 * tuning per instrument, instrument and auto-detect; the metronome's last
 * tempo, signature, subdivision and flash; and the last tab. localStorage only;
 * a blocked storage just means nothing is remembered.
 *
 * (`user_preferences.metronome` is the brief's eventual home for the metronome
 * memory; until services/api/preferences reads it, the device keeps it.)
 */
import {
  DEFAULT_BPM,
  SIGNATURES,
  SUBS,
  clampBpm,
  type SigId,
  type Sub,
} from '../domain/metronome'
import { isToolsTab, type ToolsTab } from '../domain/toolsLink'
import type { Instrument } from '../domain/tuner'

const TUNER_KEY = 'rockon.tools.tuner'
const METRO_KEY = 'rockon.tools.metronome'
const TAB_KEY = 'rockon.tools.tab'

function read<T>(key: string): Partial<T> {
  try {
    const raw = localStorage.getItem(key)
    const v = raw ? JSON.parse(raw) : null
    return v && typeof v === 'object' ? (v as Partial<T>) : {}
  } catch {
    return {}
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* device memory is a convenience only */
  }
}

export interface TunerMemory {
  instrument: Instrument
  /** Last tuning key per instrument. */
  tuning: Partial<Record<Instrument, string>>
  auto: boolean
}

export function readTunerMemory(): TunerMemory {
  const m = read<TunerMemory>(TUNER_KEY)
  return {
    instrument: m.instrument === 'bass' ? 'bass' : 'guitar',
    tuning: m.tuning && typeof m.tuning === 'object' ? m.tuning : {},
    auto: m.auto !== false,
  }
}

export function saveTunerMemory(change: Partial<TunerMemory>) {
  write(TUNER_KEY, { ...readTunerMemory(), ...change })
}

export interface MetronomeMemory {
  bpm: number
  sig: SigId
  sub: Sub
  flash: boolean
}

export function readMetronomeMemory(): MetronomeMemory {
  const m = read<MetronomeMemory>(METRO_KEY)
  return {
    bpm: typeof m.bpm === 'number' ? clampBpm(m.bpm) : DEFAULT_BPM,
    sig: SIGNATURES.some(s => s.id === m.sig) ? (m.sig as SigId) : '4/4',
    sub: SUBS.includes(m.sub as Sub) ? (m.sub as Sub) : 1,
    flash: m.flash !== false,
  }
}

export function saveMetronomeMemory(change: Partial<MetronomeMemory>) {
  write(METRO_KEY, { ...readMetronomeMemory(), ...change })
}

export function readToolsTab(): ToolsTab {
  try {
    const t = localStorage.getItem(TAB_KEY)
    return isToolsTab(t) ? t : 'tuner'
  } catch {
    return 'tuner'
  }
}

export function saveToolsTab(tab: ToolsTab) {
  try {
    localStorage.setItem(TAB_KEY, tab)
  } catch {
    /* convenience only */
  }
}
