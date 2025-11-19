# Auth & Sync Diagnostic Guide

**Timestamp:** 2025-10-26T21:51
**Context:** Diagnosing why user sign-up isn't creating Supabase users and sync is failing

## Current Situation

### Symptoms
1. User created account and tried to log in
2. Seeing "No band selected" and "not logged in"
3. Console error: `POST http://127.0.0.1:54321/rest/v1/bands 401 (Unauthorized)`
4. Sync error: `new row violates row-level security policy for table "bands"`

### What We've Fixed
✅ **RLS Enabled**: All 15 tables now have RLS enabled (`rowsecurity = true`)
✅ **RLS Policies**: 20+ policies defined and working
✅ **Supabase Running**: All services healthy on local instance
✅ **Email Confirmation**: Disabled in config (`enable_confirmations = false`)

### What's Still Unclear
❓ **Is sign-up reaching Supabase?** - Auth logs show login attempts but no sign-ups
❓ **Which auth service is being used?** - Should be SupabaseAuthService but need to confirm
❓ **Are JWT tokens being sent?** - The 401 errors suggest no valid auth token

## Diagnostic Steps

### Step 1: Check App Mode Detection

Open browser console (http://localhost:5173) and look for these logs on page load:

```javascript
// Should see one of these:
"🚀 Rock On running in production mode"
"☁️  Using production mode (Dexie + Supabase sync)"
"☁️  Using SupabaseAuthService"

// NOT these:
"🚀 Rock On running in local mode"
"📦 Using local-only mode (Dexie + Mock Auth)"
"🔧 Using MockAuthService"
```

**If you see "local mode"**, the app isn't detecting Supabase credentials correctly.

### Step 2: Verify Environment Variables

In browser console, run:
```javascript
// Check what the app sees
console.log('VITE_MOCK_AUTH:', import.meta.env.VITE_MOCK_AUTH)
console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL)
console.log('VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY)
```

**Expected values:**
```javascript
VITE_MOCK_AUTH: "false"  // string, not boolean!
VITE_SUPABASE_URL: "http://127.0.0.1:54321"
VITE_SUPABASE_ANON_KEY: "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"
```

**Important**: Environment variables in Vite are **strings**, so `"false"` not `false`.

### Step 3: Test Sign-Up with Console Open

1. Open browser console
2. Clear console
3. Click "Sign Up"
4. Enter credentials:
   - Email: `test@example.com`
   - Password: `TestPassword123!`
   - Name: `Test User`
5. Watch console for logs

**Expected logs:**
```
POST http://127.0.0.1:54321/auth/v1/signup 200 OK
✅ User created: test@example.com
🔄 Syncing user to local DB...
```

**Possible errors:**
```
❌ POST http://127.0.0.1:54321/auth/v1/signup 400 Bad Request
  → Check: Email already exists?
  → Check: Password too weak?

❌ Error: Supabase client should only be used when Supabase auth is enabled
  → App is in local mode, not production mode
  → Check .env.local is correct

❌ POST http://127.0.0.1:54321/auth/v1/signup 422 Unprocessable Entity
  → Check: Supabase auth endpoint is correct
  → Check: API key is valid
```

### Step 4: Verify User Created in Supabase

After sign-up, check if user exists:

```bash
# Terminal
docker exec supabase_db_rock-on psql -U postgres -d postgres -c \
  "SELECT email, created_at, confirmed_at FROM auth.users ORDER BY created_at DESC LIMIT 5;"
```

**Expected**: Should see your email with `confirmed_at` timestamp (since confirmations are disabled)

**If empty**: Sign-up didn't reach Supabase

### Step 5: Check Auth Session

In browser console after sign-up/sign-in:

```javascript
// Check if session exists
const session = await supabase.auth.getSession()
console.log('Session:', session)

// Should see:
{
  data: {
    session: {
      access_token: "eyJ...",
      user: { email: "test@example.com", id: "..." }
    }
  }
}
```

**If session is null**: Authentication failed

### Step 6: Test Manual API Request

Try accessing bands table manually to test RLS:

```javascript
// In browser console (must be signed in)
const { data, error } = await supabase.from('bands').select('*')
console.log('Bands:', data, 'Error:', error)
```

**Expected outcomes:**
- **If authenticated**: `error: null`, `data: []` (empty array, no bands yet)
- **If not authenticated**: `error: { code: 'PGRST116', message: '...' }`
- **If RLS blocking**: `error: { code: '42501', message: 'row-level security...' }`

## Common Issues & Solutions

### Issue 1: App Using Mock Auth Despite .env.local

**Cause**: Vite didn't pick up .env changes

**Solution**:
```bash
# Kill all dev servers
pkill -f vite

# Start fresh
npm run dev
```

Then hard-refresh browser (Ctrl+Shift+R)

### Issue 2: Sign-Up Returns "Please check email"

**Cause**: Email confirmation enabled despite config

**Fix**: Already done (`enable_confirmations = false`)

**Alternative**: Check Mailpit at http://localhost:54324 for confirmation emails

### Issue 3: 401 Unauthorized on All Requests

**Cause**: Not signed in OR JWT token not being sent

**Solution**:
```javascript
// Check auth state
const { data: { user } } = await supabase.auth.getUser()
console.log('Current user:', user)

// If null, sign in again
const { error } = await supabase.auth.signInWithPassword({
  email: 'test@example.com',
  password: 'TestPassword123!'
})
console.log('Sign in error:', error)
```

### Issue 4: RLS Blocking Band Creation

**Cause**: RLS policy for INSERT might be too restrictive

**Check policy**:
```sql
-- Should allow any authenticated user to create bands
SELECT policyname, cmd, with_check
FROM pg_policies
WHERE tablename = 'bands' AND cmd = 'INSERT';
```

**Expected**: `bands_insert_any_authenticated` with `with_check = true`

## Quick Test Script

Run this in browser console to test everything:

```javascript
async function diagnoseAuth() {
  console.log('🔍 Diagnosing auth setup...')

  // 1. Check mode
  console.log('\n1️⃣ App Mode:')
  console.log('  VITE_MOCK_AUTH:', import.meta.env.VITE_MOCK_AUTH)
  console.log('  VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL)

  // 2. Check if supabase client exists
  console.log('\n2️⃣ Supabase Client:')
  console.log('  Exists:', typeof supabase !== 'undefined')

  if (typeof supabase === 'undefined') {
    console.log('❌ Supabase client not available - app in local mode')
    return
  }

  // 3. Check session
  console.log('\n3️⃣ Auth Session:')
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  console.log('  Signed in:', !!session)
  if (session) {
    console.log('  User:', session.user.email)
    console.log('  Token expires:', new Date(session.expires_at * 1000))
  }

  // 4. Test database access
  console.log('\n4️⃣ Database Access:')
  const { data: bands, error: bandsError } = await supabase.from('bands').select('*').limit(1)
  if (bandsError) {
    console.log('  ❌ Error:', bandsError.message, `(code: ${bandsError.code})`)
    if (bandsError.code === 'PGRST116') {
      console.log('  💡 This is normal if not signed in')
    }
  } else {
    console.log('  ✅ Access granted, bands found:', bands.length)
  }

  // 5. Check IndexedDB
  console.log('\n5️⃣ IndexedDB:')
  const userCount = await db.users.count()
  const bandCount = await db.bands.count()
  const songCount = await db.songs.count()
  console.log('  Users:', userCount)
  console.log('  Bands:', bandCount)
  console.log('  Songs:', songCount)

  console.log('\n✅ Diagnosis complete!')
}

// Run it
diagnoseAuth()
```

## Next Steps Based on Results

### If App in Local Mode
1. Verify `.env.local` has correct values
2. Restart dev server: `pkill -f vite && npm run dev`
3. Hard refresh browser

### If Sign-Up Not Creating Supabase User
1. Check browser Network tab during sign-up
2. Look for POST to `/auth/v1/signup`
3. Check response status and body
4. Check Supabase logs: `docker logs supabase_auth_rock-on --tail 50`

### If User Created But Can't Access Data
1. Verify user is signed in: `await supabase.auth.getUser()`
2. Check JWT token is valid: `session.access_token`
3. Test RLS policies manually (see Step 6 above)

### If Sync Failing
1. Ensure user is authenticated in Supabase (not just IndexedDB)
2. Check sync engine is using correct user ID
3. Verify band_memberships exist for user

## Files to Check

- `.env.local` - Environment variables
- `src/config/appMode.ts` - Mode detection logic
- `src/services/auth/AuthFactory.ts` - Which auth service is used
- `src/services/auth/SupabaseAuthService.ts` - Supabase auth implementation
- `src/services/supabase/client.ts` - Supabase client config
- `supabase/config.toml` - Supabase local config

## Useful Commands

```bash
# Check Supabase status
supabase status

# View Supabase logs
docker logs supabase_auth_rock-on --tail 50
docker logs supabase_rest_rock-on --tail 50

# Check auth users
docker exec supabase_db_rock-on psql -U postgres -d postgres -c \
  "SELECT email, created_at FROM auth.users;"

# Reset Supabase (nuclear option)
supabase db reset

# Restart dev server
pkill -f vite && npm run dev
```

---

**Run the diagnostic script in browser console and share the output!**
