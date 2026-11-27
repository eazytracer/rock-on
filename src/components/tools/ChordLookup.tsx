/**
 * Tools · Chords (Tools on Home screen 3; desktop `chords`): root keys,
 * quality keys and the shared ChordCard. Controlled by `chord` (the page
 * keeps it in `?chord=`); Play hands the notes to `onPlay`.
 */
import React from 'react'
import {
  CHORD_ROOTS,
  LOOKUP_QUALITIES,
  canonicalQuality,
  parseChord,
  pitchClass,
  showChord,
} from '../../domain/chords'
import { ChordCard } from '../chart/ChordCard'
import { ChordKey } from '../chart/ChordKey'

export interface ChordLookupProps {
  /** Current chord, e.g. "G" or "Bbm7". */
  chord: string
  onChange: (chord: string) => void
  onPlay: (midis: number[]) => void
}

export const ChordLookup: React.FC<ChordLookupProps> = ({
  chord,
  onChange,
  onPlay,
}) => {
  const parsed = parseChord(chord) ?? { root: 'G', quality: '', bass: null }
  const rootPc = pitchClass(parsed.root)
  const quality = canonicalQuality(parsed.quality)
  const root = CHORD_ROOTS.find(r => pitchClass(r) === rootPc) ?? parsed.root

  return (
    <div data-testid="chord-lookup">
      <div
        className="grid grid-cols-6 md:grid-cols-12 gap-1.5 mb-2"
        role="group"
        aria-label="Root"
      >
        {CHORD_ROOTS.map(r => (
          <ChordKey
            key={r}
            on={pitchClass(r) === rootPc}
            onClick={() => onChange(r + quality)}
            className="h-11 px-0"
            data-testid={`chords-root-${r}`}
          >
            {showChord(r)}
          </ChordKey>
        ))}
      </div>
      <div className="flex gap-1.5 mb-3" role="group" aria-label="Type">
        {LOOKUP_QUALITIES.map(q => (
          <ChordKey
            key={q.label}
            on={q.value === quality}
            onClick={() => onChange(root + q.value)}
            className="h-11"
            data-testid={`chords-quality-${q.value || 'major'}`}
          >
            {q.label}
          </ChordKey>
        ))}
      </div>
      <div className="mx-auto max-w-[340px]">
        <ChordCard chord={chord} onPlay={onPlay} />
      </div>
    </div>
  )
}
