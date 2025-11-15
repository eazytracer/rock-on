---
title: Cloud-First Sync Architecture & Implementation Plan
created: 2025-10-29T02:12
status: Proposal - Ready for Review
type: Architecture & Implementation
prompt: "Revisit sync engine concept, shift to Supabase-primary with IndexedDB cache, add visual sync indicators, implement immediate sync, plan developer dashboard"
---

# Cloud-First Sync Architecture & Implementation Plan

## Executive Summary

**Current Paradigm:** Local-first with cloud backup (IndexedDB primary, Supabase secondary)
**Proposed Paradigm:** Cloud-first with local cache (Supabase primary, IndexedDB cache)

This document outlines a comprehensive plan to shift RockOn's sync architecture to treat Supabase as the source of truth, with IndexedDB serving as a local cache and offline work queue. Includes visual sync indicators, immediate sync behavior, and developer tools.

---

## 🎯 Vision & Goals

### User Experience Goals
1. **Transparency**: Users always know sync status via subtle, intuitive visual indicators
2. **Immediacy**: Changes propagate immediately, not on 30-second delays
3. **Collaboration**: Band members see each other's changes in real-time
4. **Offline Capable**: App works offline, syncs when reconnected
5. **Trust**: Visual feedback builds confidence in data safety

### Technical Goals
1. **Supabase as Primary**: Cloud is source of truth
2. **IndexedDB as Cache**: Local storage for speed + offline
3. **Real-time Sync**: WebSocket-based updates (< 1 second latency)
4. **Version Control**: Track modifications for conflict detection
5. **Developer Tools**: Comprehensive debugging dashboard

---

## 📊 Current State Analysis

### What Exists ✅

**Sync Infrastructure:**
- `SyncEngine.ts` with queue-based push sync
- `LocalRepository` & `RemoteRepository` pattern
- Initial sync on login (`performInitialSync`)
- Periodic sync (30-second polling)
- Field name mapping (camelCase ↔ snake_case)

**UI Components:**
- `SyncStatusIndicator` (bottom-right corner)
- Connection indicator (green/red dot)
- Pending changes badge
- "Last synced at" timestamp

**Database Schema:**
- Unified schema with both IndexedDB and Supabase
- Proper JSONB handling
- Version control fields (`created_date`, `updated_date`)

### What's Missing ❌

**Architectural Gaps:**
- ❌ Supabase not treated as primary source
- ❌ No real-time WebSocket sync
- ❌ No per-item sync status indicators
- ❌ No change notifications (toasts)
- ❌ No "unread changes" indicators
- ❌ No developer dashboard

**Sync Behavior:**
- ❌ Still 30-second polling delay
- ❌ Pull sync might be commented out
- ❌ No optimistic UI updates with rollback
- ❌ No conflict detection/resolution

**UX Gaps:**
- ❌ Connection status not in nav
- ❌ No per-song/setlist/show sync indicators
- ❌ No toast for remote changes
- ❌ No visual "unread" badges

---

## 🏗️ Proposed Architecture

### Paradigm Shift: Cloud-First

```
┌─────────────────────────────────────────────────────────────┐
│                      USER INTERACTIONS                       │
│        (Create song, Edit setlist, Delete show)             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   OPTIMISTIC UI UPDATE                       │
│     1. Update IndexedDB (instant)                           │
│     2. Mark as "syncing" (show icon)                        │
│     3. Update UI immediately                                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    SYNC TO SUPABASE                          │
│     1. Push to Supabase (< 100ms)                           │
│     2. Receive server version with metadata                  │
│     3. Update IndexedDB with server data                     │
│     4. Mark as "synced" (show checkmark)                     │
│     5. Broadcast via WebSocket to other devices             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  OTHER DEVICES RECEIVE                       │
│     1. WebSocket receives change event                       │
│     2. Update IndexedDB with new data                        │
│     3. Mark item as "unread" if user didn't make change     │
│     4. Show toast notification                               │
│     5. Update UI reactively                                  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow: Write Operations

```typescript
// User creates a song
const song = { title: "Wonderwall", artist: "Oasis", ... }

// STEP 1: Write to IndexedDB immediately
await localRepo.addSong(song)  // ← Instant (< 10ms)
setSyncStatus(song.id, 'syncing')
updateUI()  // ← User sees new song immediately

// STEP 2: Queue for cloud sync
syncEngine.queueCreate('songs', song)

// STEP 3: Push to Supabase (background)
const serverSong = await remoteRepo.addSong(song)  // ← 50-200ms
// Server adds: created_by, created_date, version, etc.

// STEP 4: Update local with server version
await localRepo.updateSong(song.id, serverSong)
setSyncStatus(song.id, 'synced')

