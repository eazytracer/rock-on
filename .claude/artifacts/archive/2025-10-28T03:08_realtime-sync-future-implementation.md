---
title: Real-Time Sync Implementation Plan (Future)
created: 2025-10-28T03:05
status: Future Enhancement
priority: HIGH (Required for live show use case)
estimated_time: 8-13 hours
---

# Real-Time Sync Implementation Plan

## Problem Statement

**Current Architecture**: Polling-based sync (30-second intervals)
- Device A makes change → Syncs to Supabase immediately ✅
- Device B polls every 30 seconds → Sees change after 30s ❌

**Use Case Requirement**: Live show collaboration
- Guitar player adds song to setlist
- Singer needs to see it **immediately** (< 1 second)
- Current 30-second delay is unacceptable for live performances

**Conclusion**: Need real-time WebSocket-based sync using Supabase Realtime

---

## Architecture Comparison

### Current: Polling (Eventual Consistency)

```
Device A                    Supabase                    Device B
--------                    --------                    --------
[User edits song]
   ↓
[Write to IndexedDB] ←────────────────────────────────────────────
   ↓ (instant)
[Push to Supabase] ────────→ [Store change]
   ↓ (< 100ms)                     ↓
[UI updates]                       ↓
                                   ↓
                              [Wait 30s] ←───────── [Periodic poll]
                                   ↓                      ↑
                              [Return data] ─────────→ [Receive]
                                                         ↓
                                                    [Update IndexedDB]
                                                         ↓
                                                    [UI updates]

LATENCY: 30 seconds ❌
```

### Proposed: Real-Time (WebSocket)

```
Device A                    Supabase                    Device B
--------                    --------                    --------
[User edits song]                                  [WebSocket connected]
   ↓                                                      ↑
[Write to IndexedDB]                                     |
   ↓ (instant)                                           |
[Push to Supabase] ────────→ [Store change]             |
   ↓ (< 100ms)                     ↓                     |
[UI updates]                  [Broadcast via WS] ────────┘
                                   ↓ (< 100ms)
                              [Device B receives]
                                   ↓
                              [Update IndexedDB]
                                   ↓
                              [UI updates]

LATENCY: < 1 second ✅
```

---

## Implementation Plan

### Phase 1: Add Supabase Realtime Infrastructure (3-4 hours)

#### 1.1: Install Dependencies (if needed)

Supabase client already includes Realtime, verify:

```typescript
// Check package.json
"@supabase/supabase-js": "^2.x.x"  // Should have Realtime
```

#### 1.2: Create Realtime Manager

**File**: `src/services/data/RealtimeManager.ts`

