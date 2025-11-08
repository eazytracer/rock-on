import { User } from '../../models/User'
import { getSupabaseClient } from '../supabase/client'
import { db } from '../database'
import {
  IAuthService,
  AuthSession,
  SignUpCredentials,
  SignInCredentials,
  AuthResponse
} from './types'
import type { AuthChangeEvent, Session as SupabaseSession } from '@supabase/supabase-js'
import { getSyncRepository } from '../data/SyncRepository'

export class SupabaseAuthService implements IAuthService {
  private supabase
  private listeners: ((session: AuthSession | null) => void)[] = []

  constructor() {
    this.supabase = getSupabaseClient()

    // Set up auth state listener
    this.supabase.auth.onAuthStateChange((event: AuthChangeEvent, supabaseSession: SupabaseSession | null) => {
      this.handleAuthStateChange(event, supabaseSession)
    })
  }

  private async handleAuthStateChange(event: AuthChangeEvent, supabaseSession: SupabaseSession | null): Promise<void> {
    const session = supabaseSession ? await this.mapSupabaseSession(supabaseSession) : null

    // CRITICAL: Sync user to local database BEFORE notifying listeners
    // This ensures bands/memberships are in IndexedDB when AuthContext tries to load them
    if (session && event === 'SIGNED_IN') {
      await this.syncUserToLocalDB(session.user)
    }

    // Now notify listeners (after data is synced)
    this.notifyListeners(session)
  }

  private notifyListeners(session: AuthSession | null): void {
    this.listeners.forEach((listener) => listener(session))
  }

  private async mapSupabaseSession(supabaseSession: SupabaseSession): Promise<AuthSession> {
    const supabaseUser = supabaseSession.user

    const provider = supabaseUser.app_metadata?.provider
    const authProvider: 'mock' | 'email' | 'google' | 'github' =
      provider === 'google' || provider === 'github' ? provider : 'email'

    const user: User = {
      id: supabaseUser.id,
      email: supabaseUser.email!,
      name: supabaseUser.user_metadata?.name || supabaseUser.email!,
      authProvider,
      createdDate: new Date(supabaseUser.created_at),
      lastLogin: new Date()
    }

    return {
      user,
      accessToken: supabaseSession.access_token,
      refreshToken: supabaseSession.refresh_token,
      expiresAt: supabaseSession.expires_at ? supabaseSession.expires_at * 1000 : Date.now() + 3600000
    }
  }

  private async syncUserToLocalDB(user: User): Promise<void> {
    try {
      // Check if user exists in local DB
      const existingUser = await db.users.get(user.id)

      if (existingUser) {
        // Update last login
        await db.users.update(user.id, { lastLogin: new Date() })
      } else {
        // Add user to local DB using put (upsert) to handle race conditions
        await db.users.put(user)

        // Check if profile exists before creating
        const existingProfile = await db.userProfiles.where('userId').equals(user.id).first()
        if (!existingProfile) {
          // Create user profile only if it doesn't exist
          await db.userProfiles.add({
            id: crypto.randomUUID(),
            userId: user.id,
            displayName: user.name,
            instruments: [],
            createdDate: new Date(),
            updatedDate: new Date()
          })
        }
      }

      // CRITICAL: Sync user's bands and memberships from Supabase to IndexedDB
      await this.syncUserBandsFromSupabase(user.id)

      // Perform initial sync if needed (downloads songs, setlists, practices)
      const syncRepo = getSyncRepository()
      const needsSync = await syncRepo.isInitialSyncNeeded()

      if (needsSync) {
        console.log('🔄 Initial sync needed, downloading all data...')
        await syncRepo.performInitialSync(user.id)
        console.log('✅ Initial sync complete')
      } else {
        // Set current user for periodic sync even if initial sync not needed
        const syncEngine = (syncRepo as any).syncEngine
        if (syncEngine && syncEngine.setCurrentUser) {
          syncEngine.setCurrentUser(user.id)
        }
        console.log('ℹ️ Initial sync not needed, data already synced')
      }
    } catch (error) {
      console.error('Failed to sync user to local DB:', error)
    }
  }

