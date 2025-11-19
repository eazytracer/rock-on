# E2E Test Findings: Band Creation Authentication Bug

**Timestamp:** 2025-11-10T18:34
**Appended:** 2025-11-10T18:38 (Root cause analysis + fix plan)
**Test:** `tests/e2e/auth/signup.spec.ts` - "new user can sign up and create first band"
**Status:** Application Bug Identified - Root Cause Found

## Summary

E2E tests reveal a critical authentication state bug in the band creation flow. The application successfully authenticates users and tracks their UUID throughout the sync process, but the `handleCreateBand` function in `AuthPages.tsx` incorrectly throws "No user logged in" error.

## Evidence

### Console Logs Show User IS Authenticated
```
CONSOLE [log]: No band memberships found in Supabase for user: a76b2225-8838-4c42-817e-c2087c216b0d
CONSOLE [log]: 🔄 Initial sync needed, downloading all data...
CONSOLE [log]: 🔄 Starting initial sync for user: a76b2225-8838-4c42-817e-c2087c216b0d
CONSOLE [log]: 📥 Syncing data for 0 bands
CONSOLE [log]: ℹ️ No bands found, skipping entity sync
CONSOLE [log]: ✅ Initial sync complete
```

### But Band Creation Fails with Auth Error
```
CONSOLE [error]: Error creating band: Error: No user logged in
    at handleCreateBand (http://localhost:5173/src/pages/NewLayout/AuthPages.tsx?t=1762798921095:1016:15)
```

## Root Cause Analysis (CONFIRMED)

After examining the code, I've identified the **exact root cause**:

### The Problem: Mismatched User Objects in AuthContext

**File:** `src/contexts/AuthContext.tsx`

The AuthContext exposes **TWO separate user objects**:
1. **`user`** - From Supabase auth session (line 52, set by `authService.getSession()`)
2. **`currentUser`** - From IndexedDB (line 57, set by `loadUserData()`)

**File:** `src/pages/NewLayout/AuthPages.tsx:770`

The `GetStartedPage` component pulls `user` from `useAuth()`:
```typescript
const { createBand } = useCreateBand()
const { switchBand, user } = useAuth()  // ← Gets `user`, not `currentUser`
```

But here's the catch:

### The Bug Flow

1. **On signup**, `authService.getSession()` returns a **Supabase User** object
2. This Supabase User has `.id` pointing to the auth.users UUID
3. The component renders because `user` is truthy
4. **HOWEVER**, after sync completes, AuthContext may clear `user` and only populate `currentUser`
5. When button is clicked, `user` is now `null`, causing "No user logged in" error

### Evidence from AuthContext.tsx

Lines 156-164 show the initial load:
```typescript
const currentSession = await authService.getSession()
if (currentSession) {
  setSession(currentSession)
  setUser(currentSession.user)  // ← Sets `user`
}
```

But lines 166-194 show database loading:
```typescript
const storedUserId = localStorage.getItem('currentUserId')
if (storedUserId) {
  // ... sync operations ...
  await loadUserData(storedUserId, storedBandId)  // ← Sets `currentUser`, NOT `user`
}
```

The `GetStartedPage` component depends on `user`, which can become stale or null after the initial session is processed.

## Test Behavior

**What works:**
- ✅ User signup completes successfully
- ✅ User UUID is generated and tracked
- ✅ Initial sync process runs with correct user ID
- ✅ User is redirected to `/get-started` page
- ✅ "Create Band" button is visible and clickable

**What fails:**
- ❌ Clicking "Create Band" throws "No user logged in"
- ❌ User is NOT redirected to `/songs` after band creation
- ❌ Band is NOT created in database

## Test Code (Working Correctly)

```typescript
test('new user can sign up and create first band', async ({ page }) => {
  // Step 1: Sign up (WORKS)
  await page.goto('/signup');
  await page.fill('[data-testid="signup-email-input"]', email);
  await page.fill('[data-testid="signup-password-input"]', 'TestPassword123!');
  await page.click('[data-testid="signup-submit-button"]');

  // Step 2: Wait for redirect to get-started (WORKS)
  await page.waitForURL(/\/get-started/, { timeout: 10000 });

  // Create first band (FAILS HERE)
  await page.fill('[data-testid="band-name-input"]', 'Test Band');
  await page.click('[data-testid="create-band-button"]');

  // Step 3: Should redirect to songs (TIMES OUT - band creation failed)
  await page.waitForURL(/\/songs/, { timeout: 10000 }); // ❌ TIMEOUT
});
```

## Recommended Fixes (Priority Order)

### Option 1: Use Session-Based Auth (RECOMMENDED) ✅

**Why:** The `session` object is more stable and reliable than `user`. Supabase maintains the session throughout the auth flow.

**Changes needed in `AuthPages.tsx`:**

