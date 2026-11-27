/**
 * A chart's text: section labels, then each line as word units with the chord
 * over its letter (Song Chart 2). Sized in em from `size`, so one prop scales
 * everything. Chords hidden = "karaoke": chord rows collapse and lines tighten.
 * "Chords only" (the editor preview) lists each line's chords.
 */
import React from 'react'
import { lineSegments, type Chart } from '../../domain/chordpro'
import { showChord } from '../../domain/chords'
import { lineUnits, readChord, wordGroups } from '../../domain/chartView'

export interface ChartTextProps {
  chart: Chart
  /** Semitones (the reader's Key −/+). */
  transpose?: number
  /** The chart's original key, for spelling transposed chords. */
  chartKey?: string | null
  /** Text size in px. */
  size: number
  chords?: boolean
  mode?: 'full' | 'chords'
  /** Tap a chord (the name as read, transposed). */
  onChord?: (chord: string) => void
  className?: string
  'data-testid'?: string
}

/** Text a chords-only line keeps: spacing, bars, repeats. */
const CHORDS_ONLY_RE = /^[\s|:%/.x×\d()-]*$/

const LABEL =
  'font-mono text-[.5em] tracking-[.14em] uppercase text-ink-3 font-medium mb-[.5em] break-after-avoid'

export const ChartText: React.FC<ChartTextProps> = ({
  chart,
  transpose = 0,
  chartKey = null,
  size,
  chords = true,
  mode = 'full',
  onChord,
  className = '',
  'data-testid': testId = 'chart-text',
}) => {
  const read = (c: string) => readChord(c, transpose, chartKey)

  const chord = (name: string) => {
    const shown = showChord(read(name))
    const cls =
      'font-mono font-bold text-[.68em] text-chord leading-[1.35em] min-h-[1.35em] pr-[.35em] whitespace-nowrap text-left'
    return onChord ? (
      <button
        type="button"
        onClick={e => {
          e.stopPropagation()
          onChord(read(name))
        }}
        className={`${cls} rounded-[5px] hover:bg-bg-3 active:bg-accent active:text-on-accent`}
        aria-label={`Chord ${shown}`}
        data-testid="chart-chord"
      >
        {shown}
      </button>
    ) : (
      <b className={cls} data-testid="chart-chord">
        {shown}
      </b>
    )
  }

  return (
    <div
      className={`text-ink-1 leading-[1.2] ${className}`}
      style={{ fontSize: size }}
      data-testid={testId}
    >
      {chart.sections.map((s, si) => {
        const verbatim = s.kind === 'tab' || s.kind === 'grid'
        return (
          <section key={si} data-chart-section className="mt-[.8em] first:mt-0">
            {s.label && (
              <h4 className={LABEL} data-testid="chart-section-label">
                {s.label}
              </h4>
            )}
            {verbatim ? (
              <pre className="font-mono text-[.62em] leading-snug whitespace-pre overflow-x-auto no-scrollbar break-inside-avoid">
                {s.lines.map(l => l.text).join('\n')}
              </pre>
            ) : mode === 'chords' ? (
              s.lines
                .filter(l => l.chords.length)
                .map((l, li) => (
                  <div
                    key={li}
                    data-chart-line
                    className="flex flex-wrap gap-x-[1.1em] mb-[.25em] break-inside-avoid"
                  >
                    {[...l.chords]
                      .sort((a, b) => a.at - b.at)
                      .map((c, ci) => (
                        <span key={ci} className="text-[1.3em] inline-flex">
                          {chord(c.chord)}
                        </span>
                      ))}
                  </div>
                ))
            ) : (
              s.lines.map((l, li) => {
                const withChords = chords && l.chords.length > 0
                if (l.chords.length && CHORDS_ONLY_RE.test(l.text)) {
                  // A chords-only line ("| G  | C"): one row of chords with
                  // their spacing and bars; gone when chords are hidden.
                  if (!chords) return null
                  return (
                    <div
                      key={li}
                      data-chart-line
                      className="flex flex-wrap items-baseline whitespace-pre mb-[.35em] break-inside-avoid"
                    >
                      {lineSegments(l).map((seg, ci) => (
                        <React.Fragment key={ci}>
                          {seg.chord && chord(seg.chord)}
                          {seg.text && (
                            <span className="font-mono text-[.68em] text-ink-3">
                              {seg.text}
                            </span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  )
                }
                return (
                  <div
                    key={li}
                    data-chart-line
                    className={`flex flex-wrap items-end break-inside-avoid ${
                      withChords ? 'mb-[.35em]' : 'mb-[.15em]'
                    } ${!l.text.trim() && !withChords ? 'h-[.6em]' : ''}`}
                  >
                    {wordGroups(lineUnits(l)).map((g, gi) => (
                      <span key={gi} className="inline-flex items-end">
                        {g.map((u, ui) => (
                          <span
                            key={ui}
                            className="inline-flex flex-col whitespace-pre"
                          >
                            {withChords && u.chord && chord(u.chord)}
                            <span>{u.text || (withChords ? ' ' : '')}</span>
                          </span>
                        ))}
                      </span>
                    ))}
                  </div>
                )
              })
            )}
          </section>
        )
      })}
    </div>
  )
}
