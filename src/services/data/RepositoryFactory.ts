/**
 * Repository Factory
 *
 * Provides the singleton repository for the application. Post Phase 2
 * data-layer simplification, the web client is a naive online Supabase client:
 * RemoteRepository talks directly to Supabase with no local IndexedDB mirror
 * and no sync engine. TanStack Query provides the ephemeral in-memory cache;
 * RealtimeManager drives freshness via audit_log change events.
 */

import { RemoteRepository } from './RemoteRepository'
import type { IDataRepository } from './IDataRepository'

/**
 * Create and return the application repository instance.
 */
export function createRepository(): IDataRepository {
  return new RemoteRepository()
}

/**
 * Singleton repository instance for the application.
 * Use this throughout the app for all data operations.
 */
export const repository = createRepository()
