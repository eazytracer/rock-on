import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Calendar, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import {
  formatDateForInput,
  parseDateInputAsLocal,
} from '../../utils/dateHelpers'

interface DatePickerProps {
  value: string // YYYY-MM-DD format
  onChange: (date: string) => void
  label?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  minDate?: Date
  maxDate?: Date
  name?: string
  id?: string
  'data-testid'?: string
  className?: string
  /** Open the calendar immediately on mount (used for inline-edit / new records). */
  autoEdit?: boolean
  /** Suppress the built-in calendar icon (when the field already shows one). */
  hideIcon?: boolean
}

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  label,
  placeholder = 'Select date',
  required = false,
  disabled = false,
  minDate,
  maxDate,
  name,
  id,
  'data-testid': dataTestId,
  className = '',
  autoEdit = false,
  hideIcon = false,
}) => {
  const [isOpen, setIsOpen] = useState(autoEdit)
  const [viewDate, setViewDate] = useState<Date>(() =>
    value ? parseDateInputAsLocal(value) : new Date()
  )
  // Optional type-ahead text (lives inside the calendar popover — no double-click).
  const [typedValue, setTypedValue] = useState('')

  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedDate = value ? parseDateInputAsLocal(value) : null

  // Update view when value changes externally
  useEffect(() => {
    if (value) {
      setViewDate(parseDateInputAsLocal(value))
    }
  }, [value])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isOpen && event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Format display value (e.g., "Friday, January 2")
  const formatDisplayDate = useCallback(
    (date: Date): string =>
      date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
    []
  )

  // Get calendar days for current view month
  const getCalendarDays = useCallback((): (Date | null)[] => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days: (Date | null)[] = []
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null)
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day))
    }
    return days
  }, [viewDate])

  const isToday = (date: Date): boolean => {
    const today = new Date()
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  const isSelected = (date: Date): boolean => {
    if (!selectedDate) return false
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    )
  }

  const isDateDisabled = (date: Date): boolean => {
    if (minDate && date < minDate) return true
    if (maxDate && date > maxDate) return true
    return false
  }

  const handleSelectDate = (date: Date) => {
    if (isDateDisabled(date)) return
    onChange(formatDateForInput(date))
    setTypedValue('')
    setIsOpen(false)
  }

  const navigateMonth = (direction: 1 | -1) => {
    setViewDate(prev => {
      const newDate = new Date(prev)
      newDate.setMonth(prev.getMonth() + direction)
      return newDate
    })
  }

  // Type-ahead: parse a typed date and select it (Enter inside the popover).
  const handleTypedSubmit = () => {
    if (!typedValue.trim()) return
    const parsed = tryParseDate(typedValue)
    if (parsed && !isNaN(parsed.getTime())) {
      onChange(formatDateForInput(parsed))
      setViewDate(parsed)
      setTypedValue('')
      setIsOpen(false)
    }
  }

  // Parse common date formats
  const tryParseDate = (input: string): Date | null => {
    const trimmed = input.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return parseDateInputAsLocal(trimmed)
    }
    const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (slashMatch) {
      const [, m, d, y] = slashMatch
      return new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
    }
    const monthDayMatch = trimmed.match(
      /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})$/i
    )
    if (monthDayMatch) {
      const monthAbbr = monthDayMatch[1].toLowerCase()
      const day = parseInt(monthDayMatch[2])
      const monthIndex = [
        'jan',
        'feb',
        'mar',
        'apr',
        'may',
        'jun',
        'jul',
        'aug',
        'sep',
        'oct',
        'nov',
        'dec',
      ].indexOf(monthAbbr.slice(0, 3).toLowerCase())
      if (monthIndex >= 0) {
        return new Date(new Date().getFullYear(), monthIndex, day)
      }
    }
    const native = new Date(trimmed)
    if (!isNaN(native.getTime())) return native
    return null
  }

  const displayValue = selectedDate
    ? formatDisplayDate(selectedDate)
    : placeholder

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-sm text-ink-3 mb-2">
          {label} {required && <span className="text-accent">*</span>}
        </label>
      )}

      {/* Trigger — a single click opens the calendar */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(o => !o)}
        disabled={disabled}
        name={name}
        id={id}
        data-testid={dataTestId}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={`w-full h-10 px-3 bg-bg-1 border border-border-1 rounded-lg text-sm flex items-center justify-between transition-colors ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:border-border-2 cursor-pointer'
        } ${isOpen ? 'border-accent ring-2 ring-accent/20' : ''}`}
      >
        <span className={selectedDate ? 'text-white' : 'text-ink-4'}>
          {displayValue}
        </span>
        <div className="flex items-center gap-2">
          {!hideIcon && <Calendar size={18} className="text-ink-4" />}
          <ChevronDown
            size={14}
            className={`text-ink-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Calendar popover */}
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-2 bg-bg-2 border border-border-1 rounded-lg shadow-xl z-50 p-4 w-[280px]"
          data-testid={`${dataTestId}-dropdown`}
        >
          {/* Type-ahead */}
          <input
            type="text"
            value={typedValue}
            onChange={e => setTypedValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleTypedSubmit()
              }
            }}
            placeholder="Type a date (e.g. 1/15/2026)"
            data-testid={dataTestId ? `${dataTestId}-type-input` : undefined}
            className="w-full h-9 px-3 mb-3 bg-bg-1 border border-border-1 rounded-lg text-white text-sm placeholder-ink-5 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />

          {/* Month/Year header */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => navigateMonth(-1)}
              className="p-1 text-ink-3 hover:text-white hover:bg-bg-4 rounded transition-colors"
              data-testid={`${dataTestId}-prev-month`}
              aria-label="Previous month"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-white font-medium">
              {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <button
              type="button"
              onClick={() => navigateMonth(1)}
              className="p-1 text-ink-3 hover:text-white hover:bg-bg-4 rounded transition-colors"
              data-testid={`${dataTestId}-next-month`}
              aria-label="Next month"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS_OF_WEEK.map(day => (
              <div
                key={day}
                className="text-center text-xs text-ink-4 font-medium py-1"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {getCalendarDays().map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className="w-8 h-8" />
              }
              const today = isToday(date)
              const selected = isSelected(date)
              const dateDisabled = isDateDisabled(date)
              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  onClick={() => handleSelectDate(date)}
                  disabled={dateDisabled}
                  data-testid={`${dataTestId}-day-${date.getDate()}`}
                  className={`w-8 h-8 flex items-center justify-center text-sm rounded-full transition-colors ${
                    dateDisabled
                      ? 'text-ink-5 cursor-not-allowed'
                      : selected
                        ? 'bg-accent text-white font-medium'
                        : today
                          ? 'bg-[#2563eb] text-white'
                          : 'text-ink-3 hover:bg-bg-4 hover:text-white'
                  }`}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>

          {/* Today button */}
          <div className="mt-4 pt-3 border-t border-border-1">
            <button
              type="button"
              onClick={() => handleSelectDate(new Date())}
              className="w-full text-center text-sm text-accent hover:text-accent-hot transition-colors"
              data-testid={`${dataTestId}-today`}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
