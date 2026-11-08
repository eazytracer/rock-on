/**
 * Kit filter chip (`r-chip`): 38 px, outlined → filled when on.
 */
import React from 'react'

export interface ChipProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  on?: boolean
  icon?: React.ReactNode
}

export const Chip: React.FC<ChipProps> = ({
  on = false,
  icon,
  className = '',
  children,
  type = 'button',
  ...rest
}) => (
  <button
    type={type}
    aria-pressed={on}
    className={`inline-flex items-center gap-[7px] h-[38px] px-[13px] rounded-full text-[13.5px] font-semibold whitespace-nowrap ${
      on
        ? 'bg-ink-1 text-bg-1'
        : 'text-ink-2 shadow-[inset_0_0_0_1.5px_rgb(var(--border-1-rgb))]'
    } ${className}`}
    {...rest}
  >
    {icon}
    {children}
  </button>
)
