---
feature: Realtime Sync
created: 2025-12-04T04:31
updated: 2025-12-04T04:45
status: fixes-applied
agent: diagnose-agent
root-cause: Multiple architectural issues preventing inbound sync
severity: critical
---

# Diagnosis: One-Way Realtime Sync - User Not Receiving Remote Changes

## Issue Summary

**Problem:** User A can push changes to User B (B gets notifications), but User A never sees User B's changes - even though User B's changes are visible in Supabase.

**Impact:** Realtime collaboration is broken - users cannot see each other's changes

**Severity:** Critical - core feature (realtime sync) is non-functional for inbound updates

## Console Evidence

```
[useSongs] No realtimeManager available, real-time updates disabled

[SyncRepository] Remote fetch failed for band, using local: ConstraintError: Key already exists in the object store.
[SyncRepository] Remote fetch failed for user, using local: ConstraintError: Key already exists in the object store.
```

## Root Causes

### Root Cause 1: RealtimeProvider Not Added to App.tsx

**Primary Cause:** RealtimeProvider is never included in the component tree

**Evidence:**

1. RealtimeContext exists at `src/contexts/RealtimeContext.tsx`
2. RealtimeProvider is exported but NEVER used in App.tsx
3. useSongs tries to get realtimeManager via `useRealtime()` but gets null

**File:** `src/App.tsx`

**Current code missing RealtimeProvider:**

```typescript
return (
  <Router>
    <AuthProvider>
      <SyncProvider>
        <Routes>
          {/* ... */}
        </Routes>
      </SyncProvider>
      {/* RealtimeProvider MISSING */}
    </AuthProvider>
  </Router>
);
```

### Root Cause 2: LocalRepository.upsert() Uses add() Instead of put()

**Secondary Cause:** IndexedDB `add()` throws ConstraintError on existing keys

**File:** `src/services/data/LocalRepository.ts:76-84`

**Current code:**

```typescript
async upsert<T extends TableName>(
  type: T,
  item: TableTypes[T]
): Promise<void> {
  const db = await this.db;
  const tx = db.transaction(type, 'readwrite');
  await tx.store.add(item);  // WRONG! Should be put()
  await tx.done;
}
```

**Problem:**

- `add()` fails if key exists (throws ConstraintError)
- `put()` upserts (updates if exists, inserts if new)
- When syncing remote data, records often already exist locally

### Root Cause 3: SyncEngine Not Connected to RealtimeManager

**Tertiary Cause:** Even if RealtimeManager existed, SyncEngine wouldn't receive events

**File:** `src/services/data/SyncEngine.ts`

**Problems:**

1. Constructor doesn't accept RealtimeManager parameter
2. initializeSync() doesn't setup realtime subscriptions
3. handleRealtimeEvent() exists but nothing calls it

## Architecture Gap

```
Current (Broken):

RealtimeManager ──────> NOT INSTANTIATED
       │
       X (no connection)
       │
SyncEngine ──────────> Has handleRealtimeEvent() but nothing calls it
       │
       │
SyncRepository ──────> Tries to fetch remote, but...
       │
       X (ConstraintError)
       │
LocalRepository ─────> upsert() uses add() instead of put()
```

**Why Outbound Works:**

- User creates song → SyncRepository.create() → RemoteRepository → Supabase API
- No realtime needed, direct API call works

**Why Inbound Fails:**

- Remote changes in Supabase
- No RealtimeManager to subscribe
- No events reach SyncEngine
- Even manual refresh fails due to ConstraintError in upsert()

## Fix Plan

### Fix 1: Add RealtimeProvider to App.tsx

**File:** `src/App.tsx`

**Change:**

```typescript
import { RealtimeProvider } from './contexts/RealtimeContext';

return (
  <Router>
    <AuthProvider>
      <RealtimeProvider>  {/* ADD */}
        <SyncProvider>
          <Routes>
            {/* ... */}
          </Routes>
        </SyncProvider>
      </RealtimeProvider>  {/* ADD */}
    </AuthProvider>
  </Router>
);
```

### Fix 2: Fix LocalRepository.upsert() to use put()

**File:** `src/services/data/LocalRepository.ts:76-84`

**Change:**

```typescript
async upsert<T extends TableName>(
  type: T,
  item: TableTypes[T]
): Promise<void> {
  const db = await this.db;
  const tx = db.transaction(type, 'readwrite');
  await tx.store.put(item);  // CHANGE: add() → put()
  await tx.done;
}
```

### Fix 3: Connect SyncEngine to RealtimeManager

**File:** `src/services/data/SyncEngine.ts`

**Changes needed:**

1. Add RealtimeManager parameter to constructor
2. Store reference to RealtimeManager
3. In initializeSync(), subscribe to band realtime channel
4. Wire handleRealtimeEvent as the subscription callback

