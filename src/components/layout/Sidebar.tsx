import React from 'react'
import {
  Calendar,
  ListMusic,
  Ticket,
  Disc3,
  Users,
  Settings,
  LogOut
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface SidebarProps {
  currentPath: string
  bandName?: string
  userEmail?: string
  onSignOut?: () => void
  onNavigate?: () => void
}

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
  badge?: number
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath,
  bandName = 'iPod Shuffle',
  userEmail = 'eric@example.com',
  onSignOut,
  onNavigate
}) => {
  const navigate = useNavigate()

  const navItems: NavItem[] = [
    { label: 'Songs', path: '/songs', icon: <Disc3 size={20} /> },
    { label: 'Setlists', path: '/setlists', icon: <ListMusic size={20} /> },
    { label: 'Shows', path: '/shows', icon: <Ticket size={20} /> },
    { label: 'Practices', path: '/practices', icon: <Calendar size={20} /> },
    { label: 'Band Members', path: '/band-members', icon: <Users size={20} /> }
  ]

  const isActive = (path: string) => {
    if (path === '/') return currentPath === '/'
    return currentPath.startsWith(path)
  }

  const handleNavigation = (path: string) => {
    navigate(path)
    onNavigate?.()
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-[#141414] border-r border-[#1f1f1f] flex flex-col p-6 z-50">
      {/* Brand Header */}
      <div className="pb-6 mb-6 border-b border-[#1f1f1f]">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">R</span>
          </div>
          <div className="flex-1">
            <h1 className="text-white font-semibold text-base leading-tight">
              {bandName}
            </h1>
            <p className="text-[#707070] text-xs truncate">{userEmail}</p>
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => handleNavigation(item.path)}
            className={`
              w-full flex items-center gap-3 px-3 py-2 rounded-lg
              text-sm font-medium transition-colors duration-200
              ${
                isActive(item.path)
                  ? 'bg-[#252525] text-white'
                  : 'text-[#a0a0a0] hover:bg-[#1f1f1f] hover:text-white'
              }
            `}
          >
            <span className={isActive(item.path) ? 'text-blue-500' : ''}>
              {item.icon}
            </span>
            <span className="flex-1 text-left">{item.label}</span>
            {item.badge && (
              <span className="bg-blue-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Bottom Actions */}
      <div className="space-y-1 pt-6 border-t border-[#1f1f1f]">
        <button
          onClick={() => handleNavigation('/settings')}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-[#a0a0a0] hover:bg-[#1f1f1f] hover:text-white transition-colors duration-200"
        >
          <Settings size={20} />
          <span>Settings</span>
        </button>
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-[#a0a0a0] hover:bg-[#1f1f1f] hover:text-white transition-colors duration-200"
        >
          <LogOut size={20} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
