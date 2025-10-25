---
timestamp: 2025-10-24T00:43
appended_time: 2025-10-24T00:43
type: Deployment Implementation Plan
status: UPDATED FOR LOCAL-FIRST SYNC ARCHITECTURE
original_prompt: Assess deployment readiness with Supabase
update_context: Updated to support local-first architecture with offline sync, maintaining Dexie and mock auth for local dev
---

# Rock On - Local-First Deployment Plan with Supabase Sync

## Architecture Overview

### Design Philosophy: Local-First with Cloud Sync

Your application will operate in **two modes**:

**1. Local Development Mode** (Current - Keep Working)
- ✅ Pure IndexedDB via Dexie (no Supabase connection required)
- ✅ MockAuthService for testing
- ✅ Seed data for instant development
- ✅ Works completely offline
- **Use Case**: Development, testing, CI/CD without Supabase credentials

**2. Production Mode** (New - To Implement)
- 🔄 IndexedDB as primary data store (instant reads/writes)
- 🔄 Supabase as authoritative backend (sync target)
- 🔄 Bi-directional sync engine
- 🔄 Real authentication with Google OAuth
- 🔄 Offline queue for writes when disconnected
- **Use Case**: Deployed app, basement practices, collaborative band management

### Key Principle: Keep Dexie, Add Sync Layer

```
┌─────────────────────────────────────────────────────────┐
│                    React Components                      │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Service Layer (No Changes!)                 │
│  SongService, BandService, SetlistService, etc.         │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  Data Repository Layer                   │
│         (NEW - Abstracts local vs remote)                │
│  ┌──────────────┐              ┌──────────────┐        │
│  │   LocalRepo  │◄────sync────►│  RemoteRepo  │        │
│  │   (Dexie)    │              │  (Supabase)  │        │
│  └──────────────┘              └──────────────┘        │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │     Sync Engine       │
              │  - Conflict resolver  │
              │  - Offline queue      │
              │  - Periodic sync      │
              └───────────────────────┘
```

### What This Means

1. **Your existing Dexie code stays** - we're not throwing away anything
2. **Services stay the same** - they'll talk to a repository abstraction
3. **New sync layer** sits between services and data stores
4. **Mode detection** - app automatically detects if Supabase is available
5. **Graceful degradation** - works offline, syncs when online

---

## Part 1: Updated Architecture Design

### Repository Pattern Implementation

**Goal**: Abstract data access so services don't know if they're hitting Dexie or Supabase.

#### New File: `src/services/data/DataRepository.ts`

```typescript
export interface IDataRepository {
  // Songs
  getSongs(filter: SongFilter): Promise<Song[]>
  getSong(id: string): Promise<Song | null>
  addSong(song: Song): Promise<Song>
  updateSong(id: string, updates: Partial<Song>): Promise<Song>
  deleteSong(id: string): Promise<void>

  // Bands
  getBands(userId: string): Promise<Band[]>
  getBand(id: string): Promise<Band | null>
  addBand(band: Band): Promise<Band>
  updateBand(id: string, updates: Partial<Band>): Promise<Band>

  // Setlists, Practices, etc. - similar pattern
}
```

#### Implementation 1: LocalRepository (Dexie - Already Exists!)

```typescript
// src/services/data/LocalRepository.ts
import { db } from '../database'
import { IDataRepository } from './DataRepository'

export class LocalRepository implements IDataRepository {
  // This is basically what you already have!
  async getSongs(filter: SongFilter): Promise<Song[]> {
    let query = db.songs.toCollection()

    if (filter.contextType) {
      query = db.songs.where('contextType').equals(filter.contextType)
    }

    if (filter.contextId) {
      return query.filter(s => s.contextId === filter.contextId).toArray()
    }

    return query.toArray()
  }

  async addSong(song: Song): Promise<Song> {
    const id = await db.songs.add(song)
    return { ...song, id: id.toString() }
  }

  // ... rest of methods use existing Dexie code
}
```

#### Implementation 2: RemoteRepository (Supabase - New)

