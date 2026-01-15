---
timestamp: 2026-01-14
feature: Improved Auth Flow + Enhanced Sync
type: implementation-plan
status: ready-for-implementation
estimated-hours: 22-32
phases: 6
---

# Improved Auth Flow + Enhanced Sync - Implementation Plan

## Executive Summary

This plan implements six interconnected features that improve authentication reliability and data synchronization in the Rock-On application:

1. **Auth Flow Fix** - Eliminate race condition where protected pages briefly show "Not logged in"
2. **Sync-on-Load** - Pull fresh data from Supabase on every app load (multi-device support)
3. **Conflict Resolution** - "Pending Changes Protected" strategy prevents data loss when offline edits collide with remote changes
4. **Activity Tracking** - Server-side tracking of user's last active time
5. **New Item Indicators** - Visual highlighting of items changed since last session
6. **Session Summary** - Toast notification showing what changed while away
7. **Release Notes** - In-app notification system for app updates (deferred to future)

**Total Estimated Time:** 24-34 hours
**MVP Scope:** Phases 1-4 (18-27 hours)
**Future Scope:** Phases 5-6 (6-8 hours)

## Architecture Overview

```
                    +---------------------------------------------+
                    |           User Opens App                     |
                    +----------------------+----------------------+
                                           |
                    +----------------------v----------------------+
                    |         useAuthCheck Hook                    |
                    |  - Check localStorage keys                   |
                    |  - Validate session (SessionManager)         |
                    |  - Apply grace period (1.5 hours)            |
                    +----------------------+----------------------+
                                           |
              +----------------------------+----------------------------+
              |                                                         |
    +---------v---------+                                   +-----------v-----------+
    |  Invalid Session   |                                   |   Valid Session       |
    |  -> Redirect /auth |                                   |   -> Continue Load    |
    +--------------------+                                   +-----------+-----------+
                                                                         |
                                      +----------------------------------v----------------------------------+
                                      |         AuthContext.loadInitialSession()                           |
                                      |  1. Load session from Supabase                                     |
                                      |  2. Call pullIncrementalChanges() [NEW]                            |
                                      |  3. Load from IndexedDB (now fresh!)                               |
                                      |  4. Compute session summary [NEW]                                  |
                                      |  5. Start realtime subscriptions                                   |
                                      +----------------------------------+----------------------------------+
                                                                         |
                                      +----------------------------------v----------------------------------+
                                      |         Show Session Summary Toast [NEW]                           |
                                      |  "Welcome back! 3 new songs, 1 practice..."                        |
                                      +----------------------------------+----------------------------------+
                                                                         |
                                      +----------------------------------v----------------------------------+
                                      |         Render Protected Page                                      |
                                      |  - Items marked with "new" badge [NEW]                             |
                                      |  - Correct auth state displayed                                    |
                                      +--------------------------------------------------------------------+
```

## Validated Research Findings

After examining the actual codebase, I confirmed the following:

1. **Auth Race Condition (CONFIRMED)**
   - `ProtectedRoute.tsx` (line 23-28) only checks localStorage keys (`currentUserId`, `currentBandId`)
   - `AuthContext.tsx` (line 176-277) loads session asynchronously via `loadInitialSession()`
   - No coordination between the two - race condition exists

2. **Sync-on-Load Gap (CONFIRMED)**
   - `SyncEngine.ts` (line 22-35) has periodic sync disabled (comment explicitly states why)
   - `isInitialSyncNeeded()` (line 643-662) only triggers full sync every 30 days or when data is empty
   - No incremental pull on every app load - confirmed gap

3. **Session Management (CONFIRMED)**
   - `SessionManager.ts` provides `isSessionValid()`, `loadSession()`, etc.
   - `AuthContext` uses `sessionExpired` state and has session check interval (line 99-138)
   - `SessionExpiredModal.tsx` shows modal over content instead of redirecting

4. **Real-time Infrastructure (EXISTS)**
   - `RealtimeManager.ts` already emits events like `songs:changed`
   - `useSongs.ts` already subscribes to these events
   - `ToastContext.tsx` provides toast notifications

5. **Existing Patterns**
   - Hooks pattern established (`useSongs`, `useSyncStatus`, etc.)
   - Repository pattern with `SyncRepository` facade
   - Event emitter pattern in `RealtimeManager`

---

## Phase 1: Auth Flow Fix (4-6 hours)

### Objective

Fix the race condition where ProtectedRoute allows access based on stale localStorage keys before AuthContext has validated the session.

### Files to Create

**`/workspaces/rock-on/src/hooks/useAuthCheck.ts`**

