/**
 * ChordPro charts: parse for the reader, serialize for storage, and turn a paste
 * into ChordPro (docs/redesign/12-tools-and-chart.md · 3.1, decision 4). No I/O;
 * ports to Dart line for line.
 *
 * Positions (`Anchor.at`) count graphemes (what a reader sees as one letter),
 * so accents and emoji don't shift chords. `at === text.length` is a chord
 * after the last letter. Chord names stay as written: parsing / transposing a
 * chord name lives in `chords.ts`.
 */

export interface Anchor {
  /** Grapheme index into the line's text: the chord sits over this letter. */
  at: number
  chord: string
}

export interface ChartLine {
  text: string
  chords: Anchor[]
}

export type SectionKind =
  | 'verse'
  | 'chorus'
  | 'bridge'
  | 'tab'
  | 'grid'
  | 'other'

export interface ChartSection {
  kind: SectionKind
  /** "Verse 1", "Chorus", "Intro"…; '' for an unlabelled stanza. */
  label: string
  lines: ChartLine[]
  /** `{chorus}`: repeat the last chorus here (its lines are copied in). */
  recall?: boolean
}

export interface Chart {
  /** `{title}`, `{artist}`, `{key}`, `{tempo}`, `{capo}`… in the order met. */
  meta: Record<string, string>
  sections: ChartSection[]
}

export type ChartFormat = 'chordpro' | 'chords-over-lyrics' | 'plain'

// ── text helpers ─────────────────────────────────────────────────────────────

/** `Intl.Segmenter` (ES2022, not in this project's TS lib). */
interface GraphemeSegmenter {
  segment(s: string): Iterable<{ segment: string }>
}
const IntlSegmenter = (
  Intl as unknown as {
    Segmenter?: new (
      locale?: string,
      options?: { granularity: 'grapheme' }
    ) => GraphemeSegmenter
  }
).Segmenter
const segmenter = IntlSegmenter
  ? new IntlSegmenter(undefined, { granularity: 'grapheme' })
  : null

/** A string's graphemes (user-perceived characters). */
export function graphemes(s: string): string[] {
  return segmenter
    ? Array.from(segmenter.segment(s), x => x.segment)
    : Array.from(s)
}

const normalize = (text: string) => text.replace(/\r\n?/g, '\n')

/** Tabs to spaces (stops every 8), so chord columns line up with the lyric. */
function expandTabs(line: string): string {
  if (!line.includes('\t')) return line
  let out = ''
  for (const ch of line) {
    out += ch === '\t' ? ' '.repeat(8 - (out.length % 8)) : ch
  }
  return out
}

/**
 * A chord name as charts write it: root, accidental, quality / extensions /
 * alterations, optional bass ("G", "F#m7", "Bbmaj7", "Asus4", "C(add9)",
 * "Bm7b5", "D/F#", "G6/9", "N.C."). Recognition only; `chords.ts` parses.
 */
