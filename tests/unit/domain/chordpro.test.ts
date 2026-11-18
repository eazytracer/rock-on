import { describe, it, expect } from 'vitest'
import {
  parse,
  parseLine,
  serialize,
  serializeLine,
  lineSegments,
  chordsInOrder,
  chartStats,
  detectFormat,
  fromChordsOverLyrics,
  chartFromChordsOverLyrics,
  importChart,
  copyChords,
  isChordToken,
  graphemes,
} from '../../../src/domain/chordpro'

const AMAZING_GRACE = `{title: Amazing Grace}
{key: G}
{start_of_verse: Verse 1}
[G]Amazing [G7]grace, how [C]sweet the [G]sound
That [G]saved a [Em]wretch like [A7]me[D]
{end_of_verse}
`

describe('parseLine', () => {
  it('splits inline chords from the text (CHART-DATA-MODEL example)', () => {
    expect(parseLine('[G]Amazing [G7]grace')).toEqual({
      text: 'Amazing grace',
      chords: [
        { at: 0, chord: 'G' },
        { at: 8, chord: 'G7' },
      ],
    })
  })

  it('a trailing chord sits at text.length', () => {
    const l = parseLine('like [A7]me[D]')
    expect(l.text).toBe('like me')
    expect(l.chords.at(-1)).toEqual({ at: l.text.length, chord: 'D' })
  })

  it('counts graphemes, not UTF-16 units (accents, emoji)', () => {
    const l = parseLine('Café 👍🏽 [G]now')
    // "Café 👍🏽 " is 7 graphemes (e + combining accent = 1; skin-toned emoji = 1)
    expect(l.chords).toEqual([{ at: 7, chord: 'G' }])
    expect(graphemes(l.text)[7]).toBe('n')
  })

  it('ignores empty brackets', () => {
    expect(parseLine('a[]b').chords).toEqual([])
  })
})

describe('parse', () => {
  it('reads meta, sections and anchors', () => {
    const c = parse(AMAZING_GRACE)
    expect(c.meta).toEqual({ title: 'Amazing Grace', key: 'G' })
    expect(c.sections).toHaveLength(1)
    expect(c.sections[0]).toMatchObject({ kind: 'verse', label: 'Verse 1' })
    expect(c.sections[0].lines[1].text).toBe('That saved a wretch like me')
    expect(c.sections[0].lines[1].chords.at(-1)).toEqual({ at: 27, chord: 'D' })
  })

  it('understands short directive names and default labels', () => {
    const c = parse(
      '{t: Song}\n{st: Live}\n{soc}\n[C]La\n{eoc}\n{sov}\nWords\n{eov}'
    )
    expect(c.meta).toEqual({ title: 'Song', subtitle: 'Live' })
    expect(c.sections.map(s => [s.kind, s.label])).toEqual([
      ['chorus', 'Chorus'],
      ['verse', 'Verse'],
    ])
  })

  it('{comment} starts a labelled section; blank lines split stanzas', () => {
    const c = parse('{c: Intro}\n[G] [C]\n\nFirst line\nSecond\n\nThird')
    expect(c.sections.map(s => s.label)).toEqual(['Intro', '', ''])
    expect(c.sections[1].lines.map(l => l.text)).toEqual([
      'First line',
      'Second',
    ])
  })

  it('keeps blank lines inside an explicit section, trimming trailing ones', () => {
    const c = parse('{start_of_verse}\nA\n\nB\n\n{end_of_verse}')
    expect(c.sections[0].lines.map(l => l.text)).toEqual(['A', '', 'B'])
  })

  it('treats a lone [Verse 2] (not a chord) as a header', () => {
    const c = parse('[Verse 2]\n[G]Hello')
    expect(c.sections[0]).toMatchObject({ kind: 'verse', label: 'Verse 2' })
    expect(c.sections[0].lines[0].chords).toEqual([{ at: 0, chord: 'G' }])
  })

  it('a lone [G] is a chord line, not a header', () => {
    const c = parse('[G]')
    expect(c.sections[0].lines[0]).toEqual({
      text: '',
      chords: [{ at: 0, chord: 'G' }],
    })
  })

  it('{chorus} repeats the last chorus', () => {
    const c = parse('{soc}\n[C]Sing\n{eoc}\n\nVerse words\n\n{chorus}')
    const recall = c.sections.at(-1)!
    expect(recall).toMatchObject({
      kind: 'chorus',
      recall: true,
      label: 'Chorus',
    })
    expect(recall.lines).toEqual([
      { text: 'Sing', chords: [{ at: 0, chord: 'C' }] },
    ])
  })

  it('tab sections are verbatim', () => {
    const c = parse('{sot}\ne|--[3]--|\n{eot}')
    expect(c.sections[0]).toMatchObject({ kind: 'tab' })
    expect(c.sections[0].lines[0]).toEqual({ text: 'e|--[3]--|', chords: [] })
  })

  it('skips # comments, reads {meta: name value}, handles CRLF', () => {
    const c = parse('# a note\r\n{meta: capo 2}\r\nLine\r\n')
    expect(c.meta).toEqual({ capo: '2' })
    expect(c.sections[0].lines).toEqual([{ text: 'Line', chords: [] }])
  })

  it('never throws on garbage', () => {
    for (const s of [
      '',
      '{',
      '}',
      '[[',
      ']]',
      '{start_of_verse',
      '{end_of_chorus}',
      '[G',
      '\n\n\n',
    ]) {
      expect(() => parse(s)).not.toThrow()
    }
    expect(parse('').sections).toEqual([])
  })
})

