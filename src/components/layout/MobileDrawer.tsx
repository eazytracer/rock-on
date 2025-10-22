import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import { Sidebar } from './Sidebar'

interface MobileDrawerProps {
  isOpen: boolean
  onClose: () => void
  currentPath: string
  bandName?: string
  userEmail?: string
  onSignOut?: () => void
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  currentPath,
  bandName,
  userEmail,
  onSignOut
}) => {
  // Prevent body scroll when drawer is open
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
          fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden
          transition-opacity duration-300
          ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`
          fixed top-0 left-0 h-screen w-[280px] z-50 md:hidden
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-lg bg-[#1f1f1f] text-[#a0a0a0] hover:text-white hover:bg-[#252525] transition-colors"
          aria-label="Close menu"
        >
          <X size={20} />
        </button>

        {/* Sidebar content */}
        <Sidebar
          currentPath={currentPath}
          bandName={bandName}
          userEmail={userEmail}
          onSignOut={() => {
            onSignOut?.()
            onClose()
          }}
          onNavigate={onClose}
        />
      </div>
    </>
  )
}
