import React, { ReactNode, ButtonHTMLAttributes } from 'react'

interface TouchButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  fullWidth?: boolean
  loading?: boolean
  children: ReactNode
}

export const TouchButton: React.FC<TouchButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled,
  className = '',
  children,
  ...props
}) => {
  const baseClasses = [
    'relative inline-flex items-center justify-center',
    'font-medium rounded-lg transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-offset-2',
    'active:scale-95 touch-manipulation',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100'
  ]

  const variantClasses = {
    primary: [
      'bg-energy-orange text-white',
      'hover:bg-energy-orange/90 focus:ring-energy-orange',
      'active:bg-energy-orange/80'
    ],
    secondary: [
      'bg-smoke-white text-steel-gray border border-steel-gray',
      'hover:bg-steel-gray hover:text-smoke-white focus:ring-steel-gray',
      'active:bg-steel-gray/80'
    ],
    danger: [
      'bg-amp-red text-white',
      'hover:bg-amp-red/90 focus:ring-amp-red',
      'active:bg-amp-red/80'
    ],
    ghost: [
      'bg-transparent text-steel-gray border border-steel-gray/30',
      'hover:bg-steel-gray/10 focus:ring-steel-gray',
      'active:bg-steel-gray/20'
    ]
  }

  const sizeClasses = {
    sm: 'min-h-[44px] px-3 py-2 text-sm',
    md: 'min-h-[48px] px-4 py-3 text-base',
    lg: 'min-h-[52px] px-6 py-4 text-lg',
    xl: 'min-h-[56px] px-8 py-4 text-xl'
  }

  const widthClasses = fullWidth ? 'w-full' : ''

  const allClasses = [
    ...baseClasses,
    ...variantClasses[variant],
    sizeClasses[size],
    widthClasses,
    className
  ].join(' ')

  return (
    <button
      className={allClasses}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-3 h-5 w-5"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  )
}