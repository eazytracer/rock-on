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
        border-2 border-dashed border-border-1 rounded-lg
        text-ink-5 text-sm
        transition-all duration-200
        ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'cursor-pointer hover:border-accent/50 hover:text-accent/70 hover:bg-accent/5'
        }
        focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20
        ${className}
      `}
    >
      <Plus
        size={16}
        className={`transition-colors ${disabled ? '' : 'group-hover:text-accent'}`}
      />
      <span>{placeholder}</span>
    </div>
  )
}
