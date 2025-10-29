import { IDataRepository, SongFilter, BandFilter } from './IDataRepository'
import { LocalRepository } from './LocalRepository'
import { RemoteRepository } from './RemoteRepository'
import { SyncEngine } from './SyncEngine'
import { Song } from '../../models/Song'
import { Band } from '../../models/Band'
import { Setlist } from '../../models/Setlist'
import { PracticeSession } from '../../models/PracticeSession'
import { Show } from '../../models/Show'
import { BandMembership } from '../../models/BandMembership'
import type { SyncStatus, SyncStatusListener } from './syncTypes'

/**
 * SyncRepository - Local-first repository with background sync
 *
 * Architecture:
 * - READ operations: Always from LocalRepository (instant!)
 * - WRITE operations: Write to local first (optimistic), then queue for sync
 * - SYNC: Automatic background sync when online, queued when offline
 *
 * This provides:
 * - Instant reads from IndexedDB
 * - Optimistic writes for responsive UI
 * - Offline capability with sync queue
 * - Automatic sync when connection restored
 * - Real-time sync status updates via event listeners
 */
export class SyncRepository implements IDataRepository {
  private local: LocalRepository
  private remote: RemoteRepository
  private syncEngine: SyncEngine
  private isOnline: boolean
  private syncStatusCallbacks: Set<SyncStatusListener> = new Set()

