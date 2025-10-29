---
timestamp: 2025-10-29T00:10
summary: Audit of all SQL files in repository with cleanup recommendations for dev mode
context: User wants a single script path for setting up databases from scratch in dev mode
---

# SQL Files Cleanup Plan

## Current State Analysis

**Total SQL Files Found:** 22 files across 3 locations

### File Locations:
- `supabase/migrations/` - 12 migration files
- `supabase/` - 6 seed files
- `supabase/seeds/` - 4 seed files (old structure)
- `scripts/` - 2 init/seed files

---

## File Inventory & Status

### ✅ KEEP - Active Migration Files

**Location:** `supabase/migrations/`

These are Supabase's incremental migration system. Keep all for proper migration tracking.

| File | Purpose | Status | Notes |
|------|---------|--------|-------|
| `20251025000000_initial_schema.sql` | Initial database schema | ✅ KEEP | Foundation schema |
| `20251026160000_rebuild_rls_policies.sql` | RLS policy fixes | ✅ KEEP | Security policies |
| `20251026170000_add_setlist_items.sql` | Setlist items column | ✅ KEEP | Feature addition |
| `20251026170100_fix_setlist_trigger.sql` | Setlist trigger fix | ✅ KEEP | Bug fix |
| `20251026190000_add_gig_type.sql` | Add gig type to practices | ✅ KEEP | Feature addition |
| `20251026190100_add_show_fields.sql` | Add show-specific fields | ✅ KEEP | Feature addition |
| `20251026190200_add_setlist_forking.sql` | Setlist forking support | ✅ KEEP | Feature addition |
| `20251026213000_enable_rls.sql` | Enable RLS | ✅ KEEP | Security |
| `20251026221000_fix_rls_recursion.sql` | Fix RLS recursion | ✅ KEEP | Bug fix |
| `20251026221100_fix_rls_recursion_v2.sql` | Fix RLS recursion v2 | ✅ KEEP | Bug fix |
| `20251026221500_fix_song_delete_policy.sql` | Fix song delete policy | ✅ KEEP | Bug fix |
| `20251028000000_create_shows_table.sql` | **Shows table separation** | ✅ KEEP | **CRITICAL - Latest** |

**Total Migrations:** 12 files (726 lines combined via fresh_init.sql base)

---

### ✅ KEEP - Primary Seed File

| File | Purpose | Status | Notes |
|------|---------|--------|-------|
| `supabase/seed-local-dev.sql` | **Primary comprehensive seed** | ✅ KEEP | 282 lines, creates auth users + full test data |

**This is your main seed file for dev mode:**
- Creates auth.users with proper hashed passwords
- Creates public.users, bands, band_memberships
- Creates test songs (18 songs for iPod Shuffle band)
- Creates test setlists (2 setlists)
- Creates test practice sessions (6 practices)
- **Password for all test users:** `test123`

**Test Users:**
- eric@ipodshuffle.com (7e75840e-9d91-422e-a949-849f0b8e2ea4)
- mike@ipodshuffle.com (0c9c3e47-a4e0-4b70-99db-3e14c89ba9b3)
- sarah@ipodshuffle.com (b7e6bb62-5c26-4a78-be6b-2e7a1cbe5f77)

---

### ❌ DELETE - Redundant/Obsolete Files

#### Root Level Seed Files (Redundant)

| File | Purpose | Lines | Why Delete |
|------|---------|-------|------------|
| `supabase/seed.sql` | Empty file | 0 | ❌ Empty, no content |
| `supabase/seed-dev-users.sql` | User creation only | 75 | ❌ Superseded by seed-local-dev.sql |
| `supabase/seed-full-catalog.sql` | Song catalog (sequential IDs) | 56 | ❌ Superseded by random-ids version |
| `supabase/seed-full-catalog-random-ids.sql` | Song catalog (random IDs) | 55 | ❌ Partial seed, redundant with seed-local-dev.sql |

**Reason:** All functionality consolidated in `seed-local-dev.sql`

#### Seeds Directory (Old Structure)

| File | Purpose | Lines | Why Delete |
|------|---------|-------|------------|
| `supabase/seeds/01_test_users.sql` | User creation | ~50 | ❌ Old structure, use seed-local-dev.sql |
| `supabase/seeds/02_sample_bands.sql` | Band creation | ~100 | ❌ Old structure, use seed-local-dev.sql |
| `supabase/seeds/03_sample_songs.sql` | Song catalog | ~100 | ❌ Old structure, use seed-local-dev.sql |
| `supabase/seeds/04_sample_setlists.sql` | Setlist data | ~500 | ❌ Old structure, use seed-local-dev.sql |

**Reason:** Old modular seed structure, replaced by single comprehensive seed file

#### Scripts Directory (Outdated)

| File | Purpose | Lines | Why Delete/Update |
|------|---------|-------|-------------------|
| `scripts/fresh_init.sql` | Full schema for fresh setup | 726 | ⚠️ **OUTDATED** - Missing shows table! |
| `scripts/seed_test_data.sql` | Test data seeding | 704 | ❌ Redundant with seed-local-dev.sql |

**Critical Issue with fresh_init.sql:**
- Created 2025-10-27 (before shows table separation)
- Still uses unified practice_sessions table with `type='gig'`
- Missing dedicated `shows` table (added 2025-10-28)
- Has gig-specific indexes on practice_sessions (now obsolete)
- **Cannot be used as-is for current schema**

---

## Recommended Actions

### Phase 1: Cleanup ✅

