/**
 * Editing a chart on a phone (docs/redesign/12 · 5f, Song Chart 5–7): chords
 * ride the letter they're on while words change, get placed / nudged / moved /
 * removed by letter, and the key palette. Plus the editor's text view (chords
 * over lyrics when that round-trips exactly). No I/O; ports to Dart.
 *
 * Positions are grapheme indices (see chordpro.ts); `at === text length` is a
 * chord after the last letter.
 */
import {
  copyChords,
  graphemes,
  importChart,
  parse,
  serialize,
  type Anchor,
  type Chart,
  type ChartLine,
  type ChartSection,
} from './chordpro'
import {
  canonicalQuality,
  normalizeChord,
  parseChord,
  pitchClass,
  spellFor,
  transposeChord,
} from './chords'

const sortAnchors = (chords: Anchor[]) =>
  [...chords].sort((a, b) => a.at - b.at)

// ── one line ─────────────────────────────────────────────────────────────────

/**
 * The line's text changed to `next`: each chord stays on its letter. The edit
 * is the span between the common start and the common end. Chords before it
 * stay, chords after it shift by the length change, and a chord whose letter
 * was replaced or deleted lands on the first letter where the edit was (the
 * new letter, or the one after a deletion). Typing right before a chorded
 * letter pushes the chord along with it; a chord after the last letter stays
 * there when words are added at the end.
 */
export function editText(line: ChartLine, next: string): ChartLine {
  const a = graphemes(line.text)
  const b = graphemes(next)
  let p = 0
  while (p < a.length && p < b.length && a[p] === b[p]) p++
  let s = 0
  while (
    s < a.length - p &&
    s < b.length - p &&
    a[a.length - 1 - s] === b[b.length - 1 - s]
  )
    s++
  const oldEnd = a.length - s // edit covered [p, oldEnd) in the old text
  const delta = b.length - a.length
  const placed = new Map<number, string>()
  for (const c of sortAnchors(line.chords)) {
    let at: number
    if (c.at < p) at = c.at
    // A chord after the last letter stays put when words are added after it.
    else if (c.at === a.length && p === a.length) at = c.at
    else if (c.at >= oldEnd) at = c.at + delta
    else at = p
    at = Math.max(0, Math.min(at, b.length))
    // Two chords landing on one letter: the later one wins the spot.
    placed.set(at, c.chord)
  }
  return {
    text: next,
    chords: [...placed].map(([at, chord]) => ({ at, chord })),
  }
}

/**
 * "[Am]" typed into the words becomes a chord on the letter after it (the
 * Lyrics mode [ ] key). Brackets that aren't a chord stay as text.
 */
export function dropBracketChords(line: ChartLine): ChartLine {
  let cur = line
  for (;;) {
    const g = graphemes(cur.text)
    const text = g.join('')
    const m = /\[([^\][]+)\]/.exec(text)
    if (!m) return cur
    const chord = normalizeChord(m[1])
    if (!chord) return cur
    const start = graphemes(text.slice(0, m.index)).length
    const len = graphemes(m[0]).length
    const chords = cur.chords
      .filter(c => c.at < start || c.at >= start + len)
      .map(c => (c.at >= start + len ? { ...c, at: c.at - len } : c))
      .filter(c => c.at !== start)
    chords.push({ at: start, chord })
    cur = {
      text: g.slice(0, start).join('') + g.slice(start + len).join(''),
      chords: sortAnchors(chords),
    }
  }
}

/** Put `chord` on letter `at` (replacing any chord already there). */
export function placeChord(
  line: ChartLine,
  at: number,
  chord: string
): ChartLine {
  const max = graphemes(line.text).length
  const where = Math.max(0, Math.min(at, max))
  return {
    text: line.text,
    chords: sortAnchors([
      ...line.chords.filter(c => c.at !== where),
      { at: where, chord },
    ]),
  }
}

export function removeChord(line: ChartLine, at: number): ChartLine {
  return { text: line.text, chords: line.chords.filter(c => c.at !== at) }
}

/** Rename the chord on letter `at`. */
export function changeChord(
  line: ChartLine,
  at: number,
  chord: string
): ChartLine {
  return {
    text: line.text,
    chords: line.chords.map(c => (c.at === at ? { at, chord } : c)),
  }
}

/**
 * ◀ ▶: the chord on `at` moves one letter. Null when it can't (the line's
 * edge, or another chord is on that letter).
 */
