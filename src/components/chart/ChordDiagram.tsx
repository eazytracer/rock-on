/**
 * Chord diagram (SVG fretboard): six strings, five frets, × muted, ○ open,
 * dots, a barre bar, the nut at fret 1 or "3fr" beside the first fret shown.
 * Geometry from design/demo/screens/Sound Tools.html `diagram`.
 */
import React from 'react'
import { baseFret, type ChordShape } from '../../domain/chords'

const X0 = 36 // room for the "3fr" label left of a barre
const Y0 = 30
const SW = 22 // string spacing
const FH = 26 // fret height
const FRETS = 5
const x = (i: number) => X0 + i * SW

export interface ChordDiagramProps {
  /** null → "No diagram yet". */
  shape: ChordShape | null
  /** Accessible name, e.g. "G". */
  label: string
  /** Width (the SVG scales); default 200 px as the design's card. */
  className?: string
}

export const ChordDiagram: React.FC<ChordDiagramProps> = ({
  shape,
  label,
  className = 'w-[200px]',
}) => {
  if (!shape)
    return (
      <div
        className="text-[13px] text-ink-3 py-[30px]"
        data-testid="chord-diagram-none"
      >
        No diagram yet
      </div>
    )
  const { frets, barre } = shape
  const base = baseFret(frets)
  const y = (fret: number) => Y0 + (fret - base + 0.5) * FH
  const barreFrom = barre ? frets.findIndex(f => f === barre) : -1
  const bar = barre != null && barre >= base && barreFrom >= 0 ? barre : null

  return (
    <svg
      viewBox="0 0 160 170"
      role="img"
      aria-label={`${label} chord diagram`}
      data-testid="chord-diagram"
      className={`h-auto fill-none stroke-ink-3 ${className}`}
      strokeWidth={1.6}
    >
      {frets.map((_, i) => (
        <line key={`s${i}`} x1={x(i)} y1={Y0} x2={x(i)} y2={Y0 + FRETS * FH} />
      ))}
      {Array.from({ length: FRETS + 1 }, (_, n) => (
        <line
          key={`f${n}`}
          x1={x(0)}
          y1={Y0 + n * FH}
          x2={x(frets.length - 1)}
          y2={Y0 + n * FH}
          strokeWidth={n === 0 && base === 1 ? 5 : undefined}
        />
      ))}
      {base > 1 && (
        <text
          x={X0 - 12}
          y={y(base) + 4}
          textAnchor="end"
          className="fill-ink-2 stroke-none font-mono text-[11px] font-medium"
        >
          {base}fr
        </text>
      )}
      {bar != null && (
        <rect
          x={x(barreFrom) - 8}
          y={y(bar) - 8}
          width={x(frets.length - 1) - x(barreFrom) + 16}
          height={16}
          rx={8}
          className="fill-accent stroke-none"
        />
      )}
      {frets.map((f, i) =>
        f < 0 ? (
          <text
            key={`m${i}`}
            x={x(i)}
            y={Y0 - 10}
            textAnchor="middle"
            className="fill-ink-3 stroke-none text-[15px] font-semibold"
          >
            ×
          </text>
        ) : f === 0 ? (
          <circle
            key={`o${i}`}
            cx={x(i)}
            cy={Y0 - 14}
            r={5}
            className="stroke-ink-1"
            strokeWidth={1.8}
          />
        ) : f === bar ? null : (
          <circle
            key={`d${i}`}
            cx={x(i)}
            cy={y(f)}
            r={8}
            className="fill-accent stroke-none"
          />
        )
      )}
    </svg>
  )
}
