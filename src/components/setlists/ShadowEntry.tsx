import React from 'react'
import { Plus } from 'lucide-react'

interface ShadowEntryProps {
  onAddSong: () => void
  placeholder?: string
  disabled?: boolean
  className?: string
  'data-testid'?: string
}

/**
 * ShadowEntry - A subtle placeholder for quick song addition
 *
 * Appears after the last item in a setlist or practice session.
 * Click to immediately open the song picker (bypasses the Add Item dropdown).
 *
 * Features:
 * - Subtle, non-intrusive design (dashed border, muted text)
 * - Hover state shows intent
 * - Keyboard accessible (tab, enter)
 * - Click immediately opens song picker
 */
export const ShadowEntry: React.FC<ShadowEntryProps> = ({
  onAddSong,
  placeholder = 'Click to add song...',
  disabled = false,
  className = '',
  'data-testid': dataTestId = 'shadow-entry',
}) => {
  const handleClick = () => {
    if (!disabled) {
      onAddSong()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      data-testid={dataTestId}
      aria-label="Add song"
      aria-disabled={disabled}
      className={`
        flex items-center gap-2 px-4 py-3
        border-2 border-dashed border-[#2a2a2a] rounded-lg
        text-[#505050] text-sm
        transition-all duration-200
        ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'cursor-pointer hover:border-[#f17827ff]/50 hover:text-[#f17827ff]/70 hover:bg-[#f17827ff]/5'
        }
        focus:outline-none focus:border-[#f17827ff] focus:ring-2 focus:ring-[#f17827ff]/20
        ${className}
      `}
    >
      <Plus
        size={16}
        className={`transition-colors ${disabled ? '' : 'group-hover:text-[#f17827ff]'}`}
      />
      <span>{placeholder}</span>
    </div>
  )
}
