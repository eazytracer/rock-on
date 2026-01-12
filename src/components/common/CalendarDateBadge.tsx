import React from 'react'

type StatusVariant = 'active' | 'completed' | 'cancelled' | 'default'

interface CalendarDateBadgeProps {
  date: Date | string
  variant?: StatusVariant
  size?: 'sm' | 'md' | 'lg'
  showMonth?: boolean
  className?: string
}

/**
 * CalendarDateBadge - A consistent calendar icon component for displaying dates
 *
 * Used across Shows, Practices, and other date-based items to provide
 * a unified visual appearance.
 *
 * @param date - The date to display
 * @param variant - Visual style: 'active' (orange), 'completed' (green), 'cancelled' (muted), 'default' (grey)
 * @param size - Badge size: 'sm' (48px), 'md' (64px), 'lg' (80px)
 * @param showMonth - Whether to show the month abbreviation above the day
 */
export const CalendarDateBadge: React.FC<CalendarDateBadgeProps> = ({
  date,
  variant = 'default',
  size = 'md',
  showMonth = true,
  className = '',
}) => {
  const dateObj = typeof date === 'string' ? new Date(date) : date

  // Handle invalid dates
  if (!dateObj || isNaN(dateObj.getTime())) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-lg bg-[#2a2a2a] border border-[#3a3a3a] ${getSizeClass(size)} ${className}`}
      >
        <span className="text-[#707070] text-xs">TBD</span>
      </div>
    )
  }

  const month = dateObj.toLocaleDateString('en-US', { month: 'short' })
  const day = dateObj.getDate()
  const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'short' })

  const variantStyles = getVariantStyles(variant)
  const sizeStyles = getSizeStyles(size)

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg ${variantStyles.container} ${getSizeClass(size)} ${className}`}
      data-testid="calendar-date-badge"
    >
      {showMonth && (
        <div
          className={`font-semibold uppercase tracking-wide ${sizeStyles.month} ${variantStyles.month}`}
        >
          {month}
        </div>
      )}
      <div
        className={`font-bold leading-none ${sizeStyles.day} ${variantStyles.day}`}
      >
        {day}
      </div>
      <div className={`${sizeStyles.weekday} ${variantStyles.weekday}`}>
        {weekday}
      </div>
    </div>
  )
}

function getSizeClass(size: 'sm' | 'md' | 'lg'): string {
  switch (size) {
    case 'sm':
      return 'w-12 h-14 gap-0'
    case 'md':
      return 'w-16 h-[72px] gap-0.5'
    case 'lg':
      return 'w-20 h-24 gap-1'
    default:
      return 'w-16 h-[72px] gap-0.5'
  }
}

function getSizeStyles(size: 'sm' | 'md' | 'lg') {
  switch (size) {
    case 'sm':
      return {
        month: 'text-[9px]',
        day: 'text-lg',
        weekday: 'text-[9px]',
      }
    case 'md':
      return {
        month: 'text-[10px]',
        day: 'text-2xl',
        weekday: 'text-[10px]',
      }
    case 'lg':
      return {
        month: 'text-xs',
        day: 'text-3xl',
        weekday: 'text-xs',
      }
    default:
      return {
        month: 'text-[10px]',
        day: 'text-2xl',
        weekday: 'text-[10px]',
      }
  }
}

function getVariantStyles(variant: StatusVariant) {
  switch (variant) {
    case 'active':
      return {
        container: 'bg-[#f17827ff]/10 border-2 border-[#f17827ff]',
        month: 'text-[#f17827ff]',
        day: 'text-white',
        weekday: 'text-[#a0a0a0]',
      }
    case 'completed':
      return {
        container: 'bg-green-500/10 border-2 border-green-500/30',
        month: 'text-green-500',
        day: 'text-green-400',
        weekday: 'text-green-500/70',
      }
    case 'cancelled':
      return {
        container: 'bg-[#2a2a2a] border border-[#3a3a3a]',
        month: 'text-[#707070]',
        day: 'text-[#707070]',
        weekday: 'text-[#505050]',
      }
    case 'default':
    default:
      return {
        container: 'bg-[#2a2a2a] border border-[#3a3a3a]',
        month: 'text-[#a0a0a0]',
        day: 'text-[#a0a0a0]',
        weekday: 'text-[#707070]',
      }
  }
}
