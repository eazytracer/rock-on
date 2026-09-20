import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Clock, ChevronDown } from 'lucide-react'

interface TimePickerDropdownProps {
  value: string // Format: "H:MM AM/PM" (e.g., "2:00 PM")
  onChange: (time: string) => void
  /** Minutes between slots (default: 15). */
  interval?: number
  placeholder?: string
  label?: string
  required?: boolean
  disabled?: boolean
  name?: string
  id?: string
  'data-testid'?: string
  className?: string
  /** Open the popover immediately on mount (used for inline-edit). */
  autoOpen?: boolean
  /** Suppress the built-in clock icon (when the field already shows one). */
  hideIcon?: boolean
}

/** Format a slot Date → "2:30 PM". */
function slotLabel(hour: number, minute: number): string {
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/** Parse loose typed input ("2", "2:30", "230pm", "14:05") → "H:MM AM/PM" or null. */
function tryParseTime(input: string): string | null {
  const trimmed = input.trim().toLowerCase().replace(/\s+/g, '')
  if (!trimmed) return null
  // Optional trailing am/pm
  const periodMatch = trimmed.match(/(a|p)m?$/)
  const period = periodMatch ? periodMatch[1] : null
  const digits = trimmed.replace(/(a|p)m?$/, '').replace(/:/g, '')
  if (!/^\d{1,4}$/.test(digits)) return null

  let hours: number
  let minutes: number
  if (digits.length <= 2) {
    hours = parseInt(digits, 10)
    minutes = 0
  } else {
    // last two digits are minutes
    minutes = parseInt(digits.slice(-2), 10)
    hours = parseInt(digits.slice(0, -2), 10)
  }
  if (isNaN(hours) || isNaN(minutes) || minutes > 59) return null

  if (period === 'p' && hours < 12) hours += 12
  else if (period === 'a' && hours === 12) hours = 0
  // No period given: accept 24h input, else assume the literal 1-12 as-is.
  if (hours > 23) return null

  return slotLabel(hours, minutes)
}

/**
 * TimePickerDropdown — a Google Calendar-style time control.
 *
 * A single click of the value opens a scrollable list of time slots (15-minute
 * increments by default). Pick a slot, or type any time in the field at the top
 * (e.g. "2:20pm", "14:05") and press Enter for off-increment values. The list
 * auto-scrolls to the current selection. `onChange` fires once, on selection.
 *
 * Contract: `value` is "H:MM AM/PM"; `onChange` receives the same.
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
  const [typed, setTyped] = useState('')
  const [highlight, setHighlight] = useState(-1)

  const dropdownRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const slots = useMemo(() => {
    const out: string[] = []
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += interval) out.push(slotLabel(h, m))
    }
    return out
  }, [interval])

  const selectedIndex = useMemo(
    () =>
      value
        ? slots.findIndex(s => s.toLowerCase() === value.toLowerCase())
        : -1,
    [value, slots]
  )

  const commit = useCallback(
    (time: string) => {
      onChange(time)
      setTyped('')
      setIsOpen(false)
      setHighlight(-1)
    },
    [onChange]
  )

  // Close on click outside (no commit — a click outside just dismisses).
  useEffect(() => {
    if (!isOpen) return
    const onDown = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
        setHighlight(-1)
      }
    }
    const t = setTimeout(
      () => document.addEventListener('mousedown', onDown),
      50
    )
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', onDown)
    }
  }, [isOpen])

  // Auto-scroll to selected (or current) time when the list opens.
  useEffect(() => {
    if (!isOpen || !listRef.current) return
    let target = selectedIndex
    if (target < 0) {
      const now = new Date()
      target = Math.min(
        Math.round((now.getHours() * 60 + now.getMinutes()) / interval),
        slots.length - 1
      )
    }
    const ITEM_H = 36
    listRef.current.scrollTop = Math.max(0, target * ITEM_H - 100)
    setHighlight(target)
  }, [isOpen, selectedIndex, interval, slots.length])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight(h => Math.min(h + 1, slots.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      // Typed value wins if present; else the highlighted slot.
      const parsed = typed ? tryParseTime(typed) : null
      if (parsed) commit(parsed)
      else if (highlight >= 0) commit(slots[highlight])
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setHighlight(-1)
    }
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
          className="absolute top-full right-0 mt-2 bg-bg-2 border border-border-1 rounded-lg shadow-xl z-50 w-[180px]"
          data-testid={dataTestId ? `${dataTestId}-dropdown` : undefined}
          role="listbox"
        >
          {/* Type-ahead for off-increment times */}
          <div className="p-2 border-b border-border-1">
            <input
              type="text"
              autoFocus
              value={typed}
              onChange={e => setTyped(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a time (e.g. 2:20pm)"
              data-testid={dataTestId ? `${dataTestId}-type-input` : undefined}
              className="w-full h-8 px-2 bg-bg-1 border border-border-1 rounded text-white text-sm placeholder-ink-5 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div
            ref={listRef}
            className="max-h-64 overflow-y-auto py-1 custom-scrollbar"
          >
            {slots.map((time, index) => {
              const isSelected = selectedIndex === index
              const isHighlighted = highlight === index
              return (
                <button
                  key={time}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => commit(time)}
                  onMouseEnter={() => setHighlight(index)}
                  data-testid={
                    dataTestId ? `${dataTestId}-option-${index}` : undefined
                  }
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
