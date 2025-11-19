import React, { Suspense, lazy, useEffect, useRef } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider, useToast } from './contexts/ToastContext'
import { ItemSyncStatusProvider } from './hooks/useItemSyncStatus.tsx'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoadingSpinner } from './components/common/LoadingSpinner'
import { AuthCallback } from './pages/auth/AuthCallback'
import { SessionExpiredModal } from './components/auth/SessionExpiredModal'

// Lazy load pages for better performance
const NewLayout = lazy(() => import('./pages/NewLayout/NewLayout').then(module => ({ default: module.NewLayout })))

// Pages with database integration
const AuthPages = lazy(() => import('./pages/NewLayout/AuthPages').then(module => ({ default: module.AuthPages })))
const BandMembersPage = lazy(() => import('./pages/NewLayout/BandMembersPage').then(module => ({ default: module.BandMembersPage })))
const SongsPageNew = lazy(() => import('./pages/NewLayout/SongsPage').then(module => ({ default: module.SongsPage })))
const SetlistsPageNew = lazy(() => import('./pages/NewLayout/SetlistsPage').then(module => ({ default: module.SetlistsPage })))
const ShowsPage = lazy(() => import('./pages/NewLayout/ShowsPage').then(module => ({ default: module.ShowsPage })))
const PracticesPage = lazy(() => import('./pages/NewLayout/PracticesPage').then(module => ({ default: module.PracticesPage })))

// Dev-only pages
const DevDashboard = lazy(() => import('./pages/DevDashboard/DevDashboard').then(module => ({ default: module.DevDashboard })))


const AppContent: React.FC = () => {
  const { syncing, realtimeManager } = useAuth()
  const { showToast } = useToast()

  // Listen for toast events from RealtimeManager
  // CRITICAL: We must use a ref to the listener so we can properly clean it up
  // Using the realtimeManager directly in the dependency causes issues
  const toastHandlerRef = useRef<((event: { message: string; type: 'info' | 'success' | 'error' }) => void) | null>(null)

  useEffect(() => {
    if (!realtimeManager) {
      console.warn('[AppContent] No realtimeManager, toast listener not registered')
      return
    }

    // Remove old listener if exists
    if (toastHandlerRef.current) {
      realtimeManager.off('toast', toastHandlerRef.current)
    }

    // Create new listener
    const handleToast = ({ message, type }: { message: string; type: 'info' | 'success' | 'error' }) => {
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
    },
    onEditSetlist: async (setlistId: string, setlistData: Partial<Setlist>) => {
      try {
        setLoading(true)
        // If songs are being updated, recalculate total duration
        if (setlistData.songs) {
          setlistData.totalDuration = setlistData.songs.reduce((total, song) => {
            const foundSong = songs.find(s => s.id === song.songId)
            return total + (foundSong?.duration || 0)
          }, 0)
        }
        await setlistService.update(setlistId, setlistData)
        const updatedSetlists = await setlistService.getAll()
        setSetlists(updatedSetlists)
      } catch (error) {
        console.error('Error editing setlist:', error)
        throw error
      } finally {
        setLoading(false)
      }
    },
    onDeleteSetlist: async (setlistId: string) => {
      try {
        setLoading(true)
        await setlistService.delete(setlistId)
        const updatedSetlists = await setlistService.getAll()
        setSetlists(updatedSetlists)
      } catch (error) {
        console.error('Error deleting setlist:', error)
        throw error
      } finally {
        setLoading(false)
      }
    },
    onDuplicateSetlist: async (setlistId: string) => {
      try {
        setLoading(true)
        const originalSetlist = await setlistService.getById(setlistId)
        if (!originalSetlist) {
          throw new Error('Setlist not found')
        }
        const duplicateData = {
          ...originalSetlist,
          name: `${originalSetlist.name} (Copy)`,
          bandId: originalSetlist.bandId,
          status: 'draft' as const
        }
        // Remove fields that will be auto-generated
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, createdDate, lastModified, ...setlistDataToAdd } = duplicateData
        await setlistService.add(setlistDataToAdd)
        const updatedSetlists = await setlistService.getAll()
        setSetlists(updatedSetlists)
      } catch (error) {
        console.error('Error duplicating setlist:', error)
        throw error
      } finally {
        setLoading(false)
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

          {/* Dev Dashboard - accessible in development only */}
          <Route path="/dev/dashboard" element={<DevDashboard />} />

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
          <ItemSyncStatusProvider>
            <AppContent />
          </ItemSyncStatusProvider>
        </ToastProvider>
      </AuthProvider>
    </Router>
  )
}

export default App