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
}

/**
 * TimePickerDropdown - A Google Calendar-style time picker with scrollable dropdown
 *
 * Features:
 * - 15-minute increment time slots (configurable)
 * - Scrollable dropdown with 96 time slots
 * - Auto-scrolls to selected/current time
 * - Manual text entry override
 * - Keyboard navigation (up/down arrows)
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
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isManualEntry, setIsManualEntry] = useState(false)
  const [manualValue, setManualValue] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const dropdownRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Generate time slots
  const timeSlots = useMemo(() => {
    const slots: string[] = []
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += interval) {
        const date = new Date(2000, 0, 1, hour, minute)
        const timeStr = date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
        slots.push(timeStr)
      }
    }
    return slots
  }, [interval])

  // Find index of current value
  const selectedIndex = useMemo(() => {
    if (!value) return -1
    return timeSlots.findIndex(
      slot => slot.toLowerCase() === value.toLowerCase()
    )
  }, [value, timeSlots])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
        setIsManualEntry(false)
        setHighlightedIndex(-1)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Get index of current time (nearest slot)
  const getCurrentTimeIndex = useCallback(() => {
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const slotIndex = Math.round(currentMinutes / interval)
    return Math.min(slotIndex, timeSlots.length - 1)
  }, [interval, timeSlots.length])

  // Scroll to specific index
  const scrollToIndex = useCallback(
    (index: number) => {
      if (listRef.current && index >= 0 && index < timeSlots.length) {
        const itemHeight = 36
        const scrollPosition = index * itemHeight - 100
        listRef.current.scrollTop = Math.max(0, scrollPosition)
      }
    },
    [timeSlots.length]
  )

  // Handle time selection
  const handleSelectTime = useCallback(
    (time: string) => {
      onChange(time)
      setIsOpen(false)
      setHighlightedIndex(-1)
    },
    [onChange]
  )

  // Auto-scroll to selected time when dropdown opens
  useEffect(() => {
    if (isOpen && listRef.current) {
      const targetIndex =
        selectedIndex >= 0 ? selectedIndex : getCurrentTimeIndex()
      if (targetIndex >= 0) {
        const itemHeight = 36 // h-9 = 36px
        const scrollPosition = targetIndex * itemHeight - 100 // Center it a bit
        listRef.current.scrollTop = Math.max(0, scrollPosition)
        setHighlightedIndex(targetIndex)
      }
    }
  }, [isOpen, selectedIndex, getCurrentTimeIndex])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen || isManualEntry) return

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
        case 'Enter':
          if (highlightedIndex >= 0) {
            handleSelectTime(timeSlots[highlightedIndex])
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [
    isOpen,
    isManualEntry,
    highlightedIndex,
    timeSlots,
    scrollToIndex,
    handleSelectTime,
  ])

  // Parse manual entry
  const handleManualSubmit = () => {
    if (!manualValue.trim()) {
      setIsManualEntry(false)
      return
    }

    const parsed = tryParseTime(manualValue)
    if (parsed) {
      onChange(parsed)
    }
    setIsManualEntry(false)
    setManualValue('')
  }

  // Try to parse various time formats
  const tryParseTime = (input: string): string | null => {
    const trimmed = input.trim().toLowerCase()

    // Match patterns like "2pm", "2:30pm", "14:00", "2:30 PM"
    const patterns = [
      // "2pm" or "2 pm"
      /^(\d{1,2})\s*(a|p)m?$/i,
      // "2:30pm" or "2:30 pm"
      /^(\d{1,2}):(\d{2})\s*(a|p)m?$/i,
      // "14:00" (24-hour)
      /^(\d{1,2}):(\d{2})$/,
    ]

    for (const pattern of patterns) {
      const match = trimmed.match(pattern)
      if (match) {
        let hours = parseInt(match[1])
        const minutes = match[2] ? parseInt(match[2]) : 0
        const period = match[3]?.toLowerCase()

        // Handle 24-hour format
        if (!period && hours >= 0 && hours <= 23) {
          const date = new Date(2000, 0, 1, hours, minutes)
          return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          })
        }

        // Handle 12-hour format with AM/PM
        if (period) {
          if (period === 'p' && hours !== 12) hours += 12
          if (period === 'a' && hours === 12) hours = 0
          const date = new Date(2000, 0, 1, hours, minutes)
          return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          })
        }
      }
    }

    return null
  }

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
          type="text"
          value={manualValue}
          onChange={e => setManualValue(e.target.value)}
          onBlur={handleManualSubmit}
          onKeyDown={e => {
            if (e.key === 'Enter') handleManualSubmit()
            if (e.key === 'Escape') {
              setIsManualEntry(false)
              setManualValue('')
            }
          }}
          placeholder="Enter time (e.g., 2:30pm)"
          autoFocus
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
          <span className="flex items-center gap-2">
            <Clock size={16} className="text-[#707070]" />
            <span className={value ? 'text-white' : 'text-[#707070]'}>
              {value || placeholder}
            </span>
          </span>
          <ChevronDown
            size={14}
            className={`text-[#707070] transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>
      )}

      {/* Time dropdown */}
      {isOpen && !isManualEntry && (
        <div
          className="absolute top-full left-0 mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl z-50 w-full min-w-[140px]"
          data-testid={`${dataTestId}-dropdown`}
        >
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
                      ? 'bg-[#f17827ff] text-white font-medium'
                      : isHighlighted
                        ? 'bg-[#252525] text-white'
                        : 'text-[#a0a0a0] hover:bg-[#252525] hover:text-white'
                  }`}
                >
                  {time}
                </button>
              )
            })}
          </div>

          {/* Manual entry hint */}
          <div className="px-4 py-2 border-t border-[#2a2a2a] text-xs text-[#505050]">
            Double-click to type custom time
          </div>
        </div>
      )}
    </div>
  )
}
