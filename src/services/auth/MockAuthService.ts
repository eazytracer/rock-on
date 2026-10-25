import { User, UserProfile } from '../../models/User'
import { createLogger } from '../../utils/logger'
import {
  IAuthService,
  AuthSession,
  SignUpCredentials,
  SignInCredentials,
  AuthResponse,
} from './types'

const log = createLogger('MockAuthService')

// Mock users for testing
const MOCK_USERS = [
  {
    email: 'alice@example.com',
    password: 'password123',
    name: 'Alice Johnson',
    instruments: ['Guitar', 'Vocals'],
  },
  {
    email: 'bob@example.com',
    password: 'password123',
    name: 'Bob Smith',
    instruments: ['Bass', 'Keyboards'],
  },
  {
    email: 'charlie@example.com',
    password: 'password123',
    name: 'Charlie Davis',
    instruments: ['Drums', 'Percussion'],
  },
]

/**
 * In-memory stores. MockAuthService is a dev/test-only backend (local mode,
 * VITE_MOCK_AUTH=true) that keeps its own ephemeral state. State lives for the
 * tab's lifetime — exactly the mock's intended scope.
 */
const mockUsers = new Map<string, User>()
const mockProfiles = new Map<string, UserProfile>()

export class MockAuthService implements IAuthService {
  private currentSession: AuthSession | null = null
  private listeners: ((session: AuthSession | null) => void)[] = []

  constructor() {
    // Load session from localStorage on init
    this.loadSession()
  }

  private async loadSession(): Promise<void> {
    const sessionData = localStorage.getItem('mock_auth_session')
    if (sessionData) {
      try {
        const session = JSON.parse(sessionData) as AuthSession
        // Check if session is still valid
        if (session.expiresAt > Date.now()) {
          this.currentSession = session
          this.notifyListeners(session)
        } else {
          // Session expired, clear it
          localStorage.removeItem('mock_auth_session')
        }
      } catch (error) {
        log.error('Failed to load session:', error)
        localStorage.removeItem('mock_auth_session')
      }
    }
  }

  private saveSession(session: AuthSession | null): void {
    if (session) {
      localStorage.setItem('mock_auth_session', JSON.stringify(session))
    } else {
      localStorage.removeItem('mock_auth_session')
    }
    this.currentSession = session
    this.notifyListeners(session)
  }

  private notifyListeners(session: AuthSession | null): void {
    this.listeners.forEach(listener => listener(session))
  }

  private async createUser(credentials: SignUpCredentials): Promise<User> {
    const userId = crypto.randomUUID()
    const user: User = {
      id: userId,
      email: credentials.email,
      name: credentials.name,
      authProvider: 'mock',
      createdDate: new Date(),
      lastLogin: new Date(),
    }

    mockUsers.set(user.id, user)
    mockProfiles.set(user.id, {
      id: crypto.randomUUID(),
      userId: user.id,
      displayName: credentials.name,
      instruments: [],
      createdDate: new Date(),
      updatedDate: new Date(),
    })

    return user
  }

  private async findUserByEmail(email: string): Promise<User | null> {
    for (const user of mockUsers.values()) {
      if (user.email === email) return user
    }
    return null
  }

  private createSession(user: User): AuthSession {
    return {
      user,
      accessToken: `mock_token_${user.id}`,
      refreshToken: `mock_refresh_${user.id}`,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    }
  }

  async signUp(credentials: SignUpCredentials): Promise<AuthResponse> {
    try {
      // Check if user already exists
      const existingUser = await this.findUserByEmail(credentials.email)
      if (existingUser) {
        return {
          user: null,
          session: null,
          error: 'User with this email already exists',
        }
      }

      // Create new user
      const user = await this.createUser(credentials)
      const session = this.createSession(user)
      this.saveSession(session)

      return {
        user,
        session,
      }
    } catch (error) {
      log.error('Sign up error:', error)
      return {
        user: null,
        session: null,
        error: 'Failed to sign up',
      }
    }
  }

  async signIn(credentials: SignInCredentials): Promise<AuthResponse> {
    try {
      // Check mock users first
      const mockUser = MOCK_USERS.find(
        u =>
          u.email === credentials.email && u.password === credentials.password
      )

      let user: User | null = null

      if (mockUser) {
        // Check if mock user exists in the in-memory store
        user = await this.findUserByEmail(mockUser.email)

        if (!user) {
          // Create mock user
          user = await this.createUser({
            email: mockUser.email,
            password: mockUser.password,
            name: mockUser.name,
          })

          // Update profile with instruments
          const profile = mockProfiles.get(user.id)
          if (profile) {
            profile.instruments = mockUser.instruments
            profile.primaryInstrument = mockUser.instruments[0]
          }
        }
      } else {
        // Try to find regular user
        user = await this.findUserByEmail(credentials.email)
        if (!user) {
          return {
            user: null,
            session: null,
            error: 'Invalid email or password',
          }
        }
      }

      // Update last login
      user.lastLogin = new Date()
      mockUsers.set(user.id, user)

      const session = this.createSession(user)
      this.saveSession(session)

      return {
        user,
        session,
      }
    } catch (error) {
      log.error('Sign in error:', error)
      return {
        user: null,
        session: null,
        error: 'Failed to sign in',
      }
    }
  }

  async signOut(): Promise<void> {
    this.saveSession(null)
  }

  async getSession(): Promise<AuthSession | null> {
    return this.currentSession
  }

  async refreshSession(): Promise<AuthSession | null> {
    if (!this.currentSession) {
      return null
    }

    // Create a new session with extended expiry
    const newSession = {
      ...this.currentSession,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    }

    this.saveSession(newSession)
    return newSession
  }

  onAuthStateChange(
    callback: (session: AuthSession | null) => void
  ): () => void {
    this.listeners.push(callback)

    // Immediately call with current session
    callback(this.currentSession)

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback)
    }
  }
}

export const mockAuthService = new MockAuthService()
