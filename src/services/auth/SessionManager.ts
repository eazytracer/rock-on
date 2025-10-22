import { AuthSession } from './types'

const SESSION_KEY = 'rock_on_session'
const OFFLINE_SESSION_KEY = 'rock_on_offline_session'

export class SessionManager {
  /**
   * Save session to localStorage for persistence
   */
  static saveSession(session: AuthSession | null): void {
    if (session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session))
      // Also save to offline storage
      this.saveOfflineSession(session)
    } else {
      localStorage.removeItem(SESSION_KEY)
      localStorage.removeItem(OFFLINE_SESSION_KEY)
    }
  }

  /**
   * Load session from localStorage
   */
  static loadSession(): AuthSession | null {
    try {
      const sessionData = localStorage.getItem(SESSION_KEY)
      if (!sessionData) {
        return null
      }

      const session = JSON.parse(sessionData) as AuthSession

      // Check if session is expired
      if (session.expiresAt && session.expiresAt < Date.now()) {
        this.clearSession()
        return null
      }

      return session
    } catch (error) {
      console.error('Failed to load session:', error)
      return null
    }
  }

  /**
   * Save offline session (for use when network is unavailable)
   */
  static saveOfflineSession(session: AuthSession): void {
    const offlineSession = {
      userId: session.user.id,
      userName: session.user.name,
      userEmail: session.user.email,
      savedAt: Date.now()
    }
    localStorage.setItem(OFFLINE_SESSION_KEY, JSON.stringify(offlineSession))
  }

  /**
   * Load offline session
   */
  static loadOfflineSession(): { userId: string; userName: string; userEmail: string } | null {
    try {
      const offlineData = localStorage.getItem(OFFLINE_SESSION_KEY)
      if (!offlineData) {
        return null
      }

      const offlineSession = JSON.parse(offlineData)

      // Offline sessions are valid for 30 days
      const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000
      if (Date.now() - offlineSession.savedAt > thirtyDaysInMs) {
        localStorage.removeItem(OFFLINE_SESSION_KEY)
        return null
      }

      return {
        userId: offlineSession.userId,
        userName: offlineSession.userName,
        userEmail: offlineSession.userEmail
      }
    } catch (error) {
      console.error('Failed to load offline session:', error)
      return null
    }
  }

  /**
   * Clear all session data
   */
  static clearSession(): void {
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(OFFLINE_SESSION_KEY)
  }

  /**
   * Check if session is valid (not expired)
   */
  static isSessionValid(session: AuthSession): boolean {
    if (!session.expiresAt) {
      return true
    }
    return session.expiresAt > Date.now()
  }

  /**
   * Extend session expiry
   */
  static extendSession(session: AuthSession, durationMs: number = 24 * 60 * 60 * 1000): AuthSession {
    return {
      ...session,
      expiresAt: Date.now() + durationMs
    }
  }

  /**
   * Check if we're currently offline
   */
  static isOffline(): boolean {
    return !navigator.onLine
  }

  /**
   * Get session (online or offline)
   */
  static getAvailableSession(): AuthSession | null {
    // Try to get online session first
    const session = this.loadSession()
    if (session && this.isSessionValid(session)) {
      return session
    }

    // If offline and no valid online session, we can't create a full AuthSession
    // The app should handle this by checking for offline session separately
    return null
  }
}
