/**
 * Mock data for the /dev/ui-preview route.
 *
 * All data is fake and local — no repository or database calls. The preview
 * route is a design sandbox only and must not touch real bands/songs.
 */

export interface MockSong {
  id: string
  title: string
  artist: string
  durationSeconds: number
  key?: string
  tuning?: string
  bpm?: number
  initials: string
  avatarColor: string
  notes?: string
  referenceLinks?: Array<{ icon: string; url: string; description: string }>
}

export const MOCK_SONGS: MockSong[] = [
  {
    id: 's1',
    title: 'Wonderwall',
    artist: 'Oasis',
    durationSeconds: 258,
    key: 'Em',
    tuning: 'Standard',
    bpm: 86,
    initials: 'WW',
    avatarColor: '#7c3aed',
    notes: [
      '## Overview',
      'Capo on 2nd fret. Strum pattern: D-D-U-U-D-U throughout verses.',
      '',
      '## Intro (8 bars)',
      '| Em7 | G | D/F# | A7sus4 |',
      '| Em7 | G | D/F# | A7sus4 |',
      '',
      '- Acoustic guitar lead, clean tone',
      '- Electric builds gradually during the 3rd repeat',
      '- Kick + hi-hat only until bar 6',
      '',
      '## Verse (16 bars)',
      'Em7 — G — D/F# — A7sus4  *(loop x4)*',
      '',
      '**Dynamics:**',
      '- Start soft, drums on hi-hat only',
      '- Vocal entry on bar 3',
      '- Bass enters on bar 9',
      '- Electric fills on bars 13–16',
      '',
      '## Pre-chorus',
      'C9 — D — Em7 — G',
      '',
      '- Vocal harmony enters on second half',
      '- Drums transition to full kit with the C9',
      '- Crash on the lift into the chorus',
      '',
      '## Chorus',
      'C — D — Em7 — C — D — G',
      '',
      '- All harmonies in, full band',
      '- Guitar solo layered under second chorus only',
      '- Keys hold pad chords, no melody',
      '',
      '## Bridge',
      '- 4 bars of Em7 → G → D/F# → A7sus4 (back to verse feel)',
      '- Drop out everything except vocals and acoustic',
      '- Build back over 4 bars; snare rolls in at bar 3',
      '- Full band slam on the return to chorus',
      '',
      '## Solo (8 bars)',
      'Same progression as verse. **Sing the melody on the guitar** — stay close to the recording, no loose improv.',
      '',
      '## Final chorus',
      'Same as chorus x2, **no fade**. Big, deliberate ending on Em7.',
      '',
      '## Tuning / capo',
      '- Capo 2, standard tuning',
      '- No tuning change from previous song',
      '- Double-check A7sus4 voicing: open A, 2nd fret D+G, open B+high-E',
      '',
      '## Cues',
      '- **Singer** → nod for bridge entry',
      '- **Drummer** → rim clicks first verse only',
      '- **Bassist** → slide into verse 3',
      '- **Keys** → pad only, no melody',
      '',
      '## Things to keep working on',
      '- Transition into bridge (rushed last time)',
      '- Backing harmony blend on chorus',
      '- Dynamics in pre-chorus (still too loud)',
      '- Solo phrasing — match the record',
    ].join('\n'),
  },
  {
    id: 's2',
    title: 'Champagne Supernova',
    artist: 'Oasis',
    durationSeconds: 447,
    key: 'A',
    tuning: 'Drop D',
    bpm: 80,
    initials: 'CS',
    avatarColor: '#3b82f6',
    notes:
      '## Tuning check before start\nDrop D — low E to D\n\n## Structure\n- Long intro, no drums til bar 9\n- Build slowly\n- Solo uses slide from 5th fret',
  },
  {
    id: 's3',
    title: 'Black',
    artist: 'Pearl Jam',
    durationSeconds: 343,
    key: 'E',
    tuning: 'Standard',
    bpm: 82,
    initials: 'BL',
    avatarColor: '#ef4444',
    notes: 'Dynamics! Start quiet, let it build. Outro is freeform.',
  },
  {
    id: 's4',
    title: 'Creep',
    artist: 'Radiohead',
    durationSeconds: 239,
    key: 'G',
    tuning: 'Drop D',
    bpm: 92,
    initials: 'CR',
    avatarColor: '#f59e0b',
    notes:
      "## Chords\nG - B - C - Cm\n\nGuitar kicks crunch on \u201CI don't belong here\u201D",
  },
  {
    id: 's5',
    title: 'Kashmir',
    artist: 'Led Zeppelin',
    durationSeconds: 515,
    key: 'D',
    tuning: 'DADGAD',
    bpm: 82,
    initials: 'KM',
    avatarColor: '#10b981',
    notes: 'DADGAD — retune from standard. Lock the groove with bass.',
  },
  {
    id: 's6',
    title: 'Plush',
    artist: 'Stone Temple Pilots',
    durationSeconds: 314,
    key: 'G',
    tuning: 'Half-step down',
    bpm: 70,
    initials: 'PL',
    avatarColor: '#14b8a6',
    notes: 'Half-step down. Watch for tempo drift in verse 2.',
  },
  {
    id: 's7',
    title: 'Heart-Shaped Box',
    artist: 'Nirvana',
    durationSeconds: 281,
    key: 'A',
    tuning: 'Drop D',
    bpm: 100,
    initials: 'HB',
    avatarColor: '#3b82f6',
  },
  {
    id: 's8',
    title: 'Sober',
    artist: 'Tool',
    durationSeconds: 306,
    key: 'D',
    tuning: 'Drop D',
    bpm: 76,
    initials: 'SB',
    avatarColor: '#3b82f6',
  },
]

/** Small curated setlist used by the tuning treatments demo. */
export const MOCK_SETLIST = MOCK_SONGS.slice(0, 8)

/** Current-song + next-song pair for the practice viewer previews. */
export const MOCK_CURRENT_INDEX = 0
