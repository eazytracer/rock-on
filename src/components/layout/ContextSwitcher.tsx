import React, { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useMyContexts } from '../../hooks/useMyContexts'
import { BandMark } from '../ui/BandMark'

interface ContextSwitcherProps {
  variant: 'sidebar' | 'mobile'
}

/**
 * The one context switcher (Core Navigation 4): a chip in the mobile header and
 * at the top of the desktop sidebar. Personal · your bands (dot = unread
 * bandmate activity) · Create or join.
 */
export const ContextSwitcher: React.FC<ContextSwitcherProps> = ({
  variant,
}) => {
  const navigate = useNavigate()
  const { currentBand, contextType, userBands, setContext, currentUser } =
    useAuth()
  const { data: contexts } = useMyContexts()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

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

  const personal = contextType === 'personal'
  const userName = currentUser?.name || 'Me'
  const contextName = personal ? 'Personal' : (currentBand?.name ?? '')
  const info = (bandId: string) => contexts?.find(c => c.band_id === bandId)
  const current = currentBand ? info(currentBand.id) : undefined
  const subline = personal
    ? 'Just you'
    : `Band${current ? ` · ${current.member_count} member${current.member_count === 1 ? '' : 's'}` : ''}`

  const handleSelect = async (target: 'personal' | string) => {
    setOpen(false)
    await setContext(target)
    // Re-scope every page to the new context.
    window.location.reload()
  }

  const isSidebar = variant === 'sidebar'

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        data-testid="context-switcher-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        className={
          isSidebar
            ? 'flex items-center gap-2.5 w-full h-[52px] px-2.5 rounded-2xl bg-bg-3 text-left hover:bg-bg-4 transition-colors'
            : 'flex items-center gap-2 h-10 pl-1.5 pr-3 rounded-full bg-bg-3 max-w-[220px]'
        }
      >
        <BandMark
          name={personal ? userName : contextName}
          personal={personal}
          size={isSidebar ? 32 : 28}
        />
        <span className="flex-1 min-w-0">
          <span
            className={`block truncate font-bold text-ink-1 ${isSidebar ? 'text-[15px]' : 'text-sm'}`}
            data-testid="sidebar-band-name"
          >
            {contextName}
          </span>
          {isSidebar && (
            <span className="block text-[11.5px] font-medium text-ink-3 truncate">
              {subline}
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-ink-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          data-testid="context-switcher-menu"
          className={`absolute z-50 mt-2 rounded-[18px] bg-bg-2 p-1.5 shadow-float ring-1 ring-border-1 ${
            isSidebar ? 'left-0 right-0' : 'left-0 w-72'
          }`}
        >
          <Option
            testId="context-option-personal"
            mark={<BandMark name={userName} personal size={30} />}
            title="Personal"
            sub="Your own songs and setlists"
            selected={personal}
            onClick={() => handleSelect('personal')}
          />
          {userBands.length > 0 && (
            <p className="px-2.5 pt-2 pb-1 font-mono text-[10px] tracking-[.12em] uppercase text-ink-3">
              Bands
            </p>
          )}
          {userBands.map(band => {
            const c = info(band.id)
            return (
              <Option
                key={band.id}
                testId={`context-option-band-${band.id}`}
                mark={<BandMark name={band.name} size={30} />}
                title={band.name}
                sub={
                  c
                    ? `${c.member_count} member${c.member_count === 1 ? '' : 's'}`
                    : undefined
                }
                unread={!!c?.has_unread}
                selected={!personal && currentBand?.id === band.id}
                onClick={() => handleSelect(band.id)}
              />
            )
          })}
          <div className="my-1 border-t border-divider" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              navigate('/get-started')
            }}
            data-testid="context-switcher-create-band"
            className="w-full flex items-center gap-2.5 min-h-[48px] px-2.5 rounded-xl text-sm font-semibold text-ink-2 hover:bg-bg-3 hover:text-ink-1"
          >
            <span className="grid place-items-center w-[30px] h-[30px] rounded-[10px] bg-bg-3">
              <Plus size={16} />
            </span>
            Create or join a band
          </button>
        </div>
      )}
    </div>
  )
}

const Option: React.FC<{
  testId: string
  mark: React.ReactNode
  title: string
  sub?: string
  unread?: boolean
  selected: boolean
  onClick: () => void
}> = ({ testId, mark, title, sub, unread, selected, onClick }) => (
  <button
    type="button"
    role="menuitem"
    onClick={onClick}
    data-testid={testId}
    className={`w-full flex items-center gap-2.5 min-h-[52px] px-2.5 rounded-xl text-left hover:bg-bg-3 ${selected ? 'bg-bg-3' : ''}`}
  >
    {mark}
    <span className="flex-1 min-w-0">
      <span className="block truncate text-sm font-bold text-ink-1">
        {title}
      </span>
      {sub && (
        <span className="block truncate text-[11.5px] text-ink-3">{sub}</span>
      )}
    </span>
    {unread && !selected && (
      <span
        className="w-2 h-2 rounded-full bg-accent"
        aria-label="New activity"
      />
    )}
    {selected && <Check size={16} className="text-accent-ink" />}
  </button>
)
