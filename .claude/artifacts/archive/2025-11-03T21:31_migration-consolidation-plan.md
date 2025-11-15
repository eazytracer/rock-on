---
title: Database Migration Consolidation Plan
created: 2025-11-03T21:31
summary: Plan to consolidate 17 incremental migrations into a single baseline for fresh installations
status: Ready for Implementation
---

# Database Migration Consolidation Plan

## Current State

**Problem:** We have 17 incremental migration files that add/modify schema elements. For fresh installations, this is inefficient and confusing.

**Current Migrations:**
```
20251025000000_initial_schema.sql           (318 lines - baseline)
20251026160000_rebuild_rls_policies.sql     (RLS fixes)
20251026170000_add_setlist_items.sql        (Setlist JSONB)
20251026170100_fix_setlist_trigger.sql      (Trigger fix)
20251026190000_add_gig_type.sql             (Show type field)
20251026190100_add_show_fields.sql          (Additional fields)
20251026190200_add_setlist_forking.sql      (Forking support)
20251026213000_enable_rls.sql               (RLS enable)
20251026221000_fix_rls_recursion.sql        (RLS fix 1)
20251026221100_fix_rls_recursion_v2.sql     (RLS fix 2)
20251026221500_fix_song_delete_policy.sql   (RLS fix 3)
20251028000000_create_shows_table.sql       (Shows schema)
20251029000001_add_version_tracking.sql     (Sync version fields)
20251030000001_enable_realtime.sql          (Realtime publication)
20251030000002_enable_realtime_replica_identity.sql (REPLICA IDENTITY FULL)
20251031000001_add_audit_tracking.sql       (Audit log + triggers)
20251101000001_enable_audit_log_realtime.sql (Audit realtime)
```

## Consolidation Strategy

### Option A: Single Baseline Migration (Recommended for MVP)

**Create:** `20251104000000_baseline_schema.sql`

**Contents:**
1. All table definitions (from initial + modifications)
2. All indexes
3. All triggers (final versions only)
4. RLS policies (working versions)
5. Realtime configuration
6. Audit tracking
7. Version tracking

**Benefits:**
- Clean fresh install (single file)
- No need to run 17 migrations
- Easier to understand complete schema
- Faster deployment

**Migration Path:**
- Existing databases: Keep current migrations (already applied)
- Fresh installs: Use consolidated baseline only

### Option B: Phased Consolidation

**Keep 3 files:**
1. `baseline_schema.sql` - Core tables + RLS
2. `realtime_and_sync.sql` - Realtime + audit + versioning
3. `future_migrations.sql` - New changes go here

**Benefits:**
- Clearer separation of concerns
- Easier to see what changed when
- Better for documentation

**Drawback:**
- Still 3 files to run

### Recommended: Option A

For a fresh MVP deployment, a single comprehensive baseline is clearest.

## Implementation Plan

### Step 1: Create Consolidated Baseline

**File:** `supabase/migrations/20251104000000_baseline_schema.sql`

**Structure:**
```sql
-- ============================================================================
-- Rock On - Baseline Schema Migration
-- Created: 2025-11-04
-- Description: Consolidated schema for fresh installations
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- SECTION 1: Core Tables
-- ============================================================================

-- Users, Bands, Memberships, Invite Codes
-- Songs, Setlists, Shows, Practice Sessions
-- (All with final schema including modifications)

-- ============================================================================
-- SECTION 2: Supporting Tables
-- ============================================================================

-- Song castings, assignments, templates, capabilities

-- ============================================================================
-- SECTION 3: Sync & Audit Infrastructure
-- ============================================================================

-- Version tracking fields (created_by, last_modified_by, version)
-- Audit log table
-- Audit triggers for all tables

-- ============================================================================
-- SECTION 4: Indexes
-- ============================================================================

-- Performance indexes for common queries

-- ============================================================================
-- SECTION 5: Row-Level Security
-- ============================================================================

-- RLS policies (final working versions)

-- ============================================================================
-- SECTION 6: Realtime Configuration
-- ============================================================================

-- Enable realtime publication
-- Set REPLICA IDENTITY FULL
-- Enable audit_log realtime

-- ============================================================================
-- SECTION 7: Functions & Triggers
-- ============================================================================

-- update_updated_date() function
-- Audit logging functions
-- Auto-populate triggers
```

### Step 2: Archive Old Migrations

**Create:** `supabase/migrations/archive/` directory

**Move existing migrations:**
```bash
mkdir -p supabase/migrations/archive
mv supabase/migrations/202510*.sql supabase/migrations/archive/
mv supabase/migrations/202511*.sql supabase/migrations/archive/
```

**Keep:**
- Archive for reference
- Document migration history
- Useful for understanding evolution

### Step 3: Update Documentation

**Files to update:**
1. `deployment-guide.md` - Update migration list
2. `CLAUDE.md` - Update database setup instructions
3. `README.md` - Mention single baseline migration

**New content:**
```markdown
## Database Setup (Fresh Install)

For a fresh Supabase project:

1. Apply baseline migration:
   ```bash
   supabase db push
   ```

2. That's it! Single migration sets up:
   - All tables
   - RLS policies
   - Realtime sync
   - Audit tracking
   - Triggers & functions

## Database Setup (Existing Install)

If you have an existing database with old migrations:
- Do nothing! Migrations already applied
- New changes will use incremental migrations
```