describe('serialize', () => {
  it('round-trips the Amazing Grace example exactly', () => {
    expect(serialize(parse(AMAZING_GRACE))).toBe(AMAZING_GRACE)
  })

  it('serializeLine puts chords back, including several at one spot', () => {
    expect(
      serializeLine({
        text: 'me',
        chords: [
          { at: 2, chord: 'A7' },
          { at: 2, chord: 'D' },
        ],
      })
    ).toBe('me[A7][D]')
    expect(serializeLine({ text: 'ab', chords: [{ at: 9, chord: 'G' }] })).toBe(
      'ab[G]'
    )
  })

  it('parse ∘ serialize is stable', () => {
    const inputs = [
      AMAZING_GRACE,
      '{c: Intro}\n[G]    [C]\n\nFirst [Am]line\n\n{soc: Chorus}\n[F]Sing\n{eoc}\n\n{chorus}',
      '{c: Empty}\n\nThen words',
      '[Verse 2]\nHel[G]lo\n\n{sot}\ne|---|\n{eot}',
      '{start_of_intro}\n[E]Go\n{end_of_intro}',
      'Just lyrics\nno chords\n\nSecond stanza',
      'Café [G]👍🏽',
    ]
    for (const input of inputs) {
      const once = serialize(parse(input))
      expect(serialize(parse(once))).toBe(once)
    }
  })

  it('keeps the chart content through a round trip', () => {
    const src = '{c: Intro}\n[G] [C]\n\nFirst [Am]line'
    const again = parse(serialize(parse(src)))
    expect(again).toEqual(parse(src))
  })
})

describe('reading helpers', () => {
  it('lineSegments: chord + text pieces', () => {
    expect(lineSegments(parseLine('Hi [G]there [C]you[D]'))).toEqual([
      { chord: null, text: 'Hi ' },
      { chord: 'G', text: 'there ' },
      { chord: 'C', text: 'you' },
      { chord: 'D', text: '' },
    ])
    expect(lineSegments({ text: 'plain', chords: [] })).toEqual([
      { chord: null, text: 'plain' },
    ])
    expect(lineSegments(parseLine('[G]Go'))).toEqual([
      { chord: 'G', text: 'Go' },
    ])
  })

  it('chordsInOrder: each chord once, first use first', () => {
    expect(chordsInOrder(parse(AMAZING_GRACE))).toEqual([
      'G',
      'G7',
      'C',
      'Em',
      'A7',
      'D',
    ])
  })

  it('chartStats: sections with lines and chord marks', () => {
    expect(chartStats(parse(AMAZING_GRACE))).toEqual({ sections: 1, chords: 8 })
  })
})