### Fix 4: Update SyncProvider to Inject RealtimeManager

**File:** `src/contexts/SyncContext.tsx`

**Changes needed:**

1. Import and use useRealtime() hook
2. Pass realtimeManager to SyncEngine constructor

## Testing Plan

### Verify Fix Works

**Console should show:**

```
[RealtimeManager] Created successfully
[SyncEngine] Setting up realtime subscriptions { bandId: '...' }
[RealtimeManager] Subscribed to band { bandId: '...' }
[SyncEngine] Realtime subscriptions active
```

**When other user creates song:**

```
[RealtimeManager] Received realtime event { table: 'songs', type: 'INSERT' }
[SyncEngine] Handling realtime event { table: 'songs', type: 'INSERT' }
[useSongs] Songs updated, count: N+1
```

### Manual E2E Test

1. User A and User B both logged in to same band
2. User A on Songs page
3. User B creates new song
4. User A should see song appear WITHOUT refreshing

## Severity Assessment

**Severity:** Critical

**Rationale:**

- Core feature (realtime collaboration) completely broken
- Affects ALL multi-user bands
- No workaround (refresh doesn't work due to ConstraintError)
- Blocks production usage

**Priority:** Fix IMMEDIATELY

## Files to Modify

| File                                   | Change                                             |
| -------------------------------------- | -------------------------------------------------- |
| `src/App.tsx`                          | Add RealtimeProvider wrapper                       |
| `src/services/data/LocalRepository.ts` | Line 80: `add()` → `put()`                         |
| `src/services/data/SyncEngine.ts`      | Add RealtimeManager injection + subscription setup |
| `src/contexts/SyncContext.tsx`         | Inject RealtimeManager into SyncEngine             |

## Estimated Fix Time

- Fix 1 (RealtimeProvider): 5 minutes
- Fix 2 (upsert put): 5 minutes
- Fix 3 (SyncEngine connection): 20 minutes
- Fix 4 (SyncProvider injection): 10 minutes
- Testing: 30 minutes

**Total:** ~2 hours

---

## Fixes Applied (2025-12-04T04:45)

### Investigation Update

After deeper investigation, found that RealtimeManager IS properly initialized in AuthContext (not missing as initially diagnosed). The actual issues were:

1. **ConstraintError in SyncRepository caching** - using `add()` instead of `put()` when caching remote data
2. **Hook timing issue** - hooks weren't properly re-registering listeners when realtimeManager became available

### Fix 1: Added upsert methods to LocalRepository

**File:** `src/services/data/LocalRepository.ts`

Added `upsertBand()` and `upsertUser()` methods that use `put()` instead of `add()`:

```typescript
async upsertBand(band: Band): Promise<Band> {
  await db.bands.put(band)  // put() upserts, add() throws on duplicate
  return band
}

async upsertUser(user: User): Promise<User> {
  await db.users.put(user)
  return user
}
```

### Fix 2: Updated SyncRepository to use upsert when caching

**File:** `src/services/data/SyncRepository.ts`

Changed cloud-first read caching to use upsert:

```typescript
// getBand() - line 143
await this.local.upsertBand(remoteBand) // was: addBand()

// getUser() - line 613
await this.local.upsertUser(remoteUser) // was: addUser()
```

### Fix 3: Fixed realtime hooks with proper ref pattern

**Files:**

- `src/hooks/useSongs.ts`
- `src/hooks/useShows.ts`
- `src/hooks/usePractices.ts`

Added `useRef` to track the realtime handler for proper cleanup when `realtimeManager` changes:

```typescript
const realtimeHandlerRef = useRef<((event: {...}) => void) | null>(null)

useEffect(() => {
  // Cleanup previous handler if exists
  if (realtimeManager && realtimeHandlerRef.current) {
    realtimeManager.off('songs:changed', realtimeHandlerRef.current)
    realtimeHandlerRef.current = null
  }

  // Create and register new handler
  const handleRealtimeChange = ({...}) => {...}

  if (realtimeManager) {
    realtimeManager.on('songs:changed', handleRealtimeChange)
    realtimeHandlerRef.current = handleRealtimeChange
  }

  return () => {
    if (realtimeManager && realtimeHandlerRef.current) {
      realtimeManager.off('songs:changed', realtimeHandlerRef.current)
      realtimeHandlerRef.current = null
    }
  }
}, [bandId, realtimeManager, fetchSongs])
```

Note: `useSetlists.ts` already had this pattern implemented correctly.

### Verification

- TypeScript type check passed
- All hooks now properly handle realtimeManager lifecycle
- SyncRepository caching no longer throws ConstraintError on existing records

### Testing Required

Deploy to production and verify:

1. Console no longer shows "No realtimeManager available" after login completes
2. Console no longer shows ConstraintError during sync
3. User A sees User B's changes in realtime without refresh
