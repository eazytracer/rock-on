import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { ChevronDown } from 'lucide-react'

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
  /** Accepted for API compatibility; the trigger no longer renders an icon. */
  hideIcon?: boolean
}

interface Slot {
  label: string // "8:30 PM"
  h24: number // 0..23
  m: number // 0..59
  h12: number // 1..12
  period: 'a' | 'p'
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
    minutes = parseInt(digits.slice(-2), 10)
    hours = parseInt(digits.slice(0, -2), 10)
  }
  if (isNaN(hours) || isNaN(minutes) || minutes > 59) return null

  if (period === 'p' && hours < 12) hours += 12
  else if (period === 'a' && hours === 12) hours = 0
  if (hours > 23) return null

  return slotLabel(hours, minutes)
}

/**
 * Break loose typed input into its partial parts for live filtering:
 * hour digits, minute digits (may be partial, e.g. "3"), and an optional period.
 */
function parseTyped(input: string): {
  hourPart: string
  minutePart: string
  period: 'a' | 'p' | null
} {
  const norm = input.toLowerCase().replace(/\s+/g, '')
  const periodMatch = norm.match(/(a|p)m?$/)
  const period = periodMatch ? (periodMatch[1] as 'a' | 'p') : null
  const core = norm.replace(/(a|p)m?$/, '')
  if (core.includes(':')) {
    const [h, m = ''] = core.split(':')
    return { hourPart: h, minutePart: m, period }
  }
  if (core.length <= 2) return { hourPart: core, minutePart: '', period }
  // 3-4 bare digits → last two are minutes
  return { hourPart: core.slice(0, -2), minutePart: core.slice(-2), period }
}

/** Does a slot match what the user has typed so far? */
function slotMatches(slot: Slot, input: string): boolean {
  if (!input.trim()) return true
  const { hourPart, minutePart, period } = parseTyped(input)
  if (period && slot.period !== period) return false
  if (hourPart) {
    // Match against the 12-hour label (what most people type) or the 24-hour value.
    const h12 = String(slot.h12)
    const h24 = String(slot.h24)
    if (!h12.startsWith(hourPart) && !h24.startsWith(hourPart)) return false
  }
  if (minutePart) {
    const ms = String(slot.m).padStart(2, '0')
    if (!ms.startsWith(minutePart)) return false
  }
  return true
}

/**
 * TimePickerDropdown — a Google Calendar-style time control.
 *
 * A single click of the value opens a scrollable list of time slots (15-minute
 * increments by default). Typing in the field at the top filters the list live
 * (e.g. "8" → 8:00/8:15/8:30/8:45 AM and PM; "8:3" → 8:30). Pick a slot, or type
 * an exact off-increment time (e.g. "8:20pm") and press Enter. The list
 * auto-scrolls to the current selection on open. `onChange` fires once, on
 * selection.
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
}) => {
  const [isOpen, setIsOpen] = useState(autoOpen)
  const [typed, setTyped] = useState('')
  const [highlight, setHighlight] = useState(0)

  const dropdownRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const slots = useMemo<Slot[]>(() => {
    const out: Slot[] = []
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += interval) {
        const h12 = h % 12 === 0 ? 12 : h % 12
        out.push({
          label: slotLabel(h, m),
          h24: h,
          m,
          h12,
          period: h < 12 ? 'a' : 'p',
        })
      }
    }
    return out
  }, [interval])

  // The list shown to the user — filtered live by what they've typed.
  const visible = useMemo(
    () => slots.filter(s => slotMatches(s, typed)),
    [slots, typed]
  )

  // Index of the committed value within the *unfiltered* slots (for scroll).
  const selectedIndex = useMemo(
    () =>
      value
        ? slots.findIndex(s => s.label.toLowerCase() === value.toLowerCase())
        : -1,
    [value, slots]
  )

  const commit = useCallback(
    (time: string) => {
      onChange(time)
      setTyped('')
      setIsOpen(false)
    },
    [onChange]
  )

  // Reset the highlight to the first match whenever the filter changes.
  useEffect(() => {
    setHighlight(0)
  }, [typed])

  // Close on click outside (no commit — a click outside just dismisses).
  useEffect(() => {
    if (!isOpen) return
    const onDown = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
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

  // On open (with no active filter), auto-scroll to the selected/current time.
  useEffect(() => {
    if (!isOpen || !listRef.current || typed) return
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
  }, [isOpen, selectedIndex, interval, slots.length, typed])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight(h => Math.min(h + 1, visible.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      // Prefer the highlighted match; else an exact off-increment typed time.
      if (visible[highlight]) commit(visible[highlight].label)
      else {
        const parsed = tryParseTime(typed)
        if (parsed) commit(parsed)
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
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
          {/* Type-ahead — filters the list live; Enter commits. */}
          <div className="p-2 border-b border-border-1">
            <input
              type="text"
              autoFocus
              value={typed}
              onChange={e => setTyped(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a time (e.g. 8 or 2:20pm)"
              data-testid={dataTestId ? `${dataTestId}-type-input` : undefined}
              className="w-full h-8 px-2 bg-bg-1 border border-border-1 rounded text-white text-sm placeholder-ink-5 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div
            ref={listRef}
            className="max-h-64 overflow-y-auto py-1 custom-scrollbar"
          >
            {visible.length === 0 ? (
              <div className="px-4 py-3 text-sm text-ink-5">
                No matches — press Enter to use “{typed}”.
              </div>
            ) : (
              visible.map((slot, index) => {
                const isSelected =
                  slot.label.toLowerCase() === value.toLowerCase()
                const isHighlighted = highlight === index
                return (
                  <button
                    key={slot.label}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => commit(slot.label)}
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
                    {slot.label}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