const CHORD_RE =
  /^(?:N\.?C\.?|[A-G][#b♯♭]?(?:maj|min|dim|aug|sus|add|m|M|°|ø|Δ|\+|-)*\d*(?:(?:maj|min|dim|aug|sus|add|no|b|#|♯|♭|\+|-)?\d+|\([^)]*\))*(?:\/\d+)?(?:\/[A-G][#b♯♭]?)?)$/

export function isChordToken(token: string): boolean {
  return CHORD_RE.test(token)
}

/** Tokens a chord line may carry besides chords: bars, repeats, dashes. */
const CHORD_LINE_EXTRA_RE =
  /^(?:\|+|:?\|\|?:?|-+|\/+|\.+|%|\*+|\(?[x×]\d+\)?|\(?\d+[x×]\)?)$/i

const SECTION_WORDS =
  'intro|verse|pre-?chorus|chorus|refrain|bridge|outro|solo|interlude|instrumental|hook|coda|tag|break|breakdown|riff|middle 8|ending|post-?chorus'

/** "[Verse 1]", "Chorus:", "PRE-CHORUS", "Intro (x2)" → its label. */
function headerLabel(line: string): string | null {
  const t = line.trim()
  const bracket = /^\[([^\]]+)\]$/.exec(t)
  if (bracket && !isChordToken(bracket[1].trim())) return bracket[1].trim()
  const word = new RegExp(
    `^((?:${SECTION_WORDS})(?:\\s*(?:\\d+|[IVX]+|[A-Z]))?(?:\\s*\\([^)]*\\))?)\\s*:?$`,
    'i'
  ).exec(t)
  return word ? word[1].trim() : null
}

function kindOf(label: string): SectionKind {
  const l = label.toLowerCase()
  if (/^verse/.test(l)) return 'verse'
  if (/^(chorus|refrain)/.test(l)) return 'chorus'
  if (/^bridge/.test(l)) return 'bridge'
  if (/^tab/.test(l)) return 'tab'
  return 'other'
}

// ── parse ────────────────────────────────────────────────────────────────────

const META_ALIASES: Record<string, string> = { t: 'title', st: 'subtitle' }
const ENV_ALIASES: Record<string, string> = {
  soc: 'start_of_chorus',
  eoc: 'end_of_chorus',
  sov: 'start_of_verse',
  eov: 'end_of_verse',
  sob: 'start_of_bridge',
  eob: 'end_of_bridge',
  sot: 'start_of_tab',
  eot: 'end_of_tab',
  sog: 'start_of_grid',
  eog: 'end_of_grid',
}
const DEFAULT_LABEL: Partial<Record<SectionKind, string>> = {
  verse: 'Verse',
  chorus: 'Chorus',
  bridge: 'Bridge',
  tab: 'Tab',
  grid: 'Grid',
}
const DIRECTIVE_RE =
  /^\s*\{\s*([A-Za-z_][\w-]*)\s*(?:[:\s]\s*([^}]*?))?\s*\}\s*$/

/** One ChordPro lyric line: `[G]Hello [C]there` → text + anchors. */
export function parseLine(line: string): ChartLine {
  const chords: Anchor[] = []
  let text = ''
  let at = 0
  const re = /\[([^\]]*)\]/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(line))) {
    const before = line.slice(last, m.index)
    text += before
    at += graphemes(before).length
    if (m[1].trim()) chords.push({ at, chord: m[1].trim() })
    last = m.index + m[0].length
  }
  text += line.slice(last)
  return { text, chords }
}

/** ChordPro text → sections of lines with chord anchors. Never throws. */
export function parse(text: string): Chart {
  const chart: Chart = { meta: {}, sections: [] }
  let current = null as ChartSection | null
  let env = null as string | null // the open {start_of_X}'s X
  let lastChorus = null as ChartSection | null

  const close = () => {
    if (current) {
      while (
        current.lines.length &&
        isBlankLine(current.lines[current.lines.length - 1])
      ) {
        current.lines.pop()
      }
      if (current.kind === 'chorus' && !current.recall) lastChorus = current
    }
    current = null
  }
  const open = (kind: SectionKind, label: string) => {
    close()
    current = { kind, label, lines: [] }
    chart.sections.push(current)
    return current
  }

  for (const raw of normalize(text).split('\n')) {
    const line = raw.replace(/\s+$/, '')
    const d = DIRECTIVE_RE.exec(line)
    if (d) {
      const name0 = d[1].toLowerCase()
      const name = ENV_ALIASES[name0] ?? META_ALIASES[name0] ?? name0
      const value = (d[2] ?? '').trim()
      const start = /^start_of_(\w+)$/.exec(name)
      const end = /^end_of_(\w+)$/.exec(name)
      if (start) {
        const x = start[1]
        const kind: SectionKind =
          x === 'verse' ||
          x === 'chorus' ||
          x === 'bridge' ||
          x === 'tab' ||
          x === 'grid'
            ? x
            : 'other'
        open(kind, value || DEFAULT_LABEL[kind] || capitalize(x))
        env = x
      } else if (end) {
        close()
        env = null
      } else if (name === 'chorus') {
        if (env) continue
        const s = open('chorus', value || lastChorus?.label || 'Chorus')
        s.recall = true
        s.lines = lastChorus ? lastChorus.lines.map(copyLine) : []
        close()
      } else if (
        /^(comment|c|ci|comment_italic|cb|comment_box|highlight)$/.test(name)
      ) {
        if (!env && value) open(kindOf(value), value)
      } else if (name === 'meta') {
        const mm = /^(\S+)\s+(.*)$/.exec(value)
        if (mm) chart.meta[mm[1].toLowerCase()] = mm[2]
      } else if (value) {
        chart.meta[name] = value
      }
      continue
    }

    const verbatim = env === 'tab' || env === 'grid'
    if (!verbatim && line.trimStart().startsWith('#')) continue // ChordPro comment

    if (!line.trim()) {
      if (env && current) current.lines.push({ text: '', chords: [] })
      else if (current && (current.lines.length || current.label)) close()
      continue
    }
    if (!env) {
      const label = headerLabel(line)
      if (label) {
        open(kindOf(label), label)
        continue
      }
    }
    const target = current ?? open('other', '')
    target.lines.push(verbatim ? { text: line, chords: [] } : parseLine(line))
  }
  close()
  return chart
}

