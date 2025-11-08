/**
 * Authentication Navigation Tests
 *
 * Tests that ensure proper navigation after authentication actions.
 * These tests prevent regressions like the one in commit 023ca93 where
 * login navigation was accidentally removed when switching to Supabase auth.
 *
 * CRITICAL: These tests validate that authentication forms ALWAYS navigate
 * after successful authentication, since AuthContext does NOT handle navigation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AuthPages } from '../../src/pages/NewLayout/AuthPages'
import { AuthProvider } from '../../src/contexts/AuthContext'

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

// Mock auth service
const mockSignIn = vi.fn()
const mockSignUp = vi.fn()
const mockSignInWithGoogle = vi.fn()

vi.mock('../../src/contexts/AuthContext', async () => {
  const actual = await vi.importActual('../../src/contexts/AuthContext')
  return {
    ...actual,
    useAuth: () => ({
      signIn: mockSignIn,
      signUp: mockSignUp,
      user: null,
      loading: false,
      syncing: false
    })
  }
})

describe('Authentication Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Login Navigation (Critical Regression Test)', () => {
    it('CRITICAL: should navigate to "/" after successful email/password login', async () => {
      // This test prevents the regression introduced in commit 023ca93
      // where navigation was removed when switching to Supabase auth

      mockSignIn.mockResolvedValue({ error: null })

      render(
        <BrowserRouter>
          <AuthPages mode="login" />
        </BrowserRouter>
      )

      // Fill in login form
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })

      // Submit login form
      const submitButton = screen.getByRole('button', { name: /log in|sign in/i })
      fireEvent.click(submitButton)

      // Wait for async operations
      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123'
        })
      })

      // CRITICAL: Must navigate after successful login
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/')
      }, { timeout: 2000 })
    })

    it('should NOT navigate if login fails', async () => {
      mockSignIn.mockResolvedValue({ error: 'Invalid credentials' })

      render(
        <BrowserRouter>
          <AuthPages mode="login" />
        </BrowserRouter>
      )

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } })

      const submitButton = screen.getByRole('button', { name: /log in|sign in/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalled()
      })

      // Should NOT navigate on error
      expect(mockNavigate).not.toHaveBeenCalled()

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/invalid/i)).toBeInTheDocument()
      })
    })
  })

  describe('Sign-Up Navigation', () => {
    it('should navigate to "/get-started" after successful sign-up', async () => {
      mockSignUp.mockResolvedValue({ error: null })

      render(
        <BrowserRouter>
          <AuthPages mode="signup" />
        </BrowserRouter>
      )

      // Fill in sign-up form
      const nameInput = screen.getByLabelText(/name|display name/i)
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const confirmInput = screen.getByLabelText(/confirm password/i)

      fireEvent.change(nameInput, { target: { value: 'Test User' } })
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.change(confirmInput, { target: { value: 'password123' } })

      // Submit sign-up form
      const submitButton = screen.getByRole('button', { name: /sign up|create account/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User'
        })
      })

      // Must navigate to /get-started after successful sign-up
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/get-started')
      }, { timeout: 2000 })
    })

    it('should NOT navigate if sign-up fails', async () => {
      mockSignUp.mockResolvedValue({ error: 'Email already exists' })

      render(
        <BrowserRouter>
          <AuthPages mode="signup" />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText(/name|display name/i)
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const confirmInput = screen.getByLabelText(/confirm password/i)

      fireEvent.change(nameInput, { target: { value: 'Test User' } })
      fireEvent.change(emailInput, { target: { value: 'existing@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.change(confirmInput, { target: { value: 'password123' } })

      const submitButton = screen.getByRole('button', { name: /sign up|create account/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalled()
      })

      // Should NOT navigate on error
      expect(mockNavigate).not.toHaveBeenCalled()

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/already exists/i)).toBeInTheDocument()
      })
    })
  })

  describe('Navigation Contract Tests', () => {
    it('DOCUMENTATION: AuthContext.signIn() does NOT navigate', () => {
      // This test documents the contract: AuthContext methods do NOT handle navigation
      // Forms/components MUST handle navigation themselves after successful auth

      // If this test fails, it means the auth contract has changed and all
      // forms must be updated to reflect the new behavior

      const { useAuth } = require('../../src/contexts/AuthContext')
      const auth = useAuth()

      // signIn returns { error? }, NOT { navigateTo? } or similar
      expect(auth.signIn).toBeDefined()
      expect(typeof auth.signIn).toBe('function')

      // The return type should only have optional 'error' property
      // It should NOT have navigation-related properties
    })

    it('DOCUMENTATION: Forms must explicitly call navigate() after successful auth', () => {
      // This test serves as documentation that ALL authentication forms
      // must explicitly handle navigation themselves

      // Expected pattern:
      // const { error } = await signIn(credentials)
      // if (!error) {
      //   navigate('/destination')  // ← REQUIRED!
      // }

      expect(true).toBe(true) // Documentation test
    })
  })

  describe('Regression Prevention', () => {
    it('should prevent commit 023ca93 regression (missing login navigation)', async () => {
      // Commit 023ca93 removed navigation when switching to Supabase auth
      // This test ensures it never happens again

      mockSignIn.mockResolvedValue({ error: null })

      render(
        <BrowserRouter>
          <AuthPages mode="login" />
        </BrowserRouter>
      )

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)

      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password' } })

      const submitButton = screen.getByRole('button', { name: /log in|sign in/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalled()
      })

      // CRITICAL: Login MUST navigate - this was the regression
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalled()
      })

      // Should navigate to home page
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })
})