```typescript
// src/services/data/RemoteRepository.ts
import { supabase } from '../supabase/client'
import { IDataRepository } from './DataRepository'

export class RemoteRepository implements IDataRepository {
  async getSongs(filter: SongFilter): Promise<Song[]> {
    let query = supabase.from('songs').select('*')

    if (filter.contextType) {
      query = query.eq('context_type', filter.contextType)
    }

    if (filter.contextId) {
      query = query.eq('context_id', filter.contextId)
    }

    const { data, error } = await query
    if (error) throw error

    return data.map(this.mapFromSupabase)
  }

  async addSong(song: Song): Promise<Song> {
    const { data, error } = await supabase
      .from('songs')
      .insert(this.mapToSupabase(song))
      .select()
      .single()

    if (error) throw error
    return this.mapFromSupabase(data)
  }

  // Field mapping helpers (camelCase <-> snake_case)
  private mapToSupabase(song: Song) {
    return {
      id: song.id,
      title: song.title,
      artist: song.artist,
      // ... map all fields to snake_case
      context_type: song.contextType,
      context_id: song.contextId,
      created_by: song.createdBy
    }
  }

  private mapFromSupabase(row: any): Song {
    return {
      id: row.id,
      title: row.title,
      artist: row.artist,
      // ... map all fields to camelCase
      contextType: row.context_type,
      contextId: row.context_id,
      createdBy: row.created_by
    }
  }
}
```

#### Implementation 3: SyncRepository (Hybrid - The Magic!)

```typescript
// src/services/data/SyncRepository.ts
import { LocalRepository } from './LocalRepository'
import { RemoteRepository } from './RemoteRepository'
import { SyncEngine } from './SyncEngine'
import { IDataRepository } from './DataRepository'

export class SyncRepository implements IDataRepository {
  private local: LocalRepository
  private remote: RemoteRepository
  private syncEngine: SyncEngine
  private isOnline: boolean = navigator.onLine

  constructor() {
    this.local = new LocalRepository()
    this.remote = new RemoteRepository()
    this.syncEngine = new SyncEngine(this.local, this.remote)

    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true
      this.syncEngine.syncAll() // Sync when coming back online
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
    })
  }

  // READ: Always from local (instant!)
  async getSongs(filter: SongFilter): Promise<Song[]> {
    return this.local.getSongs(filter)
  }

  // WRITE: Local first, then queue for sync
  async addSong(song: Song): Promise<Song> {
    // 1. Write to local immediately (optimistic UI)
    const localSong = await this.local.addSong(song)

    // 2. Queue for remote sync
    this.syncEngine.queueCreate('songs', localSong)

    // 3. Try to sync immediately if online
    if (this.isOnline) {
      this.syncEngine.syncNow()
    }

    return localSong
  }

  async updateSong(id: string, updates: Partial<Song>): Promise<Song> {
    // 1. Update local first
    const updated = await this.local.updateSong(id, updates)

    // 2. Queue for sync with timestamp
    this.syncEngine.queueUpdate('songs', id, {
      ...updates,
      _localUpdateTime: Date.now()
    })

    // 3. Sync if online
    if (this.isOnline) {
      this.syncEngine.syncNow()
    }

    return updated
  }

  async deleteSong(id: string): Promise<void> {
    await this.local.deleteSong(id)
    this.syncEngine.queueDelete('songs', id)

    if (this.isOnline) {
      this.syncEngine.syncNow()
    }
  }
}
```

### Sync Engine Design

**Key Features**:
- Offline write queue (persisted in IndexedDB)
- Periodic background sync every 30 seconds
- Conflict resolution (last-write-wins by default)
- Pull latest data on app load
- Push queued changes when online

#### New File: `src/services/data/SyncEngine.ts`

