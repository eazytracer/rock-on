import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the hooks and components
vi.mock('../../../../src/hooks/useAuthCheck', () => ({
  useAuthCheck: vi.fn(),
}))

vi.mock('../../../../src/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('../../../../src/components/layout/ModernLayout', () => ({
  ModernLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="modern-layout">{children}</div>
  ),
}))

import { ProtectedLayoutRoute } from '../../../../src/components/layout/ProtectedLayoutRoute'
import { useAuthCheck } from '../../../../src/hooks/useAuthCheck'
import { useAuth } from '../../../../src/contexts/AuthContext'

const mockUseAuthCheck = vi.mocked(useAuthCheck)
const mockUseAuth = vi.mocked(useAuth)

// Helper to render with router
const renderWithRouter = (initialEntries = ['/']) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route element={<ProtectedLayoutRoute />}>
          <Route path="/" element={<div data-testid="home-page">Home</div>} />
          <Route
            path="/songs"
            element={<div data-testid="songs-page">Songs</div>}
          />
        </Route>
        <Route path="/auth" element={<div data-testid="auth-page">Auth</div>} />
        <Route
          path="/auth"
          element={<div data-testid="auth-page-get-started">Get Started</div>}
        />
      </Routes>
    </MemoryRouter>
  )
}

describe('ProtectedLayoutRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock values
    mockUseAuth.mockReturnValue({
      sessionExpired: false,
      user: null,
      currentBand: null,
      signOut: vi.fn(),
      syncing: false,
      realtimeManager: null,
    } as ReturnType<typeof useAuth>)
  })

  describe('Loading State', () => {
    it('shows auth-loading-spinner when isChecking is true', () => {
      mockUseAuthCheck.mockReturnValue({
        isAuthenticated: false,
        isChecking: true,
        failureReason: null,
      })

      renderWithRouter(['/songs'])

      expect(screen.getByTestId('auth-loading-spinner')).toBeInTheDocument()
      expect(screen.queryByTestId('modern-layout')).not.toBeInTheDocument()
    })
  })

  describe('Redirect Behavior', () => {
    it('redirects to /auth when failureReason is no-user', () => {
      mockUseAuthCheck.mockReturnValue({
        isAuthenticated: false,
        isChecking: false,
        failureReason: 'no-user',
      })

      renderWithRouter(['/songs'])

      // Should redirect to auth page
      expect(screen.getByTestId('auth-page')).toBeInTheDocument()
      expect(screen.queryByTestId('modern-layout')).not.toBeInTheDocument()
    })

    it('renders the app for an authenticated user with no band (personal/guest account)', () => {
      // No band is no longer an auth failure — a band-less user is authenticated
      // and gets the full app (which degrades gracefully around the missing band).
      mockUseAuthCheck.mockReturnValue({
        isAuthenticated: true,
        isChecking: false,
        hasBand: false,
        failureReason: null,
      })

      renderWithRouter(['/songs'])

      // Should render the layout, NOT redirect to get-started
      expect(screen.getByTestId('modern-layout')).toBeInTheDocument()
      expect(screen.queryByTestId('auth-page')).not.toBeInTheDocument()
    })

    it('redirects to /auth?reason=session-expired when sessionExpired is true', () => {
      mockUseAuthCheck.mockReturnValue({
        isAuthenticated: true,
        isChecking: false,
        failureReason: null,
      })

      mockUseAuth.mockReturnValue({
        sessionExpired: true,
        user: null,
        currentBand: null,
        signOut: vi.fn(),
        syncing: false,
        realtimeManager: null,
      } as ReturnType<typeof useAuth>)

      renderWithRouter(['/songs'])

      // Should redirect to auth page with session-expired reason
      expect(screen.getByTestId('auth-page')).toBeInTheDocument()
      expect(screen.queryByTestId('modern-layout')).not.toBeInTheDocument()
    })
  })

  describe('returnTo preservation', () => {
    // Probe that surfaces the auth page's full URL (path + query) so we can
    // assert the returnTo param survived the redirect.
    const AuthProbe = () => {
      const loc = useLocation()
      return <div data-testid="auth-probe">{loc.pathname + loc.search}</div>
    }

    const renderWithProbe = (initialEntries: string[]) =>
      render(
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route element={<ProtectedLayoutRoute />}>
              <Route
                path="/events"
                element={<div data-testid="events-page">Events</div>}
              />
            </Route>
            <Route path="/auth" element={<AuthProbe />} />
          </Routes>
        </MemoryRouter>
      )

    it('redirects an unauthenticated user with returnTo capturing path + query', () => {
      mockUseAuthCheck.mockReturnValue({
        isAuthenticated: false,
        isChecking: false,
        failureReason: 'no-user',
      })

      renderWithProbe(['/events?join=ABC123'])

      const probe = screen.getByTestId('auth-probe')
      expect(probe.textContent).toContain('/auth')
      expect(probe.textContent).toContain(
        `returnTo=${encodeURIComponent('/events?join=ABC123')}`
      )
    })

    it('attaches returnTo to session-expired redirects too', () => {
      mockUseAuthCheck.mockReturnValue({
        isAuthenticated: false,
        isChecking: false,
        failureReason: 'session-expired',
      })

      renderWithProbe(['/events?join=XYZ'])

      const probe = screen.getByTestId('auth-probe')
      expect(probe.textContent).toContain('reason=session-expired')
      expect(probe.textContent).toContain(
        `returnTo=${encodeURIComponent('/events?join=XYZ')}`
      )
    })
  })

  describe('Authenticated State', () => {
    it('renders ModernLayout and Outlet when authenticated', () => {
      mockUseAuthCheck.mockReturnValue({
        isAuthenticated: true,
        isChecking: false,
        failureReason: null,
      })

      mockUseAuth.mockReturnValue({
        sessionExpired: false,
        user: { id: 'user-1', email: 'test@test.com' },
        currentBand: { id: 'band-1', name: 'Test Band' },
        signOut: vi.fn(),
        syncing: false,
        realtimeManager: null,
      } as unknown as ReturnType<typeof useAuth>)

      renderWithRouter(['/songs'])

      // ModernLayout should be rendered
      expect(screen.getByTestId('modern-layout')).toBeInTheDocument()
      // Outlet should render the songs page
      expect(screen.getByTestId('songs-page')).toBeInTheDocument()
      // No loading spinner
      expect(
        screen.queryByTestId('auth-loading-spinner')
      ).not.toBeInTheDocument()
    })
  })
})
