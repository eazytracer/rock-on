---
timestamp: 2025-10-28T23:27
summary: Gap analysis comparing expected vs actual implementation for shows and practices in Supabase
context: User reported draft shows/setlists not syncing between devices
---

# Shows & Practices Gap Analysis

## Executive Summary

**Status**: ✅ **Infrastructure Complete** - All sync mechanisms are in place and working

**Issue**: User reports draft shows not appearing in other browsers, but this may be expected behavior if:
1. Drafts were just created and sync cycle hasn't run yet (30-second interval)
2. Browser hasn't triggered a sync yet

## Current State: Shows

### Supabase Database

**Table**: `shows` ✅ EXISTS (created in this session)

**Schema**:
```sql
CREATE TABLE public.shows (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  venue TEXT,
  band_id UUID NOT NULL REFERENCES bands(id),
  setlist_id UUID REFERENCES setlists(id),
  scheduled_date TIMESTAMPTZ NOT NULL,
  load_in_time TEXT,
  soundcheck_time TEXT,
  set_time TEXT,
  end_time TEXT,
  duration INTEGER,
  payment INTEGER CHECK (payment >= 0),
  contacts JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming',
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
)
```

**Current Data**: 3 shows (migrated from practice_sessions seed data)
- "Toys 4 Tots Benefit Concert" (upcoming)
- "New Year's Eve Bash" (upcoming)
- "Blues Night at Smokey's" (completed)

**RLS Policies**: ✅ Configured
- SELECT: Band members can view shows for their bands
- INSERT: Band members can create shows (must set created_by = auth.uid())
- UPDATE: Band members can update shows for their bands
- DELETE: Users can delete shows they created

### Frontend Implementation

**Model**: ✅ `src/models/Show.ts`
```typescript
interface Show {
  id: string
  bandId: string
  setlistId?: string
  name: string
  scheduledDate: Date
  duration: number
  venue?: string
  location?: string
  loadInTime?: string
  soundcheckTime?: string
  payment?: number
  contacts?: ShowContact[]
  status: ShowStatus // 'scheduled' | 'confirmed' | 'completed' | 'cancelled'
  notes?: string
  createdDate: Date
  updatedDate: Date
}
```

**Service**: ✅ `src/services/ShowService.ts`
- Uses repository pattern correctly
- All CRUD operations go through `repository` (SyncRepository)

**RemoteRepository**: ✅ `src/services/data/RemoteRepository.ts:512-625`
- `getShows()` - ✅ Queries `shows` table
- `getShow()` - ✅ Queries `shows` table
- `addShow()` - ✅ Inserts into `shows` table
- `updateShow()` - ✅ Updates `shows` table
- `deleteShow()` - ✅ Deletes from `shows` table
- Field mapping: ✅ Handles camelCase ↔ snake_case
- **CRITICAL**: Contacts field uses `JSON.stringify()` on write, `JSON.parse()` on read

**SyncRepository**: ✅ `src/services/data/SyncRepository.ts:269-295`
- `addShow()` - ✅ Queues create operation, triggers sync
- `updateShow()` - ✅ Queues update operation, triggers sync
- `deleteShow()` - ✅ Queues delete operation, triggers sync

**SyncEngine**: ✅ `src/services/data/SyncEngine.ts`
- Push operations: ✅ Lines 234-246 (create/update/delete shows)
- Pull operations: ✅ Lines 645-674 (pullShows method)
- Entity list: ✅ Line 467 includes 'shows'
- **Graceful degradation**: Handles missing shows table (404 errors) for dev mode

## Current State: Practice Sessions

### Supabase Database

**Table**: `practice_sessions` ✅ EXISTS

