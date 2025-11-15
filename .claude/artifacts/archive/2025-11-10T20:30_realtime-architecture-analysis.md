---
title: Realtime Architecture Analysis & Proposed Fixes
created: 2025-11-10T20:30
status: Proposal
priority: CRITICAL
---

# Realtime Architecture Analysis & Proposed Fixes

## Critical Issues Identified

### Issue 1: New Bands Don't Get Realtime Subscriptions
**Current Flow:**
```
User creates band → Band saved to DB → Redirect to /songs
                                           ↓
                              useSongs mounts → NO realtimeManager!
                              (AuthContext hasn't subscribed yet)
```

**Problem:** AuthContext only subscribes to bands on initial load (when session is established). When a NEW band is created, there's no mechanism to notify AuthContext to subscribe.

**Impact:** Users who create a band won't see real-time updates from collaborators until they refresh the page.

---

### Issue 2: Cannot Load App as Same User in Multiple Browsers
**Symptom:** App fails to load when same user logs in from different browser/tab.

**Possible Causes:**
1. **Supabase Realtime Connection Limits:** Free tier may limit concurrent connections per user
2. **Session Conflicts:** Multiple sessions trying to establish same WebSocket connection
3. **RealtimeManager Singleton Issues:** Manager might not handle multiple instances gracefully
4. **Auth State Conflicts:** Local storage/session storage conflicts

**Impact:** Users cannot access the app from multiple devices (phone + desktop, etc.) - This is a CRITICAL blocker for real-world usage.

---

### Issue 3: No Retry/Reconnection Logic
**Current State:** If WebSocket connection fails, it stays failed.

**Missing Features:**
- Connection state tracking (connecting, connected, disconnected, error)
- Automatic reconnection with exponential backoff
- Connection health monitoring (heartbeat/ping)
- UI indicators for connection status
- Graceful degradation when offline

**Impact:** Brittle system that breaks easily and doesn't recover.

---

### Issue 4: Toast Notification Strategy Unclear
**Questions:**
- Should we show a toast for EVERY realtime update?
- How do we batch notifications?
- Do we show connection status changes?
- What about failed operations?

---

## Proposed Architecture Changes

### 1. Event-Driven Realtime Subscription Management

**Problem:** AuthContext and RealtimeManager are tightly coupled and don't react to band changes.

**Solution:** Implement an event bus for band lifecycle events.

```typescript
// New service: EventBus.ts
export class EventBus {
  private events: Map<string, Set<Function>> = new Map()

  emit(event: string, data: any): void {
    this.events.get(event)?.forEach(handler => handler(data))
  }

  on(event: string, handler: Function): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set())
    }
    this.events.get(event)!.add(handler)
    return () => this.events.get(event)?.delete(handler)
  }
}

// Export singleton
export const eventBus = new EventBus()
```

**Usage:**
```typescript
// In BandService.createBand():
const newBand = await repository.addBand(band)
eventBus.emit('band:created', { bandId: newBand.id, userId: currentUserId })

// In AuthContext:
useEffect(() => {
  const unsubscribe = eventBus.on('band:created', async ({ bandId, userId }) => {
    if (userId === user?.id && realtimeManagerRef.current) {
      console.log('🆕 New band created, subscribing to realtime updates...')
      const currentBandIds = [...bandIds] // from state
      const newBandIds = [...currentBandIds, bandId]
      await realtimeManagerRef.current.subscribeToUserBands(userId, newBandIds)
    }
  })
  return unsubscribe
}, [user?.id])
```

**Benefits:**
- Decoupled components
- Easy to add new listeners
- Testable
- Follows observer pattern

---

### 2. Connection State Management & Resilience

**Implement a robust connection manager:**

