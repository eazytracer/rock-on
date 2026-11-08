/**
 * Kit icon button (`r-ib`): 44 px round, optional badge dot. Requires a label.
 */
import React from 'react'

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string
  badge?: boolean
}

export const IconButton: React.FC<IconButtonProps> = ({
  badge = false,
  className = '',
  children,
  type = 'button',
  ...rest
}) => (
  <button
    type={type}
    className={`relative grid place-items-center w-11 h-11 rounded-full bg-bg-3 text-ink-1 shrink-0 ${className}`}
    {...rest}
  >
    {children}
    {badge && (
      <span className="absolute right-[9px] top-[9px] w-[9px] h-[9px] rounded-full bg-accent ring-2 ring-bg-3" />
    )}
  </button>
)