```typescript
import { db } from '../database'

interface SyncQueueItem {
  id: string
  table: string
  operation: 'create' | 'update' | 'delete'
  data: any
  timestamp: number
  retries: number
  status: 'pending' | 'syncing' | 'failed'
}

export class SyncEngine {
  private syncInterval: number | null = null
  private isSyncing: boolean = false

  constructor(
    private local: LocalRepository,
    private remote: RemoteRepository
  ) {
    this.startPeriodicSync()
  }

  // Queue operations for later sync
  async queueCreate(table: string, data: any) {
    await db.syncQueue.add({
      id: crypto.randomUUID(),
      table,
      operation: 'create',
      data,
      timestamp: Date.now(),
      retries: 0,
      status: 'pending'
    })
  }

  async queueUpdate(table: string, recordId: string, data: any) {
    // Check if there's already a queued update for this record
    const existing = await db.syncQueue
      .where('table').equals(table)
      .and(item => item.data.id === recordId && item.status === 'pending')
      .first()

    if (existing) {
      // Merge updates
      await db.syncQueue.update(existing.id, {
        data: { ...existing.data, ...data },
        timestamp: Date.now()
      })
    } else {
      await db.syncQueue.add({
        id: crypto.randomUUID(),
        table,
        operation: 'update',
        data: { id: recordId, ...data },
        timestamp: Date.now(),
        retries: 0,
        status: 'pending'
      })
    }
  }

  async queueDelete(table: string, recordId: string) {
    await db.syncQueue.add({
      id: crypto.randomUUID(),
      table,
      operation: 'delete',
      data: { id: recordId },
      timestamp: Date.now(),
      retries: 0,
      status: 'pending'
    })
  }

  // Periodic sync (runs every 30 seconds when online)
  private startPeriodicSync() {
    this.syncInterval = window.setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        this.syncNow()
      }
    }, 30000) // 30 seconds
  }

  // Immediate sync
  async syncNow() {
    if (this.isSyncing) return

    this.isSyncing = true

    try {
      // 1. Pull latest from remote
      await this.pullFromRemote()

      // 2. Push queued changes
      await this.pushQueuedChanges()
    } catch (error) {
      console.error('Sync failed:', error)
    } finally {
      this.isSyncing = false
    }
  }

  // Pull latest data from Supabase
  private async pullFromRemote() {
    // Get last sync timestamp
    const lastSync = await this.getLastSyncTime()

    // Pull all tables modified since last sync
    const tables = ['songs', 'setlists', 'practice_sessions', 'bands', 'band_memberships']

    for (const table of tables) {
      try {
        const { data, error } = await this.remote.getModifiedSince(table, lastSync)

        if (error) {
          console.error(`Failed to pull ${table}:`, error)
          continue
        }

        // Merge into local DB with conflict resolution
        for (const record of data) {
          await this.mergeRecord(table, record)
        }
      } catch (error) {
        console.error(`Error pulling ${table}:`, error)
      }
    }

    // Update last sync timestamp
    await this.updateLastSyncTime()
  }

  // Push queued changes to Supabase
  private async pushQueuedChanges() {
    const queue = await db.syncQueue
      .where('status').equals('pending')
      .sortBy('timestamp')

    for (const item of queue) {
      try {
        // Mark as syncing
        await db.syncQueue.update(item.id, { status: 'syncing' })

        // Execute the operation on remote
        switch (item.operation) {
          case 'create':
            await this.remote[`add${this.capitalize(item.table.slice(0, -1))}`](item.data)
            break
          case 'update':
            await this.remote[`update${this.capitalize(item.table.slice(0, -1))}`](item.data.id, item.data)
            break
          case 'delete':
            await this.remote[`delete${this.capitalize(item.table.slice(0, -1))}`](item.data.id)
            break
        }

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
            retries: newRetries
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

  // Conflict resolution: Last-write-wins
  private async mergeRecord(table: string, remoteRecord: any) {
    const localRecord = await db[table].get(remoteRecord.id)

    if (!localRecord) {
      // New record from remote, add to local
      await db[table].add(remoteRecord)
      return
    }

    // Check timestamps to determine winner
    const localTime = localRecord.updated_date || localRecord.created_date
    const remoteTime = remoteRecord.updated_date || remoteRecord.created_date

    if (new Date(remoteTime) > new Date(localTime)) {
      // Remote is newer, update local
      await db[table].update(remoteRecord.id, remoteRecord)
    }
    // else: local is newer, keep local (it should be in sync queue anyway)
  }

  // Helper methods
  private capitalize(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  private async getLastSyncTime(): Promise<Date> {
    const syncMeta = await db.syncMetadata.get('lastSync')
    return syncMeta?.timestamp || new Date(0)
  }

  private async updateLastSyncTime() {
    await db.syncMetadata.put({
      id: 'lastSync',
      timestamp: new Date()
    })
  }

  // Full sync (call on app load or manual refresh)
  async syncAll() {
    await this.pullFromRemote()
    await this.pushQueuedChanges()
  }
}
```

### Mode Detection & Configuration

**New File**: `src/config/appMode.ts`

