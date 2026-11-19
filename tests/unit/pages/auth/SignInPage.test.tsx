import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockAuthService, mockShowToast } from './authPageMocks'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockSignIn = vi.fn()
vi.mock('../../../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ signIn: mockSignIn }),
}))
vi.mock('../../../../src/contexts/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'dark' }),
}))
vi.mock('../../../../src/contexts/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))
vi.mock('../../../../src/services/auth/AuthFactory', () => ({
  authService: mockAuthService,
}))

import { SignInPage } from '../../../../src/pages/auth/SignInPage'

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/auth" element={<SignInPage />} />
        <Route path="/auth/signup" element={<div>signup route</div>} />
      </Routes>
    </MemoryRouter>
  )

const fill = () => {
  fireEvent.change(screen.getByTestId('login-email-input'), {
    target: { value: 'eric@testband.demo' },
  })
  fireEvent.change(screen.getByTestId('login-password-input'), {
    target: { value: 'nope-nope' },
  })
}

describe('SignInPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('wrong password: inline message with a reset link, red ring on the password', async () => {
    mockSignIn.mockResolvedValue({ error: 'Invalid login credentials' })
    renderAt('/auth')
    fill()
    fireEvent.click(screen.getByTestId('sign-in-button'))
    const err = await screen.findByTestId('sign-in-error')
    expect(err).toHaveTextContent(
      "That email and password don't match. Check for typos, or reset your password."
    )
    expect(screen.getByTestId('sign-in-error-reset-link')).toHaveAttribute(
      'href',
      '/auth/forgot'
    )
    expect(screen.getByTestId('login-password-input')).toHaveAttribute(
      'aria-invalid',
      'true'
    )
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('goes to returnTo after signing in', async () => {
    mockSignIn.mockResolvedValue({})
    renderAt('/auth?returnTo=%2Fj%2FABC123')
    fill()
    fireEvent.click(screen.getByTestId('sign-in-button'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/j/ABC123'))
  })

  it('ignores an unsafe returnTo', async () => {
    mockSignIn.mockResolvedValue({})
    renderAt('/auth?returnTo=https%3A%2F%2Fevil.example')
    fill()
    fireEvent.click(screen.getByTestId('sign-in-button'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'))
  })

  it.each([
    [
      '/auth?reason=signed-out',
      "You've been signed out. Please sign in again.",
    ],
    [
      '/auth?reason=session-error',
      'There was a problem with your session. Please sign in again.',
    ],
    ['/auth?error=access_denied', /cancelled/i],
  ])('shows the arrival reason inline for %s', (url, text) => {
    renderAt(url)
    expect(screen.getByTestId('sign-in-error')).toHaveTextContent(text)
  })

  it('no inline message on a plain visit', () => {
    renderAt('/auth')
    expect(screen.queryByTestId('sign-in-error')).not.toBeInTheDocument()
  })

  it('Google passes the provider and returnTo', async () => {
    mockAuthService.signInWithOAuth.mockResolvedValue({})
    renderAt('/auth?returnTo=%2Fj%2FABC123')
    fireEvent.click(screen.getByTestId('auth-google-button'))
    await waitFor(() =>
      expect(mockAuthService.signInWithOAuth).toHaveBeenCalledWith(
        'google',
        '/j/ABC123'
      )
    )
  })

  it('redirects the old ?view=signup link to /auth/signup', () => {
    renderAt('/auth?view=signup&returnTo=%2Fjam%2FX')
    expect(screen.getByText('signup route')).toBeInTheDocument()
  })
})
