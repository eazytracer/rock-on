# Proper Multi-User Offline-First Architecture

## The Problem (What You're Experiencing)

**Symptom:** User B logs in and sees User A's band data.

**Root Cause:** NOT that we need to delete data, but that:
1. UI queries aren't properly scoped to `currentUserId`
2. Session state isn't being cleared on logout
3. React state is stale when switching users

## The Correct Architecture

### Multi-User Offline Support Design

```
IndexedDB (Shared)
├── User A's data (user_id: aaa)
│   ├── bands (where created_by = aaa OR has membership)
│   ├── band_memberships (where user_id = aaa)
│   ├── songs (where band_id IN user's bands)
│   └── ...
├── User B's data (user_id: bbb)
│   ├── bands (where created_by = bbb OR has membership)
│   ├── band_memberships (where user_id = bbb)
│   └── ...
└── Shared data
    ├── users (all users in any band)
    └── user_profiles
```

**Key Principle:** Data coexists, but queries filter by current user's ID.

### How It Should Work

**Scenario 1: Online Device**
1. User A logs in → `currentUserId = aaa`
2. Sync pulls User A's bands from Supabase
3. UI queries: `WHERE userId = aaa`
4. User A logs out → Clear `currentUserId`, clear React state
5. User B logs in → `currentUserId = bbb`
6. Sync pulls User B's bands from Supabase
7. UI queries: `WHERE userId = bbb` (sees only their data)

**Scenario 2: Offline Device (Mobile)**
1. Device has both users' data cached
2. User A logs in (cached credentials) → `currentUserId = aaa`
3. UI shows User A's cached bands
4. User A logs out
5. User B logs in → `currentUserId = bbb`
6. UI shows User B's cached bands
7. Both users can work offline!

## What's Currently Broken

### Issue 1: `localStorage.getItem('currentBandId')` persists across users

```typescript
// Line 402 in AuthContext.tsx
localStorage.setItem('currentBandId', firstBand.id)
```

Problem: When User B logs in, they might load User A's `currentBandId` from localStorage!

**Fix:** Namespace by user ID or clear on logout:
```typescript
// Option A: Namespace
localStorage.setItem(`currentBandId_${userId}`, bandId)

// Option B: Clear on logout (simpler)
localStorage.removeItem('currentBandId')
```

### Issue 2: React state not cleared on user switch

When User B logs in, React state still has User A's data until `loadUserData` completes.

**Fix:** Clear state immediately on logout:
```typescript
const logout = () => {
  // Clear state FIRST
  setCurrentUser(null)
  setCurrentBand(null)
  setCurrentBandId(null)
  setUserBands([])

  // Then clear storage
  localStorage.removeItem('currentUserId')
  localStorage.removeItem('currentBandId')
}
```

### Issue 3: Auth callback doesn't wait for state to clear

When redirecting after OAuth, old state might still be in memory.

**Fix:** Already handled by `waitForAuthState()` in AuthCallback, but need to ensure it waits for **the correct user**.

## The Proper Fix (DO THIS)

### Step 1: Fix `logout()` to clear session state only

```typescript
const logout = () => {
  console.log('🧹 Clearing session state...')

  // Disconnect real-time sync
  if (realtimeManagerRef.current) {
    realtimeManagerRef.current.unsubscribeAll()
    realtimeManagerRef.current = null
  }

  // Clear React state (session context)
  setCurrentUser(null)
  setCurrentUserProfile(null)
  setCurrentBand(null)
  setCurrentBandId(null)
  setCurrentUserRole(null)
  setUserBands([])
  setSession(null)
  setUser(null)

  // Clear localStorage (session identifiers)
  localStorage.removeItem('currentUserId')
  localStorage.removeItem('currentBandId')

  // Clear Supabase session from storage
  const keys = Object.keys(localStorage)
  keys.forEach(key => {
    if (key.startsWith('sb-')) {
      localStorage.removeItem(key)
    }
  })

  // DO NOT clear IndexedDB - keep offline data!
  console.log('✅ Session cleared (offline data preserved)')
}
```

