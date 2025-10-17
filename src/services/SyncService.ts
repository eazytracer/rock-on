// Import removed to avoid circular dependency

interface PendingChange {
  id: string;
  type: 'song' | 'session' | 'setlist' | 'band' | 'member';
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
  attempts: number;
}

interface SyncStatus {
  lastSyncTime: number;
  pendingChanges: number;
  isOnline: boolean;
  syncInProgress: boolean;
}

export class SyncService {
  private static instance: SyncService | null = null;
  private syncQueue: PendingChange[] = [];
  private isOnline: boolean = navigator.onLine;
  private syncInProgress: boolean = false;
  private maxRetries: number = 3;
  private syncIntervalId: number | null = null;

  private constructor() {
    this.setupNetworkListeners();
    this.loadPendingChanges();
    this.startPeriodicSync();
  }

  static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  /**
   * Set up network status listeners
   */
  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      console.log('[SyncService] Network connection restored');
      this.isOnline = true;
      this.triggerSync();
    });

    window.addEventListener('offline', () => {
      console.log('[SyncService] Network connection lost');
      this.isOnline = false;
    });

    // Listen for service worker sync events
    window.addEventListener('sw-sync-complete', (event: any) => {
      console.log('[SyncService] Service worker sync completed:', event.detail);
      this.handleSyncComplete(event.detail.dataType);
    });
  }

  /**
   * Add a change to the sync queue
   */
  async addPendingChange(
    type: PendingChange['type'],
    action: PendingChange['action'],
    data: any
  ): Promise<void> {
    const change: PendingChange = {
      id: crypto.randomUUID(),
      type,
      action,
      data,
      timestamp: Date.now(),
      attempts: 0
    };

    this.syncQueue.push(change);
    await this.savePendingChanges();

    // Trigger immediate sync if online
    if (this.isOnline) {
      this.triggerSync();
    } else {
      // Register background sync for when connection is restored
      this.requestBackgroundSync(type);
    }
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): SyncStatus {
    return {
      lastSyncTime: this.getLastSyncTime(),
      pendingChanges: this.syncQueue.length,
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress
    };
  }

  /**
   * Manually trigger sync
   */
  async triggerSync(): Promise<boolean> {
    if (!this.isOnline || this.syncInProgress || this.syncQueue.length === 0) {
      return false;
    }

    this.syncInProgress = true;
    console.log(`[SyncService] Starting sync for ${this.syncQueue.length} pending changes`);

    try {
      const successful: string[] = [];
      const failed: PendingChange[] = [];

      for (const change of this.syncQueue) {
        try {
          const success = await this.syncChange(change);
          if (success) {
            successful.push(change.id);
          } else {
            change.attempts++;
            if (change.attempts < this.maxRetries) {
              failed.push(change);
            } else {
              console.error('[SyncService] Change exceeded max retries:', change);
            }
          }
        } catch (error) {
          console.error('[SyncService] Error syncing change:', error);
          change.attempts++;
          if (change.attempts < this.maxRetries) {
            failed.push(change);
          }
        }
      }

      // Update sync queue with failed attempts
      this.syncQueue = failed;
      await this.savePendingChanges();

      if (successful.length > 0) {
        await this.updateLastSyncTime();
        console.log(`[SyncService] Successfully synced ${successful.length} changes`);
      }

      if (failed.length > 0) {
        console.log(`[SyncService] ${failed.length} changes remain in queue`);
      }

      return successful.length > 0;

    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync individual change (placeholder implementation for offline-first app)
   */
  private async syncChange(change: PendingChange): Promise<boolean> {
    // In a real implementation, this would send the change to a server
    // For this offline-first app, we'll simulate the sync process

    console.log(`[SyncService] Syncing ${change.action} ${change.type}:`, change.data.title || change.data.name || change.id);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Simulate occasional failures for realistic behavior
    if (Math.random() < 0.1) {
      throw new Error('Simulated network error');
    }

    // For offline-first app, validate and clean up local data
    try {
      switch (change.type) {
        case 'song':
          return await this.validateSongData(change);
        case 'session':
          return await this.validateSessionData(change);
        case 'setlist':
          return await this.validateSetlistData(change);
        case 'band':
          return await this.validateBandData(change);
        case 'member':
          return await this.validateMemberData(change);
        default:
          return false;
      }
    } catch (error) {
      console.error(`[SyncService] Validation failed for ${change.type}:`, error);
      return false;
    }
  }

  /**
   * Validate song data consistency
   */
  private async validateSongData(change: PendingChange): Promise<boolean> {
    const { data } = change;

    // Validate required fields
    if (!data.title || !data.artist || !data.key) {
      console.error('[SyncService] Invalid song data - missing required fields');
      return false;
    }

    // Validate numeric fields
    if (data.duration && (data.duration < 0 || data.duration > 3600)) {
      console.error('[SyncService] Invalid song duration');
      return false;
    }

    if (data.bpm && (data.bpm < 40 || data.bpm > 300)) {
      console.error('[SyncService] Invalid song BPM');
      return false;
    }

    return true;
  }

  /**
   * Validate practice session data consistency
   */
  private async validateSessionData(change: PendingChange): Promise<boolean> {
    const { data } = change;

    // Validate required fields
    if (!data.scheduledDate || !data.bandId) {
      console.error('[SyncService] Invalid session data - missing required fields');
      return false;
    }

    // Validate date logic
    if (data.startTime && data.endTime && data.startTime > data.endTime) {
      console.error('[SyncService] Invalid session times - start after end');
      return false;
    }

    return true;
  }

  /**
   * Validate setlist data consistency
   */
  private async validateSetlistData(change: PendingChange): Promise<boolean> {
    const { data } = change;

    // Validate required fields
    if (!data.name || !data.bandId) {
      console.error('[SyncService] Invalid setlist data - missing required fields');
      return false;
    }

    // Validate songs array
    if (data.songs && !Array.isArray(data.songs)) {
      console.error('[SyncService] Invalid setlist songs - not an array');
      return false;
    }

    return true;
  }

  /**
   * Validate band data consistency
   */
  private async validateBandData(change: PendingChange): Promise<boolean> {
    const { data } = change;

    if (!data.name) {
      console.error('[SyncService] Invalid band data - missing name');
      return false;
    }

    return true;
  }

  /**
   * Validate member data consistency
   */
  private async validateMemberData(change: PendingChange): Promise<boolean> {
    const { data } = change;

    if (!data.name || !data.email) {
      console.error('[SyncService] Invalid member data - missing required fields');
      return false;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      console.error('[SyncService] Invalid member email format');
      return false;
    }

    return true;
  }

  /**
   * Request background sync from service worker
   */
  private requestBackgroundSync(dataType: string): void {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'REQUEST_SYNC',
        dataType: dataType
      });
    }
  }

  /**
   * Handle sync completion from service worker
   */
  private handleSyncComplete(dataType: string): void {
    console.log(`[SyncService] Background sync completed for ${dataType}`);
    // Remove completed changes from queue
    this.syncQueue = this.syncQueue.filter(change => change.type !== dataType);
    this.savePendingChanges();
  }

  /**
   * Load pending changes from storage
   */
  private async loadPendingChanges(): Promise<void> {
    try {
      const stored = localStorage.getItem('rock-on-sync-queue');
      if (stored) {
        this.syncQueue = JSON.parse(stored);
        console.log(`[SyncService] Loaded ${this.syncQueue.length} pending changes`);
      }
    } catch (error) {
      console.error('[SyncService] Error loading pending changes:', error);
      this.syncQueue = [];
    }
  }

  /**
   * Save pending changes to storage
   */
  private async savePendingChanges(): Promise<void> {
    try {
      localStorage.setItem('rock-on-sync-queue', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('[SyncService] Error saving pending changes:', error);
    }
  }

  /**
   * Get last sync timestamp
   */
  private getLastSyncTime(): number {
    const stored = localStorage.getItem('rock-on-last-sync');
    return stored ? parseInt(stored) : 0;
  }

  /**
   * Update last sync timestamp
   */
  private async updateLastSyncTime(): Promise<void> {
    localStorage.setItem('rock-on-last-sync', Date.now().toString());
  }

  /**
   * Start periodic sync attempts
   */
  private startPeriodicSync(): void {
    // Try to sync every 30 seconds when online
    this.syncIntervalId = window.setInterval(() => {
      if (this.isOnline && this.syncQueue.length > 0) {
        this.triggerSync();
      }
    }, 30000);
  }

  /**
   * Stop periodic sync
   */
  private stopPeriodicSync(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  /**
   * Clear all pending changes (use with caution)
   */
  async clearPendingChanges(): Promise<void> {
    this.syncQueue = [];
    await this.savePendingChanges();
    console.log('[SyncService] All pending changes cleared');
  }

  /**
   * Get detailed information about pending changes
   */
  getPendingChanges(): PendingChange[] {
    return [...this.syncQueue];
  }

  /**
   * Export sync statistics for debugging
   */
  getDebugInfo(): object {
    return {
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress,
      pendingChanges: this.syncQueue.length,
      lastSyncTime: new Date(this.getLastSyncTime()).toISOString(),
      queueDetails: this.syncQueue.map(change => ({
        id: change.id,
        type: change.type,
        action: change.action,
        attempts: change.attempts,
        timestamp: new Date(change.timestamp).toISOString()
      }))
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopPeriodicSync();
    SyncService.instance = null;
  }
}

// Initialize singleton instance
export const syncService = SyncService.getInstance();