/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '../database'
import { LocalRepository } from './LocalRepository'
import { RemoteRepository } from './RemoteRepository'
import {
  SyncQueueItem,
  SyncStatus,
  SyncStatusListener,
  SyncConflict,
  ConflictEvent,
  IncrementalSyncResult,
  createEmptyIncrementalSyncResult,
} from './syncTypes'
import { createLogger } from '../../utils/logger'

const log = createLogger('SyncEngine')

export type ConflictListener = (event: ConflictEvent) => void

export class SyncEngine {
  private syncInterval: number | null = null
  private isSyncing: boolean = false
  private isOnline: boolean = navigator.onLine
  private listeners: Set<SyncStatusListener> = new Set()
  private conflictListeners: Set<ConflictListener> = new Set()
  private currentUserId: string | null = null
  private immediateSyncTimer: NodeJS.Timeout | null = null
  private readonly IMMEDIATE_SYNC_DELAY = 100 // 100ms debounce for immediate sync

  constructor(
    private local: LocalRepository,
    private remote: RemoteRepository
  ) {
    // REMOVED - Periodic sync disabled in favor of real-time WebSocket sync
    // this.startPeriodicSync()
    // Rationale:
    // - Causes UI "blinking" every 30 seconds
    // - Redundant with RealtimeManager WebSocket subscriptions
    // - Conflicts with immediate sync strategy
    // - Battery drain from constant polling
    // See: .claude/specifications/2025-10-30T13:25_bidirectional-sync-specification.md

    this.setupOnlineListener()

    log.info('✅ SyncEngine initialized (real-time mode)')
  }

  /**
   * Set the current user ID for sync operations
   */
  setCurrentUser(userId: string): void {
    this.currentUserId = userId
  }

  // ========== PHASE 1: QUEUE MANAGEMENT ==========

  async queueCreate(table: string, data: any): Promise<void> {
    if (!db.syncQueue) {
      throw new Error('Sync queue table not initialized')
    }

    const item: SyncQueueItem = {
      table,
      operation: 'create',
      data,
      timestamp: new Date(),
      status: 'pending',
      retryCount: 0,
    }

    await db.syncQueue.add(item)
    this.notifyListeners()

    // Trigger immediate sync (Phase 3.2)
    this.scheduleImmediateSync()
  }

  async queueUpdate(table: string, recordId: string, data: any): Promise<void> {
    if (!db.syncQueue) {
      throw new Error('Sync queue table not initialized')
    }

    // Check for existing queued update
    const existing = await db.syncQueue
      .where('table')
      .equals(table)
      .filter(item => item.data?.id === recordId && item.status === 'pending')
      .first()

    if (existing) {
      // Merge updates
      await db.syncQueue.update(existing.id!, {
        data: { ...existing.data, ...data },
        timestamp: new Date(),
      })
    } else {
      const item: SyncQueueItem = {
        table,
        operation: 'update',
        data: { id: recordId, ...data },
        timestamp: new Date(),
        status: 'pending',
        retryCount: 0,
      }

      await db.syncQueue.add(item)
    }

    this.notifyListeners()

    // Trigger immediate sync (Phase 3.2)
    this.scheduleImmediateSync()
  }

  async queueDelete(table: string, recordId: string): Promise<void> {
    if (!db.syncQueue) {
      throw new Error('Sync queue table not initialized')
    }

    const item: SyncQueueItem = {
      table,
      operation: 'delete',
      data: { id: recordId },
      timestamp: new Date(),
      status: 'pending',
      retryCount: 0,
    }

    await db.syncQueue.add(item)
    this.notifyListeners()

    // Trigger immediate sync (Phase 3.2)
    this.scheduleImmediateSync()
  }

  /**
   * Schedule immediate sync with debouncing (Phase 3.2)
   * Triggers sync after 100ms delay, debouncing multiple rapid queue operations
   */
  private scheduleImmediateSync(): void {
    // Only sync if online
    if (!this.isOnline) {
      return
    }

    // Clear existing timer (debouncing)
    if (this.immediateSyncTimer) {
      clearTimeout(this.immediateSyncTimer)
    }

    // Schedule sync after debounce delay
    this.immediateSyncTimer = setTimeout(() => {
      this.pushQueuedChanges()
    }, this.IMMEDIATE_SYNC_DELAY)
  }

  // ========== PHASE 2: SYNC OPERATIONS ==========

  async syncNow(): Promise<void> {
    if (this.isSyncing || !this.isOnline) {
      return
    }

    this.isSyncing = true
    this.notifyListeners()

    try {
      // 1. Pull latest from remote (cloud → local)
      if (this.currentUserId) {
        await this.pullFromRemote(this.currentUserId)
      }

      // 2. Push queued changes (local → cloud)
      await this.pushQueuedChanges()

      // 3. Update last sync time
      await this.updateLastSyncTime()
    } catch (error) {
      log.error('Sync failed:', error)
    } finally {
      this.isSyncing = false
      this.notifyListeners()
    }
  }

