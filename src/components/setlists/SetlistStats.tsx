/**
 * A set's numbers, runtime first: a clock and the minutes in accent (warn when
 * over the show slot, with "of 45" beside), then songs and retunes, each with a
 * small icon. On phones songs and retunes drop their word (icon + number) so
 * the line stays on one row. Used by the editor's header and the index.
 */
import React from 'react'
import { Clock, Music2 } from 'lucide-react'

/** The kit's tuning fork (design/source/kit/rock.js `fork`). */
export const ForkIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 15,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    className={className}
    aria-hidden
  >
    <path d="M8 3v7a4 4 0 0 0 8 0V3M12 14v7" />
  </svg>
)

export interface SetlistStatsProps {
  songs: number
  minutes: number
  retunes: number
  /** The show's slot in minutes; shows "of 45" and warns when over. */
  slot?: number | null
  /** Clock time the set ends ("9:20"), shown instead of minutes on the timeline. */
  ends?: string | null
  size?: 'lg' | 'sm'
  className?: string
}

export const SetlistStats: React.FC<SetlistStatsProps> = ({
  songs,
  minutes,
  retunes,
  slot,
  ends,
  size = 'lg',
  className = '',
}) => {
  const lg = size === 'lg'
  const over = !!slot && minutes > slot
  const icon = lg ? 16 : 14
  return (
    <div
      className={`flex flex-wrap items-center font-mono ${lg ? 'gap-x-4 md:gap-x-5 gap-y-1.5 text-[13.5px]' : 'gap-x-3 md:gap-x-3.5 gap-y-1 text-[12.5px]'} ${className}`}
      data-testid="setlist-totals"
    >
      <span
        className={`flex items-center gap-1.5 ${over ? 'text-warn' : 'text-accent'}`}
        data-testid="setlist-runtime"
      >
        <Clock size={lg ? 18 : 15} strokeWidth={2.25} />
        {ends ? (
          <>
            <span className="text-ink-3">ends</span>{' '}
            <b className={lg ? 'text-[20px] leading-none' : 'text-[15px]'}>
              {ends}
            </b>
          </>
        ) : (
          <>
            <b className={lg ? 'text-[20px] leading-none' : 'text-[15px]'}>
              {minutes}
            </b>{' '}
            {slot ? (
              <span
                className={over ? 'text-warn' : 'text-ink-3'}
                data-testid="setlist-slot"
                data-over={over || undefined}
              >
                of {slot} min
              </span>
            ) : (
              <span className="text-ink-3">min</span>
            )}
          </>
        )}
      </span>
      <span
        className="flex items-center gap-1.5 text-ink-2"
        title={`${songs} ${songs === 1 ? 'song' : 'songs'}`}
      >
        <Music2 size={icon} className="text-ink-3" />
        <b className="text-ink-1">{songs}</b>{' '}
        <span className="hidden md:inline text-ink-3">
          {songs === 1 ? 'song' : 'songs'}
        </span>
      </span>
      <span
        className={`flex items-center gap-1.5 ${retunes ? 'text-warn' : 'text-ink-3'}`}
        title={`${retunes} ${retunes === 1 ? 'retune' : 'retunes'}`}
      >
        <ForkIcon size={icon} />
        <b className={retunes ? '' : 'text-ink-2'}>{retunes}</b>{' '}
        <span
          className={`hidden md:inline ${retunes ? 'text-warn/80' : 'text-ink-3'}`}
        >
          {retunes === 1 ? 'retune' : 'retunes'}
        </span>
      </span>
    </div>
  )
}
