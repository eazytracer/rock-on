import React from 'react'
import { Bell, Search } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ContextSwitcher } from './ContextSwitcher'
import { useHasUnread } from '../../hooks/useNotifications'
import { useGlobalSearch } from '../search/SearchOverlay'

const roundBtn =
  'relative w-11 h-11 rounded-full bg-bg-3 grid place-items-center text-ink-1'

/**
 * Mobile app bar (`r-ab`): the context chip, then search (Home only —
 * DECISIONS) and the bell with a dot for unread.
 */
export const MobileHeader: React.FC = () => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const hasUnread = useHasUnread()
  const { openSearch } = useGlobalSearch()

  return (
    <header
      className="md:hidden fixed top-0 left-0 right-0 z-30 bg-bg-1/95 backdrop-blur-sm flex items-center justify-between gap-2 px-4 h-16"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <ContextSwitcher variant="mobile" />
      <div className="flex items-center gap-2">
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
      </div>
    </header>
  )
}
