import { config } from '../../config/appMode'
import { mockAuthService } from './MockAuthService'
import { SupabaseAuthService } from './SupabaseAuthService'
import { IAuthService } from './types'

let authServiceInstance: IAuthService | null = null

/**
 * Create appropriate auth service based on app configuration
 */
export function createAuthService(): IAuthService {
  if (authServiceInstance) {
    return authServiceInstance
  }

  if (config.enableMockAuth) {
    console.log('🔧 Using MockAuthService')
    authServiceInstance = mockAuthService
  } else if (config.enableSupabaseAuth) {
    console.log('☁️  Using SupabaseAuthService')
    authServiceInstance = new SupabaseAuthService()
  } else {
    console.warn('⚠️  No auth service configured, falling back to MockAuthService')
    authServiceInstance = mockAuthService
  }

  return authServiceInstance
}

/**
 * Get the current auth service instance
 */
export function getAuthService(): IAuthService {
  if (!authServiceInstance) {
    return createAuthService()
  }
  return authServiceInstance
}

/**
 * Reset the auth service instance (useful for testing)
 */
export function resetAuthService(): void {
  authServiceInstance = null
}

// Export singleton instance
export const authService = createAuthService()
