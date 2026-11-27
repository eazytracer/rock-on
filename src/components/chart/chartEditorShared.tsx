/**
 * Pieces both chart editors share (desktop two-pane, phone modes): the
 * conflict banner, the starting-note row, the detected-format line and the
 * sample chart.
 */
import React, { useState } from 'react'
import { AlertTriangle, CheckCircle2, Volume2 } from 'lucide-react'
import { useToast } from '../../contexts/ToastContext'
import { useSetStartingNote } from '../../hooks/useChart'
import type { Conflict } from '../../hooks/useChartSaver'
import { errorText } from '../../services/api/errors'
import type { ChartFormat } from '../../domain/chordpro'
import { noteWithOctave } from '../../domain/chartView'
import { note as playNote } from '../../services/audio/synth'
import { Button } from '../ui'
import { StartingNoteSheet } from './StartingNoteSheet'
import { createLogger } from '../../utils/logger'

const log = createLogger('ChartEditor')

export const ConflictBanner: React.FC<{
  conflict: Conflict
  busy: boolean
  onTheirs: () => void
  onKeep: () => void
}> = ({ conflict, busy, onTheirs, onKeep }) => (
  <div
    className="flex flex-wrap items-center gap-3 rounded-xl bg-warn/15 px-3.5 py-3"
    role="alert"
    data-testid="chart-conflict"
  >
    <AlertTriangle size={18} className="text-warn shrink-0" />
    <p className="flex-1 min-w-[200px] text-[13.5px] text-ink-1">
      <b>{conflict.name} saved a newer chart while you were editing.</b> Yours
      isn&apos;t lost.
    </p>
    <button
      type="button"
      onClick={onTheirs}
      className="h-10 px-4 rounded-full bg-bg-3 text-ink-1 font-bold hover:bg-bg-4"
      data-testid="chart-conflict-theirs"
    >
      Show theirs
    </button>
    <button
      type="button"
      disabled={busy}
      onClick={onKeep}
      className="h-10 px-4 rounded-full bg-accent text-on-accent font-bold disabled:opacity-60"
      data-testid="chart-conflict-keep"
    >
      Keep mine
    </button>
  </div>
)

const FORMAT_LABEL: Record<ChartFormat, string> = {
  'chords-over-lyrics': 'Chords over lyrics',
  chordpro: 'ChordPro',
  plain: 'Lyrics only',
}

/** "Chords over lyrics detected · Sections 4 · chords 22". */
export const DetectedLine: React.FC<{
  format: ChartFormat
  sections: number
  chords: number
}> = ({ format, sections, chords }) => (
  <p
    className="flex items-start gap-2 text-[13px] leading-snug text-ink-2"
    data-testid="chart-editor-detected"
    data-format={format}
  >
    <CheckCircle2 size={16} className="text-success shrink-0 mt-px" />
    <span>
      <b className="text-ink-1">{FORMAT_LABEL[format]} detected.</b> Sections{' '}
      {sections} · chords {chords}.
      {format === 'chords-over-lyrics'
        ? ' Each chord rides the letter under it.'
        : format === 'plain'
          ? ' Add chords after, or paste chord lines above the words.'
          : ''}
    </span>
  </p>
)

/** The starting-note row: the note, Hear it, and the piano sheet. */
export const StartingNoteRow: React.FC<{
  songId: string
  value: number | null
  chartKey: string | null
  desktop: boolean
}> = ({ songId, value, chartKey, desktop }) => {
  const { showToast } = useToast()
  const { setStartingNote } = useSetStartingNote(songId)
  const [open, setOpen] = useState<{ x: number; y: number } | null | false>(
    false
  )
  return (
    <div data-testid="chart-editor-start-note">
      <p className="font-mono text-[10.5px] tracking-[.12em] uppercase text-ink-3 mb-1.5">
        Starting note{' '}
        <em className="not-italic normal-case tracking-normal font-sans text-[12px]">
          for songs that open on vocals
        </em>
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <b
          className="font-mono text-[17px] text-ink-1 min-w-[44px]"
          data-testid="chart-editor-start-note-value"
        >
          {value == null ? 'None' : noteWithOctave(value, chartKey)}
        </b>
        <Button
          icon={<Volume2 size={16} />}
          disabled={value == null}
          onClick={() => value != null && playNote(value)}
          data-testid="chart-editor-start-note-hear"
        >
          Hear it
        </Button>
        <Button
          onClick={e => {
            const r = e.currentTarget.getBoundingClientRect()
            setOpen(desktop ? { x: r.left, y: r.bottom + 8 } : null)
          }}
          data-testid="chart-editor-start-note-pick"
        >
          {value == null ? 'Set…' : 'Change…'}
        </Button>
      </div>
      {open !== false && (
        <StartingNoteSheet
          value={value}
          readKey={chartKey}
          transpose={0}
          at={open}
          onPick={stored =>
            setStartingNote(stored).catch(err => {
              log.error('Starting note failed', err)
              showToast(errorText(err), 'error')
            })
          }
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

/** "Try a sample": an original chart (not a real song) in chords over lyrics. */
export const SAMPLE_CHART = `[Verse 1]
G              C           G
Porch light burning on the gravel road
Em            C                D
Engine ticking while the night goes cold
G             C            G
Radio's playing what we used to know
Em          D           G
Turn it up and let it go

[Chorus]
C            G
Hold the line, hold the line
Em             D
We were never running out of time
C            G
Hold the line, hold it tight
Em          D          G
Sing it back into the night

[Verse 2]
Coffee's gone and the stars are low
Every mile is a song we know
Windows down and the town asleep
All the promises we mean to keep
`
