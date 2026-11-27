import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { TABS, isTabActive } from './navTabs'

/**
 * Mobile bottom navigation (`r-nav`): a floating pill of five icons; the
 * current tab is filled with the accent. Placed by the phone dock
 * (layout/PhoneDock); `inBar` drops its own pill so it shares the dock's bar
 * with the way back to a page's action.
 */
export const BottomNavigation: React.FC<{
  onPick?: () => void
  inBar?: boolean
}> = ({ onPick, inBar }) => {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav
      className={
        inBar
          ? 'flex-1 min-w-0 flex gap-1'
          : 'h-16 rounded-full bg-bg-3 p-1.5 flex gap-1 shadow-float'
      }
      data-testid="bottom-navigation"
    >
      {TABS.map(tab => {
        const active = isTabActive(tab, location.pathname)
        return (
          <button
            key={tab.id}
            onClick={() => {
              onPick?.()
              navigate(tab.path)
            }}
            aria-label={tab.label}
            aria-current={active ? 'page' : undefined}
            data-testid={`bottom-nav-${tab.id}`}
            className={`${inBar ? 'flex-1 min-w-0' : 'w-[58px]'} h-[52px] rounded-full grid place-items-center transition-colors ${
              active
                ? 'bg-accent text-on-accent'
                : 'text-ink-3 hover:text-ink-1'
            }`}
          >
            {tab.icon}
          </button>
        )
      })}
    </nav>
  )
}
