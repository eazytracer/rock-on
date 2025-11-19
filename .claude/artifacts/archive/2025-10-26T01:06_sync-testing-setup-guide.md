---
timestamp: 2025-10-26T01:06
topic: Complete Setup Guide - Dev Users + Sync Testing
---

# Complete Setup Guide: Dev Users + Sync Testing

## Summary of Changes Made

1. ✅ **Fixed hooks** - `src/hooks/useSongs.ts` now uses SyncRepository
2. ✅ **Created seed script** - `supabase/seed-dev-users.sql` to create test data
3. 📋 **Need to complete** - Auth setup steps below

## Step-by-Step Setup

### Step 1: Create Auth Users in Supabase

1. **Go to Supabase Dashboard**:
   - Open your project at https://supabase.com/dashboard
   - Navigate to **Authentication** > **Users**

2. **Create three test users**:

   **User 1 - Eric:**
   - Click "Add User" > "Create new user"
   - Email: `eric@ipodshuffle.com`
   - Password: `test123` (or your preferred password)
   - Auto Confirm User: ✅ YES
   - Click "Create user"
   - **COPY THE USER ID** (UUID) - you'll need it!

   **User 2 - Mike:**
   - Click "Add User" > "Create new user"
   - Email: `mike@ipodshuffle.com`
   - Password: `test123`
   - Auto Confirm User: ✅ YES
   - Click "Create user"
   - **COPY THE USER ID** (UUID)

   **User 3 - Sarah:**
   - Click "Add User" > "Create new user"
   - Email: `sarah@ipodshuffle.com`
   - Password: `test123`
   - Auto Confirm User: ✅ YES
   - Click "Create user"
   - **COPY THE USER ID** (UUID)

3. **Save the UUIDs somewhere** - you need them for the next step!

   Example format:
   ```
   Eric:  a1b2c3d4-1234-5678-90ab-cdef12345678
   Mike:  b2c3d4e5-2345-6789-01bc-def123456789
   Sarah: c3d4e5f6-3456-7890-12cd-ef1234567890
   ```

### Step 2: Update and Run the Seed Script

1. **Open** `supabase/seed-dev-users.sql`

2. **Replace the placeholder UUIDs** (lines 11-13) with your actual UUIDs from Step 1:

   ```sql
   eric_id UUID := 'YOUR-ERIC-UUID-HERE'::uuid;
   mike_id UUID := 'YOUR-MIKE-UUID-HERE'::uuid;
   sarah_id UUID := 'YOUR-SARAH-UUID-HERE'::uuid;
   ```

3. **Run the script** in Supabase SQL Editor:
   - Go to **SQL Editor** in Supabase Dashboard
   - Click "New query"
   - Paste the entire contents of `seed-dev-users.sql`
   - Click "Run"

4. **Check the output** - you should see:
   ```
   NOTICE: Users created: Eric (...), Mike (...), Sarah (...)
   NOTICE: Band created: iPod Shuffle (...)
   NOTICE: Band memberships created for all 3 users
   NOTICE: ========================================
   NOTICE: SETUP COMPLETE!
   NOTICE: ========================================
   NOTICE: Band ID: <some-uuid>
   ```

5. **SAVE THE BAND ID** from the output!

### Step 3: Verify the Seed Data

Run this query in SQL Editor to verify:

```sql
SELECT
  u.id,
  u.email,
  u.display_name,
  b.name as band_name,
  bm.role
FROM public.users u
JOIN public.band_memberships bm ON bm.user_id = u.id
JOIN public.bands b ON b.id = bm.band_id
WHERE u.email LIKE '%ipodshuffle.com'
ORDER BY u.email;
```

**Expected output:** 3 rows showing Eric, Mike, Sarah all in "iPod Shuffle" band.

### Step 4: Update Your App's Auth Code

You need to modify the mock user login to actually authenticate with Supabase.

**Open** `src/pages/NewLayout/AuthPages.tsx`

**Find** the `handleMockUserLogin` function (around line 556)

**Replace it with:**

```typescript
const handleMockUserLogin = async (mockEmail: string) => {
  setEmail(mockEmail)
  setErrors({})
  setLoading(true)

  try {
    // Import supabase at the top of the file if not already:
    // import { supabase } from '../../services/supabase/supabaseClient'

    // Authenticate with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email: mockEmail,
      password: 'test123'  // Use the password you set in Step 1
    })

    if (error) throw error
    if (!data.user) throw new Error('No user returned from auth')

    // Store user ID
    localStorage.setItem('currentUserId', data.user.id)

    // Find user's band memberships
    const memberships = await db.bandMemberships
      .where('userId')
      .equals(data.user.id)
      .toArray()

    if (memberships.length > 0) {
      localStorage.setItem('currentBandId', memberships[0].bandId)
      navigate('/songs')
    } else {
      navigate('/create-band')
    }
  } catch (err) {
    console.error('Mock login error:', err)
    setErrors({ submit: 'Login failed. Check console for details.' })
  } finally {
    setLoading(false)
  }
}
```