```typescript
export type AppMode = 'local' | 'production'

export function getAppMode(): AppMode {
  // Check if Supabase credentials are configured
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const mockAuth = import.meta.env.VITE_MOCK_AUTH === 'true'

  // If VITE_MOCK_AUTH is explicitly true, force local mode
  if (mockAuth) {
    return 'local'
  }

  // If no Supabase URL, must be local mode
  if (!supabaseUrl || supabaseUrl === 'mock') {
    return 'local'
  }

  // Otherwise, production mode with sync
  return 'production'
}

export const APP_MODE = getAppMode()

export const config = {
  mode: APP_MODE,
  isLocal: APP_MODE === 'local',
  isProduction: APP_MODE === 'production',

  // Sync settings (only relevant in production mode)
  syncInterval: 30000, // 30 seconds
  syncOnStartup: true,
  syncOnOnline: true,

  // Auth settings
  enableMockAuth: APP_MODE === 'local',
  enableSupabaseAuth: APP_MODE === 'production'
}
```

### Updated Service Layer

**Services don't need to change much!** Just inject the right repository.

**Modified**: `src/services/SongService.ts`

```typescript
import { LocalRepository } from './data/LocalRepository'
import { SyncRepository } from './data/SyncRepository'
import { config } from '../config/appMode'

// Choose repository based on mode
const repo = config.isProduction
  ? new SyncRepository()
  : new LocalRepository()

export class SongService {
  // All existing methods stay the same!
  // Just replace direct Dexie calls with repo calls

  static async getSongsByBand(bandId: string) {
    return repo.getSongs({
      contextType: 'band',
      contextId: bandId
    })
  }

  static async addSong(song: Song) {
    return repo.addSong(song)
  }

  static async updateSong(id: string, updates: Partial<Song>) {
    return repo.updateSong(id, updates)
  }

  // ... rest of methods
}
```

### Database Schema Updates (Dexie)

**Modified**: `src/services/database/index.ts`

Add sync-related tables:

```typescript
// Version 6: Add sync infrastructure
this.version(6).stores({
  // ... all existing tables stay the same ...
  bands: '++id, name, createdDate',
  members: '++id, name, email, isActive',
  songs: '++id, title, artist, key, difficulty, createdDate, lastPracticed, confidenceLevel, contextType, contextId, createdBy, visibility, songGroupId',
  // ... etc ...

  // NEW: Sync infrastructure
  syncQueue: '++id, table, status, timestamp',
  syncMetadata: 'id, timestamp',
  syncConflicts: '++id, table, recordId, timestamp' // Track conflicts for manual resolution
})
```

---

## Part 2: Updated Phases with Sync Architecture

### Phase 1: Supabase Database Setup (Same as Before)

**Tasks**: Same as original report
- Create Supabase SQL schema (15 tables)
- Implement Row Level Security policies
- Create seed script
- Set up Supabase projects (dev, staging, prod)

**Time**: 2-3 days

**No Changes Needed**: The SQL schema is the same whether you're syncing or not.

---

### Phase 2: Authentication - Dual Mode Support

**New Approach**: Support both mock auth (local) and real auth (production).

#### Task 2.1: Create Supabase Auth Service (2 days)

Same as before, but now it's only used in production mode.

**File**: `src/services/auth/SupabaseAuthService.ts` (same code as original report)

#### Task 2.2: Create Auth Factory (1 day)

**New File**: `src/services/auth/AuthFactory.ts`

```typescript
import { MockAuthService } from './MockAuthService'
import { SupabaseAuthService } from './SupabaseAuthService'
import { IAuthService } from './types'
import { config } from '../../config/appMode'

export function createAuthService(): IAuthService {
  if (config.enableMockAuth) {
    console.log('🔧 Using MockAuthService (local development mode)')
    return new MockAuthService()
  } else {
    console.log('🔐 Using SupabaseAuthService (production mode)')
    return new SupabaseAuthService()
  }
}

export const authService = createAuthService()
```

#### Task 2.3: Update AuthContext (1 day)

**Modified**: `src/contexts/AuthContext.tsx`

```typescript
import { authService } from '../services/auth/AuthFactory'
import { config } from '../config/appMode'

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Use factory-created auth service
  const [authServiceInstance] = useState(() => authService)

  useEffect(() => {
    console.log(`Auth mode: ${config.mode}`)
  }, [])

  // ... rest stays the same
}
```

**Time**: 3-4 days total for Phase 2

---

### Phase 3: Data Repository Layer (NEW - Core Sync Work)

This is the big new phase that wasn't in the original plan.

#### Task 3.1: Create Repository Interfaces (1 day)

**Files**:
- `src/services/data/DataRepository.ts` (interface)
- `src/services/data/types.ts` (shared types)

Define clean interfaces for all data operations.

#### Task 3.2: Implement LocalRepository (1 day)

**File**: `src/services/data/LocalRepository.ts`