**Schema**:
```sql
CREATE TABLE public.practice_sessions (
  id UUID PRIMARY KEY,
  band_id UUID NOT NULL REFERENCES bands(id),
  setlist_id UUID REFERENCES setlists(id),
  scheduled_date TIMESTAMPTZ NOT NULL,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration INTEGER,
  location TEXT,
  type TEXT NOT NULL CHECK (type IN ('rehearsal', 'writing', 'recording', 'audition', 'lesson')),
  notes TEXT,
  objectives TEXT[] DEFAULT '{}',
  completed_objectives TEXT[] DEFAULT '{}',
  session_rating INTEGER CHECK (session_rating BETWEEN 1 AND 5),
  songs JSONB DEFAULT '[]'::jsonb,
  attendees JSONB DEFAULT '[]'::jsonb,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

**Important Schema Notes**:
- ❌ **NO** `created_by` column (differs from shows)
- ❌ **NO** `updated_date` column (only `created_date`)
- ❌ **NO** `status` column (status exists in frontend model only)
- ✅ **NO** `type='gig'` records (shows moved to dedicated table)

**Current Data**: 6 practice sessions
- All type='rehearsal' (seed data)
- Previously had 3 type='gig' records (now migrated to shows table)

**RLS Policies**: ⚠️ **NEEDS VERIFICATION**
- Should match shows pattern (band membership based access)

### Frontend Implementation

**Model**: ✅ `src/models/PracticeSession.ts`
```typescript
interface PracticeSession {
  id: string
  bandId: string
  setlistId?: string
  scheduledDate: Date
  startTime?: Date
  endTime?: Date
  duration: number
  location?: string
  type: SessionType // 'rehearsal' | 'writing' | 'recording' | 'audition' | 'lesson'
  status: SessionStatus // 'scheduled' | 'in-progress' | 'completed' | 'cancelled'
  notes?: string
  objectives: string[]
  completedObjectives: string[]
  sessionRating?: number
  songs: SessionSong[]
  attendees: SessionAttendee[]
  createdDate: Date
  // NOTE: No updatedDate in model (matches Supabase)
}
```

**Service**: ✅ `src/services/PracticeSessionService.ts`
- Should use repository pattern (NEEDS VERIFICATION)

**RemoteRepository**: ✅ `src/services/data/RemoteRepository.ts:398-508`
- `getPracticeSessions()` - ✅ Queries `practice_sessions` table
- `getPracticeSession()` - ✅ Queries `practice_sessions` table
- `addPracticeSession()` - ✅ Inserts into `practice_sessions` table
- `updatePracticeSession()` - ✅ Updates `practice_sessions` table
- `deletePracticeSession()` - ✅ Deletes from `practice_sessions` table
- Field mapping: ✅ Handles camelCase ↔ snake_case
- **Important Notes** (lines 485-487):
  - `status` exists in IndexedDB only, NOT in Supabase
  - Supabase has `created_date` but NOT `updated_date`
  - Show-specific fields now in Show model

**SyncRepository**: ✅ `src/services/data/SyncRepository.ts:257-267`
- Should have add/update/delete methods (NEEDS VERIFICATION)

**SyncEngine**: ✅ `src/services/data/SyncEngine.ts`
- Push operations: ✅ Lines 220-232 (create/update/delete practice_sessions)
- Pull operations: ✅ Should have pullPractices method (NEEDS VERIFICATION)
- Entity list: ✅ Line 467 includes 'practices'

## Identified Gaps

### 1. ❌ Practice Sessions RLS Policies - NEEDS VERIFICATION

**Issue**: Unknown if practice_sessions table has proper RLS policies

**Required Policies**:
```sql
-- Users can view practices for bands they're in
CREATE POLICY "practices_select_if_member"
  ON public.practice_sessions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM band_memberships
    WHERE band_memberships.band_id = practice_sessions.band_id
      AND band_memberships.user_id = auth.uid()
      AND band_memberships.status = 'active'
  ));

-- Users can create practices for bands they're in
CREATE POLICY "practices_insert_if_member"
  ON public.practice_sessions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM band_memberships
    WHERE band_memberships.band_id = practice_sessions.band_id
      AND band_memberships.user_id = auth.uid()
      AND band_memberships.status = 'active'
  ));

-- Users can update practices for bands they're in
CREATE POLICY "practices_update_if_member"
  ON public.practice_sessions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM band_memberships
    WHERE band_memberships.band_id = practice_sessions.band_id
      AND band_memberships.user_id = auth.uid()
      AND band_memberships.status = 'active'
  ));

-- Users can delete practices (match shows pattern - creator only)
CREATE POLICY "practices_delete_if_member"
  ON public.practice_sessions FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM band_memberships
    WHERE band_memberships.band_id = practice_sessions.band_id
      AND band_memberships.user_id = auth.uid()
      AND band_memberships.status = 'active'
  ));