const isBlankLine = (l: ChartLine) => !l.text.trim() && !l.chords.length
const copyLine = (l: ChartLine): ChartLine => ({
  text: l.text,
  chords: l.chords.map(c => ({ ...c })),
})
const capitalize = (s: string) =>
  s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')

// ── serialize ────────────────────────────────────────────────────────────────

/** One line back to ChordPro: anchors become inline `[chord]`s. */
export function serializeLine(line: ChartLine): string {
  const g = graphemes(line.text)
  const sorted = line.chords
    .map((c, i) => ({ ...c, i }))
    .sort((a, b) => a.at - b.at || a.i - b.i)
  let out = ''
  let k = 0
  for (let p = 0; p <= g.length; p++) {
    while (k < sorted.length && Math.min(sorted[k].at, g.length) === p) {
      out += `[${sorted[k].chord}]`
      k++
    }
    if (p < g.length) out += g[p]
  }
  return out
}

/** Chart → ChordPro. `serialize(parse(serialize(c)))` equals `serialize(c)`. */
export function serialize(chart: Chart): string {
  const blocks: string[] = []
  for (const s of chart.sections) {
    if (s.recall) {
      blocks.push(
        s.label && s.label !== 'Chorus' ? `{chorus: ${s.label}}` : '{chorus}'
      )
      continue
    }
    const verbatim = s.kind === 'tab' || s.kind === 'grid'
    const body = s.lines.map(l => (verbatim ? l.text : serializeLine(l)))
    if (s.kind === 'other') {
      // An unlabelled stanza needs no header; a labelled one uses {comment}.
      const head = s.label ? [`{comment: ${s.label}}`] : []
      const lines = [...head, ...body.filter(b => b.trim())]
      if (lines.length) blocks.push(lines.join('\n'))
    } else {
      const label = s.label ? `: ${s.label}` : ''
      blocks.push(
        [`{start_of_${s.kind}${label}}`, ...body, `{end_of_${s.kind}}`].join(
          '\n'
        )
      )
    }
  }
  const meta = Object.entries(chart.meta).map(([k, v]) => `{${k}: ${v}}\n`)
  return meta.join('') + blocks.join('\n\n') + (blocks.length ? '\n' : '')
}

// ── reading helpers ─────────────────────────────────────────────────────────

/**
 * A line as chord + text pieces for the reader: each piece's chord sits over
 * the start of its text. The first piece may have no chord.
 */
export function lineSegments(
  line: ChartLine
): { chord: string | null; text: string }[] {
  const g = graphemes(line.text)
  const sorted = [...line.chords].sort((a, b) => a.at - b.at)
  const out: { chord: string | null; text: string }[] = []
  const firstAt = sorted.length ? Math.min(sorted[0].at, g.length) : g.length
  if (firstAt > 0 || !sorted.length)
    out.push({ chord: null, text: g.slice(0, firstAt).join('') })
  sorted.forEach((c, i) => {
    const from = Math.min(c.at, g.length)
    const to =
      i + 1 < sorted.length ? Math.min(sorted[i + 1].at, g.length) : g.length
    out.push({ chord: c.chord, text: g.slice(from, to).join('') })
  })
  return out
}

