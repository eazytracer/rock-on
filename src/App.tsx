import React, { Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoadingSpinner } from './components/common/LoadingSpinner'
import { AuthCallback } from './pages/auth/AuthCallback'

// Lazy load pages for better performance
const NewLayout = lazy(() => import('./pages/NewLayout/NewLayout').then(module => ({ default: module.NewLayout })))

// Pages with database integration
const AuthPages = lazy(() => import('./pages/NewLayout/AuthPages').then(module => ({ default: module.AuthPages })))
const BandMembersPage = lazy(() => import('./pages/NewLayout/BandMembersPage').then(module => ({ default: module.BandMembersPage })))
const SongsPageNew = lazy(() => import('./pages/NewLayout/SongsPage').then(module => ({ default: module.SongsPage })))
const SetlistsPageNew = lazy(() => import('./pages/NewLayout/SetlistsPage').then(module => ({ default: module.SetlistsPage })))
const ShowsPage = lazy(() => import('./pages/NewLayout/ShowsPage').then(module => ({ default: module.ShowsPage })))
const PracticesPage = lazy(() => import('./pages/NewLayout/PracticesPage').then(module => ({ default: module.PracticesPage })))


const AppContent: React.FC = () => {
  const { syncing } = useAuth()

  return (
    <div className="min-h-screen bg-surface">
      {/* Sync indicator overlay */}
      {syncing && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white px-4 py-2 text-center text-sm flex items-center justify-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
          <span>Syncing your data from cloud...</span>
        </div>
      )}

      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" text="Loading..." />
        </div>
      }>
        <Routes>
          {/* Auth routes - public */}
          <Route path="/auth" element={<AuthPages />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/get-started" element={<AuthPages />} />

          {/* Protected routes - new database-connected pages (primary) */}
          <Route
            path="/songs"
            element={
              <ProtectedRoute>
                <SongsPageNew />
              </ProtectedRoute>
            }
          />
          <Route
            path="/setlists"
            element={
              <ProtectedRoute>
                <SetlistsPageNew />
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

          {/* Default route - redirect to songs */}
          <Route path="/" element={<Navigate to="/songs" replace />} />

          {/* New layout demo route */}
          <Route path="/new-layout/*" element={<NewLayout />} />
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
          <AppContent />
        </ToastProvider>
      </AuthProvider>
    </Router>
  )
}

export default App