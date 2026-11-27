/**
 * Kit tuning pill (`r-tp`): tinted fill, label in the tuning colour. Colour and
 * name, always. Colours resolve through CSS variables, so light theme works.
 */
import React from 'react'
import { tuningColor, tuningShortLabel } from '../../utils/tunings'

export interface TuningPillProps {
  tuning: string | null | undefined
  /** Custom tuning colour (hex) when the tuning isn't a built-in. */
  color?: string | null
  size?: 'sm' | 'md' | 'lg'
}

const SIZE = {
  sm: 'h-5 px-[7px] text-[10px]',
  md: 'h-6 px-[9px] text-[11.5px]',
  lg: 'h-7 px-[11px] text-[12.5px]',
}

export const TuningPill: React.FC<TuningPillProps> = ({
  tuning,
  color,
  size = 'md',
}) => {
  const c = color || tuningColor(tuning)
  return (
    <span
      data-testid="tuning-pill"
      className={`inline-flex items-center rounded-full font-mono font-bold tracking-[.03em] whitespace-nowrap ${SIZE[size]}`}
      style={{
        background: `color-mix(in oklch, ${c} 16%, var(--bg-2))`,
        color: c,
      }}
    >
      {tuningShortLabel(tuning)}
    </span>
  )
}