This is mostly just **refactoring existing Dexie code** into a class. You already have this logic scattered across service files - we're just consolidating it.

#### Task 3.3: Implement RemoteRepository (2-3 days)

**File**: `src/services/data/RemoteRepository.ts`

New code that talks to Supabase. Includes:
- All CRUD operations for all tables
- Field mapping (camelCase ↔ snake_case)
- Error handling
- Type safety

#### Task 3.4: Implement SyncRepository (3-4 days)

**File**: `src/services/data/SyncRepository.ts`

The hybrid repository that:
- Reads from local (instant)
- Writes to local first (optimistic UI)
- Queues changes for sync
- Syncs in background

#### Task 3.5: Implement SyncEngine (4-5 days)

**File**: `src/services/data/SyncEngine.ts`

The sync engine that handles:
- Offline queue management
- Periodic background sync
- Pull from remote (download updates)
- Push to remote (upload changes)
- Conflict resolution (last-write-wins)
- Retry logic for failed syncs

#### Task 3.6: Update Database Schema for Sync (1 day)

**File**: `src/services/database/index.ts`

Add version 6 with:
- `syncQueue` table
- `syncMetadata` table
- `syncConflicts` table

#### Task 3.7: Update All Service Files (2-3 days)

**Files**: All service files (SongService, BandService, etc.)

Replace direct `db.songs.add()` calls with `repo.addSong()` calls.

**Estimated Lines Changed**: ~500-800 lines across 8-10 files
**Complexity**: Low - mostly find/replace with light refactoring

**Time**: 14-18 days total for Phase 3

---

### Phase 4: Component Updates (2-3 days)

Components shouldn't need much change since services abstract the data layer.

**Tasks**:
1. Add loading states for initial sync
2. Add sync status indicator (syncing, synced, offline)
3. Add manual "Sync Now" button
4. Add conflict resolution UI (optional)

**Files to Modify**:
- Add `<SyncStatusIndicator />` component to app header
- Update pages to show initial sync loading state

**Time**: 2-3 days

---

### Phase 5: Environment Configuration (1 day)

**Task 5.1: Local Dev Environment**

**File**: `.env.local.example`

```bash
# Local development mode (no Supabase needed)
VITE_MOCK_AUTH=true
VITE_SUPABASE_URL=mock
VITE_SUPABASE_ANON_KEY=mock
```

**Task 5.2: Production Environment**

**Vercel Environment Variables**:

```bash
# Production (real Supabase + sync)
VITE_MOCK_AUTH=false
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_GOOGLE_CLIENT_ID=570420132977-...
```

**Time**: 1 day

---

### Phase 6: Testing & Refinement (3-5 days)

**Testing Scenarios**:

1. **Offline → Online Sync**
   - Add song while offline
   - Go online
   - Verify song syncs to Supabase
   - Check appears on other devices

2. **Conflict Resolution**
   - Edit same song on two devices while offline
   - Go online
   - Verify last-write-wins behavior

3. **Basement Practice Scenario**
   - Load app with data
   - Go offline (basement)
   - Add setlist, update songs, record practice
   - Go online (back home)
   - Verify all changes sync

4. **Multi-Device Sync**
   - Make change on Device A
   - Wait 30 seconds
   - Verify change appears on Device B

5. **Local Dev Mode**
   - Set VITE_MOCK_AUTH=true
   - Verify app works without Supabase
   - Verify seed data works
   - Verify mock auth works

**Time**: 3-5 days

---

## Part 3: Updated Timeline

### Total Time: 4-5 Weeks Full-Time

**Week 1: Foundation**
- Days 1-3: Supabase SQL schema + RLS (Phase 1)
- Days 4-7: Dual auth setup (Phase 2)

**Week 2-3: Sync Layer (The Big Work)**
- Days 8-12: Repository pattern (LocalRepo, RemoteRepo)
- Days 13-17: SyncRepository implementation
- Days 18-25: SyncEngine (queue, conflict resolution, background sync)

**Week 4: Integration**
- Days 26-28: Update all service files
- Days 29-30: Update components
- Day 31: Environment configuration

**Week 5: Testing & Deployment**
- Days 32-36: Comprehensive testing
- Days 37-38: Bug fixes
- Days 39-40: Deploy to staging, then production

### Minimum Viable Sync (3 Weeks)

If you want to cut scope for faster MVP:

**Week 1**: Database + Auth
**Week 2**: Basic sync (create/update only, no conflict resolution)
**Week 3**: Service updates + testing