Delete the following files (safe to remove):

```bash
# Root level redundant seeds
rm supabase/seed.sql
rm supabase/seed-dev-users.sql
rm supabase/seed-full-catalog.sql
rm supabase/seed-full-catalog-random-ids.sql

# Old seeds directory structure
rm -rf supabase/seeds/

# Redundant script
rm scripts/seed_test_data.sql
```

### Phase 2: Fix fresh_init.sql ⚠️

**Option A - Update It** (Recommended for maintaining single-file setup):
1. Merge all migrations into fresh_init.sql
2. Add shows table definition from `20251028000000_create_shows_table.sql`
3. Remove gig-related fields from practice_sessions
4. Update RLS policies to match current state
5. Test thoroughly

**Option B - Delete It** (Use migrations instead):
```bash
rm scripts/fresh_init.sql
```
- Rely on Supabase migrations for schema
- Use `supabase db reset` for fresh setup
- Simpler maintenance

### Phase 3: Document Dev Setup Process

Create a single source of truth for dev setup in `QUICK-START.md` or similar.

---

## Recommended Dev Setup Flow

### Current Best Practice (Using Migrations)

```bash
# 1. Start local Supabase
supabase start

# 2. Apply all migrations (automatic)
# Migrations run automatically on start

# 3. Seed test data
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -f supabase/seed-local-dev.sql

# 4. Verify
supabase status
```

### Alternative: Fresh Reset

```bash
# Reset database to clean state
supabase db reset

# Migrations apply automatically
# Then seed data
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -f supabase/seed-local-dev.sql
```

---

## File Summary

### ✅ Keep (14 files)
- 12 migration files in `supabase/migrations/`
- 1 seed file: `supabase/seed-local-dev.sql`
- 1 consolidated schema file: `scripts/fresh_init.sql` (after updating)

### ❌ Delete (8 files)
- `supabase/seed.sql` (empty)
- `supabase/seed-dev-users.sql` (redundant)
- `supabase/seed-full-catalog.sql` (old version)
- `supabase/seed-full-catalog-random-ids.sql` (partial)
- `supabase/seeds/01_test_users.sql` (old structure)
- `supabase/seeds/02_sample_bands.sql` (old structure)
- `supabase/seeds/03_sample_songs.sql` (old structure)
- `supabase/seeds/04_sample_setlists.sql` (old structure)
- `scripts/seed_test_data.sql` (redundant)

### ⚠️ Needs Update (1 file)
- `scripts/fresh_init.sql` (missing shows table, outdated schema)

---

## Critical Gap: fresh_init.sql is Outdated

**Problem:**
- `fresh_init.sql` was created as "single file schema" on 2025-10-27
- Shows table was added on 2025-10-28 via migration
- fresh_init.sql still has old unified practice_sessions structure

**Evidence:**
```sql
-- In fresh_init.sql (WRONG)
CREATE TABLE IF NOT EXISTS public.practice_sessions (
  ...
  type TEXT NOT NULL CHECK (type IN ('rehearsal', 'writing', 'recording', 'audition', 'lesson', 'gig')),
  -- Has gig-specific fields: name, venue, contacts, payment
  name TEXT,
  venue TEXT,
  ...
)

-- Current schema (CORRECT)
-- Separate tables:
-- 1. practice_sessions (NO gig type, NO show fields)
-- 2. shows (dedicated table for gigs)
```

**Impact:**
- Cannot use fresh_init.sql for clean database initialization
- Will create wrong schema structure
- Shows will be stored in wrong table
- Missing RLS policies for shows table

**Solution:**
Either update fresh_init.sql to match current migrations, or delete it and rely solely on migrations.

---

## Recommendation: Delete fresh_init.sql

**Rationale:**
1. Migrations are the source of truth
2. Maintaining fresh_init.sql in sync with migrations = double work
3. `supabase db reset` gives same result (fresh schema)
4. Less chance of schema drift
5. Follows Supabase best practices

**Trade-off:**
- Lose single-file convenience
- Must run multiple migrations on fresh setup
- But: Migrations run automatically on `supabase start`

**If keeping fresh_init.sql:**
Must add process to regenerate it from migrations after every schema change.

---

## Final Recommendation

**For Dev Mode (Current Situation):**

**Keep:**
- All 12 migrations in `supabase/migrations/`
- `supabase/seed-local-dev.sql` (your single seed file)

**Delete:**
- All other seed files (8 files)
- `scripts/fresh_init.sql` (outdated, hard to maintain)
- `scripts/seed_test_data.sql` (redundant)

**Result:**
- Clean, minimal file structure
- Single source of truth: migrations
- Single seed file: seed-local-dev.sql
- Easy to maintain

**Updated QUICK-START.md:**
```markdown
# Quick Start

## Setup Development Database

```bash
# Start Supabase (applies all migrations automatically)
supabase start

# Seed test data
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -f supabase/seed-local-dev.sql

# Verify
supabase status
```

## Reset Database

```bash
# Clean reset (drops all data, re-runs migrations)
supabase db reset

# Re-seed
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -f supabase/seed-local-dev.sql
```
```

---

## Action Checklist

- [ ] Review this document
- [ ] Backup database if needed
- [ ] Delete redundant seed files (8 files)
- [ ] Delete outdated scripts (2 files)
- [ ] Update QUICK-START.md with new process
- [ ] Test fresh database setup
- [ ] Document in team wiki/README

**Total Files to Delete:** 10 files
**Total Files to Keep:** 13 files (12 migrations + 1 seed)
