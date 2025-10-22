import React from 'react'
import { Menu } from 'lucide-react'

interface MobileHeaderProps {
  onMenuClick: () => void
  bandName?: string
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  onMenuClick,
  bandName = 'iPod Shuffle'
}) => {
  return (
    <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-[#141414] border-b border-[#1f1f1f] z-30 flex items-center px-4">
      <button
        onClick={onMenuClick}
        className="w-10 h-10 flex items-center justify-center rounded-lg text-white hover:bg-[#1f1f1f] transition-colors mr-3"
        aria-label="Open menu"
      >
        <Menu size={24} />
      </button>

      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">R</span>
        </div>
        <h1 className="text-white font-semibold text-base">{bandName}</h1>
      </div>
    </header>
  )
}
