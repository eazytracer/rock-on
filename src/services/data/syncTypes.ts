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
  localModifiedAt?: Date
  remoteModifiedAt?: Date
  localModifiedBy?: string
  remoteModifiedBy?: string
  timestamp: Date // When conflict was detected
  status: 'pending' | 'resolved_local' | 'resolved_remote' | 'resolved_merged'
  resolution?: 'local' | 'remote' | 'merged' // Deprecated: use status instead
  resolvedAt?: Date
  resolvedBy?: string
}

/**
 * Conflict resolution choice made by user
 */
export type ConflictResolution = 'local' | 'remote'

/**
 * Event emitted when a conflict is detected
 */
export interface ConflictEvent {
  type: 'conflict_detected' | 'conflict_resolved'
  conflict: SyncConflict
}

/**
 * Result of an incremental sync operation
 * Used to track what changed during sync-on-load
 */
export interface IncrementalSyncResult {
  // Songs
  newSongs: number
  updatedSongs: number
  deletedSongs: number

  // Setlists
  newSetlists: number
  updatedSetlists: number
  deletedSetlists: number

  // Practice Sessions
  newPractices: number
  updatedPractices: number
  deletedPractices: number

  // Shows
  newShows: number
  updatedShows: number
  deletedShows: number

  // Conflict tracking
  skippedDueToPending: number // Records skipped because of pending local changes
  conflictsDetected: number // Version conflicts detected during push

  // Timing
  lastSyncTime: Date
  syncDurationMs: number
}

/**
 * Creates an empty IncrementalSyncResult with all counts at zero
 */
export function createEmptyIncrementalSyncResult(): IncrementalSyncResult {
  return {
    newSongs: 0,
    updatedSongs: 0,
    deletedSongs: 0,
    newSetlists: 0,
    updatedSetlists: 0,
    deletedSetlists: 0,
    newPractices: 0,
    updatedPractices: 0,
    deletedPractices: 0,
    newShows: 0,
    updatedShows: 0,
    deletedShows: 0,
    skippedDueToPending: 0,
    conflictsDetected: 0,
    lastSyncTime: new Date(),
    syncDurationMs: 0,
  }
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