// STEP 5: Supabase broadcasts to other devices via WebSocket
// Device B receives event, updates UI, shows toast
```

### Data Flow: Read Operations

```typescript
// User opens Songs page
const songs = await repository.getSongs(bandId)

// STRATEGY 1: Cache-First (Offline-capable)
const cachedSongs = await localRepo.getSongs(bandId)  // ← Instant
displaySongs(cachedSongs)  // ← Show immediately

// Background: Check for updates
const remoteSongs = await remoteRepo.getSongs(bandId)  // ← 100-500ms
const hasChanges = detectChanges(cachedSongs, remoteSongs)

if (hasChanges) {
  await localRepo.replaceSongs(remoteSongs)  // ← Update cache
  displaySongs(remoteSongs)  // ← Update UI
  showToast("Songs updated by another band member")
}

// STRATEGY 2: Cloud-First (Always fresh)
const remoteSongs = await remoteRepo.getSongs(bandId)  // ← 100-500ms
await localRepo.replaceSongs(remoteSongs)  // ← Update cache
displaySongs(remoteSongs)
```

**Recommendation**: Use **Cache-First** for most screens (instant load), with background refresh.

---

## 🎨 Visual Sync Indicators

### 1. Per-Item Sync Status Icons

Every line item (song, setlist, show) gets a subtle status indicator:

```typescript
type SyncStatus = 'synced' | 'syncing' | 'pending' | 'error' | 'unread'

interface SyncIconProps {
  status: SyncStatus
  size?: 'sm' | 'md'
}

function SyncIcon({ status, size = 'sm' }: SyncIconProps) {
  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'

  switch (status) {
    case 'synced':
      return (
        <svg className={`${iconSize} text-green-500`} /* Cloud with checkmark */>
          {/* Icon: cloud with checkmark */}
        </svg>
      )

    case 'syncing':
      return (
        <svg className={`${iconSize} text-blue-500 animate-pulse`} /* Cloud with arrows */>
          {/* Icon: cloud with up/down arrows */}
        </svg>
      )

    case 'pending':
      return (
        <svg className={`${iconSize} text-yellow-500`} /* Cloud with clock */>
          {/* Icon: cloud with clock (offline queue) */}
        </svg>
      )

    case 'error':
      return (
        <svg className={`${iconSize} text-red-500`} /* Cloud with X */>
          {/* Icon: cloud with X */}
        </svg>
      )

    case 'unread':
      return (
        <div className="relative">
          <svg className={`${iconSize} text-green-500`}>
            {/* Icon: cloud with checkmark */}
          </svg>
          <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-white" />
        </div>
      )
  }
}
```

**Usage Example:**
```tsx
// In SongCard component
<div className="flex items-center gap-2">
  <SyncIcon status={getSyncStatus(song.id)} />
  <h3>{song.title}</h3>
