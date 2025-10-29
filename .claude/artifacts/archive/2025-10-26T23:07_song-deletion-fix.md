---
title: Song Deletion and UI Refresh Fix
created: 2025-10-26T23:07
status: Complete
prompt: "User reported songs not deleting - showed success toast but song remained in UI and database"
---

# Song Deletion and UI Refresh Fix

## Problem

Song deletion appeared to succeed (success toast shown, no errors), but:
1. Song remained visible in the UI
2. Song still existed in the database

## Root Causes

### 1. Overly Restrictive DELETE Policy
**Location**: `supabase/migrations/20251026160000_rebuild_rls_policies.sql:249-253`

**Problem**: DELETE policy only allowed song creators to delete their own songs:
```sql
CREATE POLICY "songs_delete_creator"
  ON public.songs FOR DELETE
  USING (created_by = auth.uid());
```

**Issue**: In a band context, if Eric creates a song and Mike tries to delete it, Mike gets denied even though they're both band members working on the same song.

### 2. Missing UI Refresh After Operations
**Location**: `src/pages/NewLayout/SongsPage.tsx`

**Problem**: After CRUD operations (create/update/delete), the page didn't call `refetch()` to update the UI.

**Flow**:
1. User deletes song → `deleteSong()` removes from IndexedDB
2. Sync queued and executed → song removed from Supabase
3. Success toast shown
4. **BUT**: UI still shows old data because `useSongs` wasn't told to refetch

The `useSongs` hook only refetches when sync status changes, but the deletion happens so fast that the UI might not catch the status change event.

## Solutions Implemented

### 1. Updated DELETE Policy
**File**: `supabase/migrations/20251026221500_fix_song_delete_policy.sql`

```sql
-- Drop restrictive policy
DROP POLICY IF EXISTS "songs_delete_creator" ON public.songs;

-- Create flexible policy: creator OR band members can delete
CREATE POLICY "songs_delete_creator_or_band_member"
  ON public.songs FOR DELETE
  TO authenticated
  USING (
    -- Creator can always delete their songs
    created_by = auth.uid()
    OR
    -- Band members can delete band songs
    (
      context_type = 'band'
      AND public.user_is_band_member(context_id::uuid, auth.uid())
    )
  );
```

**Result**:
- Personal songs: Only creator can delete ✓
- Band songs: Any band member can delete ✓

### 2. Added UI Refresh Calls
**File**: `src/pages/NewLayout/SongsPage.tsx`

**Changes**:

1. **Added `refetch` to hook destructuring** (line 440):
```typescript
const { songs: dbSongs, loading, error, refetch } = useSongs(currentBandId)
```

2. **Call refetch after DELETE** (line 730):
```typescript
await deleteSong(song.id)
await refetch()  // ← Added
showToast(`Successfully deleted "${song.title}"`, 'success')
```

3. **Call refetch after CREATE** (line 1310):
```typescript
await createSong({ ... })
await refetch()  // ← Added
showToast(`Successfully added "${newSong.title}"`, 'success')
```

4. **Call refetch after UPDATE** (line 1357):
```typescript
await updateSong(updatedSong.id, { ... })
await refetch()  // ← Added
showToast(`Successfully updated "${updatedSong.title}"`, 'success')
```

5. **Call refetch after DUPLICATE** (line 691):
```typescript
await createSong({ title: `${song.title} (Copy)`, ... })
await refetch()  // ← Added
showToast(`Successfully duplicated "${song.title}"`, 'success')
```

## Testing

### Before Fix
```bash
# Login as Mike
# Try to delete song created by Eric
DELETE /rest/v1/songs?id=eq.<song_id>
# Result: Silent failure, song remains
```

### After Fix
```bash
# Login as Mike (different user than creator)
curl -X DELETE "http://127.0.0.1:54321/rest/v1/songs?id=eq.d6e7c2e9-003e-41f0-b9ea-de60cbacf800" \
  -H "Authorization: Bearer <mike_token>"
# Result: HTTP 200, song deleted ✓

# Verify deletion
SELECT COUNT(*) FROM songs WHERE id = 'd6e7c2e9-003e-41f0-b9ea-de60cbacf800';
# Result: 0 rows ✓
```

### UI Testing
1. **Delete song**: Click delete → Toast shows success → Song disappears from list ✓
2. **Create song**: Add new song → Toast shows success → Song appears in list ✓
3. **Update song**: Edit song → Toast shows success → Changes visible immediately ✓
4. **Duplicate song**: Duplicate song → Toast shows success → Copy appears in list ✓

## Related Issues Fixed

This fix also resolves similar issues that would have occurred with:
- Song creation not showing immediately
- Song updates not reflecting in UI
- Song duplication not showing the duplicate

## Files Modified

1. **`supabase/migrations/20251026221500_fix_song_delete_policy.sql`** - New RLS policy
2. **`src/pages/NewLayout/SongsPage.tsx`** - Added `refetch()` calls after all CRUD operations

## Design Pattern

**Best Practice**: After any database mutation (create/update/delete), immediately call `refetch()` to ensure UI stays in sync with the database.

```typescript
// ✓ GOOD: Refetch after mutation
await updateSong(id, updates)
await refetch()
showToast('Success', 'success')

// ✗ BAD: Don't refetch, rely on sync events
await updateSong(id, updates)
// UI might not update if sync completes too quickly
showToast('Success', 'success')
```

## Impact

- **User Experience**: Immediate visual feedback for all song operations
- **Data Integrity**: Band members can now manage band songs collaboratively
- **Sync Reliability**: UI no longer depends on timing of sync events

## Related Files

- RLS Policies: `.claude/specifications/permissions-and-use-cases.md`
- Database Schema: `.claude/specifications/unified-database-schema.md`
- Local Setup: `.claude/artifacts/2025-10-26T22:07_local-supabase-setup-complete.md`

---

**Status**: ✅ Complete - Song deletion and UI refresh working correctly
**Tested**: All CRUD operations (create, read, update, delete, duplicate)
**Deployed**: Local Supabase instance
