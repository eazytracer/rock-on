---
created: 2025-11-20T00:25:00Z
prompt: Investigate 403 error when creating songs in production for user with multiple bands
status: in-progress
---

# Song Creation 403 Error Investigation

## Problem Statement

User (eric@ipodshuffle.com) is in 2 bands and getting a 403 Forbidden error when trying to create songs in production:

```
new row violates row-level security policy for table 'songs'
```

## RLS Policy Analysis

The `songs_insert_band_members_only` policy has THREE conditions that must ALL be true:

```sql
CREATE POLICY "songs_insert_band_members_only"
  ON public.songs FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (select auth.uid()) AND           -- Condition 1
    context_type = 'band' AND                      -- Condition 2
    is_band_member(songs.context_id::uuid,         -- Condition 3
                   (select auth.uid()))
  );
```

### Condition 1: `created_by = auth.uid()`

**How it works:**
1. UI sends `createdBy: localStorage.getItem('currentUserId')` (SongsPage.tsx:695)
2. Repository maps this to `created_by` field (RemoteRepository.ts:125)
3. Trigger `set_created_by()` only sets it IF NULL (baseline_schema.sql:540-541)
4. RLS policy checks if `created_by = auth.uid()`

**Potential issue:** If `localStorage.getItem('currentUserId')` doesn't match the current Supabase session's `auth.uid()`, this check will fail.

**Why E2E tests pass:** Fresh browser state ensures localStorage matches session.

**Why production might fail:** Stale localStorage from previous sessions.

### Condition 2: `context_type = 'band'`

**How it works:**
- UI explicitly sends `contextType: 'band'` (SongsPage.tsx:1393)
- This should always pass

### Condition 3: `is_band_member(context_id, auth.uid())`

**How it works:**
```sql
CREATE OR REPLACE FUNCTION is_band_member(p_band_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.band_memberships
    WHERE band_id = p_band_id
      AND user_id = p_user_id
      AND status = 'active'
  );
$$;
```

Checks if user has an **active** membership for the band specified in `context_id`.

**How context_id is set:**
- UI sends `contextId: currentBandId` (SongsPage.tsx:1393)
- `currentBandId` comes from AuthContext state (line 603)
- AuthContext determines it from:
  1. `localStorage.getItem('currentBandId')` if exists (line 403)
  2. First band in user's bands array otherwise (line 407-415)

**Potential issues:**
1. **Stale localStorage:** `currentBandId` points to old/test band where user no longer has active membership
2. **Duplicate memberships:** User has multiple memberships (active + inactive) causing confusion
3. **Wrong band selected:** UI shows one band but localStorage points to another

## Multi-Band Context

User has 2 bands:
1. **Original band:** "iPod Shuffle" (from seed data with ROCK2025 invite code)
2. **Test band:** Created during testing, never deleted

The `currentBandId` determination logic auto-selects the **first** band if no localStorage value exists. If the user's bands array is ordered differently than expected, or if localStorage points to the wrong band, the membership check will fail.

## Code Flow Summary

```
User clicks "Add Song"
  ↓
SongsPage.tsx:1393 - createSong({
  contextId: currentBandId,      // From AuthContext
  createdBy: currentUserId,      // From localStorage!
  contextType: 'band',
  visibility: 'band'
})
  ↓
SongService.ts:175 - addSong()
  ↓
RemoteRepository.ts:62 - Supabase INSERT
  created_by: song.createdBy     // From localStorage
  context_id: song.contextId     // From AuthContext
  context_type: song.contextType // 'band'
  ↓
Trigger: set_created_by() - Only sets if NULL (doesn't override)
  ↓
RLS Policy Evaluation:
  1. ✅ created_by = auth.uid()? (if localStorage matches session)
  2. ✅ context_type = 'band'? (always true)
  3. ❓ is_band_member(context_id, auth.uid())? (LIKELY FAILURE POINT)
```

## Root Cause Hypothesis

**Primary hypothesis:** The user's `currentBandId` (from localStorage or auto-selection) points to a band where they don't have an **active** membership in the production database.

**Why this explains the symptoms:**
1. ✅ E2E tests pass (clean state, correct memberships)
2. ✅ Production fails (messy state, 2 bands, potential duplicate/inactive memberships)
3. ✅ User mentioned "2 bands existing" in console logs
4. ✅ User mentioned test band was "never deleted"

## Recommended Investigation Steps

1. **Check production database:**
   ```sql
   SELECT * FROM band_memberships
   WHERE user_id = '<eric@ipodshuffle.com user_id>'
   ORDER BY created_date;
   ```
   Look for:
   - Multiple memberships for same band (duplicates)
   - Inactive memberships
   - Memberships to deleted/orphaned bands

2. **Check user's localStorage:**
   - Open production app
   - Inspect `localStorage.getItem('currentUserId')`
   - Inspect `localStorage.getItem('currentBandId')`
   - Compare to actual Supabase session user ID
   - Verify currentBandId corresponds to a band with active membership

3. **Verify band membership status:**
   ```sql
   SELECT bm.*, b.name
   FROM band_memberships bm
   JOIN bands b ON bm.band_id = b.id
   WHERE bm.user_id = '<user_id>'
   AND bm.band_id = '<currentBandId from localStorage>';
   ```

## Potential Fixes

### Fix 1: Use session user ID instead of localStorage

**Change:** `/workspaces/rock-on/src/pages/NewLayout/SongsPage.tsx:695`

```typescript
// BEFORE:
const currentUserId = localStorage.getItem('currentUserId') || ''

// AFTER:
const { user } = useAuth()
const currentUserId = user?.id || ''
```

**Benefits:**
- Always uses current session user ID
- Eliminates localStorage desync issues
- More secure

### Fix 2: Validate currentBandId on song creation

Add validation before creating song to ensure:
1. User has active membership in `currentBandId`
2. If not, show error message asking user to switch bands
3. Optionally auto-switch to first valid band

### Fix 3: Clean up duplicate/orphaned memberships

Run migration to:
1. Identify duplicate memberships (same user + band)
2. Keep newest active, mark others inactive
3. Delete memberships to non-existent bands

### Fix 4: Add better error handling

Catch 403 errors and show user-friendly message:
```typescript
try {
  await createSong(...)
} catch (error) {
  if (error.code === '403') {
    showToast('You may not have permission to create songs in this band. Try switching bands or contact your band admin.')
  }
}
```

## Next Steps

1. ✅ Wait for E2E test completion
2. ⏳ Check production database for user's band memberships
3. ⏳ Verify localStorage values in production
4. ⏳ Implement Fix 1 (use session user ID)
5. ⏳ Test fix in production
6. ⏳ If still failing, implement Fix 2 (validate currentBandId)

## Related Files

- `/workspaces/rock-on/src/pages/NewLayout/SongsPage.tsx:695` - Uses localStorage for userId
- `/workspaces/rock-on/src/contexts/AuthContext.tsx:403` - currentBandId from localStorage
- `/workspaces/rock-on/src/services/data/RemoteRepository.ts:125` - Maps created_by field
- `/workspaces/rock-on/supabase/migrations/20251106000000_baseline_schema.sql:1054` - RLS policy
- `/workspaces/rock-on/supabase/migrations/20251106000000_baseline_schema.sql:812` - is_band_member function
