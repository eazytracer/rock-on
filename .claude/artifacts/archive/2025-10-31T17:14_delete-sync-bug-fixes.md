# Delete Sync Bug Fixes

**Date:** 2025-10-31T17:14
**Context:** Fixing real-time sync issues when deleting songs across multiple band member sessions

## Issues Identified

### 1. Dexie "No key or key range specified" Error ✅ FIXED
**Root Cause:** `RealtimeManager.queueToast()` was being called with an empty/undefined `userId`, causing Dexie to throw an error when trying to fetch user information.

**Fix Applied:** Added validation in `queueToast()` method (src/services/data/RealtimeManager.ts:479-493):
- Check if `userId` is truthy before querying Dexie
- Log warning if userId is empty or user not found in local DB
- Default to "Someone" as the display name when user info unavailable

### 2. Toast Shows "undefined" for Deleted Items ✅ FIXED
**Root Cause:** Supabase DELETE events only include the primary key in the `oldRow` object, not all columns like `title`, `name`, etc.

**Fix Applied:** Fetch item details from local IndexedDB BEFORE deleting (src/services/data/RealtimeManager.ts):
- **Songs (lines 270-279):** Fetch song title before deletion, default to "a song"
- **Setlists (lines 340-349):** Fetch setlist name before deletion, default to "a setlist"
- **Shows (lines 413-422):** Fetch show name before deletion, default to "a show"
- **Practices (lines 487-498):** Fetch practice date before deletion, default to "a practice"

### 3. Page Reload on Delete ⚠️ UNDER INVESTIGATION
**Observation:** After a DELETE event, the entire page appears to reload:
- AuthContext re-initializes ("🔐 Realtime auth restored from session")
- All hooks unmount and remount
- Real-time WebSocket reconnects

**Possible Causes:**
1. **HMR (Hot Module Reload) Side Effect:** Vite's Fast Refresh is failing for AuthContext ("Could not Fast Refresh"), causing full page reloads during development when RealtimeManager.ts changes
2. **React Context Issue:** Something in the DELETE flow might be causing the AuthContext to re-render unexpectedly

**Next Steps:**
- Test in production build (without HMR) to isolate whether this is a development-only issue
- If it persists in production, investigate AuthContext state management and dependency arrays

## Files Modified

1. **src/services/data/RealtimeManager.ts**
   - Added userId validation in `queueToast()` method
   - Added local DB lookups before DELETE operations for all entity types
   - Improved error handling and logging

## Testing Recommendations

1. **Test DELETE in production build:**
   ```bash
   npm run build
   npm run preview
   ```
   Then test multi-user deletion to see if page reload still occurs

2. **Verify toast messages:**
   - Delete items and verify toast shows correct name (not "undefined")
   - Verify toast shows user name or "Someone" appropriately

3. **Monitor console:**
   - Should NOT see Dexie errors
   - Should see proper item names in toast logs
   - Check if full page reload still happens

## Code Examples

### Before (Broken):
```typescript
if (eventType === 'DELETE') {
  await repository.deleteSong(oldRow.id)
  await this.queueToast(oldRow.created_by, 'DELETE', 'song', oldRow.title) // ❌ oldRow.title is undefined
}
```

### After (Fixed):
```typescript
if (eventType === 'DELETE') {
  // Fetch title from local DB before deleting
  let songTitle = 'a song'
  try {
    const song = await db.songs.get(oldRow.id)
    if (song) {
      songTitle = song.title || 'a song'
    }
  } catch (error) {
    console.warn('[RealtimeManager] Could not fetch song title before delete:', error)
  }

  await repository.deleteSong(oldRow.id)
  await this.queueToast(oldRow.created_by, 'DELETE', 'song', songTitle) // ✅ Shows actual title
}
```
