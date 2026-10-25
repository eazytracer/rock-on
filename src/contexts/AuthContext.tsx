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
import { BandMembership } from '../models/BandMembership'
import { authService as defaultAuthService } from '../services/auth/AuthFactory'
import {
  AuthSession,
  SignUpCredentials,
  SignInCredentials,
  IAuthService,
  AuthChangeEvent,
} from '../services/auth/types'
import { RealtimeManager } from '../services/data/RealtimeManager'
import { RemoteRepository } from '../services/data/RemoteRepository'
import { createLogger } from '../utils/logger'

const log = createLogger('AuthContext')

interface AuthContextType {
  // Legacy auth fields (keep for backward compatibility)
  user: User | null
  session: AuthSession | null
  loading: boolean
  signUp: (
    credentials: SignUpCredentials,
    returnTo?: string
  ) => Promise<{ error?: string; needsEmailConfirmation?: boolean }>
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

  // Multi-band context switching (personal vs a specific band).
  // `currentBandId === null` == personal context. `contextType` is the
  // convenience discriminator; `setContext` is the single switch entry point
  // (accepts 'personal' or a bandId) and persists the intent.
  contextType: 'personal' | 'band'
  setContext: (target: 'personal' | string) => Promise<void>

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
  // Retained in the context type for API stability; the web client no longer
  // performs a blocking initial sync, so this stays false.
  const [syncing] = useState(false)

  // Auth ready state - tracks when full auth setup is complete
  const [authReady, setAuthReady] = useState(false)
  const authReadyResolveRef = useRef<(() => void) | null>(null)

  // Real-time sync manager (Phase 4) - Use ref for stable instance, state for reactivity
  const realtimeManagerRef = useRef<RealtimeManager | null>(null)
  const [realtimeManagerReady, setRealtimeManagerReady] = useState(false)