/** Every chord in the chart once, in first-use order (the chord viewer's chips). */
export function chordsInOrder(chart: Chart): string[] {
  const seen = new Set<string>()
  for (const s of chart.sections) {
    for (const l of s.lines) {
      for (const c of [...l.chords].sort((a, b) => a.at - b.at))
        seen.add(c.chord)
    }
  }
  return [...seen]
}

/** "Sections 4 · chords 22": sections with lines, and chord marks placed. */
export function chartStats(chart: Chart): { sections: number; chords: number } {
  const sections = chart.sections.filter(s => s.lines.length).length
  const chords = chart.sections.reduce(
    (n, s) => n + s.lines.reduce((m, l) => m + l.chords.length, 0),
    0
  )
  return { sections, chords }
}

// ── paste: detect + convert (decision 4) ─────────────────────────────────────

/** A line made only of chords (plus bars / repeats), with each chord's column. */
function chordLine(line: string): Anchor[] | null {
  const g = graphemes(expandTabs(line))
  const chords: Anchor[] = []
  let any = false
  let i = 0
  while (i < g.length) {
    if (/\s/.test(g[i])) {
      i++
      continue
    }
    let j = i
    while (j < g.length && !/\s/.test(g[j])) j++
    const token = g.slice(i, j).join('')
    if (isChordToken(token)) {
      chords.push({ at: i, chord: token })
      any = true
    } else if (!CHORD_LINE_EXTRA_RE.test(token)) {
      return null
    }
    i = j
  }
  return any ? chords : null
}

/** "Intro: G C D" → the label and the chords after it. */
function labelledChordLine(
  line: string
): { label: string; rest: string } | null {
  const m = new RegExp(
    `^(\\s*\\[?(?:${SECTION_WORDS})(?:\\s*\\d+)?\\]?\\s*:?)(\\s+.*)$`,
    'i'
  ).exec(line)
  if (!m || !chordLine(m[2])) return null
  return {
    label: m[1].replace(/[[\]:]/g, '').trim(),
    rest: ' '.repeat(graphemes(m[1]).length) + m[2],
  }
}

/** Inline `[G]` chords or `{directives}` → ChordPro; chord-only lines → chords over lyrics. */
export function detectFormat(text: string): ChartFormat {
  const lines = normalize(text).split('\n')
  let chordLines = 0
  for (const line of lines) {
    if (DIRECTIVE_RE.test(line)) return 'chordpro'
    const inline = line.match(/\[([^\]]+)\]/g) ?? []
    // A lone "[Verse 1]" is a header; "[G]" or "Hel[C]lo" is ChordPro.
    if (inline.some(b => isChordToken(b.slice(1, -1).trim()))) return 'chordpro'
    if (line.trim() && (chordLine(line) || labelledChordLine(line)))
      chordLines++
  }
  return chordLines > 0 ? 'chords-over-lyrics' : 'plain'
}

/**
 * Chords over lyrics → a Chart: each chord-only line above a lyric line rides
 * on the letter under it (a chord over a gap moves to the next word's first
 * letter); a chord line with no lyric under it stays a chords-only line;
 * `[Verse]` / `Chorus:` headers start sections; blank lines split stanzas.
 */
export function chartFromChordsOverLyrics(text: string): Chart {
  const chart: Chart = { meta: {}, sections: [] }
  let current = null as ChartSection | null
  const open = (label: string) => {
    current = { kind: kindOf(label), label, lines: [] }
    chart.sections.push(current)
    return current
  }
  const push = (l: ChartLine) => (current ?? open('')).lines.push(l)

  const lines = normalize(text)
    .split('\n')
    .map(l => expandTabs(l).replace(/\s+$/, ''))
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) {
      current = null
      continue
    }
    const labelled = labelledChordLine(line)
    let chords = chordLine(line)
    let source = line
    if (!chords && labelled) {
      open(labelled.label)
      source = labelled.rest
      chords = chordLine(source)
    }
    if (!chords) {
      const label = headerLabel(line)
      if (label) open(label)
      else push({ text: line, chords: [] })
      continue
    }
    const next = lines[i + 1]
    const nextIsLyric =
      next !== undefined &&
      next.trim() &&
      !chordLine(next) &&
      !labelledChordLine(next) &&
      !headerLabel(next)
    if (nextIsLyric) {
      push(placeOver(chords, next))
      i++
    } else {
      push(chordsOnly(chords, source))
    }
  }
  return chart
}

