/**
 * Jam display helpers shared by the jam pages: part identity and colour,
 * profile instruments → parts, the jam's "when · where" line and its link.
 */
import type { JamState, Part, PartKey } from '../../services/api/jams'
import { PART_LABEL } from '../../hooks/useJam'
import {
  formatDateForInput,
  formatShowDate,
  formatTime12Hour,
  parseDateInputAsLocal,
  parseTime12Hour,
} from '../../utils/dateHelpers'
import { INSTRUMENT_COLOR } from '../../utils/tokens'

export const PART_KEYS: PartKey[] = ['vox', 'guitar', 'bass', 'drums', 'keys']

export const PART_COLOR: Record<PartKey, string> = {
  vox: INSTRUMENT_COLOR.vox,
  guitar: INSTRUMENT_COLOR.gtr,
  bass: INSTRUMENT_COLOR.bass,
  drums: INSTRUMENT_COLOR.drums,
  keys: INSTRUMENT_COLOR.keys,
  other: '#8a8f98',
}

type PartLike = { key: PartKey; label?: string | null }

/** A part's identity: key + lower(label), as the server compares them. */
export const partId = (p: PartLike) =>
  `${p.key}:${(p.label ?? '').trim().toLowerCase()}`

export const samePart = (a: PartLike, b: PartLike) => partId(a) === partId(b)

/** Vocals, Guitar, or the custom label. */
export const partLabel = (p: PartLike) => p.label || PART_LABEL[p.key]

export const toPart = (p: PartLike): Part =>
  p.label ? { key: p.key, label: p.label } : { key: p.key }

/** Distinct parts of a list, in first-seen order. */
export const distinctParts = (parts: PartLike[]): Part[] => {
  const seen = new Set<string>()
  return parts
    .filter(p => !seen.has(partId(p)) && seen.add(partId(p)))
    .map(toPart)
}

const INSTRUMENT_PART: [RegExp, PartKey][] = [
  [/vox|vocal|sing/i, 'vox'],
  [/bass/i, 'bass'],
  [/guitar|gtr/i, 'guitar'],
  [/drum|perc/i, 'drums'],
  [/key|piano|synth|organ/i, 'keys'],
]

/** "Parts I play" from the profile's ordered instruments (others as custom). */
export function partsFromInstruments(instruments: string[]): Part[] {
  return distinctParts(
    instruments
      .filter(i => i.trim())
      .map(i => {
        const key = INSTRUMENT_PART.find(([re]) => re.test(i))?.[1]
        return key ? { key } : { key: 'other' as const, label: i.trim() }
      })
  )
}

/** "Tue, Nov 3 · 8:00 PM" */
export const jamWhen = (at: string | Date) =>
  `${new Date(at).toLocaleDateString('en-US', { weekday: 'short' })}, ${formatShowDate(at).replace(/, \d{4}$/, '')} · ${formatTime12Hour(at)}`

/** The share link for a code jam. */
export const jamLink = (code: string) => `${window.location.origin}/j/${code}`

export const isPlanned = (status: string) =>
  status === 'scheduled' || status === 'confirmed'
export const isEnded = (status: string) =>
  status === 'completed' || status === 'cancelled'

/** A lineup item as a SongLine (length unknown). */
export const toJamSongLine = (it: JamState['items'][number]) => ({
  title: it.title,
  artist: it.artist,
  tuning: it.tuning,
  noTuning: !it.song_id && !it.tuning,
  key: it.key,
  seconds: 0,
})

// ── The jam form (Host a jam, ⋯ → Edit) ──
export interface JamFormValue {
  name: string
  date: string
  time: string
  where: string
}

export const jamFormFrom = (at: Date, name = '', where = ''): JamFormValue => ({
  name,
  date: formatDateForInput(at),
  time: formatTime12Hour(at),
  where,
})

/** The start as a Date (local). */
export const jamFormAt = (v: JamFormValue) => {
  const day = parseDateInputAsLocal(v.date)
  return v.time ? parseTime12Hour(v.time, day) : day
}
