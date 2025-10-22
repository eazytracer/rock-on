import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User } from '../models/User'
import { mockAuthService } from '../services/auth/MockAuthService'
import { AuthSession, SignUpCredentials, SignInCredentials, IAuthService } from '../services/auth/types'
import { SessionManager } from '../services/auth/SessionManager'

interface AuthContextType {
  user: User | null
  session: AuthSession | null
  loading: boolean
  signUp: (credentials: SignUpCredentials) => Promise<{ error?: string }>
  signIn: (credentials: SignInCredentials) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  isAuthenticated: boolean
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

  const value: AuthContextType = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    isAuthenticated: !!user
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
