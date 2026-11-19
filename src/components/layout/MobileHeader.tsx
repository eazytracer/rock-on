/**
 * Mobile app bar (`r-ab`). Left: the page's way back (`<BackCrumb>`), when it
 * has one. Right: the context chip (just the band mark beside a back crumb),
 * search (Home only — DECISIONS) and the bell with a dot for unread.
 *
 * Pages put their way back in `<BackCrumb>`: portalled into the bar on phones,
 * a pill in place from md up (where the page lays it out itself).
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { Bell, ChevronLeft, Search } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ContextSwitcher } from './ContextSwitcher'
import { useHasUnread } from '../../hooks/useNotifications'
import { useMediaQuery } from '../../hooks/useResponsive'
import { useGlobalSearch } from '../search/SearchOverlay'

const roundBtn =
  'relative w-11 h-11 rounded-full bg-bg-3 grid place-items-center text-ink-1'

interface TopBarState {
  /** The bar's back slot; null from md up, where crumbs stay in place. */
  slot: HTMLElement | null
  register: () => () => void
}

const TopBarContext = createContext<TopBarState | null>(null)

/**
 * The way back to where this page came from: "‹ Songs", "‹ Calendar". In the
 * mobile app bar on phones; a pill in place (wrapped in `className`) from md up.
 */
export const BackCrumb: React.FC<{
  label: string
  /** A link, or `onClick` for history-aware backs. */
  to?: string
  onClick?: () => void
  className?: string
  'data-testid': string
}> = ({ label, to, onClick, className, 'data-testid': testId }) => {
  const bar = useContext(TopBarContext)
  const inBar = !!bar?.slot
  const register = bar?.register
  useLayoutEffect(
    () => (inBar && register ? register() : undefined),
    [inBar, register]
  )
  const cls =
    'h-10 pl-2 pr-3.5 rounded-full bg-bg-3 text-ink-1 font-semibold inline-flex items-center gap-1 min-w-0 max-w-full md:max-w-[260px] hover:bg-bg-4'
  const body = (
    <>
      <ChevronLeft size={19} className="shrink-0" />
      <span className="truncate">{label}</span>
    </>
  )
  const pill = to ? (
    <Link to={to} className={cls} data-testid={testId}>
      {body}
    </Link>
  ) : (
    <button
      type="button"
      onClick={onClick}
      className={cls}
      data-testid={testId}
    >
      {body}
    </button>
  )
  if (!inBar) return className ? <div className={className}>{pill}</div> : pill
  return createPortal(pill, bar!.slot!)
}

/** Holds the app bar's back slot; renders the bar, then the page. */
export const TopBarProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const [backs, setBacks] = useState(0)
  const desktop = useMediaQuery('(min-width: 768px)')
  const register = useCallback(() => {
    setBacks(n => n + 1)
    return () => setBacks(n => n - 1)
  }, [])
  return (
    <TopBarContext.Provider value={{ slot: desktop ? null : slot, register }}>
      <MobileHeader hasBack={backs > 0} onSlot={setSlot} />
      {children}
    </TopBarContext.Provider>
  )
}

const MobileHeader: React.FC<{
  hasBack: boolean
  onSlot: (el: HTMLElement | null) => void
}> = ({ hasBack, onSlot }) => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const hasUnread = useHasUnread()
  const { openSearch } = useGlobalSearch()

  return (
    <header
      className="md:hidden fixed top-0 left-0 right-0 z-30 bg-bg-1/95 backdrop-blur-sm flex items-center gap-2 px-4 h-16"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
      data-testid="mobile-header"
    >
      <div
        ref={onSlot}
        className="flex-1 min-w-0 flex"
        data-testid="mobile-header-back"
      />
      <ContextSwitcher variant="mobile" compact={hasBack} />
      {pathname === '/' && (
        <button
          onClick={openSearch}
          className={roundBtn}
          aria-label="Search"
          data-testid="mobile-header-search"
        >
          <Search size={20} />
        </button>
      )}
      <button
        onClick={() => navigate('/notifications')}
        className={roundBtn}
        aria-label="Notifications"
        data-testid="mobile-header-notifications"
      >
        <Bell size={20} />
        {hasUnread && (
          <span
            className="absolute right-[9px] top-[9px] w-[9px] h-[9px] rounded-full bg-accent ring-2 ring-bg-3"
            data-testid="notifications-unread-dot"
          />
        )}
      </button>
    </header>
  )
}
