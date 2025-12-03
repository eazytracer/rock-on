/**
 * Logging Utility
 *
 * Environment-aware logging that controls what gets logged in different environments:
 * - Development: All logs (debug, info, warn, error)
 * - Test: Info, warn, error (no debug)
 * - Production: Error only
 *
 * Usage:
 *   import { logger } from '@/utils/logger'
 *
 *   logger.debug('Detailed debugging info')        // Only in dev
 *   logger.info('General information')             // Dev + test
 *   logger.warn('Warning message')                 // Dev + test + prod
 *   logger.error('Error occurred', error)          // Always logged
 */

import { isTest, isProd } from '../config/environment'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface Logger {
  debug: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

/**
 * Check if a log level should be enabled based on environment
 */
function shouldLog(level: LogLevel): boolean {
  if (isProd) {
    // Production: errors only
    return level === 'error'
  }

  if (isTest) {
    // Test: info, warn, error (no debug)
    return level !== 'debug'
  }

  // Development: everything
  return true
}

/**
 * Create a logger function for a specific level
 */
function createLogFunction(
  level: LogLevel,
  consoleFn: (...args: unknown[]) => void
) {
  return (...args: unknown[]) => {
    if (shouldLog(level)) {
      consoleFn(...args)
    }
  }
}

/**
 * Main logger instance
 */
export const logger: Logger = {
  debug: createLogFunction('debug', console.debug),
  info: createLogFunction('info', console.info),
  warn: createLogFunction('warn', console.warn),
  error: createLogFunction('error', console.error),
}

/**
 * Create a namespaced logger for a specific module
 *
 * Usage:
 *   const log = createLogger('SyncEngine')
 *   log.debug('Sync started')  // Outputs: [SyncEngine] Sync started
 */
export function createLogger(namespace: string): Logger {
  const prefix = `[${namespace}]`

  return {
    debug: (...args: unknown[]) => logger.debug(prefix, ...args),
    info: (...args: unknown[]) => logger.info(prefix, ...args),
    warn: (...args: unknown[]) => logger.warn(prefix, ...args),
    error: (...args: unknown[]) => logger.error(prefix, ...args),
  }
}
