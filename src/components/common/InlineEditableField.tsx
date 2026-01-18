import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { DatePicker } from './DatePicker'
import { TimePickerDropdown } from './TimePickerDropdown'

interface SelectOption {
  value: string
  label: string
}

interface InlineEditableFieldProps {
  // Display
  value: string | number
  displayValue?: string // Formatted version for display
  label?: string
  icon?: React.ReactNode
  placeholder?: string

  // Behavior
  type?: 'text' | 'select' | 'date' | 'time' | 'duration' | 'textarea' | 'title'
  options?: SelectOption[] // For select type
  autoEdit?: boolean // Start in edit mode

  // Save on blur - accepts string or number, caller can cast as needed
  onSave: (value: string | number) => void | Promise<void>

  // Validation
  required?: boolean
  validate?: (value: string | number) => string | null // Returns error or null

  // Styling
  className?: string
  valueClassName?: string // For custom value styling (e.g., titles)

  // Test IDs and attributes
  'data-testid'?: string
  name?: string
  id?: string
}

export const InlineEditableField: React.FC<InlineEditableFieldProps> = ({
  value,
  displayValue,
  label,
  icon,
  placeholder = 'Click to edit',
  type = 'text',
  options = [],
  autoEdit = false,
  onSave,
  required = false,
  validate,
  className = '',
  valueClassName = '',
  'data-testid': testId,
  name,
  id,
}) => {
  const [isEditing, setIsEditing] = useState(autoEdit)
  const [editValue, setEditValue] = useState<string | number>(value)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Handle autoEdit prop changes - important for new entity creation
  useEffect(() => {
    if (autoEdit) {
      setIsEditing(true)
    }
  }, [autoEdit])

  // Handle cancel (Escape key or click outside)
  const handleCancel = useCallback(() => {
    setEditValue(value)
    setIsEditing(false)
    setError(null)
  }, [value])

  // Handle saving - defined early so it can be used in useEffects
  const handleSave = useCallback(async () => {
    // Validate required
    if (required && !editValue) {
      setError('This field is required')
      return
    }

    // Run custom validation
    if (validate) {
      const validationError = validate(editValue)
      if (validationError) {
        setError(validationError)
        return
      }
    }

    // Skip save if value hasn't changed
    if (editValue === value) {
      setIsEditing(false)
      setError(null)
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await onSave(editValue)
      setIsEditing(false)
    } catch (err) {
      console.error('Error saving field:', err)
      setError('Failed to save')
    } finally {
      setIsSaving(false)
    }
  }, [editValue, value, required, validate, onSave])

  // Update editValue when value prop changes (external updates)
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value)
    }
  }, [value, isEditing])

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      // Select all text for text inputs
      if (type === 'text' || type === 'title') {
        ;(inputRef.current as HTMLInputElement).select()
      }
    }
  }, [isEditing, type])

  // Click-outside handler - save edit when clicking outside (Jira-style)
  useEffect(() => {
    if (!isEditing) return

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        // Save on click outside (Jira-style) - Escape key is for cancel
        handleSave()
      }
    }

    // Add listener with a small delay to avoid immediate trigger
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 50)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isEditing, handleSave])

  // Handle starting edit mode
  const handleStartEdit = useCallback(() => {
    if (type === 'select') {
      // For select, we handle differently - just toggle
      setIsEditing(true)
      return
    }
    setEditValue(value)
    setError(null)
    setIsEditing(true)
  }, [value, type])

  // Handle key events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && type !== 'textarea') {
        e.preventDefault()
        handleSave()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        handleCancel()
      }
    },
    [type, handleSave, handleCancel]
  )

  // Handle blur - save if focus moves outside container (Jira-style)
  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      // Check if focus is moving to another element within the container
      if (containerRef.current?.contains(e.relatedTarget as Node)) {
        return
      }
      // Save on blur (Jira-style) - Escape key is for cancel
      handleSave()
    },
    [handleSave]
  )

  // Handle select change (immediate save for dropdowns)
  const handleSelectChange = useCallback(
    async (newValue: string) => {
      setEditValue(newValue)
      setIsSaving(true)
      try {
        await onSave(newValue)
        setIsEditing(false)
      } catch (err) {
        console.error('Error saving field:', err)
        setError('Failed to save')
      } finally {
        setIsSaving(false)
      }
    },
    [onSave]
  )

  // Render display value
  const renderDisplayValue = () => {
    const display = displayValue ?? String(value)
    const isEmpty = !display || display === '-'

    if (isEmpty) {
      return <span className="text-[#505050] italic">{placeholder}</span>
    }

    return display
  }

  // Base input styles
  const baseInputClass =
    'w-full px-2 py-1 bg-[#121212] border border-[#f17827ff] rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/30'

  // Render edit input based on type
  const renderEditInput = () => {
    switch (type) {
      case 'title':
        return (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={placeholder}
            className={`w-full px-2 py-1 bg-[#121212] border border-[#f17827ff] rounded text-white text-xl font-bold focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/30 ${valueClassName}`}
            name={name}
            id={id}
            data-testid={testId ? `${testId}-input` : undefined}
          />
        )

      case 'textarea':
        return (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={placeholder}
            rows={3}
            className={`${baseInputClass} resize-none`}
            name={name}
            id={id}
            data-testid={testId ? `${testId}-input` : undefined}
          />
        )

      case 'select':
        return (
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={editValue}
            onChange={e => handleSelectChange(e.target.value)}
            onBlur={handleBlur}
            className={`${baseInputClass} h-8`}
            name={name}
            id={id}
            data-testid={testId ? `${testId}-input` : undefined}
          >
            {options.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )

      case 'date':
        return (
          <DatePicker
            label=""
            value={String(editValue)}
            onChange={async val => {
              setEditValue(val)
              // Auto-save after date selection - call onSave directly with new value
              setIsSaving(true)
              try {
                await onSave(val)
                setIsEditing(false)
              } catch (err) {
                console.error('Error saving date:', err)
                setError('Failed to save')
              } finally {
                setIsSaving(false)
              }
            }}
            autoEdit={autoEdit}
            name={name}
            id={id}
            data-testid={testId ? `${testId}-input` : undefined}
          />
        )

      case 'time':
        return (
          <TimePickerDropdown
            label=""
            value={String(editValue)}
            onChange={async val => {
              setEditValue(val)
              // Auto-save after time selection - call onSave directly with new value
              setIsSaving(true)
              try {
                await onSave(val)
                setIsEditing(false)
              } catch (err) {
                console.error('Error saving time:', err)
                setError('Failed to save')
              } finally {
                setIsSaving(false)
              }
            }}
            name={name}
            id={id}
            data-testid={testId ? `${testId}-input` : undefined}
          />
        )

      case 'duration':
        // Simple minutes input for inline editing
        return (
          <div className="flex items-center gap-2">
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="number"
              value={editValue}
              onChange={e => setEditValue(parseInt(e.target.value) || 0)}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              placeholder="Minutes"
              min={0}
              max={1440}
              className="w-24 px-2 py-1 bg-[#121212] border border-[#f17827ff] rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/30"
              name={name}
              id={id}
              data-testid={testId ? `${testId}-input` : undefined}
            />
            <span className="text-xs text-[#707070]">minutes</span>
          </div>
        )

      default:
        return (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={placeholder}
            className={`${baseInputClass} ${valueClassName}`}
            name={name}
            id={id}
            data-testid={testId ? `${testId}-input` : undefined}
          />
        )
    }
  }

  // Display mode styles based on type
  const getDisplayStyles = () => {
    const base =
      'cursor-pointer transition-colors rounded px-2 py-1 -mx-2 -my-1'
    const hover = 'hover:bg-[#1a1a1a]'

    if (type === 'title') {
      return `${base} ${hover} text-xl font-bold text-white ${valueClassName}`
    }

    return `${base} ${hover} text-sm text-white ${valueClassName}`
  }

  return (
    <div ref={containerRef} className={`${className}`} data-testid={testId}>
      {/* Label */}
      {label && (
        <label className="block text-xs text-[#707070] mb-1 uppercase tracking-wide">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Field container */}
      <div className="flex items-start gap-2">
        {/* Icon - always visible */}
        {icon && (
          <span className="text-[#f17827ff] mt-0.5 flex-shrink-0">{icon}</span>
        )}

        {/* Value / Input */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-2">
              {renderEditInput()}
              {isSaving && (
                <Loader2
                  size={16}
                  className="text-[#f17827ff] animate-spin flex-shrink-0"
                />
              )}
            </div>
          ) : (
            <div
              onClick={handleStartEdit}
              className={getDisplayStyles()}
              data-testid={testId ? `${testId}-display` : undefined}
              role="button"
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleStartEdit()
                }
              }}
            >
              {renderDisplayValue()}
            </div>
          )}

          {/* Error message */}
          {error && <div className="text-red-500 text-xs mt-1">{error}</div>}
        </div>
      </div>
    </div>
  )
}
