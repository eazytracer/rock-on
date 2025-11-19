# Toast Listener Fix - Realtime Manager Instance Problem

**Date:** 2025-10-31T21:03
**Status:** Fixed
**Issue:** Toast events emitting but no listeners receiving them

---

## Problem Diagnosis

**Symptom:**
```javascript
📡 Received audit event: {table: 'songs', action: 'INSERT', user: 'Eric Johnson', ...}
✅ Synced song from audit log: Machine Head
[RealtimeManager] Emitting songs:changed event, listeners: 0  // ❌ 0 listeners!
[RealtimeManager] Emitting toast event, listeners: 0          // ❌ 0 listeners!
[Toast info]: Eric Johnson added "Machine Head"               // ℹ️ Log works but no toast shown
```

**Root Cause:**
The `AuthContext` was creating **TWO separate instances** of `RealtimeManager`:

1. **Instance #1** - Created on initial session load (line 127)
   - `AppContent` registers toast listener on this instance ✓
   - `useSongs` registers songs:changed listener on this instance ✓

2. **Instance #2** - Created on auth state change (line 205)
   - This instance subscribes to Supabase realtime
   - This instance emits events
   - **But has no listeners!** ❌

**Why This Happened:**
```typescript
// Location 1: loadInitialSession()
realtimeManager.current = new RealtimeManager()  // Creates instance #1

// Location 2: onAuthStateChange callback
realtimeManager.current = new RealtimeManager()  // Overwrites with instance #2!
```

Result: Event emitters and event listeners were on **different objects**!

---

## Solution

Added a check to prevent recreating the `RealtimeManager` if it already exists:

```typescript
// Before (WRONG - always creates new instance)
realtimeManager.current = new RealtimeManager()

// After (CORRECT - reuse existing instance)
if (!realtimeManager.current) {
  realtimeManager.current = new RealtimeManager()
}
```

**Applied in TWO locations:**

### 1. Initial Session Load (Line 128-130)
```typescript
console.log('🔌 Starting real-time WebSocket sync...')
// Only create if doesn't exist yet
if (!realtimeManager.current) {
  realtimeManager.current = new RealtimeManager()
}
const bandIds = bands.map(m => m.bandId)
await realtimeManager.current.subscribeToUserBands(storedUserId, bandIds)
```

### 2. Auth State Change (Line 209-211)
```typescript
console.log('🔌 Starting real-time WebSocket sync...')
// Only create if doesn't exist yet
if (!realtimeManager.current) {
  realtimeManager.current = new RealtimeManager()
}
const bandIds = memberships.map(m => m.bandId)
await realtimeManager.current.subscribeToUserBands(userId, bandIds)
```

---

## Expected Behavior After Fix

**Console Output:**
```javascript
[AppContent] Registering toast listener                       // ✓ Listener registered
[useSongs] Mounting hook for band: {bandId}                  // ✓ Hook registered

📡 Received audit event: {table: 'songs', action: 'INSERT', user: 'Eric Johnson', ...}
✅ Synced song from audit log: Machine Head
[RealtimeManager] Emitting songs:changed event, listeners: 1  // ✓ 1 listener!
[RealtimeManager] Emitting toast event, listeners: 1          // ✓ 1 listener!
[AppContent] Realtime toast received: Eric Johnson added "Machine Head" info
[Toast info]: Eric Johnson added "Machine Head"
```

**UI Behavior:**
- ✅ Toast notification appears in top-right corner
- ✅ Shows actual user name: "Eric Johnson added 'Machine Head'"
- ✅ Songs list auto-refreshes with new song
- ✅ No manual page refresh needed

---

## Files Modified

1. **src/contexts/AuthContext.tsx**
   - Line 128-130: Added conditional check before creating RealtimeManager
   - Line 209-211: Added conditional check before creating RealtimeManager

---

## Testing Verification

### Test 1: Check Listener Count

