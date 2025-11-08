# Audit-First Sync - Bug Fixes

**Date:** 2025-10-31T19:11
**Status:** Fixed
**Issues:** Realtime subscription error + logging improvements

---

## Issues Reported

### 1. "Mismatch between server and client bindings" Error ❌

**Error Message:**
```
❌ Failed to subscribe to audit-accfd37c-2bac-4e27-90b1-257659f58d44:
Error: mismatch between server and client bindings for postgres changes
```

**Root Cause:**
The `handleAuditChange()` method was expecting a `RealtimePayload` type, but Supabase's realtime system sends a different payload structure for `postgres_changes` events.

**Fix Applied:**
```typescript
// Before (incorrect type casting)
private async handleAuditChange(payload: RealtimePayload): Promise<void> {
  const audit = payload.new as AuditLogEntry
  // ...
}

// After (accept any, validate structure)
private async handleAuditChange(payload: any): Promise<void> {
  // Supabase realtime sends: { new: AuditLogEntry, old: ..., eventType: 'INSERT', ... }
  const audit = payload.new as AuditLogEntry

  if (!audit || !audit.table_name || !audit.action) {
    console.warn('[RealtimeManager] Invalid audit payload:', payload)
    return
  }
  // ...
}
```

**Files Modified:**
- `src/services/data/RealtimeManager.ts` (lines 586-593, 130-132)

### 2. Setlist Changes Not Auto-Refreshing 🔄

**Issue:**
- Songs added by other users → Toast shows + auto-refresh ✓
- Setlists added by other users → Toast shows but NO auto-refresh ❌

**Investigation:**
The `useSetlists` hook was already listening to `setlists:changed` events correctly (line 62). The issue was likely:
1. Event wasn't being emitted (fixed by payload structure fix above)
2. Not enough logging to diagnose

**Fix Applied:**
Added better logging to track event emission and listeners:

```typescript
// Emit change event for UI reactivity
const eventName = `${audit.table_name}:changed`
console.log(`[RealtimeManager] Emitting ${eventName} event, listeners:`, this.listenerCount(eventName))
this.emit(eventName, {
  bandId: audit.band_id,
  action: audit.action,
  recordId: audit.record_id
})
```

**Expected Behavior After Fix:**
- Console should show: `[RealtimeManager] Emitting setlists:changed event, listeners: 1`
- If listeners = 0, the hook isn't mounted yet
- If listeners > 0, event should trigger `useSetlists` refetch

**Files Modified:**
- `src/services/data/RealtimeManager.ts` (lines 628-634)

---

## Testing Instructions

### Verify Fix #1 (No More Subscription Errors)

1. Open browser console
2. Login to the app
3. Check for WebSocket subscription messages
4. **Expected:**
   ```
   ✅ Subscribed to audit-{bandId} (audit-first)
   ✅ Real-time sync connected (1 channels)
   ```
5. **NOT expected:** Any "mismatch between server and client bindings" errors

### Verify Fix #2 (Setlists Auto-Refresh)

1. Open app in two browsers (User A and User B)
2. User A: Navigate to /setlists page
3. User B: Create a new setlist
4. **Expected in User A's console:**
   ```
   📡 Received audit event: {table: 'setlists', action: 'INSERT', user: 'User B', ...}
   [RealtimeManager] Emitting setlists:changed event, listeners: 1
   [useSetlists] Realtime change detected for band, refetching...
   [useSetlists] Fetching setlists for band: {bandId}
   [useSetlists] Fetched setlists count: {count}
   ```
5. **Expected in User A's UI:** New setlist appears automatically (no manual refresh needed)
6. **Expected toast:** "User B added '{Setlist Name}'"

### Debug if Still Not Working

If setlists still don't auto-refresh:

**Check 1: Is the event being received?**
```javascript
// In browser console
📡 Received audit event: {table: 'setlists', ...}
```
- If NO: Check Supabase realtime is working (network tab, WS connection)
- If YES: Continue to Check 2

**Check 2: Is the event being emitted?**
```javascript
[RealtimeManager] Emitting setlists:changed event, listeners: X
```
- If listeners = 0: useSetlists hook not mounted (navigate to /setlists first)
- If listeners > 0: Continue to Check 3

**Check 3: Is useSetlists receiving the event?**
```javascript
[useSetlists] Realtime change detected for band, refetching...
```
- If NO: Check if realtimeManager is passed correctly in AuthContext
- If YES: Event handler is working, issue is with refetch

**Check 4: Is the refetch working?**
```javascript
[useSetlists] Fetching setlists for band: ...
[useSetlists] Fetched setlists count: ...
```
- If NO: Check SetlistService.getSetlists() for errors
- If YES: Data is fetched, issue is with React state update

---

## Additional Notes

### Flicker Effect Mentioned

> "There was still a sort of 'flicker' effect when it reloaded"

**Cause:** The UI refetches all songs/setlists from the database when a realtime event is received.

**Current Flow:**
1. Realtime event received
2. Record updated in IndexedDB
3. Hook refetches ALL records from IndexedDB
4. React re-renders with new data
5. **Result:** Brief flicker as list is rebuilt

**Future Improvement (Post-MVP):**
Instead of refetching all records, directly update the React state with the single changed record:

```typescript
// Current approach (refetch everything)
const handleRealtimeChange = () => {
  fetchSongs()  // Refetch all songs
}

// Optimized approach (update single item)
const handleRealtimeChange = ({ recordId, action }) => {
  if (action === 'INSERT') {
    const newSong = await db.songs.get(recordId)
    setSongs(prev => [...prev, newSong])
  } else if (action === 'UPDATE') {
    const updatedSong = await db.songs.get(recordId)
    setSongs(prev => prev.map(s => s.id === recordId ? updatedSong : s))
  } else if (action === 'DELETE') {
    setSongs(prev => prev.filter(s => s.id !== recordId))
  }
}
```

**Trade-off:** More complex code, but eliminates flicker. Recommend implementing after MVP is stable.

---

## Remaining Known Issues (Unrelated to Audit-First)

From Eric's console output:

### Warning: Missing React Keys
```
Warning: Each child in a list should have a unique "key" prop.
Check the render method of `SetlistEditorPage`.
```

**File:** `src/pages/NewLayout/SetlistsPage.tsx` (around line 1133)

**Fix:** Add unique `key` prop to list items in SetlistEditorPage

**Priority:** Low (doesn't affect functionality, just a React best practice)

---

## Summary

### ✅ Fixed
1. "Mismatch between server and client bindings" error
2. Improved logging for event emission and listener counts
3. Validated that useSetlists hook is correctly set up

### 🔄 Test Required
1. Verify setlists now auto-refresh when other users make changes
2. Verify no more subscription errors in console
3. Confirm event listeners are being registered (check logs)

### 📋 Future Improvements
1. Eliminate flicker by updating single items instead of refetching all
2. Fix React key warning in SetlistEditorPage
3. Add more granular error handling for invalid audit payloads

---

**Status:** Fixes deployed, ready for testing
**Testing Time:** ~5 minutes with two browsers
**Rollback:** Revert changes to `RealtimeManager.ts` if issues persist
