import React, { Suspense, lazy, useEffect, useRef } from 'react'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useParams,
} from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider, useToast } from './contexts/ToastContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './services/queryClient'
import { ProtectedLayoutRoute } from './components/layout/ProtectedLayoutRoute'
import { LoadingSpinner } from './components/common/LoadingSpinner'
import { AuthCallback } from './pages/auth/AuthCallback'
import { FEATURE_FLAGS } from './config/featureFlags'

// Lazy load pages for better performance
const SignInPage = lazy(() => import('./pages/auth/SignInPage'))
const SignUpPage = lazy(() => import('./pages/auth/SignUpPage'))
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'))
const GetStartedPage = lazy(() => import('./pages/auth/GetStartedPage'))
const JamCodePage = lazy(() => import('./pages/auth/JamCodePage'))
const BandPage = lazy(() => import('./pages/BandPage'))
const BandProfilePage = lazy(() => import('./pages/BandProfilePage'))
const BandNewPage = lazy(() => import('./pages/BandNewPage'))
const JoinBandPage = lazy(() => import('./pages/JoinBandPage'))
const TermsPage = lazy(() =>
  import('./pages/LegalPage').then(m => ({ default: m.TermsPage }))
)
const PrivacyPage = lazy(() =>
  import('./pages/LegalPage').then(m => ({ default: m.PrivacyPage }))
)
const SongNewPage = lazy(() =>
  import('./pages/SongNewPage').then(module => ({
    default: module.SongNewPage,
  }))
)
const SongViewPage = lazy(() =>
  import('./pages/SongViewPage').then(module => ({
    default: module.SongViewPage,
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
const PracticeViewPage = lazy(() =>
  import('./pages/PracticeViewPage').then(module => ({
    default: module.PracticeViewPage,
  }))
)
const PracticeSessionPage = lazy(() =>
  import('./pages/PracticeSessionPage').then(module => ({
    default: module.PracticeSessionPage,
  }))
)
const SetlistViewPage = lazy(() =>
  import('./pages/SetlistViewPage').then(module => ({
    default: module.SetlistViewPage,
  }))
)
const ShowViewPage = lazy(() =>
  import('./pages/ShowViewPage').then(module => ({
    default: module.ShowViewPage,
  }))
)
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then(module => ({
    default: module.SettingsPage,
  }))
)
const JamSessionPage = lazy(() =>
  import('./pages/JamSessionPage').then(module => ({
    default: module.JamSessionPage,
  }))
)
const JamViewPage = lazy(() =>
  import('./pages/JamViewPage').then(module => ({
    default: module.JamViewPage,
  }))
)
// mobile-redesign-port: net-new IA screens (Home / Calendar / More / Notifications)
const HomePage = lazy(() =>
  import('./pages/HomePage').then(module => ({ default: module.HomePage }))
)
const CalendarPage = lazy(() =>
  import('./pages/CalendarPage').then(module => ({
    default: module.CalendarPage,
  }))
)
const MorePage = lazy(() =>
  import('./pages/MorePage').then(module => ({ default: module.MorePage }))
)
const NotificationsPage = lazy(() =>
  import('./pages/NotificationsPage').then(module => ({
    default: module.NotificationsPage,
  }))
)
const FriendsPage = lazy(() =>
  import('./pages/FriendsPage').then(module => ({
    default: module.FriendsPage,
  }))
)
const EventsPage = lazy(() =>
  import('./pages/EventsPage').then(module => ({ default: module.EventsPage }))
)
const EventDetailPage = lazy(() =>
  import('./pages/EventDetailPage').then(module => ({
    default: module.EventDetailPage,
  }))
)
const EventCreatePage = lazy(() =>
  import('./pages/EventCreatePage').then(module => ({
    default: module.EventCreatePage,
  }))
)

const ChartPage = lazy(() =>
  import('./pages/ChartPage').then(module => ({ default: module.ChartPage }))
)
const ChartEditPage = lazy(() =>
  import('./pages/ChartEditPage').then(module => ({
    default: module.ChartEditPage,
  }))
)
const ToolsPage = lazy(() =>
  import('./pages/ToolsPage').then(module => ({ default: module.ToolsPage }))
)

// Dev-only pages
const DevAudioHarnessPage = lazy(() =>
  import('./pages/DevAudioHarnessPage').then(module => ({
    default: module.DevAudioHarnessPage,
  }))
)
const DevUIPreviewPage = lazy(() =>
  import('./pages/DevUIPreview/DevUIPreviewPage').then(module => ({
    default: module.DevUIPreviewPage,
  }))
)

/** The practice page edits in place; the old editor URL lands there. */
const PracticeEditRedirect: React.FC = () => {
  const { practiceId } = useParams<{ practiceId: string }>()
  return <Navigate to={`/practices/${practiceId}`} replace />
}

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
      showToast(message, type)
    }
    toastHandlerRef.current = handleToast

    realtimeManager.on('toast', handleToast)

    return () => {
      if (realtimeManager && toastHandlerRef.current) {
        realtimeManager.off('toast', toastHandlerRef.current)
      }
    }
  }, [realtimeManager, showToast])

  return (
    // `bg-bg-0` matches ModernLayout and the app-wide dark theme.
    // The previous `bg-surface` (`#F5F5F5`) caused a light-gray flash to
    // show through during route-level Suspense fallbacks.
    <div className="min-h-screen bg-bg-0">
      {/* Sync indicator overlay — themed to match the app (dark surface
          with brand-orange accent). Previously `bg-blue-600`, which was
          the visible "blue banner" at the top of every page while sync
          was in flight. */}
      {syncing && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-bg-2 border-b border-border-1 text-ink-1 px-4 py-2 text-center text-sm flex items-center justify-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
          <span className="text-ink-3">Syncing your data from cloud...</span>
        </div>
      )}

      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen bg-bg-0">
            <LoadingSpinner size="lg" text="Loading..." />
          </div>
        }
      >
        <Routes>
          {/* Auth routes - public (no layout) */}
          <Route path="/auth" element={<SignInPage />} />
          <Route path="/auth/signup" element={<SignUpPage />} />
          <Route path="/auth/forgot" element={<ForgotPasswordPage />} />
          <Route path="/auth/reset" element={<ResetPasswordPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/get-started" element={<GetStartedPage />} />
          <Route path="/get-started/jam" element={<JamCodePage />} />

          {/* Dev-only preview page (no layout) */}
          <Route path="/dev/ui-preview" element={<DevUIPreviewPage />} />
          {import.meta.env.DEV && (
            <Route
              path="/dev/audio-harness"
              element={<DevAudioHarnessPage />}
            />
          )}

          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />

          {/* Public jam session view — no auth required */}
          <Route path="/jam/view/:shortCode" element={<JamViewPage />} />

          {/* Protected routes - with persistent layout */}
          {/* ModernLayout stays mounted during navigation between these routes */}
          <Route element={<ProtectedLayoutRoute />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/more" element={<MorePage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/friends" element={<FriendsPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/events/new" element={<EventCreatePage />} />
            <Route path="/events/:eventId" element={<EventDetailPage />} />
            <Route path="/songs" element={<SongsPage />} />
            <Route path="/songs/new" element={<SongNewPage />} />
            <Route path="/songs/:songId" element={<SongViewPage />} />
            <Route path="/songs/:songId/chart" element={<ChartPage />} />
            <Route
              path="/songs/:songId/chart/edit"
              element={<ChartEditPage />}
            />
            <Route path="/setlists" element={<SetlistsPage />} />
            <Route path="/setlists/new" element={<SetlistViewPage />} />
            <Route path="/setlists/:setlistId" element={<SetlistViewPage />} />
            <Route
              path="/shows"
              element={
                FEATURE_FLAGS.REDESIGN_CALENDAR ? (
                  <Navigate to="/calendar?type=show" replace />
                ) : (
                  <ShowsPage />
                )
              }
            />
            <Route path="/shows/new" element={<ShowViewPage />} />
            <Route path="/shows/:showId" element={<ShowViewPage />} />
            {/* Practices live on the Calendar; the page (new, edit in place)
                and the session stay. */}
            <Route
              path="/practices"
              element={<Navigate to="/calendar?type=practice" replace />}
            />
            <Route path="/practices/new" element={<PracticeViewPage />} />
            <Route
              path="/practices/:practiceId"
              element={<PracticeViewPage />}
            />
            <Route
              path="/practices/:practiceId/edit"
              element={<PracticeEditRedirect />}
            />
            <Route
              path="/practices/:practiceId/session"
              element={<PracticeSessionPage />}
            />
            <Route path="/band" element={<BandPage />} />
            <Route path="/band/profile" element={<BandProfilePage />} />
            <Route path="/band/new" element={<BandNewPage />} />
            <Route path="/j" element={<JoinBandPage />} />
            <Route path="/j/:code" element={<JoinBandPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/:section" element={<SettingsPage />} />
            <Route path="/jam" element={<JamSessionPage />} />
            <Route path="/jam/:sessionId" element={<JamSessionPage />} />
            <Route path="/tools" element={<ToolsPage />} />
            <Route path="/tools/:tab" element={<ToolsPage />} />
          </Route>
        </Routes>
      </Suspense>
    </div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <ThemeProvider>
            <ToastProvider>
              <AppContent />
            </ToastProvider>
          </ThemeProvider>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  )
}

export default App
