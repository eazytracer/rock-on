---
title: Phase 4a Quick Start Guide
created: 2025-10-31T00:31
status: Ready to Execute
phase: Phase 4a
type: Quick Reference
---

# Phase 4a - Full Audit System - Quick Start

## 🚀 TL;DR - Start Here

**What:** Full version control for all records (like git history)

**Time:** ~5 hours

**Files Created:**
- ✅ Migration: `supabase/migrations/20251031000001_add_audit_tracking.sql`
- ✅ Implementation Plan: `.claude/artifacts/2025-10-31T00:30_phase4a-full-audit-implementation-plan.md`

---

## ⚡ Quick Commands

### Apply Migration
```bash
# Apply all migrations (including the new audit tracking)
supabase db reset

# Verify it worked
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "
SELECT table_name, column_name
FROM information_schema.columns
WHERE column_name = 'last_modified_by'
ORDER BY table_name;
"
# Should show 4 rows (songs, setlists, shows, practice_sessions)
```

### Test Audit Log
```sql
-- Insert a test song
INSERT INTO songs (id, title, artist, context_id, created_by)
VALUES ('test-1', 'Test', 'Artist',
        (SELECT id FROM bands LIMIT 1),
        (SELECT id FROM users LIMIT 1));

-- Check audit log
SELECT action, user_name, new_values->>'title' as title
FROM audit_log
WHERE table_name = 'songs' AND record_id = 'test-1';
-- Should show INSERT entry

-- Update the song
UPDATE songs SET title = 'Updated' WHERE id = 'test-1';

-- Check audit log again
SELECT action, old_values->>'title' as old, new_values->>'title' as new
FROM audit_log
WHERE table_name = 'songs' AND record_id = 'test-1'
ORDER BY changed_at DESC;
-- Should show INSERT and UPDATE

-- Clean up
DELETE FROM songs WHERE id = 'test-1';
```

### Run Tests
```bash
# Type check
npm run type-check

# Unit tests
npm test -- tests/unit/services/data/RealtimeManager.test.ts --run

# Integration tests (after creating test file)
npm test -- tests/integration/audit-tracking.test.ts --run
```

---

## 📋 Implementation Checklist (High-Level)

### Phase 1: Database (30 min)
- [ ] Apply migration: `supabase db reset`
- [ ] Verify columns exist
- [ ] Verify triggers installed
- [ ] Test with INSERT/UPDATE/DELETE

### Phase 2: TypeScript (30 min)
- [ ] Update Song.ts (add `lastModifiedBy?`)
- [ ] Update Setlist.ts (add `lastModifiedBy?`)
- [ ] Update Show.ts (add `lastModifiedBy?`)
- [ ] Update PracticeSession.ts (add `lastModifiedBy?`)
- [ ] Run `npm run type-check`

### Phase 3: Repository (45 min)
- [ ] Update `convertSongFromSupabase`
- [ ] Update `convertSongToSupabase`
- [ ] Repeat for Setlist, Show, PracticeSession (6 more functions)
- [ ] Run `npm run type-check`

### Phase 4: RealtimeManager (30 min)
- [ ] Restore user filtering in `handleSongChange`
- [ ] Restore user filtering in `handleSetlistChange`
- [ ] Restore user filtering in `handleShowChange`
- [ ] Restore user filtering in `handlePracticeSessionChange`
- [ ] Run `npm run type-check`

### Phase 5: Testing (90 min)
- [ ] Fix RealtimeManager.test.ts (if needed)
- [ ] Create audit-tracking.test.ts
- [ ] Manual two-device test
- [ ] Verify users don't see own changes

### Phase 6: Documentation (30 min)
- [ ] Update schema documentation
- [ ] Create completion report
- [ ] Update roadmap

---

## 🎯 Key Code Changes

### TypeScript Model
```typescript
export interface Song {
  // ... existing fields
  lastModifiedBy?: string  // 🆕 ADD THIS
  // ... rest of fields
}
```

### Conversion Function (RemoteRepository.ts)
```typescript
// FROM Supabase
export function convertSongFromSupabase(row: SupabaseSong): Song {
  return {
    // ... existing fields
    lastModifiedBy: row.last_modified_by || undefined,  // 🆕 ADD THIS
    // ... rest of fields
  }
}

// TO Supabase
export function convertSongToSupabase(song: Song): SupabaseSong {
  return {
    // ... existing fields
    last_modified_by: song.lastModifiedBy || null,  // 🆕 ADD THIS
    // ... rest of fields
  }
}
```

