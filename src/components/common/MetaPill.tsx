/**
 * MetaPill — unified metadata chip for Key / BPM / Duration / Tuning across
 * the app.
 *
 * Pill shape is always compact (icon + bold value). An optional uppercase
 * caption renders ABOVE the pill when `size="md"`; at `size="sm"` the label
 * is hidden entirely and conveyed via a hover tooltip.
 *
 * Tuning uses the accent variant (colored per the tuning registry).
 * Key / BPM / Duration use neutral styling.
 *
 * Design reference:
 * `.claude/specifications/2025-10-22T14:01_design-style-guide.md` §
 * "2026-04-22 Update"
 */

import React from 'react'
import { Music, Activity, Clock, Guitar } from 'lucide-react'
import { tuningColor, tuningLabel } from '../../utils/tunings'

export interface MetaPillProps {
  icon: React.ReactNode
  /** Full-word label (e.g. "Key", "BPM", "Duration", "Tuning"). */
  label: string
  /** Displayed value (e.g. "Em", "86", "4:18", "Drop D"). */
  value: string
  /**
   * If provided, renders the accent (colored) variant using this hex color.
   * Used by the Tuning pill. Omit for neutral pills.
   */
  accentColor?: string
  /**
   * `md` (default) renders a caption above the pill.
   * `sm` renders just the pill with a hover tooltip.
   */
  size?: 'sm' | 'md'
  /** Full-width variant (for stacked sidebars like the TV session rail). */
  block?: boolean
  /** data-testid passthrough. */
  'data-testid'?: string
}

export const MetaPill: React.FC<MetaPillProps> = ({
  icon,
  label,
  value,
  accentColor,
  size = 'md',
  block = false,
  'data-testid': testId,
}) => {
  const hasAccent = Boolean(accentColor)
  const padX = size === 'sm' ? 'px-2' : 'px-2.5'
  const padY = size === 'sm' ? 'py-0.5' : 'py-1'
  const txt = size === 'sm' ? 'text-[11px]' : 'text-xs'

  const bg = hasAccent ? `${accentColor}22` : '#1a1a1a'
  const border = hasAccent ? `${accentColor}66` : '#2a2a2a'
  const iconColor = hasAccent ? accentColor! : '#707070'
  const valueColor = hasAccent ? accentColor! : '#ffffff'

  const showCaption = size !== 'sm'

  const pill = (
    <span
      className={`inline-flex items-center gap-1.5 ${padX} ${padY} rounded-full ${txt} font-medium ${
        block ? 'w-full justify-start' : ''
      }`}
      style={{
        backgroundColor: bg,
        border: `1px solid ${border}`,
      }}
      title={showCaption ? undefined : `${label}: ${value}`}
      data-testid={testId}
    >
      <span style={{ color: iconColor }} className="flex-shrink-0">
        {icon}
      </span>
      <span style={{ color: valueColor }} className="font-bold">
        {value}
      </span>
    </span>
  )

  if (!showCaption) return pill

  return (
    <div
      className={`flex flex-col items-start gap-0.5 ${block ? 'w-full' : ''}`}
    >
      <span
        className="text-[9px] uppercase tracking-wider px-1"
        style={{ color: hasAccent ? accentColor : '#707070' }}
      >
        {label}
      </span>
      {pill}
    </div>
  )
}

// ---- Convenience helpers ----

export const KeyPill: React.FC<{
  value: string
  size?: 'sm' | 'md'
  block?: boolean
  'data-testid'?: string
}> = ({ value, size, block, 'data-testid': testId }) => (
  <MetaPill
    icon={<Music size={12} />}
    label="Key"
    value={value}
    size={size}
    block={block}
    data-testid={testId}
  />
)

export const BpmPill: React.FC<{
  value: string
  size?: 'sm' | 'md'
  block?: boolean
  'data-testid'?: string
}> = ({ value, size, block, 'data-testid': testId }) => (
  <MetaPill
    icon={<Activity size={12} />}
    label="BPM"
    value={value}
    size={size}
    block={block}
    data-testid={testId}
  />
)

export const DurationPill: React.FC<{
  value: string
  size?: 'sm' | 'md'
  block?: boolean
  'data-testid'?: string
}> = ({ value, size, block, 'data-testid': testId }) => (
  <MetaPill
    icon={<Clock size={12} />}
    label="Duration"
    value={value}
    size={size}
    block={block}
    data-testid={testId}
  />
)

export const TuningPill: React.FC<{
  tuning: string
  size?: 'sm' | 'md'
  block?: boolean
  'data-testid'?: string
}> = ({ tuning, size, block, 'data-testid': testId }) => {
  const color = tuningColor(tuning)
  return (
    <MetaPill
      icon={<Guitar size={12} />}
      label="Tuning"
      value={tuningLabel(tuning)}
      accentColor={color}
      size={size}
      block={block}
      data-testid={testId}
    />
  )
}