```typescript
// Returns: { isAuthenticated: boolean | null, isChecking: boolean }
// Logic:
// 1. Check localStorage keys (currentUserId, currentBandId)
// 2. Load session from SessionManager.loadSession()
// 3. Validate with SessionManager.isSessionValid()
// 4. Apply 1.5-hour grace period for expired sessions
// 5. Clear localStorage if invalid (cleanup stale keys)
```

### Files to Modify

**`/workspaces/rock-on/src/components/ProtectedRoute.tsx`**

- Replace direct localStorage check with `useAuthCheck()` hook
- Add loading state component while checking
- Show loading spinner (not `null`)
- Redirect to `/auth?reason=session-expired` on invalid session

**`/workspaces/rock-on/src/contexts/AuthContext.tsx`**

- In `checkSession()` function (line 111-124): Clear localStorage keys on expiry
- Redirect to `/auth` instead of relying on `sessionExpired` state
- Clear interval when session expires

**`/workspaces/rock-on/src/components/auth/SessionExpiredModal.tsx`**

- Simplify: Only show on `/auth` page edge cases
- For other pages: redirect handled by ProtectedRoute

### Test Files to Create

**`/workspaces/rock-on/tests/unit/hooks/useAuthCheck.test.ts`**

- Test: returns unauthorized when no localStorage keys
- Test: returns unauthorized when session is null
- Test: returns authorized when session is valid
- Test: returns unauthorized when session expired > grace period
- Test: returns authorized when session expired within grace period
- Test: clears localStorage on invalid session

**`/workspaces/rock-on/tests/e2e/auth/session-expiry.spec.ts`**

- Test: redirects to /auth when session expires on protected page
- Test: shows toast notification on session expiry
- Test: does not show SessionExpiredModal on protected pages

**`/workspaces/rock-on/tests/e2e/auth/protected-routes.spec.ts`**

- Test: redirects to /auth when accessing /songs without session
- Test: redirects to /auth when accessing /songs with expired session
- Test: shows loading state before checking auth
- Test: redirects to /auth?view=get-started when user has no band

### Implementation Details

```typescript
// useAuthCheck.ts - Key logic
import { useState, useEffect } from 'react'
import { SessionManager } from '../services/auth/SessionManager'

const GRACE_PERIOD_HOURS = 1.5

function clearLocalStorage() {
  localStorage.removeItem('currentUserId')
  localStorage.removeItem('currentBandId')
}

export function useAuthCheck(): {
  isAuthenticated: boolean | null
  isChecking: boolean
} {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      // 1. Quick localStorage check
      const userId = localStorage.getItem('currentUserId')
      const bandId = localStorage.getItem('currentBandId')

      if (!userId || !bandId) {
        setIsAuthenticated(false)
        setIsChecking(false)
        return
      }

      // 2. Load and validate session
      const session = SessionManager.loadSession()
      if (!session) {
        clearLocalStorage()
        setIsAuthenticated(false)
        setIsChecking(false)
        return
      }

      // 3. Check validity with grace period
      if (!SessionManager.isSessionValid(session)) {
        const expiresAt = session.expiresAt || 0
        const hoursExpired = (Date.now() - expiresAt) / (1000 * 60 * 60)

        if (hoursExpired > GRACE_PERIOD_HOURS) {
          console.warn(
            `Session expired ${hoursExpired.toFixed(1)} hours ago - re-auth required`
          )
          clearLocalStorage()
          setIsAuthenticated(false)
          setIsChecking(false)
          return
        }
        console.log(
          `Session expired ${Math.round(hoursExpired * 60)} minutes ago - within grace period`
        )
      }

      setIsAuthenticated(true)
      setIsChecking(false)
    }

    checkAuth()
  }, [])

  return { isAuthenticated, isChecking }
}
```

### Success Criteria

- No "Not logged in" displayed on protected pages with valid session
- Redirect to /auth within 100ms on invalid/expired session
- Loading spinner shown during auth check (not blank page)
- All E2E tests pass

---

## Phase 2: Sync-on-Load + Conflict Resolution (7-9 hours)

### Objective

Guarantee fresh data from Supabase on every app load, enabling true multi-device support. Implement "Pending Changes Protected" conflict resolution to prevent data loss when offline edits collide with remote changes.

### Conflict Resolution Strategy: "Pending Changes Protected"

**Core Rule:** Never overwrite a record that has pending local changes in the sync queue.

```
┌─────────────────────────────────────────────────────────────┐
│                    Pull from Remote                          │
│                                                              │
│  For each remote record:                                     │
│    1. Check if record ID exists in syncQueue (pending)       │
│    2. If YES → Skip (protect local changes)                  │
│    3. If NO → Apply LWW merge as normal                      │
│                                                              │
│  Then: Push local changes                                    │
│    - If push succeeds → Done                                 │
│    - If version conflict → Save to syncConflicts table       │
│    - Show conflict resolution UI to user                     │
└─────────────────────────────────────────────────────────────┘
```

