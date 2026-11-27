/**
 * Starting note sheet (Sound Tools 2; DECISIONS "Starting note sheet"): one
 * octave of large keys, octave − / +, the key note tagged KEY, "‹G› chord"
 * (the song's key, transposed) and "‹D4› note". Saves as you pick; Done
 * closes. Shared by the chart reader (hold 🔈) and the editor's row.
 *
 * Works in the transposed key: `transpose` is added for display and sound and
 * taken off again before `onPick` hands back the note to store.
 */
import React, { useState } from 'react'
import { Volume2 } from 'lucide-react'
import { Button, Sheet } from '../ui'
import { Piano } from '../tools/Piano'
import { chordMidis, showChord } from '../../domain/chords'
import {
  degreeInKey,
  keyRoot,
  noteInKey,
  noteWithOctave,
} from '../../domain/chartView'
import { note as playNote, strum } from '../../services/audio/synth'

const OCTAVE_MIN = 2
const OCTAVE_MAX = 6

export const StartingNoteSheet: React.FC<{
  /** The stored note (original key), or null. */
  value: number | null
  /** The key as read now (already transposed), or null. */
  readKey: string | null
  transpose: number
  onPick: (stored: number) => void
  onClose: () => void
  at?: { x: number; y: number } | null
}> = ({ value, readKey, transpose, onPick, onClose, at }) => {
  const shown = value == null ? null : value + transpose
  const [octave, setOctave] = useState(() =>
    shown == null
      ? 4
      : Math.max(OCTAVE_MIN, Math.min(OCTAVE_MAX, Math.floor(shown / 12) - 1))
  )
  const names = Array.from({ length: 12 }, (_, pc) => noteInKey(pc, readKey))
  const degree = shown == null ? '' : degreeInKey(shown, readKey)

  return (
    <Sheet
      onClose={onClose}
      title="Starting note"
      sub="For songs that start with vocals."
      at={at}
      width={400}
      data-testid="start-note-sheet"
    >
      <div className={at ? 'p-2.5' : 'pb-1'}>
        <div className="flex items-baseline gap-3 px-1 pb-3">
          <b
            className="font-display font-extrabold text-[64px] leading-[.9] text-ink-1"
            data-testid="start-note-value"
          >
            {shown == null ? (
              '—'
            ) : (
              <>
                {noteInKey(shown, readKey).charAt(0)}
                <span className="text-[.5em] align-top">
                  {noteInKey(shown, readKey).slice(1)}
                </span>
              </>
            )}
            {shown != null && (
              <sub className="font-mono text-[18px] font-medium text-ink-3 align-baseline">
                {Math.floor(shown / 12) - 1}
              </sub>
            )}
          </b>
          <small className="text-[14px] text-ink-2">
            {shown == null ? (
              'Pick a note'
            ) : degree && readKey ? (
              <>
                <em className="not-italic font-mono text-[13px] text-chord">
                  {degree}
                </em>{' '}
                of {showChord(readKey)}
              </>
            ) : null}
          </small>
        </div>

        <div className="flex items-center gap-2.5 mb-3 px-1">
          <span className="flex-1 text-[14px] font-semibold text-ink-1">
            Octave
          </span>
          <span className="flex items-center rounded-full bg-bg-3 h-11 px-0.5">
            <button
              type="button"
              aria-label="Octave down"
              disabled={octave <= OCTAVE_MIN}
              onClick={() => setOctave(o => o - 1)}
              className="w-10 h-10 rounded-full font-bold text-[16px] text-ink-1 disabled:opacity-35"
              data-testid="start-note-octave-down"
            >
              −
            </button>
            <span
              className="min-w-[28px] text-center font-mono text-[13px] font-bold text-ink-1"
              data-testid="start-note-octave"
            >
              {octave}
            </span>
            <button
              type="button"
              aria-label="Octave up"
              disabled={octave >= OCTAVE_MAX}
              onClick={() => setOctave(o => o + 1)}
              className="w-10 h-10 rounded-full font-bold text-[16px] text-ink-1 disabled:opacity-35"
              data-testid="start-note-octave-up"
            >
              +
            </button>
          </span>
        </div>

        <Piano
          octave={octave}
          value={shown}
          keyPc={keyRoot(readKey)}
          names={names}
          onPick={midi => {
            playNote(midi)
            onPick(midi - transpose)
          }}
        />

        <div className="grid grid-cols-2 gap-2 mt-3">
          <Button
            size="lg"
            icon={<Volume2 size={18} />}
            disabled={!readKey}
            onClick={() => readKey && strum(chordMidis(readKey))}
            data-testid="start-note-chord"
          >
            {readKey ? showChord(readKey) : 'Key'} chord
          </Button>
          <Button
            variant="primary"
            size="lg"
            icon={<Volume2 size={18} />}
            disabled={shown == null}
            onClick={() => shown != null && playNote(shown)}
            data-testid="start-note-play"
          >
            {shown == null ? 'Note' : `${noteWithOctave(shown, readKey)} note`}
          </Button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full h-12 mt-2 font-bold text-[15px] text-ink-2"
          data-testid="start-note-done"
        >
          Done
        </button>
      </div>
    </Sheet>
  )
}