  private async pushQueuedChanges(): Promise<void> {
    if (!db.syncQueue) return

    const queue = await db.syncQueue
      .where('status')
      .equals('pending')
      .sortBy('timestamp')

    for (const item of queue) {
      try {
        // Mark as syncing
        await db.syncQueue.update(item.id!, { status: 'syncing' })

        // Execute the operation on remote
        await this.executeSyncOperation(item)

        // Remove from queue on success
        await db.syncQueue.delete(item.id!)
      } catch (error) {
        log.error(`Failed to sync ${item.table}:`, error)

        // Check if this is a version conflict
        if (
          this.isVersionConflict(error) &&
          item.operation === 'update' &&
          item.data?.id
        ) {
          log.info(
            `[Conflict] Version conflict detected for ${item.table}:${item.data.id}`
          )

          try {
            // Fetch the current remote version
            const remoteVersion = await this.fetchRemoteVersion(
              item.table,
              item.data.id
            )

            if (remoteVersion) {
              // Create conflict record
              await this.createConflict(item, remoteVersion)

              // Remove from sync queue - conflict is now tracked separately
              await db.syncQueue.delete(item.id!)
              continue // Move to next item in queue
            }
          } catch (conflictError) {
            log.error('Failed to create conflict record:', conflictError)
            // Fall through to normal error handling
          }
        }

        // Normal error handling (non-conflict or conflict creation failed)
        const currentRetries = item.retryCount || item.retries || 0
        const newRetries = currentRetries + 1

        if (newRetries >= 3) {
          // Mark as failed after 3 retries
          await db.syncQueue.update(item.id!, {
            status: 'failed',
            retryCount: newRetries,
            retries: newRetries,
            lastError: (error as Error).message,
          })
        } else {
          // Retry later
          await db.syncQueue.update(item.id!, {
            status: 'pending',
            retryCount: newRetries,
            retries: newRetries,
          })
        }
      }
    }

    // Notify listeners after processing queue so UI updates pending count
    // This is critical when called via scheduleImmediateSync() which bypasses syncNow()
    this.notifyListeners()
  }

  private async executeSyncOperation(item: SyncQueueItem): Promise<void> {
    const { table, operation, data } = item

    switch (table) {
      case 'songs':
        switch (operation) {
          case 'create':
            await this.remote.addSong(data)
            break
          case 'update':
            await this.remote.updateSong(data.id, data)
            break
          case 'delete':
            await this.remote.deleteSong(data.id)
            break
        }
        break

      case 'bands':
        switch (operation) {
          case 'create':
            await this.remote.addBand(data)
            break
          case 'update':
            await this.remote.updateBand(data.id, data)
            break
          case 'delete':
            await this.remote.deleteBand(data.id)
            break
        }
        break

      case 'setlists':
        switch (operation) {
          case 'create':
            await this.remote.addSetlist(data)
            break
          case 'update':
            await this.remote.updateSetlist(data.id, data)
            break
          case 'delete':
            await this.remote.deleteSetlist(data.id)
            break
        }
        break

      case 'practice_sessions':
        switch (operation) {
          case 'create':
            await this.remote.addPracticeSession(data)
            break
          case 'update':
            await this.remote.updatePracticeSession(data.id, data)
            break
          case 'delete':
            await this.remote.deletePracticeSession(data.id)
            break
        }
        break

      case 'shows':
        switch (operation) {
          case 'create':
            await this.remote.addShow(data)
            break
          case 'update':
            await this.remote.updateShow(data.id, data)
            break
          case 'delete':
            await this.remote.deleteShow(data.id)
            break
        }
        break

      case 'band_memberships':
        switch (operation) {
          case 'create':
            await this.remote.addBandMembership(data)
            break
          case 'update':
            await this.remote.updateBandMembership(data.id, data)
            break
          case 'delete':
            await this.remote.deleteBandMembership(data.id)
            break
        }
        break

      case 'invite_codes':
        switch (operation) {
          case 'create':
            await this.remote.addInviteCode(data)
            break
          case 'update':
            await this.remote.updateInviteCode(data.id, data)
            break
          case 'delete':
            await this.remote.deleteInviteCode(data.id)
            break
        }
        break

      case 'song_personal_notes':
        switch (operation) {
          case 'create':
          case 'update':
            // Use upsert for both create and update since personal notes use upsert locally
            await this.remote.upsertPersonalNote(data)
            break
          case 'delete':
            await this.remote.deletePersonalNote(data.id)
            break
        }
        break

      case 'song_note_entries':
        switch (operation) {
          case 'create':
            await this.remote.createNoteEntry(data)
            break
          case 'update':
            await this.remote.updateNoteEntry(data.id, data)
            break
          case 'delete':
            await this.remote.deleteNoteEntry(data.id)
            break
        }
        break

      default:
        throw new Error(`Unknown table: ${table}`)
    }
  }