```typescript
import { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../supabase/supabaseClient'
import { LocalRepository } from './LocalRepository'

export class RealtimeManager {
  private channels: Map<string, RealtimeChannel> = new Map()
  private local: LocalRepository
  private listeners: Set<() => void> = new Set()

  constructor(local: LocalRepository) {
    this.local = local
  }

  /**
   * Subscribe to all tables for a user's bands
   */
  async subscribeToUserBands(userId: string, bandIds: string[]): Promise<void> {
    console.log('🔴 Starting realtime subscriptions for bands:', bandIds)

    for (const bandId of bandIds) {
      await this.subscribeToBand(bandId)
    }
  }

  /**
   * Subscribe to all changes for a specific band
   */
  private async subscribeToBand(bandId: string): Promise<void> {
    // Songs
    const songsChannel = supabase
      .channel(`songs-${bandId}`)
      .on('postgres_changes', {
        event: '*',  // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'songs',
        filter: `context_id=eq.${bandId}`
      }, (payload) => {
        this.handleSongChange(payload)
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Subscribed to songs for band ${bandId}`)
        }
      })

    this.channels.set(`songs-${bandId}`, songsChannel)

    // Setlists
    const setlistsChannel = supabase
      .channel(`setlists-${bandId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'setlists',
        filter: `band_id=eq.${bandId}`
      }, (payload) => {
        this.handleSetlistChange(payload)
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Subscribed to setlists for band ${bandId}`)
        }
      })

    this.channels.set(`setlists-${bandId}`, setlistsChannel)

    // Practice Sessions
    const practicesChannel = supabase
      .channel(`practices-${bandId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'practice_sessions',
        filter: `band_id=eq.${bandId}`
      }, (payload) => {
        this.handlePracticeChange(payload)
      })
      .subscribe()

    this.channels.set(`practices-${bandId}`, practicesChannel)

    // Shows (if table exists)
    const showsChannel = supabase
      .channel(`shows-${bandId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'shows',
        filter: `band_id=eq.${bandId}`
      }, (payload) => {
        this.handleShowChange(payload)
      })
      .subscribe()

    this.channels.set(`shows-${bandId}`, showsChannel)
  }

  /**
   * Handle song changes from Realtime
   */
  private async handleSongChange(payload: any): Promise<void> {
    console.log('🔴 Realtime song change:', payload.eventType, payload)

    try {
      switch (payload.eventType) {
        case 'INSERT':
          // Map from Supabase format to app format
          const newSong = this.mapSongFromSupabase(payload.new)
          await this.local.addSong(newSong).catch(() => {
            // Already exists, update instead
            return this.local.updateSong(newSong.id, newSong)
          })
          break

        case 'UPDATE':
          const updatedSong = this.mapSongFromSupabase(payload.new)
          await this.local.updateSong(updatedSong.id, updatedSong)
          break

        case 'DELETE':
          await this.local.deleteSong(payload.old.id)
          break
      }

      // Notify UI to refresh
      this.notifyListeners()
    } catch (error) {
      console.error('Failed to handle song change:', error)
    }
  }

  /**
   * Handle setlist changes from Realtime
   */
  private async handleSetlistChange(payload: any): Promise<void> {
    console.log('🔴 Realtime setlist change:', payload.eventType)

    try {
      switch (payload.eventType) {
        case 'INSERT':
          const newSetlist = this.mapSetlistFromSupabase(payload.new)
          await this.local.addSetlist(newSetlist).catch(() => {
            return this.local.updateSetlist(newSetlist.id, newSetlist)
          })
          break

        case 'UPDATE':
          const updatedSetlist = this.mapSetlistFromSupabase(payload.new)
          await this.local.updateSetlist(updatedSetlist.id, updatedSetlist)
          break

        case 'DELETE':
          await this.local.deleteSetlist(payload.old.id)
          break
      }

      this.notifyListeners()
    } catch (error) {
      console.error('Failed to handle setlist change:', error)
    }
  }

  /**
   * Handle practice session changes
   */
  private async handlePracticeChange(payload: any): Promise<void> {
    // Similar to handleSongChange
    // ... implementation
  }

  /**
   * Handle show changes
   */
  private async handleShowChange(payload: any): Promise<void> {
    // Similar to handleSongChange
    // ... implementation
  }

  /**
   * Map Supabase song format to app format
   */
  private mapSongFromSupabase(row: any): Song {
    return {
      id: row.id,
      title: row.title,
      artist: row.artist || '',
      contextType: row.context_type,
      contextId: row.context_id,
      key: row.key,
      tempo: row.tempo,  // Supabase uses 'tempo', app uses 'bpm'
      duration: row.duration,
      genre: row.genre,
      tags: row.tags || [],
      notes: row.notes || '',
      lyrics: row.lyrics || '',
      createdDate: new Date(row.created_date),
      lastModified: new Date(row.updated_date),
      createdBy: row.created_by
    }
  }

  /**
   * Map Supabase setlist format to app format
   */
  private mapSetlistFromSupabase(row: any): Setlist {
    return {
      id: row.id,
      name: row.name,
      description: row.description || '',
      bandId: row.band_id,
      items: row.items || [],  // JSONB field
      createdDate: new Date(row.created_date),
      lastModified: new Date(row.last_modified),
      createdBy: row.created_by,
      isArchived: row.is_archived || false
    }
  }

  /**
   * Subscribe to status changes
   */
  onDataChange(callback: () => void): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach(callback => callback())
  }

  /**
   * Unsubscribe from all channels
   */
  async unsubscribeAll(): Promise<void> {
    console.log('🔴 Unsubscribing from all realtime channels')

    for (const [name, channel] of this.channels) {
      await supabase.removeChannel(channel)
      console.log(`✅ Unsubscribed from ${name}`)
    }

    this.channels.clear()
  }
}
```

---

### Phase 2: Integrate with SyncRepository (2-3 hours)

#### 2.1: Update SyncRepository

**File**: `src/services/data/SyncRepository.ts`

```typescript
import { RealtimeManager } from './RealtimeManager'