**Why This Works:**

- No silent data loss - user's offline work is always preserved
- Explicit resolution - conflicts surface to user instead of being hidden
- Simple logic - one rule: "don't overwrite pending changes"
- Rare occurrence - conflicts only when same record edited by two users simultaneously

### Files to Modify

**`/workspaces/rock-on/src/services/data/SyncEngine.ts`**
Add new method: `pullIncrementalChanges(userId: string): Promise<IncrementalSyncResult>`

- Query Supabase for records with `updated_date > lastSyncTime`
- **Check syncQueue for pending changes before overwriting**
- Handle each entity type (songs, setlists, shows, practices)
- Use existing merge logic (Last-Write-Wins) for non-pending records
- Return change counts for session summary

Add conflict detection in `executeSyncOperation()`:

- Catch version mismatch errors from Supabase
- Save conflicts to `syncConflicts` table
- Emit conflict event for UI handling

**`/workspaces/rock-on/src/services/data/RemoteRepository.ts`**
Add filtered query methods:

- `getSongsSince(bandId: string, since: Date): Promise<Song[]>`
- `getSetlistsSince(bandId: string, since: Date): Promise<Setlist[]>`
- `getShowsSince(bandId: string, since: Date): Promise<Show[]>`
- `getPracticeSessionsSince(bandId: string, since: Date): Promise<PracticeSession[]>`

**`/workspaces/rock-on/src/contexts/AuthContext.tsx`**
Modify `loadInitialSession()` (line 176-277):

- After `isInitialSyncNeeded()` check, always call `pullIncrementalChanges()`
- Store return value (change counts) for session summary
- Update `last_sync_time` in localStorage per user

### New Types

**Add to `/workspaces/rock-on/src/services/data/syncTypes.ts`**

```typescript
export interface IncrementalSyncResult {
  newSongs: number
  updatedSongs: number
  deletedSongs: number
  newSetlists: number
  updatedSetlists: number
  deletedSetlists: number
  newPractices: number
  updatedPractices: number
  deletedPractices: number
  newShows: number
  updatedShows: number
  deletedShows: number
  skippedDueToPending: number // Records skipped because of pending local changes
  conflictsDetected: number // Version conflicts detected during push
  lastSyncTime: Date
  syncDurationMs: number
}

export interface SyncConflict {
  id?: number
  table: string
  recordId: string
  localVersion: Record<string, unknown>
  remoteVersion: Record<string, unknown>
  localModifiedAt: Date
  remoteModifiedAt: Date
  localModifiedBy?: string
  remoteModifiedBy?: string
  status: 'pending' | 'resolved_local' | 'resolved_remote' | 'resolved_merged'
  detectedAt: Date
  resolvedAt?: Date
}
```

### Implementation Details