**Trade-offs**:
- No conflict resolution (last sync wins, might lose data)
- No delete sync (deletes local only)
- Manual sync button only (no automatic background sync)

---

## Part 4: Code Examples for Sync Architecture

### Example 1: Using the Repository in a Component

**Before** (Direct Dexie):

```typescript
// src/pages/NewLayout/SongsPage.tsx
import { db } from '../../services/database'

function SongsPage() {
  const [songs, setSongs] = useState<Song[]>([])

  useEffect(() => {
    db.songs.where('contextType').equals('band').toArray()
      .then(setSongs)
  }, [])

  const handleAddSong = async (song: Song) => {
    await db.songs.add(song)
    // Refresh list
  }
}
```

**After** (Repository with Sync):

```typescript
// src/pages/NewLayout/SongsPage.tsx
import { SongService } from '../../services/SongService'
import { useSyncStatus } from '../../hooks/useSyncStatus'

function SongsPage() {
  const [songs, setSongs] = useState<Song[]>([])
  const { isSyncing, lastSync } = useSyncStatus()

  useEffect(() => {
    SongService.getSongsByBand(bandId)
      .then(setSongs)
  }, [bandId])

  const handleAddSong = async (song: Song) => {
    // Optimistic UI update
    setSongs(prev => [...prev, song])

    try {
      // Saved locally immediately, queued for sync
      await SongService.addSong(song)
    } catch (error) {
      // Rollback on error
      setSongs(prev => prev.filter(s => s.id !== song.id))
      showError('Failed to add song')
    }
  }

  return (
    <div>
      {isSyncing && <Badge>Syncing...</Badge>}
      {!navigator.onLine && <Badge variant="warning">Offline Mode</Badge>}

      {/* Rest of UI */}
    </div>
  )
}
```

**Key Changes**:
- Service abstraction (no direct DB access)
- Optimistic UI updates
- Sync status indicators
- Offline awareness

### Example 2: Sync Status Hook

**New File**: `src/hooks/useSyncStatus.ts`

```typescript
import { useState, useEffect } from 'react'
import { syncEngine } from '../services/data/SyncEngine'

export function useSyncStatus() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [queueSize, setQueueSize] = useState(0)

  useEffect(() => {
    // Listen to sync events
    const unsubscribe = syncEngine.onSyncStatusChange((status) => {
      setIsSyncing(status.isSyncing)
      setLastSync(status.lastSync)
      setQueueSize(status.queueSize)
    })

    // Listen to online/offline
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      unsubscribe()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return {
    isSyncing,
    lastSync,
    isOnline,
    queueSize,
    canSync: isOnline && !isSyncing
  }
}
```

### Example 3: Sync Status Indicator Component

**New File**: `src/components/SyncStatusIndicator.tsx`

```typescript
import { useSyncStatus } from '../hooks/useSyncStatus'
import { CloudUpload, CloudOff, CloudCheck, Loader } from 'lucide-react'

export function SyncStatusIndicator() {
  const { isSyncing, isOnline, queueSize, lastSync } = useSyncStatus()

  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 text-yellow-600">
        <CloudOff className="w-4 h-4" />
        <span className="text-sm">Offline Mode</span>
        {queueSize > 0 && (
          <span className="text-xs">({queueSize} pending)</span>
        )}
      </div>
    )
  }

  if (isSyncing) {
    return (
      <div className="flex items-center gap-2 text-blue-600">
        <Loader className="w-4 h-4 animate-spin" />
        <span className="text-sm">Syncing...</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 text-green-600">
      <CloudCheck className="w-4 h-4" />
      <span className="text-sm">
        Synced {lastSync && formatTimeAgo(lastSync)}
      </span>
    </div>
  )
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}
```

---

## Part 5: Migration Strategy

### Step-by-Step Migration Plan

**Phase A: Set Up Dual Mode (Week 1)**

1. ✅ Keep existing code working
2. Add `appMode.ts` config
3. Add Supabase credentials to production env
4. Set `VITE_MOCK_AUTH=true` for local dev
5. Create Supabase projects and schema

**Phase B: Build Repository Layer (Week 2)**

1. Create `IDataRepository` interface
2. Extract Dexie code into `LocalRepository`
3. Build `RemoteRepository` for Supabase
4. Test each repository independently

**Phase C: Implement Sync (Week 3)**

