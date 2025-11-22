import React, { useState, useEffect, useRef, useCallback } from 'react'
import { TouchButton } from '../common/TouchButton'

interface PracticeTimerProps {
  onTimeUpdate?: (seconds: number) => void
  onStart?: () => void
  onPause?: () => void
  onStop?: () => void
  onLap?: (lapTime: number) => void
  initialTime?: number
  autoStart?: boolean
  showLaps?: boolean
  compact?: boolean
}

interface LapTime {
  id: number
  time: number
  timestamp: Date
}

export const PracticeTimer: React.FC<PracticeTimerProps> = ({
  onTimeUpdate,
  onStart,
  onPause,
  onStop,
  onLap,
  initialTime = 0,
  autoStart = false,
  showLaps = true,
  compact = false,
}) => {
  const [time, setTime] = useState(initialTime)
  const [isRunning, setIsRunning] = useState(false)
  const [laps, setLaps] = useState<LapTime[]>([])
  const [lastLapTime, setLastLapTime] = useState(0)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)
  const elapsedRef = useRef<number>(initialTime)

  const formatTime = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }, [])

  const updateTimer = useCallback(() => {
    const now = Date.now()
    const elapsed =
      Math.floor((now - startTimeRef.current) / 1000) + elapsedRef.current
    setTime(elapsed)
    onTimeUpdate?.(elapsed)
  }, [onTimeUpdate])

  useEffect(() => {
    if (isRunning) {
      startTimeRef.current = Date.now()
      intervalRef.current = setInterval(updateTimer, 100)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRunning, updateTimer])

  useEffect(() => {
    if (autoStart && !isRunning) {
      handleStart()
    }
  }, [autoStart])

  const handleStart = () => {
    setIsRunning(true)
    onStart?.()
  }

  const handlePause = () => {
    elapsedRef.current = time
    setIsRunning(false)
    onPause?.()
  }

  const handleStop = () => {
    elapsedRef.current = 0
    setTime(0)
    setIsRunning(false)
    setLaps([])
    setLastLapTime(0)
    onStop?.()
  }

  const handleLap = () => {
    const lapTime = time - lastLapTime
    const newLap: LapTime = {
      id: Date.now(),
      time: lapTime,
      timestamp: new Date(),
    }
    setLaps(prev => [newLap, ...prev])
    setLastLapTime(time)
    onLap?.(lapTime)
  }

  const getTimerDisplay = () => {
    if (compact) {
      return (
        <div className="text-2xl font-mono font-bold text-gray-900">
          {formatTime(time)}
        </div>
      )
    }

    return (
      <div className="text-center">
        <div className="text-6xl sm:text-7xl md:text-8xl font-mono font-bold text-gray-900 mb-4 tracking-tight">
          {formatTime(time)}
        </div>
        <div className="text-lg text-gray-600">
          {isRunning ? 'Recording...' : time > 0 ? 'Paused' : 'Ready to start'}
        </div>
      </div>
    )
  }

  const getControls = () => {
    if (compact) {
      return (
        <div className="flex items-center space-x-2">
          {!isRunning ? (
            <TouchButton
              variant="primary"
              size="sm"
              onClick={handleStart}
              aria-label="Start timer"
            >
              ▶
            </TouchButton>
          ) : (
            <TouchButton
              variant="secondary"
              size="sm"
              onClick={handlePause}
              aria-label="Pause timer"
            >
              ⏸
            </TouchButton>
          )}

          {time > 0 && (
            <TouchButton
              variant="danger"
              size="sm"
              onClick={handleStop}
              aria-label="Stop timer"
            >
              ⏹
            </TouchButton>
          )}

          {isRunning && showLaps && (
            <TouchButton
              variant="ghost"
              size="sm"
              onClick={handleLap}
              aria-label="Record lap"
            >
              Lap
            </TouchButton>
          )}
        </div>
      )
    }

    return (
      <div className="flex flex-col sm:flex-row items-center justify-center space-y-3 sm:space-y-0 sm:space-x-4">
        {!isRunning ? (
          <TouchButton
            variant="primary"
            size="xl"
            onClick={handleStart}
            className="w-24 h-24 rounded-full text-xl"
            aria-label="Start practice session"
          >
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                clipRule="evenodd"
              />
            </svg>
          </TouchButton>
        ) : (
          <TouchButton
            variant="secondary"
            size="xl"
            onClick={handlePause}
            className="w-24 h-24 rounded-full text-xl"
            aria-label="Pause practice session"
          >
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </TouchButton>
        )}

        {time > 0 && (
          <TouchButton
            variant="danger"
            size="lg"
            onClick={handleStop}
            className="min-w-[100px]"
          >
            Stop
          </TouchButton>
        )}

        {isRunning && showLaps && (
          <TouchButton
            variant="ghost"
            size="lg"
            onClick={handleLap}
            className="min-w-[100px]"
          >
            Lap Time
          </TouchButton>
        )}
      </div>
    )
  }

  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
        {getTimerDisplay()}
        {getControls()}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-8 text-center">{getTimerDisplay()}</div>

      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
        {getControls()}
      </div>

      {showLaps && laps.length > 0 && (
        <div className="border-t border-gray-200">
          <div className="px-6 py-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              Lap Times ({laps.length})
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {laps.map((lap, index) => (
                <div
                  key={lap.id}
                  className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded"
                >
                  <span className="text-sm font-medium text-gray-900">
                    Lap {laps.length - index}
                  </span>
                  <span className="font-mono text-sm text-gray-700">
                    {formatTime(lap.time)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {lap.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {time > 0 && (
        <div className="px-6 py-3 bg-blue-50 border-t border-blue-200">
          <div className="flex items-center text-sm text-blue-700">
            <svg
              className="w-4 h-4 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                clipRule="evenodd"
              />
            </svg>
            Total practice time: {formatTime(time)}
          </div>
        </div>
      )}
    </div>
  )
}
