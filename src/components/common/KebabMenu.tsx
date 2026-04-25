import { useState, useEffect, useRef } from 'react'
import { MoreVertical, type LucideIcon } from 'lucide-react'

export interface KebabMenuItem {
  label: string
  icon?: LucideIcon
  onClick: () => void
  variant?: 'default' | 'danger'
  disabled?: boolean
  /** Renders a separator line above this item */
  dividerBefore?: boolean
  /** Stable testid for the menu item button (E2E tests). */
  'data-testid'?: string
}

interface KebabMenuProps {
  items: KebabMenuItem[]
  /** Which side the dropdown opens toward (default: right) */
  align?: 'left' | 'right'
  /** Trigger icon size: sm=14px, md=18px (default) */
  triggerSize?: 'sm' | 'md'
  disabled?: boolean
  'data-testid'?: string
  className?: string
}

/**
 * Canonical 3-dot kebab menu.
 *
 * Replaces 7–8 hand-rolled implementations across SongsPage, SetlistsPage,
 * ShowsPage, PracticesPage, BandMembersPage, and SongListItem — each of which
 * had slightly different z-indexes, widths, or missing backdrops.
 */
export function KebabMenu({
  items,
  align = 'right',
  triggerSize = 'md',
  disabled = false,
  'data-testid': testId,
  className = '',
}: KebabMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen])

  const iconSize = triggerSize === 'sm' ? 14 : 18

  const dropdownClasses = [
    'absolute top-full mt-1 z-50',
    'w-48 py-1',
    'bg-[#1f1f1f] border border-[#2a2a2a] rounded-lg shadow-xl',
    align === 'right' ? 'right-0' : 'left-0',
  ].join(' ')

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Transparent backdrop — click anywhere outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Trigger button */}
      <button
        type="button"
        data-testid={testId}
        disabled={disabled}
        onClick={e => {
          e.stopPropagation()
          setIsOpen(prev => !prev)
        }}
        className={[
          'p-1.5 rounded-md transition-colors',
          'text-[#707070] hover:text-white hover:bg-[#2a2a2a]',
          disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
        ].join(' ')}
        aria-label="More options"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <MoreVertical size={iconSize} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className={dropdownClasses} role="menu">
          {items.map((item, index) => {
            const Icon = item.icon
            const isDanger = item.variant === 'danger'

            return (
              <div key={index}>
                {item.dividerBefore && (
                  <div
                    className="border-t border-[#2a2a2a] my-1"
                    role="separator"
                  />
                )}
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  data-testid={item['data-testid']}
                  onClick={e => {
                    e.stopPropagation()
                    setIsOpen(false)
                    item.onClick()
                  }}
                  className={[
                    'flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left transition-colors',
                    isDanger
                      ? 'text-red-400 hover:text-red-300 hover:bg-[#2a2a2a]'
                      : 'text-[#e0e0e0] hover:bg-[#2a2a2a]',
                    item.disabled
                      ? 'opacity-40 cursor-not-allowed pointer-events-none'
                      : 'cursor-pointer',
                  ].join(' ')}
                >
                  {Icon && <Icon size={14} className="flex-shrink-0" />}
                  {item.label}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
