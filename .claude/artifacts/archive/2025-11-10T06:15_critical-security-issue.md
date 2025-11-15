# 🚨 CRITICAL SECURITY VULNERABILITY: Data Leakage Between Users

## The Problem

**IndexedDB is NOT cleared on logout**, causing data to leak between different user accounts on the same browser!

### What's Happening

1. **User A** logs in with `user-a@gmail.com`
2. User A creates band "Tommy 2 Tone"
3. Band stored in browser's IndexedDB
4. **User A logs out** → ❌ IndexedDB **NOT cleared**
5. **User B** logs in with `user-b@gmail.com`
6. **User B sees User A's band** "Tommy 2 Tone"!

### Security Impact

**SEVERITY: CRITICAL (P0)**

- ❌ **Data Leakage**: Users can see other users' private data
- ❌ **Privacy Violation**: Band names, songs, setlists, members exposed
- ❌ **Authorization Bypass**: Wrong user has access to wrong data
- ❌ **Identity Confusion**: UI shows mixed user identities
- ❌ **GDPR/Privacy Violation**: User data not properly isolated

### Affected Data Tables

ALL IndexedDB tables leak between users:
- `bands` - Band information
- `band_memberships` - Who's in which band
- `songs` - Song library
- `setlists` - Setlist data
- `practice_sessions` - Practice history
- `shows` - Show information
- `users` - User profiles
- `user_profiles` - User details
- `invite_codes` - Invite codes

## Root Cause Analysis

### File: `src/contexts/AuthContext.tsx:496-520`

```typescript
const logout = () => {
  console.log('🧹 Clearing local auth state...')

  // Disconnect real-time sync
  if (realtimeManagerRef.current) {
    realtimeManagerRef.current.unsubscribeAll()
  }

  // Clear localStorage
  localStorage.removeItem('currentUserId')
  localStorage.removeItem('currentBandId')

  // Clear React state
  setCurrentUser(null)
  setCurrentBand(null)
  // ... etc

  // ❌ MISSING: NO IndexedDB CLEAR!
}
```

**What's missing:**
```typescript
// Should have:
await db.delete()  // Clear ALL IndexedDB data
```

## Immediate Action Required

### Emergency Workaround (For Users)

**Clear browser data manually after EVERY logout:**

1. Open DevTools (F12)
2. Go to **Application** tab
3. Under **Storage**, select **Clear site data**
4. Check ALL boxes (cookies, storage, cache)
5. Click **Clear site data**

OR use browser settings:
- Chrome: Settings → Privacy → Clear browsing data
- Check "Cookies and site data"
- Time range: "All time"

### Permanent Fix (Code Change Needed)

Modify `src/contexts/AuthContext.tsx`:

```typescript
const logout = async () => {  // Make it async!
  console.log('🧹 Clearing local auth state...')

  // Disconnect real-time sync
  if (realtimeManagerRef.current) {
    realtimeManagerRef.current.unsubscribeAll()
    realtimeManagerRef.current = null
    setRealtimeManagerReady(false)
  }

  // ✅ CRITICAL: Clear ALL IndexedDB data
  try {
    console.log('🗑️  Clearing IndexedDB...')
    await db.delete()
    console.log('✅ IndexedDB cleared')
  } catch (error) {
    console.error('Failed to clear IndexedDB:', error)
  }

  // Clear localStorage
  localStorage.removeItem('currentUserId')
  localStorage.removeItem('currentBandId')

  // Clear session storage
  sessionStorage.clear()

  // Clear React state
  setCurrentUser(null)
  setCurrentUserProfile(null)
  setCurrentBand(null)
  setCurrentBandId(null)
  setCurrentUserRole(null)
  setUserBands([])

  console.log('✅ All local data cleared')
}
```

Also update `signOut()` to await the async logout:

```typescript
const signOut = async () => {
  setLoading(true)
  try {
    await authService.signOut()
    await logout()  // ✅ Await it!
  } catch (error) {
    await logout()  // ✅ Await it!
  } finally {
    setLoading(false)
  }
}
```

## Testing the Fix

After applying the fix:

1. **User A** logs in
2. Create a band "Test Band A"
3. Log out
4. **Open DevTools** → Application → IndexedDB
5. ✅ `rock-on-db` should be **deleted/empty**
6. **User B** logs in
7. ✅ Should NOT see "Test Band A"
8. ✅ Should be prompted to create/join band

## Additional Security Measures Needed

1. **Server-Side Validation**: Always verify band membership on server
2. **RLS Policies**: Ensure Supabase enforces data isolation
3. **Session Validation**: Check user ID matches on every request
4. **Data Scoping**: Never trust client-side band/user filtering

## Production Impact

**DO NOT DEPLOY TO PRODUCTION** until this is fixed!

If already in production:
1. Deploy fix immediately
2. Force all users to log out
3. Consider notifying users of potential data exposure
4. Audit logs for cross-user data access

## Related Issues

- [ ] RLS policy blocking band creation (separate issue)
- [ ] Mixed user identities in UI
- [ ] Sync queue containing other users' data
- [ ] Asset 404 errors (unrelated, caching issue)