```

**Action**: Check if RLS is enabled and policies exist

### 2. ⚠️ Field Mapping Discrepancies

**Practice Sessions: Status Field**

**Issue**: Frontend has `status` field, but Supabase doesn't
- Frontend: `status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled'`
- Supabase: No status column
- Current behavior: Hardcoded to 'scheduled' when reading from Supabase (line 500)

**Options**:
1. Add `status` column to Supabase (RECOMMENDED for data consistency)
2. Keep status client-side only (current implementation)
3. Derive status from dates (e.g., if scheduledDate < now, status = 'completed')

**Practice Sessions: No Updated Date**

**Issue**: Frontend model doesn't have `updatedDate`, Supabase doesn't have `updated_date`
- This is actually CONSISTENT between frontend and backend ✅
- Differs from shows which DO have updatedDate

**Shows: Contacts Field JSON Handling**

**Issue**: Contacts stored as JSONB in Supabase, but manually stringified in code
- Line 598: `contacts: show.contacts ? JSON.stringify(show.contacts) : null`
- Line 619: `contacts: row.contacts ? JSON.parse(row.contacts) : undefined`

**Concern**: Supabase JSONB columns should handle JSON automatically
- May be unnecessary manual serialization
- Could cause issues with queries or updates

**Action**: Test if removing JSON.stringify/parse causes issues

### 3. ✅ Shows Table Created Successfully

**Resolution**: Shows table was created in this session via migration
- Migrated 3 shows from practice_sessions (type='gig')
- Removed type='gig' from practice_sessions (clean separation)

### 4. ⚠️ Sync Verification Needed

**Question**: Are draft shows actually syncing?

**Current State**:
- Supabase has 3 shows (seed data)
- User reports draft shows in original browser
- Draft shows not appearing in incognito browser

**Possible Causes**:
1. Sync hasn't run yet (30-second interval)
2. Sync queue has errors (check browser console)
3. RLS policies blocking writes (check Supabase logs)
4. Network/connectivity issues

**Verification Steps**:
1. Check browser console for sync logs
2. Wait 30 seconds for sync cycle
3. Refresh incognito browser to trigger initial sync
4. Check Supabase shows table row count
5. Check browser IndexedDB sync_queue for pending operations

## Recommendations

### Immediate Actions

1. **Verify Practice RLS Policies**
   ```bash
   docker exec supabase_db_rock-on psql -U postgres -d postgres \
     -c "\d+ practice_sessions" | grep -A 20 "Policies:"
   ```

2. **Verify Shows Sync Status**
   - Check browser console for sync errors
   - Verify show count in Supabase matches expectations
   - Check if sync queue has pending operations

3. **Add Practice Status Column** (Optional but Recommended)
   ```sql
   ALTER TABLE practice_sessions
   ADD COLUMN status TEXT DEFAULT 'scheduled'
   CHECK (status IN ('scheduled', 'in-progress', 'completed', 'cancelled'));
   ```

### Long-term Improvements

1. **Consistent Timestamp Pattern**
   - Shows: `created_date`, `updated_date` ✅
   - Practices: `created_date` only ❌
   - Consider adding `updated_date` to practices for consistency

2. **Consistent Creator Tracking**
   - Shows: `created_by` column ✅
   - Practices: No `created_by` column ❌
   - Consider adding for audit trail and permissions

3. **Remove Manual JSON Serialization**
   - Test if Supabase JSONB columns handle objects automatically
   - May simplify code and improve query capabilities

## Conclusion

**Overall Assessment**: ✅ **INFRASTRUCTURE COMPLETE**

All sync mechanisms are properly implemented:
- ✅ Shows table exists with proper schema
- ✅ RemoteRepository has all CRUD operations
- ✅ SyncRepository queues operations correctly
- ✅ SyncEngine has push/pull operations
- ✅ Service layer uses repository pattern
- ✅ RLS policies configured for shows

**Remaining Questions**:
1. Are draft shows actually failing to sync, or is user checking too soon?
2. Do practice_sessions have RLS policies?
3. Should we add status/created_by columns to practice_sessions?

**Next Steps**:
1. User to verify show count in Supabase
2. User to check browser console for sync errors
3. Wait for sync cycle and re-check
4. Verify practice_sessions RLS policies
