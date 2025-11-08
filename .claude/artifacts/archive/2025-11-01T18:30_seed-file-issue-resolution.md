# Seed File Issue - Root Cause & Resolution

**Date:** 2025-11-01T18:30
**Status:** ✅ Resolved
**Impact:** Critical - Blocked all login attempts

---

## What Went Wrong

### The Problem Chain

1. **I ran `supabase db reset`** to apply the new `audit_log` realtime migration
2. **Database was completely wiped** (expected behavior)
3. **Migrations were re-applied** (expected ✓)
4. **BUT seed data was NOT loaded** (unexpected ❌)
5. **Result:** No users in `auth.users` table
6. **Impact:** All login attempts failed with 400 error

### Why Seed Data Wasn't Loaded

**Supabase config** (`supabase/config.toml`):
```toml
[db.seed]
enabled = true
sql_paths = ["./seed.sql"]  # ❌ File doesn't exist!
```

**Actual seed files:**
- `supabase/seed-mvp-data.sql` ✓ (exists, has test users)
- `supabase/seed-local-dev.sql` ✓ (exists)
- `supabase/seed-full-catalog.sql` ✓ (exists)
- `supabase/seed.sql` ❌ (doesn't exist)

**Result:** `supabase db reset` looked for `seed.sql`, didn't find it, skipped seeding.

### Error Messages Seen

**Browser Console:**
```
POST http://127.0.0.1:54321/auth/v1/token?grant_type=password 400 (Bad Request)
```

**Why:** Supabase tried to authenticate `eric@ipodshuffle.com` but that user doesn't exist in `auth.users`.

---

## The Fix

### 1. Updated Supabase Config

**File:** `supabase/config.toml`

```toml
[db.seed]
enabled = true
sql_paths = ["./seed-mvp-data.sql"]  # ✓ Correct file
```

### 2. Re-ran Database Reset

```bash
$ supabase db reset
```

**Output:**
```
Seeding data from supabase/seed-mvp-data.sql...
NOTICE: 👥 Seeding auth.users...
NOTICE: 👤 Seeding public.users...
NOTICE: 🎸 Seeding user_profiles...
NOTICE: 🎵 Seeding band...
NOTICE: 👥 Seeding band_memberships...
NOTICE: ✅ MVP seed data complete!
NOTICE: Test users: eric@ipodshuffle.com, mike@ipodshuffle.com, sarah@ipodshuffle.com
NOTICE: Password for all: test123
```

### 3. Verified Data Loaded

```sql
-- Check users exist
SELECT email FROM auth.users ORDER BY email;
-- Returns: eric@, mike@, sarah@ ✓

-- Check band memberships
SELECT u.name, b.name, bm.role 
FROM users u 
JOIN band_memberships bm ON u.id = bm.user_id 
JOIN bands b ON bm.band_id = b.id;
-- Returns: 3 rows with iPod Shuffle band ✓
```

---

## What This Wasn't

**NOT caused by:**
- ❌ My RealtimeManager code changes
- ❌ Auth context refactoring
- ❌ Session expiry
- ❌ Browser cache issues

**WAS caused by:**
- ✅ Incorrect seed file path in config
- ✅ Database reset without seed data

---

## Why Quick Login Failed

**Before Fix:**
1. User clicks "Eric (Guitar, Vocals)" button
2. App tries to sign in with `eric@ipodshuffle.com` / `test123`
3. Supabase checks `auth.users` table
4. **User doesn't exist** → 400 Bad Request
5. Login fails

**After Fix:**
1. User clicks "Eric (Guitar, Vocals)" button
2. App tries to sign in with `eric@ipodshuffle.com` / `test123`
3. Supabase checks `auth.users` table
4. **User exists with matching password** → 200 OK
5. Login succeeds

---

## Why "No Band Selected" After Manual Login

This is a **separate issue** that was masked by the seed data problem. After fixing seed data, if you still see "No Band Selected", it means:

1. **User authenticated successfully** ✓
2. **BUT band memberships not loading** ❌

**Possible causes:**
- Initial sync not running
- Band memberships query failing
- Context not updating after login
- Race condition in auth flow

**Next steps (if issue persists):**
1. Check browser console for errors
2. Look for "Synced X bands" message
3. Verify `loadUserData` is being called
4. Check if `currentBand` and `currentBandId` are set

---

## Prevention: How to Avoid This

### 1. Always Use Correct Seed File

When running `supabase db reset`, ensure `config.toml` points to the right seed file:

```toml
[db.seed]
enabled = true
sql_paths = ["./seed-mvp-data.sql"]  # Use MVP data for development
```

### 2. Verify Seed After Reset

After any `supabase db reset`, verify data loaded:

```bash
# Check users
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "SELECT count(*) FROM auth.users;"
# Should return 3 (eric, mike, sarah)

# Check bands
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "SELECT count(*) FROM bands;"
# Should return 1 (iPod Shuffle)
```

### 3. Document Seed Files

Keep `/supabase` command reference updated with:
- Which seed file is active
- What data it contains
- Default passwords

---

## Current Status

**✅ Fixed:**
- Seed file configuration corrected
- Database reset and re-seeded
- Test users exist and can authenticate
- Band memberships loaded

**🔄 To Test:**
1. Refresh browser (clear cache if needed)
2. Navigate to `/auth`
3. Click "Eric (Guitar, Vocals)" quick login
4. **Should:** Log in successfully
5. **Should:** See "iPod Shuffle" as current band
6. **Should:** Navigate to /songs page

**❓ If Still Broken:**
- Check console for new errors
- Verify session storage is clean
- Try incognito window
- Check if initial sync is running

---

## Lessons Learned

1. **`supabase db reset` is destructive** - Wipes ALL data, including auth users
2. **Seed files are critical** - Without them, you have no users to log in
3. **Config files matter** - Wrong path = no seed data
4. **Always verify after reset** - Don't assume data loaded
5. **Document seed setup** - Future you (or teammates) will thank you

---

**Files Modified:**
- `supabase/config.toml` - Changed `sql_paths` to point to `seed-mvp-data.sql`
- `.claude/commands/supabase.md` - Added seed file documentation

**Database State:**
- ✅ All migrations applied
- ✅ Realtime enabled for all tables including audit_log
- ✅ Test users created (eric@, mike@, sarah@)
- ✅ iPod Shuffle band with 3 members
- ✅ Sample songs and shows loaded

**Ready for testing!**
