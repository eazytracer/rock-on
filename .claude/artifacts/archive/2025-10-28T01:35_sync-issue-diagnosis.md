---
title: Sync Issue Diagnosis - Data Inconsistency Between Devices
created: 2025-10-28T00:00
status: ROOT CAUSE IDENTIFIED
severity: HIGH
prompt: "User experiencing different data on different devices when logging in, leading to belief that caching or sync is not working properly"
---

# Sync Issue Diagnosis

## Problem Statement

When logging in on different devices in dev mode:
- **Local dev machine**: Shows old mock data with only a few songs
- **Other device**: Shows robust setlist with full mock data
- **Expected**: Both devices should show the same data after login

## Root Cause Identified

### 🚨 **The initial sync from Supabase NEVER runs!**

Your app has a fully implemented sync engine (`SyncEngine.ts`) with methods for:
- `performInitialSync(userId)` - Downloads all data from Supabase to IndexedDB
- `isInitialSyncNeeded()` - Checks if initial sync should run
- `pullFromRemote(userId)` - Incremental sync from Supabase

**BUT: These methods are never called anywhere in the application!**

## Architecture Analysis

### Current Configuration (from .env.local)

```bash
VITE_MOCK_AUTH=false
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
```

This means you're running in **production mode** with a local Supabase instance.

### Mode Detection Logic (src/config/appMode.ts:22-44)

```typescript
export function getAppMode(): AppMode {
  const mockAuth = import.meta.env.VITE_MOCK_AUTH === 'true'

  if (mockAuth) {
    return 'local'  // ← Uses IndexedDB only, no sync
  }

  // Your config: VITE_MOCK_AUTH=false, so...
  return 'production'  // ← You are HERE!
}
```

**Result**: Your app is in **production mode**, which means:
- ✅ Supabase auth enabled
- ✅ Sync engine should be syncing with Supabase
- ❌ Seeding disabled (only runs in dev mode)
- ❌ Initial sync NEVER triggered!

## Data Flow Analysis

### What Happens When You Login

**File: `src/contexts/AuthContext.tsx` (lines 82-96)**

```typescript
const unsubscribe = authService.onAuthStateChange(async (newSession) => {
  setSession(newSession)
  setUser(newSession?.user || null)

  if (newSession?.user?.id) {
    const storedBandId = localStorage.getItem('currentBandId')
    await loadUserData(newSession.user.id, storedBandId)  // ← Only loads from IndexedDB!
    localStorage.setItem('currentUserId', newSession.user.id)
  }
})
```

**File: `src/contexts/AuthContext.tsx` (lines 103-161)**

```typescript
const loadUserData = async (userId: string, bandId: string | null) => {
  // Load user from database (IndexedDB!)
  const dbUser = await db.users.get(userId)

  // Load user profile (IndexedDB!)
  const profile = await db.userProfiles.where('userId').equals(userId).first()

  // Load bands from IndexedDB
  let memberships = await db.bandMemberships
    .where('userId')
    .equals(userId)
    .toArray()

  // ❌ NO CALL TO: await repository.performInitialSync(userId)
  // ❌ NO CALL TO: await repository.pullFromRemote(userId)
}
```

**Result**: Only reads from local IndexedDB, never syncs from Supabase!

### What Happens on App Startup

**File: `src/main.tsx` (lines 76-101)**

```typescript
const shouldSeed = import.meta.env.DEV || import.meta.env.MODE === 'development' || !import.meta.env.PROD

if (shouldSeed) {
  // ✅ Runs in dev mode
  await seedMvpData()
} else {
  // ❌ You are here (production mode)
  console.log('📦 Production mode - skipping database seeding')
  // ❌ NO CALL TO: await repository.performInitialSync(userId)
}
```

**Result**: In production mode, no seeding AND no initial sync!

### Seed Data Guard

**File: `src/database/seedMvpData.ts` (lines 19-30)**

```typescript
const existingUsers = await db.users.count()

if (existingUsers > 0) {
  console.log('✅ Database already seeded, skipping...')
  return  // ← Skips if ANY users exist!
}
```

**Result**: Once you have data in IndexedDB (even old data), seeding never runs again.

## Why Different Devices Show Different Data

### Scenario 1: Local Dev Machine

1. Has old IndexedDB data from previous development
2. `existingUsers > 0`, so seeding skipped
3. No initial sync runs
4. Shows OLD data from IndexedDB

### Scenario 2: Other Device

**If it's showing mock data**, one of these is true:

