import { config } from '../../config/appMode'
import { mockAuthService } from './MockAuthService'
import { SupabaseAuthService } from './SupabaseAuthService'
import { IAuthService } from './types'
import { createLogger } from '../../utils/logger'

const log = createLogger('AuthFactory')

let authServiceInstance: IAuthService | null = null

/**
 * Create appropriate auth service based on app configuration
 */
export function createAuthService(): IAuthService {
  if (authServiceInstance) {
    return authServiceInstance
  }

  if (config.enableMockAuth) {
    log.debug('Using MockAuthService')
    authServiceInstance = mockAuthService
  } else if (config.enableSupabaseAuth) {
    log.debug('Using SupabaseAuthService')
    authServiceInstance = new SupabaseAuthService()
  } else {
    log.warn('No auth service configured, falling back to MockAuthService')
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
