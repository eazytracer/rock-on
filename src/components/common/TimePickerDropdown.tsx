import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Clock, ChevronDown, ChevronUp } from 'lucide-react'

interface TimePickerDropdownProps {
  value: string // Format: "HH:MM AM/PM" (e.g., "2:00 PM")
  onChange: (time: string) => void
  /** @deprecated retained for API compatibility; minutes now use quarter presets + free type. */
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

const MINUTE_PRESETS = ['00', '15', '30', '45']

interface TimeParts {
  hour: string // "1".."12"
  minute: string // "00".."59"
  period: 'AM' | 'PM'
}

/** Parse "2:30 PM" → parts. Falls back to a 12:00 PM default when unparseable. */
function parseValue(value: string): TimeParts {
  const m = value?.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (m) {
    return {
      hour: String(parseInt(m[1], 10)),
      minute: m[2],
      period: m[3].toUpperCase() as 'AM' | 'PM',
    }
  }
  return { hour: '12', minute: '00', period: 'PM' }
}

/** Format parts → "2:30 PM", or null when the parts aren't a valid time. */
function formatParts(parts: TimeParts): string | null {
  const h = parseInt(parts.hour, 10)
  const min = parseInt(parts.minute, 10)
  if (isNaN(h) || h < 1 || h > 12) return null
  if (isNaN(min) || min < 0 || min > 59) return null
  return `${h}:${String(min).padStart(2, '0')} ${parts.period}`
}

/**
 * TimePickerDropdown — a Google Calendar-style time control.
 *
 * Opens on a single click of the value. The popover exposes three controls:
 * an hour selector (type or step 1–12), a minute selector (quarter-hour presets
 * :00/:15/:30/:45 with free typing for anything else), and an AM/PM toggle.
 * Changes are staged and committed once — on Set, Enter, or click-outside — so
 * inline auto-save fields don't close mid-entry.
 *
 * Contract unchanged: `value` is "H:MM AM/PM", `onChange` fires with the same.
 */
export const TimePickerDropdown: React.FC<TimePickerDropdownProps> = ({
  value,
  onChange,
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
  const [draft, setDraft] = useState<TimeParts>(() => parseValue(value))

  const dropdownRef = useRef<HTMLDivElement>(null)

  // Re-seed the draft whenever the popover opens or the external value changes
  // while closed, so it always reflects the latest committed value.
  useEffect(() => {
    if (isOpen) setDraft(parseValue(value))
  }, [isOpen, value])

  const commit = useCallback(
    (parts: TimeParts) => {
      const formatted = formatParts(parts)
      if (formatted) onChange(formatted)
      setIsOpen(false)
    },
    [onChange]
  )

  // Commit the staged draft when clicking outside the control.
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        commit(draft)
      }
    }
    const timeoutId = setTimeout(
      () => document.addEventListener('mousedown', handleClickOutside),
      50
    )
    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, draft, commit])

  // Escape cancels (revert draft, close) without committing.
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDraft(parseValue(value))
        setIsOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, value])

  const stepHour = (dir: 1 | -1) => {
    setDraft(d => {
      const cur = parseInt(d.hour, 10)
      const base = isNaN(cur) ? 12 : cur
      // 1..12 wrap
      const next = ((base - 1 + dir + 12) % 12) + 1
      return { ...d, hour: String(next) }
    })
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-sm text-ink-3 mb-2">
          {label} {required && <span className="text-accent">*</span>}
        </label>
      )}

      {/* Trigger — a single click opens the picker */}
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

      {/* Picker popover */}
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-2 bg-bg-2 border border-border-1 rounded-lg shadow-xl z-50 p-3 min-w-[248px]"
          data-testid={dataTestId ? `${dataTestId}-dropdown` : undefined}
          role="dialog"
        >
          <div className="flex items-start gap-2">
            {/* Hour */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-wide text-ink-4 mb-1">
                Hour
              </span>
              <button
                type="button"
                onClick={() => stepHour(1)}
                aria-label="Increment hour"
                className="text-ink-4 hover:text-white transition-colors"
                data-testid={dataTestId ? `${dataTestId}-hour-up` : undefined}
              >
                <ChevronUp size={16} />
              </button>
              <input
                type="text"
                inputMode="numeric"
                value={draft.hour}
                onChange={e =>
                  setDraft(d => ({
                    ...d,
                    hour: e.target.value.replace(/\D/g, '').slice(0, 2),
                  }))
                }
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    commit(draft)
                  }
                }}
                data-testid={dataTestId ? `${dataTestId}-hour` : undefined}
                className="w-12 h-10 text-center bg-bg-1 border border-border-1 rounded text-white text-lg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
              <button
                type="button"
                onClick={() => stepHour(-1)}
                aria-label="Decrement hour"
                className="text-ink-4 hover:text-white transition-colors"
                data-testid={dataTestId ? `${dataTestId}-hour-down` : undefined}
              >
                <ChevronDown size={16} />
              </button>
            </div>

            <span className="text-white text-lg pt-7">:</span>

            {/* Minute */}
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wide text-ink-4 mb-1 text-center">
                Minute
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={draft.minute}
                onChange={e =>
                  setDraft(d => ({
                    ...d,
                    minute: e.target.value.replace(/\D/g, '').slice(0, 2),
                  }))
                }
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    commit(draft)
                  }
                }}
                data-testid={dataTestId ? `${dataTestId}-minute` : undefined}
                className="w-14 h-10 text-center bg-bg-1 border border-border-1 rounded text-white text-lg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
              <div className="mt-1 grid grid-cols-2 gap-1">
                {MINUTE_PRESETS.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDraft(d => ({ ...d, minute: m }))}
                    data-testid={
                      dataTestId ? `${dataTestId}-minute-${m}` : undefined
                    }
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      draft.minute === m
                        ? 'bg-accent text-white'
                        : 'bg-bg-1 text-ink-3 hover:bg-bg-4 hover:text-white'
                    }`}
                  >
                    :{m}
                  </button>
                ))}
              </div>
            </div>

            {/* AM/PM toggle */}
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wide text-ink-4 mb-1 text-center">
                &nbsp;
              </span>
              <div className="flex flex-col rounded overflow-hidden border border-border-1">
                {(['AM', 'PM'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setDraft(d => ({ ...d, period: p }))}
                    data-testid={
                      dataTestId
                        ? `${dataTestId}-${p.toLowerCase()}`
                        : undefined
                    }
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      draft.period === p
                        ? 'bg-accent text-white'
                        : 'bg-bg-1 text-ink-3 hover:bg-bg-4 hover:text-white'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                const now = new Date()
                let h = now.getHours()
                const period = h >= 12 ? 'PM' : 'AM'
                h = h % 12
                if (h === 0) h = 12
                // Round to nearest quarter hour for the "Now" convenience.
                const min = String(
                  (Math.round(now.getMinutes() / 15) * 15) % 60
                ).padStart(2, '0')
                commit({ hour: String(h), minute: min, period })
              }}
              data-testid={dataTestId ? `${dataTestId}-now` : undefined}
              className="text-xs text-accent hover:text-accent-hot transition-colors"
            >
              Now
            </button>
            <button
              type="button"
              onClick={() => commit(draft)}
              disabled={!formatParts(draft)}
              data-testid={dataTestId ? `${dataTestId}-set` : undefined}
              className="px-4 py-1.5 rounded-lg bg-accent text-white text-sm font-semibold transition-opacity disabled:opacity-40"
            >
              Set
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