```typescript
// SyncEngine.ts - New method with conflict protection
async pullIncrementalChanges(userId: string): Promise<IncrementalSyncResult> {
  const lastSyncKey = `last_incremental_sync_${userId}`
  const lastSync = localStorage.getItem(lastSyncKey)
  const lastSyncTime = lastSync ? new Date(lastSync) : new Date(0)
  const startTime = Date.now()

  const result: IncrementalSyncResult = {
    newSongs: 0, updatedSongs: 0, deletedSongs: 0,
    newSetlists: 0, updatedSetlists: 0, deletedSetlists: 0,
    newPractices: 0, updatedPractices: 0, deletedPractices: 0,
    newShows: 0, updatedShows: 0, deletedShows: 0,
    skippedDueToPending: 0,
    conflictsDetected: 0,
    lastSyncTime: new Date(),
    syncDurationMs: 0
  }

  // CONFLICT PROTECTION: Get IDs of records with pending local changes
  const pendingIds = new Set<string>()
  const pendingItems = await db.syncQueue
    .where('status')
    .equals('pending')
    .toArray()

  for (const item of pendingItems) {
    if (item.data?.id) {
      pendingIds.add(item.data.id)
    }
  }

  log.info(`Found ${pendingIds.size} records with pending local changes`)

  // Get user's band IDs
  const memberships = await this.remote.getUserMemberships(userId)
  const bandIds = memberships.map(m => m.bandId)

  for (const bandId of bandIds) {
    // Pull songs changed since lastSyncTime
    const songs = await this.remote.getSongsSince(bandId, lastSyncTime)
    for (const song of songs) {
      // PROTECT LOCAL CHANGES: Skip if record has pending local changes
      if (pendingIds.has(song.id)) {
        log.info(`Skipping song ${song.id} - has pending local changes`)
        result.skippedDueToPending++
        continue
      }

      const exists = await this.local.getSong(song.id)
      if (exists) {
        await this.local.updateSong(song.id, song)
        result.updatedSongs++
      } else {
        await this.local.addSong(song)
        result.newSongs++
      }
    }

    // Similar for setlists (with same pending check)
    const setlists = await this.remote.getSetlistsSince(bandId, lastSyncTime)
    for (const setlist of setlists) {
      if (pendingIds.has(setlist.id)) {
        log.info(`Skipping setlist ${setlist.id} - has pending local changes`)
        result.skippedDueToPending++
        continue
      }

      const exists = await this.local.getSetlist(setlist.id)
      if (exists) {
        await this.local.updateSetlist(setlist.id, setlist)
        result.updatedSetlists++
      } else {
        await this.local.addSetlist(setlist)
        result.newSetlists++
      }
    }

    // Similar for practices and shows...
  }

  // Update last sync time
  localStorage.setItem(lastSyncKey, result.lastSyncTime.toISOString())
  result.syncDurationMs = Date.now() - startTime

  log.info(`Incremental sync complete in ${result.syncDurationMs}ms`, {
    skipped: result.skippedDueToPending,
    new: result.newSongs + result.newSetlists + result.newPractices + result.newShows,
    updated: result.updatedSongs + result.updatedSetlists + result.updatedPractices + result.updatedShows
  })

  return result
}

// Helper to check if error is a version conflict
private isVersionConflict(error: unknown): boolean {
  if (error instanceof Error) {
    // Supabase returns specific error codes for constraint violations
    return error.message.includes('version') ||
           error.message.includes('conflict') ||
           error.message.includes('23505') // unique_violation
  }
  return false
}

// Save conflict for user resolution
private async saveConflict(conflict: Omit<SyncConflict, 'id'>): Promise<void> {
  await db.syncConflicts.add({
    ...conflict,
    status: 'pending',
    detectedAt: new Date()
  })

  // Emit event for UI to show conflict notification
  this.notifyListeners()
  log.warn(`Conflict detected for ${conflict.table}:${conflict.recordId}`)
}
```

### Conflict Detection in Push Operations

```typescript
// Modify executeSyncOperation() to detect conflicts
private async executeSyncOperation(item: SyncQueueItem): Promise<void> {
  const { table, operation, data } = item

  try {
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
      // ... other tables
    }
  } catch (error) {
    // Check if this is a version conflict
    if (this.isVersionConflict(error)) {
      // Fetch current remote version for comparison
      let remoteVersion: Record<string, unknown> | null = null

      switch (table) {
        case 'songs':
          remoteVersion = await this.remote.getSong(data.id) as Record<string, unknown>
          break
        case 'setlists':
          remoteVersion = await this.remote.getSetlist(data.id) as Record<string, unknown>
          break
        // ... other tables
      }

      if (remoteVersion) {
        await this.saveConflict({
          table,
          recordId: data.id,
          localVersion: data,
          remoteVersion,
          localModifiedAt: new Date(data.updatedDate || data.createdDate),
          remoteModifiedAt: new Date(remoteVersion.updatedDate as string || remoteVersion.createdDate as string),
          localModifiedBy: data.lastModifiedBy,
          remoteModifiedBy: remoteVersion.lastModifiedBy as string,
          status: 'pending',
          detectedAt: new Date()
        })

        // Don't re-throw - conflict is saved, remove from queue
        return
      }
    }

    // Re-throw non-conflict errors for retry logic
    throw error
  }
}
```

### Files to Create - Conflict Resolution UI

**`/workspaces/rock-on/src/hooks/useConflicts.ts`**

```typescript
import { useState, useEffect, useCallback } from 'react'
import { db } from '../services/database'
import type { SyncConflict } from '../services/data/syncTypes'

export function useConflicts() {
  const [conflicts, setConflicts] = useState<SyncConflict[]>([])
  const [loading, setLoading] = useState(true)

  const loadConflicts = useCallback(async () => {
    const pending = await db.syncConflicts
      .where('status')
      .equals('pending')
      .toArray()
    setConflicts(pending)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadConflicts()
  }, [loadConflicts])

  const resolveConflict = useCallback(
    async (conflictId: number, resolution: 'local' | 'remote') => {
      const conflict = await db.syncConflicts.get(conflictId)
      if (!conflict) return

      if (resolution === 'local') {
        // Keep local version - re-queue for push with force flag
        // This will overwrite remote
        // Implementation depends on table type
      } else {
        // Use remote version - update local IndexedDB
        // Implementation depends on table type
      }

      // Mark conflict as resolved
      await db.syncConflicts.update(conflictId, {
        status: resolution === 'local' ? 'resolved_local' : 'resolved_remote',
        resolvedAt: new Date(),
      })

      await loadConflicts()
    },
    [loadConflicts]
  )

  return {
    conflicts,
    loading,
    resolveConflict,
    hasConflicts: conflicts.length > 0,
  }
}
```