1. Add sync tables to Dexie (version 6)
2. Build `SyncEngine` with basic queue
3. Build `SyncRepository` that uses both
4. Add background sync loop

**Phase D: Update Services (Week 4)**

1. Update one service at a time (start with `SongService`)
2. Test thoroughly after each service
3. Update components to use services (not direct DB)
4. Add sync status indicators

**Phase E: Test & Deploy (Week 5)**

1. Test offline scenarios
2. Test conflict resolution
3. Test multi-device sync
4. Deploy to staging
5. Beta test with real users
6. Deploy to production

### Rollback Plan

If sync isn't working, you can **easily rollback**:

1. Set `VITE_MOCK_AUTH=true` in production (forces local mode)
2. App reverts to local-only IndexedDB
3. No sync, but app still works offline

This is the beauty of the repository pattern - you can swap implementations without changing services or components.

---

## Part 6: Advanced Sync Features (Future Enhancements)

Once basic sync is working, you can add:

### 1. Real-Time Sync (Supabase Realtime)

**Benefit**: See changes from other band members instantly

```typescript
// In SyncEngine
private subscribeToRealtime() {
  supabase
    .channel('band-updates')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'songs',
      filter: `context_id=eq.${currentBandId}`
    }, (payload) => {
      // Update local DB when remote changes
      this.handleRealtimeUpdate(payload)
    })
    .subscribe()
}
```

### 2. Smarter Conflict Resolution

**Current**: Last-write-wins (simple but might lose data)

**Future Options**:
- Manual conflict resolution UI (show both versions, let user choose)
- Field-level merging (merge non-conflicting fields)
- Three-way merge (use common ancestor)

### 3. Selective Sync

**Benefit**: Save bandwidth, only sync what you need

```typescript
// Only sync current band's data
syncEngine.setSyncFilter({
  bands: [currentBandId],
  songs: { contextId: currentBandId },
  setlists: { bandId: currentBandId }
})
```

### 4. Sync Analytics

**Benefit**: Monitor sync health

```typescript
// Track sync metrics
{
  totalSyncs: 127,
  failedSyncs: 3,
  avgSyncTime: 1.2, // seconds
  lastSyncSize: 45, // records
  queueSize: 0
}
```

---

## Part 7: Specific Answers to Your Questions (Updated)

### Q: Should we throw away Dexie?

**Answer**: **No!** Dexie is the foundation. We're **adding** Supabase sync on top, not replacing Dexie.

Your app will:
- ✅ Read from Dexie (instant, offline-capable)
- ✅ Write to Dexie first (optimistic UI)
- ✅ Sync with Supabase in background (collaboration)

### Q: How do we support local dev without Supabase?

**Answer**: Mode detection via environment variables.

**Local Dev**:
```bash
# .env.local
VITE_MOCK_AUTH=true
```
- Uses MockAuthService
- Uses LocalRepository only (no sync)
- Seed data works
- No Supabase calls at all

**Production**:
```bash
# Vercel env vars
VITE_MOCK_AUTH=false
VITE_SUPABASE_URL=https://real-project.supabase.co
```
- Uses SupabaseAuthService
- Uses SyncRepository (Dexie + Supabase)
- Real auth with Google OAuth
- Background sync enabled

### Q: How does offline sync work in the basement?

**Perfect use case for this architecture!**

**Scenario**: Band practice in Mike's basement (no internet)

1. **Before Practice** (at home, online):
   - App syncs latest data
   - Downloads all songs, setlists, band info
   - Everything cached in IndexedDB

2. **During Practice** (in basement, offline):
   - App works normally (reading from IndexedDB)
   - Update song confidence levels
   - Mark practice session as complete
   - Add notes to songs
   - All writes go to IndexedDB
   - All changes queued for sync (stored in `syncQueue` table)

3. **After Practice** (back home, online):
   - App detects online connection
   - SyncEngine automatically runs
   - Pushes all queued changes to Supabase
   - Pulls any changes from other band members
   - Merges any conflicts (last-write-wins)
   - UI shows "Synced" status

**User Experience**: Completely seamless. User doesn't need to think about online/offline - it just works.

### Q: What if two people edit the same song offline?

**Answer**: Conflict resolution via last-write-wins.

**Example**:

