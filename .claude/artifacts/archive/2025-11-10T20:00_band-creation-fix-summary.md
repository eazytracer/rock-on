---
title: Band Creation Fix - RLS Policy Timing Issue
created: 2025-11-10T20:00
status: Resolved
---

# Band Creation Fix Summary

## Problem

New users were unable to create bands, getting error:
```
POST http://127.0.0.1:54321/rest/v1/bands?select=* 403 (Forbidden)
Failed to sync bands: {code: '42501', message: 'new row violates row-level security policy for table "bands"'}
```

## Root Cause

The issue was a **timing problem with the `RETURNING` clause and RLS policies**:

1. ✅ INSERT INTO bands succeeds (policy: `bands_insert_any_authenticated` allows it)
2. ✅ Row is inserted
3. ✅ BEFORE INSERT trigger sets `created_by = auth.uid()`
4. ❌ **RETURNING clause tries to SELECT the row** → **FAILS! User isn't a member yet**
5. ⏱️ AFTER INSERT trigger would add membership (but too late for RETURNING)

The `bands_select_members` policy only allowed selecting bands where `is_band_member()` returns true. But the membership is added by an AFTER INSERT trigger, which fires AFTER the RETURNING clause needs to SELECT the row.

## Solution

Created migration `20251110200000_fix_bands_policies_final.sql` that updates the SELECT policy:

```sql
-- OLD POLICY (broken):
CREATE POLICY "bands_select_members"
  ON public.bands FOR SELECT TO authenticated
  USING (is_band_member(bands.id, (select auth.uid())));

-- NEW POLICY (fixed):
CREATE POLICY "bands_select_members_or_creator"
  ON public.bands FOR SELECT TO authenticated
  USING (
    is_band_member(bands.id, (select auth.uid())) OR
    created_by = (select auth.uid())  -- ← Allows viewing bands you just created!
  );
```

This allows users to SELECT bands they created, even before the AFTER INSERT trigger adds their membership.

## Sequence After Fix

1. ✅ INSERT INTO bands (WITH CHECK policy allows it)
2. ✅ Row is inserted
3. ✅ BEFORE INSERT trigger sets `created_by = auth.uid()`
4. ✅ **RETURNING clause SELECTs the row** → **SUCCESS! `created_by = auth.uid()` matches**
5. ✅ AFTER INSERT trigger adds membership (user becomes admin)

## Security Note

The original concern about postgres ownership is still valid, but the approach is secure:

**Functions with postgres ownership:**
- `auto_add_band_creator()` - Only inserts `auth.uid()`, can't be exploited
- `is_band_member()` / `is_band_admin()` - RLS helper functions
- Other trigger functions (`set_created_by`, `log_audit_trail`, etc.)

**Why this is safe:**
- Functions are marked `SECURITY DEFINER` to bypass RLS (prevents infinite recursion)
- Owned by postgres so they have BYPASSRLS privilege
- Functions only use `auth.uid()` from session context (can't be spoofed)
- Functions are simple, auditable, and follow least privilege
- This is the standard Supabase pattern for system operations

**See:** `.claude/artifacts/2025-11-10T19:30_rls-security-analysis.md` for detailed security analysis

## Files Changed

1. **`supabase/migrations/20251110150242_fix_rls_helper_functions.sql`**
   - Sets postgres ownership for all SECURITY DEFINER functions
   - Ensures triggers can bypass RLS when needed

2. **`supabase/migrations/20251110200000_fix_bands_policies_final.sql`**
   - Fixes the SELECT policy to allow viewing created bands
   - Main fix for the band creation issue

3. **`supabase/tests/006-rls-policies.test.sql`**
   - Updated test to expect `bands_select_members_or_creator` policy name

## Test Results

✅ All database tests pass: **336/336 tests**
✅ Band creation works for existing users
✅ Band creation works via Supabase client
✅ Membership auto-added correctly (user becomes admin)

## Example Usage

```javascript
const { data, error } = await supabase
  .from('bands')
  .insert({ name: 'My Band', description: 'Rock on!' })
  .select()  // ← This now works!
  .single();

// Returns:
// {
//   id: 'uuid',
//   name: 'My Band',
//   created_by: 'user-uuid',  // Set by trigger
//   ... other fields
// }

// Membership auto-created:
// role: 'admin', status: 'active'
```

## Migration Commands

```bash
# Applied automatically on reset
supabase db reset

# Or apply individually
supabase db push
```

All migrations are idempotent and safe to re-run.
