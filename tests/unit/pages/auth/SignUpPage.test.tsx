import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockAuthService, mockShowToast } from './authPageMocks'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockSignUp = vi.fn()
vi.mock('../../../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ signUp: mockSignUp }),
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

import { SignUpPage } from '../../../../src/pages/auth/SignUpPage'

const fillForm = (password = 'password123') => {
  fireEvent.change(screen.getByTestId('signup-name-input'), {
    target: { value: 'New User' },
  })
  fireEvent.change(screen.getByTestId('signup-email-input'), {
    target: { value: 'new@example.com' },
  })
  fireEvent.change(screen.getByTestId('signup-password-input'), {
    target: { value: password },
  })
}
const submit = () => fireEvent.click(screen.getByTestId('signup-submit-button'))

const renderPage = (returnTo: string | null = null) =>
  render(
    <MemoryRouter
      initialEntries={[
        returnTo
          ? `/auth/signup?returnTo=${encodeURIComponent(returnTo)}`
          : '/auth/signup',
      ]}
    >
      <SignUpPage />
    </MemoryRouter>
  )

describe('SignUpPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('currentUserId', 'user-1') // AuthContext finished
  })

  it('has one password field (no confirm)', () => {
    const { container } = renderPage()
    expect(container.querySelectorAll('input[type="password"]')).toHaveLength(1)
    expect(
      screen.queryByTestId('signup-confirm-password-input')
    ).not.toBeInTheDocument()
  })

  it('refuses passwords under 8 characters without calling signUp', async () => {
    renderPage()
    fillForm('short7!')
    submit()
    expect(await screen.findByTestId('sign-up-error')).toHaveTextContent(
      /at least 8 characters/i
    )
    expect(mockSignUp).not.toHaveBeenCalled()
  })

  it('shows Check your email (with the address) and does not navigate when confirmation is required', async () => {
    mockSignUp.mockResolvedValue({ needsEmailConfirmation: true })
    renderPage()
    fillForm()
    submit()
    expect(await screen.findByTestId('check-email-page')).toBeInTheDocument()
    expect(screen.getByTestId('check-email-address')).toHaveTextContent(
      'new@example.com'
    )
    expect(screen.getByTestId('check-email-resend-button')).toBeDisabled()
    expect(screen.queryByText(/open mail/i)).not.toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('Use a different email returns to the form', async () => {
    mockSignUp.mockResolvedValue({ needsEmailConfirmation: true })
    renderPage()
    fillForm()
    submit()
    fireEvent.click(await screen.findByTestId('check-email-different-button'))
    expect(screen.getByTestId('sign-up-page')).toBeInTheDocument()
  })

  it('navigates to /get-started when signup returns a session', async () => {
    mockSignUp.mockResolvedValue({})
    renderPage()
    fillForm()
    submit()
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/get-started')
    )
  })

  it('navigates to a safe returnTo and threads it to signUp', async () => {
    mockSignUp.mockResolvedValue({})
    renderPage('/j/ABC123')
    fillForm()
    submit()
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/j/ABC123'))
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@example.com' }),
      '/j/ABC123'
    )
  })

  it('shows a server error inline (no panel, no nav)', async () => {
    mockSignUp.mockResolvedValue({ error: 'User already registered' })
    renderPage()
    fillForm()
    submit()
    expect(await screen.findByTestId('sign-up-error')).toHaveTextContent(
      'User already registered'
    )
    expect(screen.queryByTestId('check-email-page')).not.toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