export function nudgeChord(
  line: ChartLine,
  at: number,
  dir: -1 | 1
): { line: ChartLine; at: number } | null {
  const c = line.chords.find(x => x.at === at)
  const to = at + dir
  const max = graphemes(line.text).length
  if (!c || to < 0 || to > max || line.chords.some(x => x.at === to))
    return null
  return {
    line: {
      text: line.text,
      chords: sortAnchors(
        line.chords.map(x => (x.at === at ? { ...x, at: to } : x))
      ),
    },
    at: to,
  }
}

/** Enter in the middle of a line: chords go with their letters. */
export function splitLine(line: ChartLine, at: number): [ChartLine, ChartLine] {
  const g = graphemes(line.text)
  const cut = Math.max(0, Math.min(at, g.length))
  return [
    {
      text: g.slice(0, cut).join(''),
      chords: line.chords.filter(c => c.at < cut),
    },
    {
      text: g.slice(cut).join(''),
      chords: line.chords
        .filter(c => c.at >= cut)
        .map(c => ({ ...c, at: c.at - cut })),
    },
  ]
}

/** Backspace at a line's start: it joins the line above. */
export function joinLines(a: ChartLine, b: ChartLine): ChartLine {
  const len = graphemes(a.text).length
  // A chord after a's last letter would collide with b's first; b's wins.
  const bFirst = b.chords.some(c => c.at === 0)
  return {
    text: a.text + b.text,
    chords: [
      ...a.chords.filter(c => !(bFirst && c.at >= len)),
      ...b.chords.map(c => ({ ...c, at: c.at + len })),
    ],
  }
}

// ── the whole chart ──────────────────────────────────────────────────────────

/** A line's address: section index and line index within it. */
export interface LineRef {
  section: number
  line: number
}

/** Every line in reading order with its address (the "flat" line index). */
export function flatLines(chart: Chart): LineRef[] {
  return chart.sections.flatMap((s, section) =>
    s.lines.map((_l, line) => ({ section, line }))
  )
}

export function getLine(chart: Chart, ref: LineRef): ChartLine | undefined {
  return chart.sections[ref.section]?.lines[ref.line]
}

/** A new chart with one line replaced (or several, for a split / join). */
export function setLines(
  chart: Chart,
  section: number,
  from: number,
  remove: number,
  insert: ChartLine[]
): Chart {
  return {
    ...chart,
    sections: chart.sections.map((s, i) => {
      if (i !== section) return s
      const lines = [...s.lines]
      lines.splice(from, remove, ...insert)
      return { ...s, recall: false, lines }
    }),
  }
}

export function updateLine(
  chart: Chart,
  ref: LineRef,
  fn: (l: ChartLine) => ChartLine
): Chart {
  const l = getLine(chart, ref)
  return l ? setLines(chart, ref.section, ref.line, 1, [fn(l)]) : chart
}

/** Move a chord from one letter to another (any line). */
export function moveChord(
  chart: Chart,
  from: LineRef & { at: number },
  to: LineRef & { at: number }
): Chart {
  const src = getLine(chart, from)
  const c = src?.chords.find(x => x.at === from.at)
  if (!c) return chart
  const removed = updateLine(chart, from, l => removeChord(l, from.at))
  return updateLine(removed, to, l => placeChord(l, to.at, c.chord))
}

const isVerse = (s: ChartSection) => s.kind === 'verse'
const hasChords = (s: ChartSection) => s.lines.some(l => l.chords.length)

/**
 * The verse "Chords from Verse 1" copies from for section `to`: the first verse
 * with chords before it. Null when there's none (or `to` isn't a verse).
 */
export function verseSource(chart: Chart, to: number): number | null {
  const target = chart.sections[to]
  if (!target || !isVerse(target)) return null
  for (let i = 0; i < to; i++) {
    const s = chart.sections[i]
    if (isVerse(s) && hasChords(s)) return i
  }
  return null
}

/** The next verse after the first chorded one: where the desktop button copies to. */
export function nextVerseTarget(chart: Chart): number | null {
  const from = chart.sections.findIndex(s => isVerse(s) && hasChords(s))
  if (from < 0) return null
  const empty = chart.sections.findIndex(
    (s, i) => i > from && isVerse(s) && !hasChords(s)
  )
  if (empty >= 0) return empty
  const any = chart.sections.findIndex((s, i) => i > from && isVerse(s))
  return any >= 0 ? any : null
}

/** "Chords from Verse 1": copy the source verse's chords onto section `to`. */
export function copyVerseChords(chart: Chart, to: number): Chart {
  const from = verseSource(chart, to)
  if (from == null) return chart
  return {
    ...chart,
    sections: chart.sections.map((s, i) =>
      i === to ? copyChords(chart.sections[from], s) : s
    ),
  }
}