  private async syncUserBandsFromSupabase(userId: string): Promise<void> {
    try {
      // Fetch user's band memberships from Supabase
      const { data: memberships, error: membershipsError } = await this.supabase
        .from('band_memberships')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')

      if (membershipsError) {
        console.error('Failed to fetch band memberships from Supabase:', membershipsError)
        return
      }

      if (!memberships || memberships.length === 0) {
        console.log('No band memberships found in Supabase for user:', userId)
        return
      }

      // Fetch the associated bands
      const bandIds = (memberships as any[]).map((m: any) => m.band_id)
      const { data: bands, error: bandsError } = await this.supabase
        .from('bands')
        .select('*')
        .in('id', bandIds)

      if (bandsError) {
        console.error('Failed to fetch bands from Supabase:', bandsError)
        return
      }

      // Store bands in IndexedDB
      for (const band of (bands as any[]) || []) {
        await db.bands.put({
          id: band.id,
          name: band.name,
          description: band.description || '',
          createdDate: new Date(band.created_date || band.createdDate || new Date()),
          settings: band.settings || {},
          memberIds: [] // Will be populated from memberships
        })
      }

      // Store band memberships in IndexedDB
      for (const membership of (memberships as any[])) {
        await db.bandMemberships.put({
          id: membership.id,
          bandId: membership.band_id,
          userId: membership.user_id,
          role: membership.role,
          permissions: membership.permissions || [],
          status: membership.status,
          joinedDate: new Date(membership.joined_date)
        })
      }

      console.log(`Synced ${bands?.length || 0} bands and ${memberships.length} memberships to IndexedDB for user: ${userId}`)
    } catch (error) {
      console.error('Failed to sync bands from Supabase:', error)
    }
  }

  async signUp(credentials: SignUpCredentials): Promise<AuthResponse> {
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          data: {
            name: credentials.name
          }
        }
      })

      if (error) {
        return {
          user: null,
          session: null,
          error: error.message
        }
      }

      if (!data.session) {
        return {
          user: null,
          session: null,
          error: 'Please check your email to confirm your account'
        }
      }

      const session = await this.mapSupabaseSession(data.session)
      await this.syncUserToLocalDB(session.user)

      return {
        user: session.user,
        session
      }
    } catch (error) {
      console.error('Sign up error:', error)
      return {
        user: null,
        session: null,
        error: 'Failed to sign up'
      }
    }
  }

  async signIn(credentials: SignInCredentials): Promise<AuthResponse> {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password
      })

      if (error) {
        return {
          user: null,
          session: null,
          error: error.message
        }
      }

      if (!data.session) {
        return {
          user: null,
          session: null,
          error: 'Failed to create session'
        }
      }

      const session = await this.mapSupabaseSession(data.session)
      await this.syncUserToLocalDB(session.user)

      return {
        user: session.user,
        session
      }
    } catch (error) {
      console.error('Sign in error:', error)
      return {
        user: null,
        session: null,
        error: 'Failed to sign in'
      }
    }
  }

  async signOut(): Promise<void> {
    try {
      await this.supabase.auth.signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  async getSession(): Promise<AuthSession | null> {
    try {
      const { data, error } = await this.supabase.auth.getSession()

      if (error) {
        console.error('Get session error:', error)
        return null
      }

      if (!data.session) {
        return null
      }

      return await this.mapSupabaseSession(data.session)
    } catch (error) {
      console.error('Get session error:', error)
      return null
    }
  }

  async refreshSession(): Promise<AuthSession | null> {
    try {
      const { data, error } = await this.supabase.auth.refreshSession()

      if (error) {
        console.error('Refresh session error:', error)
        return null
      }

      if (!data.session) {
        return null
      }

      return await this.mapSupabaseSession(data.session)
    } catch (error) {
      console.error('Refresh session error:', error)
      return null
    }
  }

  onAuthStateChange(callback: (session: AuthSession | null) => void): () => void {
    this.listeners.push(callback)

    // Immediately call with current session (and sync data first if logged in)
    this.getSession().then(async (session) => {
      // If user has an existing session, sync their data before calling callback
      if (session?.user) {
        await this.syncUserToLocalDB(session.user)
      }
      callback(session)
    })

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter((listener) => listener !== callback)
    }
  }

  /**
   * Sign in with Google OAuth
   */
  async signInWithGoogle(): Promise<{ error?: string }> {
    try {
      const { error } = await this.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) {
        return { error: error.message }
      }

      return {}
    } catch (error) {
      console.error('Google sign in error:', error)
      return { error: 'Failed to sign in with Google' }
    }
  }
}
