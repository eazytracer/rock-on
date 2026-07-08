import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Clock, ChevronDown } from 'lucide-react'

interface TimePickerDropdownProps {
  value: string // Format: "HH:MM AM/PM" (e.g., "2:00 PM")
  onChange: (time: string) => void
  interval?: number // Minutes between slots (default: 15)
  placeholder?: string
  label?: string
  required?: boolean
  disabled?: boolean
  name?: string
  id?: string
  'data-testid'?: string
  className?: string
  /** Open the dropdown immediately on mount (used for inline-edit). */
  autoOpen?: boolean
  /** Suppress the built-in clock icon (when the field already shows one). */
  hideIcon?: boolean
}

/**
 * TimePickerDropdown — a Google Calendar-style scrollable time picker.
 *
 * Single click opens the list; typing is done via the field at the top of the
 * popover (no finicky double-click). 15-minute slots (configurable), auto-scrolls
 * to the selected/current time, keyboard nav.
 */
export const TimePickerDropdown: React.FC<TimePickerDropdownProps> = ({
  value,
  onChange,
  interval = 15,
  placeholder = 'Select time',
  label,
  required = false,
  disabled = false,
  name,
  id,
  'data-testid': dataTestId,
  className = '',
  autoOpen = false,
  hideIcon = false,
}) => {
  const [isOpen, setIsOpen] = useState(autoOpen)
  const [typedValue, setTypedValue] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const dropdownRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Generate time slots
  const timeSlots = useMemo(() => {
    const slots: string[] = []
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += interval) {
        const date = new Date(2000, 0, 1, hour, minute)
        slots.push(
          date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          })
        )
      }
    }
    return slots
  }, [interval])

  const selectedIndex = useMemo(() => {
    if (!value) return -1
    return timeSlots.findIndex(
      slot => slot.toLowerCase() === value.toLowerCase()
    )
  }, [value, timeSlots])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
        setHighlightedIndex(-1)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const getCurrentTimeIndex = useCallback(() => {
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const slotIndex = Math.round(currentMinutes / interval)
    return Math.min(slotIndex, timeSlots.length - 1)
  }, [interval, timeSlots.length])

  const scrollToIndex = useCallback(
    (index: number) => {
      if (listRef.current && index >= 0 && index < timeSlots.length) {
        const itemHeight = 36
        listRef.current.scrollTop = Math.max(0, index * itemHeight - 100)
      }
    },
    [timeSlots.length]
  )

  const handleSelectTime = useCallback(
    (time: string) => {
      onChange(time)
      setTypedValue('')
      setIsOpen(false)
      setHighlightedIndex(-1)
    },
    [onChange]
  )

  // Auto-scroll to the selected time when the dropdown opens
  useEffect(() => {
    if (isOpen && listRef.current) {
      const targetIndex =
        selectedIndex >= 0 ? selectedIndex : getCurrentTimeIndex()
      if (targetIndex >= 0) {
        listRef.current.scrollTop = Math.max(0, targetIndex * 36 - 100)
        setHighlightedIndex(targetIndex)
      }
    }
  }, [isOpen, selectedIndex, getCurrentTimeIndex])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return
      switch (event.key) {
        case 'Escape':
          setIsOpen(false)
          setHighlightedIndex(-1)
          break
        case 'ArrowDown':
          event.preventDefault()
          setHighlightedIndex(prev =>
            prev < timeSlots.length - 1 ? prev + 1 : prev
          )
          scrollToIndex(highlightedIndex + 1)
          break
        case 'ArrowUp':
          event.preventDefault()
          setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev))
          scrollToIndex(highlightedIndex - 1)
          break
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, highlightedIndex, timeSlots, scrollToIndex])

  // Type-ahead: parse a typed time (Enter inside the popover).
  const handleTypedSubmit = () => {
    if (!typedValue.trim()) return
    const parsed = tryParseTime(typedValue)
    if (parsed) {
      onChange(parsed)
      setTypedValue('')
      setIsOpen(false)
    }
  }

  const tryParseTime = (input: string): string | null => {
    const trimmed = input.trim().toLowerCase()
    const patterns = [
      /^(\d{1,2})\s*(a|p)m?$/i,
      /^(\d{1,2}):(\d{2})\s*(a|p)m?$/i,
      /^(\d{1,2}):(\d{2})$/,
    ]
    for (const pattern of patterns) {
      const match = trimmed.match(pattern)
      if (match) {
        let hours = parseInt(match[1])
        const minutes = match[2] ? parseInt(match[2]) : 0
        const period = match[3]?.toLowerCase()
        if (!period && hours >= 0 && hours <= 23) {
          return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString(
            'en-US',
            { hour: 'numeric', minute: '2-digit', hour12: true }
          )
        }
        if (period) {
          if (period === 'p' && hours !== 12) hours += 12
          if (period === 'a' && hours === 12) hours = 0
          return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString(
            'en-US',
            { hour: 'numeric', minute: '2-digit', hour12: true }
          )
        }
      }
    }
    return null
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-sm text-ink-3 mb-2">
          {label} {required && <span className="text-accent">*</span>}
        </label>
      )}

      {/* Trigger — a single click opens the list */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(o => !o)}
        disabled={disabled}
        name={name}
        id={id}
        data-testid={dataTestId}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full h-10 px-3 bg-bg-1 border border-border-1 rounded-lg text-sm flex items-center justify-between transition-colors ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:border-border-2 cursor-pointer'
        } ${isOpen ? 'border-accent ring-2 ring-accent/20' : ''}`}
      >
        <span className="flex items-center gap-2">
          {!hideIcon && <Clock size={16} className="text-ink-4" />}
          <span className={value ? 'text-white' : 'text-ink-4'}>
            {value || placeholder}
          </span>
        </span>
        <ChevronDown
          size={14}
          className={`text-ink-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Time popover */}
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-2 bg-bg-2 border border-border-1 rounded-lg shadow-xl z-50 w-full min-w-[160px]"
          data-testid={`${dataTestId}-dropdown`}
        >
          {/* Type-ahead */}
          <div className="p-2 border-b border-border-1">
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
              placeholder="Type a time (e.g. 2:30pm)"
              data-testid={dataTestId ? `${dataTestId}-type-input` : undefined}
              className="w-full h-8 px-2 bg-bg-1 border border-border-1 rounded text-white text-sm placeholder-ink-5 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div
            ref={listRef}
            className="max-h-64 overflow-y-auto py-1 custom-scrollbar"
          >
            {timeSlots.map((time, index) => {
              const isSelected = selectedIndex === index
              const isHighlighted = highlightedIndex === index
              return (
                <button
                  key={time}
                  type="button"
                  onClick={() => handleSelectTime(time)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  data-testid={`${dataTestId}-option-${index}`}
                  className={`w-full h-9 px-4 text-left text-sm transition-colors ${
                    isSelected
                      ? 'bg-accent text-white font-medium'
                      : isHighlighted
                        ? 'bg-bg-4 text-white'
                        : 'text-ink-3 hover:bg-bg-4 hover:text-white'
                  }`}
                >
                  {time}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
