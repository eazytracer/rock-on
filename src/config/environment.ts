/**
 * Environment Detection Utility
 *
 * Provides environment flags for controlling debug features, logging, and other
 * development-only functionality.
 *
 * Environment Types:
 * - development: Local development with Vite dev server (npm run dev)
 * - test: CI/CD test environment (test.rockon.band)
 * - production: Live production (rockon.band)
 *
 * Usage:
 *   import { isDev, isProd, isTest } from '@/config/environment'
 *
 *   if (isDev) {
 *     // Show debug UI, verbose logging, etc.
 *   }
 */

export type Environment = 'development' | 'test' | 'production'

/**
 * Get the current environment
 *
 * Priority:
 * 1. VITE_ENVIRONMENT explicitly set to 'test' → test
 * 2. import.meta.env.MODE === 'development' → development
 * 3. Otherwise → production
 */
export function getEnvironment(): Environment {
  // Explicit test environment (for test.rockon.band)
  if (import.meta.env.VITE_ENVIRONMENT === 'test') {
    return 'test'
  }

  // Vite's built-in MODE (development vs production build)
  if (import.meta.env.MODE === 'development') {
    return 'development'
  }

  return 'production'
}

export const environment = getEnvironment()

/**
 * Environment flags for conditional features
 */
export const isDev = environment === 'development'
export const isTest = environment === 'test'
export const isProd = environment === 'production'

/**
 * Should debug features be enabled?
 * Enabled in development, disabled in test and production
 */
export const enableDebugFeatures = isDev

/**
 * Should verbose logging be enabled?
 * Enabled in development and test, disabled in production
 */
export const enableVerboseLogging = isDev || isTest

/**
 * Log environment on initialization (only in browser)
 */
if (typeof window !== 'undefined' && isDev) {
  console.log(`🔧 Environment: ${environment}`)
  console.log(
    `   Debug features: ${enableDebugFeatures ? 'enabled' : 'disabled'}`
  )
  console.log(
    `   Verbose logging: ${enableVerboseLogging ? 'enabled' : 'disabled'}`
  )
}