</div>
```

**Visual Design:**
- **Synced**: Green cloud with checkmark ✅☁️
- **Syncing**: Blue cloud with arrows (animated pulse) 🔄☁️
- **Pending**: Yellow cloud with clock (offline) ⏰☁️
- **Error**: Red cloud with X ❌☁️
- **Unread**: Green cloud + blue dot badge 🔵☁️

### 2. Navigation Connection Indicator

Move sync status from bottom-right to top-left nav:

```tsx
// Desktop Sidebar (top-left)
<div className="flex items-center gap-3 p-4 border-b border-gray-800">
  {/* Connection Status */}
  <div className="flex items-center gap-2">
    <div className={`h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
    <span className="text-xs text-gray-400">
      {isOnline ? 'Connected' : 'Offline'}
    </span>
  </div>

  {/* Last Synced */}
  {lastSyncTime && (
    <div className="text-xs text-gray-500">
      Last synced: {formatRelativeTime(lastSyncTime)}
    </div>
  )}

  {/* Pending Count */}
  {pendingCount > 0 && (
    <span className="px-2 py-0.5 text-xs font-medium bg-yellow-900/30 text-yellow-400 rounded-full">
      {pendingCount} pending
    </span>
  )}
</div>
```

### 3. Toast Notifications for Remote Changes

When another band member makes a change:

```tsx
// Toast component
<Toast variant="info" duration={5000}>
  <div className="flex items-center gap-3">
    <Avatar src={user.avatarUrl} size="sm" />
    <div>
      <p className="font-medium">Sarah added a song</p>
      <p className="text-sm text-gray-400">"Wonderwall" by Oasis</p>
    </div>
  </div>
</Toast>
```

**Toast Triggers:**
- Song added by other user
- Setlist modified by other user
- Show updated by other user
- Practice scheduled by other user

### 4. "Unread" Status Badges

Track which items have been modified by others since user last viewed:

```tsx
// In list items
<div className="flex items-center gap-2">
  <SyncIcon status={song.unread ? 'unread' : 'synced'} />
  <h3 className={song.unread ? 'font-semibold' : ''}>{song.title}</h3>
  {song.unread && (
    <span className="ml-2 h-2 w-2 rounded-full bg-blue-500" />
  )}
</div>
```

**Unread Logic:**
```typescript
// Mark as read when user views/edits
async function markAsRead(itemId: string) {
  await db.readStatus.put({
    itemId,
    userId: currentUserId,
    readAt: new Date()
  })
}

// Check if unread
function isUnread(item: Song | Setlist | Show): boolean {
  const readStatus = await db.readStatus.get({ itemId: item.id, userId })
  if (!readStatus) return false
  return item.updatedDate > readStatus.readAt
}
```

---

## 🔄 Sync Engine Enhancements

### Version Control Fields

Add to all synced tables:

```typescript
interface Versioned {
  version: number         // Increments on each update
  lastModifiedBy: string  // User ID who made last change
  lastModified: Date      // Timestamp of last change
  createdBy: string       // Original creator
  createdDate: Date       // Creation timestamp
}
```

**Supabase Schema Updates:**
```sql
-- Add version tracking to all tables
ALTER TABLE songs ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE setlists ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE shows ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE practice_sessions ADD COLUMN version INTEGER DEFAULT 1;

-- Add trigger to auto-increment version
CREATE OR REPLACE FUNCTION increment_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = COALESCE(OLD.version, 0) + 1;
  NEW.updated_date = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER songs_version_trigger
  BEFORE UPDATE ON songs
  FOR EACH ROW
  EXECUTE FUNCTION increment_version();

-- Repeat for other tables
```

**IndexedDB Schema:**
```typescript
// Add to Dexie schema
this.version(4).stores({
  songs: '++id, ..., version, lastModifiedBy',
  setlists: '++id, ..., version, lastModifiedBy',
  shows: '++id, ..., version, lastModifiedBy',
  practiceSessions: '++id, ..., version, lastModifiedBy'
})
```

### Conflict Detection (Future)

```typescript
async function detectConflict(
  localItem: Versioned,
  remoteItem: Versioned
): Promise<boolean> {
  // No conflict if same version
  if (localItem.version === remoteItem.version) return false

  // Conflict if both modified since last sync
  const lastSync = await getLastSyncTime()
  const localModified = localItem.lastModified > lastSync
  const remoteModified = remoteItem.lastModified > lastSync

  return localModified && remoteModified
}

// Resolution strategy (for now: last-write-wins)
async function resolveConflict(
  local: Versioned,
  remote: Versioned
): Promise<Versioned> {
  // Future: Show UI modal for user to choose
  // Current: Newer timestamp wins
  return local.lastModified > remote.lastModified ? local : remote
}
```

### Real-Time WebSocket Sync

**Implementation Plan** (see Phase 3 below):

```typescript
// RealtimeManager.ts
class RealtimeManager {
  private channels: Map<string, RealtimeChannel> = new Map()

  async subscribeToUserBands(userId: string, bandIds: string[]) {
    for (const bandId of bandIds) {
      // Subscribe to songs
      const songsChannel = supabase
        .channel(`songs-${bandId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'songs',
          filter: `context_id=eq.${bandId}`
        }, (payload) => {
          this.handleSongChange(payload)
        })
        .subscribe()

      this.channels.set(`songs-${bandId}`, songsChannel)

      // Repeat for setlists, shows, practices...
    }
  }

  private async handleSongChange(payload: any) {
    const { eventType, new: newRow, old: oldRow } = payload

    // Skip if current user made the change
    if (newRow.created_by === currentUserId) return

    // Update IndexedDB
    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      const song = mapSongFromSupabase(newRow)
      await localRepo.updateSong(song.id, { ...song, unread: true })

      // Show toast notification
      showToast({
        type: 'info',
        message: `${getUserName(newRow.created_by)} ${eventType === 'INSERT' ? 'added' : 'updated'} "${newRow.title}"`,
        duration: 5000
      })
    }

    if (eventType === 'DELETE') {
      await localRepo.deleteSong(oldRow.id)
      showToast({
        type: 'info',
        message: `${getUserName(oldRow.created_by)} deleted a song`,
        duration: 5000
      })
    }

    // Notify UI to refresh
    emitDataChangeEvent()
  }
}
```

---

## 🎯 Implementation Phases

### Phase 1: Visual Indicators & UI (5-7 hours)

**Goal**: Add visual sync status to UI without changing sync logic

**Tasks:**

1. **Create SyncIcon component** (1 hour)
   - File: `src/components/sync/SyncIcon.tsx`
   - Implement all 5 status states
   - Add cloud SVG icons
   - Add unread badge indicator

2. **Add per-item sync tracking** (2 hours)
   - File: `src/hooks/useSyncStatus.ts` (enhance)
   - Track sync status per item ID
   - Add `getSyncStatus(itemId)` function
   - Store in React Context or Zustand

3. **Update list components** (2 hours)
   - `SongsPage.tsx`: Add SyncIcon to each song row
   - `SetlistsPage.tsx`: Add SyncIcon to each setlist card
   - `ShowsPage.tsx`: Add SyncIcon to each show row
   - `PracticesPage.tsx`: Add SyncIcon to each practice row

4. **Move connection indicator to nav** (1 hour)
   - Update `Sidebar.tsx` (desktop)
   - Update `MobileHeader.tsx` (mobile)
   - Add "Last synced at" timestamp
   - Add pending changes badge

5. **Add Toast infrastructure** (1 hour)
   - File: `src/contexts/ToastContext.tsx` (already exists)
   - Enhance with avatar support
   - Add auto-dismiss after 5 seconds

**Deliverables:**
- ✅ Visual sync indicators on all list items
- ✅ Connection status in nav
- ✅ Toast notifications ready (not triggered yet)
- ✅ No sync behavior changes (backward compatible)

**Success Criteria:**
- User can see sync status for each item
- Connection status visible in nav
- Pending changes count visible
- No regression in existing sync

---

### Phase 2: Immediate Sync & Cloud-First (6-8 hours)

**Goal**: Shift from 30-second polling to immediate sync + cloud-first reads

**Tasks:**

1. **Update SyncEngine for immediate push** (2 hours)
   - File: `src/services/data/SyncEngine.ts`
   - Change `startPeriodicSync()` from 30s to 5s (temporary)
   - Add `syncNow()` trigger on every write operation
   - Implement retry logic with exponential backoff

2. **Add version control fields** (2 hours)
   - Migration: `supabase/migrations/20251029000001_add_version_tracking.sql`
   - Add `version`, `last_modified_by` to all tables
   - Create triggers to auto-increment version
   - Update TypeScript models

3. **Implement optimistic updates** (2 hours)
   - Update `SyncRepository.ts` to:
     1. Write to IndexedDB (instant)
     2. Mark as 'syncing'
     3. Update UI
     4. Push to Supabase
     5. Update with server response
     6. Mark as 'synced'
   - Add rollback on error

4. **Add cloud-first read strategy** (2 hours)
   - Implement cache-first with background refresh
   - Update `SyncEngine.pullFromRemote()` to run on page load
   - Detect changes and update UI
   - Show toast if changes detected

**Deliverables:**
- ✅ Writes sync immediately (< 1 second)
- ✅ Version control in place
- ✅ Optimistic UI updates
- ✅ Cloud-first reads with local cache

**Success Criteria:**
- Changes appear on Device 2 within 5 seconds
- UI updates instantly on write
- Background refresh works
- No data loss on errors

---

### Phase 3: Real-Time WebSocket Sync (8-10 hours)

**Goal**: Replace polling with WebSocket subscriptions for < 1 second latency

**Tasks:**

1. **Create RealtimeManager** (3 hours)
   - File: `src/services/data/RealtimeManager.ts`
   - Subscribe to Supabase Realtime channels
   - Handle INSERT, UPDATE, DELETE events
   - Map Supabase → IndexedDB format

2. **Integrate with SyncRepository** (2 hours)
   - Start subscriptions on login
   - Stop subscriptions on logout
   - Handle reconnection
   - Fallback to polling if WebSocket fails

3. **Add change notifications** (2 hours)
   - Show toast when other user makes change
   - Mark items as 'unread'
   - Fetch user info for toast (avatar, name)

4. **Implement unread tracking** (2 hours)
   - IndexedDB table: `readStatus`
   - Mark as read when user views/edits
   - Show unread badge in UI
   - Clear on interaction

5. **Testing & refinement** (1 hour)
   - Two-device testing
   - Offline/online transitions
   - WebSocket reconnection
   - Performance validation

**Deliverables:**
- ✅ Real-time sync (< 1 second latency)
- ✅ Toast notifications for remote changes
- ✅ Unread status tracking
- ✅ Robust WebSocket handling

**Success Criteria:**
- Changes appear on Device 2 in < 1 second
- Toasts show who made change
- Unread badges work correctly
- Graceful degradation if WebSocket fails

---

### Phase 4: Developer Dashboard (6-8 hours)

**Goal**: Build comprehensive dev tools for debugging sync and database state

**Dashboard Features:**

#### 4.1: Database Inspector
```tsx
// DevDashboard.tsx (only in dev mode)
<Tabs>
  <Tab label="Database Status">
    <div className="space-y-4">
      {/* Connection Info */}
      <Section title="Connection">
        <KeyValue label="Mode" value={config.mode} />
        <KeyValue label="Supabase URL" value={config.supabaseUrl} />
        <KeyValue label="Status" value={isConnected ? "Connected" : "Disconnected"} />
        <KeyValue label="Last Sync" value={formatTime(lastSync)} />
      </Section>

      {/* IndexedDB Stats */}
      <Section title="IndexedDB (Local Cache)">
        <KeyValue label="Songs" value={counts.songs} />
        <KeyValue label="Setlists" value={counts.setlists} />
        <KeyValue label="Shows" value={counts.shows} />
        <KeyValue label="Practices" value={counts.practices} />
        <KeyValue label="Queue Size" value={queueSize} />
      </Section>

      {/* Supabase Stats */}
      <Section title="Supabase (Cloud)">
        <KeyValue label="Songs" value={remoteCounts.songs} />
        <KeyValue label="Setlists" value={remoteCounts.setlists} />
        <KeyValue label="Shows" value={remoteCounts.shows} />
        <KeyValue label="Practices" value={remoteCounts.practices} />
      </Section>
    </div>
  </Tab>

  <Tab label="Sync Queue">
    <SyncQueueTable items={queueItems} />
  </Tab>

  <Tab label="Raw Data">
    <DataViewer
      tables={['songs', 'setlists', 'shows', 'practices']}
      source="both"
    />
  </Tab>

  <Tab label="Tools">
    <div className="space-y-4">
      <Button onClick={purgeLocalDB} variant="danger">
        🗑️ Purge IndexedDB
      </Button>

      <Button onClick={purgeSupabase} variant="danger">
        ☁️ Purge Supabase (Dangerous!)
      </Button>

      <Button onClick={loadMockData} variant="primary">
        🎭 Load Mock Data
      </Button>

      <Button onClick={forceFullSync} variant="secondary">
        🔄 Force Full Sync
      </Button>

      <Button onClick={clearReadStatus} variant="secondary">
        👁️ Clear All "Unread" Status
      </Button>

      <Button onClick={exportAllData} variant="secondary">
        💾 Export All Data (JSON)
      </Button>
    </div>
  </Tab>
