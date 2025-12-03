import React, { Suspense, lazy, useEffect, useRef } from 'react'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider, useToast } from './contexts/ToastContext'
import { ItemSyncStatusProvider } from './hooks/useItemSyncStatus.tsx'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoadingSpinner } from './components/common/LoadingSpinner'
import { AuthCallback } from './pages/auth/AuthCallback'
import { SessionExpiredModal } from './components/auth/SessionExpiredModal'

// Lazy load pages for better performance
const AuthPages = lazy(() =>
  import('./pages/AuthPages').then(module => ({
    default: module.AuthPages,
  }))
)
const BandMembersPage = lazy(() =>
  import('./pages/BandMembersPage').then(module => ({
    default: module.BandMembersPage,
  }))
)
const SongsPage = lazy(() =>
  import('./pages/SongsPage').then(module => ({
    default: module.SongsPage,
  }))
)
const SetlistsPage = lazy(() =>
  import('./pages/SetlistsPage').then(module => ({
    default: module.SetlistsPage,
  }))
)
const ShowsPage = lazy(() =>
  import('./pages/ShowsPage').then(module => ({
    default: module.ShowsPage,
  }))
)
const PracticesPage = lazy(() =>
  import('./pages/PracticesPage').then(module => ({
    default: module.PracticesPage,
  }))
)
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then(module => ({
    default: module.SettingsPage,
  }))
)

// Dev-only pages
const DevDashboard = lazy(() =>
  import('./pages/DevDashboard/DevDashboard').then(module => ({
    default: module.DevDashboard,
  }))
)

const AppContent: React.FC = () => {
  const { syncing, realtimeManager } = useAuth()
  const { showToast } = useToast()

  // Listen for toast events from RealtimeManager
  // CRITICAL: We must use a ref to the listener so we can properly clean it up
  // Using the realtimeManager directly in the dependency causes issues
  const toastHandlerRef = useRef<
    | ((event: { message: string; type: 'info' | 'success' | 'error' }) => void)
    | null
  >(null)

  useEffect(() => {
    if (!realtimeManager) {
      console.warn(
        '[AppContent] No realtimeManager, toast listener not registered'
      )
      return
    }

    // Remove old listener if exists
    if (toastHandlerRef.current) {
      realtimeManager.off('toast', toastHandlerRef.current)
    }

    // Create new listener
    const handleToast = ({
      message,
      type,
    }: {
      message: string
      type: 'info' | 'success' | 'error'
    }) => {
      console.log('[AppContent] Realtime toast received:', message, type)
      showToast(message, type)
    }
    toastHandlerRef.current = handleToast

    console.log('[AppContent] Registering toast listener')
    realtimeManager.on('toast', handleToast)

    return () => {
      if (realtimeManager && toastHandlerRef.current) {
        console.log('[AppContent] Unregistering toast listener')
        realtimeManager.off('toast', toastHandlerRef.current)
      }
    }
  }, [realtimeManager, showToast])

  return (
    <div className="min-h-screen bg-surface">
      {/* Session expiry modal */}
      <SessionExpiredModal />

      {/* Sync indicator overlay */}
      {syncing && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white px-4 py-2 text-center text-sm flex items-center justify-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
          <span>Syncing your data from cloud...</span>
        </div>
      )}

      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            <LoadingSpinner size="lg" text="Loading..." />
          </div>
        }
      >
        <Routes>
          {/* Auth routes - public */}
          <Route path="/auth" element={<AuthPages />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/get-started" element={<AuthPages />} />

          {/* Protected routes */}
          <Route
            path="/songs"
            element={
              <ProtectedRoute>
                <SongsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/setlists"
            element={
              <ProtectedRoute>
                <SetlistsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/shows"
            element={
              <ProtectedRoute>
                <ShowsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/practices"
            element={
              <ProtectedRoute>
                <PracticesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/band-members"
            element={
              <ProtectedRoute>
                <BandMembersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />

          {/* Default route - redirect to songs */}
          <Route path="/" element={<Navigate to="/songs" replace />} />

          {/* Dev Dashboard - accessible in development only */}
          <Route path="/dev/dashboard" element={<DevDashboard />} />
        </Routes>
      </Suspense>
    </div>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <ItemSyncStatusProvider>
            <AppContent />
          </ItemSyncStatusProvider>
        </ToastProvider>
      </AuthProvider>
    </Router>
  )
}

export default App
