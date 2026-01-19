---
feature: Song External Links Sync
created: 2026-01-18T19:45:00Z
status: diagnosis-complete
agent: diagnose-agent
root-cause: Missing field mappings in RemoteRepository
severity: high
---

# Diagnosis: Song External Links Not Syncing Between Devices

## Issue Summary

**Problem:** Song external links (Spotify, YouTube, Guitar Pro) are not syncing between devices

**Impact:** Users lose their external link data when accessing songs from different devices

**Severity:** High - significant feature degradation, data appears to be lost

## Root Cause

**Primary Cause:** Missing field mappings in RemoteRepository for external link columns

**File:** `src/services/data/RemoteRepository.ts:76-97`

**Problem:**

The `fieldMappings` configuration for songs table is missing mappings for the three external link columns:

- `spotifyUrl` ↔ `spotify_url`
- `youtubeUrl` ↔ `youtube_url`
- `guitarProUrl` ↔ `guitar_pro_url`

```typescript
// Current mappings (INCOMPLETE):
songs: {
  id: 'id',
  title: 'title',
  artist: 'artist',
  key: 'key',
  bpm: 'tempo',           // Note: field name difference
  duration: 'duration',
  notes: 'notes',
  contextId: 'context_id',
  contextType: 'context_type',
  createdBy: 'created_by',
  createdDate: 'created_date',
  updatedDate: 'updated_date',
  version: 'version',
  lastModifiedBy: 'last_modified_by',
  // MISSING: spotifyUrl, youtubeUrl, guitarProUrl
},
```

**Why it fails:**

1. When songs are saved via `RemoteRepository.updateEntity()`, only mapped fields are sent to Supabase
2. The external link fields (`spotifyUrl`, `youtubeUrl`, `guitarProUrl`) exist in:
   - TypeScript Song interface (`src/types/index.ts:35-37`)
   - Supabase schema (`spotify_url`, `youtube_url`, `guitar_pro_url` columns)
   - LocalRepository (stores all Song fields to IndexedDB)
   - RemoteRepository field mappings (MISSING)
3. When `applyFieldMappings()` is called, unmapped fields are silently dropped
4. Result: External links are saved locally but never sent to Supabase

## Evidence

### 1. Supabase Schema (Correct)

**File:** `supabase/migrations/20251106000000_baseline_schema.sql:107-109`

```sql
CREATE TABLE public.songs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT,
  key TEXT,
  tempo INTEGER,
  duration INTEGER,
  notes TEXT,
  context_id TEXT,
  context_type TEXT CHECK (context_type IN ('band', 'personal')),
  spotify_url TEXT,      -- Column exists
  youtube_url TEXT,      -- Column exists
  guitar_pro_url TEXT,   -- Column exists
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW(),
  version INTEGER DEFAULT 1,
  last_modified_by UUID REFERENCES auth.users(id)
);
```

### 2. TypeScript Song Type (Correct)

**File:** `src/types/index.ts:26-48`

```typescript
export interface Song {
  id: string
  title: string
  artist: string
  key?: string
  bpm?: number
  duration?: number
  notes?: string
  contextId: string
  contextType: 'band' | 'personal'
  spotifyUrl?: string // Field exists
  youtubeUrl?: string // Field exists
  guitarProUrl?: string // Field exists
  createdBy: string
  createdDate: Date
  updatedDate: Date
  version: number
  lastModifiedBy?: string
}
```

### 3. RemoteRepository Field Mappings (INCOMPLETE)

**File:** `src/services/data/RemoteRepository.ts:76-97`

The songs field mappings are missing `spotifyUrl`, `youtubeUrl`, and `guitarProUrl`.

### 4. Data Flow Analysis

**When user saves a song with external links:**

```
User adds links in UI
  ↓
SongForm updates Song object with spotifyUrl, youtubeUrl, guitarProUrl
  ↓
SyncRepository.updateSong() called
  ↓
LocalRepository.updateEntity() - Saves ALL fields to IndexedDB
  ↓
RemoteRepository.updateEntity() - Only sends MAPPED fields to Supabase
  ↓
applyFieldMappings() drops spotifyUrl, youtubeUrl, guitarProUrl
  ↓
Supabase receives song WITHOUT external links
```

**When user loads songs on another device:**

```
User logs in on new device
  ↓
SyncEngine.performInitialSync() runs
  ↓
RemoteRepository.getAllEntities('songs') - Gets songs from Supabase
  ↓
reverseFieldMappings() - Doesn't include spotifyUrl, youtubeUrl, guitarProUrl
  ↓
LocalRepository stores songs WITHOUT external links
  ↓
UI shows songs without external links
```

## Fix Plan

### Fix 1: Add Missing Field Mappings

**File:** `src/services/data/RemoteRepository.ts`

**Change:** Add three lines to the songs field mappings:

```typescript
songs: {
  id: 'id',
  title: 'title',
  artist: 'artist',
  key: 'key',
  bpm: 'tempo',
  duration: 'duration',
  notes: 'notes',
  contextId: 'context_id',
  contextType: 'context_type',
  spotifyUrl: 'spotify_url',      // ADD THIS
  youtubeUrl: 'youtube_url',      // ADD THIS
  guitarProUrl: 'guitar_pro_url', // ADD THIS
  createdBy: 'created_by',
  createdDate: 'created_date',
  updatedDate: 'updated_date',
  version: 'version',
  lastModifiedBy: 'last_modified_by',
},
```

### Fix 2: Update Unified Schema Documentation

**File:** `.claude/specifications/unified-database-schema.md`

Add external link fields to songs table documentation with field mappings:

- `spotifyUrl` ↔ `spotify_url`
- `youtubeUrl` ↔ `youtube_url`
- `guitarProUrl` ↔ `guitar_pro_url`

### Fix 3: Add Test Coverage

Create unit tests to verify external link fields are mapped correctly in both directions.

## Verification Steps

1. Apply the fix to RemoteRepository.ts
2. Run unit tests: `npm test -- tests/unit/services/data/RemoteRepository.test.ts`
3. Manual test:
   - Create a song with external links
   - Check Supabase Studio to verify links are saved
   - Clear IndexedDB and refresh
   - Verify links reload from Supabase

## Data Recovery

Users who added external links on their PC still have that data in their local IndexedDB. Once the fix is deployed:

1. User should update the song again (e.g., change title slightly)
2. This will trigger a save with the corrected field mappings
3. External links will sync to Supabase
4. Links will then appear on other devices

**No data loss occurred** - just a sync issue.
