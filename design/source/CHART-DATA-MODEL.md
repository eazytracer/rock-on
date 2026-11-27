# Rock On — Chart data model (proposal, Oct 2026)

Backs `Song Chart.html`. Chords are tied to **positions in the lyrics, not to times**. Paging is manual, so nothing needs a clock.

## Store: one ChordPro text field per chart

The source of truth is a plain ChordPro string. The app parses it on the client, both for the reader and for the editor.

```
{title: Amazing Grace}
{key: G}
{start_of_verse: Verse 1}
[G]Amazing [G7]grace, how [C]sweet the [G]sound
That [G]saved a [Em]wretch like [A7]me[D]
{end_of_verse}
```

Why text and not JSON rows:
- It's one column and one row per chart. It syncs to IndexedDB and Supabase as is, works offline, and its diffs are readable.
- **Postel's Law:** import and export use an open format that other chord apps read. Paste-detection converts chords-over-lyrics *into* this format.
- Transpose is applied when the chart is displayed and never written back. The stored chart keeps its original key.

### Tables

```
song_charts
  id            uuid pk
  song_id       uuid fk → songs (unique: one chart per song)
  body          text          -- ChordPro
  original_key  text          -- "G"
  revision      int           -- bump on every save (conflict check)
  updated_by    uuid fk → users
  updated_at    timestamptz

chart_prefs                    -- per user, never shared
  user_id       uuid
  chart_id      uuid
  transpose     smallint      -- semitones, e.g. +2
  font_size     smallint
  primary key (user_id, chart_id)
```

- **Band song:** a single chart shared by the band, edited like band notes. Edits reach bandmates as the grouped banner.
- **My Songs linked copy:** reads the band's chart. "Make my own" forks a private `song_charts` row.
- Each user's transpose and text size are saved for them only, so the band's chart stays in its original key.

## In memory: what the editor works on

```ts
type Chart = { sections: Section[] }
type Section = { label: string; lines: Line[] }          // "Verse 1"
type Line = { text: string; chords: Anchor[] }           // lyrics only
type Anchor = { at: number; chord: string }              // at = grapheme index into text
// "[G]Amazing [G7]grace" → text "Amazing grace", chords [{at:0,G},{at:8,G7}]
```

`at === text.length` means the chord comes after the last word (the trailing `[D]` in "me[D]").
Chords are stored as written ("Fmaj7/A") and split into root, type and bass only when transposing.

## Keeping chords in sync as lyrics change

The rule: each chord stays attached to the letter at its `at` index.

- **Insert** n characters at position p: every anchor with `at >= p` moves by +n. This is how "poor" pushes Em along with "wretch".
- **Delete** the range [p, q): anchors inside the range move to p, and anchors with `at >= q` move back by −(q−p).
- **Line split or join** (pressing return): anchors go with the half of the line their letter lands in.
- Use **grapheme** indices, not string length, so accented letters and emoji don't throw chords off.

**"Chords from Verse 1"** copies the chords. It doesn't link the verses, so editing verse 2 later can't change verse 1. ChordPro has no reference syntax anyway, so a copy keeps the file plain.

## Conflicts

Saves send `revision`. If the server's revision is newer, show "Mike edited this chart. Review his version / Keep mine" instead of silently overwriting (**Peak-End Rule**: don't lose someone's work). Line-level merging can come later if conflicts actually happen.

## Starting note

This is stored in the chart as a custom ChordPro directive: `{x_start_note: D4}`. Other apps ignore it without breaking. The app shows it relative to the key ("5th"), and it moves with transpose like the chords do.

## Not now

Per-line timestamps (karaoke-style syncing) would be an optional `{t: 0:42}` line in ChordPro. They aren't needed while paging is manual.
