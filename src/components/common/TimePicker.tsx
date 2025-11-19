import React, { useState, useRef, useEffect } from 'react'
import { Clock, ChevronDown } from 'lucide-react'

interface TimePickerProps {
  value: string // Format: "HH:MM" or "HH:MM AM/PM"
  onChange: (time: string) => void
  format?: '12h' | '24h'
  className?: string
  placeholder?: string
  name?: string
  id?: string
  'data-testid'?: string
}

export const TimePicker: React.FC<TimePickerProps> = ({
  value,
  onChange,
  format = '12h',
  className = '',
  placeholder = 'Select time',
  name,
  id,
  'data-testid': dataTestId
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedHour, setSelectedHour] = useState<number | null>(null)
  const [selectedMinute, setSelectedMinute] = useState<number | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('PM')
  const [customMinute, setCustomMinute] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Parse initial value
  useEffect(() => {
    if (value) {
      const match12h = value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
      const match24h = value.match(/(\d{1,2}):(\d{2})/)

      if (match12h) {
        setSelectedHour(parseInt(match12h[1]))
        setSelectedMinute(parseInt(match12h[2]))
        setSelectedPeriod(match12h[3].toUpperCase() as 'AM' | 'PM')
      } else if (match24h) {
        let hour = parseInt(match24h[1])
        setSelectedMinute(parseInt(match24h[2]))
        if (format === '12h') {
          setSelectedPeriod(hour >= 12 ? 'PM' : 'AM')
          hour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
        }
        setSelectedHour(hour)
      }
    }
  }, [value, format])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const hours = format === '12h'
    ? Array.from({ length: 12 }, (_, i) => i + 1)
    : Array.from({ length: 24 }, (_, i) => i)

  const commonMinutes = [0, 15, 30, 45]

  const formatTime = (hour: number, minute: number, period?: 'AM' | 'PM') => {
    if (format === '12h') {
      return `${hour}:${minute.toString().padStart(2, '0')} ${period}`
    } else {
      return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
    }
  }

  const handleSelect = (hour: number, minute: number, period?: 'AM' | 'PM') => {
    setSelectedHour(hour)
    setSelectedMinute(minute)
    if (period) setSelectedPeriod(period)

    const timeString = formatTime(hour, minute, period || selectedPeriod)
    onChange(timeString)
    setIsOpen(false)
    setCustomMinute('')
  }

  const handleCustomMinute = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (val === '' || (/^\d{0,2}$/.test(val) && parseInt(val) <= 59)) {
      setCustomMinute(val)
    }
  }

  const applyCustomMinute = () => {
    if (customMinute && selectedHour !== null) {
      const minute = parseInt(customMinute)
      if (minute >= 0 && minute <= 59) {
        handleSelect(selectedHour, minute, selectedPeriod)
      }
    }
  }

  const displayValue = selectedHour !== null && selectedMinute !== null
    ? formatTime(selectedHour, selectedMinute, format === '12h' ? selectedPeriod : undefined)
    : placeholder

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        name={name}
        id={id}
        data-testid={dataTestId}
        className="w-full px-4 py-2 bg-[#121212] border border-[#2a2a2a] rounded-lg text-white placeholder-[#707070] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20 flex items-center justify-between"
      >
        <span className={selectedHour === null ? 'text-[#707070]' : 'text-white'}>
          <Clock size={16} className="inline mr-2" />
          {displayValue}
        </span>
        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl z-50 p-4 max-h-80 overflow-auto custom-scrollbar">
          <div className="grid grid-cols-2 gap-4">
            {/* Hour Selection */}
            <div>
              <div className="text-xs text-[#707070] mb-2 font-medium">Hour</div>
              <div className="grid grid-cols-3 gap-1">
                {hours.map(hour => (
                  <button
                    key={hour}
                    type="button"
                    onClick={() => {
                      setSelectedHour(hour)
                      if (selectedMinute !== null) {
                        handleSelect(hour, selectedMinute, selectedPeriod)
                      }
                    }}
                    className={`px-2 py-1.5 rounded text-sm transition-colors ${
                      selectedHour === hour
                        ? 'bg-[#f17827ff] text-white'
                        : 'text-[#a0a0a0] hover:bg-[#252525] hover:text-white'
                    }`}
                  >
                    {format === '24h' ? hour.toString().padStart(2, '0') : hour}
                  </button>
                ))}
              </div>
            </div>

            {/* Minute Selection */}
            <div>
              <div className="text-xs text-[#707070] mb-2 font-medium">Minute</div>
              <div className="space-y-1">
                {commonMinutes.map(minute => (
                  <button
                    key={minute}
                    type="button"
                    onClick={() => {
                      if (selectedHour !== null) {
                        handleSelect(selectedHour, minute, selectedPeriod)
                      }
                    }}
                    disabled={selectedHour === null}
                    className={`w-full px-2 py-1.5 rounded text-sm text-left transition-colors ${
                      selectedMinute === minute
                        ? 'bg-[#f17827ff] text-white'
                        : selectedHour === null
                        ? 'text-[#505050] cursor-not-allowed'
                        : 'text-[#a0a0a0] hover:bg-[#252525] hover:text-white'
                    }`}
                  >
                    :{minute.toString().padStart(2, '0')}
                  </button>
                ))}

                {/* Custom Minute Input */}
                <div className="pt-2 border-t border-[#2a2a2a]">
                  <div className="text-xs text-[#707070] mb-1">Custom</div>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={customMinute}
                      onChange={handleCustomMinute}
                      onKeyDown={(e) => e.key === 'Enter' && applyCustomMinute()}
                      placeholder="00-59"
                      disabled={selectedHour === null}
                      className="flex-1 px-2 py-1 bg-[#121212] border border-[#2a2a2a] rounded text-white text-sm focus:border-[#f17827ff] focus:outline-none disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={applyCustomMinute}
                      disabled={!customMinute || selectedHour === null}
                      className="px-2 py-1 bg-[#f17827ff] text-white text-xs rounded hover:bg-[#d96920] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      ✓
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AM/PM Toggle (12h format only) */}
          {format === '12h' && (
            <div className="mt-4 pt-4 border-t border-[#2a2a2a]">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPeriod('AM')
                    if (selectedHour !== null && selectedMinute !== null) {
                      handleSelect(selectedHour, selectedMinute, 'AM')
                    }
                  }}
                  className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                    selectedPeriod === 'AM'
                      ? 'bg-[#f17827ff] text-white'
                      : 'text-[#a0a0a0] hover:bg-[#252525] hover:text-white'
                  }`}
                >
                  AM
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPeriod('PM')
                    if (selectedHour !== null && selectedMinute !== null) {
                      handleSelect(selectedHour, selectedMinute, 'PM')
                    }
                  }}
                  className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                    selectedPeriod === 'PM'
                      ? 'bg-[#f17827ff] text-white'
                      : 'text-[#a0a0a0] hover:bg-[#252525] hover:text-white'
                  }`}
                >
                  PM
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
