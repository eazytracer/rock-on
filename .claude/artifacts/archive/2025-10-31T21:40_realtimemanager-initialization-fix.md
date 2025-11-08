# RealtimeManager Initialization Fix - Multiple Instance Bug

**Date:** 2025-10-31T21:40
**Updated:** 2025-11-01T17:52
**Status:** Fixed
**Issue:** Multiple RealtimeManager instances causing listeners to be lost

---

## Problem Summary

**Symptoms:**
```javascript
[AppContent] Registering toast listener
[RealtimeManager] Emitting toast event, listeners: 0    // ❌ No listeners!
[RealtimeManager] Emitting setlists:changed event, listeners: 0  // ❌ No listeners!
[Toast info]: Eric Johnson added "New Setlist"  // Logged but no toast shown
```

**What Was Happening:**
1. RealtimeManager was being created multiple times during auth flow
2. Toast listener was registered on Instance #1
3. Setlist listener was registered on Instance #2
4. Events were emitted from Instance #3
5. Result: 0 listeners, no toasts, no auto-refresh

**Root Causes:**
1. Changed from `useRef` to `useState` for RealtimeManager (bad decision)
2. State updates caused re-renders and new instances
3. Conditional check wasn't working because it checked stale state
4. No stable reference to the same EventEmitter instance

---

## The Fix

### 1. AuthContext Changes (`src/contexts/AuthContext.tsx`)

**Before (WRONG):**
```typescript
const [realtimeManager, setRealtimeManager] = useState<RealtimeManager | null>(null)

// Later...
let manager = realtimeManager
if (!manager) {
  manager = new RealtimeManager()
  setRealtimeManager(manager)  // ❌ State update causes re-render
}
```

**After (CORRECT):**
```typescript
// Use ref for stable instance, state only for reactivity signal
const realtimeManagerRef = useRef<RealtimeManager | null>(null)
const [realtimeManagerReady, setRealtimeManagerReady] = useState(false)

// Later...
if (!realtimeManagerRef.current) {
  console.log('[AuthContext] Creating new RealtimeManager instance')
  realtimeManagerRef.current = new RealtimeManager()
  setRealtimeManagerReady(true)  // Signal ready
} else {
  console.log('[AuthContext] RealtimeManager already exists, reusing')
}

// Expose ref's current value in context
realtimeManager: realtimeManagerRef.current
```

**Why This Works:**
- `useRef` maintains a stable reference across re-renders
- State is only used as a signal that manager is ready
- No re-renders from updating the ref
- Same instance is reused throughout the session

### 2. App.tsx Toast Listener (`src/App.tsx`)

**Before (WRONG):**
```typescript
useEffect(() => {
  if (!realtimeManager) return

  const handleToast = (...) => { ... }
  realtimeManager.on('toast', handleToast)

  return () => {
    realtimeManager.off('toast', handleToast)  // ❌ May be different instance!
  }
}, [realtimeManager, showToast])
```

**After (CORRECT):**
```typescript
const toastHandlerRef = useRef<((event: ...) => void) | null>(null)

useEffect(() => {
  if (!realtimeManager) return

  // Remove old listener if exists
  if (toastHandlerRef.current) {
    realtimeManager.off('toast', toastHandlerRef.current)
  }

  // Create new listener
  const handleToast = (...) => { ... }
  toastHandlerRef.current = handleToast

  realtimeManager.on('toast', handleToast)

  return () => {
    if (realtimeManager && toastHandlerRef.current) {
      realtimeManager.off('toast', toastHandlerRef.current)  // ✓ Same handler!
    }
  }
}, [realtimeManager, showToast])
```

**Why This Works:**
- Handler ref ensures we remove the exact same function we added
- Prevents listener leaks
- Works even if dependencies change

### 3. useSetlists Hook (`src/hooks/useSetlists.ts`)

Applied same pattern as App.tsx for proper listener cleanup.

---

## Expected Behavior After Fix

**Console Output (User 2):**
```javascript
[AuthContext] Creating new RealtimeManager instance  // ✓ Once only!
[AppContent] Registering toast listener
[useSetlists] Registering realtime listener for band: {bandId}

// User 1 creates a setlist...

📡 Received audit event: {table: 'setlists', action: 'INSERT', ...}
✅ Synced setlist from audit log: New Setlist
[RealtimeManager] Emitting setlists:changed event, listeners: 1  // ✓ 1 listener!
[RealtimeManager] Emitting toast event, listeners: 1             // ✓ 1 listener!
[AppContent] Realtime toast received: Eric Johnson added "New Setlist" info
[Toast info]: Eric Johnson added "New Setlist"
[useSetlists] Realtime change detected for band, refetching...
[useSetlists] Fetched setlists count: 2  // ✓ Auto-refreshed!
```

**UI Behavior:**
- ✅ Toast notification appears with actual user name
- ✅ Setlists list auto-refreshes with new item
- ✅ No manual page refresh needed
- ✅ Works for all subsequent changes

---

## Files Modified

1. **src/contexts/AuthContext.tsx** - Changed from useState to useRef
2. **src/App.tsx** - Added handler ref for proper cleanup
3. **src/hooks/useSetlists.ts** - Added handler ref for proper cleanup

---

**Status:** ✅ Fixed and ready for testing
**Impact:** High - Restores all toast notifications and auto-refresh functionality