</Tabs>
```

#### 4.2: Sync Log Viewer
```tsx
<Tab label="Sync Log">
  <LogViewer
    logs={syncLogs}
    filters={['push', 'pull', 'realtime', 'error']}
    autoRefresh
  />
</Tab>

// Example log entries
{
  timestamp: "2025-10-29T02:15:32",
  type: "push",
  table: "songs",
  operation: "create",
  recordId: "uuid-123",
  duration: 142,
  status: "success"
}
```

#### 4.3: Network Request Inspector
```tsx
<Tab label="Network">
  <NetworkInspector
    requests={recentRequests}
    showDetails={true}
  />
</Tab>

// Capture all Supabase API calls
{
  method: "POST",
  url: "/rest/v1/songs",
  status: 201,
  duration: 128,
  requestBody: {...},
  responseBody: {...}
}
```

#### 4.4: Conflict Simulator
```tsx
<Tab label="Testing">
  <div className="space-y-4">
    <h3>Conflict Simulator</h3>
    <p>Test conflict detection by creating simultaneous edits</p>

    <Button onClick={simulateConflict}>
      Simulate Edit Conflict
    </Button>

    <h3>Network Simulator</h3>
    <p>Test offline/online transitions</p>

    <Button onClick={goOffline}>
      Simulate Offline
    </Button>

    <Button onClick={goOnline}>
      Simulate Online
    </Button>
  </div>