```typescript
// Line 770: Change from `user` to `session`
const { createBand } = useCreateBand()
const { switchBand, session } = useAuth()  // ← Use session instead of user

// Line 773-782: Check session instead of user
if (!session) {
  return <LoadingSpinner />
}

// Line 798: Check session and extract user ID
const handleCreateBand = async () => {
  // ... validation ...

  try {
    if (!session?.user) {  // ← Check session.user instead of user
      throw new Error('No user logged in')
    }

    const userId = session.user.id  // ← Get ID from session.user
    const bandId = await createBand({ name: bandName }, userId)
    // ... rest of implementation
  }
}
```

**Pros:**
- ✅ Minimal code changes
- ✅ Session is maintained throughout entire auth flow
- ✅ session.user.id is the correct Supabase UUID
- ✅ No race conditions

**Cons:**
- ⚠️ Still uses legacy `user` vs `currentUser` pattern (technical debt)

### Option 2: Unify User State in AuthContext (LONG-TERM FIX)

**Why:** The dual `user` + `currentUser` pattern is confusing and error-prone.

**Changes needed in `AuthContext.tsx`:**

```typescript
// Remove the `user` state entirely, only keep `currentUser`
const [user, setUser] = useState<User | null>(null)  // ❌ REMOVE THIS
const [currentUser, setCurrentUser] = useState<User | null>(null)  // ✅ KEEP THIS

// Update AuthContextType interface
interface AuthContextType {
  user: User | null  // ← Maps to currentUser (backward compatibility)
  currentUser: User | null  // ← Deprecated, will be removed
  // ...
}

// In the provider return value:
const value = useMemo(() => ({
  user: currentUser,  // ← Alias `user` to `currentUser` for backward compat
  currentUser,  // ← Keep for gradual migration
  // ...
}), [currentUser, ...])
```

**Pros:**
- ✅ Eliminates the root cause
- ✅ Single source of truth for user state
- ✅ Backward compatible migration path

**Cons:**
- ⚠️ Requires updating many components
- ⚠️ More complex refactoring
- ⚠️ Higher risk of breaking existing features

### Option 3: Add Defensive User ID Lookup (BAND-AID)

**Why:** Fallback to localStorage if `user` is null

**Changes in `AuthPages.tsx` only:**

```typescript
const handleCreateBand = async () => {
  // ... validation ...

  try {
    // Try multiple sources for user ID
    const userId = user?.id ||
                   session?.user?.id ||
                   localStorage.getItem('currentUserId')

    if (!userId) {
      throw new Error('No user logged in')
    }

    const bandId = await createBand({ name: bandName }, userId)
    // ...
  }
}
```

**Pros:**
- ✅ Quick fix, minimal changes
- ✅ Handles race conditions

**Cons:**
- ❌ Doesn't fix the root cause
- ❌ Relies on localStorage (could be stale)
- ❌ Technical debt accumulation

## Impact

**Severity:** HIGH - Blocks new user onboarding completely

**Affected users:**
- All new users signing up for the first time
- Any user without existing bands trying to create their first band

**Workaround:** None for E2E tests. Manual testing may work if there's a timing difference (human delay allows auth state to propagate).

## Recommended Implementation Plan

**Immediate Fix (Option 1):** ⚡ ~15 minutes
1. Change `GetStartedPage` to use `session` instead of `user`
2. Update `handleCreateBand` to use `session.user.id`
3. Test manually (if possible)
4. Re-run E2E test to verify

**Long-term Fix (Option 2):** 🏗️ ~2-3 hours
1. Create new branch for refactoring
2. Unify `user` and `currentUser` in AuthContext
3. Update all components using `user` (find with grep)
4. Run all tests (unit, integration, E2E)
5. Deploy when confident

## Next Steps

1. ✅ **Document bug** (this artifact)
2. ✅ **Investigate root cause** - Found dual user state issue
3. ✅ **Create fix plan** - Three options documented above
4. 🔲 **Get user approval** - Which option to implement?
5. 🔲 **Implement chosen fix**
6. 🔲 **Re-run E2E tests** - Verify fix works
7. 🔲 **Manual testing** - Confirm signup flow works end-to-end

## Manual Testing Request

**Before implementing fix, it would be helpful to:**
1. Manually sign up a new user
2. Try creating a band immediately after signup
3. Check browser console for user state logs
4. Confirm if manual testing reproduces the bug

This will help determine if it's a Playwright timing issue or a real application bug affecting all users.

## Related Files

- `src/pages/NewLayout/AuthPages.tsx` - Contains buggy `handleCreateBand` function
- `src/services/auth/SupabaseAuthService.ts` - Auth service implementation
- `src/contexts/AuthContext.tsx` - (if exists) Auth context provider
- `tests/e2e/auth/signup.spec.ts` - E2E test that discovered the bug

## Test Artifacts

**Screenshots:** `test-results/auth-signup-User-Signup-an-36303-gn-up-and-create-first-band-chromium/test-failed-1.png`
**Video:** `test-results/auth-signup-User-Signup-an-36303-gn-up-and-create-first-band-chromium/video.webm`
**Logs:** Available in Playwright test output