1. Open browser console
2. Login to the app
3. Look for these log messages:
   ```
   [AppContent] Registering toast listener
   ```
4. Navigate to Songs page
5. Look for:
   ```
   [useSongs] Mounting hook for band: {bandId}
   ```
6. Have another user add a song
7. **Expected:**
   ```
   [RealtimeManager] Emitting songs:changed event, listeners: 1
   [RealtimeManager] Emitting toast event, listeners: 1
   ```
   (**NOT** `listeners: 0`)

### Test 2: Toast Appears

1. Open app in two browsers (User A and User B)
2. User B: Create a new song
3. **Expected in User A:**
   - Toast notification appears saying "User B added 'Song Name'"
   - Songs list auto-refreshes to show the new song
   - No errors in console

### Test 3: Multiple Entity Types

Test all entity types emit and listen correctly:
- ✅ Songs: Create, update, delete
- ✅ Setlists: Create, update, delete
- ✅ Shows: Create, update, delete
- ✅ Practices: Create, update, delete

Each should:
- Show toast notification with correct user name and item name
- Auto-refresh the list on the page
- Have `listeners: 1` in console logs

---

## Why This Pattern Was Used

**EventEmitter Pattern Benefits:**
- ✅ Decoupled: UI components don't need to import RealtimeManager directly
- ✅ Flexible: Multiple components can listen to the same events
- ✅ Testable: Easy to mock events in tests
- ✅ React-friendly: Clean useEffect patterns for mounting/unmounting listeners

**Critical Requirement:**
- **MUST** use the same EventEmitter instance for emitting AND listening
- If instance changes, all listeners are lost (this was the bug!)

**Solution:**
- Use React `useRef` to store a stable reference
- Only create instance once
- Reuse the same instance across auth state changes

---

## Related Issues Fixed

This also fixes:
1. **Songs not auto-refreshing** - Same root cause (0 listeners)
2. **Setlists not auto-refreshing** - Same root cause (0 listeners)
3. **Any realtime event not working** - Same root cause

All were caused by listeners being registered on Instance #1 but events being emitted from Instance #2.

---

## Future Improvements

### 1. Add Singleton Pattern

Make RealtimeManager a true singleton to prevent this issue entirely:

```typescript
class RealtimeManager extends EventEmitter {
  private static instance: RealtimeManager | null = null

  static getInstance(): RealtimeManager {
    if (!RealtimeManager.instance) {
      RealtimeManager.instance = new RealtimeManager()
    }
    return RealtimeManager.instance
  }

  private constructor() {  // Private constructor
    super()
  }
}

// Usage
const realtimeManager = RealtimeManager.getInstance()
```

### 2. Add Instance ID Logging

Help debug future instance issues:

```typescript
class RealtimeManager extends EventEmitter {
  private instanceId = crypto.randomUUID().slice(0, 8)

  constructor() {
    super()
    console.log(`[RealtimeManager#${this.instanceId}] Created`)
  }

  emit(event: string, ...args: any[]) {
    console.log(`[RealtimeManager#${this.instanceId}] Emitting ${event}`)
    return super.emit(event, ...args)
  }
}
```

This would have immediately shown:
```
[RealtimeManager#abc123] Created
[AppContent] Listening on RealtimeManager#abc123
[RealtimeManager#def456] Created  // ⚠️ Different ID!
[RealtimeManager#def456] Emitting toast  // ⚠️ No listeners on this instance!
```

---

## Lessons Learned

1. **EventEmitter instances must be stable** - Recreating them loses all listeners
2. **React useRef is perfect for stable references** - But only if not overwritten!
3. **Always check listener count in logs** - `listeners: 0` is a red flag
4. **Singleton pattern prevents these issues** - Consider for future refactoring

---

**Status:** Fixed and ready for testing
**Risk:** Low - Only adds conditional checks, doesn't change core logic
**Impact:** High - Restores all toast notifications and realtime reactivity