// ── the palette (Chords mode) ────────────────────────────────────────────────

const MAJOR_STEPS: [number, string][] = [
  [0, ''],
  [2, 'm'],
  [4, 'm'],
  [5, ''],
  [7, ''],
  [9, 'm'],
  [11, 'dim'],
  [7, '7'],
]
const MINOR_STEPS: [number, string][] = [
  [0, 'm'],
  [2, 'dim'],
  [3, ''],
  [5, 'm'],
  [7, 'm'],
  [7, ''],
  [8, ''],
  [10, ''],
]

const same = (a: string, b: string) => {
  const x = parseChord(a)
  const y = parseChord(b)
  if (!x || !y) return a === b
  return (
    pitchClass(x.root) === pitchClass(y.root) &&
    canonicalQuality(x.quality) === canonicalQuality(y.quality) &&
    (x.bass ? pitchClass(x.bass) : null) ===
      (y.bass ? pitchClass(y.bass) : null)
  )
}

/**
 * "Key of G · suggested": the key's diatonic chords (plus V7; minor keys also
 * get the major V), spelled for the key, minus the ones already in the song.
 */
export function keyPalette(
  key: string | null | undefined,
  inSong: readonly string[] = []
): string[] {
  const c = key ? parseChord(key) : null
  if (!c) return []
  const q = canonicalQuality(c.quality)
  const minor = q.startsWith('m') && !q.startsWith('maj')
  const flats = spellFor(key)
  const root = c.root
  const out: string[] = []
  for (const [step, quality] of minor ? MINOR_STEPS : MAJOR_STEPS) {
    const name = transposeChord(root, step, flats) + quality
    if (!inSong.some(s => same(s, name)) && !out.some(s => same(s, name)))
      out.push(name)
  }
  return out
}

// ── the text view ────────────────────────────────────────────────────────────

/** Chord line + lyric line for one ChartLine (chords at their letter's column). */
function lineToText(line: ChartLine): string[] {
  const g = graphemes(line.text)
  const sorted = sortAnchors(line.chords)
  if (!sorted.length) return [line.text]
  const onlyChords = !line.text.trim() || /^[\s|:%/.x×\d()-]*$/.test(line.text)
  if (onlyChords) {
    // A chords-only line keeps its bars / spacing: names go back in place.
    let out = ''
    let p = 0
    for (const c of sorted) {
      out += g.slice(p, c.at).join('') + c.chord
      p = c.at
    }
    return [out + g.slice(p).join('')]
  }
  let row = ''
  for (const c of sorted) {
    const col = Math.max(c.at, row.length ? row.length + 1 : 0)
    row = row.padEnd(col, ' ') + c.chord
  }
  return [row, line.text]
}

/** A chart as chords over lyrics (`[Section]` headers, blank lines between). */
export function toChordsOverLyrics(chart: Chart): string {
  return (
    chart.sections
      .map(s => {
        const head = s.label ? [`[${s.label}]`] : []
        return [...head, ...s.lines.flatMap(lineToText)].join('\n')
      })
      .join('\n\n') + (chart.sections.length ? '\n' : '')
  )
}

/**
 * What the editor's text box shows for a stored chart: chords over lyrics
 * when converting it back gives exactly the same ChordPro, else the ChordPro
 * itself (meta, tabs, crowded chords…), so opening and saving never changes
 * a chart by accident.
 */
export function editableText(chordpro: string): string {
  if (!chordpro.trim()) return ''
  const chart = parse(chordpro)
  const cot = toChordsOverLyrics(chart)
  return importChart(cot).chordpro === serialize(chart) ? cot : chordpro
}

/** The chart in `text` with "Chords from Verse 1" applied, in the same format. */
export function copyVerseInText(
  text: string
): { text: string; from: string; to: string } | null {
  const imported = importChart(text)
  const chart = parse(imported.chordpro)
  const to = nextVerseTarget(chart)
  if (to == null) return null
  const from = verseSource(chart, to)
  if (from == null) return null
  const out = copyVerseChords(chart, to)
  const cp = serialize(out)
  const cot = toChordsOverLyrics(out)
  const next =
    imported.format !== 'chordpro' && importChart(cot).chordpro === cp
      ? cot
      : cp
  return {
    text: next,
    from: chart.sections[from].label || 'Verse 1',
    to: chart.sections[to].label || 'the next verse',
  }
}