1. **Fresh IndexedDB**: No users exist, so seeding runs
2. **Dev mode enabled**: Different `.env` file with `VITE_MOCK_AUTH=true`
3. **Recently cleared cache**: Browser cache/IndexedDB was cleared

### Scenario 3: What SHOULD Happen

1. User logs in
2. App checks: `await repository.isInitialSyncNeeded()`
3. If needed: `await repository.performInitialSync(userId)`
4. All data synced from Supabase → IndexedDB
5. All devices show SAME data (from Supabase)

## Key Findings

### ✅ What's Working

1. **SyncEngine is fully implemented** with initial sync logic (src/services/data/SyncEngine.ts:368-458)
2. **Repository exposes sync methods** (src/services/data/SyncRepository.ts:410-428)
3. **Schema mapping is correct** (IndexedDB ↔ Supabase)
4. **Local Supabase is running** (based on your .env.local)

### ❌ What's Broken

1. **Initial sync never called** - Not in AuthContext, not in main.tsx, nowhere!
2. **No incremental sync** - `pullFromRemote()` never called
3. **Seeding only in dev mode** - Production mode has no data source
4. **No data refresh mechanism** - Once IndexedDB has data, it never updates

### 🔍 Additional Issues Found

1. **Periodic sync runs but does nothing** (SyncEngine.ts:310-316):
   ```typescript
   this.syncInterval = window.setInterval(() => {
     if (this.isOnline && !this.isSyncing) {
       this.syncNow()  // ← Only pushes LOCAL changes, doesn't pull!
     }
   }, 30000)
   ```

2. **User ID never set** on SyncEngine:
   ```typescript
   // SyncEngine.ts:24-26
   setCurrentUser(userId: string): void {
     this.currentUserId = userId
   }
   // ❌ This is NEVER called from anywhere!
   ```

## Solutions

### Immediate Fix: Add Initial Sync to AuthContext

**File: `src/contexts/AuthContext.tsx`**

**Option A: Add to `loadUserData()` function**

```typescript
const loadUserData = async (userId: string, bandId: string | null) => {
  try {
    // NEW: Check if we need to sync from Supabase
    const { repository } = await import('../services/data/RepositoryFactory')
    const needsSync = await repository.isInitialSyncNeeded()

    if (needsSync) {
      console.log('🔄 Initial sync needed, pulling from Supabase...')
      await repository.performInitialSync(userId)
      console.log('✅ Initial sync complete')
    }

    // Existing code...
    const dbUser = await db.users.get(userId)
    // ... rest of function
  }
}
```

**Option B: Add to `onAuthStateChange` handler**

```typescript
const unsubscribe = authService.onAuthStateChange(async (newSession) => {
  setSession(newSession)
  setUser(newSession?.user || null)

  if (newSession?.user?.id) {
    // NEW: Perform initial sync if needed
    const { repository } = await import('../services/data/RepositoryFactory')
    const needsSync = await repository.isInitialSyncNeeded()

    if (needsSync) {
      console.log('🔄 Performing initial sync...')
      await repository.performInitialSync(newSession.user.id)
    }

    const storedBandId = localStorage.getItem('currentBandId')
    await loadUserData(newSession.user.id, storedBandId)
    localStorage.setItem('currentUserId', newSession.user.id)
  }
})
```

### Additional Fixes Needed

#### 1. Set User ID on SyncEngine

**File: `src/contexts/AuthContext.tsx`**

```typescript
if (newSession?.user?.id) {
  // NEW: Set user ID on sync engine
  const { repository } = await import('../services/data/RepositoryFactory')
  if ('syncEngine' in repository) {
    (repository as any).syncEngine.setCurrentUser(newSession.user.id)
  }

  // ... existing code
}
```

#### 2. Add Periodic Pull Sync

**File: `src/services/data/SyncEngine.ts`**

Update the periodic sync to BOTH push and pull:

```typescript
private startPeriodicSync(): void {
  this.syncInterval = window.setInterval(() => {
    if (this.isOnline && !this.isSyncing && this.currentUserId) {
      this.syncNow()  // This should pull AND push
    }
  }, 30000)
}
```

Update `syncNow()` to pull first:

```typescript
async syncNow(): Promise<void> {
  if (this.isSyncing || !this.isOnline) {
    return
  }

  this.isSyncing = true
  this.notifyListeners()

  try {
    // 1. Pull latest from remote (cloud → local) - FIRST!
    if (this.currentUserId) {
      await this.pullFromRemote(this.currentUserId)
    }

    // 2. Push queued changes (local → cloud)
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
```