  private async updateLastSyncTime(): Promise<void> {
    if (!db.syncMetadata) return

    await db.syncMetadata.put({
      id: 'lastSync',
      value: new Date(),
      updatedAt: new Date(),
    })
  }

  // Removed unused getLastSyncTime - using updateLastSyncTime() instead

  // ========== PHASE 3: CONFLICT RESOLUTION ==========

  async mergeRecord(table: string, remoteRecord: any): Promise<void> {
    const localRecord = await (db as any)[table].get(remoteRecord.id)

    if (!localRecord) {
      // New record from remote, add to local
      await (db as any)[table].add(remoteRecord)
      return
    }

    // Check timestamps to determine winner (last-write-wins)
    const localTime = localRecord.updated_date || localRecord.created_date
    const remoteTime = remoteRecord.updated_date || remoteRecord.created_date

    if (new Date(remoteTime) > new Date(localTime)) {
      // Remote is newer, update local
      await (db as any)[table].update(remoteRecord.id, remoteRecord)
    }
    // else: local is newer, keep local (it should be in sync queue anyway)
  }

  // ========== PHASE 4: ONLINE/OFFLINE HANDLING ==========
  // @ts-expect-error - Intentionally unused

  private startPeriodicSync(): void {
    this.syncInterval = window.setInterval(() => {
      if (this.isOnline && !this.isSyncing) {
        this.syncNow()
      }
    }, 30000) // 30 seconds
  }

  private setupOnlineListener(): void {
    window.addEventListener('online', () => {
      this.isOnline = true
      this.syncNow() // Sync immediately when coming online
      this.notifyListeners()
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
      this.notifyListeners()
    })
  }

  // ========== STATUS & OBSERVABILITY ==========

  async getStatus(): Promise<SyncStatus> {
    const pendingCount =
      (await db.syncQueue?.where('status').equals('pending').count()) || 0
    const failedCount =
      (await db.syncQueue?.where('status').equals('failed').count()) || 0
    const conflictCount = (await db.syncConflicts?.count()) || 0

    return {
      isEnabled: true,
      isSyncing: this.isSyncing,
      pendingCount,
      failedCount,
      conflictCount,
      lastSyncTime: undefined, // Will be implemented in Phase 2
    }
  }

