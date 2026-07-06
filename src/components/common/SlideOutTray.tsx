import React, { useEffect } from 'react'
import { X } from 'lucide-react'

interface SlideOutTrayProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  /** Panel width for the right-side variant. */
  width?: string
  /**
   * `right` (default) slides in from the right edge (desktop/side tray).
   * `bottom` slides up as a mobile bottom-sheet (rounded top, full width).
   */
  position?: 'right' | 'bottom'
  /** Max height for the bottom-sheet variant. */
  maxHeight?: string
  /** Overrides the panel's data-testid (default `slide-out-tray`). */
  'data-testid'?: string
}

export const SlideOutTray: React.FC<SlideOutTrayProps> = ({
  isOpen,
  onClose,
  title,
  children,
  width = '400px',
  position = 'right',
  maxHeight = '85vh',
  'data-testid': testId = 'slide-out-tray',
}) => {
  // Prevent body scroll when tray is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  const isBottom = position === 'bottom'

  const panelClasses = isBottom
    ? `fixed bottom-0 left-0 right-0 z-50 bg-bg-2 border-t border-border-1 rounded-t-2xl
       transition-transform duration-300 ease-in-out
       ${isOpen ? 'translate-y-0' : 'translate-y-full'}`
    : `fixed top-0 right-0 h-screen z-50 bg-bg-2 border-l border-border-1
       transition-transform duration-300 ease-in-out
       ${isOpen ? 'translate-x-0' : 'translate-x-full'}`

  const panelStyle: React.CSSProperties = isBottom
    ? { maxHeight }
    : { width: `min(${width}, 100vw)` }

  const contentClasses = isBottom
    ? 'overflow-y-auto custom-scrollbar'
    : 'overflow-y-auto h-[calc(100vh-73px)] custom-scrollbar'

  const contentStyle: React.CSSProperties = isBottom
    ? { maxHeight: `calc(${maxHeight} - 65px)` }
    : {}

  return (
    <>
      {/* Backdrop */}
      <div
        className={`
          fixed inset-0 bg-black/60 backdrop-blur-sm z-40
          transition-opacity duration-300
          ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        onClick={onClose}
        data-testid="slide-out-tray-backdrop"
      />

      {/* Panel */}
      <div className={panelClasses} style={panelStyle} data-testid={testId}>
        {/* Grab handle (bottom-sheet only) */}
        {isBottom && (
          <div className="flex justify-center pt-2.5 pb-1">
            <span
              className="block h-1 w-9 rounded-full bg-border-2"
              aria-hidden="true"
            />
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-1">
          <h2 className="text-lg font-semibold text-ink-1">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 text-ink-4 hover:text-ink-1 hover:bg-bg-4 rounded-lg transition-colors"
            aria-label="Close"
            data-testid="slide-out-tray-close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className={contentClasses} style={contentStyle}>
          {children}
        </div>
      </div>
    </>
  )
}
