import React, { useState, useRef, useEffect } from 'react'
import { Clock, ChevronDown } from 'lucide-react'
import { TimePicker } from './TimePicker'

interface DurationPickerProps {
  value: number // Duration in minutes
  onChange: (minutes: number) => void
  className?: string
  placeholder?: string
  mode?: 'duration' | 'time-range' // Duration presets or start/end time
}

export const DurationPicker: React.FC<DurationPickerProps> = ({
  value,
  onChange,
  className = '',
  placeholder = 'Select duration',
  mode = 'duration'
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [customDuration, setCustomDuration] = useState('')
  const [viewMode, setViewMode] = useState<'duration' | 'time-range'>(mode)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Common duration presets in minutes
  const presets = [
    { label: '30 min', value: 30 },
    { label: '45 min', value: 45 },
    { label: '1 hour', value: 60 },
    { label: '1.5 hours', value: 90 },
    { label: '2 hours', value: 120 },
    { label: '2.5 hours', value: 150 },
    { label: '3 hours', value: 180 },
    { label: '4 hours', value: 240 }
  ]

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

  // Calculate duration from time range
  useEffect(() => {
    if (viewMode === 'time-range' && startTime && endTime) {
      const start = parseTime(startTime)
      const end = parseTime(endTime)

      if (start && end) {
        let duration = end - start
        if (duration < 0) duration += 24 * 60 // Handle crossing midnight
        onChange(duration)
      }
    }
  }, [startTime, endTime, viewMode, onChange])

  const parseTime = (timeStr: string): number | null => {
    const match12h = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
    if (match12h) {
      let hours = parseInt(match12h[1])
      const minutes = parseInt(match12h[2])
      const period = match12h[3].toUpperCase()

      if (period === 'PM' && hours !== 12) hours += 12
      if (period === 'AM' && hours === 12) hours = 0

      return hours * 60 + minutes
    }
    return null
  }

  const formatDuration = (minutes: number): string => {
    if (minutes === 0) return placeholder
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60

    if (hours === 0) return `${mins} min`
    if (mins === 0) return hours === 1 ? '1 hour' : `${hours} hours`
    return `${hours}h ${mins}m`
  }

  const handlePresetSelect = (minutes: number) => {
    onChange(minutes)
    setIsOpen(false)
    setCustomDuration('')
  }

  const handleCustomDuration = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (val === '' || /^\d{0,4}$/.test(val)) {
      setCustomDuration(val)
    }
  }

  const applyCustomDuration = () => {
    if (customDuration) {
      const minutes = parseInt(customDuration)
      if (minutes > 0 && minutes <= 1440) { // Max 24 hours
        onChange(minutes)
        setIsOpen(false)
        setCustomDuration('')
      }
    }
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 bg-[#121212] border border-[#2a2a2a] rounded-lg text-white placeholder-[#707070] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20 flex items-center justify-between"
      >
        <span className={value === 0 ? 'text-[#707070]' : 'text-white'}>
          <Clock size={16} className="inline mr-2" />
          {formatDuration(value)}
        </span>
        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl z-50 p-4 max-h-96 overflow-auto custom-scrollbar">
          {/* Mode Toggle */}
          <div className="flex gap-2 mb-4 pb-4 border-b border-[#2a2a2a]">
            <button
              type="button"
              onClick={() => setViewMode('duration')}
              className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                viewMode === 'duration'
                  ? 'bg-[#f17827ff] text-white'
                  : 'text-[#a0a0a0] hover:bg-[#252525] hover:text-white'
              }`}
            >
              Duration
            </button>
            <button
              type="button"
              onClick={() => setViewMode('time-range')}
              className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                viewMode === 'time-range'
                  ? 'bg-[#f17827ff] text-white'
                  : 'text-[#a0a0a0] hover:bg-[#252525] hover:text-white'
              }`}
            >
              Time Range
            </button>
          </div>

          {viewMode === 'duration' ? (
            <>
              {/* Preset Durations */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {presets.map(preset => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => handlePresetSelect(preset.value)}
                    className={`px-3 py-2 rounded text-sm transition-colors ${
                      value === preset.value
                        ? 'bg-[#f17827ff] text-white'
                        : 'text-[#a0a0a0] hover:bg-[#252525] hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Custom Duration */}
              <div className="pt-3 border-t border-[#2a2a2a]">
                <div className="text-xs text-[#707070] mb-2 font-medium">Custom Duration (minutes)</div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customDuration}
                    onChange={handleCustomDuration}
                    onKeyDown={(e) => e.key === 'Enter' && applyCustomDuration()}
                    placeholder="e.g., 75"
                    className="flex-1 px-3 py-2 bg-[#121212] border border-[#2a2a2a] rounded text-white text-sm focus:border-[#f17827ff] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={applyCustomDuration}
                    disabled={!customDuration}
                    className="px-4 py-2 bg-[#f17827ff] text-white text-sm rounded hover:bg-[#d96920] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Time Range Mode */
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[#707070] mb-2 font-medium">Start Time</label>
                <TimePicker
                  value={startTime}
                  onChange={setStartTime}
                  placeholder="Select start time"
                />
              </div>
              <div>
                <label className="block text-xs text-[#707070] mb-2 font-medium">End Time</label>
                <TimePicker
                  value={endTime}
                  onChange={setEndTime}
                  placeholder="Select end time"
                />
              </div>

              {startTime && endTime && (
                <div className="pt-3 border-t border-[#2a2a2a] text-center">
                  <div className="text-sm text-[#a0a0a0]">
                    Duration: <span className="text-white font-medium">{formatDuration(value)}</span>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={!startTime || !endTime}
                className="w-full px-4 py-2 bg-[#f17827ff] text-white text-sm rounded-lg hover:bg-[#d96920] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Done
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
