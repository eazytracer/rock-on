/**
 * Sync Infrastructure Types
 *
 * Types for the sync queue, metadata, and conflict resolution system.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Represents a queued sync operation
 */
export interface SyncQueueItem {
  id?: number
  table: string
  operation: 'create' | 'update' | 'delete'
  data: any
  timestamp: Date
  status: 'pending' | 'syncing' | 'synced' | 'failed'
  retryCount?: number
  lastError?: string
  retries?: number // Alias for retryCount (for backward compatibility)
}

/**
 * Stores metadata about sync state
 */
export interface SyncMetadata {
  id: string // e.g., 'lastSyncTime', 'syncEnabled', 'deviceId'
  value: any
  updatedAt: Date
}

/**
 * Represents a conflict between local and remote data
 */
export interface SyncConflict {
  id?: number
  table: string
  recordId: string
  localData: any
  remoteData: any
  timestamp: Date
  resolution?: 'local' | 'remote' | 'merged'
  resolvedAt?: Date
  resolvedBy?: string
}

/**
 * Current sync status information
 */
export interface SyncStatus {
  isEnabled: boolean
  isSyncing: boolean
  lastSyncTime?: Date
  pendingCount: number
  failedCount: number
  conflictCount: number
  lastError?: string
}

/**
 * Callback for sync status changes
 */
export type SyncStatusListener = (status: SyncStatus) => void