describe('isChordToken', () => {
  it.each([
    'G',
    'Em',
    'F#m7',
    'Bbmaj7',
    'Asus4',
    'Cadd9',
    'D/F#',
    'E7#9',
    'Bm7b5',
    'C(add9)',
    'G6/9',
    'Ebm',
    'A7sus4',
    'Cmaj9',
    'Fdim',
    'Caug',
    'C+',
    'Bø',
    'N.C.',
    'F♯m',
    'B♭',
  ])('accepts %s', t => expect(isChordToken(t)).toBe(true))

  it.each([
    'Hello',
    'A man',
    'Bed',
    'Verse',
    'x2',
    'Am I',
    'H',
    'g',
    '',
    'Chorus',
  ])('rejects %s', t => expect(isChordToken(t)).toBe(false))
})

/** A chord row with each chord at its column. */
const row = (...pairs: [number, string][]) =>
  pairs.reduce((s, [at, c]) => s.padEnd(at) + c, '')

// Ultimate Guitar style paste.
const UG = `[Intro]
G  C  G  D

[Verse 1]
${row([0, 'G'], [8, 'G7'], [18, 'C'], [28, 'G'])}
Amazing grace how sweet the sound
${row([5, 'G'], [13, 'Em'], [25, 'A7'], [28, 'D'])}
That saved a wretch like me

[Chorus]
${row([0, 'C'], [4, 'G'])}
Was blind but now I see
`

describe('detectFormat (decision 4)', () => {
  it('inline chords → chordpro', () => {
    expect(detectFormat('Hel[G]lo there')).toBe('chordpro')
    expect(detectFormat('[Verse]\n[G]Hello')).toBe('chordpro')
  })

  it('a directive → chordpro', () => {
    expect(detectFormat('{title: X}\nJust words')).toBe('chordpro')
  })

  it('chord-only lines over lyrics → chords-over-lyrics', () => {
    expect(detectFormat(UG)).toBe('chords-over-lyrics')
    expect(detectFormat('Intro: G C D\n\nwords here')).toBe(
      'chords-over-lyrics'
    )
  })

  it('[Verse] headers alone do not make it ChordPro', () => {
    expect(detectFormat('[Verse 1]\nJust words\n[Chorus]\nMore words')).toBe(
      'plain'
    )
  })

  it('plain lyrics → plain', () => {
    expect(detectFormat('A man walks in\nAnd I am here\n\nBed of roses')).toBe(
      'plain'
    )
    expect(detectFormat('')).toBe('plain')
  })
})

