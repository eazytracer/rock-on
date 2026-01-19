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
  autoEdit?: boolean // Start in manual entry mode with text input
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
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [viewDate, setViewDate] = useState<Date>(() => {
    if (value) {
      return parseDateInputAsLocal(value)
    }
    return new Date()
  })
  const [isManualEntry, setIsManualEntry] = useState(autoEdit)
  const [manualValue, setManualValue] = useState('')

  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Parse selected date
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
        setIsManualEntry(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return

      if (event.key === 'Escape') {
        setIsOpen(false)
        setIsManualEntry(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Format display value (e.g., "Friday, January 2")
  const formatDisplayDate = useCallback((date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
  }, [])

  // Get calendar days for current view month
  const getCalendarDays = useCallback((): (Date | null)[] => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()

    // First day of the month
    const firstDay = new Date(year, month, 1)
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0)

    const days: (Date | null)[] = []

    // Add empty cells for days before the first day
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null)
    }

    // Add all days of the month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day))
    }

    return days
  }, [viewDate])

  // Check if date is today
  const isToday = (date: Date): boolean => {
    const today = new Date()
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  // Check if date is selected
  const isSelected = (date: Date): boolean => {
    if (!selectedDate) return false
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    )
  }

  // Check if date is disabled
  const isDateDisabled = (date: Date): boolean => {
    if (minDate && date < minDate) return true
    if (maxDate && date > maxDate) return true
    return false
  }

  // Handle date selection
  const handleSelectDate = (date: Date) => {
    if (isDateDisabled(date)) return
    onChange(formatDateForInput(date))
    setIsOpen(false)
    setIsManualEntry(false)
  }

  // Navigate months
  const navigateMonth = (direction: 1 | -1) => {
    setViewDate(prev => {
      const newDate = new Date(prev)
      newDate.setMonth(prev.getMonth() + direction)
      return newDate
    })
  }

  // Handle manual entry
  const handleManualSubmit = () => {
    if (!manualValue.trim()) {
      setIsManualEntry(false)
      return
    }

    // Try to parse various date formats
    const parsed = tryParseDate(manualValue)
    if (parsed && !isNaN(parsed.getTime())) {
      onChange(formatDateForInput(parsed))
      setViewDate(parsed)
    }
    setIsManualEntry(false)
    setManualValue('')
  }

  // Parse common date formats
  const tryParseDate = (input: string): Date | null => {
    const trimmed = input.trim()

    // Try YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return parseDateInputAsLocal(trimmed)
    }

    // Try MM/DD/YYYY or M/D/YYYY
    const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (slashMatch) {
      const [, m, d, y] = slashMatch
      return new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
    }

    // Try "Jan 2" or "January 2" (assume current year)
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

    // Try native Date parsing as fallback
    const native = new Date(trimmed)
    if (!isNaN(native.getTime())) {
      return native
    }

    return null
  }

  const displayValue = selectedDate
    ? formatDisplayDate(selectedDate)
    : placeholder

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-sm text-[#a0a0a0] mb-2">
          {label} {required && <span className="text-[#f17827ff]">*</span>}
        </label>
      )}

      {/* Main button/input */}
      {isManualEntry ? (
        <input
          ref={inputRef}
          type={autoEdit ? 'date' : 'text'}
          value={autoEdit ? value : manualValue}
          onChange={e => {
            if (autoEdit) {
              onChange(e.target.value)
            } else {
              setManualValue(e.target.value)
            }
          }}
          onBlur={autoEdit ? undefined : handleManualSubmit}
          onKeyDown={e => {
            if (e.key === 'Enter' && !autoEdit) handleManualSubmit()
            if (e.key === 'Escape') {
              setIsManualEntry(false)
              setManualValue('')
            }
          }}
          placeholder={autoEdit ? '' : 'Enter date (e.g., 1/15/2026)'}
          autoFocus
          name={name}
          id={id}
          data-testid={dataTestId}
          className="w-full h-10 px-3 bg-[#121212] border border-[#f17827ff] rounded-lg text-white text-sm placeholder-[#505050] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20"
        />
      ) : (
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onDoubleClick={() => !disabled && setIsManualEntry(true)}
          disabled={disabled}
          name={name}
          id={id}
          data-testid={dataTestId}
          className={`w-full h-10 px-3 bg-[#121212] border border-[#2a2a2a] rounded-lg text-sm flex items-center justify-between transition-colors ${
            disabled
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:border-[#3a3a3a] cursor-pointer'
          } ${isOpen ? 'border-[#f17827ff] ring-2 ring-[#f17827ff]/20' : ''}`}
        >
          <span className={selectedDate ? 'text-white' : 'text-[#707070]'}>
            {displayValue}
          </span>
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-[#707070]" />
            <ChevronDown
              size={14}
              className={`text-[#707070] transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </div>
        </button>
      )}

      {/* Calendar dropdown */}
      {isOpen && !isManualEntry && (
        <div
          className="absolute top-full left-0 mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl z-50 p-4 w-[280px]"
          data-testid={`${dataTestId}-dropdown`}
        >
          {/* Month/Year header */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => navigateMonth(-1)}
              className="p-1 text-[#a0a0a0] hover:text-white hover:bg-[#252525] rounded transition-colors"
              data-testid={`${dataTestId}-prev-month`}
            >
              <ChevronLeft size={20} />
            </button>

            <span className="text-white font-medium">
              {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>

            <button
              type="button"
              onClick={() => navigateMonth(1)}
              className="p-1 text-[#a0a0a0] hover:text-white hover:bg-[#252525] rounded transition-colors"
              data-testid={`${dataTestId}-next-month`}
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS_OF_WEEK.map(day => (
              <div
                key={day}
                className="text-center text-xs text-[#707070] font-medium py-1"
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
                      ? 'text-[#505050] cursor-not-allowed'
                      : selected
                        ? 'bg-[#f17827ff] text-white font-medium'
                        : today
                          ? 'bg-[#2563eb] text-white'
                          : 'text-[#a0a0a0] hover:bg-[#252525] hover:text-white'
                  }`}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>

          {/* Today button */}
          <div className="mt-4 pt-3 border-t border-[#2a2a2a]">
            <button
              type="button"
              onClick={() => {
                const today = new Date()
                handleSelectDate(today)
              }}
              className="w-full text-center text-sm text-[#f17827ff] hover:text-[#ff8f4d] transition-colors"
              data-testid={`${dataTestId}-today`}
            >
              Today
            </button>
          </div>

          {/* Manual entry hint */}
          <div className="mt-2 text-center text-xs text-[#505050]">
            Double-click field to type date
          </div>
        </div>
      )}
    </div>
  )
}
