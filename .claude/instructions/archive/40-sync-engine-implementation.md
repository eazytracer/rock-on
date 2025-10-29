# Task 40: Sync Engine Implementation

## Context

The sync engine is the core of the local-first architecture. It:
1. Queues local changes when offline
2. Syncs changes to Supabase when online
3. Pulls remote changes periodically
4. Resolves conflicts (last-write-wins)
5. Provides sync status to UI

## Dependencies

- Task 01: Environment setup
- Task 10: Supabase schema
- Task 30: Repository pattern (LocalRepository and RemoteRepository)

## Objective

Implement a robust sync engine that:
- Queues writes in IndexedDB
- Syncs automatically in background
- Handles offline/online transitions
- Resolves conflicts
- Provides observability (sync status)

## Test Requirements (Write These First)

### Test File: `tests/unit/services/data/SyncEngine.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SyncEngine } from '../SyncEngine'
import { LocalRepository } from '../LocalRepository'
import { RemoteRepository } from '../RemoteRepository'
import { db } from '../../database'

describe('SyncEngine - Queue Management', () => {
  let syncEngine: SyncEngine
  let localRepo: LocalRepository
  let remoteRepo: RemoteRepository

  beforeEach(async () => {
    localRepo = new LocalRepository()
    remoteRepo = new RemoteRepository()
    syncEngine = new SyncEngine(localRepo, remoteRepo)

    // Clear sync queue
    await db.syncQueue?.clear()
  })

  afterEach(async () => {
    syncEngine.destroy()
    await db.syncQueue?.clear()
  })

  it('should queue a create operation', async () => {
    await syncEngine.queueCreate('songs', {
      id: 'test-song-1',
      title: 'Test Song'
    })

    const queue = await db.syncQueue?.toArray()
    expect(queue).toHaveLength(1)
    expect(queue![0].operation).toBe('create')
    expect(queue![0].table).toBe('songs')
    expect(queue![0].status).toBe('pending')
  })

  it('should queue an update operation', async () => {
    await syncEngine.queueUpdate('songs', 'test-song-1', {
      title: 'Updated Title'
    })

    const queue = await db.syncQueue?.toArray()
    expect(queue).toHaveLength(1)
    expect(queue![0].operation).toBe('update')
    expect(queue![0].data.id).toBe('test-song-1')
  })

  it('should merge multiple updates for same record', async () => {
    await syncEngine.queueUpdate('songs', 'test-song-1', {
      title: 'Update 1'
    })

    await syncEngine.queueUpdate('songs', 'test-song-1', {
      artist: 'New Artist'
    })

    const queue = await db.syncQueue?.toArray()
    expect(queue).toHaveLength(1)
    expect(queue![0].data.title).toBe('Update 1')
    expect(queue![0].data.artist).toBe('New Artist')
  })

  it('should queue a delete operation', async () => {
    await syncEngine.queueDelete('songs', 'test-song-1')

    const queue = await db.syncQueue?.toArray()
    expect(queue).toHaveLength(1)
    expect(queue![0].operation).toBe('delete')
  })
})

describe('SyncEngine - Sync Operations', () => {
  let syncEngine: SyncEngine
  let localRepo: LocalRepository
  let remoteRepo: RemoteRepository

  beforeEach(() => {
    localRepo = new LocalRepository()
    remoteRepo = new RemoteRepository()

    // Mock remote repository methods
    vi.spyOn(remoteRepo, 'addSong').mockResolvedValue({
      id: 'synced-song-1',
      title: 'Synced Song',
      contextType: 'band',
      contextId: 'band-1',
      createdBy: 'user-1'
    } as any)

    syncEngine = new SyncEngine(localRepo, remoteRepo)
  })

  afterEach(async () => {
    syncEngine.destroy()
    await db.syncQueue?.clear()
  })

  it('should push queued create operations', async () => {
    await syncEngine.queueCreate('songs', {
      id: 'test-song-1',
      title: 'Test Song'
    })

    await syncEngine['pushQueuedChanges']()

    expect(remoteRepo.addSong).toHaveBeenCalled()

    const queue = await db.syncQueue?.toArray()
    expect(queue).toHaveLength(0) // Cleared after successful sync
  })

  it('should handle sync failures with retry', async () => {
    vi.spyOn(remoteRepo, 'addSong').mockRejectedValue(new Error('Network error'))

    await syncEngine.queueCreate('songs', {
      id: 'test-song-1',
      title: 'Test Song'
    })

    await syncEngine['pushQueuedChanges']()

    const queue = await db.syncQueue?.toArray()
    expect(queue).toHaveLength(1)
    expect(queue![0].retries).toBe(1)
    expect(queue![0].status).toBe('pending') // Ready for retry
  })

  it('should mark as failed after max retries', async () => {
    vi.spyOn(remoteRepo, 'addSong').mockRejectedValue(new Error('Network error'))

    await syncEngine.queueCreate('songs', {
      id: 'test-song-1',
      title: 'Test Song'
    })

    // Simulate 3 failed attempts
    await syncEngine['pushQueuedChanges']()
    await syncEngine['pushQueuedChanges']()
    await syncEngine['pushQueuedChanges']()

    const queue = await db.syncQueue?.toArray()
    expect(queue![0].status).toBe('failed')
    expect(queue![0].retries).toBe(3)
  })
})

