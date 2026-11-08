import React from 'react'
import { Sidebar } from './Sidebar'
import { MobileHeader } from './MobileHeader'
import { OfflineBanner } from './OfflineBanner'
import { BottomNavigation } from '../common/BottomNavigation'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { SwitchPromptProvider } from '../../contexts/SwitchPromptContext'
import { SearchProvider, useGlobalSearch } from '../search/SearchOverlay'

interface ModernLayoutProps {
  children: React.ReactNode
}

export const ModernLayout: React.FC<ModernLayoutProps> = ({ children }) => (
  <SwitchPromptProvider>
    <SearchProvider>
      <Shell>{children}</Shell>
    </SearchProvider>
  </SwitchPromptProvider>
)

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation()
  const { signOut } = useAuth()
  const { openSearch } = useGlobalSearch()

  return (
    <div className="min-h-screen bg-bg-1">
      <div className="hidden md:block">
        <Sidebar
          currentPath={location.pathname}
          onSignOut={signOut}
          onSearch={openSearch}
        />
      </div>

      <MobileHeader />

      <main className="md:ml-[248px] min-h-screen pt-16 md:pt-0 pb-28 md:pb-0">
        <div className="px-4 py-5 md:px-7 md:py-6 lg:px-8">
          <OfflineBanner />
          {children}
        </div>
      </main>

      <div className="md:hidden">
        <BottomNavigation />
      </div>
    </div>
  )
}
