/**
 * Links into the Tools screen (docs/redesign/12 · 2.1): `/tools/:tab` with
 * `?tuning=&prev=` (tuner), `?song=` / `?bpm=` (metronome), `?chord=` (chords).
 * One helper builds them and one parses them, so every way in agrees.
 */
import { BPM_MAX, BPM_MIN } from './metronome'

export const TOOLS_TABS = ['tuner', 'metronome', 'chords'] as const
export type ToolsTab = (typeof TOOLS_TABS)[number]

export const isToolsTab = (v: unknown): v is ToolsTab =>
  typeof v === 'string' && (TOOLS_TABS as readonly string[]).includes(v)

export interface ToolsParams {
  /** Tuning id, built-in slug, or a tuning label ("Drop D"). */
  tuning?: string
  /** The tuning before (marks the strings that change). */
  prev?: string
  song?: string
  bpm?: number
  chord?: string
}

const KEYS: (keyof ToolsParams)[] = ['tuning', 'prev', 'song', 'bpm', 'chord']

export function toolsHref(tab: ToolsTab, params: ToolsParams = {}): string {
  const q = new URLSearchParams()
  for (const k of KEYS) {
    const v = params[k]
    if (v !== undefined && v !== null && String(v).trim() !== '')
      q.set(k, String(v).trim())
  }
  const s = q.toString()
  return `/tools/${tab}${s ? `?${s}` : ''}`
}

const text = (v: string | null, max: number) => {
  const t = v?.trim()
  return t && t.length <= max ? t : undefined
}

/** Parse a Tools query string; anything malformed is dropped. */
export function parseToolsParams(search: string): ToolsParams {
  const q = new URLSearchParams(search)
  const out: ToolsParams = {}
  const tuning = text(q.get('tuning'), 80)
  const prev = text(q.get('prev'), 80)
  const song = q.get('song')?.trim()
  const bpm = q.get('bpm')?.trim()
  const chord = text(q.get('chord'), 16)
  if (tuning) out.tuning = tuning
  if (prev) out.prev = prev
  if (song && /^[\w-]{1,64}$/.test(song)) out.song = song
  if (bpm && /^\d{1,3}$/.test(bpm)) {
    const n = Number(bpm)
    if (n >= BPM_MIN && n <= BPM_MAX) out.bpm = n
  }
  if (chord && /^[A-G]/.test(chord)) out.chord = chord
  return out
}
