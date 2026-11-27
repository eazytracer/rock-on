/**
 * Chord card: the name (in --chord), the diagram, the fingering and Play.
 * One card for Tools · Chords, the chart's chord viewer and the desktop
 * "Chords in this song" panel.
 *
 * Sound is the caller's: Play calls `onPlay` with the MIDI notes to strum
 * (low → high), so this stays free of the audio services.
 */
import React from 'react'
import { AudioLines, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../ui'
import {
  chordMidis,
  chordShape,
  fingering,
  showChord,
} from '../../domain/chords'
import { ChordDiagram } from './ChordDiagram'

export interface ChordCardProps {
  /** Stored (ASCII) or glyph chord name: "G7", "Bb", "F#m/C#". */
  chord: string
  /** Called by Play with the notes to strum. */
  onPlay: (midis: number[]) => void
  /** Above the name, e.g. the viewer's "CHORD 2 OF 5" row with its ×. */
  header?: React.ReactNode
  /** Viewer stepping: ‹ › either side of the name when given. */
  onPrev?: () => void
  onNext?: () => void
  /** Between the fingering and Play, e.g. the viewer's chord chips. */
  children?: React.ReactNode
  /** Surface override (default: the kit card, bg-2). */
  className?: string
  'data-testid'?: string
}

const NavButton: React.FC<{
  label: string
  onClick: () => void
  testId: string
  children: React.ReactNode
}> = ({ label, onClick, testId, children }) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    data-testid={testId}
    className="grid place-items-center w-[52px] h-[52px] rounded-full bg-bg-3 text-ink-1 shrink-0 active:scale-[.96] transition-transform duration-100 ease-rock [&>svg]:w-[22px] [&>svg]:h-[22px]"
  >
    {children}
  </button>
)

export const ChordCard: React.FC<ChordCardProps> = ({
  chord,
  onPlay,
  header,
  onPrev,
  onNext,
  children,
  className = 'bg-bg-2 shadow-group',
  'data-testid': testId = 'chord-card',
}) => {
  const shape = chordShape(chord)
  const shown = showChord(chord)
  const name = (
    <b
      className="font-mono text-[34px] leading-tight font-bold text-chord"
      data-testid="chord-card-name"
    >
      {shown}
    </b>
  )
  const stepping = onPrev || onNext

  return (
    <div
      data-testid={testId}
      className={`flex flex-col items-center rounded-[24px] px-4 pt-3 pb-4 ${className}`}
    >
      {header}
      {stepping ? (
        <div className="flex items-center justify-between w-full mt-0.5 mb-1">
          {onPrev ? (
            <NavButton
              label="Previous chord"
              onClick={onPrev}
              testId="chord-viewer-prev"
            >
              <ChevronLeft />
            </NavButton>
          ) : (
            <span className="w-[52px]" />
          )}
          {name}
          {onNext ? (
            <NavButton
              label="Next chord"
              onClick={onNext}
              testId="chord-viewer-next"
            >
              <ChevronRight />
            </NavButton>
          ) : (
            <span className="w-[52px]" />
          )}
        </div>
      ) : (
        name
      )}
      <ChordDiagram shape={shape} label={shown} />
      {shape && (
        <div
          className="font-mono text-[13px] tracking-[.12em] text-ink-2 mt-0.5 mb-3"
          data-testid="chord-card-fingering"
        >
          {fingering(shape.frets)}
        </div>
      )}
      {children}
      <Button
        variant="primary"
        size="lg"
        fullWidth
        icon={<AudioLines className="w-[18px] h-[18px]" />}
        onClick={() => onPlay(chordMidis(chord))}
        data-testid="chord-play"
      >
        Play {shown}
      </Button>
    </div>
  )
}
