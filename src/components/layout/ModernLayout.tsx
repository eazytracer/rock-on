import React, { useState } from 'react'
import { Sidebar } from './Sidebar'
import { MobileHeader } from './MobileHeader'
import { MobileDrawer } from './MobileDrawer'
import { SyncStatusIndicator, OfflineIndicator } from '../sync'
import { useLocation } from 'react-router-dom'

interface ModernLayoutProps {
  children: React.ReactNode
  bandName?: string
  userEmail?: string
  onSignOut?: () => void
}

export const ModernLayout: React.FC<ModernLayoutProps> = ({
  children,
  bandName,
  userEmail,
  onSignOut
}) => {
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Offline Banner */}
      <OfflineIndicator />

      {/* Sidebar - Desktop Only */}
      <div className="hidden md:block">
        <Sidebar
          currentPath={location.pathname}
          bandName={bandName}
          userEmail={userEmail}
          onSignOut={onSignOut}
        />
      </div>

      {/* Mobile Header */}
      <MobileHeader
        onMenuClick={() => setIsMobileMenuOpen(true)}
        bandName={bandName}
      />

      {/* Mobile Drawer */}
      <MobileDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        currentPath={location.pathname}
        bandName={bandName}
        userEmail={userEmail}
        onSignOut={onSignOut}
      />

      {/* Sync Status Indicator - Fixed position */}
      <div className="fixed bottom-4 right-4 z-50 md:bottom-6 md:right-6">
        <SyncStatusIndicator />
      </div>

      {/* Main Content */}
      <main className="md:ml-60 min-h-screen pt-16 md:pt-0">
        <div className="p-6 md:p-8 lg:p-10">
          {children}
        </div>
      </main>
    </div>
  )
}
