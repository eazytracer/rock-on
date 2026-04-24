/**
 * FooterNextPreview — shared next-song preview block for the practice
 * session viewer footer (tablet landscape / tablet portrait / mobile).
 *
 * Layout: `[ NEXT ] Song Title [TuningPill] [pulsing dot + CHANGE badge]`
 * centered. Mobile compact variant drops the NEXT caption and the "CHANGE"
 * text (the pulsing dot remains with aria-label + tooltip for a11y).
 */

import React from 'react'
import { TuningPill } from '../common/MetaPill'
import { tuningColor } from '../../utils/tunings'
import type { Song } from '../../models/Song'

export interface FooterNextPreviewProps {
  nextSong: Song | null | undefined
  /** Current song's tuning — used to detect tuning changes. */
  currentTuning: string | undefined
  /** Mobile variant: drops the "NEXT" caption and "CHANGE" text. */
  compact?: boolean
  'data-testid'?: string
}

export const FooterNextPreview: React.FC<FooterNextPreviewProps> = ({
  nextSong,
  currentTuning,
  compact = false,
  'data-testid': testId,
}) => {
  if (!nextSong) {
    return (
      <div
        className="flex-1 text-center text-xs text-[#505050]"
        data-testid={testId}
      >
        Last song
      </div>
    )
  }

  const nextTuning = nextSong.guitarTuning ?? 'Standard'
  const currentTuningVal = currentTuning ?? 'Standard'
  const changed = currentTuningVal !== nextTuning
  const changeColor = tuningColor(nextTuning)

  return (
    <div
      className="flex-1 min-w-0 px-2 flex items-center justify-center gap-2"
      data-testid={testId}
    >
      {!compact && (
        <span className="text-[9px] uppercase tracking-wider text-[#505050] flex-shrink-0">
          Next
        </span>
      )}
      <span
        className={`${compact ? 'text-[11px]' : 'text-xs'} text-white font-medium truncate min-w-0`}
      >
        {nextSong.title}
      </span>
      <TuningPill tuning={nextTuning} size="sm" />
      {changed && (
        <span
          className="flex items-center gap-1 flex-shrink-0"
          title="Tuning change"
          aria-label="Tuning change from current song"
        >
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: changeColor }}
          />
          {!compact && (
            <span className="text-[9px] font-semibold uppercase tracking-wider text-amber-400">
              Change
            </span>
          )}
        </span>
      )}
    </div>
  )
}

export default FooterNextPreview
