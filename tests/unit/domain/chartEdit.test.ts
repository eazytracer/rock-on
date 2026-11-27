import { describe, it, expect } from 'vitest'
import {
  editText,
  dropBracketChords,
  placeChord,
  removeChord,
  changeChord,
  nudgeChord,
  splitLine,
  joinLines,
  flatLines,
  moveChord,
  verseSource,
  nextVerseTarget,
  copyVerseChords,
  keyPalette,
  toChordsOverLyrics,
  editableText,
  copyVerseInText,
} from '../../../src/domain/chartEdit'
import {
  parse,
  parseLine,
  serialize,
  serializeLine,
  importChart,
} from '../../../src/domain/chordpro'

const line = (s: string) => parseLine(s)
const show = (l: ReturnType<typeof parseLine>) => serializeLine(l)

describe('editText: chords ride their letters', () => {
  it('typing before a chorded word pushes the chord with it', () => {
    const l = line('That [G]saved a [Em]wretch like [A7]me')
    expect(show(editText(l, 'That saved a poor wretch like me'))).toBe(
      'That [G]saved a poor [Em]wretch like [A7]me'
    )
  })
  it('typing after a chorded letter keeps the chord', () => {
    expect(show(editText(line('[G]Hi there'), 'Hiya there'))).toBe(
      '[G]Hiya there'
    )
  })
  it('editing inside a word moves only the chords after the edit', () => {
    expect(
      show(editText(line('[C]sweet the [G]sound'), 'sweeter the sound'))
    ).toBe('[C]sweeter the [G]sound')
  })
  it("deleting a chord's letter moves it to the letter after", () => {
    expect(show(editText(line('a [G]big dog'), 'a ig dog'))).toBe('a [G]ig dog')
  })
  it('deleting a chorded word lands the chord on the next word', () => {
    expect(show(editText(line('one [G]two three'), 'one three'))).toBe(
      'one [G]three'
    )
  })
  it('replacing a chorded letter keeps the chord on the new letter', () => {
    expect(show(editText(line('[G]cat'), 'bat'))).toBe('[G]bat')
  })
  it('a chord after the last letter stays at the end', () => {
    expect(show(editText(line('like [A7]me[D]'), 'like me now'))).toBe(
      'like [A7]me[D] now'
    )
    expect(show(editText(line('me[D]'), 'm'))).toBe('m[D]')
  })
  it('repeated letters: inserting a duplicate keeps the chord on its letter', () => {
    expect(show(editText(line('a[G]b'), 'aab'))).toBe('aa[G]b')
  })
  it('never moves a chord off its letter when only other words change', () => {
    const before = line('I [G]once was [G7]lost, but [C]now am [G]found')
    const after = editText(before, 'I once was really lost, but now am found')
    expect(show(after)).toBe(
      'I [G]once was really [G7]lost, but [C]now am [G]found'
    )
  })
  it('counts graphemes, not code units', () => {
    expect(show(editText(line('é [G]x'), 'éé x'))).toBe('éé [G]x')
  })
})

describe('dropBracketChords', () => {
  it('turns a typed [Am] into a chord on the next letter', () => {
    const l = { text: 'hello [am]world', chords: [{ at: 0, chord: 'C' }] }
    expect(show(dropBracketChords(l))).toBe('[C]hello [Am]world')
  })
  it('shifts later chords back over the removed brackets', () => {
    const l = { text: 'a [D]b c', chords: [{ at: 7, chord: 'G' }] }
    expect(show(dropBracketChords(l))).toBe('a [D]b [G]c')
  })
  it('leaves brackets that are not chords', () => {
    const l = { text: 'see [note] here', chords: [] }
    expect(dropBracketChords(l)).toEqual(l)
  })
})

describe('place, change, remove, nudge', () => {
  it('places on a letter, replacing what was there', () => {
    const l = line('[G]Amazing grace')
    expect(show(placeChord(l, 8, 'C'))).toBe('[G]Amazing [C]grace')
    expect(show(placeChord(l, 0, 'D'))).toBe('[D]Amazing grace')
    expect(show(placeChord(l, 99, 'D'))).toBe('[G]Amazing grace[D]')
  })
  it('changes and removes', () => {
    const l = line('[G]Amazing [C]grace')
    expect(show(changeChord(l, 8, 'Cadd9'))).toBe('[G]Amazing [Cadd9]grace')
    expect(show(removeChord(l, 0))).toBe('Amazing [C]grace')
  })
  it('◀ ▶ moves one grapheme, not past the edges or another chord', () => {
    const l = line('[G]ab[C]c')
    expect(nudgeChord(l, 0, -1)).toBeNull()
    expect(show(nudgeChord(l, 0, 1)!.line)).toBe('a[G]b[C]c')
    expect(nudgeChord(l, 2, 1)!.at).toBe(3)
    expect(nudgeChord(line('a[G]b[C]c'), 1, 1)).toBeNull()
    expect(show(nudgeChord(line('é[G]e'), 1, -1)!.line)).toBe('[G]ée')
  })
})

