import React, { useEffect } from 'react'
import { X } from 'lucide-react'

interface SlideOutTrayProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  width?: string
}

export const SlideOutTray: React.FC<SlideOutTrayProps> = ({
  isOpen,
  onClose,
  title,
  children,
  width = '400px',
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

      {/* Slide-out panel */}
      <div
        className={`
          fixed top-0 right-0 h-screen z-50 bg-[#1a1a1a] border-l border-[#2a2a2a]
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
        style={{
          width: `min(${width}, 100vw)`,
        }}
        data-testid="slide-out-tray"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 text-[#707070] hover:text-white hover:bg-[#252525] rounded-lg transition-colors"
            aria-label="Close"
            data-testid="slide-out-tray-close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100vh-73px)] custom-scrollbar">
          {children}
        </div>
      </div>
    </>
  )
}