**`/workspaces/rock-on/src/components/ConflictResolutionModal.tsx`**

```tsx
import React from 'react'
import type { SyncConflict } from '../services/data/syncTypes'

interface ConflictResolutionModalProps {
  conflict: SyncConflict
  onResolve: (resolution: 'local' | 'remote') => void
  onClose: () => void
}

export const ConflictResolutionModal: React.FC<
  ConflictResolutionModalProps
> = ({ conflict, onResolve, onClose }) => {
  const getItemName = () => {
    return conflict.localVersion.title || conflict.localVersion.name || 'Item'
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4">
        <h2 className="text-xl font-bold text-white mb-4">
          Sync Conflict Detected
        </h2>

        <p className="text-gray-300 mb-4">
          "{getItemName()}" was edited on another device while you were offline.
          Choose which version to keep:
        </p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Local Version */}
          <div className="bg-gray-700 rounded p-4">
            <h3 className="font-semibold text-green-400 mb-2">Your Version</h3>
            <p className="text-sm text-gray-400">
              Modified: {formatDate(conflict.localModifiedAt)}
            </p>
            {/* Show key differences based on table type */}
          </div>

          {/* Remote Version */}
          <div className="bg-gray-700 rounded p-4">
            <h3 className="font-semibold text-blue-400 mb-2">Other Version</h3>
            <p className="text-sm text-gray-400">
              Modified: {formatDate(conflict.remoteModifiedAt)}
            </p>
            {/* Show key differences based on table type */}
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white"
          >
            Decide Later
          </button>
          <button
            onClick={() => onResolve('remote')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            Use Other Version
          </button>
          <button
            onClick={() => onResolve('local')}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
          >
            Keep My Version
          </button>
        </div>
      </div>
    </div>
  )
}
```

**`/workspaces/rock-on/src/components/ConflictIndicator.tsx`**

```tsx
import React from 'react'
import { useConflicts } from '../hooks/useConflicts'

export const ConflictIndicator: React.FC = () => {
  const { conflicts, hasConflicts } = useConflicts()

  if (!hasConflicts) return null

  return (
    <div className="fixed bottom-4 right-4 bg-amber-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
      <span className="text-lg">⚠️</span>
      <span>
        {conflicts.length} sync conflict{conflicts.length > 1 ? 's' : ''} need
        {conflicts.length === 1 ? 's' : ''} attention
      </span>
    </div>
  )
}
```

### Test Files to Create

**`/workspaces/rock-on/tests/unit/services/data/SyncEngine.pullIncremental.test.ts`**

- Test: pulls only records newer than lastSyncTime
- Test: correctly counts new vs updated records
- Test: handles multiple bands
- Test: updates lastSyncTime after completion
- Test: handles empty result set

**`/workspaces/rock-on/tests/unit/services/data/SyncEngine.conflicts.test.ts`**

- Test: skips records with pending local changes during pull
- Test: increments skippedDueToPending counter when skipping
- Test: detects version conflict during push
- Test: saves conflict to syncConflicts table
- Test: removes item from syncQueue after conflict saved
- Test: does not re-throw error for version conflicts

**`/workspaces/rock-on/tests/unit/hooks/useConflicts.test.ts`**

- Test: loads pending conflicts on mount
- Test: resolves conflict with local version
- Test: resolves conflict with remote version
- Test: updates conflict status after resolution
- Test: reloads conflicts after resolution

**`/workspaces/rock-on/tests/e2e/sync/sync-on-load.spec.ts`**

- Test: new songs from other device appear after reload
- Test: updated songs from other device reflect changes
- Test: session summary shows correct counts

**`/workspaces/rock-on/tests/e2e/sync/conflict-resolution.spec.ts`**

- Test: shows conflict indicator when conflicts exist
- Test: opens conflict resolution modal on indicator click
- Test: resolves conflict with "Keep My Version"
- Test: resolves conflict with "Use Other Version"
- Test: conflict indicator disappears after all resolved
- Test: offline edit preserved when remote also changed

### Success Criteria

- App load triggers incremental pull from Supabase
- Changes from other devices visible without WebSocket event
- Sync completes in < 3 seconds for typical data volume
- No duplicate records created
- **Pending local changes are never overwritten during pull**
- **Version conflicts are detected and saved for user resolution**
- **User can resolve conflicts via simple "Keep Mine" / "Use Theirs" UI**
- **Conflict indicator visible when unresolved conflicts exist**

---