describe('chords over lyrics → ChordPro', () => {
  it('places chords on the letter under them', () => {
    const c = chartFromChordsOverLyrics(
      'G             C\nAmazing grace how sweet'
    )
    expect(c.sections[0].lines[0]).toEqual({
      text: 'Amazing grace how sweet',
      chords: [
        { at: 0, chord: 'G' },
        { at: 14, chord: 'C' },
      ],
    })
  })

  it('a chord over a gap moves to the next letter; past the end it trails', () => {
    const c = chartFromChordsOverLyrics('     G       D\nHey  you')
    expect(c.sections[0].lines[0].chords).toEqual([
      { at: 5, chord: 'G' },
      { at: 8, chord: 'D' },
    ])
  })

  it('converts the UG paste into sections', () => {
    const out = fromChordsOverLyrics(UG)
    expect(out).toBe(
      [
        '{comment: Intro}',
        '[G]  [C]  [G]  [D]',
        '',
        '{start_of_verse: Verse 1}',
        '[G]Amazing [G7]grace how [C]sweet the [G]sound',
        'That [G]saved a [Em]wretch like [A7]me[D]',
        '{end_of_verse}',
        '',
        '{start_of_chorus: Chorus}',
        '[C]Was [G]blind but now I see',
        '{end_of_chorus}',
        '',
      ].join('\n')
    )
  })

  it('UG chords land where they were written', () => {
    const verse = chartFromChordsOverLyrics(UG).sections[1]
    const l = verse.lines[1]
    const g = graphemes(l.text)
    expect(l.chords.map(c => g[c.at] ?? 'end')).toEqual(['s', 'w', 'm', 'end'])
  })

  it('keeps bars and repeats on a chords-only line', () => {
    const c = chartFromChordsOverLyrics('| G  | C  | (x2)')
    expect(serialize(c)).toBe('| [G]  | [C]  | (x2)\n')
  })

  it('"Intro: G C D" → an Intro section with a chords-only line', () => {
    const c = chartFromChordsOverLyrics('Intro: G C D')
    expect(c.sections[0]).toMatchObject({ label: 'Intro', kind: 'other' })
    expect(c.sections[0].lines[0].chords.map(x => x.chord)).toEqual([
      'G',
      'C',
      'D',
    ])
  })

  it('"Chorus:" headers, lyric-only lines and tabs', () => {
    const c = chartFromChordsOverLyrics('Chorus:\nD\tA\nla la\nno chords here')
    expect(c.sections[0]).toMatchObject({ kind: 'chorus', label: 'Chorus' })
    expect(c.sections[0].lines[0]).toEqual({
      text: 'la la',
      chords: [
        { at: 0, chord: 'D' },
        { at: 5, chord: 'A' },
      ],
    })
    expect(c.sections[0].lines[1]).toEqual({
      text: 'no chords here',
      chords: [],
    })
  })

  it('the converted text parses back to the same chart', () => {
    const chart = chartFromChordsOverLyrics(UG)
    expect(parse(serialize(chart))).toEqual(chart)
  })
})

describe('importChart', () => {
  it('ChordPro is stored as pasted', () => {
    const r = importChart(AMAZING_GRACE)
    expect(r).toEqual({
      format: 'chordpro',
      chordpro: AMAZING_GRACE,
      sections: 1,
      chords: 8,
    })
  })

  it('plain lyrics are stored as pasted', () => {
    const r = importChart('Line one\nLine two\n\nLine three')
    expect(r.format).toBe('plain')
    expect(r.chordpro).toBe('Line one\nLine two\n\nLine three')
    expect(r.sections).toBe(2)
    expect(r.chords).toBe(0)
  })

  it('chords over lyrics are converted, with counts for the preview', () => {
    const r = importChart(UG)
    expect(r.format).toBe('chords-over-lyrics')
    expect(r.chordpro).toContain('{start_of_verse: Verse 1}')
    expect(r).toMatchObject({ sections: 3, chords: 14 })
  })
})

describe('copyChords ("Chords from Verse 1")', () => {
  it('puts the chords on the same word and letter of the next verse', () => {
    const v1 = parse(
      '{sov: Verse 1}\n[G]Amazing [G7]grace, how [C]sweet the [G]sound\n{eov}'
    ).sections[0]
    const v2 = parse('{sov: Verse 2}\nTwas grace that taught my heart\n{eov}')
      .sections[0]
    const out = copyChords(v1, v2)
    expect(out.label).toBe('Verse 2')
    expect(serializeLine(out.lines[0])).toBe(
      '[G]Twas [G7]grace that [C]taught my [G]heart'
    )
    expect(v2.lines[0].chords).toEqual([]) // the source is untouched
  })

  it('a trailing chord stays trailing; extra lines keep theirs', () => {
    const v1 = parse('like me[D]').sections[0]
    const v2 = parse('was lost\n[E]Extra').sections[0]
    const out = copyChords(v1, v2)
    expect(serializeLine(out.lines[0])).toBe('was lost[D]')
    expect(serializeLine(out.lines[1])).toBe('[E]Extra')
  })

  it('clamps the letter to a shorter word', () => {
    const v1 = parse('Wonder[G]ful').sections[0]
    const v2 = parse('Hi').sections[0]
    expect(copyChords(v1, v2).lines[0].chords).toEqual([{ at: 1, chord: 'G' }])
  })
})
