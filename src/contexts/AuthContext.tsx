import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, UserProfile } from '../models/User'
import { Band } from '../models/Band'
import { db } from '../services/database'
import { mockAuthService } from '../services/auth/MockAuthService'
import { AuthSession, SignUpCredentials, SignInCredentials, IAuthService } from '../services/auth/types'
import { SessionManager } from '../services/auth/SessionManager'

interface AuthContextType {
  // Legacy auth fields (keep for backward compatibility)
  user: User | null
  session: AuthSession | null
  loading: boolean
  signUp: (credentials: SignUpCredentials) => Promise<{ error?: string }>
  signIn: (credentials: SignInCredentials) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  isAuthenticated: boolean

  // New database-connected auth fields
  currentUser: User | null
  currentUserProfile: UserProfile | null
  currentBand: Band | null
  currentBandId: string | null
  currentUserRole: 'admin' | 'member' | 'viewer' | null
  userBands: Band[]
  login: (userId: string) => Promise<void>
  logout: () => void
  switchBand: (bandId: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
  authService?: IAuthService
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  authService = mockAuthService
}) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [loading, setLoading] = useState(true)

  // New database-connected state
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null)
  const [currentBand, setCurrentBand] = useState<Band | null>(null)
  const [currentBandId, setCurrentBandId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'member' | 'viewer' | null>(null)
  const [userBands, setUserBands] = useState<Band[]>([])

  useEffect(() => {
    // Load initial session
    const loadInitialSession = async () => {
      setLoading(true)
      try {
        const currentSession = await authService.getSession()
        if (currentSession) {
          setSession(currentSession)
          setUser(currentSession.user)
        }

        // Load current user from localStorage
        const storedUserId = localStorage.getItem('currentUserId')
        const storedBandId = localStorage.getItem('currentBandId')

        if (storedUserId) {
          await loadUserData(storedUserId, storedBandId)
        }
      } catch (error) {
        console.error('Failed to load initial session:', error)
      } finally {
        setLoading(false)
      }
    }

    loadInitialSession()

    // Subscribe to auth state changes
    const unsubscribe = authService.onAuthStateChange((newSession) => {
      setSession(newSession)
      setUser(newSession?.user || null)
      SessionManager.saveSession(newSession)
    })

    return () => {
      unsubscribe()
    }
  }, [authService])

  const loadUserData = async (userId: string, bandId: string | null) => {
    try {
      // Load user from database
      const dbUser = await db.users.get(userId)
      setCurrentUser(dbUser || null)

      // Load user profile
      const profile = await db.userProfiles
        .where('userId')
        .equals(userId)
        .first()
      setCurrentUserProfile(profile || null)

      // Load all bands user is a member of
      const memberships = await db.bandMemberships
        .where('userId')
        .equals(userId)
        .filter(m => m.status === 'active')
        .toArray()

      const bands = await Promise.all(
        memberships.map(async (membership) => {
          const band = await db.bands.get(membership.bandId)
          return band
        })
      )
      setUserBands(bands.filter((b): b is Band => b !== undefined))

      // Load current band and role
      if (bandId) {
        const band = await db.bands.get(bandId)
        setCurrentBand(band || null)
        setCurrentBandId(bandId)

        const membership = memberships.find(m => m.bandId === bandId)
        setCurrentUserRole(membership?.role || null)
      } else if (bands.length > 0 && bands[0]) {
        // Auto-select first band if no bandId in localStorage
        const firstBand = bands[0]
        setCurrentBand(firstBand)
        setCurrentBandId(firstBand.id)
        localStorage.setItem('currentBandId', firstBand.id)

        const membership = memberships.find(m => m.bandId === firstBand.id)
        setCurrentUserRole(membership?.role || null)
      }
    } catch (error) {
      console.error('Failed to load user data:', error)
    }
  }

  const signUp = async (credentials: SignUpCredentials) => {
    setLoading(true)
    try {
      const response = await authService.signUp(credentials)
      if (response.error) {
        return { error: response.error }
      }
      return {}
    } catch (error) {
      console.error('Sign up error:', error)
      return { error: 'An unexpected error occurred' }
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (credentials: SignInCredentials) => {
    setLoading(true)
    try {
      const response = await authService.signIn(credentials)
      if (response.error) {
        return { error: response.error }
      }
      return {}
    } catch (error) {
      console.error('Sign in error:', error)
      return { error: 'An unexpected error occurred' }
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    setLoading(true)
    try {
      await authService.signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    } finally {
      setLoading(false)
    }
  }

  // New database-connected auth functions
  const login = async (userId: string) => {
    localStorage.setItem('currentUserId', userId)
    const storedBandId = localStorage.getItem('currentBandId')
    await loadUserData(userId, storedBandId)
  }

  const logout = () => {
    localStorage.removeItem('currentUserId')
    localStorage.removeItem('currentBandId')
    setCurrentUser(null)
    setCurrentUserProfile(null)
    setCurrentBand(null)
    setCurrentBandId(null)
    setCurrentUserRole(null)
    setUserBands([])
  }

  const switchBand = async (bandId: string) => {
    try {
      const band = await db.bands.get(bandId)
      if (!band) {
        throw new Error('Band not found')
      }

      // Verify user is a member
      if (!currentUser) {
        throw new Error('No current user')
      }

      const membership = await db.bandMemberships
        .where('userId')
        .equals(currentUser.id)
        .filter(m => m.bandId === bandId && m.status === 'active')
        .first()

      if (!membership) {
        throw new Error('User is not a member of this band')
      }

      setCurrentBand(band)
      setCurrentBandId(bandId)
      setCurrentUserRole(membership.role)
      localStorage.setItem('currentBandId', bandId)
    } catch (error) {
      console.error('Failed to switch band:', error)
      throw error
    }
  }

  const value: AuthContextType = {
    // Legacy fields
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    isAuthenticated: !!user,

    // New database-connected fields
    currentUser,
    currentUserProfile,
    currentBand,
    currentBandId,
    currentUserRole,
    userBands,
    login,
    logout,
    switchBand
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