</Tab>
```

**Implementation:**

1. **Create DevDashboard route** (2 hours)
   - File: `src/pages/DevDashboard.tsx`
   - Only accessible when `import.meta.env.DEV === true`
   - Add route: `/dev/dashboard`
   - Not visible in production builds

2. **Implement database stats** (2 hours)
   - Count records in IndexedDB
   - Count records in Supabase
   - Show sync queue size
   - Real-time updates

3. **Build sync log viewer** (2 hours)
   - Capture all sync operations
   - Store in IndexedDB (last 1000 entries)
   - Display with filters
   - Auto-refresh

4. **Add developer tools** (2 hours)
   - Purge databases (with confirmation)
   - Load mock/seed data
   - Force sync operations
   - Export data as JSON

**Deliverables:**
- ✅ Comprehensive dev dashboard
- ✅ Database inspection tools
- ✅ Sync debugging tools
- ✅ Network request inspector

**Success Criteria:**
- Easy to diagnose sync issues
- Can test offline scenarios
- Can inspect database state
- Helpful for development

---

## 🧪 Testing Strategy

### Unit Tests

**Sync Engine Tests:**
```typescript
describe('SyncEngine', () => {
  it('should sync immediately on write', async () => {
    const song = createMockSong()
    await repo.addSong(song)

    // Should push within 1 second
    await waitFor(() => {
      expect(remoteMock.addSong).toHaveBeenCalledWith(song)
    }, { timeout: 1000 })
  })

  it('should mark item as syncing then synced', async () => {
    const song = createMockSong()

    const statusSpy = jest.fn()
    syncEngine.onStatusChange(statusSpy)

    await repo.addSong(song)

    expect(statusSpy).toHaveBeenNthCalledWith(1, song.id, 'syncing')
    await waitForSync()
    expect(statusSpy).toHaveBeenNthCalledWith(2, song.id, 'synced')
  })

  it('should rollback on error', async () => {
    remoteMock.addSong.mockRejectedValue(new Error('Network error'))

    const song = createMockSong()
    await repo.addSong(song)

    // Should remain in local DB
    const local = await localRepo.getSong(song.id)
    expect(local).toBeDefined()

    // Should mark as error
    expect(getSyncStatus(song.id)).toBe('error')
  })
})
```

**Version Control Tests:**
```typescript
describe('Version Control', () => {
  it('should increment version on update', async () => {
    const song = await repo.addSong(createMockSong())
    expect(song.version).toBe(1)

    const updated = await repo.updateSong(song.id, { title: 'New Title' })
    expect(updated.version).toBe(2)
  })

  it('should detect conflicts', async () => {
    const local = { ...song, version: 2, lastModified: new Date('2025-10-29T10:00') }
    const remote = { ...song, version: 2, lastModified: new Date('2025-10-29T10:01') }

    const hasConflict = await detectConflict(local, remote)
    expect(hasConflict).toBe(true)
  })
})
```

### Integration Tests

**Multi-Device Sync Test:**
```typescript
describe('Multi-Device Sync', () => {
  it('should sync changes between devices in < 1 second', async () => {
    // Device A creates song
    const deviceA = new SyncRepository()
    const song = await deviceA.addSong(createMockSong())

    // Device B should receive via WebSocket
    const deviceB = new SyncRepository()

    await waitFor(async () => {
      const received = await deviceB.getSong(song.id)
      expect(received).toBeDefined()
      expect(received.title).toBe(song.title)
    }, { timeout: 1000 })
  })

  it('should show toast on Device B when Device A makes change', async () => {
    const toastSpy = jest.fn()
    deviceB.onToast(toastSpy)

    await deviceA.addSong(createMockSong())

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith({
        type: 'info',
        message: expect.stringContaining('added')
      })
    })
  })
})
```

**Offline/Online Test:**
```typescript
describe('Offline/Online', () => {
  it('should queue changes when offline', async () => {
    goOffline()

    const song = await repo.addSong(createMockSong())

    expect(getSyncStatus(song.id)).toBe('pending')
    expect(getQueueSize()).toBe(1)
  })

  it('should sync queued changes when back online', async () => {
    goOffline()
    await repo.addSong(createMockSong())

    goOnline()

    await waitFor(() => {
      expect(getQueueSize()).toBe(0)
      expect(getSyncStatus(song.id)).toBe('synced')
    }, { timeout: 5000 })
  })
})
```

### Manual Testing Scenarios

**Scenario 1: Real-Time Collaboration**
1. Open app on Device A (Chrome)
2. Open app on Device B (Firefox/Incognito)
3. Login as same user on both
4. Device A: Create song "Wonderwall"
5. **Device B: Should see song appear in < 1 second**
6. **Device B: Should show toast "You added Wonderwall"**
7. **Device B: Song should have unread badge**
8. Device B: Click song (marks as read)
9. **Device B: Unread badge disappears**

**Scenario 2: Offline Work**
1. Device A: Go offline (DevTools Network → Offline)
2. Device A: Create 3 songs
3. **Device A: Songs should show "pending" status (yellow cloud)**
4. **Device A: Pending count should show "3 pending" in nav**
5. Device A: Go online
6. **Device A: All 3 songs should change to "syncing" then "synced"**
7. **Device B: Should receive all 3 songs with toasts**

**Scenario 3: Conflict Detection (Future)**
1. Device A: Edit song title to "Song A"
2. Device B: Edit same song title to "Song B" (within 5 seconds)
3. **Both: Should detect conflict**
4. **Modal: Should show both versions**
5. User chooses version
6. **Both: Should resolve to chosen version**

---

## ⚠️ Potential Gotchas & Mitigations

### Gotcha 1: WebSocket Connection Limits

**Problem**: Supabase free tier limits WebSocket connections
**Mitigation**:
- Subscribe only to user's active bands
- Unsubscribe on logout
- Fallback to polling if subscription fails

### Gotcha 2: Race Conditions

**Problem**: Rapid edits might arrive out of order
**Mitigation**:
- Use version numbers to detect out-of-order updates
- Always accept higher version number
- Show warning if version mismatch detected

### Gotcha 3: Toast Spam

**Problem**: Too many toasts if band is very active
**Mitigation**:
- Batch toasts: "3 new changes by Sarah"
- Deduplicate within 5-second window
- Pause toasts if more than 5 in 10 seconds

### Gotcha 4: IndexedDB Quota

**Problem**: Browser storage limits (typically 50-100 MB)
**Mitigation**:
- Monitor usage in dev dashboard
- Implement LRU cache eviction
- Only cache recent items (last 30 days)
- Warn user when approaching limit

### Gotcha 5: Supabase Rate Limits

**Problem**: Too many API calls might hit rate limits
**Mitigation**:
- Batch updates when possible
- Debounce rapid edits (500ms)
- Use WebSocket for reads (no API calls)
- Show warning if rate limit hit

### Gotcha 6: Clock Skew

**Problem**: Device clocks out of sync cause version conflicts
**Mitigation**:
- Always use server timestamps from Supabase
- Don't trust client timestamps
- Compare versions, not timestamps

### Gotcha 7: Large Setlists Performance

**Problem**: Syncing setlist with 100+ songs is slow
**Mitigation**:
- Use JSONB for setlist items (single column)
- Don't sync individual song changes within setlist
- Debounce setlist updates (wait 2s after last edit)

### Gotcha 8: Dev Dashboard in Production

**Problem**: Accidentally exposing dev tools in production
**Mitigation**:
```typescript
// Only register route in dev mode
if (import.meta.env.DEV) {
  routes.push({
    path: '/dev/dashboard',
    element: <DevDashboard />
  })
}

