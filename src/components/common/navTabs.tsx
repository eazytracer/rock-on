/**
 * The 5 phone tabs and which paths light each one up (BottomNavigation).
 */
import React from 'react'
import { Home, Music2, ListMusic, Calendar, MoreHorizontal } from 'lucide-react'

export interface NavTab {
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
export const TABS: NavTab[] = [
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

export const isTabActive = (tab: NavTab, pathname: string): boolean =>
  tab.match.some(m =>
    m === '/'
      ? pathname === '/'
      : pathname === m || pathname.startsWith(m + '/')
  )