  onStatusChange(listener: SyncStatusListener): () => void {
    this.listeners.add(listener)

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener)
    }
  }

  private async notifyListeners(): Promise<void> {
    const status = await this.getStatus()
    this.listeners.forEach(listener => listener(status))
  }

  // ========== CONFLICT LISTENERS ==========

  /**
   * Subscribe to conflict events
   */
  onConflict(listener: ConflictListener): () => void {
    this.conflictListeners.add(listener)
    return () => {
      this.conflictListeners.delete(listener)
    }
  }

  /**
   * Emit a conflict event to all listeners
   */
  private emitConflictEvent(event: ConflictEvent): void {
    this.conflictListeners.forEach(listener => listener(event))
  }

  /**
   * Get all pending conflicts
   */
  async getPendingConflicts(): Promise<SyncConflict[]> {
    try {
      if (!db.syncConflicts) return []
      return await db.syncConflicts.where('status').equals('pending').toArray()
    } catch {
      // Database may not be initialized yet
      return []
    }
  }

  /**
   * Resolve a conflict by choosing local or remote version
   */
  async resolveConflict(
    conflictId: number,
    resolution: 'local' | 'remote',
    resolvedBy?: string
  ): Promise<void> {
    if (!db.syncConflicts) return

    const conflict = await db.syncConflicts.get(conflictId)
    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`)
    }

    // Apply the chosen version
    if (resolution === 'local') {
      // Push local version to remote
      await this.applyLocalVersion(conflict)
    } else {
      // Apply remote version to local
      await this.applyRemoteVersion(conflict)
    }

    // Mark conflict as resolved
    const status = resolution === 'local' ? 'resolved_local' : 'resolved_remote'
    await db.syncConflicts.update(conflictId, {
      status,
      resolution,
      resolvedAt: new Date(),
      resolvedBy,
    })

    // Emit resolution event
    const updatedConflict = await db.syncConflicts.get(conflictId)
    if (updatedConflict) {
      this.emitConflictEvent({
        type: 'conflict_resolved',
        conflict: updatedConflict,
      })
    }

    this.notifyListeners()
  }

  /**
   * Apply local version to remote (overwrite remote)
   */
  private async applyLocalVersion(conflict: SyncConflict): Promise<void> {
    const { table, localData } = conflict

    switch (table) {
      case 'songs':
        await this.remote.updateSong(localData.id, localData)
        break
      case 'setlists':
        await this.remote.updateSetlist(localData.id, localData)
        break
      case 'shows':
        await this.remote.updateShow(localData.id, localData)
        break
      case 'practice_sessions':
        await this.remote.updatePracticeSession(localData.id, localData)
        break
      default:
        log.warn(`Unsupported table for conflict resolution: ${table}`)
    }
  }

  /**
   * Apply remote version to local (overwrite local)
   */
  private async applyRemoteVersion(conflict: SyncConflict): Promise<void> {
    const { table, recordId, remoteData } = conflict

    switch (table) {
      case 'songs':
        await this.local.updateSong(recordId, remoteData)
        break
      case 'setlists':
        await this.local.updateSetlist(recordId, remoteData)
        break
      case 'shows':
        await this.local.updateShow(recordId, remoteData)
        break
      case 'practice_sessions':
        await this.local.updatePracticeSession(recordId, remoteData)
        break
      default:
        log.warn(`Unsupported table for conflict resolution: ${table}`)
    }
  }

  /**
   * Check if an error is a version conflict
   */
  private isVersionConflict(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      // Supabase returns various error messages for conflicts
      return (
        message.includes('conflict') ||
        message.includes('version') ||
        message.includes('modified') ||
        message.includes('409') ||
        message.includes('row was updated or deleted')
      )
    }
    return false
  }

  /**
   * Fetch the current remote version of a record
   */
  private async fetchRemoteVersion(
    table: string,
    recordId: string
  ): Promise<unknown | null> {
    switch (table) {
      case 'songs':
        return this.remote.getSong(recordId)
      case 'setlists':
        return this.remote.getSetlist(recordId)
      case 'shows':
        return this.remote.getShow(recordId)
      case 'practice_sessions':
        return this.remote.getPracticeSession(recordId)
      default:
        return null
    }
  }

  /**
   * Create a conflict record and emit event
   */
  private async createConflict(
    item: SyncQueueItem,
    remoteData: unknown
  ): Promise<SyncConflict> {
    if (!db.syncConflicts) {
      throw new Error('syncConflicts table not initialized')
    }

    const conflict: SyncConflict = {
      table: item.table,
      recordId: item.data.id,
      localData: item.data,
      remoteData,
      localModifiedAt: item.timestamp,
      timestamp: new Date(),
      status: 'pending',
    }

    const id = await db.syncConflicts.add(conflict)
    conflict.id = id as number

    log.warn(
      `[Conflict] Detected conflict for ${item.table}:${item.data.id}`,
      conflict
    )

    // Emit conflict event
    this.emitConflictEvent({
      type: 'conflict_detected',
      conflict,
    })

    return conflict
  }

  // ========== PHASE 5: INITIAL SYNC (CLOUD → LOCAL) ==========

  /**
   * Perform initial sync - download all data from Supabase to IndexedDB
   * Called once on first login or when local database is empty
   */
  async performInitialSync(userId: string): Promise<void> {
    log.info('🔄 Starting initial sync for user:', userId)

    // Set current user for future periodic syncs
    this.setCurrentUser(userId)

    try {
      // Get user's band IDs from band_memberships
      const memberships = await this.remote.getUserMemberships(userId)
      const bandIds = memberships.map(m => m.bandId)

      // Removed: console.log with band count (security)

      if (bandIds.length === 0) {
        // Removed: console.log (security)
        await this.markInitialSyncComplete()
        return
      }

      // Download all entities for user's bands
      let totalRecords = 0

      // 0. Bands - sync band data for all user's bands
      for (const bandId of bandIds) {
        const band = await this.remote.getBand(bandId)
        if (band) {
          await this.local.addBand(band).catch(() => {
            return this.local.updateBand(band.id, band)
          })
          totalRecords++
        }
      }
      // Removed: console.log with band count (security)

      // 0.5. Band Memberships - sync ALL memberships for each band (not just user's own)
      for (const bandId of bandIds) {
        const bandMemberships = await this.remote.getBandMemberships(bandId)
        for (const membership of bandMemberships) {
          await this.local.addBandMembership(membership).catch(() => {
            return this.local.updateBandMembership(membership.id, membership)
          })
        }
        totalRecords += bandMemberships.length
        // Removed: console.log with band ID (security)
      }

      // 0.55. Invite Codes - sync all invite codes for each band
      for (const bandId of bandIds) {
        const inviteCodes = await this.remote.getInviteCodes(bandId)
        for (const inviteCode of inviteCodes) {
          await this.local.addInviteCode(inviteCode).catch(() => {
            return this.local.updateInviteCode(inviteCode.id, inviteCode)
          })
        }
        totalRecords += inviteCodes.length
        // Removed: console.log with band ID (security)
      }

      // 0.6. Users - sync user profiles for all band members
      const allUserIds = new Set<string>()
      for (const membership of memberships) {
        allUserIds.add(membership.userId)
      }
      // Also fetch memberships for each band to get all member user IDs
      for (const bandId of bandIds) {
        const bandMemberships = await this.remote.getBandMemberships(bandId)
        for (const membership of bandMemberships) {
          allUserIds.add(membership.userId)
        }
      }

      for (const uid of allUserIds) {
        try {
          const user = await this.remote.getUser(uid)
          if (user) {
            await this.local.addUser(user).catch(() => {
              return this.local.updateUser(user.id, user)
            })
            totalRecords++
          }
        } catch (error) {
          // Removed: console.warn with user ID (security)
        }
      }
      // Removed: console.log with user count (security)

      // 1. Songs
      for (const bandId of bandIds) {
        const songs = await this.remote.getSongs({
          contextType: 'band',
          contextId: bandId,
        })
        for (const song of songs) {
          await this.local.addSong(song).catch(() => {
            // Ignore duplicate errors, just update instead
            return this.local.updateSong(song.id, song)
          })
        }
        totalRecords += songs.length
        // Removed: console.log with band ID (security)
      }

      // 2. Setlists
      for (const bandId of bandIds) {
        const setlists = await this.remote.getSetlists(bandId)
        for (const setlist of setlists) {
          await this.local.addSetlist(setlist).catch(() => {
            return this.local.updateSetlist(setlist.id, setlist)
          })
        }
        totalRecords += setlists.length
        // Removed: console.log with band ID (security)
      }

      // 3. Practice Sessions
      for (const bandId of bandIds) {
        const practices = await this.remote.getPracticeSessions(bandId)
        for (const practice of practices) {
          await this.local.addPracticeSession(practice).catch(() => {
            return this.local.updatePracticeSession(practice.id, practice)
          })
        }
        totalRecords += practices.length
        // Removed: console.log with band ID (security)
      }

      // 4. Shows
      for (const bandId of bandIds) {
        try {
          const shows = await this.remote.getShows(bandId)
          for (const show of shows) {
            await this.local.addShow(show).catch(() => {
              return this.local.updateShow(show.id, show)
            })
          }
          totalRecords += shows.length
          // Removed: console.log with band ID (security)
        } catch (error: any) {
          // Gracefully handle missing shows table (dev mode) - silently skip
          if (
            error?.code === 'PGRST204' ||
            error?.code === 'PGRST205' ||
            error?.message?.includes('Could not find the table')
          ) {
            // Removed: console.log (security)
          } else {
            throw error
          }
        }
      }

      // Mark initial sync as complete
      await this.markInitialSyncComplete()

      console.log(
        `✅ Initial sync complete: ${totalRecords} total records synced`
      )
      this.notifyListeners()
    } catch (error) {
      console.error('❌ Initial sync failed:', error)
      throw error
    }
  }

  /**
   * Mark initial sync as complete in metadata
   */
  private async markInitialSyncComplete(): Promise<void> {
    if (!db.syncMetadata) return

    const now = new Date()
    const entities = ['songs', 'setlists', 'practices', 'shows']

    for (const entity of entities) {
      await db.syncMetadata.put({
        id: `${entity}_lastFullSync`,
        value: now,
        updatedAt: now,
      })
    }

    // Also set in localStorage for quick check
    localStorage.setItem('last_full_sync', now.toISOString())
  }

  /**
   * Check if initial sync is needed
   */
  async isInitialSyncNeeded(): Promise<boolean> {
    // Check localStorage first (fastest)
    const lastFullSync = localStorage.getItem('last_full_sync')
    if (!lastFullSync) return true

    // Check if it's been more than 30 days (force re-sync)
    const lastSyncDate = new Date(lastFullSync)
    const daysSinceSync =
      (Date.now() - lastSyncDate.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceSync > 30) return true

    // Check if any local tables are empty (data was cleared)
    const songsCount = await this.local.getSongs().then(s => s.length)
    const bandsCount = await this.local.getBands().then(b => b.length)

    // If we have bands but no songs, probably need sync
    if (bandsCount > 0 && songsCount === 0) return true

    return false
  }

  // ========== PHASE 6: PULL FROM REMOTE (INCREMENTAL SYNC) ==========

  /**
   * Pull changes from remote since last sync
   * Implements Last-Write-Wins conflict resolution
   */
  async pullFromRemote(userId: string): Promise<void> {
    // Removed: console.log with user ID (security)

    try {
      // Get user's band IDs
      const memberships = await this.remote.getUserMemberships(userId)
      const bandIds = memberships.map(m => m.bandId)

      if (bandIds.length === 0) {
        // Removed: console.log (security)
        return
      }

      // Pull changes for each entity type
      await this.pullSongs(bandIds)
      await this.pullSetlists(bandIds)
      await this.pullPracticeSessions(bandIds)
      await this.pullShows(bandIds)
      await this.pullInviteCodes(bandIds)

      console.log('✅ Pull from remote complete')
      this.notifyListeners()
    } catch (error) {
      console.error('❌ Pull from remote failed:', error)
      throw error
    }
  }

  // ========== PHASE 2: INCREMENTAL SYNC (SYNC-ON-LOAD) ==========

  /**
   * Pull incremental changes from remote since last sync
   * Called on every app load to catch updates from other devices
   * Implements Last-Write-Wins with pending changes protection
   *
   * @param userId - Current user ID
   * @returns IncrementalSyncResult with counts of changes
   */
  async pullIncrementalChanges(userId: string): Promise<IncrementalSyncResult> {
    const startTime = Date.now()
    const result = createEmptyIncrementalSyncResult()

    try {
      log.info('[IncrementalSync] Starting incremental sync...')

      // Get user's band IDs
      const memberships = await this.remote.getUserMemberships(userId)
      const bandIds = memberships.map(m => m.bandId)

      if (bandIds.length === 0) {
        log.info('[IncrementalSync] No bands found, skipping')
        result.syncDurationMs = Date.now() - startTime
        return result
      }

      // Get last sync time (default to 24 hours ago for first sync-on-load)
      const lastSync = await this.getLastIncrementalSyncTime()
      log.info(`[IncrementalSync] Last sync: ${lastSync.toISOString()}`)

      // Get IDs of records with pending local changes (to skip during pull)
      const pendingIds = await this.getPendingRecordIds()
      log.info(`[IncrementalSync] Pending local changes: ${pendingIds.size}`)

      // Pull and merge each entity type
      const songResult = await this.pullSongsIncremental(
        bandIds,
        lastSync,
        pendingIds
      )
      result.newSongs = songResult.new
      result.updatedSongs = songResult.updated
      result.skippedDueToPending += songResult.skipped

      const setlistResult = await this.pullSetlistsIncremental(
        bandIds,
        lastSync,
        pendingIds
      )
      result.newSetlists = setlistResult.new
      result.updatedSetlists = setlistResult.updated
      result.skippedDueToPending += setlistResult.skipped

      const practiceResult = await this.pullPracticeSessionsIncremental(
        bandIds,
        lastSync,
        pendingIds
      )
      result.newPractices = practiceResult.new
      result.updatedPractices = practiceResult.updated
      result.skippedDueToPending += practiceResult.skipped

      const showResult = await this.pullShowsIncremental(
        bandIds,
        lastSync,
        pendingIds
      )
      result.newShows = showResult.new
      result.updatedShows = showResult.updated
      result.skippedDueToPending += showResult.skipped

      // Update last sync time
      await this.setLastIncrementalSyncTime(new Date())

      result.lastSyncTime = new Date()
      result.syncDurationMs = Date.now() - startTime

      const totalChanges =
        result.newSongs +
        result.updatedSongs +
        result.newSetlists +
        result.updatedSetlists +
        result.newPractices +
        result.updatedPractices +
        result.newShows +
        result.updatedShows

      log.info(
        `[IncrementalSync] Complete: ${totalChanges} changes in ${result.syncDurationMs}ms`
      )
      this.notifyListeners()

      return result
    } catch (error) {
      log.error('[IncrementalSync] Failed:', error)
      result.syncDurationMs = Date.now() - startTime
      throw error
    }
  }

  /**
   * Get the last incremental sync time from metadata
   * Defaults to 24 hours ago if never synced
   */
  private async getLastIncrementalSyncTime(): Promise<Date> {
    if (!db.syncMetadata) {
      // Default: 24 hours ago
      return new Date(Date.now() - 24 * 60 * 60 * 1000)
    }

    const metadata = await db.syncMetadata.get('lastIncrementalSync')
    if (metadata?.value) {
      return new Date(metadata.value)
    }

    // Default: 24 hours ago
    return new Date(Date.now() - 24 * 60 * 60 * 1000)
  }

  /**
   * Set the last incremental sync time in metadata
   */
  private async setLastIncrementalSyncTime(time: Date): Promise<void> {
    if (!db.syncMetadata) return

    await db.syncMetadata.put({
      id: 'lastIncrementalSync',
      value: time.toISOString(),
      updatedAt: new Date(),
    })
  }

  /**
   * Get IDs of records that have pending local changes
   * These should be skipped during pull to avoid overwriting local edits
   */
  private async getPendingRecordIds(): Promise<Set<string>> {
    if (!db.syncQueue) return new Set()

    const pendingItems = await db.syncQueue
      .where('status')
      .equals('pending')
      .toArray()

    const ids = new Set<string>()
    for (const item of pendingItems) {
      if (item.data?.id) {
        ids.add(item.data.id)
      }
    }
    return ids
  }

  /**
   * Pull songs incrementally since last sync
   */
  private async pullSongsIncremental(
    bandIds: string[],
    since: Date,
    pendingIds: Set<string>
  ): Promise<{ new: number; updated: number; skipped: number }> {
    const counts = { new: 0, updated: 0, skipped: 0 }

    const { songs } = await this.remote.getSongsSince(bandIds, since)

    for (const remoteSong of songs) {
      // Skip if there are pending local changes for this record
      if (pendingIds.has(remoteSong.id)) {
        counts.skipped++
        continue
      }

      const localSong = await this.local.getSong(remoteSong.id)

      if (!localSong) {
        // New record from remote
        await this.local.addSong(remoteSong)
        counts.new++
      } else {
        // Existing record - apply Last-Write-Wins
        const localTime = localSong.createdDate
        const remoteTime = remoteSong.createdDate

        if (new Date(remoteTime) > new Date(localTime)) {
          await this.local.updateSong(remoteSong.id, remoteSong)
          counts.updated++
        }
      }
    }

    return counts
  }

  /**
   * Pull setlists incrementally since last sync
   */
  private async pullSetlistsIncremental(
    bandIds: string[],
    since: Date,
    pendingIds: Set<string>
  ): Promise<{ new: number; updated: number; skipped: number }> {
    const counts = { new: 0, updated: 0, skipped: 0 }

    const { setlists } = await this.remote.getSetlistsSince(bandIds, since)

    for (const remoteSetlist of setlists) {
      if (pendingIds.has(remoteSetlist.id)) {
        counts.skipped++
        continue
      }

      const localSetlist = await this.local.getSetlist(remoteSetlist.id)

      if (!localSetlist) {
        await this.local.addSetlist(remoteSetlist)
        counts.new++
      } else {
        const localTime = localSetlist.lastModified || localSetlist.createdDate
        const remoteTime =
          remoteSetlist.lastModified || remoteSetlist.createdDate

        if (new Date(remoteTime) > new Date(localTime)) {
          await this.local.updateSetlist(remoteSetlist.id, remoteSetlist)
          counts.updated++
        }
      }
    }

    return counts
  }

  /**
   * Pull practice sessions incrementally since last sync
   */
  private async pullPracticeSessionsIncremental(
    bandIds: string[],
    since: Date,
    pendingIds: Set<string>
  ): Promise<{ new: number; updated: number; skipped: number }> {
    const counts = { new: 0, updated: 0, skipped: 0 }

    const { practiceSessions } = await this.remote.getPracticeSessionsSince(
      bandIds,
      since
    )

    for (const remotePractice of practiceSessions) {
      if (pendingIds.has(remotePractice.id)) {
        counts.skipped++
        continue
      }

      const localPractice = await this.local.getPracticeSession(
        remotePractice.id
      )

      if (!localPractice) {
        await this.local.addPracticeSession(remotePractice)
        counts.new++
      } else {
        const localTime =
          localPractice.createdDate || localPractice.scheduledDate
        const remoteTime =
          remotePractice.createdDate || remotePractice.scheduledDate

        if (new Date(remoteTime) > new Date(localTime)) {
          await this.local.updatePracticeSession(
            remotePractice.id,
            remotePractice
          )
          counts.updated++
        }
      }
    }

    return counts
  }

  /**
   * Pull shows incrementally since last sync
   */
  private async pullShowsIncremental(
    bandIds: string[],
    since: Date,
    pendingIds: Set<string>
  ): Promise<{ new: number; updated: number; skipped: number }> {
    const counts = { new: 0, updated: 0, skipped: 0 }

    const { shows } = await this.remote.getShowsSince(bandIds, since)

    for (const remoteShow of shows) {
      if (pendingIds.has(remoteShow.id)) {
        counts.skipped++
        continue
      }

      const localShow = await this.local.getShow(remoteShow.id)

      if (!localShow) {
        await this.local.addShow(remoteShow)
        counts.new++
      } else {
        const localTime = localShow.updatedDate || localShow.createdDate
        const remoteTime = remoteShow.updatedDate || remoteShow.createdDate

        if (new Date(remoteTime) > new Date(localTime)) {
          await this.local.updateShow(remoteShow.id, remoteShow)
          counts.updated++
        }
      }
    }

    return counts
  }

  /**
   * Pull songs from remote
   */
  private async pullSongs(bandIds: string[]): Promise<void> {
    for (const bandId of bandIds) {
      const remoteSongs = await this.remote.getSongs({
        contextType: 'band',
        contextId: bandId,
      })

      for (const remoteSong of remoteSongs) {
        const localSong = await this.local.getSong(remoteSong.id)

        if (!localSong) {
          // New record from remote, add to local
          await this.local.addSong(remoteSong)
        } else {
          // Check timestamps (Last-Write-Wins)
          // Note: Song model doesn't have lastModified, only createdDate
          const localTime = localSong.createdDate
          const remoteTime = remoteSong.createdDate

          if (new Date(remoteTime) > new Date(localTime)) {
            // Remote is newer, update local
            await this.local.updateSong(remoteSong.id, remoteSong)
          }
          // else: local is newer, keep local (will be pushed on next push)
        }
      }
    }

    // Update sync metadata
    await db.syncMetadata?.put({
      id: 'songs_lastSync',
      value: new Date(),
      updatedAt: new Date(),
    })
  }

  /**
   * Pull setlists from remote
   */
  private async pullSetlists(bandIds: string[]): Promise<void> {
    for (const bandId of bandIds) {
      const remoteSetlists = await this.remote.getSetlists(bandId)

      for (const remoteSetlist of remoteSetlists) {
        const localSetlist = await this.local.getSetlist(remoteSetlist.id)

        if (!localSetlist) {
          // New record from remote, add to local
          await this.local.addSetlist(remoteSetlist)
        } else {
          // Check timestamps (Last-Write-Wins)
          const localTime =
            localSetlist.lastModified || localSetlist.createdDate
          const remoteTime =
            remoteSetlist.lastModified || remoteSetlist.createdDate

          if (new Date(remoteTime) > new Date(localTime)) {
            // Remote is newer, update local
            await this.local.updateSetlist(remoteSetlist.id, remoteSetlist)
          }
        }
      }
    }

    // Update sync metadata
    await db.syncMetadata?.put({
      id: 'setlists_lastSync',
      value: new Date(),
      updatedAt: new Date(),
    })
  }

  /**
   * Pull practice sessions from remote
   */
  private async pullPracticeSessions(bandIds: string[]): Promise<void> {
    for (const bandId of bandIds) {
      const remotePractices = await this.remote.getPracticeSessions(bandId)

      for (const remotePractice of remotePractices) {
        const localPractice = await this.local.getPracticeSession(
          remotePractice.id
        )

        if (!localPractice) {
          // New record from remote, add to local
          await this.local.addPracticeSession(remotePractice)
        } else {
          // Check timestamps (Last-Write-Wins)
          // PracticeSession uses createdDate/scheduledDate, no lastModified
          const localTime =
            localPractice.createdDate || localPractice.scheduledDate
          const remoteTime =
            remotePractice.createdDate || remotePractice.scheduledDate

          if (new Date(remoteTime) > new Date(localTime)) {
            // Remote is newer, update local
            await this.local.updatePracticeSession(
              remotePractice.id,
              remotePractice
            )
          }
        }
      }
    }

    // Update sync metadata
    await db.syncMetadata?.put({
      id: 'practices_lastSync',
      value: new Date(),
      updatedAt: new Date(),
    })
  }

  /**
   * Pull shows from remote
   */
  private async pullShows(bandIds: string[]): Promise<void> {
    for (const bandId of bandIds) {
      try {
        const remoteShows = await this.remote.getShows(bandId)

        for (const remoteShow of remoteShows) {
          const localShow = await this.local.getShow(remoteShow.id)

          if (!localShow) {
            // New record from remote, add to local
            await this.local.addShow(remoteShow)
          } else {
            // Check timestamps (Last-Write-Wins)
            const localTime = localShow.updatedDate || localShow.createdDate
            const remoteTime = remoteShow.updatedDate || remoteShow.createdDate

            if (new Date(remoteTime) > new Date(localTime)) {
              // Remote is newer, update local
              await this.local.updateShow(remoteShow.id, remoteShow)
            }
          }
        }
      } catch (error: any) {
        // Gracefully handle 404 errors - shows table may not exist in Supabase yet (dev mode)
        if (
          error?.code === 'PGRST204' ||
          error?.code === 'PGRST205' ||
          error?.message?.includes('Could not find the table')
        ) {
          console.log(
            'ℹ️ Shows table not available in remote database (development mode)'
          )
          return // Skip syncing shows for this band
        }
        // Re-throw other errors
        throw error
      }
    }

    // Update sync metadata
    await db.syncMetadata?.put({
      id: 'shows_lastSync',
      value: new Date(),
      updatedAt: new Date(),
    })
  }

  /**
   * Pull invite codes from remote
   */
  private async pullInviteCodes(bandIds: string[]): Promise<void> {
    for (const bandId of bandIds) {
      const remoteInviteCodes = await this.remote.getInviteCodes(bandId)

      for (const remoteInviteCode of remoteInviteCodes) {
        const localInviteCode = await this.local.getInviteCode(
          remoteInviteCode.id
        )

        if (!localInviteCode) {
          // New record from remote, add to local
          await this.local.addInviteCode(remoteInviteCode)
        } else {
          // Check timestamps (Last-Write-Wins)
          const localTime = localInviteCode.createdDate
          const remoteTime = remoteInviteCode.createdDate

          if (new Date(remoteTime) > new Date(localTime)) {
            // Remote is newer, update local
            await this.local.updateInviteCode(
              remoteInviteCode.id,
              remoteInviteCode
            )
          }
          // else: local is newer, keep local (will be pushed on next push)
        }
      }
    }

    // Update sync metadata
    await db.syncMetadata?.put({
      id: 'invite_codes_lastSync',
      value: new Date(),
      updatedAt: new Date(),
    })
  }

  // ========== CLEANUP ==========

  destroy(): void {
    if (this.syncInterval !== null) {
      window.clearInterval(this.syncInterval)
    }

    if (this.immediateSyncTimer !== null) {
      clearTimeout(this.immediateSyncTimer)
    }

    this.listeners.clear()
  }
}

// Singleton instance (created in SyncRepository)
let syncEngineInstance: SyncEngine | null = null

export function getSyncEngine(
  local: LocalRepository,
  remote: RemoteRepository
): SyncEngine {
  if (!syncEngineInstance) {
    syncEngineInstance = new SyncEngine(local, remote)
  }
  return syncEngineInstance
}
