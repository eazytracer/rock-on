import { User } from '../../models/User'
import { getSupabaseClient } from '../supabase/client'
import {
  IAuthService,
  AuthSession,
  SignUpCredentials,
  SignInCredentials,
  AuthResponse,
  AuthChangeEvent,
  AuthStateChangeCallback,
} from './types'
import type {
  AuthChangeEvent as SupabaseAuthChangeEvent,
  Session as SupabaseSession,
} from '@supabase/supabase-js'
import { sanitizeReturnTo } from '../../utils/returnTo'
import { createLogger } from '../../utils/logger'

const log = createLogger('SupabaseAuthService')

export class SupabaseAuthService implements IAuthService {
  private supabase
  private listeners: ((session: AuthSession | null) => void)[] = []
  private eventListeners: AuthStateChangeCallback[] = []

  constructor() {
    this.supabase = getSupabaseClient()

    // Set up auth state listener
    this.supabase.auth.onAuthStateChange(
      (
        event: SupabaseAuthChangeEvent,
        supabaseSession: SupabaseSession | null
      ) => {
        this.handleAuthStateChange(event, supabaseSession)
      }
    )
  }

  private async handleAuthStateChange(
    event: SupabaseAuthChangeEvent,
    supabaseSession: SupabaseSession | null
  ): Promise<void> {
    const session = supabaseSession
      ? await this.mapSupabaseSession(supabaseSession)
      : null

    // CRITICAL: Ensure the user row exists in Supabase BEFORE notifying listeners
    if (session && event === 'SIGNED_IN') {
      await this.syncUserToLocalDB(session.user)
    }

    // Notify both types of listeners
    this.notifyListeners(session)
    this.notifyEventListeners(event as AuthChangeEvent, session)
  }

  private notifyListeners(session: AuthSession | null): void {
    this.listeners.forEach(listener => listener(session))
  }

  private notifyEventListeners(
    event: AuthChangeEvent,
    session: AuthSession | null
  ): void {
    this.eventListeners.forEach(listener => listener(event, session))
  }

  private async mapSupabaseSession(
    supabaseSession: SupabaseSession
  ): Promise<AuthSession> {
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
      lastLogin: new Date(),
    }