export class SyncRepository implements IDataRepository {
  private local: LocalRepository
  private remote: RemoteRepository
  private syncEngine: SyncEngine
  private realtime: RealtimeManager  // NEW

  constructor() {
    this.local = new LocalRepository()
    this.remote = new RemoteRepository()
    this.syncEngine = new SyncEngine(this.local, this.remote)
    this.realtime = new RealtimeManager(this.local)  // NEW

    // Subscribe to realtime data changes
    this.realtime.onDataChange(() => {
      this.emitChangeEvent()  // Notify UI components
    })
  }

  /**
   * Start realtime subscriptions for user's bands
   */
  async startRealtimeSync(userId: string): Promise<void> {
    // Get user's bands
    const memberships = await this.local.getUserMemberships(userId)
    const bandIds = memberships.map(m => m.bandId)

    // Subscribe to all bands
    await this.realtime.subscribeToUserBands(userId, bandIds)
  }

  /**
   * Stop realtime subscriptions
   */
  async stopRealtimeSync(): Promise<void> {
    await this.realtime.unsubscribeAll()
  }
}
```

#### 2.2: Start Realtime on Login

**File**: `src/contexts/AuthContext.tsx`

```typescript
// After initial sync completes
if (needsSync) {
  await repository.performInitialSync(userId)
}

// NEW: Start realtime subscriptions
await repository.startRealtimeSync(userId)
console.log('✅ Realtime sync started')
```

---

### Phase 3: Update UI Components (2-3 hours)

#### 3.1: Make Hooks Reactive

**File**: `src/hooks/useSongs.ts`

```typescript
export function useSongs(filter?: SongFilter) {
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSongs = useCallback(async () => {
    setLoading(true)
    try {
      const result = await repository.getSongs(filter)
      setSongs(result)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    fetchSongs()

    // NEW: Listen for realtime changes
    const unsubscribe = repository.on('changed', () => {
      console.log('🔴 Data changed, refreshing songs...')
      fetchSongs()
    })

    return unsubscribe
  }, [fetchSongs])

  return { songs, loading, refresh: fetchSongs }
}
```

Repeat for:
- `useSetlists.ts`
- `usePractices.ts`
- `useShows.ts`

---

### Phase 4: Fallback Sync (1 hour)

Keep periodic sync as backup (in case WebSocket drops):

**File**: `src/services/data/SyncEngine.ts`

```typescript
private startPeriodicSync(): void {
  // Reduce to 5 minutes (realtime handles immediate updates)
  this.syncInterval = window.setInterval(() => {
    if (this.isOnline && !this.isSyncing && this.currentUserId) {
      console.log('🔄 Fallback sync (backup for realtime)')
      this.syncNow()
    }
  }, 300000)  // 5 minutes
}
```

---

### Phase 5: Handle Disconnections (1-2 hours)

#### 5.1: Detect WebSocket Status

```typescript
// In RealtimeManager
private async subscribeToBand(bandId: string): Promise<void> {
  const channel = supabase
    .channel(`songs-${bandId}`)
    .on(/* ... */)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ Realtime connected')
        this.notifyStatus('connected')
      }

      if (status === 'CHANNEL_ERROR') {
        console.error('❌ Realtime error, will reconnect...')
        this.notifyStatus('error')
      }

      if (status === 'CLOSED') {
        console.log('⚠️ Realtime disconnected')
        this.notifyStatus('disconnected')

        // Trigger immediate sync to catch missed changes
        this.syncEngine?.syncNow()
      }
    })
}
```

#### 5.2: Show Connection Status in UI

```typescript
// In App.tsx or Layout
const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'disconnected' | 'error'>('connected')