```typescript
// Enhanced RealtimeManager with connection state
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

export class RealtimeManager {
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000 // Start at 1 second
  private reconnectTimer: NodeJS.Timeout | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null

  async connect(userId: string, bandIds: string[]): Promise<void> {
    try {
      this.setConnectionState(ConnectionState.CONNECTING)

      // Attempt connection
      await this.subscribeToUserBands(userId, bandIds)

      this.setConnectionState(ConnectionState.CONNECTED)
      this.reconnectAttempts = 0
      this.reconnectDelay = 1000

      // Start heartbeat
      this.startHeartbeat()
    } catch (error) {
      console.error('Connection failed:', error)
      this.setConnectionState(ConnectionState.ERROR)
      this.scheduleReconnect(userId, bandIds)
    }
  }

  private scheduleReconnect(userId: string, bandIds: string[]): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      eventBus.emit('realtime:max-retries-exceeded', {})
      return
    }

    this.reconnectAttempts++
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000)

    console.log(`⏱️ Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

    this.reconnectTimer = setTimeout(() => {
      this.setConnectionState(ConnectionState.RECONNECTING)
      this.connect(userId, bandIds)
    }, delay)
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      // Check if connection is still alive
      // If not, trigger reconnection
      if (!this.isConnectionHealthy()) {
        console.warn('⚠️ Connection unhealthy, reconnecting...')
        this.scheduleReconnect(this.currentUserId, this.currentBandIds)
      }
    }, 30000) // Check every 30 seconds
  }

  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state
    eventBus.emit('realtime:state-changed', { state })
  }

  getConnectionState(): ConnectionState {
    return this.connectionState
  }
}
```

**AuthContext Integration:**
```typescript
// Listen for connection state changes
useEffect(() => {
  const unsubscribe = eventBus.on('realtime:state-changed', ({ state }) => {
    setRealtimeConnectionState(state)

    // Show toast only for critical state changes
    if (state === ConnectionState.CONNECTED && prevState === ConnectionState.RECONNECTING) {
      toast.success('Real-time sync restored')
    } else if (state === ConnectionState.ERROR) {
      toast.error('Real-time sync disconnected')
    }
  })
  return unsubscribe
}, [])

// Listen for max retries
useEffect(() => {
  const unsubscribe = eventBus.on('realtime:max-retries-exceeded', () => {
    toast.error('Cannot connect to real-time sync. Please check your connection and refresh.', {
      duration: 0, // Persist until dismissed
      action: {
        label: 'Retry',
        onClick: () => {
          // Manual retry
          realtimeManagerRef.current?.connect(user.id, bandIds)
        }
      }
    })
  })
  return unsubscribe
}, [user?.id, bandIds])
```

---

### 3. Multi-Browser/Multi-Device Support Investigation

**Need to investigate:**

1. **Supabase Connection Limits:**
   ```bash
   # Test with multiple browser windows
   # Monitor Supabase dashboard for connection count
   # Check if free tier limits concurrent connections per user
   ```

2. **Potential Solutions:**

   **Option A: Single Connection with Shared State (Not Recommended)**
   - Use BroadcastChannel API to share one connection across tabs
   - Complex, error-prone
   - Doesn't solve multi-device issue

   **Option B: Multiple Independent Connections (Recommended)**
   - Each device/tab gets its own connection
   - Requires understanding Supabase limits
   - May need to upgrade Supabase plan
   - Better UX (each device independent)

   **Option C: Connection Pooling**
   - Implement a connection pool
   - Share connections intelligently
   - Complex to implement

3. **Session Management:**
   - Ensure each session is truly independent
   - Use unique client IDs for each connection
   - Don't share WebSocket connections across tabs

**Recommended Investigation Steps:**
```typescript
// Add connection metadata for debugging
const connectionId = crypto.randomUUID()
console.log('[RealtimeManager] Connection ID:', connectionId)

// Track active connections
const activeConnections = new Map<string, RealtimeChannel>()

// On connect:
activeConnections.set(connectionId, channel)
console.log('[RealtimeManager] Active connections:', activeConnections.size)

// Monitor in Supabase dashboard:
// - Real-time connections count
// - Rate limits hit
// - Connection errors
```

---

### 4. UI Connection Status Indicator

**Add a subtle status indicator:**

```tsx
// ConnectionStatusIndicator.tsx
export function ConnectionStatusIndicator() {
  const { realtimeConnectionState } = useAuth()

  if (realtimeConnectionState === ConnectionState.CONNECTED) {
    return null // Don't show when everything is fine
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {realtimeConnectionState === ConnectionState.RECONNECTING && (
        <div className="bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <Spinner size="sm" />
          <span>Reconnecting...</span>
        </div>
      )}
      {realtimeConnectionState === ConnectionState.ERROR && (
        <div className="bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <AlertCircle size={16} />
          <span>Offline - Changes won't sync</span>
        </div>
      )}
      {realtimeConnectionState === ConnectionState.CONNECTING && (
        <div className="bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <Spinner size="sm" />
          <span>Connecting...</span>
        </div>
      )}
    </div>
  )
}
```

---

### 5. Toast Notification Strategy

**Principles:**
1. **Don't toast EVERY realtime update** - Too noisy
2. **DO toast:**
   - Connection status changes (connected → disconnected)
   - Critical errors (max retries exceeded)
   - User-triggered actions (band created, song deleted)
   - Conflicting changes (someone edited the same record)

3. **DON'T toast:**
   - Normal syncs (songs fetched from server)
   - Background updates (someone added a song)
   - Connection health checks

**Implementation:**
```typescript
// In RealtimeManager event handlers:
private handleSongChange(payload: RealtimePayload) {
  // Emit event for hooks to refetch data
  this.emit('songs:changed', {
    bandId: payload.new.band_id,
    action: payload.eventType,
    recordId: payload.new.id
  })

  // DON'T show toast here - let the UI handle it if needed
  // The hook will refetch and update silently
}