    return {
      user,
      accessToken: supabaseSession.access_token,
      refreshToken: supabaseSession.refresh_token,
      expiresAt: supabaseSession.expires_at
        ? supabaseSession.expires_at * 1000
        : Date.now() + 3600000,
    }
  }

  private async ensureUserInSupabase(user: User): Promise<void> {
    try {
      // Create the row if missing, then refresh it. Not a single
      // ON CONFLICT DO UPDATE: that reads excluded.email, and clients have no
      // SELECT on users.email (privacy_lockdown migration).
      const row = {
        email: user.email,
        name: user.name,
        last_login: new Date(),
        auth_provider: user.authProvider || 'email',
      }
      let { error } = await this.supabase
        .from('users')
        // @ts-expect-error - Supabase generated types are overly strict
        .upsert(
          { id: user.id, created_date: user.createdDate || new Date(), ...row },
          { onConflict: 'id', ignoreDuplicates: true }
        )
      if (!error) {
        ;({ error } = await this.supabase
          .from('users')
          // @ts-expect-error - Supabase generated types are overly strict
          .update(row)
          .eq('id', user.id))
      }

      if (error) {
        log.error('Failed to sync user to Supabase public.users:', error)
        // Don't throw - log and continue.
        // Band creation will fail until this succeeds, but app should still load.
      }
    } catch (error) {
      log.error('Error ensuring user in Supabase:', error)
      // Don't throw - this shouldn't block app initialization
    }
  }

  /**
   * Provision the signed-in user. The only durable side effect needed at
   * sign-in is ensuring the user row exists in Supabase `public.users`, which
   * foreign keys (e.g. bands.created_by) depend on.
   */
  private async syncUserToLocalDB(user: User): Promise<void> {
    try {
      await this.ensureUserInSupabase(user)
    } catch (error) {
      log.error('Failed to provision user in Supabase:', error)
    }
  }

  async signUp(
    credentials: SignUpCredentials,
    returnTo?: string
  ): Promise<AuthResponse> {
    try {
      // Ensure the confirmation link returns the user into the app so the
      // AuthCallback page can finish signing them in. If a safe same-origin
      // returnTo was supplied (e.g. an event join URL), carry it across the
      // emailed link so it survives verification. Unsafe values are dropped.
      const safeReturnTo = sanitizeReturnTo(returnTo)
      const emailRedirectTo = safeReturnTo
        ? `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(
            safeReturnTo
          )}`
        : `${window.location.origin}/auth/callback`

      const { data, error } = await this.supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          data: {
            name: credentials.name,
          },
          emailRedirectTo,
        },
      })

      if (error) {
        return {
          user: null,
          session: null,
          error: error.message,
        }
      }

      if (!data.session) {
        // No session but a user WAS created → Supabase email confirmation is
        // enabled. This is a SUCCESS: the user must confirm via email before
        // signing in. Only a missing user is a true failure.
        if (data.user) {
          const user: User = {
            id: data.user.id,
            email: data.user.email ?? credentials.email,
            name: data.user.user_metadata?.name || credentials.name,
            authProvider: 'email',
            createdDate: data.user.created_at
              ? new Date(data.user.created_at)
              : new Date(),
            lastLogin: new Date(),
          }

          return {
            user,
            session: null,
            needsEmailConfirmation: true,
          }
        }

        return {
          user: null,
          session: null,
          error:
            'Failed to create account. The email may already be registered.',
        }
      }

      const session = await this.mapSupabaseSession(data.session)
      // NOTE: Removed direct call to syncUserToLocalDB - this will be handled by
      // the onAuthStateChange handler to avoid race conditions

      return {
        user: session.user,
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
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      })

      if (error) {
        return {
          user: null,
          session: null,
          error: error.message,
        }
      }

      if (!data.session) {
        return {
          user: null,
          session: null,
          error: 'Failed to create session',
        }
      }

      const session = await this.mapSupabaseSession(data.session)
      // NOTE: Removed direct call to syncUserToLocalDB - this will be handled by
      // the onAuthStateChange handler to avoid race conditions

      return {
        user: session.user,
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
    let signOutError: Error | null = null

    try {
      // Sign out from Supabase (clears session from their storage)
      await this.supabase.auth.signOut()
    } catch (error) {
      log.error('Supabase sign out error:', error)
      signOutError = error as Error
      // Don't throw yet - still need to clear localStorage
    }

    // ALWAYS clear localStorage, even if Supabase signOut failed
    // This ensures we don't leave stale auth tokens
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('sb-')) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => {
      localStorage.removeItem(key)
    })

    // Now throw if there was an error
    if (signOutError) {
      throw signOutError
    }
  }

  async getSession(): Promise<AuthSession | null> {
    try {
      const { data, error } = await this.supabase.auth.getSession()

      if (error) {
        log.error('Get session error:', error)
        return null
      }

      if (!data.session) {
        return null
      }

      return await this.mapSupabaseSession(data.session)
    } catch (error) {
      log.error('Get session error:', error)
      return null
    }
  }

  async refreshSession(): Promise<AuthSession | null> {
    try {
      const { data, error } = await this.supabase.auth.refreshSession()

      if (error) {
        log.error('Refresh session error:', error)
        return null
      }

      if (!data.session) {
        return null
      }

      return await this.mapSupabaseSession(data.session)
    } catch (error) {
      log.error('Refresh session error:', error)
      return null
    }
  }

  onAuthStateChange(
    callback: (session: AuthSession | null) => void
  ): () => void {
    this.listeners.push(callback)

    // Immediately call with current session (and sync data first if logged in)
    this.getSession().then(async session => {
      // If user has an existing session, sync their data before calling callback
      if (session?.user) {
        await this.syncUserToLocalDB(session.user)
      }
      callback(session)
    })

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback)
    }
  }

  onAuthStateChangeWithEvent(callback: AuthStateChangeCallback): () => void {
    this.eventListeners.push(callback)

    // Immediately call with current session
    this.getSession().then(async session => {
      // If user has an existing session, sync their data before calling callback
      if (session?.user) {
        await this.syncUserToLocalDB(session.user)
      }
      // Call with SIGNED_IN event for existing session
      callback(session ? 'SIGNED_IN' : 'SIGNED_OUT', session)
    })

    // Return unsubscribe function
    return () => {
      this.eventListeners = this.eventListeners.filter(
        listener => listener !== callback
      )
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
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        return { error: error.message }
      }

      return {}
    } catch (error) {
      log.error('Google sign in error:', error)
      return { error: 'Failed to sign in with Google' }
    }
  }
}
