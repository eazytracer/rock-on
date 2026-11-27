import { vi } from 'vitest'

/** Shared mocks for the auth screens (theme, toast, auth service). */
export const mockAuthService = {
  signInWithOAuth: vi.fn(),
  requestPasswordReset: vi.fn(),
  resendSignupEmail: vi.fn(),
  updatePassword: vi.fn(),
  getSession: vi.fn(),
}
export const mockShowToast = vi.fn()