1. **Alice** (offline): Changes "Wonderwall" confidence to 5
2. **Bob** (offline): Changes "Wonderwall" confidence to 3
3. Both go online
4. Alice syncs first → confidence is 5 in Supabase
5. Bob syncs second → confidence becomes 3 (Bob's write is later)
6. Alice's app pulls updates → her local copy becomes 3

**Better Solution** (future enhancement):
- Show conflict UI: "Bob also edited this song. Keep your changes or Bob's?"
- Let user manually resolve
- Store in `syncConflicts` table for later resolution

---

## Part 8: File Checklist

### New Files to Create

```
src/
├── config/
│   └── appMode.ts                    # Mode detection (local vs production)
│
├── services/
│   ├── data/
│   │   ├── DataRepository.ts         # Interface for all data operations
│   │   ├── LocalRepository.ts        # Dexie implementation
│   │   ├── RemoteRepository.ts       # Supabase implementation
│   │   ├── SyncRepository.ts         # Hybrid (local + remote + sync)
│   │   ├── SyncEngine.ts             # Background sync orchestrator
│   │   └── types.ts                  # Shared types
│   │
│   ├── auth/
│   │   ├── AuthFactory.ts            # Creates correct auth service
│   │   └── SupabaseAuthService.ts    # Real Supabase auth
│   │
│   └── supabase/
│       └── client.ts                 # Supabase client initialization
│
├── hooks/
│   └── useSyncStatus.ts              # React hook for sync status
│
└── components/
    └── SyncStatusIndicator.tsx       # UI component showing sync state

.env.local.example                    # Template for local dev
```

### Files to Modify

```
src/
├── services/
│   ├── database/index.ts             # Add version 6 (sync tables)
│   ├── SongService.ts                # Use repository instead of db
│   ├── BandService.ts                # Use repository
│   ├── SetlistService.ts             # Use repository
│   ├── PracticeSessionService.ts     # Use repository
│   └── BandMembershipService.ts      # Use repository
│
├── contexts/
│   └── AuthContext.tsx               # Use AuthFactory
│
├── pages/NewLayout/
│   ├── SongsPage.tsx                 # Add sync status
│   ├── SetlistsPage.tsx              # Add sync status
│   ├── PracticesPage.tsx             # Add sync status
│   └── ShowsPage.tsx                 # Add sync status
│
└── App.tsx                           # Add SyncStatusIndicator

.env.local                            # Set VITE_MOCK_AUTH=true
vercel.json                           # No changes needed
```

### Supabase Files (Same as Before)

```
supabase/
├── migrations/
│   ├── 20251024000000_initial_schema.sql
│   ├── 20251024010000_rls_policies.sql
│   └── 20251024020000_indexes.sql
├── seed.sql
└── config.toml
```

---

## Part 9: Summary & Next Steps

### What This Architecture Gives You

✅ **Local-first performance** - Instant reads/writes from IndexedDB
✅ **Offline support** - Full app functionality without internet
✅ **Collaboration** - Multi-device sync via Supabase
✅ **Basement practice support** - Queue changes offline, sync later
✅ **Local dev without Supabase** - Mock auth + seed data
✅ **Production deployment** - Real auth + cloud sync
✅ **Graceful degradation** - Works even if Supabase is down
✅ **Keep all your Dexie work** - Nothing thrown away!

### Effort Comparison

**Original Plan (Remote-Only)**: 2-3 weeks
**Updated Plan (Local-First Sync)**: 4-5 weeks

**Extra 2 weeks** buys you:
- Offline functionality
- Better performance (local reads)
- Continued local dev without Supabase
- More resilient architecture

**Worth it?** For a band practice app, **absolutely yes**. Offline support is a killer feature.

### Immediate Next Steps

1. **Review this architecture** (1-2 hours)
   - Does the dual-mode approach make sense?
   - Are you comfortable with last-write-wins conflict resolution?
   - Do you want to tackle this now or remote-only first?

2. **Decision Point**:
   - **Option A**: Implement full sync now (4-5 weeks, best final result)
   - **Option B**: Start with remote-only (2-3 weeks), add sync later (saves time now but harder migration later)

3. **If going with sync** (recommended):
   - Week 1: I'll help create Supabase schema + dual auth
   - Week 2: I'll help build repository layer
   - Week 3: I'll help build sync engine
   - Week 4-5: Integration and testing

### What I Can Help With Next

Ready to build this! Just tell me which approach you want:

1. **"Let's build the full sync architecture"** → I'll start with Phase 1 (Supabase schema)
2. **"Show me a simpler MVP first"** → I'll create a basic sync proof-of-concept
3. **"I have questions about the design"** → Happy to explain any part in more detail

What would you like to tackle first? 🚀