  constructor() {
    this.local = new LocalRepository()
    this.remote = new RemoteRepository()
    this.syncEngine = new SyncEngine(this.local, this.remote)
    this.isOnline = navigator.onLine

    // Subscribe to sync engine status changes
    this.syncEngine.onStatusChange((status) => {
      this.emitSyncStatusChange(status)
    })

    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true
      this.syncEngine.syncNow()
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
    })
  }

  // ========== SONGS ==========
  // READ: Always from local (instant!)

  async getSongs(filter?: SongFilter): Promise<Song[]> {
    return this.local.getSongs(filter)
  }

  async getSong(id: string): Promise<Song | null> {
    return this.local.getSong(id)
  }

  // WRITE: Local first, then queue for sync

  async addSong(song: Song): Promise<Song> {
    // 1. Write to local immediately (optimistic UI)
    const localSong = await this.local.addSong(song)

    // 2. Queue for remote sync
    await this.syncEngine.queueCreate('songs', localSong)

    // 3. Try to sync immediately if online
    if (this.isOnline) {
      this.syncEngine.syncNow()
    }

    return localSong
  }

  async updateSong(id: string, updates: Partial<Song>): Promise<Song> {
    // 1. Update local first
    const updated = await this.local.updateSong(id, updates)

    // 2. Queue for sync
    await this.syncEngine.queueUpdate('songs', id, updates)

    // 3. Sync if online
    if (this.isOnline) {
      this.syncEngine.syncNow()
    }

    return updated
  }

  async deleteSong(id: string): Promise<void> {
    console.log('[SyncRepository] deleteSong called for:', id)
    console.log('[SyncRepository] Online status:', this.isOnline)

    // 1. Delete from local
    console.log('[SyncRepository] Step 1: Deleting from local IndexedDB...')
    await this.local.deleteSong(id)
    console.log('[SyncRepository] Step 1: Complete')

    // 2. Queue for sync
    console.log('[SyncRepository] Step 2: Queueing delete for sync...')
    await this.syncEngine.queueDelete('songs', id)
    console.log('[SyncRepository] Step 2: Complete')

    // 3. Sync if online
    if (this.isOnline) {
      console.log('[SyncRepository] Step 3: Triggering immediate sync (online)...')
      this.syncEngine.syncNow()
    } else {
      console.log('[SyncRepository] Step 3: Skipping sync (offline)')
    }

    console.log('[SyncRepository] deleteSong complete for:', id)
  }

  // ========== BANDS ==========
  // READ: Always from local

  async getBands(filter?: BandFilter): Promise<Band[]> {
    return this.local.getBands(filter)
  }

  async getBand(id: string): Promise<Band | null> {
    return this.local.getBand(id)
  }

  async getBandsForUser(userId: string): Promise<Band[]> {
    return this.local.getBandsForUser(userId)
  }

  // WRITE: Local first, then queue for sync

  async addBand(band: Band): Promise<Band> {
    // 1. Write to local immediately
    const localBand = await this.local.addBand(band)

    // 2. Queue for remote sync
    await this.syncEngine.queueCreate('bands', localBand)

    // 3. Try to sync immediately if online
    if (this.isOnline) {
      this.syncEngine.syncNow()
    }

    return localBand
  }

  async updateBand(id: string, updates: Partial<Band>): Promise<Band> {
    // 1. Update local first
    const updated = await this.local.updateBand(id, updates)

    // 2. Queue for sync
    await this.syncEngine.queueUpdate('bands', id, updates)

    // 3. Sync if online
    if (this.isOnline) {
      this.syncEngine.syncNow()
    }

    return updated
  }

  async deleteBand(id: string): Promise<void> {
    // 1. Delete from local
    await this.local.deleteBand(id)

    // 2. Queue for sync
    await this.syncEngine.queueDelete('bands', id)

    // 3. Sync if online
    if (this.isOnline) {
      this.syncEngine.syncNow()
    }
  }

  // ========== SETLISTS ==========
  // Basic implementation - reads from local, writes with sync (stubbed for now)

  async getSetlists(bandId: string): Promise<Setlist[]> {
    return this.local.getSetlists(bandId)
  }

  async getSetlist(id: string): Promise<Setlist | null> {
    return this.local.getSetlist(id)
  }

  async addSetlist(setlist: Setlist): Promise<Setlist> {
    const localSetlist = await this.local.addSetlist(setlist)
    await this.syncEngine.queueCreate('setlists', localSetlist)
    if (this.isOnline) {
      this.syncEngine.syncNow()
    }
    return localSetlist
  }

  async updateSetlist(id: string, updates: Partial<Setlist>): Promise<Setlist> {
    const updated = await this.local.updateSetlist(id, updates)
    await this.syncEngine.queueUpdate('setlists', id, updates)
    if (this.isOnline) {
      this.syncEngine.syncNow()
    }
    return updated
  }

  async deleteSetlist(id: string): Promise<void> {
    await this.local.deleteSetlist(id)
    await this.syncEngine.queueDelete('setlists', id)
    if (this.isOnline) {
      this.syncEngine.syncNow()
    }
  }

  // ========== PRACTICE SESSIONS ==========
  // Basic implementation - reads from local, writes with sync (stubbed for now)

  async getPracticeSessions(bandId: string): Promise<PracticeSession[]> {
    return this.local.getPracticeSessions(bandId)
  }

  async getPracticeSession(id: string): Promise<PracticeSession | null> {
    return this.local.getPracticeSession(id)
  }

  async addPracticeSession(session: PracticeSession): Promise<PracticeSession> {
    const localSession = await this.local.addPracticeSession(session)
    await this.syncEngine.queueCreate('practice_sessions', localSession)
    if (this.isOnline) {
      this.syncEngine.syncNow()
    }
    return localSession
  }

  async updatePracticeSession(id: string, updates: Partial<PracticeSession>): Promise<PracticeSession> {
    const updated = await this.local.updatePracticeSession(id, updates)
    await this.syncEngine.queueUpdate('practice_sessions', id, updates)
    if (this.isOnline) {
      this.syncEngine.syncNow()
    }
    return updated
  }

  async deletePracticeSession(id: string): Promise<void> {
    await this.local.deletePracticeSession(id)
    await this.syncEngine.queueDelete('practice_sessions', id)
    if (this.isOnline) {
      this.syncEngine.syncNow()
    }
  }

  // ========== SHOWS ==========

  async getShows(bandId: string): Promise<Show[]> {
    return this.local.getShows(bandId)
  }

  async getShow(id: string): Promise<Show | null> {
    return this.local.getShow(id)
  }

  async addShow(show: Show): Promise<Show> {
    const localShow = await this.local.addShow(show)
    await this.syncEngine.queueCreate('shows', localShow)
    if (this.isOnline) {
      this.syncEngine.syncNow()
    }
    return localShow
  }

  async updateShow(id: string, updates: Partial<Show>): Promise<Show> {
    const updated = await this.local.updateShow(id, updates)
    await this.syncEngine.queueUpdate('shows', id, updates)
    if (this.isOnline) {
      this.syncEngine.syncNow()
    }
    return updated
  }

  async deleteShow(id: string): Promise<void> {
    await this.local.deleteShow(id)
    await this.syncEngine.queueDelete('shows', id)
    if (this.isOnline) {
      this.syncEngine.syncNow()
    }
  }

  // ========== BAND MEMBERSHIPS ==========
  // Basic implementation - reads from local, writes with sync (stubbed for now)

  async getBandMemberships(bandId: string): Promise<BandMembership[]> {
    return this.local.getBandMemberships(bandId)
  }

  async getUserMemberships(userId: string): Promise<BandMembership[]> {
    return this.local.getUserMemberships(userId)
  }

  async addBandMembership(membership: BandMembership): Promise<BandMembership> {
    const localMembership = await this.local.addBandMembership(membership)
    await this.syncEngine.queueCreate('band_memberships', localMembership)
    if (this.isOnline) {
      this.syncEngine.syncNow()
    }
    return localMembership
  }

  async updateBandMembership(id: string, updates: Partial<BandMembership>): Promise<BandMembership> {
    const updated = await this.local.updateBandMembership(id, updates)
    await this.syncEngine.queueUpdate('band_memberships', id, updates)
    if (this.isOnline) {
      this.syncEngine.syncNow()
    }
    return updated
  }

  async deleteBandMembership(id: string): Promise<void> {
    await this.local.deleteBandMembership(id)
    await this.syncEngine.queueDelete('band_memberships', id)
    if (this.isOnline) {
      this.syncEngine.syncNow()
    }
  }

  // ========== SYNC STATUS & CONTROL ==========

  /**
   * Subscribe to sync status changes
   * @param callback Function to call when sync status changes
   * @returns Unsubscribe function
   */
  onSyncStatusChange(callback: SyncStatusListener): () => void {
    this.syncStatusCallbacks.add(callback)

    // Return unsubscribe function
    return () => {
      this.syncStatusCallbacks.delete(callback)
    }
  }

  /**
   * Alias for onSyncStatusChange for backwards compatibility
   * @param event Event name (currently only 'changed' is supported)
   * @param callback Function to call when data changes
   */
  on(event: string, callback: () => void): void {
    if (event === 'changed') {
      this.syncStatusCallbacks.add(callback as SyncStatusListener)
    }
  }

  /**
   * Remove event listener
   * @param event Event name (currently only 'changed' is supported)
   * @param callback Function to remove
   */
  off(event: string, callback: () => void): void {
    if (event === 'changed') {
      this.syncStatusCallbacks.delete(callback as SyncStatusListener)
    }
  }

  /**
   * Emit sync status change to all subscribers
   */
  private emitSyncStatusChange(status: SyncStatus): void {
    this.syncStatusCallbacks.forEach(callback => callback(status))
  }

  /**
   * Emit generic change event for hooks
   */
  private emitChangeEvent(): void {
    // Call all callbacks without arguments for 'changed' event
    this.syncStatusCallbacks.forEach(callback => {
      if (callback.length === 0) {
        // Callback expects no arguments (change event)
        (callback as unknown as () => void)()
      }
    })
  }

  /**
   * Get current sync status
   */
  async getStatus(): Promise<SyncStatus> {
    return this.syncEngine.getStatus()
  }

  /**
   * Manually trigger sync for all entities
   */
  async syncAll(): Promise<void> {
    await this.syncEngine.syncNow()
  }

  /**
   * Set the current user ID for sync operations
   * This enables periodic sync to pull changes from remote
   * @param userId User ID to sync data for
   */
  setCurrentUser(userId: string): void {
    this.syncEngine.setCurrentUser(userId)
  }

  // ========== CLOUD-TO-LOCAL SYNC ==========

  /**
   * Perform initial sync - download all data from cloud on first login
   * @param userId User ID to sync data for
   */
  async performInitialSync(userId: string): Promise<void> {
    await this.syncEngine.performInitialSync(userId)
  }

  /**
   * Check if initial sync is needed
   * @returns true if initial sync should be performed
   */
  async isInitialSyncNeeded(): Promise<boolean> {
    return await this.syncEngine.isInitialSyncNeeded()
  }

  /**
   * Pull changes from remote (incremental sync)
   * @param userId User ID to sync data for
   */
  async pullFromRemote(userId: string): Promise<void> {
    await this.syncEngine.pullFromRemote(userId)
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SyncRepository {
    return getSyncRepository()
  }
}

// Singleton instance for app-wide use
let syncRepositoryInstance: SyncRepository | null = null

export function getSyncRepository(): SyncRepository {
  if (!syncRepositoryInstance) {
    syncRepositoryInstance = new SyncRepository()
  }
  return syncRepositoryInstance
}