#### 3. Add Manual Refresh UI

Add a button in the UI to manually trigger sync:

```typescript
import { repository } from '../services/data/RepositoryFactory'
import { useAuth } from '../contexts/AuthContext'

function SyncButton() {
  const { currentUser } = useAuth()
  const [syncing, setSyncing] = useState(false)

  const handleSync = async () => {
    if (!currentUser) return

    setSyncing(true)
    try {
      await repository.pullFromRemote(currentUser.id)
      alert('Sync complete!')
    } catch (error) {
      console.error('Sync failed:', error)
      alert('Sync failed: ' + error.message)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <button onClick={handleSync} disabled={syncing}>
      {syncing ? 'Syncing...' : 'Refresh Data'}
    </button>
  )
}
```

#### 4. Add Data Version Tracking

**File: `src/database/seedMvpData.ts`**

Add version checking:

```typescript
const SEED_VERSION = '2025-10-28'  // Update when you change seed data

export async function seedMvpData() {
  // Check version instead of just existence
  const versionMeta = await db.syncMetadata?.get('seed_version')
  const currentVersion = versionMeta?.value

  if (currentVersion === SEED_VERSION) {
    console.log('✅ Seed data is up to date')
    return
  }

  console.log(`🔄 Seed data outdated (${currentVersion} → ${SEED_VERSION}), reseeding...`)

  // Clear existing data
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map(table => table.clear()))
  })

  // ... rest of seeding logic

  // Store new version
  await db.syncMetadata?.put({
    id: 'seed_version',
    value: SEED_VERSION,
    updatedAt: new Date()
  })
}
```

## Recommended Implementation Order

### Phase 1: Quick Fix (30 minutes)
1. Add initial sync to AuthContext (Option A or B above)
2. Test on local dev machine
3. Test on other device
4. Verify both show same data

### Phase 2: Full Fix (2 hours)
1. Set user ID on SyncEngine
2. Update periodic sync to pull AND push
3. Add manual sync button to UI
4. Test full sync flow

### Phase 3: Robust Solution (1 hour)
1. Add data version tracking to seed
2. Add force-refresh option in dev mode
3. Add sync status indicator to UI
4. Add error handling and retry logic

## Testing Checklist

### Before Fix
- [ ] Note which songs/setlists appear on local dev machine
- [ ] Note which songs/setlists appear on other device
- [ ] Check IndexedDB contents (DevTools → Application → IndexedDB)
- [ ] Check Supabase data (Supabase Studio → Table Editor)

### After Fix
- [ ] Clear IndexedDB on local dev machine
- [ ] Login and verify initial sync runs
- [ ] Check that all data from Supabase appears
- [ ] Add a song on device 1
- [ ] Check that song appears in Supabase
- [ ] Login on device 2 and verify song appears
- [ ] Verify both devices show identical data

## Diagnostic Commands

### Check IndexedDB Data
```javascript
// Open DevTools Console
const db = await import('./services/database').then(m => m.db)

// Count records
console.log('Users:', await db.users.count())
console.log('Songs:', await db.songs.count())
console.log('Setlists:', await db.setlists.count())
console.log('Shows:', await db.shows.count())

// Check sync metadata
console.log('Sync metadata:', await db.syncMetadata?.toArray())
```

### Check Supabase Data
```sql
-- In Supabase SQL Editor
SELECT 'users' as table_name, count(*) FROM users
UNION ALL
SELECT 'songs', count(*) FROM songs
UNION ALL
SELECT 'setlists', count(*) FROM setlists
UNION ALL
SELECT 'shows', count(*) FROM shows;
```

### Force Initial Sync
```javascript
// In DevTools Console
const { repository } = await import('./services/data/RepositoryFactory')
const userId = localStorage.getItem('currentUserId')
await repository.performInitialSync(userId)
console.log('Sync complete!')
```

## Summary

**Root Cause**: Initial sync from Supabase is fully implemented but never called, causing each device to rely solely on its local IndexedDB data.

**Impact**:
- High - Data inconsistency between devices
- High - Users can't see data from other sessions
- Medium - Confusing UX ("where did my data go?")

**Effort to Fix**:
- Quick fix: 30 minutes
- Full fix: 3 hours
- Testing: 1 hour

**Next Steps**: Implement Phase 1 quick fix in AuthContext.tsx to add initial sync on login.

---

**Status**: Ready for implementation
**Priority**: HIGH
**Estimated Fix Time**: 30 minutes - 3 hours depending on scope
