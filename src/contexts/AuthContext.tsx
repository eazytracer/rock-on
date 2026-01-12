/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useRef,
  useMemo,
} from 'react'
import { User, UserProfile } from '../models/User'
import { Band } from '../models/Band'
import { db } from '../services/database'
import { authService as defaultAuthService } from '../services/auth/AuthFactory'
import {
  AuthSession,
  SignUpCredentials,
  SignInCredentials,
  IAuthService,
} from '../services/auth/types'
import { SessionManager } from '../services/auth/SessionManager'
import { RealtimeManager } from '../services/data/RealtimeManager'
import {
  setupRealtimeDebug,
  cleanupRealtimeDebug,
} from '../utils/debugRealtime'

interface AuthContextType {
  // Legacy auth fields (keep for backward compatibility)
  user: User | null
  session: AuthSession | null
  loading: boolean
  signUp: (credentials: SignUpCredentials) => Promise<{ error?: string }>
  signIn: (credentials: SignInCredentials) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  isAuthenticated: boolean

  // Session management
  sessionExpired: boolean

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

  // Sync state
  syncing: boolean

  // Real-time sync manager (Phase 4 - Event Emitter pattern)
  realtimeManager: RealtimeManager | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
  authService?: IAuthService
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  authService = defaultAuthService,
}) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [loading, setLoading] = useState(true)

  // New database-connected state
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [currentUserProfile, setCurrentUserProfile] =
    useState<UserProfile | null>(null)
  const [currentBand, setCurrentBand] = useState<Band | null>(null)
  const [currentBandId, setCurrentBandId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<
    'admin' | 'member' | 'viewer' | null
  >(null)
  const [userBands, setUserBands] = useState<Band[]>([])
  const [syncing, setSyncing] = useState(false)

  // Auth ready state - tracks when full auth setup is complete
  const [authReady, setAuthReady] = useState(false)
  const authReadyResolveRef = useRef<(() => void) | null>(null)

  // Real-time sync manager (Phase 4) - Use ref for stable instance, state for reactivity
  const realtimeManagerRef = useRef<RealtimeManager | null>(null)
  const [realtimeManagerReady, setRealtimeManagerReady] = useState(false)

  // Session expiry monitoring
  const [sessionExpired, setSessionExpired] = useState(false)
  const sessionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Check session expiry periodically
  useEffect(() => {
    if (!session) {
      // No session, clear interval if exists
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current)
        sessionCheckIntervalRef.current = null
      }
      setSessionExpired(false)
      return
    }

    // Check session validity immediately
    const checkSession = () => {
      const currentSession = SessionManager.loadSession()
      if (!currentSession || !SessionManager.isSessionValid(currentSession)) {
        console.warn('⚠️ Session expired - user needs to re-authenticate')
        setSessionExpired(true)
        setSession(null)
        setUser(null)
        // Clear interval since session is expired
        if (sessionCheckIntervalRef.current) {
          clearInterval(sessionCheckIntervalRef.current)
          sessionCheckIntervalRef.current = null
        }
      }
    }

    // Check immediately
    checkSession()

    // Then check every 30 seconds
    sessionCheckIntervalRef.current = setInterval(checkSession, 30000)

    return () => {
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current)
        sessionCheckIntervalRef.current = null
      }
    }
  }, [session])

  // Multi-tab session sync - listen for auth changes in other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // Check if auth-related localStorage keys changed
      if (e.key === 'currentUserId') {
        if (e.newValue === null && e.oldValue !== null) {
          // User signed out in another tab
          console.log('🔄 Sign out detected in another tab')
          logout()
          setSession(null)
          setUser(null)
          setSessionExpired(false)
        } else if (e.newValue !== null && e.oldValue === null) {
          // User signed in in another tab
          console.log('🔄 Sign in detected in another tab - reloading')
          window.location.reload()
        }
      } else if (e.key?.startsWith('sb-')) {
        // Supabase session changed in another tab
        if (e.newValue === null && e.oldValue !== null) {
          // Session cleared in another tab
          console.log('🔄 Session cleared in another tab')
          logout()
          setSession(null)
          setUser(null)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

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
          // Import repository for sync operations
          const { repository } = await import(
            '../services/data/RepositoryFactory'
          )

          // Set current user ID on sync engine
          repository.setCurrentUser(storedUserId)

          // Check if initial sync is needed
          const needsSync = await repository.isInitialSyncNeeded()

          if (needsSync) {
            // Removed: console.log (security)
            setSyncing(true)

            try {
              await repository.performInitialSync(storedUserId)
              // Removed: console.log (security)
            } catch (error) {
              console.error('❌ Initial sync failed:', error)
            } finally {
              setSyncing(false)
            }
          }

          await loadUserData(storedUserId, storedBandId)

          // Start real-time sync if user has bands
          const bands = await db.bandMemberships
            .where('userId')
            .equals(storedUserId)
            .filter(m => m.status === 'active')
            .toArray()

          if (bands.length > 0) {
            try {
              // Removed: tab ID generation (was only used for logging)

              // 🔥 SET REALTIME AUTH ON SESSION RESTORATION
              const { getSupabaseClient } = await import(
                '../services/supabase/client'
              )
              const supabase = getSupabaseClient()
              const storedSession = SessionManager.loadSession()
              if (storedSession?.accessToken) {
                supabase.realtime.setAuth(storedSession.accessToken)
                // Removed: console.log with sensitive data (CRITICAL SECURITY)
              } else {
                console.warn('⚠️ No session token found - realtime may fail')
              }

              // Removed: console.log (security)
              // Only create if doesn't exist yet
              if (!realtimeManagerRef.current) {
                // Removed: console.log (security)
                realtimeManagerRef.current = new RealtimeManager()
                setupRealtimeDebug(realtimeManagerRef.current)
                setRealtimeManagerReady(true)
              } else {
                // Removed: console.log (security)
              }

              // Subscribe using the manager instance
              const bandIds = bands.map(m => m.bandId)
              await realtimeManagerRef.current.subscribeToUserBands(
                storedUserId,
                bandIds
              )
              // Removed: console.log (security)
            } catch (error) {
              console.error('❌ Failed to start real-time sync:', error)
              if (error instanceof Error) {
                console.error('Error details:', error.message, error.stack)
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to load initial session:', error)
      } finally {
        setLoading(false)
      }
    }

    loadInitialSession()

    // Subscribe to auth state changes
    const unsubscribe = authService.onAuthStateChange(async newSession => {
      setSession(newSession)
      setUser(newSession?.user || null)
      SessionManager.saveSession(newSession)

      // When user signs in, also load their database data
      if (newSession?.user?.id) {
        const userId = newSession.user.id

        // Import repository for sync operations
        const { repository } = await import(
          '../services/data/RepositoryFactory'
        )

        // Set current user ID on sync engine (enables periodic pull sync)
        repository.setCurrentUser(userId)

        // Check if initial sync is needed (first login or > 30 days)
        const needsSync = await repository.isInitialSyncNeeded()

        if (needsSync) {
          // Removed: console.log (security)
          setSyncing(true)

          try {
            // Perform initial sync: download all data from Supabase to IndexedDB
            await repository.performInitialSync(userId)
            // Removed: console.log (security)
          } catch (error) {
            console.error('❌ Initial sync failed:', error)
            // Continue anyway - user can manually refresh or data will sync incrementally
            // We don't want to block login if sync fails
          } finally {
            setSyncing(false)
          }
        }

        // Load user data from IndexedDB
        const storedBandId = localStorage.getItem('currentBandId')
        await loadUserData(userId, storedBandId)
        localStorage.setItem('currentUserId', userId)

        // Start real-time sync for user's bands
        const memberships = await db.bandMemberships
          .where('userId')
          .equals(userId)
          .filter(m => m.status === 'active')
          .toArray()

        if (memberships.length > 0) {
          try {
            // Removed: tab ID generation (was only used for logging)

            // Removed: console.log with sensitive data (CRITICAL SECURITY)

            // 🔥 SET REALTIME AUTH BEFORE ANY SUBSCRIPTIONS
            const { getSupabaseClient } = await import(
              '../services/supabase/client'
            )
            const supabase = getSupabaseClient()
            supabase.realtime.setAuth(newSession.accessToken)
            // Removed: console.log (security)

            // Removed: console.log (security)
            // Only create if doesn't exist yet
            if (!realtimeManagerRef.current) {
              // Removed: console.log (security)
              realtimeManagerRef.current = new RealtimeManager()
              setupRealtimeDebug(realtimeManagerRef.current)
              setRealtimeManagerReady(true)
            } else {
              // Removed: console.log (security)
            }

            // Subscribe using the manager instance
            const bandIds = memberships.map(m => m.bandId)
            await realtimeManagerRef.current.subscribeToUserBands(
              userId,
              bandIds
            )
            // Removed: console.log (security)
          } catch (error) {
            console.error('❌ Failed to start real-time sync:', error)
            if (error instanceof Error) {
              console.error('Error details:', error.message, error.stack)
            }
          }
        }

        // CRITICAL: Signal that auth setup is complete
        // Removed: console.log (security)
        setAuthReady(true)
        if (authReadyResolveRef.current) {
          authReadyResolveRef.current()
          authReadyResolveRef.current = null
        }
      } else {
        // User signed out, clear database state
        setAuthReady(false)
        logout()
      }
    })

    return () => {
      unsubscribe()

      // Cleanup real-time subscriptions
      if (realtimeManagerRef.current) {
        console.log('🔌 Disconnecting real-time sync...')
        realtimeManagerRef.current.unsubscribeAll()
        cleanupRealtimeDebug()
        realtimeManagerRef.current = null
        setRealtimeManagerReady(false)
      }
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

      // Load all bands user is a member of from IndexedDB
      const memberships = await db.bandMemberships
        .where('userId')
        .equals(userId)
        .filter(m => m.status === 'active')
        .toArray()

      // TEMP FIX: If no band memberships in IndexedDB, this is a fresh sign-in
      // The pull-from-Supabase sync isn't implemented yet, so we need to manually
      // fetch the user's bands from Supabase
      if (memberships.length === 0) {
        console.log(
          'No band memberships found in IndexedDB - user may need to be added to a band'
        )
        // For now, we'll just show "No Band Selected"
        // TODO: Implement initial sync from Supabase when pull sync is ready
      }

      const bands = await Promise.all(
        memberships.map(async membership => {
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
    setAuthReady(false)

    try {
      // Create promise that will resolve when auth is ready
      const authReadyPromise = new Promise<void>((resolve, reject) => {
        authReadyResolveRef.current = resolve

        // Set timeout to prevent hanging indefinitely
        setTimeout(() => {
          if (!authReady) {
            reject(new Error('Authentication setup timeout - please try again'))
          }
        }, 15000) // 15 second timeout
      })

      // Call auth service to sign in
      const response = await authService.signIn(credentials)
      if (response.error) {
        authReadyResolveRef.current = null
        return { error: response.error }
      }

      // Wait for onAuthStateChange handler to complete setup
      console.log('⏳ Waiting for authentication setup to complete...')
      await authReadyPromise
      console.log('✅ Authentication setup complete')

      return {}
    } catch (error) {
      console.error('Sign in error:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'An unexpected error occurred'
      return { error: errorMessage }
    } finally {
      setLoading(false)
      authReadyResolveRef.current = null
    }
  }

  const signOut = async () => {
    setLoading(true)
    try {
      console.log('🚪 Signing out...')

      // 1. Sign out from Supabase (clears auth session)
      await authService.signOut()

      // 2. Clear all local state
      logout()

      console.log('✅ Sign out complete')
    } catch (error) {
      console.error('Sign out error:', error)
      // Still try to clear local state even if Supabase signOut fails
      logout()
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
    console.log('🧹 Clearing session state (preserving offline data)...')

    // Disconnect real-time sync
    if (realtimeManagerRef.current) {
      console.log('🔌 Disconnecting real-time sync...')
      realtimeManagerRef.current.unsubscribeAll()
      realtimeManagerRef.current = null
      setRealtimeManagerReady(false)
    }

    // Clear React state (session context)
    setCurrentUser(null)
    setCurrentUserProfile(null)
    setCurrentBand(null)
    setCurrentBandId(null)
    setCurrentUserRole(null)
    setUserBands([])
    setSession(null)
    setUser(null)
    setAuthReady(false)

    // Clear localStorage (session identifiers only)
    localStorage.removeItem('currentUserId')
    localStorage.removeItem('currentBandId')

    // Clear Supabase session from localStorage
    // Keys like 'sb-khzeuxxhigqcmrytsfux-auth-token'
    const keys = Object.keys(localStorage)
    keys.forEach(key => {
      if (key.startsWith('sb-')) {
        localStorage.removeItem(key)
      }
    })

    // IMPORTANT: Do NOT clear IndexedDB!
    // This preserves offline data for multi-user scenarios
    // Each user's data is isolated by queries filtering on user_id

    console.log(
      '✅ Session cleared (offline data preserved for multi-user support)'
    )
  }

  const switchBand = async (bandId: string) => {
    try {
      // Import repository to query Supabase (cloud-first read)
      const { repository } = await import('../services/data/RepositoryFactory')

      // Query Supabase for band details (User 2 might not have it in IndexedDB yet)
      const band = await repository.getBand(bandId)
      if (!band) {
        throw new Error('Band not found')
      }

      // Verify user is a member
      if (!currentUser) {
        throw new Error('No current user')
      }

      // Query memberships via repository (cloud-first read)
      const userMemberships = await repository.getUserMemberships(
        currentUser.id
      )
      const membership = userMemberships.find(
        m => m.bandId === bandId && m.status === 'active'
      )

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

  // Create a stable context value using useMemo to prevent unnecessary re-renders
  // BUT ensure it updates when realtimeManagerReady changes
  const value: AuthContextType = useMemo(
    () => ({
      // Legacy fields
      user,
      session,
      loading,
      signUp,
      signIn,
      signOut,
      isAuthenticated: !!user,

      // Session management
      sessionExpired,

      // New database-connected fields
      currentUser,
      currentUserProfile,
      currentBand,
      currentBandId,
      currentUserRole,
      userBands,
      login,
      logout,
      switchBand,

      // Sync state
      syncing,

      // Real-time sync manager (expose the ref's current value)
      // Include realtimeManagerReady in deps to trigger re-render when manager is created
      realtimeManager: realtimeManagerRef.current,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref.current captured intentionally, realtimeManagerReady triggers update
    [
      user,
      session,
      loading,
      signUp,
      signIn,
      signOut,
      sessionExpired,
      currentUser,
      currentUserProfile,
      currentBand,
      currentBandId,
      currentUserRole,
      userBands,
      login,
      logout,
      switchBand,
      syncing,
      realtimeManagerReady, // This ensures re-render when manager is created
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
