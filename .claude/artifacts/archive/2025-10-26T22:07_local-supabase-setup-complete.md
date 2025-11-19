---
title: Local Supabase Development Environment - Fixed and Working
created: 2025-10-26T22:07
status: Complete
prompt: "User reported 401/RLS errors when using local Supabase. Diagnosed and fixed authentication setup and RLS recursion issues."
---

# Local Supabase Setup - Complete and Working

## Summary

Successfully diagnosed and fixed the local Supabase development environment. The app now works correctly with local Supabase for development and testing.

## Issues Found and Fixed

### 1. Empty Database (ROOT CAUSE)
**Problem**: Local Supabase had no users, bands, or test data.
**Solution**: Created comprehensive seed script with test users and data.

### 2. Incomplete Auth User Records
**Problem**: Auth.users records were missing required fields (`recovery_token`, `email_change`, etc.), causing GoTrue to fail with "converting NULL to string is unsupported".
**Solution**: Updated seed script to include ALL required auth.users fields with proper empty string defaults.

### 3. RLS Policy Recursion
**Problem**: `band_memberships` SELECT policies had subqueries on the same table, causing infinite recursion when inserting songs.
**Solution**: Created helper functions (`is_band_admin`, `user_is_band_member`) with `SECURITY DEFINER` to break recursion cycle.

## Files Created/Modified

### New Files
1. **`supabase/seed-local-dev.sql`** - Comprehensive seed script for local development
   - Creates 3 auth users (eric, mike, sarah - password: test123)
   - Creates test band "iPod Shuffle"
   - Sets up band memberships
   - Adds 3 sample songs

2. **`supabase/migrations/20251026221000_fix_rls_recursion.sql`** - First attempt at fixing recursion
3. **`supabase/migrations/20251026221100_fix_rls_recursion_v2.sql`** - Final recursion fix with helper functions

### Modified Files
- `.env.local` - Already configured correctly for local Supabase
- RLS policies refined with proper security patterns

## Test Users

All users have password: **test123**

| Email | ID | Role | Band |
|-------|----|----|------|
| eric@ipodshuffle.com | `7e75840e-9d91-422e-a949-849f0b8e2ea4` | admin | iPod Shuffle |
| mike@ipodshuffle.com | `0c9c3e47-a4e0-4b70-99db-3e14c89ba9b3` | member | iPod Shuffle |
| sarah@ipodshuffle.com | `b7e6bb62-5c26-4a78-be6b-2e7a1cbe5f77` | member | iPod Shuffle |

**Band ID**: `a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d`

## How to Use

### 1. Start Local Supabase
```bash
supabase start
```

### 2. Seed Test Data (if not already done)
```bash
cat supabase/seed-local-dev.sql | docker exec -i supabase_db_rock-on psql -U postgres
```

### 3. Verify Environment Variables
Check `.env.local`:
```bash
VITE_MOCK_AUTH=false
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
```

### 4. Start Dev Server
```bash
npm run dev
```

### 5. Login to App
Use any of the test user credentials:
- Email: `eric@ipodshuffle.com`
- Password: `test123`

## Verification Tests

### Test Authentication (curl)
```bash
curl -X POST "http://127.0.0.1:54321/auth/v1/token?grant_type=password" \
  -H "apikey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH" \
  -H "Content-Type: application/json" \
  -d '{"email":"eric@ipodshuffle.com","password":"test123"}'
```

**Expected**: Returns JSON with `access_token` field ✓

### Test Song Insertion
```bash
# Get token first
TOKEN=$(curl -s -X POST "http://127.0.0.1:54321/auth/v1/token?grant_type=password" \
  -H "apikey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH" \
  -H "Content-Type: application/json" \
  -d '{"email":"eric@ipodshuffle.com","password":"test123"}' \
  | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

# Insert song
curl -X POST "http://127.0.0.1:54321/rest/v1/songs" \
  -H "apikey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "title": "My Test Song",
    "artist": "Test Artist",
    "duration": 180,
    "key": "C",
    "tempo": 120,
    "difficulty": 2,
    "confidence_level": 3,
    "context_type": "band",
    "context_id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
    "created_by": "7e75840e-9d91-422e-a949-849f0b8e2ea4",
    "visibility": "band"
  }'
```

**Expected**: Returns song object with new ID ✓

### Check Database Directly
```bash
docker exec -i supabase_db_rock-on psql -U postgres -c \
  "SELECT id, title, artist FROM public.songs LIMIT 5;"
```

**Current Status**: 5 songs in database (3 seed + 1 test + duplicates) ✓

## RLS Policy Architecture

### Problem Pattern (Causes Recursion)
```sql
-- ❌ BAD: Queries same table in policy
CREATE POLICY "example_policy" ON band_memberships
USING (
  band_id IN (
    SELECT band_id FROM band_memberships  -- ← RECURSION!
    WHERE user_id = auth.uid()
  )
);
```

### Solution Pattern (No Recursion)
```sql
-- ✓ GOOD: Use SECURITY DEFINER function
CREATE FUNCTION is_band_member(p_band_id UUID, p_user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER  -- ← Bypasses RLS
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM band_memberships
    WHERE band_id = p_band_id
    AND user_id = p_user_id
  );
$$;

CREATE POLICY "example_policy" ON band_memberships
USING (is_band_member(band_id, auth.uid()));  -- No recursion!
```

## Key Learnings

### 1. Auth Users Must Have All Fields
GoTrue expects ALL string fields in `auth.users` to be empty strings (''), not NULL:
- `confirmation_token`
- `recovery_token`
- `email_change`
- `email_change_token_new`
- `email_change_token_current`
- `phone_change`
- `phone_change_token`
- `reauthentication_token`

### 2. RLS Recursion Detection
PostgreSQL RLS will detect infinite recursion when a policy on table X queries table X again. Use `SECURITY DEFINER` functions to break the cycle.

### 3. Test Data is Critical
Always seed test data for local development:
- Auth users (in `auth.users` AND `public.users`)
- Auth identities (in `auth.identities`)
- Test bands and memberships
- Sample songs/setlists

## Troubleshooting Guide

### Error: "Database error querying schema"
**Cause**: Auth user missing required fields
**Fix**: Run `supabase db reset` and reseed with updated script

### Error: "Infinite recursion detected in policy"
**Cause**: RLS policy queries same table it's protecting
**Fix**: Use SECURITY DEFINER functions (migrations already applied)

### Error: "401 Unauthorized"
**Cause**: User not authenticated or JWT token expired
**Fix**: Login again to get fresh token

### Error: "new row violates row-level security policy"
**Cause**: `created_by` field doesn't match authenticated user
**Fix**: Ensure `created_by` is set to `auth.uid()` in insert

## Current Database State

```
Auth Users:    3 (eric, mike, sarah)
Public Users:  3
Bands:         1 (iPod Shuffle)
Memberships:   3 (all active)
Songs:         5 (including test songs)
```

## Next Steps for Development

1. **Start coding**: The local environment is fully functional
2. **Test sync**: Verify local → Supabase sync works in the app
3. **Test RLS**: Try accessing data across different users
4. **Performance**: Monitor query performance with local data

## Related Files

- Schema: `.claude/specifications/unified-database-schema.md`
- RLS Spec: `.claude/specifications/permissions-and-use-cases.md`
- Local Setup: `.claude/setup/SUPABASE-LOCAL-SETUP.md`

---

**Status**: ✅ Complete - Local Supabase fully functional
**Tested**: Authentication, song insertion, RLS policies
**Ready for**: Development and testing
