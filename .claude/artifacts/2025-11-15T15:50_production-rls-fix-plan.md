# Production RLS Migration Fix

**Date:** 2025-11-15T15:50
**Issue:** Production Supabase missing RLS policy fixes, causing 403 sync errors
**Error:** `new row violates row-level security policy for table "songs"` and `"bands"`

## Root Cause

Local E2E tests pass because local Supabase has all migrations applied.
Production Supabase only has the baseline migration (`20251106000000_baseline_schema.sql`).

**Missing migrations (8 files):**
```
20251110060100_fix_bands_insert_policy.sql
20251110150242_fix_rls_helper_functions.sql
20251110200000_fix_bands_policies_final.sql
20251110210000_add_users_insert_policy.sql
20251111194800_add_increment_invite_code_usage.sql
20251111220000_fix_band_memberships_select_policy.sql
20251111232842_fix_rls_infinite_recursion.sql
20251112041613_fix_members_visibility_for_all_users.sql
```

## Immediate Fix: Apply Missing Migrations

### Step 1: Verify Supabase CLI Access

```bash
# Check .env.supabase exists
ls -la .env.supabase

# Source the environment
source .env.supabase

# Verify token is valid (not expired)
echo "Token expires: Check .env.supabase file"
```

### Step 2: Link to Production Project

```bash
# Link to remote project
source .env.supabase && supabase link --project-ref khzeuxxhigqcmrytsfux

# Verify link status
source .env.supabase && supabase migration list
```

### Step 3: Apply Missing Migrations

```bash
# Apply all pending migrations to production
source .env.supabase && supabase db push --linked

# This will apply the 8 missing RLS fix migrations
```

### Step 4: Verify Migrations Applied

```bash
# Check migration status
source .env.supabase && supabase migration list

# Should show all migrations as applied
```

### Step 5: Test Production App

1. Clear browser cache and reload app
2. Try creating a song
3. Check that sync works (no more "2 pending")
4. Verify no 403 errors in console

## Secondary Fix: Improve "Connected" Status

**Current behavior:** Shows "Connected" when `navigator.onLine` is true
**Problem:** Doesn't validate actual Supabase connectivity or RLS permissions

### Proposed Changes

**File:** `src/hooks/useSyncStatus.ts`

Add actual connectivity validation:
- Ping Supabase on app startup
- Check if user has valid session
- Attempt a simple read query to validate RLS policies
- Only show "Connected" if all checks pass

**File:** `src/components/layout/Sidebar.tsx`

Show sync errors when they occur:
- Display error icon when sync fails
- Show tooltip with error message
- Distinguish between:
  - Network offline
  - Supabase unreachable
  - RLS policy errors
  - Auth errors

### Implementation Plan

```typescript
// useSyncStatus.ts - Add connectivity validation
interface SyncStatus {
  isOnline: boolean // Network status
  isConnected: boolean // Actual Supabase connectivity + auth
  isSyncing: boolean
  pendingCount: number
  lastSyncTime: Date | null
  syncError: string | null // Show this in UI!
}

// Add validation function
async function validateSupabaseConnection(): Promise<boolean> {
  try {
    // Check if Supabase client exists
    if (!supabase) return false

    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return false

    // Try a simple read query to validate RLS
    const { error } = await supabase.from('bands').select('id').limit(1)
    return !error
  } catch {
    return false
  }
}
```

## Long-Term: Consolidate Migrations

Per CLAUDE.md pre-1.0 policy, these 8 RLS fix migrations should be consolidated into the baseline migration since we're still in pre-1.0 development.

**Action after production is fixed:**
1. Merge all 8 RLS fixes into `20251106000000_baseline_schema.sql`
2. Move incremental migrations to `supabase/migrations/archive/`
3. Document the consolidation
4. Update team that next `supabase db reset` will have complete schema

## Verification Checklist

- [ ] .env.supabase token is valid (not expired)
- [ ] Linked to production project successfully
- [ ] Migration list shows baseline + 8 RLS fixes
- [ ] All migrations applied via `db push --linked`
- [ ] Production app loads without errors
- [ ] Can create songs/bands without 403 errors
- [ ] Pending sync count goes to 0
- [ ] No RLS errors in browser console

## Notes

- **Token expiry:** Check `.env.supabase` for expiration date
- **New token:** Get from https://supabase.com/dashboard/account/tokens
- **Safety:** These are non-destructive schema additions (new policies only)
- **Rollback:** Not needed - policies only add permissions, don't remove data
