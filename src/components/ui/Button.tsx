/**
 * Kit button (`r-btn`): pill, 44 / 52 / 60 px. design/source/kit/rock.css.
 */
import React from 'react'

type Variant = 'primary' | 'secondary' | 'outline' | 'text' | 'danger'
type Size = 'md' | 'lg' | 'xl'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent',
  secondary: 'bg-bg-3 text-ink-1',
  outline:
    'bg-transparent text-ink-1 shadow-[inset_0_0_0_1.5px_rgb(var(--border-1-rgb))]',
  text: 'bg-transparent text-ink-2 px-1.5 font-semibold',
  danger: 'bg-danger-fill text-white',
}
const SIZE: Record<Size, string> = {
  md: 'h-11 px-[18px] text-sm',
  lg: 'h-[52px] px-[22px] text-[15px]',
  xl: 'h-[60px] px-6 text-[17px] font-extrabold',
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
  icon?: React.ReactNode
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  icon,
  className = '',
  children,
  type = 'button',
  ...rest
}) => (
  <button
    type={type}
    className={`inline-flex items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap transition-transform duration-100 ease-rock active:scale-[.96] disabled:opacity-40 disabled:pointer-events-none ${VARIANT[variant]} ${SIZE[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
    {...rest}
  >
    {icon}
    {children}
  </button>
)
