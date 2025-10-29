---
title: Supabase 400 Error Fix - Invalid Column Names
created: 2025-10-26T01:41
type: Bug Fix Report
prompt: User reported 400 errors from Supabase when adding songs. Investigated using Chrome MCP server to replicate the issue and identify the root cause.
---

# Supabase 400 Error Fix - Invalid Column Names

## Problem Summary

When adding a new song through the UI, the song was successfully saved to IndexedDB but failed to sync to Supabase with a **400 Bad Request** error:

```
"Could not find the 'guitar_tuning' column of 'songs' in the schema cache"
```

## Root Cause

The `RemoteRepository.ts` file was attempting to send IndexedDB-only fields to Supabase that don't exist in the Supabase schema:

1. **`guitar_tuning`** - Only exists in IndexedDB, NOT in Supabase
2. **`album`** - Only exists in IndexedDB, NOT in Supabase

According to the unified database schema (`.claude/specifications/unified-database-schema.md`), these fields are client-side only and should never be sent to the remote database.

## Investigation Process

1. **Used Chrome MCP server** to login and replicate the issue
2. **Submitted a test song** through the form
3. **Captured network request** showing 400 error:
   - Request ID: 128, 129
   - Error code: PGRST204
   - Message: "Could not find the 'guitar_tuning' column of 'songs' in the schema cache"
4. **Examined request payload** and found incorrect fields being sent
5. **Referenced unified schema** to confirm which fields exist in Supabase

## Solution

Modified `src/services/data/RemoteRepository.ts` to exclude IndexedDB-only fields:

### File: `src/services/data/RemoteRepository.ts`

**Before (lines 102-123):**
```typescript
private mapSongToSupabase(song: Partial<Song>): any {
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    album: song.album,  // ❌ WRONG - doesn't exist in Supabase
    duration: song.duration,
    key: song.key,
    tempo: song.bpm,
    difficulty: song.difficulty,
    guitar_tuning: song.guitarTuning,  // ❌ WRONG - doesn't exist in Supabase
    notes: song.notes,
    created_date: song.createdDate,
    // ... rest of fields
  }
}
```

**After (fixed):**
```typescript
private mapSongToSupabase(song: Partial<Song>): any {
  // Note: Only include fields that exist in Supabase schema
  // Fields like album, guitarTuning, lyrics, chords, tags, structure, referenceLinks
  // are IndexedDB-only and should NOT be sent to Supabase
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    // album: IndexedDB only - do NOT send to Supabase
    duration: song.duration,
    key: song.key,
    tempo: song.bpm, // bpm (IndexedDB) -> tempo (Supabase)
    difficulty: song.difficulty,
    // guitar_tuning: IndexedDB only - do NOT send to Supabase
    notes: song.notes,
    created_date: song.createdDate,
    // ... rest of fields
  }
}
```

Also updated `mapSongFromSupabase()` to provide sensible defaults for IndexedDB-only fields:

```typescript
private mapSongFromSupabase(row: any): Song {
  return {
    // ... Supabase fields
    album: '', // IndexedDB only - not in Supabase
    guitarTuning: 'Standard', // IndexedDB only - default to 'Standard'
    lyrics: '', // IndexedDB only - not in Supabase
    chords: [], // IndexedDB only - not in Supabase
    tags: [], // IndexedDB only - not in Supabase
    structure: [], // IndexedDB only - not in Supabase
    referenceLinks: [], // IndexedDB only - not in Supabase
  }
}
```

## Verification

After the fix, tested adding a new song "Sync Fix Test":

**Request payload (correct):**
```json
{
  "id": "0d58fdd1-aac6-4826-820e-154583188098",
  "title": "Sync Fix Test",
  "artist": "Test Artist 2",
  "duration": 0,
  "key": "G",
  "tempo": 128,
  "difficulty": 1,
  "created_date": "2025-10-26T01:31:00.339Z",
  "confidence_level": 1,
  "context_type": "band",
  "context_id": "44f13d8e-6880-4df3-b866-b5daeccef454",
  "created_by": "65c9be69-61c0-46f4-ae2d-f0c0959e352c",
  "visibility": "band_only"
}
```

✅ **No `guitar_tuning` field**
✅ **No `album` field**
✅ **Properly formatted with only Supabase-compatible fields**

## Result

**The 400 error is completely fixed!** The data is now properly formatted and only includes fields that exist in the Supabase schema.

**Note:** A new 401 RLS policy error appeared, but that's a separate authentication/authorization issue unrelated to the formatting problem.

## IndexedDB-Only Fields Reference

The following fields exist ONLY in IndexedDB and should NEVER be sent to Supabase:

**Song fields:**
- `album` (string)
- `guitarTuning` (string)
- `lyrics` (string) - Supabase has `lyrics_url` instead
- `chords` (array) - Supabase has `chords_url` instead
- `tags` (array)
- `structure` (array)
- `referenceLinks` (array)

These fields are for local-only functionality and will be preserved in IndexedDB but not synchronized to the cloud.

## Files Changed

1. `src/services/data/RemoteRepository.ts` - Fixed field mapping functions

## Related Documentation

- `.claude/specifications/unified-database-schema.md` - Authoritative schema reference
- `.claude/instructions/IMPLEMENTATION-STATUS.md` - Implementation progress
- `.claude/instructions/TASK-INDEX.md` - Task tracking

---

**Status:** ✅ RESOLVED
**Fixed by:** Claude Code
**Date:** 2025-10-26
