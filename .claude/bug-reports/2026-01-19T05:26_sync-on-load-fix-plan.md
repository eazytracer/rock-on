# Fix Plan: Sync-on-Load Missing Changes

**Date:** 2026-01-19
**Updated:** 2026-01-19 (simplified approach)
**Related Bug Report:** `2026-01-19T05:26_sync-on-load-missing-changes.md`
**Status:** Approved - Implementation in progress

## Overview

Fix the incremental sync to properly track and fetch all remote changes. If no sync timestamp exists, perform a full sync instead of guessing with arbitrary time fallbacks.

## Simplified Approach

Instead of using arbitrary fallback durations (24 hours, 30 days), we take a cleaner approach:

- **Has `lastIncrementalSync`?** → Incremental sync since that timestamp
- **No `lastIncrementalSync`?** → Full sync to ensure all data is present

This eliminates guesswork and guarantees data consistency.

## Changes Required

### File: `src/services/data/SyncEngine.ts`

#### Change 1: Set `lastIncrementalSync` after initial sync (Lines 866-882)

**Current code:**

```typescript
private async markInitialSyncComplete(): Promise<void> {
  if (!db.syncMetadata) return

  const now = new Date()
  const entities = ['songs', 'setlists', 'practices', 'shows']

  for (const entity of entities) {
    await db.syncMetadata.put({
      id: `${entity}_lastFullSync`,
      value: now,
      updatedAt: now,
    })
  }

  // Also set in localStorage for quick check
  localStorage.setItem('last_full_sync', now.toISOString())
}
```

**Proposed change:**

```typescript
private async markInitialSyncComplete(): Promise<void> {
  if (!db.syncMetadata) return

  const now = new Date()
  const entities = ['songs', 'setlists', 'practices', 'shows']

  for (const entity of entities) {
    await db.syncMetadata.put({
      id: `${entity}_lastFullSync`,
      value: now,
      updatedAt: now,
    })
  }

  // Also set in localStorage for quick check
  localStorage.setItem('last_full_sync', now.toISOString())

  // Set lastIncrementalSync so subsequent incremental syncs have a valid baseline
  await this.setLastIncrementalSyncTime(now)
}
```

**Rationale:** After initial sync completes, set `lastIncrementalSync` to the same timestamp so that future incremental syncs have a valid starting point.

---

#### Change 2: Return null when no sync timestamp exists (Lines 1047-1060)

**Current code:**

```typescript
private async getLastIncrementalSyncTime(): Promise<Date> {
  if (!db.syncMetadata) {
    // Default: 24 hours ago
    return new Date(Date.now() - 24 * 60 * 60 * 1000)
  }

  const metadata = await db.syncMetadata.get('lastIncrementalSync')
  if (metadata?.value) {
    return new Date(metadata.value)
  }

  // Default: 24 hours ago
  return new Date(Date.now() - 24 * 60 * 60 * 1000)
}
```

**Proposed change:**

```typescript
private async getLastIncrementalSyncTime(): Promise<Date | null> {
  if (!db.syncMetadata) {
    return null  // No timestamp → triggers full sync
  }

  const metadata = await db.syncMetadata.get('lastIncrementalSync')
  if (metadata?.value) {
    return new Date(metadata.value)
  }

  return null  // No timestamp → triggers full sync
}
```

**Rationale:** Instead of guessing with arbitrary fallbacks, return `null` to signal that a full sync is needed.

---

#### Change 3: Handle null in pullIncrementalChanges (Lines 952-1041)

**Add logic at the start of `pullIncrementalChanges()`:**

```typescript
async pullIncrementalChanges(userId: string): Promise<IncrementalSyncResult> {
  const startTime = Date.now()
  const result = createEmptyIncrementalSyncResult()

  try {
    log.info('[IncrementalSync] Starting incremental sync...')

    // Get last sync time - if null, we need a full sync
    const lastSync = await this.getLastIncrementalSyncTime()

    if (!lastSync) {
      log.info('[IncrementalSync] No sync timestamp found, performing full sync instead')
      await this.performInitialSync(userId)
      result.syncDurationMs = Date.now() - startTime
      return result
    }

    // ... rest of existing incremental sync logic using lastSync ...
```

**Rationale:** If we don't have a valid sync timestamp, do a full sync to guarantee all data is present. This is safer than guessing.

---

## Testing Plan

### Unit Tests

Update tests in `tests/unit/services/data/SyncEngine.test.ts`:

1. **Test: Initial sync sets lastIncrementalSync**
   - After `performInitialSync()` completes, verify `lastIncrementalSync` is set in IndexedDB

2. **Test: getLastIncrementalSyncTime returns stored timestamp when available**
   - Set `lastIncrementalSync` in IndexedDB
   - Verify it returns the stored timestamp

3. **Test: getLastIncrementalSyncTime returns null when no timestamp exists**
   - Clear `lastIncrementalSync`
   - Verify it returns `null`

4. **Test: pullIncrementalChanges performs full sync when no timestamp**
   - Clear `lastIncrementalSync`
   - Call `pullIncrementalChanges()`
   - Verify `performInitialSync()` is called

### Manual Testing

1. **New user scenario:**
   - Fresh login → initial sync → verify `lastIncrementalSync` is set
   - Close and reopen app → verify incremental sync uses stored timestamp

2. **Existing user without timestamp:**
   - User with `last_full_sync` but no `lastIncrementalSync`
   - Open app → should trigger full sync
   - Subsequent opens → should use incremental sync

## Rollout Considerations

1. **Backward compatible:** Existing users without `lastIncrementalSync` will get a one-time full sync
2. **No data loss:** Full sync ensures all data is present
3. **No migration needed:** Fix is applied on next app load
4. **Small performance cost:** One-time full sync for existing users, then incremental thereafter
