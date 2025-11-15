# Diagnose "User Bubble" Sync Issue

## What Happened

Your band "Tommy 2 Tone" exists in IndexedDB but NOT in Supabase because:
1. Band was created locally ✅
2. Sync to Supabase failed with 403 RLS error ❌
3. After 3 retries, marked as "failed" in sync queue
4. Band visible in app but isolated to your browser only

## Quick Diagnosis

### Option 1: Check Sync Queue in Browser DevTools

1. Open browser DevTools (F12)
2. Go to **Application** tab → **IndexedDB** → **rock-on-db** → **syncQueue**
3. Look for items with `status: 'failed'`
4. Check the `lastError` field for the RLS policy error

### Option 2: Check in Supabase Studio

1. Go to https://supabase.com/dashboard
2. Open your project: khzeuxxhigqcmrytsfux
3. Go to **Table Editor** → **bands**
4. Search for "Tommy 2 Tone" (won't find it)
5. Check **band_memberships** table (also won't find your user)

### Option 3: Use App's Dev Dashboard

If your app has a dev/debug page:
1. Look for "Sync Queue Viewer" or similar
2. Check for failed sync operations
3. View error messages

## The Fix (Two Parts)

### Part 1: Deploy RLS Policy Fix (CRITICAL)

**Without this, all future band creations will fail!**

```bash
# Option A: Using Supabase CLI
supabase link --project-ref khzeuxxhigqcmrytsfux
supabase db push

# Option B: Manual SQL in Supabase Studio
# Run this in SQL Editor:
DROP POLICY IF EXISTS "bands_insert_any_authenticated" ON public.bands;
CREATE POLICY "bands_insert_any_authenticated"
  ON public.bands FOR INSERT TO authenticated
  WITH CHECK (true);
```

### Part 2: Retry Failed Sync

After deploying the RLS fix, you have two options:

#### Option A: Trigger Retry (Easiest)
1. Stay logged in with the account that created "Tommy 2 Tone"
2. The sync engine should automatically retry failed items
3. Watch browser console for: `✅ Bands synced successfully`
4. Check Supabase Studio to confirm band appears

#### Option B: Clear and Recreate (Clean Slate)
1. Clear browser IndexedDB (DevTools → Application → Clear storage)
2. Log out and log back in
3. Create band again (will work now that RLS is fixed)

## Verification Steps

After applying fix:

1. **Check Supabase**:
   - Go to Table Editor → bands
   - Should see "Tommy 2 Tone" with your user_id

2. **Check Band Memberships**:
   - Go to Table Editor → band_memberships
   - Should see entry with:
     - user_id: 62e61358-6d7d-4b48-a367-481196b7d678
     - band_id: (the band's UUID)
     - role: admin

3. **Test Multi-Device**:
   - Log in from different browser/device
   - Should see "Tommy 2 Tone" band

## Why This Matters

The "user bubble" problem means:
- ❌ Band members can't see each other's data
- ❌ Can't collaborate in real-time
- ❌ Data lost on browser clear
- ❌ No cross-device sync

This is why we need Supabase sync working correctly!

## Account Confusion Note

You mentioned seeing "eric@ipodshuffle.com" in navbar but Gmail in band members.
This suggests:
- Multiple login attempts with different accounts
- Mixed IndexedDB data from different sessions
- Recommend: Clear IndexedDB and start fresh after RLS fix

## Next Steps

1. ✅ Deploy RLS fix (supabase db push)
2. ✅ Clear browser data OR wait for auto-retry
3. ✅ Verify band appears in Supabase
4. ✅ Test creating new band (should sync immediately)