### RealtimeManager User Filtering
```typescript
private async handleSongChange(payload: RealtimePayload): Promise<void> {
  if (eventType === 'INSERT' || eventType === 'UPDATE') {
    // 🆕 ADD THIS CHECK
    const modifiedBy = newRow.last_modified_by || newRow.created_by
    if (modifiedBy === this.currentUserId) {
      console.log('[RealtimeManager] Skipping own change')
      return  // Don't refetch or show toast for own changes
    }

    // ... rest of handler
  }
}
```

---

## 📊 What You Get

### 1. Last Modified Tracking
```sql
SELECT id, title, created_by, last_modified_by
FROM songs
WHERE context_id = 'some-band-id';
```

### 2. Complete Change History
```sql
-- All changes to a song
SELECT changed_at, action, user_name,
       old_values->>'title' as old_title,
       new_values->>'title' as new_title
FROM audit_log
WHERE table_name = 'songs' AND record_id = 'song-id'
ORDER BY changed_at DESC;
```

### 3. Recent Activity
```sql
-- Last 50 changes in a band
SELECT changed_at, table_name, action, user_name,
       new_values->>'title' || new_values->>'name' as item_name
FROM audit_log
WHERE band_id = 'band-id'
ORDER BY changed_at DESC
LIMIT 50;
```

### 4. User Activity
```sql
-- What Mike did today
SELECT changed_at, table_name, action,
       new_values->>'title' || new_values->>'name' as item
FROM audit_log
WHERE user_id = 'mike-id'
  AND changed_at > CURRENT_DATE
ORDER BY changed_at DESC;
```

---

## ✅ Success Validation

### After Migration
```bash
# Should return 4 rows
psql $DATABASE_URL -c "
SELECT COUNT(*) FROM information_schema.columns
WHERE column_name = 'last_modified_by'
  AND table_schema = 'public';
"
# Expected: count = 4

# Should return 12 rows (3 triggers per table)
psql $DATABASE_URL -c "
SELECT COUNT(*) FROM information_schema.triggers
WHERE trigger_name LIKE '%modified_by%'
   OR trigger_name LIKE '%audit_log%';
"
# Expected: count = 12
```

### After Code Changes
```bash
# Should pass with zero errors
npm run type-check

# Should pass with zero errors
npm run lint
```

### After Testing
- [ ] Users don't see toasts for their own changes
- [ ] Users DO see toasts for others' changes
- [ ] Audit log has entries for all operations
- [ ] History shows old → new values correctly

---

## 🔗 Full Documentation

**Detailed Plan:** `.claude/artifacts/2025-10-31T00:30_phase4a-full-audit-implementation-plan.md`

**Migration File:** `supabase/migrations/20251031000001_add_audit_tracking.sql`

**Phase 4 Summary:** `.claude/artifacts/2025-10-31T00:22_phase4-final-summary.md`

---

## 🆘 Troubleshooting

### Migration fails
```bash
# Check migration file syntax
cat supabase/migrations/20251031000001_add_audit_tracking.sql | head -50

# Check Supabase logs
docker logs supabase_db_rock-on

# Try fresh reset
supabase stop
supabase start
supabase db reset
```

### TypeScript errors
```bash
# Check which files have errors
npm run type-check 2>&1 | grep "error TS"

# Common issues:
# - Forgot to add lastModifiedBy to interface
# - Forgot to add in conversion function
# - Typo in field name (lastModifiedBy vs last_modified_by)
```

### Tests fail
```bash
# Run specific test with verbose output
npm test -- tests/unit/services/data/RealtimeManager.test.ts --run --reporter=verbose

# Common issues:
# - Mocks not returning last_modified_by field
# - User filtering logic incorrect
# - Forgot to clear mocks between tests
```

### Users still see own changes
1. Check RealtimeManager has user filtering logic
2. Verify `last_modified_by` is in Supabase response
3. Check `this.currentUserId` is set correctly
4. Add console.log to debug:
   ```typescript
   console.log('modifiedBy:', modifiedBy, 'currentUserId:', this.currentUserId)
   ```

---

**Created:** 2025-10-31T00:31
**Status:** Ready to Use ✅
**Estimated Time:** 5 hours
