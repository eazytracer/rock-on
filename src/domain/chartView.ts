/**
 * Reading a chart (docs/redesign/12 · 2.4): the key and chords at a transpose,
 * the starting note relative to the key, how far a page turn moves, and a
 * line split into word units for wrapping. No I/O; ports to Dart line for line.
 */
import type { Chart, ChartLine } from './chordpro'
import { lineSegments, graphemes } from './chordpro'
import {
  canonicalQuality,
  parseChord,
  pitchClass,
  spellFor,
  transposeChord,
} from './chords'
import { showKey } from './format'

const MAJOR_KEYS = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'F#',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
]
const MINOR_KEYS = [
  'C',
  'C#',
  'D',
  'Eb',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'Bb',
  'B',
]
const SHARP_NOTES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
]
const FLAT_NOTES = [
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

const mod12 = (n: number) => ((n % 12) + 12) % 12

/** Transpose range on the reader's Key −/+ (an octave either way is the same key). */
export const TRANSPOSE_MIN = -11
export const TRANSPOSE_MAX = 11
/** Reader text sizes (px). */
export const SIZE_MIN = 16
export const SIZE_MAX = 38
export const SIZE_STEP = 2
export const SIZE_DEFAULT = 22

function minorQuality(quality: string): boolean {
  const q = canonicalQuality(quality)
  return q.startsWith('m') && !q.startsWith('maj')
}

/**
 * A key ("G", "Em", "Bb") moved by `n` semitones, spelled the way players
 * write that key: "G" +2 → "A", "F" +1 → "F#", "Em" +1 → "Fm", "Am" −1 → "G#m".
 * Anything that isn't a key comes back unchanged.
 */
export function transposeKey(key: string, n: number): string {
  const c = parseChord(key)
  if (!c) return key
  const t = mod12(pitchClass(c.root)! + n)
  const minor = minorQuality(c.quality)
  return minor ? `${MINOR_KEYS[t]}m` : MAJOR_KEYS[t]
}

/**
 * The key a chart reads in: the song's key, else its first chord's root (and
 * minor-ness). Null when there's neither.
 */
export function chartKey(
  songKey: string | null | undefined,
  chords: readonly string[]
): string | null {
  if (songKey && parseChord(songKey)) return songKey
  for (const name of chords) {
    const c = parseChord(name)
    if (c) return c.root + (minorQuality(c.quality) ? 'm' : '')
  }
  return null
}

/**
 * A chord as read at transpose `n`: spelled for the transposed key when there
 * is one ("A#" in E major, "Bb" in F). `n = 0` leaves it exactly as written.
 */
export function readChord(
  chord: string,
  n: number,
  key: string | null
): string {
  if (!n) return chord
  const flats = key ? spellFor(transposeKey(key, n)) : undefined
  return transposeChord(chord, n, flats)
}

/** The key's root pitch class, or null. */
export function keyRoot(key: string | null): number | null {
  const c = key ? parseChord(key) : null
  return c ? pitchClass(c.root) : null
}

/** A note's letter spelled for a key, with glyphs: "D", "F♯", "B♭". */
export function noteInKey(midi: number, key: string | null): string {
  const flats = spellFor(key)
  return showKey((flats ? FLAT_NOTES : SHARP_NOTES)[mod12(Math.round(midi))])
}

/** "D4", "F♯3": a note with its octave (MIDI 60 = C4). */
export function noteWithOctave(midi: number, key: string | null): string {
  return `${noteInKey(midi, key)}${Math.floor(Math.round(midi) / 12) - 1}`
}

const DEGREES = [
  'root',
  '♭2nd',
  '2nd',
  '♭3rd',
  '3rd',
  '4th',
  '♭5th',
  '5th',
  '♭6th',
  '6th',
  '♭7th',
  '7th',
]

/** Where a note sits in the key: "5th", "root", "♭3rd". '' without a key. */
export function degreeInKey(midi: number, key: string | null): string {
  const root = keyRoot(key)
  return root == null ? '' : DEGREES[mod12(Math.round(midi) - root)]
}

/**
 * How far Next / Back move: most of what's visible, keeping two lines of
 * overlap so you never lose your place (never less than one line).
 */
export function pageStep(visible: number, lineHeight: number): number {
  return Math.max(lineHeight, Math.round(visible - 2 * lineHeight))
}

/** One line's height in px at a text size, with or without its chord row. */
export function lineHeightFor(size: number, chords: boolean): number {
  // Text 1.2em + line gap; the chord row is .68em at 1.35 line height.
  return chords ? size * (1.2 + 0.68 * 1.35 + 0.35) : size * (1.2 + 0.15)
}

export interface LineUnit {
  /** Chord over this unit's first letter, or null. */
  chord: string | null
  /** Grapheme index of the unit's first letter in the line. */
  at: number
  /** The unit's text: one word and the spaces after it ('' for a lone chord). */
  text: string
}

/**
 * A line as word units for the reader: each chord sits over the first letter
 * of its unit, and the line can wrap between words without a chord drifting
 * off its letter.
 */
export function lineUnits(line: ChartLine): LineUnit[] {
  const out: LineUnit[] = []
  let at = 0
  for (const seg of lineSegments(line)) {
    const words = seg.text.match(/\s+|\S+\s*/g) ?? []
    if (!words.length) {
      out.push({ chord: seg.chord, at, text: '' })
      continue
    }
    words.forEach((w, i) => {
      out.push({ chord: i === 0 ? seg.chord : null, at, text: w })
      at += graphemes(w).length
    })
  }
  return out
}

/**
 * Units that make up one word ("in[A]side" is two units) grouped together, so
 * a line wraps between words and never inside one.
 */
export function wordGroups(units: LineUnit[]): LineUnit[][] {
  const out: LineUnit[][] = []
  for (const u of units) {
    const last = out[out.length - 1]
    const prev = last?.[last.length - 1]
    if (prev && prev.text && u.text && !/\s$/.test(prev.text)) last.push(u)
    else out.push([u])
  }
  return out
}

/** True when a chart has no lyrics or chords at all. */
export function chartIsEmpty(chart: Chart): boolean {
  return !chart.sections.some(s =>
    s.lines.some(l => l.text.trim() || l.chords.length)
  )
}
