/**
 * Chord names, transposition, guitar shapes and the notes to strum (no I/O;
 * ports to Dart line for line — docs/redesign/08-api-conventions.md).
 *
 * Names are stored ASCII ("Bb", "F#m7/C#") and accept ♯ / ♭ glyphs on input;
 * `showChord` adds the glyphs for display. Shapes are frets low → high string
 * on a 6-string guitar in standard tuning: -1 = muted, 0 = open.
 */

export interface ParsedChord {
  /** ASCII root as typed: "F", "Bb", "C#". */
  root: string
  /** Everything between root and bass, as typed (glyphs → ASCII): "maj7". */
  quality: string
  /** ASCII bass note of a slash chord, or null. */
  bass: string | null
}

export interface ChordShape {
  /** Frets low → high string: -1 muted, 0 open. */
  frets: number[]
  /** The barred fret (drawn as a bar from the first string at it), or null. */
  barre: number | null
}

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
const LETTER_PC: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}

/** Standard guitar tuning, low → high (MIDI). */
export const STANDARD_GUITAR = [40, 45, 50, 55, 59, 64]

/** Roots for the Chords tab and the picker, spelled the way guitarists say them. */
export const CHORD_ROOTS = [
  'C',
  'C#',
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

/** Quality chips on the Chords tab (12 · 2.4). */
export const LOOKUP_QUALITIES: { value: string; label: string }[] = [
  { value: '', label: 'Major' },
  { value: 'm', label: 'Minor' },
  { value: '7', label: '7' },
  { value: 'm7', label: 'm7' },
]

/** The "Other chord" keypad types ("maj" = plain major). */
export const PICKER_QUALITIES = [
  'maj',
  'm',
  '7',
  'm7',
  'maj7',
  'sus2',
  'sus4',
  'add9',
  'dim',
  'aug',
]

const ascii = (s: string) => s.replace(/♯/g, '#').replace(/♭/g, 'b')

const CHORD_RE = /^([A-G])([#b]?)(.*?)(?:\/([A-G][#b]?))?$/
// Tokens a chord quality is built from ("maj7", "m7b5", "7#9", "6/9", "add9").
const QUALITY_RE =
  /^(?:maj|min|mi|ma|dim|aug|sus|add|alt|no|omit|m|M|°|ø|\+|-|Δ|\d|#|b|\(|\)|,|\/)*$/

/** "Fmaj7/A" → { root: 'F', quality: 'maj7', bass: 'A' }; null if not a chord. */
export function parseChord(name: string): ParsedChord | null {
  const m = CHORD_RE.exec(ascii(name.trim()))
  if (!m || !QUALITY_RE.test(m[3])) return null
  return { root: m[1] + m[2], quality: m[3], bass: m[4] ?? null }
}

/** The ParsedChord back to a name. */
export function chordName(c: ParsedChord): string {
  return c.root + c.quality + (c.bass ? `/${c.bass}` : '')
}

/** Pitch class 0–11 of an ASCII or glyph note name ("Bb", "E#"), or null. */
export function pitchClass(note: string): number | null {
  const m = /^([A-G])([#b]?)$/.exec(ascii(note))
  if (!m) return null
  const shift = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0
  return (LETTER_PC[m[1]] + shift + 12) % 12
}

const QUALITY_ALIASES: Record<string, string> = {
  M: '',
  maj: '',
  ma: '',
  min: 'm',
  mi: 'm',
  '-': 'm',
  min7: 'm7',
  mi7: 'm7',
  '-7': 'm7',
  M7: 'maj7',
  ma7: 'maj7',
  Δ: 'maj7',
  Δ7: 'maj7',
  '°': 'dim',
  '°7': 'dim7',
  ø: 'm7b5',
  ø7: 'm7b5',
  '+': 'aug',
  sus: 'sus4',
  '7sus': '7sus4',
}

/** "M7" / "Δ" → "maj7", "min" / "-" → "m", "maj" → "": the spelling shapes use. */
export function canonicalQuality(quality: string): string {
  const q = ascii(quality)
  return QUALITY_ALIASES[q] ?? q
}

/**
 * Tidies typed text into a stored chord name, or null: " f♯m7/a " → "F#m7/A",
 * "CM7" → "Cmaj7", "Amin" → "Am", "C/C" → "C".
 */
export function normalizeChord(text: string): string | null {
  const t = ascii(text.trim())
  // Accept a lower-case root / bass letter ("f#m", "am/g").
  const fixed = t
    .replace(/^([a-g])/, l => l.toUpperCase())
    .replace(/\/([a-g])([#b]?)$/, (_, l, a) => `/${l.toUpperCase()}${a}`)
  const c = parseChord(fixed)
  if (!c) return null
  const bass =
    c.bass && pitchClass(c.bass) === pitchClass(c.root) ? null : c.bass
  return chordName({ ...c, quality: canonicalQuality(c.quality), bass })
}

/** "Bb" → "B♭", "F#m/C#" → "F♯m/C♯" (root and bass only). */
export function showChord(name: string): string {
  return name
    .replace(/^([A-G])#/, '$1♯')
    .replace(/^([A-G])b/, '$1♭')
    .replace(/\/([A-G])#/, '/$1♯')
    .replace(/\/([A-G])b/, '/$1♭')
}

/**
 * True when a key spells its accidentals with flats. Keys written with a flat
 * flat; with a sharp sharp; of the natural keys only G, D, A, E, B (major) and
 * Em, Bm sharp, the rest (C, F, Am, Dm, Gm…) flat, matching `KEY_ROOTS`.
 */
export function spellFor(key: string | null | undefined): boolean {
  const c = key ? parseChord(key) : null
  if (!c) return true
  if (c.root.endsWith('b')) return true
  if (c.root.endsWith('#')) return false
  const minor =
    canonicalQuality(c.quality).startsWith('m') &&
    !canonicalQuality(c.quality).startsWith('maj')
  const sharpKeys = minor ? ['E', 'B'] : ['G', 'D', 'A', 'E', 'B']
  return !sharpKeys.includes(c.root)
}

const shiftNote = (note: string, n: number, flats: boolean) =>
  (flats ? FLATS : SHARPS)[((((pitchClass(note) ?? 0) + n) % 12) + 12) % 12]

/**
 * Moves a chord by `n` semitones, keeping its quality as typed. Spelled with
 * flats or sharps per `preferFlats`; when omitted, sharps only if the root was
 * written with one. Anything that isn't a chord comes back unchanged.
 */
export function transposeChord(
  name: string,
  n: number,
  preferFlats?: boolean
): string {
  const c = parseChord(name)
  if (!c) return name
  const flats = preferFlats ?? !c.root.endsWith('#')
  return chordName({
    root: shiftNote(c.root, n, flats),
    quality: c.quality,
    bass: c.bass ? shiftNote(c.bass, n, flats) : null,
  })
}

// Open shapes: Sound Tools.html + Tools on Home.html `SHAPES`, a few common
// slash chords, F and Bm with their barre.
const OPEN: Record<string, string> = {
  C: 'x32010',
  D: 'xx0232',
  E: '022100',
  G: '320003',
  A: 'x02220',
  Am: 'x02210',
  Em: '022000',
  Dm: 'xx0231',
  E7: '020100',
  A7: 'x02020',
  D7: 'xx0212',
  G7: '320001',
  B7: 'x21202',
  C7: 'x32310',
  F: '133211',
  Bm: 'x24432',
  Fmaj7: 'xx3210',
  Cadd9: 'x32033',
  Dsus4: 'xx0233',
  Asus2: 'x02200',
  Am7: 'x02010',
  Em7: '020000',
  Dsus2: 'xx0230',
  Esus4: '022200',
  Cmaj7: 'x32000',
  Gmaj7: '320002',
  Amaj7: 'x02120',
  Dmaj7: 'xx0222',
  Asus4: 'x02230',
  Dm7: 'xx0211',
  'D/F#': '200232',
  'G/B': 'x20003',
  'C/G': '332010',
  'C/E': '032010',
  'Am/G': '3x2210',
  'F/C': 'x33211',
  E5: '022xxx',
  A5: 'x022xx',
  D5: 'xx023x',
}
const OPEN_BARRE: Record<string, number> = { F: 1, Bm: 2 }

// Movable shapes relative to the barre fret (-9 = muted), as desktop.js
// `shapeFor` / Tools on Home: E-shape (root on string 6), A-shape (string 5).
const E_SHAPE: Record<string, number[]> = {
  '': [0, 2, 2, 1, 0, 0],
  m: [0, 2, 2, 0, 0, 0],
  '7': [0, 2, 0, 1, 0, 0],
  m7: [0, 2, 0, 0, 0, 0],
  maj7: [0, 2, 1, 1, 0, 0],
  sus4: [0, 2, 2, 2, 0, 0],
  '5': [0, 2, 2, -9, -9, -9],
}
const A_SHAPE: Record<string, number[]> = {
  '': [-9, 0, 2, 2, 2, 0],
  m: [-9, 0, 2, 2, 1, 0],
  '7': [-9, 0, 2, 0, 2, 0],
  m7: [-9, 0, 2, 0, 1, 0],
  maj7: [-9, 0, 2, 1, 2, 0],
  sus4: [-9, 0, 2, 2, 3, 0],
  sus2: [-9, 0, 2, 2, 0, 0],
  '5': [-9, 0, 2, 2, -9, -9],
}

const parseFrets = (s: string) => [...s].map(x => (x === 'x' ? -1 : Number(x)))

/**
 * A guitar shape for the chord: an open shape when there is one (any
 * enharmonic spelling), else an E- or A-shape barre (the lower of the two)
 * for major, m, 7, m7, maj7, sus4, sus2 and 5 (power chord); else null ("No diagram yet").
 */
export function chordShape(name: string): ChordShape | null {
  const c = parseChord(name)
  if (!c) return null
  const r = pitchClass(c.root)!
  const q = canonicalQuality(c.quality)
  const key = SHARPS[r] + q + (c.bass ? `/${SHARPS[pitchClass(c.bass)!]}` : '')
  if (OPEN[key])
    return { frets: parseFrets(OPEN[key]), barre: OPEN_BARRE[key] ?? null }
  if (c.bass) return null
  const fe = (r - 4 + 12) % 12 || 12
  const fa = (r - 9 + 12) % 12 || 12
  const useA = q in A_SHAPE && (!(q in E_SHAPE) || fa < fe)
  const pattern = useA ? A_SHAPE[q] : E_SHAPE[q]
  if (!pattern) return null
  const b = useA ? fa : fe
  // A power chord is a single finger on its root: no barre.
  return {
    frets: pattern.map(x => (x < -1 ? -1 : x + b)),
    barre: q === '5' ? null : b,
  }
}

/** "x 3 2 0 1 0" (spaces keep 10+ frets readable). */
export function fingering(frets: number[]): string {
  return frets.map(f => (f < 0 ? 'x' : String(f))).join(' ')
}

/** First fret shown on the diagram: 1 (with the nut) unless the shape reaches past fret 4. */
export function baseFret(frets: number[]): number {
  const fretted = frets.filter(f => f > 0)
  if (!fretted.length || Math.max(...fretted) <= 4) return 1
  return Math.min(...fretted)
}

/**
 * MIDI notes to strum for a shape, low → high, skipping muted strings. The
 * shape lines up with the highest strings of `tuning` (a 7-string adds none).
 */
export function strumNotes(
  frets: number[],
  tuning: number[] = STANDARD_GUITAR
): number[] {
  const t = tuning.length >= frets.length ? tuning : STANDARD_GUITAR
  const offset = t.length - frets.length
  return frets.flatMap((f, i) => (f < 0 ? [] : [t[offset + i] + f]))
}

const INTERVALS: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '5': [0, 7],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  '9': [0, 4, 7, 10, 14],
  m9: [0, 3, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '7sus4': [0, 5, 7, 10],
  add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10],
  aug: [0, 4, 8],
}

/**
 * A guitar-like voicing for any chord (Sound Tools `voice`): the bass (or the
 * slash note) between E2 and D♯3, then chord tones stacked at least a whole
 * step apart (the reference used 3, which drops the 3rd of a 9 or the 2 of
 * add9), up to 6 notes below C5. Unknown qualities fall back to the
 * minor or major triad.
 */
export function voiceChord(name: string): number[] {
  const c = parseChord(name)
  if (!c) return []
  const r = pitchClass(c.root)!
  const q = canonicalQuality(c.quality)
  const iv =
    INTERVALS[q] ??
    (q.startsWith('m') && !q.startsWith('maj') ? INTERVALS.m : INTERVALS[''])
  const low = c.bass ? pitchClass(c.bass)! : r
  const bass = 40 + ((low - 4 + 12) % 12)
  const pcs = iv.map(x => (r + x) % 12)
  const out = [bass]
  for (let cur = bass + 5; out.length < 6 && cur < 72; cur++) {
    if (pcs.includes(cur % 12) && cur - out[out.length - 1] >= 2) out.push(cur)
  }
  return out
}

/** What Play strums: the shape on `tuning` when there is one, else `voiceChord`. */
export function chordMidis(
  name: string,
  tuning: number[] = STANDARD_GUITAR
): number[] {
  const shape = chordShape(name)
  return shape ? strumNotes(shape.frets, tuning) : voiceChord(name)
}
