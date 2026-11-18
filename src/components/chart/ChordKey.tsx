/**
 * A square keypad key (mono label) for chord roots / types: Tools · Chords
 * (on = ink, as Tools on Home 3) and the Other chord keypad (on = accent,
 * as Song Chart 7).
 */
import React from 'react'

export interface ChordKeyProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  on: boolean
  tone?: 'ink' | 'accent'
}

export const ChordKey: React.FC<ChordKeyProps> = ({
  on,
  tone = 'ink',
  className = 'h-11',
  children,
  type = 'button',
  ...rest
}) => (
  <button
    type={type}
    aria-pressed={on}
    className={`rounded-xl grid place-items-center px-3 font-mono font-bold text-[14px] whitespace-nowrap ${
      !on
        ? 'bg-bg-3 text-ink-2'
        : tone === 'accent'
          ? 'bg-accent text-on-accent'
          : 'bg-ink-1 text-bg-1'
    } ${className}`}
    {...rest}
  >
    {children}
  </button>
)