// Tree-shake in production build
if (process.env.NODE_ENV === 'production') {
  // DevDashboard code excluded from bundle
}
```

---

## 📋 Implementation Checklist

### Phase 1: Visual Indicators (5-7 hours)
- [ ] Create `SyncIcon.tsx` component
- [ ] Add sync status tracking to `useSyncStatus.ts`
- [ ] Update `SongsPage.tsx` with sync icons
- [ ] Update `SetlistsPage.tsx` with sync icons
- [ ] Update `ShowsPage.tsx` with sync icons
- [ ] Update `PracticesPage.tsx` with sync icons
- [ ] Move connection indicator to `Sidebar.tsx`
- [ ] Move connection indicator to `MobileHeader.tsx`
- [ ] Add "Last synced at" timestamp
- [ ] Add pending changes badge
- [ ] Enhance `ToastContext.tsx` for change notifications
- [ ] Test UI changes across all pages

### Phase 2: Immediate Sync (6-8 hours)
- [ ] Update `SyncEngine.ts` for immediate push
- [ ] Create migration: `add_version_tracking.sql`
- [ ] Add version fields to TypeScript models
- [ ] Implement optimistic updates in `SyncRepository.ts`
- [ ] Add rollback on error
- [ ] Implement cache-first read strategy
- [ ] Update `pullFromRemote()` to run on page load
- [ ] Add background refresh
- [ ] Test immediate sync (< 5 seconds)
- [ ] Test optimistic updates
- [ ] Test rollback on error

### Phase 3: Real-Time Sync (8-10 hours)
- [ ] Create `RealtimeManager.ts`
- [ ] Subscribe to songs table
- [ ] Subscribe to setlists table
- [ ] Subscribe to shows table
- [ ] Subscribe to practices table
- [ ] Integrate with `SyncRepository.ts`
- [ ] Start subscriptions on login
- [ ] Stop subscriptions on logout
- [ ] Handle WebSocket reconnection
- [ ] Add toast notifications for remote changes
- [ ] Create `readStatus` IndexedDB table
- [ ] Implement mark as read/unread
- [ ] Add unread badges to UI
- [ ] Test two-device sync (< 1 second)
- [ ] Test WebSocket reconnection
- [ ] Test toast notifications

### Phase 4: Developer Dashboard (6-8 hours)
- [ ] Create `DevDashboard.tsx` page
- [ ] Add `/dev/dashboard` route (dev only)
- [ ] Implement database stats view
- [ ] Implement sync queue viewer
- [ ] Implement raw data viewer
- [ ] Add purge IndexedDB button
- [ ] Add purge Supabase button (with warnings)
- [ ] Add load mock data button
- [ ] Add force sync button
- [ ] Create sync log viewer
- [ ] Create network request inspector
- [ ] Add conflict simulator
- [ ] Add offline/online simulator
- [ ] Test all dev tools
- [ ] Verify excluded from production build

---

## 🎯 Success Metrics

### Performance Metrics
- ✅ Write latency: < 100ms (local) + < 200ms (cloud)
- ✅ Read latency: < 50ms (cache) + < 500ms (cloud refresh)
- ✅ Sync propagation: < 1 second (WebSocket) or < 5 seconds (polling)
- ✅ Offline queue processing: < 3 seconds after reconnect

### UX Metrics
- ✅ User can see sync status for every item
- ✅ User knows when last synced
- ✅ User sees who made changes (toast with avatar)
- ✅ User can tell which items are unread
- ✅ Connection status always visible

### Reliability Metrics
- ✅ No data loss in offline mode
- ✅ Graceful degradation if WebSocket fails
- ✅ Automatic reconnection
- ✅ Conflict detection works (future)

### Developer Metrics
- ✅ Easy to debug sync issues
- ✅ Can test offline scenarios
- ✅ Can inspect database state
- ✅ Can simulate conflicts

---

## 🚀 Deployment Strategy

### Phase 1: Beta Testing (Internal)
1. Deploy to staging environment
2. Test with 2-3 team members
3. Validate sync works across devices
4. Gather feedback on UX

### Phase 2: Limited Rollout
1. Deploy to production
2. Enable for 10% of users (feature flag)
3. Monitor error rates
4. Monitor performance metrics

### Phase 3: Full Rollout
1. Enable for 50% of users
2. Monitor for 1 week
3. Enable for 100% if stable
4. Remove old polling code (deprecated)

### Feature Flags
```typescript
// .env.local
VITE_ENABLE_REALTIME=true       # Enable WebSocket sync
VITE_ENABLE_SYNC_ICONS=true     # Show per-item sync status
VITE_ENABLE_TOASTS=true         # Show change notifications
VITE_SYNC_INTERVAL=5000         # Fallback polling interval (ms)
```

---

## 📚 Documentation Updates

After implementation, update:

1. **User Guide**
   - How sync works
   - What sync icons mean
   - How to handle offline mode
   - What to do if sync fails

2. **Developer Guide**
   - How to use dev dashboard
   - How to debug sync issues
   - How to test multi-device scenarios
   - How to add new synced entities

3. **Architecture Docs**
   - Update sync flow diagrams
   - Document version control
   - Explain conflict resolution
   - WebSocket architecture

---

## 🔮 Future Enhancements

### Real-Time Presence
Show who's currently online and viewing same page:
```tsx
<PresenceIndicator users={onlineUsers} />
```

### Collaborative Editing
Multiple users editing same setlist simultaneously:
```tsx
<SetlistBuilder
  collaborators={activeEditors}
  showLiveChanges={true}