describe('SyncEngine - Conflict Resolution', () => {
  let syncEngine: SyncEngine
  let localRepo: LocalRepository
  let remoteRepo: RemoteRepository

  beforeEach(() => {
    localRepo = new LocalRepository()
    remoteRepo = new RemoteRepository()
    syncEngine = new SyncEngine(localRepo, remoteRepo)
  })

  it('should prefer remote when remote is newer', async () => {
    const localRecord = {
      id: 'song-1',
      title: 'Local Version',
      updated_date: '2025-01-01T10:00:00Z'
    }

    const remoteRecord = {
      id: 'song-1',
      title: 'Remote Version',
      updated_date: '2025-01-01T12:00:00Z' // Newer
    }

    await db.songs.add(localRecord as any)

    await syncEngine['mergeRecord']('songs', remoteRecord)

    const merged = await db.songs.get('song-1')
    expect(merged?.title).toBe('Remote Version')
  })

  it('should keep local when local is newer', async () => {
    const localRecord = {
      id: 'song-1',
      title: 'Local Version',
      updated_date: '2025-01-01T12:00:00Z' // Newer
    }

    const remoteRecord = {
      id: 'song-1',
      title: 'Remote Version',
      updated_date: '2025-01-01T10:00:00Z'
    }

    await db.songs.add(localRecord as any)

    await syncEngine['mergeRecord']('songs', remoteRecord)

    const merged = await db.songs.get('song-1')
    expect(merged?.title).toBe('Local Version')
  })
})

describe('SyncEngine - Online/Offline Handling', () => {
  let syncEngine: SyncEngine

  beforeEach(() => {
    const localRepo = new LocalRepository()
    const remoteRepo = new RemoteRepository()
    syncEngine = new SyncEngine(localRepo, remoteRepo)
  })

  afterEach(() => {
    syncEngine.destroy()
  })

  it('should detect online event and trigger sync', async () => {
    const syncSpy = vi.spyOn(syncEngine, 'syncNow')

    // Simulate going online
    window.dispatchEvent(new Event('online'))

    // Wait for event handler
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(syncSpy).toHaveBeenCalled()
  })

  it('should not sync when offline', async () => {
    const syncSpy = vi.spyOn(syncEngine, 'syncNow')

    // Simulate offline
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true })

    syncEngine['startPeriodicSync']()

    // Wait for interval
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(syncSpy).not.toHaveBeenCalled()
  })
})
```

## Implementation Steps

### Step 1: Update Database Schema for Sync Tables

**File**: `src/services/database/index.ts`

Add sync tables to Version 6:

```typescript
// Version 6: Add sync infrastructure
this.version(6).stores({
  // ... all existing tables stay the same ...

  // NEW: Sync infrastructure
  syncQueue: '++id, table, status, timestamp, *data.id',
  syncMetadata: 'id',
  syncConflicts: '++id, table, recordId, timestamp'
})
```

### Step 2: Define Sync Types

**File**: `src/services/data/syncTypes.ts`

```typescript
export interface SyncQueueItem {
  id: string
  table: string
  operation: 'create' | 'update' | 'delete'
  data: any
  timestamp: number
  retries: number
  status: 'pending' | 'syncing' | 'failed'
  error?: string
}

export interface SyncMetadata {
  id: string
  timestamp: Date
}

export interface SyncConflict {
  id: string
  table: string
  recordId: string
  localData: any
  remoteData: any
  timestamp: Date
  resolved: boolean
}

export interface SyncStatus {
  isSyncing: boolean
  lastSync: Date | null
  queueSize: number
  failedCount: number
  isOnline: boolean
}

export type SyncStatusListener = (status: SyncStatus) => void
```

### Step 3: Implement Sync Engine

**File**: `src/services/data/SyncEngine.ts`

```typescript
import { db } from '../database'
import { LocalRepository } from './LocalRepository'
import { RemoteRepository } from './RemoteRepository'
import { SyncQueueItem, SyncStatus, SyncStatusListener } from './syncTypes'

export class SyncEngine {
  private syncInterval: number | null = null
  private isSyncing: boolean = false
  private isOnline: boolean = navigator.onLine
  private listeners: Set<SyncStatusListener> = new Set()

  constructor(
    private local: LocalRepository,
    private remote: RemoteRepository
  ) {
    this.startPeriodicSync()
    this.setupOnlineListener()
  }

  // ========== QUEUE MANAGEMENT ==========

  async queueCreate(table: string, data: any): Promise<void> {
    if (!db.syncQueue) {
      throw new Error('Sync queue table not initialized')
    }

    const item: SyncQueueItem = {
      id: crypto.randomUUID(),
      table,
      operation: 'create',
      data,
      timestamp: Date.now(),
      retries: 0,
      status: 'pending'
    }

    await db.syncQueue.add(item)
    this.notifyListeners()
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
      await db.syncQueue.update(existing.id, {
        data: { ...existing.data, ...data },
        timestamp: Date.now()
      })
    } else {
      const item: SyncQueueItem = {
        id: crypto.randomUUID(),
        table,
        operation: 'update',
        data: { id: recordId, ...data },
        timestamp: Date.now(),
        retries: 0,
        status: 'pending'
      }

      await db.syncQueue.add(item)
    }