## Phase 3: Activity Tracking (2-3 hours)

### Objective

Track user's last active time server-side to enable accurate "new" item detection across devices.

### Schema Change

**`/workspaces/rock-on/supabase/migrations/20260114000000_add_user_activity.sql`**

```sql
-- Add last_active_at to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- Create index for queries
CREATE INDEX IF NOT EXISTS idx_users_last_active ON public.users(last_active_at);

-- Function to update last_active_at
CREATE OR REPLACE FUNCTION update_user_activity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET last_active_at = NOW()
  WHERE id = auth.uid();
END;
$$;

ALTER FUNCTION update_user_activity() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION update_user_activity() TO authenticated;
```

### Files to Modify

**`/workspaces/rock-on/src/services/data/RemoteRepository.ts`**
Add methods:

- `updateUserActivity(): Promise<void>` - Call on login and periodically
- `getUserLastActive(userId: string): Promise<Date | null>`

**`/workspaces/rock-on/src/contexts/AuthContext.tsx`**

- Call `updateUserActivity()` in `onAuthStateChange` handler
- Store `lastActiveAt` in context state
- Expose via context for use by hooks

### Files to Create

**`/workspaces/rock-on/src/hooks/useLastActiveTime.ts`**

```typescript
import { useAuth } from '../contexts/AuthContext'

export function useLastActiveTime(): Date | null {
  const { lastActiveAt } = useAuth()
  return lastActiveAt
}
```

### Test Files

**`/workspaces/rock-on/tests/unit/services/data/RemoteRepository.activity.test.ts`**

- Test: updates last_active_at on login
- Test: getUserLastActive returns correct timestamp

**`/workspaces/rock-on/supabase/tests/012-user-activity.test.sql`**

- Test: column exists
- Test: function works for authenticated users

### Success Criteria

- User's `last_active_at` updated on every login
- Timestamp persists across sessions
- Accessible via hook for UI components

---

## Phase 4: New Item Indicators + Session Summary (5-7 hours)

### Objective

Show visual indicators on items changed since last session, plus a toast summary on app load.

### Files to Create

**`/workspaces/rock-on/src/hooks/useNewItemIndicators.ts`**

```typescript
import { useMemo } from 'react'
import { useLastActiveTime } from './useLastActiveTime'
import { useAuth } from '../contexts/AuthContext'

interface NewItemInfo {
  isNew: boolean // Created since last session
  isUpdated: boolean // Updated by someone else since last session
}

export function useNewItemIndicators<
  T extends {
    id: string
    createdDate: Date
    lastModifiedBy?: string
    updatedDate?: Date
  },
>(items: T[]): Map<string, NewItemInfo> {
  const lastActiveAt = useLastActiveTime()
  const { currentUser } = useAuth()

  return useMemo(() => {
    const map = new Map<string, NewItemInfo>()
    if (!lastActiveAt) return map

    for (const item of items) {
      const createdAfter = new Date(item.createdDate) > lastActiveAt
      const updatedAfter =
        item.updatedDate && new Date(item.updatedDate) > lastActiveAt
      const byOther = item.lastModifiedBy !== currentUser?.id

      map.set(item.id, {
        isNew: createdAfter,
        isUpdated: !createdAfter && updatedAfter && byOther,
      })
    }
    return map
  }, [items, lastActiveAt, currentUser?.id])
}
```

**`/workspaces/rock-on/src/components/common/NewBadge.tsx`**

```tsx
import React from 'react'

interface NewBadgeProps {
  isNew?: boolean
  isUpdated?: boolean
  className?: string
}

export const NewBadge: React.FC<NewBadgeProps> = ({
  isNew,
  isUpdated,
  className = '',
}) => {
  if (!isNew && !isUpdated) return null

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        isNew
          ? 'bg-green-500/20 text-green-400'
          : 'bg-blue-500/20 text-blue-400'
      } ${className}`}
      data-testid={isNew ? 'new-badge' : 'updated-badge'}
    >
      {isNew ? 'New' : 'Updated'}
    </span>
  )
}
```

**`/workspaces/rock-on/src/components/SessionSummaryToast.tsx`**

```tsx
import React, { useEffect } from 'react'
import { useToast } from '../contexts/ToastContext'
import type { IncrementalSyncResult } from '../services/data/syncTypes'

interface SessionSummaryProps {
  changes: IncrementalSyncResult | null
}