/>
```

### Sync Analytics
Track sync performance over time:
- Average sync latency
- Sync success rate
- Offline duration
- Conflict frequency

### Smart Caching
Predictive caching based on usage patterns:
- Pre-cache likely-to-be-viewed items
- Evict least-used items first
- Download upcoming shows in background

---

## 📊 Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Visual Indicators | 5-7 hours | None |
| Phase 2: Immediate Sync | 6-8 hours | Phase 1 |
| Phase 3: Real-Time Sync | 8-10 hours | Phase 2 |
| Phase 4: Developer Dashboard | 6-8 hours | None (parallel) |
| **Total** | **25-33 hours** | Sequential (except Phase 4) |

**Recommended Approach**:
- Week 1: Phase 1 + Phase 2
- Week 2: Phase 3
- Week 3: Phase 4 + Testing + Refinement

---

## ✅ Next Steps

1. **Review this document** with team
2. **Prioritize phases** based on business needs
3. **Set up feature flags** for gradual rollout
4. **Create GitHub issues** for each phase
5. **Start with Phase 1** (lowest risk, high value)

---

**Status**: Ready for Review
**Created**: 2025-10-29T02:12
**Estimated Total Effort**: 25-33 hours
**Risk Level**: Medium (well-scoped, incremental approach)
**Business Value**: High (improved UX, collaboration, trust)
