import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Home, Disc3, ListMusic, Calendar, LayoutGrid } from 'lucide-react'

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
    icon: <Disc3 size={22} />,
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
    icon: <LayoutGrid size={22} />,
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
 * Mobile bottom navigation bar. Router-driven; rendered mobile-only by ModernLayout.
 */
export const BottomNavigation: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-bg-1 border-t border-border-1"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      data-testid="bottom-navigation"
    >
      <div className="flex items-stretch justify-around px-1.5 pt-2 pb-1.5">
        {TABS.map(tab => {
          const active = isTabActive(tab, location.pathname)
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              aria-label={tab.label}
              aria-current={active ? 'page' : undefined}
              data-testid={`bottom-nav-${tab.id}`}
              className={`flex flex-1 flex-col items-center gap-1 py-1 min-h-touch rounded-lg transition-colors ${
                active ? 'text-accent' : 'text-ink-4 hover:text-ink-2'
              }`}
            >
              {tab.icon}
              <span
                className={`text-[10.5px] leading-none ${active ? 'font-semibold' : 'font-medium'}`}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
