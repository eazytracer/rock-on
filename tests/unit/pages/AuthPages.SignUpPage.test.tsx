import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock react-router-dom's useNavigate so we can assert navigation while still
// using a real MemoryRouter for useLocation.
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// Mock the auth context — SignUpPage only consumes `signUp`.
const mockSignUp = vi.fn()
vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ signUp: mockSignUp }),
}))

import { SignUpPage } from '../../../src/pages/AuthPages'

const fillForm = () => {
  fireEvent.change(screen.getByTestId('signup-name-input'), {
    target: { value: 'New User' },
  })
  fireEvent.change(screen.getByTestId('signup-email-input'), {
    target: { value: 'new@example.com' },
  })
  fireEvent.change(screen.getByTestId('signup-password-input'), {
    target: { value: 'password123' },
  })
  fireEvent.change(screen.getByTestId('signup-confirm-password-input'), {
    target: { value: 'password123' },
  })
}

const renderPage = (returnTo: string | null = null) =>
  render(
    <MemoryRouter>
      <SignUpPage onSwitchToLogin={vi.fn()} returnTo={returnTo} />
    </MemoryRouter>
  )

describe('SignUpPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the check-email panel and does NOT navigate when confirmation is required', async () => {
    mockSignUp.mockResolvedValue({ needsEmailConfirmation: true })

    renderPage()
    fillForm()
    fireEvent.submit(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByTestId('signup-check-email-panel')).toBeInTheDocument()
    })
    // The panel names the address the link was sent to.
    expect(screen.getByText(/new@example\.com/)).toBeInTheDocument()
    // Critically: no navigation happened.
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('navigates to /get-started when signup completes with a session (no confirmation)', async () => {
    mockSignUp.mockResolvedValue({})

    renderPage()
    fillForm()
    fireEvent.submit(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/get-started')
    })
    expect(
      screen.queryByTestId('signup-check-email-panel')
    ).not.toBeInTheDocument()
  })

  it('navigates to a safe returnTo when provided and no confirmation needed', async () => {
    mockSignUp.mockResolvedValue({})

    renderPage('/events?join=ABC123')
    fillForm()
    fireEvent.submit(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/events?join=ABC123')
    })
    // returnTo is also threaded to signUp so it survives an emailed link.
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@example.com' }),
      '/events?join=ABC123'
    )
  })

  it('shows the error under the email field on failure (no panel, no nav)', async () => {
    mockSignUp.mockResolvedValue({ error: 'Email already registered' })

    renderPage()
    fillForm()
    fireEvent.submit(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText('Email already registered')).toBeInTheDocument()
    })
    expect(
      screen.queryByTestId('signup-check-email-panel')
    ).not.toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
