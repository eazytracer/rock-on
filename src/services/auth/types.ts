import { User } from '../../models/User'

export interface AuthSession {
  user: User
  accessToken: string
  refreshToken?: string
  expiresAt: number
}

export interface SignUpCredentials {
  email: string
  password: string
  name: string
}

export interface SignInCredentials {
  email: string
  password: string
}

export interface AuthResponse {
  user: User | null
  session: AuthSession | null
  error?: string
  /**
   * True when signUp succeeded but no session was returned because Supabase
   * email confirmation is enabled. The user exists but must click the link in
   * their inbox before they can sign in. NOT an error state.
   */
  needsEmailConfirmation?: boolean
}

/**
 * Auth state change event types from Supabase SDK
 */
export type AuthChangeEvent =
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'TOKEN_REFRESHED'
  | 'USER_UPDATED'
  | 'PASSWORD_RECOVERY'

/**
 * Callback for auth state changes with event type
 */
export type AuthStateChangeCallback = (
  event: AuthChangeEvent,
  session: AuthSession | null
) => void

export interface IAuthService {
  signUp(
    credentials: SignUpCredentials,
    returnTo?: string
  ): Promise<AuthResponse>
  signIn(credentials: SignInCredentials): Promise<AuthResponse>
  signOut(): Promise<void>
  getSession(): Promise<AuthSession | null>
  refreshSession(): Promise<AuthSession | null>
  onAuthStateChange(callback: (session: AuthSession | null) => void): () => void
  /**
   * Subscribe to auth state changes with event type information.
   * Provides more granular control than onAuthStateChange.
   */
  onAuthStateChangeWithEvent?(callback: AuthStateChangeCallback): () => void
}
