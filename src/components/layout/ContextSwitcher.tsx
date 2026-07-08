import React, { useEffect, useRef, useState } from 'react'
import { ChevronDown, CircleUser, Check, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

interface ContextSwitcherProps {
  variant: 'sidebar' | 'mobile'
}

export const ContextSwitcher: React.FC<ContextSwitcherProps> = ({
  variant,
}) => {
  const navigate = useNavigate()
  const { currentBand, contextType, userBands, setContext } = useAuth()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside-click (mousedown) and Escape.
  useEffect(() => {
    if (!open) return

    const handleMouseDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const logoSize = variant === 'sidebar' ? 'w-10 h-10' : 'w-8 h-8'
  const logoText = variant === 'sidebar' ? 'text-lg' : 'text-sm'
  const contextName = contextType === 'band' ? currentBand?.name : 'Personal'

  const handleSelect = async (target: 'personal' | string) => {
    setOpen(false)
    await setContext(target)
    // Interim: re-scope pages that still read localStorage. A later step removes this.
    window.location.reload()
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        data-testid="context-switcher-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-3 min-w-0 w-full text-left"
      >
        <div
          className={`${logoSize} ${
            contextType === 'band' ? 'bg-accent' : 'bg-info'
          } rounded-lg flex items-center justify-center flex-shrink-0`}
        >
          <span className={`text-white font-bold ${logoText}`}>R</span>
        </div>
        <h1
          className="text-white font-semibold text-base leading-tight truncate min-w-0"
          data-testid="sidebar-band-name"
        >
          {contextName}
        </h1>
        <ChevronDown
          size={16}
          className={`flex-shrink-0 text-ink-3 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div
          role="menu"
          data-testid="context-switcher-menu"
          className="absolute left-0 top-full mt-2 w-56 bg-bg-2 border border-border-1 rounded-lg shadow z-50 py-1"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => handleSelect('personal')}
            data-testid="context-option-personal"
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-ink-2 hover:bg-bg-3 transition-colors"
          >
            <CircleUser size={18} className="text-info flex-shrink-0" />
            <span className="flex-1 text-left truncate">Personal</span>
            {contextType === 'personal' && (
              <Check size={16} className="text-accent flex-shrink-0" />
            )}
          </button>

          {userBands.map(band => (
            <button
              key={band.id}
              type="button"
              role="menuitem"
              onClick={() => handleSelect(band.id)}
              data-testid={`context-option-band-${band.id}`}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-ink-2 hover:bg-bg-3 transition-colors"
            >
              <CircleUser size={18} className="text-accent flex-shrink-0" />
              <span className="flex-1 text-left truncate">{band.name}</span>
              {contextType === 'band' && currentBand?.id === band.id && (
                <Check size={16} className="text-accent flex-shrink-0" />
              )}
            </button>
          ))}

          <div className="my-1 border-t border-border-1" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              navigate('/get-started')
            }}
            data-testid="context-switcher-create-band"
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-ink-3 hover:bg-bg-3 hover:text-white transition-colors"
          >
            <Plus size={18} className="flex-shrink-0" />
            <span className="flex-1 text-left truncate">
              Create or join a band
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