    this.notifyListeners()
  }

  async queueDelete(table: string, recordId: string): Promise<void> {
    if (!db.syncQueue) {
      throw new Error('Sync queue table not initialized')
    }

    const item: SyncQueueItem = {
      id: crypto.randomUUID(),
      table,
      operation: 'delete',
      data: { id: recordId },
      timestamp: Date.now(),
      retries: 0,
      status: 'pending'
    }

    await db.syncQueue.add(item)
    this.notifyListeners()
  }

  // ========== SYNC OPERATIONS ==========

  async syncNow(): Promise<void> {
    if (this.isSyncing || !this.isOnline) {
      return
    }

    this.isSyncing = true
    this.notifyListeners()

    try {
      // 1. Pull latest from remote
      await this.pullFromRemote()

      // 2. Push queued changes
      await this.pushQueuedChanges()

      // 3. Update last sync time
      await this.updateLastSyncTime()
    } catch (error) {
      console.error('Sync failed:', error)
    } finally {
      this.isSyncing = false
      this.notifyListeners()
    }
  }

  private async pullFromRemote(): Promise<void> {
    // Get last sync timestamp
    const lastSync = await this.getLastSyncTime()

    // Pull all tables modified since last sync
    // TODO: Implement getModifiedSince in RemoteRepository
    // For now, skip pull (will be implemented in later phase)

    console.log('Pull from remote (placeholder)', lastSync)
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
        await db.syncQueue.update(item.id, { status: 'syncing' })

        // Execute the operation on remote
        await this.executeSyncOperation(item)

        // Remove from queue on success
        await db.syncQueue.delete(item.id)
      } catch (error) {
        console.error(`Failed to sync ${item.table}:`, error)

        // Increment retry count
        const newRetries = item.retries + 1

        if (newRetries >= 3) {
          // Mark as failed after 3 retries
          await db.syncQueue.update(item.id, {
            status: 'failed',
            retries: newRetries,
            error: (error as Error).message
          })
        } else {
          // Retry later
          await db.syncQueue.update(item.id, {
            status: 'pending',
            retries: newRetries
          })
        }
      }
    }
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

      // TODO: Add other tables

      default:
        throw new Error(`Unknown table: ${table}`)
    }
  }

  // ========== CONFLICT RESOLUTION ==========

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

  // ========== PERIODIC SYNC ==========

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

  // ========== METADATA ==========

  private async getLastSyncTime(): Promise<Date> {
    if (!db.syncMetadata) {
      return new Date(0)
    }

    const syncMeta = await db.syncMetadata.get('lastSync')
    return syncMeta?.timestamp || new Date(0)
  }

  private async updateLastSyncTime(): Promise<void> {
    if (!db.syncMetadata) return

    await db.syncMetadata.put({
      id: 'lastSync',
      timestamp: new Date()
    })
  }

  // ========== STATUS & OBSERVABILITY ==========

  async getStatus(): Promise<SyncStatus> {
    const queueSize = await db.syncQueue?.count() || 0
    const failedCount = await db.syncQueue
      ?.where('status')
      .equals('failed')
      .count() || 0
    const lastSync = await this.getLastSyncTime()

    return {
      isSyncing: this.isSyncing,
      lastSync: lastSync.getTime() > 0 ? lastSync : null,
      queueSize,
      failedCount,
      isOnline: this.isOnline
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

  // ========== CLEANUP ==========

  destroy(): void {
    if (this.syncInterval !== null) {
      window.clearInterval(this.syncInterval)
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
```

## Acceptance Criteria

- [ ] Sync queue tables added to Dexie schema (Version 6)
- [ ] SyncEngine class implemented with queue management
- [ ] Create, update, delete operations queued correctly
- [ ] Push operations execute on remote repository
- [ ] Retry logic works (max 3 retries)
- [ ] Online/offline event handling works
- [ ] Conflict resolution (last-write-wins) implemented
- [ ] Status observable for UI integration
- [ ] All tests passing

## Validation Steps

### 1. Run Tests

```bash
npm test tests/unit/services/data/SyncEngine.test.ts
```

### 2. Test Queue Persistence

```typescript
// In browser console
const sync = new SyncEngine(localRepo, remoteRepo)
await sync.queueCreate('songs', { id: '1', title: 'Test' })

// Reload page

const queue = await db.syncQueue.toArray()
console.log(queue) // Should still contain the queued item
```

### 3. Test Online/Offline

```bash
# In browser DevTools
# Go offline (Network tab → Offline)
# Make changes
# Go online
# Watch Network tab for Supabase requests
```

### 4. Check Database Version

```typescript
// Ensure version 6 is applied
db.verno // Should be 6
```

## Next Steps

- **Task 41**: Implement SyncRepository (combines local + sync)
- **Task 42**: Create React hooks for sync status
- **Task 50**: Migrate services to use SyncRepository
