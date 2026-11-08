import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Home, Music2, ListMusic, Calendar, MoreHorizontal } from 'lucide-react'

interface NavTab {
  id: string
  label: string
  path: string
  icon: React.ReactNode
  /** Path prefixes that light up this tab (child routes reached through it). */
  match: string[]
}

/**
 * The 5 canonical mobile tabs (mobile-redesign-port IA):
 * Home · Songs · Sets · Calendar · More.
 * Shows/Practices are reached through Calendar; Jam/Band/Events/Friends/Settings live under More.
 */
const TABS: NavTab[] = [
  {
    id: 'home',
    label: 'Home',
    path: '/',
    icon: <Home size={22} />,
    match: ['/'],
  },
  {
    id: 'songs',
    label: 'Songs',
    path: '/songs',
    icon: <Music2 size={22} />,
    match: ['/songs'],
  },
  {
    id: 'setlists',
    label: 'Sets',
    path: '/setlists',
    icon: <ListMusic size={22} />,
    match: ['/setlists'],
  },
  {
    id: 'calendar',
    label: 'Calendar',
    path: '/calendar',
    icon: <Calendar size={22} />,
    match: ['/calendar', '/shows', '/practices'],
  },
  {
    id: 'more',
    label: 'More',
    path: '/more',
    icon: <MoreHorizontal size={22} />,
    match: [
      '/more',
      '/jam',
      '/band-members',
      '/settings',
      '/profile',
      '/events',
      '/friends',
    ],
  },
]

const isTabActive = (tab: NavTab, pathname: string): boolean =>
  tab.match.some(m =>
    m === '/'
      ? pathname === '/'
      : pathname === m || pathname.startsWith(m + '/')
  )

/**
 * Mobile bottom navigation (`r-nav`): a floating pill of five icons; the
 * current tab is filled with the accent.
 */
export const BottomNavigation: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav
      className="fixed left-1/2 -translate-x-1/2 z-40 h-16 rounded-full bg-bg-3 p-1.5 flex gap-1 shadow-float"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 18px)' }}
      data-testid="bottom-navigation"
    >
      {TABS.map(tab => {
        const active = isTabActive(tab, location.pathname)
        return (
          <button
            key={tab.id}
            onClick={() => navigate(tab.path)}
            aria-label={tab.label}
            aria-current={active ? 'page' : undefined}
            data-testid={`bottom-nav-${tab.id}`}
            className={`w-[58px] h-[52px] rounded-full grid place-items-center transition-colors ${
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