// In UI components (only when needed):
const handleCreateSong = async (song: Song) => {
  try {
    await createSong(song)
    toast.success('Song created successfully')
  } catch (error) {
    toast.error('Failed to create song')
  }
}

// For conflicts (optional - advanced feature):
const handleSongConflict = (conflict: Conflict) => {
  toast.warning('Someone else modified this song. Refresh to see changes.', {
    action: {
      label: 'Refresh',
      onClick: () => refetch()
    }
  })
}
```

---

## Implementation Priority

### Phase 1: Critical Fixes (MUST DO)
1. **Fix new band subscription issue** (Event bus + band:created event)
2. **Investigate multi-browser issue** (Add logging, test limits)
3. **Add connection state tracking** (Basic state enum + logging)

### Phase 2: Resilience (SHOULD DO)
4. **Implement reconnection logic** (Exponential backoff)
5. **Add UI connection indicator** (Visual feedback)
6. **Add heartbeat monitoring** (Detect dead connections)

### Phase 3: Polish (NICE TO HAVE)
7. **Optimize toast notifications** (Reduce noise)
8. **Add manual retry button** (User control)
9. **Add connection diagnostics page** (Debug tool)

---

## Testing Strategy

### Manual Testing Checklist

**Test 1: New Band Creation**
- [ ] User A creates a new band
- [ ] User A invites User B
- [ ] User B joins the band
- [ ] User B adds a song
- [ ] Verify User A sees the new song in real-time (without refresh)

**Test 2: Multi-Browser**
- [ ] User A logs in on Chrome
- [ ] User A logs in on Firefox (same machine)
- [ ] Verify both browsers work
- [ ] User A adds a song in Chrome
- [ ] Verify Firefox sees the update
- [ ] Check Supabase dashboard for connection count

**Test 3: Connection Resilience**
- [ ] User A is logged in
- [ ] Disable network (airplane mode or DevTools offline)
- [ ] Wait 10 seconds
- [ ] Re-enable network
- [ ] Verify connection reconnects automatically
- [ ] User B adds a song
- [ ] Verify User A sees it

**Test 4: Toast Notification UX**
- [ ] User A creates a song → Toast appears ✓
- [ ] User B creates a song → User A sees new song, NO toast ✓
- [ ] Connection drops → Toast appears ✓
- [ ] Connection restores → Toast appears ✓

---

## Open Questions

1. **Supabase Limits:** What are the actual connection limits on our current plan?
2. **Performance:** How many concurrent users can we support?
3. **Offline Mode:** Should we support full offline mode with queue-based sync?
4. **Conflict Resolution:** How do we handle two users editing the same song simultaneously?
5. **Mobile:** Does this work on mobile browsers (iOS Safari, Chrome Mobile)?

---

## Next Steps

1. **Investigation Phase:**
   - Test multi-browser scenario thoroughly
   - Check Supabase dashboard for connection metrics
   - Add detailed logging to RealtimeManager
   - Document connection limits

2. **Implementation Phase:**
   - Start with Phase 1 (Event bus for band creation)
   - Add connection state tracking
   - Test each fix in isolation

3. **Validation Phase:**
   - Run full test suite
   - Manual testing with 2-3 concurrent users
   - Performance testing with realistic load

---

## Success Criteria

✅ New bands immediately get realtime subscriptions
✅ Same user can use app in multiple browsers/devices simultaneously
✅ Connection automatically recovers from network issues
✅ Users have clear visibility into connection status
✅ Toast notifications are helpful, not annoying
✅ App gracefully degrades when offline

---

**This is a critical feature. Let's get it right.**
