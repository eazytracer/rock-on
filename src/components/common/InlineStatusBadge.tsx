/* eslint-disable react-refresh/only-export-components */
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'

interface StatusOption {
  value: string
  label: string
  icon?: React.ComponentType<{ size?: number; className?: string }>
  color: string // Tailwind classes for bg/text/border colors
}

interface InlineStatusBadgeProps {
  value: string
  options: StatusOption[]
  onSave: (value: string) => void | Promise<void>
  disabled?: boolean
  'data-testid'?: string
}

export const InlineStatusBadge: React.FC<InlineStatusBadgeProps> = ({
  value,
  options,
  onSave,
  disabled = false,
  'data-testid': testId = 'inline-status-badge',
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Find current option
  const currentOption = options.find(opt => opt.value === value) || options[0]
  const Icon = currentOption?.icon

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
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

  // Close on Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  // Handle option selection
  const handleSelect = useCallback(
    async (optionValue: string) => {
      if (optionValue === value) {
        setIsOpen(false)
        return
      }

      setIsSaving(true)
      try {
        await onSave(optionValue)
        setIsOpen(false)
      } catch (err) {
        console.error('Error saving status:', err)
      } finally {
        setIsSaving(false)
      }
    },
    [value, onSave]
  )

  // Toggle dropdown
  const handleToggle = () => {
    if (!disabled && !isSaving) {
      setIsOpen(prev => !prev)
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      data-testid={testId}
    >
      {/* Badge button */}
      <button
        onClick={handleToggle}
        disabled={disabled || isSaving}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border
          transition-all cursor-pointer
          ${currentOption?.color || 'text-gray-400 bg-gray-400/10 border-gray-400/20'}
          ${!disabled && !isSaving ? 'hover:ring-2 hover:ring-offset-1 hover:ring-offset-[#0a0a0a]' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        data-testid={`${testId}-button`}
      >
        {isSaving ? (
          <Loader2 size={14} className="animate-spin" />
        ) : Icon ? (
          <Icon size={14} />
        ) : null}
        <span>{currentOption?.label || value}</span>
        {!disabled && !isSaving && (
          <ChevronDown
            size={14}
            className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 left-0 min-w-[160px] bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl overflow-hidden"
          data-testid={`${testId}-dropdown`}
        >
          {options.map(option => {
            const OptionIcon = option.icon
            const isSelected = option.value === value

            return (
              <button
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className={`
                  w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors
                  ${isSelected ? 'bg-[#252525]' : 'hover:bg-[#252525]'}
                `}
                data-testid={`${testId}-option-${option.value}`}
              >
                {OptionIcon && (
                  <span className={option.color.split(' ')[0]}>
                    <OptionIcon size={14} />
                  </span>
                )}
                <span className="text-white">{option.label}</span>
                {isSelected && (
                  <span className="ml-auto text-[#f17827ff] text-xs">
                    Current
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Pre-defined status configurations for common use cases

export const SHOW_STATUS_OPTIONS: StatusOption[] = [
  {
    value: 'scheduled',
    label: 'Scheduled',
    color:
      'text-gray-400 bg-gray-400/10 border-gray-400/20 hover:ring-gray-400/50',
  },
  {
    value: 'confirmed',
    label: 'Confirmed',
    color:
      'text-[#f17827ff] bg-[#f17827ff]/10 border-[#f17827ff]/20 hover:ring-[#f17827ff]/50',
  },
  {
    value: 'completed',
    label: 'Completed',
    color:
      'text-green-500 bg-green-500/10 border-green-500/20 hover:ring-green-500/50',
  },
  {
    value: 'cancelled',
    label: 'Cancelled',
    color: 'text-red-500 bg-red-500/10 border-red-500/20 hover:ring-red-500/50',
  },
]

export const SETLIST_STATUS_OPTIONS: StatusOption[] = [
  {
    value: 'draft',
    label: 'Draft',
    color:
      'text-gray-400 bg-gray-400/10 border-gray-400/20 hover:ring-gray-400/50',
  },
  {
    value: 'active',
    label: 'Active',
    color:
      'text-green-500 bg-green-500/10 border-green-500/20 hover:ring-green-500/50',
  },
  {
    value: 'archived',
    label: 'Archived',
    color:
      'text-yellow-500 bg-yellow-500/10 border-yellow-500/20 hover:ring-yellow-500/50',
  },
]

export const PRACTICE_STATUS_OPTIONS: StatusOption[] = [
  {
    value: 'scheduled',
    label: 'Scheduled',
    color:
      'text-blue-400 bg-blue-500/10 border-blue-400/20 hover:ring-blue-400/50',
  },
  {
    value: 'in-progress',
    label: 'In Progress',
    color:
      'text-yellow-400 bg-yellow-500/10 border-yellow-400/20 hover:ring-yellow-400/50',
  },
  {
    value: 'completed',
    label: 'Completed',
    color:
      'text-green-500 bg-green-500/10 border-green-500/20 hover:ring-green-500/50',
  },
  {
    value: 'cancelled',
    label: 'Cancelled',
    color: 'text-red-500 bg-red-500/10 border-red-500/20 hover:ring-red-500/50',
  },
]
