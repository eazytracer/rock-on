/**
 * Context mark (`r-ctx i`): a rounded tile with the band's mark (initials in
 * a colour and lettering, or a symbol; Band Identity), or the user's initial
 * on the indigo for Personal. With no `mark` it's the band's initials on
 * orange.
 */
import React, { useEffect } from 'react'
import { markInitials } from '../../domain/marks'
import {
  loadLetteringFonts,
  markColor,
  markLettering,
  markSymbol,
  type BandMarkValue,
} from './bandMarkPalette'

interface BandMarkProps {
  name: string
  mark?: BandMarkValue | null
  personal?: boolean
  size?: number
  className?: string
  'data-testid'?: string
}

export const BandMark: React.FC<BandMarkProps> = ({
  name,
  mark,
  personal = false,
  size = 28,
  className = '',
  'data-testid': testId,
}) => {
  const lettering = markLettering(mark?.lettering)
  const symbol = mark?.kind === 'symbol' ? markSymbol(mark.symbol) : null
  useEffect(() => {
    if (!personal && !symbol && lettering.google)
      loadLetteringFonts([lettering.key])
  }, [personal, symbol, lettering])

  const color = personal
    ? { bg: '#7c86f5', fg: '#0b0d2b' }
    : markColor(mark?.color)
  const text = personal
    ? name.trim().charAt(0).toUpperCase()
    : mark?.initials || markInitials(name)
  const Icon = symbol?.icon

  return (
    <span
      aria-hidden
      data-testid={testId}
      data-mark-kind={personal ? 'personal' : (mark?.kind ?? 'initials')}
      className={`grid place-items-center shrink-0 overflow-hidden leading-none ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.29),
        background: color.bg,
        color: color.fg,
        fontFamily: personal ? undefined : lettering.family,
        fontWeight: personal ? 800 : lettering.weight,
        fontSize: Math.max(10, Math.round(size * 0.42 * lettering.scale)),
        textTransform: lettering.upper ? 'uppercase' : undefined,
      }}
    >
      {Icon ? (
        <Icon
          strokeWidth={2.2}
          style={{ width: size * 0.52, height: size * 0.52 }}
        />
      ) : (
        text
      )}
    </span>
  )
}
