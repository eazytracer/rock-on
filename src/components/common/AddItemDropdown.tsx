import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Plus, ChevronDown, Music, Coffee, FileText } from 'lucide-react'

interface AddItemDropdownProps {
  onAddSong: () => void
  onAddBreak: () => void
  onAddSection: () => void
  disabled?: boolean
  className?: string
  'data-testid'?: string
}

interface DropdownOption {
  key: string
  label: string
  icon: React.ReactNode
  onClick: () => void
  description?: string
}

/**
 * AddItemDropdown - A unified dropdown for adding items to setlists/practice sessions
 *
 * Consolidates "Add Song", "Add Break", and "Add Section" buttons into a single dropdown.
 * Supports keyboard navigation (arrow keys, Enter, Escape).
 */
export const AddItemDropdown: React.FC<AddItemDropdownProps> = ({
  onAddSong,
  onAddBreak,
  onAddSection,
  disabled = false,
  className = '',
  'data-testid': dataTestId = 'add-item-dropdown',
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const options: DropdownOption[] = useMemo(
    () => [
      {
        key: 'song',
        label: 'Add Song',
        icon: <Music size={16} />,
        onClick: onAddSong,
        description: 'Add a song from your library',
      },
      {
        key: 'break',
        label: 'Add Break',
        icon: <Coffee size={16} />,
        onClick: onAddBreak,
        description: 'Add a break between songs',
      },
      {
        key: 'section',
        label: 'Add Section',
        icon: <FileText size={16} />,
        onClick: onAddSection,
        description: 'Add a section divider',
      },
    ],
    [onAddSong, onAddBreak, onAddSection]
  )

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
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

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return

      switch (event.key) {
        case 'Escape':
          setIsOpen(false)
          break
        case 'ArrowDown':
          event.preventDefault()
          setHighlightedIndex(prev =>
            prev < options.length - 1 ? prev + 1 : prev
          )
          break
        case 'ArrowUp':
          event.preventDefault()
          setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev))
          break
        case 'Enter':
          event.preventDefault()
          handleSelect(options[highlightedIndex])
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, highlightedIndex, options])

  const handleSelect = (option: DropdownOption) => {
    option.onClick()
    setIsOpen(false)
    setHighlightedIndex(0)
  }

  const toggleDropdown = () => {
    if (!disabled) {
      setIsOpen(!isOpen)
      if (!isOpen) {
        setHighlightedIndex(0)
      }
    }
  }

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      {/* Main button */}
      <button
        type="button"
        onClick={toggleDropdown}
        disabled={disabled}
        data-testid={dataTestId}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          disabled
            ? 'bg-[#1a1a1a] text-[#505050] cursor-not-allowed'
            : isOpen
              ? 'bg-[#f17827ff] text-white'
              : 'bg-[#1a1a1a] border border-[#2a2a2a] text-white hover:bg-[#252525] hover:border-[#3a3a3a]'
        }`}
      >
        <Plus size={18} />
        <span>Add Item</span>
        <ChevronDown
          size={14}
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-2 w-56 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl z-50 overflow-hidden"
          role="menu"
          aria-orientation="vertical"
          data-testid={`${dataTestId}-menu`}
        >
          {options.map((option, index) => (
            <button
              key={option.key}
              type="button"
              onClick={() => handleSelect(option)}
              onMouseEnter={() => setHighlightedIndex(index)}
              role="menuitem"
              data-testid={`${dataTestId}-${option.key}`}
              className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                highlightedIndex === index
                  ? 'bg-[#252525]'
                  : 'hover:bg-[#252525]'
              }`}
            >
              <span
                className={`mt-0.5 ${highlightedIndex === index ? 'text-[#f17827ff]' : 'text-[#707070]'}`}
              >
                {option.icon}
              </span>
              <div>
                <div
                  className={`text-sm font-medium ${highlightedIndex === index ? 'text-white' : 'text-[#a0a0a0]'}`}
                >
                  {option.label}
                </div>
                {option.description && (
                  <div className="text-xs text-[#505050] mt-0.5">
                    {option.description}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
