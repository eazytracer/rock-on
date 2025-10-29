/**
 * Repository Factory
 *
 * Provides a singleton instance of the repository for the application.
 * In the future, this can be enhanced to switch between different repository
 * implementations based on configuration.
 */

import { SyncRepository } from './SyncRepository'
import type { IDataRepository } from './IDataRepository'

/**
 * Create and return the application repository instance.
 * Currently returns SyncRepository which handles both local and remote sync.
 */
export function createRepository(): IDataRepository {
  return SyncRepository.getInstance()
}

/**
 * Singleton repository instance for the application.
 * Use this throughout the app for all data operations.
 */
export const repository = createRepository()
