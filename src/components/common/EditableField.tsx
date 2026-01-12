import React from 'react'
import { DatePicker } from './DatePicker'
import { TimePickerDropdown } from './TimePickerDropdown'
import { DurationPicker } from './DurationPicker'

interface SelectOption {
  value: string
  label: string
}

interface EditableFieldProps {
  label: string
  value: string | number
  isEditing: boolean
  onChange: (value: string | number) => void
  type?: 'text' | 'textarea' | 'select' | 'date' | 'time' | 'duration'
  options?: SelectOption[]
  icon?: React.ReactNode
  placeholder?: string
  required?: boolean
  name?: string
  id?: string
  'data-testid'?: string
  className?: string
  rows?: number
}

export const EditableField: React.FC<EditableFieldProps> = ({
  label,
  value,
  isEditing,
  onChange,
  type = 'text',
  options = [],
  icon,
  placeholder,
  required,
  name,
  id,
  'data-testid': testId,
  className = '',
  rows = 3,
}) => {
  const fieldId = id || name || label.toLowerCase().replace(/\s+/g, '-')
  const fieldTestId = testId || `editable-field-${fieldId}`

  // Render view mode
  const renderViewValue = () => {
    if (type === 'select' && options.length > 0) {
      const selectedOption = options.find(opt => opt.value === value)
      return selectedOption?.label || value || '-'
    }

    if (type === 'duration' && typeof value === 'number') {
      const hours = Math.floor(value / 60)
      const minutes = value % 60
      if (hours > 0) {
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
      }
      return `${minutes} min`
    }

    return value || '-'
  }

  // Render edit input based on type
  const renderEditInput = () => {
    const baseInputClass =
      'w-full px-3 py-2 bg-[#121212] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#505050] focus:border-[#f17827ff] focus:outline-none focus:ring-2 focus:ring-[#f17827ff]/20'

    switch (type) {
      case 'textarea':
        return (
          <textarea
            name={name}
            id={fieldId}
            data-testid={fieldTestId}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            required={required}
            rows={rows}
            className={`${baseInputClass} resize-none`}
          />
        )

      case 'select':
        return (
          <select
            name={name}
            id={fieldId}
            data-testid={fieldTestId}
            value={value}
            onChange={e => onChange(e.target.value)}
            required={required}
            className={`${baseInputClass} h-10`}
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
            name={name}
            id={fieldId}
            data-testid={fieldTestId}
            value={String(value)}
            onChange={val => onChange(val)}
            required={required}
          />
        )

      case 'time':
        return (
          <TimePickerDropdown
            label=""
            name={name}
            id={fieldId}
            data-testid={fieldTestId}
            value={String(value)}
            onChange={val => onChange(val)}
            required={required}
          />
        )

      case 'duration':
        return (
          <DurationPicker
            value={typeof value === 'number' ? value : 0}
            onChange={val => onChange(val)}
            placeholder={placeholder}
          />
        )

      default:
        return (
          <input
            type="text"
            name={name}
            id={fieldId}
            data-testid={fieldTestId}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            required={required}
            className={`${baseInputClass} h-10`}
          />
        )
    }
  }

  return (
    <div className={`${className}`} data-testid={`${fieldTestId}-container`}>
      {label && (
        <label
          htmlFor={fieldId}
          className="block text-sm text-[#707070] mb-1.5"
        >
          {label}
          {required && isEditing && (
            <span className="text-red-500 ml-1">*</span>
          )}
        </label>
      )}

      {isEditing ? (
        renderEditInput()
      ) : (
        <div className="flex items-start gap-2">
          {icon && <span className="text-[#f17827ff] mt-0.5">{icon}</span>}
          <span
            className="text-white text-sm"
            data-testid={`${fieldTestId}-value`}
          >
            {renderViewValue()}
          </span>
        </div>
      )}
    </div>
  )
}
