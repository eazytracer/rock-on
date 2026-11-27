/**
 * The chart's chord viewer (Sound Tools 1; DECISIONS "Chord viewer"): a
 * centred card, "Chord n of N", ‹ › through the song's chords in first-use
 * order (already transposed), chips for each (current = orange), the diagram
 * and Play. No auto-play. × , Esc or a tap outside closes it.
 */
import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import { ChordCard } from './ChordCard'
import { showChord } from '../../domain/chords'
import { strum } from '../../services/audio/synth'

export const ChordViewer: React.FC<{
  chords: readonly string[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
}> = ({ chords, index, onIndex, onClose }) => {
  const n = chords.length
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowLeft') onIndex((index - 1 + n) % n)
      else if (e.key === 'ArrowRight') onIndex((index + 1) % n)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, n, onIndex, onClose])

  if (!n) return null
  const chord = chords[Math.min(index, n - 1)]
  return (
    <div
      className="fixed inset-0 z-[61] bg-black/55 grid place-items-center p-4"
      onMouseDown={e => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Chords in this song"
        className="w-full max-w-[360px]"
        data-testid="chord-viewer"
      >
        <ChordCard
          chord={chord}
          onPlay={strum}
          className="bg-bg-2 shadow-sheet"
          onPrev={n > 1 ? () => onIndex((index - 1 + n) % n) : undefined}
          onNext={n > 1 ? () => onIndex((index + 1) % n) : undefined}
          header={
            <div className="flex items-center w-full">
              <small
                className="flex-1 font-mono text-[11px] tracking-[.12em] uppercase text-ink-3"
                data-testid="chord-viewer-position"
              >
                Chord {index + 1} of {n}
              </small>
              <button
                type="button"
                aria-label="Close chords"
                onClick={onClose}
                className="grid place-items-center w-10 h-10 -mr-2 rounded-full text-ink-2 hover:bg-bg-3"
                data-testid="chord-viewer-close"
              >
                <X size={18} />
              </button>
            </div>
          }
        >
          <div className="flex flex-wrap justify-center gap-1.5 mb-3">
            {chords.map((c, i) => (
              <button
                key={`${c}-${i}`}
                type="button"
                onClick={() => onIndex(i)}
                aria-pressed={i === index}
                className={`h-10 min-w-[46px] px-2.5 rounded-xl font-mono font-bold text-[13px] ${
                  i === index
                    ? 'bg-accent text-on-accent'
                    : 'bg-bg-3 text-chord'
                }`}
                data-testid={`chord-viewer-chip-${i}`}
              >
                {showChord(c)}
              </button>
            ))}
          </div>
        </ChordCard>
      </div>
    </div>
  )
}