describe('split and join', () => {
  it('chords go with their letters', () => {
    const [a, b] = splitLine(line('[G]one [C]two'), 4)
    expect(show(a)).toBe('[G]one ')
    expect(show(b)).toBe('[C]two')
    expect(show(joinLines(a, b))).toBe('[G]one [C]two')
  })
})

const VERSES = `{start_of_verse: Verse 1}
[G]Amazing [G7]grace, how [C]sweet the [G]sound
{end_of_verse}

{start_of_chorus}
[C]Sing
{end_of_chorus}

{start_of_verse: Verse 2}
'Twas grace that taught my heart to fear
{end_of_verse}
`

describe('chart-level helpers', () => {
  it('flatLines lists every line in order', () => {
    expect(flatLines(parse(VERSES))).toEqual([
      { section: 0, line: 0 },
      { section: 1, line: 0 },
      { section: 2, line: 0 },
    ])
  })
  it('moveChord moves across lines', () => {
    const c = moveChord(
      parse(VERSES),
      { section: 0, line: 0, at: 0 },
      { section: 2, line: 0, at: 0 }
    )
    expect(serializeLine(c.sections[0].lines[0])).toBe(
      'Amazing [G7]grace, how [C]sweet the [G]sound'
    )
    expect(serializeLine(c.sections[2].lines[0]).startsWith("[G]'Twas")).toBe(
      true
    )
  })
  it('Chords from Verse 1 fills the next verse', () => {
    const chart = parse(VERSES)
    expect(verseSource(chart, 2)).toBe(0)
    expect(verseSource(chart, 1)).toBeNull() // a chorus
    expect(verseSource(chart, 0)).toBeNull() // nothing before it
    expect(nextVerseTarget(chart)).toBe(2)
    const out = copyVerseChords(chart, 2)
    expect(serializeLine(out.sections[2].lines[0])).toBe(
      "[G]'Twas [G7]grace that [C]taught my [G]heart to fear"
    )
  })
})

describe('keyPalette', () => {
  it("suggests the key's chords not already in the song", () => {
    expect(keyPalette('G', ['G', 'G7', 'C', 'Em', 'A7', 'D'])).toEqual([
      'Am',
      'Bm',
      'F#dim',
      'D7',
    ])
  })
  it('minor keys get the major V too, spelled for the key', () => {
    expect(keyPalette('Dm')).toEqual([
      'Dm',
      'Edim',
      'F',
      'Gm',
      'Am',
      'A',
      'Bb',
      'C',
    ])
  })
  it('no key, no palette', () => {
    expect(keyPalette(null)).toEqual([])
  })
})

describe('the text view', () => {
  const PASTE = `[Verse 1]
G        G7        C          G
Amazing  grace, how  sweet the  sound

[Chorus]
C              G
Sing it out loud
`
  it('chords over lyrics round-trip exactly', () => {
    const stored = importChart(PASTE).chordpro
    const text = editableText(stored)
    expect(text).toContain('[Verse 1]')
    expect(importChart(text).chordpro).toBe(serialize(parse(stored)))
  })
  it('keeps ChordPro when converting would change anything', () => {
    const cp = '{title: X}\n[G]Hello [C]there\n'
    expect(editableText(cp)).toBe(cp)
    const crowded = '[Am][G]Hi\n'
    expect(editableText(crowded)).toBe(crowded)
  })
  it('writes chord rows over lyric rows', () => {
    expect(toChordsOverLyrics(parse('[G]Hi [C]you\n'))).toBe('G  C\nHi you\n')
  })
  it('empty stays empty', () => {
    expect(editableText('  ')).toBe('')
  })
})

describe('copyVerseInText (desktop "Chords from Verse 1 → next verse")', () => {
  it('fills the next verse and keeps chords over lyrics', () => {
    const text = `[Verse 1]
G        C
Hello my friend

[Verse 2]
Goodbye my love
`
    const r = copyVerseInText(text)!
    expect(r.from).toBe('Verse 1')
    expect(r.to).toBe('Verse 2')
    expect(r.text).toContain('[Verse 2]\nG          C\nGoodbye my love')
  })
  it('null without a chorded verse and another verse', () => {
    expect(copyVerseInText('[Verse 1]\nno chords\n')).toBeNull()
  })
})
