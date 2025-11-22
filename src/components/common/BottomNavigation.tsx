import React from 'react'

interface NavigationItem {
  id: string
  label: string
  icon: React.ReactNode
  path: string
  badge?: number
}

interface BottomNavigationProps {
  currentPath: string
  onNavigate: (path: string) => void
  items: NavigationItem[]
  className?: string
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  currentPath,
  onNavigate,
  items,
  className = '',
}) => {
  const handleItemClick = (path: string) => {
    onNavigate(path)
  }

  const navigationClasses = [
    'fixed bottom-0 left-0 right-0 z-50',
    'bg-smoke-white border-t border-steel-gray/20 shadow-lg',
    'safe-bottom',
    className,
  ].join(' ')

  return (
    <nav className={navigationClasses}>
      <div className="flex items-center justify-around px-2 py-2">
        {items.map(item => {
          const isActive =
            currentPath === item.path || currentPath.startsWith(item.path + '/')

          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item.path)}
              className={`
                relative flex flex-col items-center justify-center
                min-w-[56px] min-h-[56px] p-2 rounded-lg
                transition-all duration-200 touch-manipulation
                ${
                  isActive
                    ? 'text-energy-orange bg-energy-orange/10'
                    : 'text-steel-gray hover:text-energy-orange hover:bg-energy-orange/5 active:bg-energy-orange/10'
                }
              `}
              aria-label={item.label}
            >
              <div className="flex items-center justify-center w-6 h-6 mb-1">
                {item.icon}
              </div>
              <span
                className={`
                text-xs font-medium leading-none
                ${isActive ? 'text-energy-orange' : 'text-steel-gray'}
              `}
              >
                {item.label}
              </span>

              {item.badge && item.badge > 0 && (
                <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-amp-red rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-white">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

// Default navigation items for the Rock On! app
// Updated to match new database-connected pages
export const defaultNavigationItems: NavigationItem[] = [
  {
    id: 'songs',
    label: 'Songs',
    path: '/songs',
    icon: (
      <svg
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        className="w-6 h-6"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
        />
      </svg>
    ),
  },
  {
    id: 'setlists',
    label: 'Setlists',
    path: '/setlists',
    icon: (
      <svg
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        className="w-6 h-6"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
  {
    id: 'shows',
    label: 'Shows',
    path: '/shows',
    icon: (
      <svg
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        className="w-6 h-6"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
  },
  {
    id: 'practices',
    label: 'Practice',
    path: '/practices',
    icon: (
      <svg
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        className="w-6 h-6"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
]

// Hook for managing bottom navigation state
export const useBottomNavigation = () => {
  const [currentPath, setCurrentPath] = React.useState(window.location.pathname)

  React.useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname)
    }

    window.addEventListener('popstate', handleLocationChange)
    return () => window.removeEventListener('popstate', handleLocationChange)
  }, [])

  const navigate = (path: string) => {
    if (path !== currentPath) {
      window.history.pushState({}, '', path)
      setCurrentPath(path)

      // Dispatch a custom event for route changes
      window.dispatchEvent(new CustomEvent('routechange', { detail: { path } }))
    }
  }

  return { currentPath, navigate }
}
