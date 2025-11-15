# Quick Fix: Deploy RLS Policy to Remote Supabase

## Problem
Band creation fails with: `new row violates row-level security policy for table "bands"`

This means your remote Supabase instance is missing the correct RLS policies.

## Solution

### Option 1: Push Migration to Remote (Recommended)

```bash
# Link to your remote Supabase project
supabase link --project-ref khzeuxxhigqcmrytsfux

# Push the new fix migration
supabase db push

# This will apply: 20251110060100_fix_bands_insert_policy.sql
```

### Option 2: Manual Fix via Supabase Studio

If the CLI doesn't work, go to https://supabase.com/dashboard and run this SQL:

```sql
-- Fix bands INSERT policy
DROP POLICY IF EXISTS "bands_insert_any_authenticated" ON public.bands;

CREATE POLICY "bands_insert_any_authenticated"
  ON public.bands FOR INSERT TO authenticated
  WITH CHECK (true);

-- Ensure RLS is enabled
ALTER TABLE public.bands ENABLE ROW LEVEL SECURITY;
```

### Option 3: Reset Remote Database (Nuclear Option)

⚠️ **WARNING: This will DELETE all data!**

```bash
supabase link --project-ref khzeuxxhigqcmrytsfux
supabase db reset --linked
```

## After Applying Fix

1. Test band creation on your production site
2. User should be able to create a band successfully
3. Band should appear in Supabase `bands` table
4. Band membership should be created in `band_memberships` table

## Verification

Check in Supabase Studio that these policies exist on the `bands` table:
- ✅ `bands_insert_any_authenticated` (FOR INSERT, WITH CHECK = true)
- ✅ `bands_select_members` (FOR SELECT)
- ✅ `bands_update_admins` (FOR UPDATE)
