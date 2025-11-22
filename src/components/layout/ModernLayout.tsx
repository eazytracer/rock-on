import React, { useState } from 'react'
import { Sidebar } from './Sidebar'
import { MobileHeader } from './MobileHeader'
import { MobileDrawer } from './MobileDrawer'
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
  onSignOut,
}) => {
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
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
        userEmail={userEmail}
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

      {/* Main Content */}
      <main className="md:ml-60 min-h-screen pt-16 md:pt-0">
        <div className="p-6 md:p-8 lg:p-10">{children}</div>
      </main>
    </div>
  )
}