### Step 2: Ensure queries are properly scoped

All IndexedDB queries MUST filter by current user:

```typescript
// ✅ CORRECT
const bands = await db.bandMemberships
  .where('userId')
  .equals(currentUserId) // Filter by current user!
  .toArray()

// ❌ WRONG
const bands = await db.bands.toArray() // Gets ALL bands!
```

### Step 3: Add user isolation to hooks

Example: `useBands` hook

```typescript
export function useBands() {
  const { currentUser } = useAuth()

  const { data: bands } = useLiveQuery(async () => {
    if (!currentUser?.id) return []

    // Only get bands for current user
    const memberships = await db.bandMemberships
      .where('userId')
      .equals(currentUser.id)
      .toArray()

    // ... rest of logic
  }, [currentUser?.id]) // Re-run when user changes

  return { bands }
}
```

### Step 4: Verify ProtectedRoute checks user

```typescript
<ProtectedRoute>
  {currentUser ? (
    <Component />
  ) : (
    <Navigate to="/auth" />
  )}
</ProtectedRoute>
```

## When to Clear IndexedDB (Rare Cases)

**Only clear IndexedDB when:**
1. User explicitly clicks "Clear offline data"
2. Debugging/development (manual action)
3. Uninstalling app (browser clears automatically)
4. Storage quota exceeded (selective cleanup)

**Never automatically clear on logout!**

## Testing the Fix

### Test Case 1: Same Device, Multiple Users

1. User A logs in
2. Create band "Test A"
3. Log out
4. **Verify:** `currentUserId` cleared from localStorage
5. User B logs in
6. **Verify:** UI shows empty (no bands) or prompts create/join
7. Create band "Test B"
8. Log out
9. User A logs back in
10. **Verify:** Sees "Test A", NOT "Test B"

### Test Case 2: Offline Multi-User

1. Online: User A logs in, syncs data
2. Online: User B logs in, syncs data
3. **Go offline** (disable network)
4. Log out, log in as User A
5. **Verify:** Can see User A's cached bands
6. Log out, log in as User B
7. **Verify:** Can see User B's cached bands
8. **Go online**
9. Sync should work for both users

## Security Implications

**Q: Isn't it insecure to keep other users' data in IndexedDB?**

**A:** No, because:
1. IndexedDB is per-origin (can't access from other sites)
2. Device is assumed to be trusted (like a phone)
3. Same as how phone apps cache data for multiple users
4. Queries filter by user ID (data isolation)

**Q: What if device is stolen?**

**A:**
- User must be logged in to see data
- Add device PIN/biometric lock (OS level)
- Add app-level PIN (future feature)
- Remote wipe capability (future feature)

**Q: What about shared/public devices?**

**A:**
- Add "Incognito mode" that doesn't cache data
- Add "Clear all data" button in settings
- Show warning on public device
- Auto-logout after inactivity (future feature)

## Implementation Checklist

- [ ] Update `logout()` to clear session only (not IndexedDB)
- [ ] Add `localStorage.removeItem('currentBandId')` to logout
- [ ] Clear Supabase session keys (sb-*) on logout
- [ ] Verify all hooks filter by `currentUserId`
- [ ] Test multi-user switching (online)
- [ ] Test multi-user switching (offline)
- [ ] Add "Clear offline data" button in settings
- [ ] Document offline multi-user support in docs

## Future Enhancements

1. **User profiles in IndexedDB**: Store which users have logged in on this device
2. **Quick switch UI**: Show list of recent users for fast switching
3. **Storage usage**: Show how much space each user's data takes
4. **Selective cleanup**: "Delete User A's offline data" button
5. **Data encryption**: Encrypt IndexedDB with user's password (advanced)