export const SessionSummaryToast: React.FC<SessionSummaryProps> = ({
  changes,
}) => {
  const { showToast } = useToast()

  useEffect(() => {
    if (!changes) return

    const totalNew =
      changes.newSongs +
      changes.newSetlists +
      changes.newPractices +
      changes.newShows
    const totalUpdated =
      changes.updatedSongs +
      changes.updatedSetlists +
      changes.updatedPractices +
      changes.updatedShows

    if (totalNew === 0 && totalUpdated === 0) return

    // Build summary message
    const parts: string[] = []
    if (changes.newSongs > 0)
      parts.push(
        `${changes.newSongs} new song${changes.newSongs > 1 ? 's' : ''}`
      )
    if (changes.newSetlists > 0)
      parts.push(
        `${changes.newSetlists} new setlist${changes.newSetlists > 1 ? 's' : ''}`
      )
    if (changes.newPractices > 0)
      parts.push(
        `${changes.newPractices} practice${changes.newPractices > 1 ? 's' : ''} scheduled`
      )
    if (changes.newShows > 0)
      parts.push(
        `${changes.newShows} new show${changes.newShows > 1 ? 's' : ''}`
      )

    if (parts.length > 0) {
      const message = `Welcome back! ${parts.join(', ')}`
      showToast(message, 'info')
    }
  }, [changes, showToast])

  return null // This component only triggers toast
}
```

### Files to Modify

**`/workspaces/rock-on/src/pages/SongsPage.tsx`**

- Import and use `useNewItemIndicators`
- Pass `isNew`/`isUpdated` info to song list items

**`/workspaces/rock-on/src/components/songs/SongListItem.tsx`** (or equivalent)

- Add `isNew` and `isUpdated` props
- Render `NewBadge` when applicable

**Similar changes for:**

- `SetlistsPage.tsx` / `SetlistCard.tsx`
- `PracticesPage.tsx` / `PracticeCard.tsx`
- `ShowsPage.tsx` / `ShowCard.tsx`

**`/workspaces/rock-on/src/contexts/AuthContext.tsx`**

- Add `syncResult` state to store `IncrementalSyncResult`
- Add `lastActiveAt` state
- Expose both via context
- Call `updateUserActivity()` on successful login

### Test Files

**`/workspaces/rock-on/tests/unit/hooks/useNewItemIndicators.test.ts`**

- Test: marks items created after lastActiveAt as new
- Test: marks items updated by others as updated
- Test: does not mark own updates as updated
- Test: handles null lastActiveAt gracefully

**`/workspaces/rock-on/tests/e2e/songs/new-item-badges.spec.ts`**

- Test: new song shows "New" badge after sync
- Test: updated song shows "Updated" badge

### Success Criteria

- "New" badge visible on items created since last session
- "Updated" badge visible on items modified by others
- Session summary toast shows on app load when changes exist
- Badges do not appear for user's own changes

---

## Phase 5: Release Notes System (4-6 hours) - FUTURE

**Deferred to future sprint.** The MVP focuses on auth and sync reliability.

### Overview

- New tables: `app_announcements`, `user_announcement_dismissals`
- Admin seeds announcements via Supabase Studio
- UI shows announcements based on priority and dismissal status

### Schema (Future)

```sql
CREATE TABLE app_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  announcement_type TEXT NOT NULL CHECK (announcement_type IN ('release', 'feature', 'tip', 'maintenance')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE user_announcement_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  announcement_id UUID NOT NULL REFERENCES app_announcements(id),
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, announcement_id)
);
```

---

## Phase 6: Polish & Documentation (2-3 hours)

### Objective

Finalize implementation, run full test suite, update documentation.

### Tasks

1. Run full test suite: `npm run test:all`
2. Run E2E tests: `npm run test:e2e`
3. Manual testing of all scenarios
4. Update CLAUDE.md with new features
5. Create user documentation for new badges
6. Performance testing (sync-on-load timing)

### Success Criteria

- All tests pass
- No regressions in existing functionality
- Documentation updated
- Performance within acceptable limits (< 3s sync)

---

## Migration Plan

### Database Migration

**Create migration file:** `supabase/migrations/20260114000000_add_user_activity.sql`

**Apply locally:**

```bash
supabase db reset
npm run test:db
```

**Apply to remote:**

```bash
source .env.supabase.local && supabase db push --linked
```

### Rollout Strategy

1. **Development:** Implement on feature branch `feature/improved-auth-sync`
2. **Local Testing:** Run all tests, manual testing
3. **Staging:** Deploy and verify with test accounts
4. **Production:** Deploy during low-traffic window
5. **Monitoring:** Watch error rates for 24 hours

### Rollback Plan

- Feature flag for sync-on-load (can disable if causing issues)
- Auth flow changes are backward compatible
- Activity tracking is additive (new column, no breaking changes)

---

## Risk Assessment

| Risk                                          | Impact | Probability | Mitigation                                |
| --------------------------------------------- | ------ | ----------- | ----------------------------------------- |
| Auth flow regression                          | HIGH   | LOW         | Comprehensive E2E tests                   |
| Sync-on-load performance                      | MEDIUM | MEDIUM      | Add timing metrics, optimize queries      |
| Activity tracking not updating                | LOW    | LOW         | Fallback to client-side timestamps        |
| Session summary too noisy                     | LOW    | MEDIUM      | User preference to disable (future)       |
| Grace period too strict                       | MEDIUM | MEDIUM      | Make configurable (1-2 hours)             |
| Conflict resolution confusing UX              | MEDIUM | LOW         | Simple "Keep Mine / Use Theirs" options   |
| Conflicts not detected (false negatives)      | HIGH   | LOW         | Thorough E2E tests for conflict scenarios |
| Too many conflicts surfaced (false positives) | LOW    | LOW         | Only detect actual version mismatches     |

---

## Open Questions Resolved

| Question                          | Decision                                  | Rationale                                                                                    |
| --------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| Incremental sync for deletes?     | Use audit_log query                       | Already have audit_log with DELETE entries                                                   |
| New badge persistence?            | Clear on page view                        | Simplest UX, matches email "unread" pattern                                                  |
| Session summary threshold?        | Always toast                              | Keep simple for MVP, add modal later if needed                                               |
| Multi-band handling?              | Summary shows all bands                   | User switches bands rarely, aggregate is fine                                                |
| **Conflict resolution strategy?** | **Pending Changes Protected**             | **Never overwrite pending local changes; surface conflicts to user for explicit resolution** |
| **Conflict resolution UI?**       | **Simple "Keep Mine / Use Theirs" modal** | **Avoids complexity of field-level merge; user makes final decision**                        |

---

## Task Summary by Phase

| Phase | Description                        | Hours | Priority       |
| ----- | ---------------------------------- | ----- | -------------- |
| 1     | Auth Flow Fix                      | 4-6   | Critical (MVP) |
| 2     | Sync-on-Load + Conflict Resolution | 7-9   | High (MVP)     |
| 3     | Activity Tracking                  | 2-3   | Medium (MVP)   |
| 4     | New Badges + Summary               | 5-7   | Medium (MVP)   |
| 5     | Release Notes                      | 4-6   | Low (Future)   |
| 6     | Polish & Docs                      | 2-3   | Medium         |

**Total MVP:** 18-27 hours (Phases 1-4)
**Total All:** 24-34 hours (Phases 1-6, excluding 5)

---

## Success Metrics

### Auth Flow

- Zero "Not logged in" flashes on protected pages
- < 100ms redirect on invalid session
- All E2E auth tests pass

### Sync-on-Load

- Incremental sync completes in < 3 seconds
- No duplicate records created
- Multi-device changes visible after reload

### User Experience

- "New" badges visible for items changed since last session
- Session summary toast appears when relevant
- Clear visual feedback during sync

---

## Critical Files for Implementation

| Priority | File                                                       | Action                                          |
| -------- | ---------------------------------------------------------- | ----------------------------------------------- |
| P1       | `src/hooks/useAuthCheck.ts`                                | Create                                          |
| P1       | `src/components/ProtectedRoute.tsx`                        | Modify                                          |
| P1       | `src/contexts/AuthContext.tsx`                             | Modify                                          |
| P2       | `src/services/data/SyncEngine.ts`                          | Add pullIncrementalChanges + conflict detection |
| P2       | `src/services/data/RemoteRepository.ts`                    | Add getSince methods                            |
| P2       | `src/services/data/syncTypes.ts`                           | Add IncrementalSyncResult + SyncConflict types  |
| P2       | `src/hooks/useConflicts.ts`                                | Create                                          |
| P2       | `src/components/ConflictResolutionModal.tsx`               | Create                                          |
| P2       | `src/components/ConflictIndicator.tsx`                     | Create                                          |
| P3       | `supabase/migrations/20260114000000_add_user_activity.sql` | Create                                          |
| P4       | `src/hooks/useNewItemIndicators.ts`                        | Create                                          |
| P4       | `src/components/common/NewBadge.tsx`                       | Create                                          |
| P4       | `src/components/SessionSummaryToast.tsx`                   | Create                                          |

---

## References

- **Expanded Research:** `.claude/features/improved-auth-flow/2026-01-14T21:03_research-expanded.md`
- **Original Auth Research:** `.claude/features/improved-auth-flow/2025-12-11T15:15_research.md`
- **Original Auth Plan:** `.claude/features/improved-auth-flow/2025-12-11T17:12_plan.md`
- **Sync Architecture Analysis:** `.claude/artifacts/2025-11-20T17:00_database-sync-architecture-analysis.md`

---

**Plan Status:** Ready for Implementation
**Next Step:** Begin Phase 1 - Auth Flow Fix