{realtimeStatus === 'disconnected' && (
  <div className="bg-yellow-500 text-white p-2 text-center">
    ⚠️ Realtime sync disconnected. Reconnecting...
  </div>
)}
```

---

## Testing Strategy

### Test 1: Basic Real-Time Updates

1. Open Device A (Chrome)
2. Open Device B (Firefox/Incognito)
3. Login as same user on both
4. Device A: Add song
5. **Device B should see song appear in < 1 second!**

### Test 2: Live Setlist Editing

1. Device A: Open setlist editor
2. Device B: Open same setlist (view mode)
3. Device A: Add/remove/reorder songs
4. **Device B should update in real-time**

### Test 3: Offline/Online Transition

1. Device A: Go offline (DevTools)
2. Device A: Edit setlist (queued)
3. Device A: Go back online
4. **Device B should receive updates immediately**

### Test 4: WebSocket Reconnection

1. Kill Supabase container: `docker stop supabase_db_rock-on`
2. **App should show "disconnected" status**
3. Start Supabase: `docker start supabase_db_rock-on`
4. **App should reconnect automatically**
5. **Fallback sync should catch any missed changes**

---

## Performance Considerations

### WebSocket Overhead

**Current polling**:
- API calls: 1 every 30 seconds = 120/hour
- Bandwidth: ~10KB per call = 1.2MB/hour

**Real-time WebSocket**:
- Connection: 1 persistent WebSocket
- Bandwidth: Only when changes occur
- **Result: Less bandwidth, more efficient!**

### Battery Impact

**Polling**: Wakes device every 30s
**WebSocket**: Receives push notifications only when needed
**Result: Better battery life**

---

## Migration Strategy

### Phase 1: Both Systems Running
- Keep polling at 5 minutes (fallback)
- Add realtime subscriptions
- Test in parallel

### Phase 2: Realtime Primary
- Realtime handles immediate updates
- Polling only for backup

### Phase 3: Remove Polling (Optional)
- If realtime proves reliable
- Remove periodic sync entirely
- Keep only connection recovery sync

---

## Configuration

Add feature flag for easy rollback:

```typescript
// .env.local
VITE_ENABLE_REALTIME=true  # Enable realtime sync
VITE_FALLBACK_SYNC_INTERVAL=300000  # 5 minutes
```

---

## Estimated Timeline

| Phase | Time | Dependencies |
|-------|------|-------------|
| 1. Realtime Infrastructure | 3-4 hours | None |
| 2. Integration | 2-3 hours | Phase 1 |
| 3. UI Updates | 2-3 hours | Phase 2 |
| 4. Fallback Sync | 1 hour | Phase 3 |
| 5. Disconnection Handling | 1-2 hours | Phase 4 |
| **Total** | **9-13 hours** | Sequential |

---

## Success Criteria

- ✅ Changes appear on other devices in < 1 second
- ✅ Works during live shows (reliable)
- ✅ Handles offline mode gracefully
- ✅ Reconnects automatically after disconnect
- ✅ Fallback sync catches any missed changes
- ✅ Battery efficient (no excessive polling)

---

## Alternative: Interim Solution

If 9-13 hours is too much right now:

### Quick Fix: 5-Second Polling

```typescript
// SyncEngine.ts:315
}, 5000)  // 5 seconds instead of 30
```

**Pros**:
- 5-minute fix
- 5-second delay tolerable for some use cases

**Cons**:
- Still not instant
- More API calls
- Battery drain

---

## References

- Supabase Realtime Docs: https://supabase.com/docs/guides/realtime
- WebSocket Best Practices: https://supabase.com/docs/guides/realtime/concepts
- Current Sync Spec: `.claude/specifications/2025-10-26T17:30_bidirectional-sync-specification.md`

---

**Status**: Specification Complete, Ready for Implementation
**Priority**: HIGH (Required for live show use case)
**Next Steps**: Decide on timeline and start Phase 1