  // Multi-tab session sync - listen for auth changes in other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // Check if currentUserId was removed (sign-out in another tab)
      if (
        e.key === 'currentUserId' &&
        e.newValue === null &&
        e.oldValue !== null
      ) {
        // User signed out in another tab
        log.info('Sign out detected in another tab')
        logout()
        setSession(null)
        setUser(null)
      } else if (
        e.key === 'currentUserId' &&
        e.newValue !== null &&
        e.oldValue === null
      ) {
        // User signed in in another tab - reload to pick up new session
        log.info('Sign in detected in another tab - reloading')
        window.location.reload()
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
          // Import repository for cloud reads
          const { repository } = await import(
            '../services/data/RepositoryFactory'
          )

          // Set current user ID (used by repository read routing)
          repository.setCurrentUser(storedUserId)

          await loadUserData(storedUserId, storedBandId)

          // Start real-time sync if user has bands (cloud read — no local mirror)
          const memberships = await repository.getUserMemberships(storedUserId)
          const bands = memberships.filter(m => m.status === 'active')

          if (bands.length > 0) {
            try {
              // Removed: tab ID generation (was only used for logging)

              // 🔥 SET REALTIME AUTH ON SESSION RESTORATION
              const { getSupabaseClient } = await import(
                '../services/supabase/client'
              )
              const supabase = getSupabaseClient()
              // Get session from Supabase SDK (single source of truth)
              const currentSession = await authService.getSession()
              if (currentSession?.accessToken) {
                supabase.realtime.setAuth(currentSession.accessToken)
              } else {
                log.warn('No session token found - realtime may fail')
              }

              // Only create if doesn't exist yet
              if (!realtimeManagerRef.current) {
                realtimeManagerRef.current = new RealtimeManager()
                setRealtimeManagerReady(true)
              }

              // Subscribe using the manager instance
              const bandIds = bands.map(m => m.bandId)
              await realtimeManagerRef.current.subscribeToUserBands(
                storedUserId,
                bandIds
              )

              // Track user activity for multi-device sync optimization
              try {
                const remoteRepo = new RemoteRepository()
                await remoteRepo.updateUserActivity()
              } catch (activityError) {
                // Non-fatal: activity tracking failure shouldn't block app
                log.warn('Failed to update user activity:', activityError)
              }
            } catch (error) {
              log.error('Failed to start real-time sync:', error)
            }
          }
        }
      } catch (error) {
        log.error('Failed to load initial session:', error)
      } finally {
        setLoading(false)
      }
    }

    loadInitialSession()

    // Subscribe to auth state changes with event information
    const unsubscribe =
      authService.onAuthStateChangeWithEvent?.(
        async (event: AuthChangeEvent, newSession: AuthSession | null) => {
          log.debug('Auth state change event', {
            event,
            hasSession: !!newSession,
          })

          // Handle SIGNED_OUT event
          if (event === 'SIGNED_OUT') {
            log.info('SIGNED_OUT event received - clearing state')
            logout()
            setSession(null)
            setUser(null)
            setAuthReady(false)
            return
          }

          // Handle TOKEN_REFRESHED event - update in-memory session silently
          if (event === 'TOKEN_REFRESHED' && newSession) {
            log.debug('Token refreshed, updating session')
            setSession(newSession)
            // Update realtime auth token
            const { getSupabaseClient } = await import(
              '../services/supabase/client'
            )
            const supabase = getSupabaseClient()
            supabase.realtime.setAuth(newSession.accessToken)
            return
          }

          // Handle SIGNED_IN event
          if (event === 'SIGNED_IN' && newSession?.user?.id) {
            const userId = newSession.user.id
            setSession(newSession)
            setUser(newSession.user)

            // Import repository for cloud reads
            const { repository } = await import(
              '../services/data/RepositoryFactory'
            )

            // Set current user ID (used by repository read routing)
            repository.setCurrentUser(userId)

            // Load user data (cloud-first via repository)
            const storedBandId = localStorage.getItem('currentBandId')
            await loadUserData(userId, storedBandId)
            localStorage.setItem('currentUserId', userId)

            // Start real-time sync for user's bands (cloud read — no local mirror)
            const memberships = (
              await repository.getUserMemberships(userId)
            ).filter(m => m.status === 'active')

            if (memberships.length > 0) {
              try {
                // 🔥 SET REALTIME AUTH BEFORE ANY SUBSCRIPTIONS
                const { getSupabaseClient } = await import(
                  '../services/supabase/client'
                )
                const supabase = getSupabaseClient()
                supabase.realtime.setAuth(newSession.accessToken)

                // Only create if doesn't exist yet
                if (!realtimeManagerRef.current) {
                  realtimeManagerRef.current = new RealtimeManager()
                  setRealtimeManagerReady(true)
                }

                // Subscribe using the manager instance
                const bandIds = memberships.map(m => m.bandId)
                await realtimeManagerRef.current.subscribeToUserBands(
                  userId,
                  bandIds
                )

                // Track user activity for multi-device sync optimization
                try {
                  const remoteRepo = new RemoteRepository()
                  await remoteRepo.updateUserActivity()
                } catch (activityError) {
                  // Non-fatal: activity tracking failure shouldn't block sign-in
                  log.warn('Failed to update user activity:', activityError)
                }
              } catch (error) {
                log.error('Failed to start real-time sync:', error)
              }
            }

            // CRITICAL: Signal that auth setup is complete
            setAuthReady(true)
            if (authReadyResolveRef.current) {
              authReadyResolveRef.current()
              authReadyResolveRef.current = null
            }
          }
        }
      ) ||
      authService.onAuthStateChange(async newSession => {
        // Fallback if onAuthStateChangeWithEvent is not available (MockAuthService)
        // This path doesn't distinguish events, so we can't optimize TOKEN_REFRESHED
        setSession(newSession)
        setUser(newSession?.user || null)

        if (newSession?.user?.id) {
          // Similar logic to SIGNED_IN above, but without event context
          const userId = newSession.user.id
          const storedBandId = localStorage.getItem('currentBandId')
          await loadUserData(userId, storedBandId)
          localStorage.setItem('currentUserId', userId)
          setAuthReady(true)
        } else {
          logout()
          setAuthReady(false)
        }
      })

    return () => {
      unsubscribe()

      // Cleanup real-time subscriptions
      if (realtimeManagerRef.current) {
        realtimeManagerRef.current.unsubscribeAll()
        realtimeManagerRef.current = null
        setRealtimeManagerReady(false)
      }
    }
  }, [authService])

  const loadUserData = async (userId: string, bandId: string | null) => {
    try {
      const { repository } = await import('../services/data/RepositoryFactory')

      // Load user + profile (cloud-first; no local mirror anymore)
      const dbUser = await repository.getUser(userId)
      setCurrentUser(dbUser || null)

      const profile = await repository.getUserProfile(userId)
      setCurrentUserProfile(profile || null)

      // Load the user's active memberships from Supabase (source of truth).
      // `membershipResolved` is false only when the cloud read throws (offline);
      // in that case we must NOT destroy a persisted band context below.
      let memberships: BandMembership[] = []
      let membershipResolved = false
      try {
        const remote = await repository.getUserMemberships(userId)
        memberships = remote.filter(m => m.status === 'active')
        membershipResolved = true
      } catch (error) {
        log.warn(
          'Cloud membership read failed; preserving stored context:',
          error
        )
      }

      // Resolve band details from Supabase.
      const resolveBand = async (id: string): Promise<Band | undefined> => {
        try {
          return (await repository.getBand(id)) || undefined
        } catch {
          return undefined
        }
      }

      const bands = await Promise.all(
        memberships.map(m => resolveBand(m.bandId))
      )
      // Dedupe by band id — duplicate active memberships can exist and would
      // otherwise render as repeated bands (switcher, "Your bands").
      const uniqueBands = Array.from(
        new Map(
          bands.filter((b): b is Band => b !== undefined).map(b => [b.id, b])
        ).values()
      )
      setUserBands(uniqueBands)

      // ── Resolve context intent (personal vs a specific band) ──
      // Explicit intent persisted in `rockon.context`: 'personal' | '<bandId>'.
      // Precedence: explicit Personal → explicit/valid band intent → legacy
      // `currentBandId` → auto-select first band (preserves prior default when
      // no intent has ever been chosen). A stale band (removed membership)
      // downgrades to Personal rather than throwing.
      const validBandIds = new Set(uniqueBands.map(b => b.id))
      const intent = localStorage.getItem('rockon.context')

      // clearStored=true wipes the persisted `currentBandId`. Only do that when
      // we KNOW the user belongs in Personal (explicit intent, or an
      // authoritative empty membership list) — never because a cold cache
      // couldn't be read, or an existing member gets dumped to onboarding.
      const applyPersonal = (clearStored: boolean) => {
        setCurrentBand(null)
        setCurrentBandId(null)
        setCurrentUserRole(null)
        if (clearStored) localStorage.removeItem('currentBandId')
      }

      if (intent === 'personal') {
        // Intentional Personal context — do NOT auto-select a band.
        applyPersonal(true)
      } else if (!membershipResolved && bandId) {
        // Offline with a cold cache but a remembered band — keep the user in
        // their band context rather than dumping them to onboarding. Best-effort
        // band details; role stays null until a sync succeeds.
        const band = await resolveBand(bandId)
        setCurrentBand(band || null)
        setCurrentBandId(bandId)
        setCurrentUserRole(null)
      } else {
        const targetBandId =
          intent && validBandIds.has(intent)
            ? intent
            : bandId && validBandIds.has(bandId)
              ? bandId
              : uniqueBands[0]?.id || null

        if (targetBandId) {
          const band = await resolveBand(targetBandId)
          setCurrentBand(band || null)
          setCurrentBandId(targetBandId)
          localStorage.setItem('currentBandId', targetBandId)
          const membership = memberships.find(m => m.bandId === targetBandId)
          setCurrentUserRole(membership?.role || null)
        } else {
          // Authoritatively band-less → Personal by circumstance.
          applyPersonal(true)
        }
      }
    } catch (error) {
      log.error('Failed to load user data:', error)
    }
  }

  const signUp = async (credentials: SignUpCredentials, returnTo?: string) => {
    setLoading(true)
    try {
      const response = await authService.signUp(credentials, returnTo)
      if (response.error) {
        return { error: response.error }
      }
      return { needsEmailConfirmation: response.needsEmailConfirmation }
    } catch (error) {
      log.error('Sign up error:', error)
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
      await authReadyPromise

      return {}
    } catch (error) {
      log.error('Sign in error:', error)
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
      // 1. Clear local session state FIRST and unconditionally. This is the
      //    guaranteed escape hatch: the user is always signed out locally even
      //    if the network sign-out hangs or fails. Without this, a degraded
      //    network could trap a user on a broken/empty screen with no way out
      //    but purging the browser cache. `logout()` also dispatches
      //    `auth-logout`, which the route guard reacts to → redirect to /auth.
      logout()

      // 2. Best-effort network sign-out under a bounded timeout so a hung
      //    `supabase.auth.signOut()` can never block recovery.
      await Promise.race([
        authService.signOut(),
        new Promise<void>((_, reject) =>
          setTimeout(
            () => reject(new Error('Network sign-out timed out')),
            5000
          )
        ),
      ])
    } catch (error) {
      // Local state is already cleared above — a network failure/timeout here
      // is non-fatal to the user's ability to sign out and recover.
      log.warn(
        'Network sign-out failed or timed out (local session already cleared):',
        error
      )
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
    // Disconnect real-time sync
    if (realtimeManagerRef.current) {
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

    // Dispatch custom event so useAuthCheck can react to same-tab signOut
    window.dispatchEvent(new CustomEvent('auth-logout'))

    // Clear Supabase session from localStorage
    // Keys like 'sb-khzeuxxhigqcmrytsfux-auth-token'
    const keys = Object.keys(localStorage)
    keys.forEach(key => {
      if (key.startsWith('sb-')) {
        localStorage.removeItem(key)
      }
    })
  }

  const switchBand = async (bandId: string) => {
    try {
      // Import repository to query Supabase (cloud-first read)
      const { repository } = await import('../services/data/RepositoryFactory')

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
      log.error('Failed to switch band:', error)
      throw error
    }
  }

  // Single entry point for context switching. 'personal' clears the band
  // context; a bandId delegates to switchBand (which validates membership).
  // Both persist the intent to `rockon.context` so it survives reload.
  const setContext = async (target: 'personal' | string) => {
    if (target === 'personal') {
      setCurrentBand(null)
      setCurrentBandId(null)
      setCurrentUserRole(null)
      localStorage.setItem('rockon.context', 'personal')
      localStorage.removeItem('currentBandId')
      return
    }
    await switchBand(target)
    localStorage.setItem('rockon.context', target)
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
      contextType: currentBandId ? 'band' : 'personal',
      setContext,

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
      currentUser,
      currentUserProfile,
      currentBand,
      currentBandId,
      currentUserRole,
      userBands,
      login,
      logout,
      switchBand,
      setContext,
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
