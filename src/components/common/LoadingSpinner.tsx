import React from 'react'

interface LoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  color?: 'primary' | 'secondary' | 'white' | 'gray'
  centered?: boolean
  text?: string
  className?: string
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'primary',
  centered = false,
  text,
  className = '',
}) => {
  const sizeClasses = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12',
  }

  // Color tokens map to the app's dark theme. `primary` uses the brand
  // `energy-orange` (tailwind.config.js → primary: '#FE4401'); previously
  // this was blue, which produced the off-palette "blue text" that showed
  // up in every Suspense fallback and FullPageSpinner.
  const colorClasses = {
    primary: 'text-primary',
    secondary: 'text-[#a0a0a0]',
    white: 'text-white',
    gray: 'text-[#707070]',
  }

  const textSizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
  }

  const spinnerClasses = [
    'animate-spin',
    sizeClasses[size],
    colorClasses[color],
    className,
  ].join(' ')

  const wrapperClasses = [
    'flex items-center',
    centered ? 'justify-center' : '',
    text ? 'space-x-2' : '',
  ].join(' ')

  const Spinner = () => (
    <svg
      className={spinnerClasses}
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
  )

  if (text) {
    return (
      <div className={wrapperClasses}>
        <Spinner />
        <span
          className={`${textSizeClasses[size]} ${colorClasses[color]} font-medium`}
        >
          {text}
        </span>
      </div>
    )
  }

  if (centered) {
    return (
      <div className={wrapperClasses}>
        <Spinner />
      </div>
    )
  }

  return <Spinner />
}

export const FullPageSpinner: React.FC<{ text?: string }> = ({
  text = 'Loading...',
}) => (
  <div className="fixed inset-0 flex items-center justify-center bg-[#0a0a0a]/90 z-50">
    <div className="flex flex-col items-center space-y-4">
      <LoadingSpinner size="xl" color="primary" />
      <p className="text-lg text-[#a0a0a0] font-medium">{text}</p>
    </div>
  </div>
)

export const InlineSpinner: React.FC<{ text?: string }> = ({
  text = 'Loading...',
}) => (
  <div className="flex items-center justify-center py-8">
    <LoadingSpinner size="lg" color="primary" text={text} />
  </div>
)
