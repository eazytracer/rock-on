# Song Visibility Constraint Fix

---
**Created:** 2025-10-26T04:00
**Original Prompt:** Fix song creation failing with 400 error due to visibility check constraint violation. User reported songs wouldn't save and edit operations returned 406 errors.

---

## Problem Statement

Songs could not be created or synced to Supabase, failing with:
```
{code: '23514', details: null, hint: null, message: 'new row for relation "songs" violates check constraint "song_visibility_check"'}
```

## Root Cause Analysis

### 1. Schema Mismatch
**Supabase Constraint** (`supabase/migrations/20251025000000_initial_schema.sql:118`):
```sql
CONSTRAINT song_visibility_check CHECK (visibility IN ('band', 'personal', 'public'))
```

**Application Code** (multiple locations):
- Used `'band_only'` instead of `'band'`
- Used `'private'` instead of `'personal'`

### 2. Multiple Code Paths Not Using SongService

The UI was bypassing `SongService.ts` entirely! Multiple code paths were directly creating songs with incorrect values:

1. **`src/hooks/useSongs.ts`** - Primary hook used by UI
2. **`src/pages/NewLayout/SongsPage.tsx`** - Inline song creation (2 locations)
3. **`src/database/seedMvpData.ts`** - Test data seeding
4. **`src/database/seedData.ts`** - Demo data (3 locations)

## Files Fixed

### Core Application Code
1. **`src/models/Song.ts:27`**
   ```typescript
   // BEFORE:
   visibility: 'private' | 'band_only' | 'public'

   // AFTER:
   visibility: 'personal' | 'band' | 'public' // Matches Supabase constraint
   ```

2. **`src/hooks/useSongs.ts:70`** ⭐ **PRIMARY FIX**
   ```typescript
   // BEFORE:
   visibility: songData.visibility || 'band_only',

   // AFTER:
   visibility: songData.visibility || 'band', // Fixed: use 'band' to match Supabase constraint
   ```

3. **`src/services/SongService.ts:40`**
   ```typescript
   // BEFORE:
   visibility?: 'private' | 'band_only' | 'public'

   // AFTER:
   visibility?: 'personal' | 'band' | 'public'
   ```

4. **`src/services/SongService.ts:194`**
   ```typescript
   // BEFORE:
   visibility: songData.visibility || 'band_only'

   // AFTER:
   visibility: songData.visibility || 'band' // Default to 'band' for MVP
   ```

5. **`src/pages/NewLayout/SongsPage.tsx:684`** (Duplicate song function)
   ```typescript
   visibility: 'band',  // Was: 'band_only'
   ```

6. **`src/pages/NewLayout/SongsPage.tsx:1294`** (Add song modal)
   ```typescript
   visibility: 'band',  // Was: 'band_only'
   ```

### Test/Seed Data
7. **`src/database/seedMvpData.ts:219`**
8. **`src/database/seedData.ts`** (3 occurrences - lines 32, 53, 73)

### Repository Layer
9. **`src/services/data/RemoteRepository.ts:153`**
   ```typescript
   // Updated default fallback:
   visibility: row.visibility ?? 'band', // Was: 'private'
   ```

## Why It Wasn't Caught Earlier

1. **Local IndexedDB doesn't enforce constraints** - Songs saved locally with invalid values
2. **Sync happened in background** - Errors were logged to console but not surfaced to UI
3. **Optimistic UI** - Song appeared in list immediately (from IndexedDB) even though Supabase sync failed
4. **Multiple code paths** - Fixed one place (SongService) but UI used different path (useSongs hook)
5. **Old data in IndexedDB** - Even after code fixes, previously saved songs still had `'band_only'` value

## Testing Protocol

To verify the fix:

1. **Clear IndexedDB** to remove old data with invalid values
2. **Refresh browser** to load new bundled code
3. **Create new song** to test with fresh data
4. **Check network tab** for successful POST to `/rest/v1/songs`
5. **Verify no console errors** about sync failures

## Prevention Recommendations

1. **Type safety**: Update Song interface to use Supabase values as source of truth
2. **Centralize defaults**: Create constants file for default values:
   ```typescript
   export const DEFAULT_SONG_VISIBILITY = 'band' as const
   ```
3. **Validation layer**: Add runtime validation before Supabase calls
4. **Integration tests**: Test actual Supabase writes, not just IndexedDB
5. **Code audit**: Search for other schema mismatches (e.g., enum values)

## Files Changed

- `src/models/Song.ts`
- `src/hooks/useSongs.ts` ⭐
- `src/services/SongService.ts`
- `src/services/data/RemoteRepository.ts`
- `src/pages/NewLayout/SongsPage.tsx`
- `src/database/seedMvpData.ts`
- `src/database/seedData.ts`

## Related Issues

- Song edit returns 406 because song doesn't exist in Supabase (creation failed)
- Sync queue builds up with failed operations
- Users see inconsistent state (local data exists, remote doesn't)