### Step 4: Test Consolidated Migration

**Fresh Database Test:**
```bash
# 1. Start fresh local Supabase
supabase stop
supabase db reset

# 2. Should apply only baseline migration
supabase start

# 3. Verify schema
supabase db diff

# 4. Run seed data
npm run seed
```

**Verification Checklist:**
- [ ] All tables created
- [ ] RLS enabled on all tables
- [ ] Realtime working
- [ ] Audit triggers working
- [ ] Version fields present
- [ ] Indexes created
- [ ] Functions exist

### Step 5: Update Deployment Guide

**Sections to update:**
- Remove "apply migrations in order" instructions
- Replace with "apply baseline migration"
- Update verification queries
- Simplify rollback procedures

## Key Schema Elements to Include

### Core Tables (8)
1. `users` - With auth sync
2. `bands` - With updated_date
3. `band_memberships` - With status field
4. `invite_codes` - With usage tracking
5. `songs` - With version + lastModifiedBy
6. `setlists` - With items JSONB + lastModifiedBy
7. `shows` - With gig_type + lastModifiedBy
8. `practice_sessions` - With version

### Audit & Sync Tables (1)
9. `audit_log` - Complete with JSONB columns + realtime

### Supporting Tables (Optional for MVP)
- `song_castings` - Band-specific song configs
- `song_assignments` - Who plays what
- `assignment_roles` - Instrument details
- `casting_templates` - Reusable configurations
- `member_capabilities` - User skills

### Critical Features to Include

**Version Tracking:**
```sql
ALTER TABLE songs ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE songs ADD COLUMN last_modified_by UUID REFERENCES users(id);
ALTER TABLE songs ADD COLUMN created_by UUID REFERENCES users(id);
-- Repeat for setlists, shows, practice_sessions
```

**Audit Log:**
```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  action TEXT NOT NULL,
  record_id TEXT NOT NULL,
  band_id UUID REFERENCES bands(id),
  user_id UUID REFERENCES users(id),
  user_name TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  old_values JSONB,
  new_values JSONB
);
```

**Realtime:**
```sql
-- Enable publication
ALTER PUBLICATION supabase_realtime ADD TABLE songs;
ALTER PUBLICATION supabase_realtime ADD TABLE setlists;
ALTER PUBLICATION supabase_realtime ADD TABLE shows;
ALTER PUBLICATION supabase_realtime ADD TABLE practice_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE audit_log;

-- Set replica identity
ALTER TABLE songs REPLICA IDENTITY FULL;
ALTER TABLE setlists REPLICA IDENTITY FULL;
-- etc.
```

**RLS Policies:**
```sql
-- Users can read/write their own data
-- Band members can read/write band data
-- Audit log is read-only for band members
-- Invite codes readable by band members
```

## Future Migration Strategy

**After Baseline:**
- New schema changes → New incremental migrations
- Example: `20251105000001_add_song_attachments.sql`
- Keep focused and atomic
- Include rollback steps in comments

**Best Practices:**
```sql
-- Migration: Add song attachments table
-- Created: 2025-11-05
-- Rollback: DROP TABLE song_attachments;

CREATE TABLE song_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  uploaded_by UUID REFERENCES users(id),
  uploaded_date TIMESTAMPTZ DEFAULT NOW()
);
```

## Deployment Impact

### For Production Deployment

**If database is empty (first deploy):**
- Apply baseline migration
- Fast and clean

**If database has data (existing deploy):**
- Don't touch migrations!
- Existing migrations already applied
- Continue with incremental migrations

### For Local Development

**New developer setup:**
```bash
git clone repo
supabase start  # Applies baseline
npm run seed    # Optional test data
```

**Much simpler than:**
```bash
supabase start  # Applies 17 migrations sequentially
# Wait for each to complete
# Hope nothing breaks
```

## Timeline

**Estimated effort:** 2-3 hours

1. **Create baseline migration** (1 hour)
   - Copy initial_schema.sql
   - Merge in modifications
   - Add realtime + audit
   - Add version tracking

2. **Test locally** (30 min)
   - Fresh database test
   - Verify all features work

3. **Update docs** (30 min)
   - Deployment guide
   - CLAUDE.md
   - README

4. **Archive old migrations** (15 min)
   - Create archive folder
   - Move old files
   - Keep for reference

## Rollback Plan

**If consolidated migration fails:**
1. Restore archive folder
2. Re-apply original 17 migrations
3. Fix issues in baseline
4. Try again

**Safety:**
- Keep originals in archive
- Test on fresh local database first
- Don't apply to production until tested

## Success Criteria

- [ ] Single baseline migration file created
- [ ] Fresh local database setup works
- [ ] All tables + features present
- [ ] Realtime sync functional
- [ ] Audit logging working
- [ ] RLS policies active
- [ ] Tests passing
- [ ] Documentation updated

## Next Steps

1. Create baseline migration file
2. Test with `supabase db reset`
3. Run full test suite
4. Update deployment guide
5. Document in CLAUDE.md
6. Ready for production deployment

---

**Status:** Ready to implement
**Priority:** Medium (cleanup task, not blocking deployment)
**Owner:** Development team
**Estimated Time:** 2-3 hours
