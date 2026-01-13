# Bug Report: Session Expiry and Auth Redirect Issues

**Created:** 2025-12-05T20:53
**Status:** Open
**Priority:** High
**Category:** Authentication / UX

---

## Summary

Multiple related issues around session management and authentication state:

1. **Refresh token conflicts** when using app on multiple devices simultaneously
2. **Poor UX on session expiry** - shows "no band selected" or empty state instead of login
3. **Stale session data** requires browser cache clear to resolve

---

## Issue 1: Multi-Device Refresh Token Conflict

### Observed Behavior

When user has the app open on phone and browser simultaneously, one device's refresh token invalidates the other, causing unexpected logout.

### Console Logs

```
POST https://khzeuxxhigqcmrytsfux.supabase.co/auth/v1/token?grant_type=refresh_token 400 (Bad Request)
...
_refreshAccessToken @ index-5189ec1-6780963b.js:112
_callRefreshToken @ index-5189ec1-6780963b.js:112
```

### Root Cause

Supabase refresh token rotation - when one device uses the refresh token, it's invalidated for other devices. This is a security feature but needs graceful handling.

### Expected Behavior

- Detect refresh token failure
- Show user-friendly "Session expired on another device" message
- Redirect to login screen
- Do NOT show empty/broken app state

---

## Issue 2: Invalid Session Shows Empty State Instead of Login

### Observed Behavior

When session becomes invalid (expired, revoked, etc.), the app shows:

- "No band selected"
- "Not logged in"
- "Select a band"
- Empty pages for Songs, Setlists, Shows, etc.

### Expected Behavior

**If user is not authenticated, they should NEVER see any protected page.**

Protected routes should:

1. Check auth state before rendering
2. Immediately redirect to `/login` or `/auth` if not authenticated
3. Show loading spinner while checking auth, never empty state

### Current Problem

The app appears to render protected components before auth state is fully determined, or continues rendering after auth becomes invalid.

---

## Issue 3: Stale Session Requires Browser Cache Clear

### Observed Behavior

After session issues occur, the app gets into a broken state that persists until:

- Clearing browser data/cache
- Re-logging in fresh

### Root Cause Hypothesis

- IndexedDB may contain stale session data
- localStorage may have outdated tokens
- React state not properly resetting on auth failure

### Expected Behavior

- Auth failure should cleanly reset all session-related state
- User should be able to log in again without clearing browser data
- No stale data should block re-authentication

---

## Technical Details

### Current Auth Flow (from code analysis)

**Supabase client config** (`src/services/supabase/client.ts`):

```typescript
auth: {
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
}
```

**Auth state subscription** (`src/contexts/AuthContext.tsx`):

```typescript
const unsubscribe = authService.onAuthStateChange(async newSession => {
  setSession(newSession)
  setUser(newSession?.user || null)
  SessionManager.saveSession(newSession)
  // ...
})
```

### Missing Handling

1. No specific handling for refresh token 400 errors
2. No forced redirect on auth failure
3. Protected route guards may not be comprehensive

---

## Proposed Solutions

### Solution 1: Auth Error Handler

Add global handler for Supabase auth errors:

```typescript
// Listen for auth errors, especially refresh failures
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED' && !session) {
    // Refresh failed
    handleSessionExpired()
  }
  if (event === 'SIGNED_OUT') {
    // Could be voluntary or forced
    redirectToLogin()
  }
})
```

### Solution 2: Protected Route Wrapper

Ensure ALL protected routes check auth:

```typescript
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) return <LoadingSpinner />
  if (!isAuthenticated) {
    redirect('/login')
    return null
  }

  return children
}
```

### Solution 3: Session Expiry UI

Instead of silently failing, show clear UI:

```typescript
if (refreshTokenError) {
  showToast({
    type: 'warning',
    message: 'Your session has expired. Please log in again.',
    action: { label: 'Log In', onClick: () => navigate('/login') },
  })
}
```

### Solution 4: Clean Session Reset

On auth failure, ensure complete cleanup:

```typescript
async function handleAuthFailure() {
  // Clear Supabase session
  await supabase.auth.signOut()

  // Clear local storage tokens
  localStorage.removeItem('supabase.auth.token')

  // Clear React state
  setSession(null)
  setUser(null)
  setBand(null)

  // Redirect to login
  navigate('/login')
}
```

---

## Files to Investigate/Modify

1. `src/contexts/AuthContext.tsx` - Main auth state management
2. `src/services/supabase/client.ts` - Supabase client config
3. `src/App.tsx` or router config - Protected route guards
4. `src/components/layout/ModernLayout.tsx` - May show "no band" state
5. `src/services/auth/SupabaseAuthService.ts` - Auth service implementation

---

## Testing Scenarios

1. **Multi-device logout**: Open app on 2 devices, use one for a while, check other
2. **Token expiry**: Set JWT expiry to 1 minute, wait, observe behavior
3. **Network disconnect**: Go offline, wait for token to expire, reconnect
4. **Manual token clear**: Clear localStorage while app is open

---

## Related Issues

- Session management across devices
- Offline-first architecture vs authentication state
- IndexedDB data persistence vs auth session

---

## Acceptance Criteria

- [ ] User is NEVER shown protected content without valid authentication
- [ ] Refresh token failures show user-friendly message
- [ ] User can re-login without clearing browser cache
- [ ] Multi-device use doesn't cause silent auth failures
- [ ] Session expiry redirects to login with clear message
