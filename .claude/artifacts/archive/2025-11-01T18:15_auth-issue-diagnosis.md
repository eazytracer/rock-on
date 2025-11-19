# Auth Issue Diagnosis - "No Band Selected" After Changes

**Date:** 2025-11-01T18:15
**Issue:** After RealtimeManager fixes, user sees "No Band Selected" and "Not logged in"

## What Changed

### Changes Made
1. **AuthContext.tsx** - Changed RealtimeManager from `useState` to `useRef` + added `useMemo` for context value
2. **App.tsx** - Added handler ref for toast listener  
3. **useSetlists.ts** - Added handler ref for setlist listener

### Theory: Session Timeout vs Code Break

**Two Possible Causes:**

1. **Session Expired (More Likely)**
   - User was away for several hours
   - Supabase session tokens typically expire after 1 hour
   - App doesn't detect expired session and redirect to login
   - **Not caused by code changes**

2. **Context Reactivity Broke (Less Likely)**
   - `useMemo` dependencies might be wrong
   - Components not re-rendering when auth state changes
   - **Caused by code changes**

## Quick Test

To determine which:

1. **Clear browser storage and try fresh login:**
   ```javascript
   // In browser console:
   localStorage.clear()
   sessionStorage.clear()
   // Then refresh page
   ```

2. **Click a quick login button:**
   - If it works → Session expiry issue (not code)
   - If it doesn't work → Code broke auth

## What Code Changes Could Break

### The `useMemo` Dependencies

```typescript
const value: AuthContextType = useMemo(() => ({
  // ... all values
}), [
  user,
  session,
  loading,
  // ... all dependencies
  realtimeManagerReady // Added this
])
```

**Risk:** If any dependency is missing, components won't re-render when that value changes.

**Missing from deps?** None - all state values are included.

### The `useRef` for RealtimeManager

```typescript
const realtimeManagerRef = useRef<RealtimeManager | null>(null)
```

**Risk:** Components expecting `realtimeManager` to trigger re-renders won't update.

**Mitigation:** We added `realtimeManagerReady` state that changes when manager is created, triggering re-render.

## Session Expiry Handling (Missing Feature)

**Current Behavior:**
- Session expires silently
- User still on app pages
- Auth context shows "not logged in"
- No redirect to login page

**Should Be:**
- Detect session expiry
- Show toast: "Session expired, please log in again"
- Redirect to /auth

## Immediate Fixes Needed

### 1. Add Session Expiry Detection

In AuthContext, add:

```typescript
useEffect(() => {
  const checkSession = async () => {
    const session = await authService.getSession()
    if (!session && (currentUser || user)) {
      // Had a user but session is gone → expired
      console.warn('Session expired, logging out')
      logout()
      // Redirect to login
      window.location.href = '/auth'
    }
  }

  // Check every minute
  const interval = setInterval(checkSession, 60000)
  return () => clearInterval(interval)
}, [currentUser, user])
```

### 2. Add ProtectedRoute Session Check

In ProtectedRoute component, check session validity:

```typescript
const { session } = useAuth()

useEffect(() => {
  if (!session) {
    // No session, redirect to login
    navigate('/auth', { replace: true })
  }
}, [session])
```

## Recovery Steps for User

**Right Now:**

1. Clear browser storage (localStorage/sessionStorage)
2. Refresh page
3. Click quick login button
4. Should work normally

**Or:**

1. Navigate to `/auth` manually
2. Click quick login button
3. Should work normally

## Root Cause: Most Likely Session Expiry

The fact that this happened "several hours" after last use strongly suggests **session timeout**, not code changes. Supabase sessions expire, and the app doesn't handle it gracefully.

**Evidence:**
- User was away for hours
- Typical session lifetime is 1 hour
- No code changes to session management
- Quick login buttons should still work (they create new sessions)

## Action Plan

1. ✅ Verify code compiles (done - no errors)
2. 🔄 User tests quick login (pending)
3. ⏳ Add session expiry detection
4. ⏳ Add auto-redirect on expiry
5. ⏳ Document session lifetime