### Step 5: Test the Auth Flow

1. **Start your dev server** (if not already running):
   ```bash
   npm run dev
   ```

2. **Open the app** in your browser

3. **Click "Show Mock Users for Testing"**

4. **Click one of the mock users** (Eric, Mike, or Sarah)

5. **Check browser console** - you should see:
   - No auth errors
   - User ID logged

6. **Open browser DevTools** > Application > Local Storage:
   - `currentUserId` should match one of your Supabase Auth user UUIDs
   - `currentBandId` should match the band ID from Step 2

### Step 6: Test Sync

Now the moment of truth - test if sync works!

1. **Navigate to Songs page**

2. **Open browser console**

3. **Check initial sync queue**:
   ```javascript
   window.debugSync()
   ```
   Should show: Pending: 0, Syncing: 0, Failed: 0

4. **Create a test song**:
   - Click "Add Song"
   - Fill in: Title: "Test Song", Artist: "Test Artist", Key: "C"
   - Click "Create Song"

5. **Check sync queue again**:
   ```javascript
   window.debugSync()
   ```
   Should show activity! Either:
   - Pending: 1 (queued, waiting to sync)
   - OR Syncing: 1 (currently syncing)
   - OR Pending: 0 (already synced!)

6. **Verify in Supabase**:
   - Go to Supabase Dashboard > Table Editor
   - Open `songs` table
   - **You should see your test song!** 🎉

7. **Check browser console** for sync logs:
   ```
   [Sync] Queued create for songs: <song-id>
   [Sync] Starting sync...
   [Sync] Synced 1 items
   ```

## Troubleshooting

### Issue: "Auth session is null"

**Problem:** Not authenticated with Supabase
**Solution:** Make sure you updated `handleMockUserLogin` in Step 4

### Issue: "Row violates RLS policy"

**Problem:** User not in `public.users` table OR not authenticated
**Solution:**
1. Verify user exists: `SELECT * FROM public.users WHERE id = '<your-user-id>'`
2. Check auth: `SELECT auth.uid()` in SQL Editor (should return your user ID)

### Issue: "Sync queue empty but no data in Supabase"

**Problem:** Hooks might still be using old code
**Solution:**
1. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. Clear IndexedDB: DevTools > Application > Storage > Clear site data
3. Restart dev server

### Issue: "Function not found: getSyncRepository"

**Problem:** Import path issue
**Solution:** Check that `src/hooks/useSongs.ts` has:
```typescript
import { getSyncRepository } from '../services/data/SyncRepository'
```

## Success Criteria ✅

You'll know it's working when:

1. ✅ Mock login works without errors
2. ✅ `currentUserId` in localStorage matches Supabase Auth user ID
3. ✅ Creating a song adds it to sync queue (`window.debugSync()` shows activity)
4. ✅ Song appears in Supabase `songs` table
5. ✅ Console shows sync logs

## Next Steps After Success

Once sync is working:

1. **Test update**: Edit a song, verify it syncs
2. **Test delete**: Delete a song, verify it syncs
3. **Test offline**: Disconnect network, create song, reconnect, verify it syncs
4. **Test with other entities**: Bands, setlists, practice sessions

## Files Modified

1. ✅ `src/hooks/useSongs.ts` - Now uses SyncRepository
2. ✅ `supabase/seed-dev-users.sql` - Seeds test users and band
3. 📝 `src/pages/NewLayout/AuthPages.tsx` - Need to update `handleMockUserLogin` (Step 4)

## Important Notes

- **Service Role Key**: Never expose this in client code! Only use it server-side if needed.
- **Test Passwords**: Using `test123` for all test users - fine for dev, change for production.
- **RLS Policies**: Now properly configured and verified. Users can only access their own data.
- **Sync Queue**: Lives in IndexedDB `syncQueue` table. Use `window.debugSync()` to inspect.

## Questions?

If something doesn't work:
1. Check browser console for errors
2. Check Supabase logs (Dashboard > Logs)
3. Verify RLS policies are still correct (run `query2-band-memberships-details.sql`)
4. Check that auth session exists: `supabase.auth.getSession()` in console