function placeOver(chords: Anchor[], lyric: string): ChartLine {
  const g = graphemes(lyric)
  return {
    text: lyric,
    chords: chords.map(c => {
      let at = Math.min(c.at, g.length)
      while (at < g.length && /\s/.test(g[at])) at++
      return { at, chord: c.chord }
    }),
  }
}

/**
 * A chords-only line keeps its spacing (and any bars / repeats) as text: the
 * chord names come out of the text and ride where they stood ("| G  | C").
 */
function chordsOnly(chords: Anchor[], source: string): ChartLine {
  const g = graphemes(source)
  const out: Anchor[] = []
  let text: string[] = []
  let p = 0
  for (const c of chords) {
    text = text.concat(g.slice(p, c.at))
    out.push({ at: text.length, chord: c.chord })
    p = c.at + graphemes(c.chord).length
  }
  // Trailing spaces go, but never the spacing before the last chord.
  const joined = text.join('') + g.slice(p).join('').replace(/\s+$/, '')
  return { text: joined, chords: out }
}

/** Chords over lyrics → ChordPro text. */
export function fromChordsOverLyrics(text: string): string {
  return serialize(chartFromChordsOverLyrics(text))
}

/**
 * A paste, ready to store: ChordPro and plain lyrics stay as pasted; chords
 * over lyrics are converted. `format` and the counts are for the preview
 * ("Chords over lyrics · Sections 4 · chords 22").
 */
export function importChart(text: string): {
  format: ChartFormat
  chordpro: string
  sections: number
  chords: number
} {
  const format = detectFormat(text)
  const chordpro =
    format === 'chords-over-lyrics'
      ? fromChordsOverLyrics(text)
      : normalize(text)
  return { format, chordpro, ...chartStats(parse(chordpro)) }
}

// ── editing helper ───────────────────────────────────────────────────────────

/**
 * "Chords from Verse 1 → next verse": puts `from`'s chords on `to`'s lines,
 * line by line, on the same word and letter within it (clamped to the word).
 * `to` lines past `from`'s end keep their chords. Returns a new section.
 */
export function copyChords(from: ChartSection, to: ChartSection): ChartSection {
  return {
    ...to,
    lines: to.lines.map((line, i) => {
      const src = from.lines[i]
      if (!src) return copyLine(line)
      const srcWords = wordStarts(src.text)
      const dstWords = wordStarts(line.text)
      const dstLen = graphemes(line.text).length
      const chords = src.chords.map(c => {
        if (!srcWords.length || !dstWords.length)
          return { at: Math.min(c.at, dstLen), chord: c.chord }
        if (c.at >= srcWords[srcWords.length - 1].end)
          return { at: dstLen, chord: c.chord }
        let w = srcWords.findIndex(
          (_s, k) => k + 1 === srcWords.length || c.at < srcWords[k + 1].start
        )
        if (w === -1) w = 0
        const off = Math.max(0, c.at - srcWords[w].start)
        const dw = dstWords[Math.min(w, dstWords.length - 1)]
        return { at: Math.min(dw.start + off, dw.end - 1), chord: c.chord }
      })
      return { text: line.text, chords }
    }),
  }
}

/** Word spans in graphemes: [start, end) of each run of non-space. */
function wordStarts(text: string): { start: number; end: number }[] {
  const g = graphemes(text)
  const out: { start: number; end: number }[] = []
  let i = 0
  while (i < g.length) {
    if (/\s/.test(g[i])) {
      i++
      continue
    }
    const start = i
    while (i < g.length && !/\s/.test(g[i])) i++
    out.push({ start, end: i })
  }
  return out
}
