---
timestamp: 2025-10-29T00:25
summary: Analysis of migration system vs fresh_init.sql - identifying the REAL source of truth
context: User concerned about too many "fix" migrations and unclear database initialization path
---

# Migration System Analysis: Source of Truth

## Executive Summary

**CRITICAL FINDING**: You have **TWO CONFLICTING PATHS** for database initialization:

1. **Migration Path** (12 incremental files) - Auto-applied by `supabase start`
2. **Fresh Init Path** (`scripts/fresh_init.sql`) - Applied by `./scripts/reset_local_db.sh`

**Problem**: `fresh_init.sql` is **OUTDATED** and missing the shows table (added Oct 28).

**Current State**: ⚠️ **Using MIGRATIONS as source of truth** (via `supabase start`)

---

## How Database Gets Initialized

### Method 1: Supabase CLI (Current Default)

```bash
# Start Supabase
npx supabase start

# What happens automatically:
# 1. Starts PostgreSQL in Docker
# 2. Scans supabase/migrations/ directory
# 3. Applies migrations in chronological order (by timestamp)
# 4. Records applied migrations in supabase_migrations table
```

**Result**: All 12 migrations applied sequentially, including latest shows table.

### Method 2: Fresh Init Script (Documented but BROKEN)

```bash
# Reset database script
./scripts/reset_local_db.sh

# What the script does:
# 1. DROP ALL tables
# 2. Run scripts/fresh_init.sql (complete schema)
# 3. Run scripts/seed_test_data.sql (test data)
```

**Problem**: `fresh_init.sql` was created Oct 27, but shows table was added Oct 28 via migration.

**Result**: ⚠️ **Creates WRONG schema** - missing shows table, wrong practice_sessions structure

---

## The 12 Migrations - What They Do

### Foundation (Oct 25)

| Migration | Purpose | Keep? |
|-----------|---------|-------|
| `20251025000000_initial_schema.sql` | **Base schema**: All tables, indexes, RLS, triggers | ✅ CRITICAL |

### Fixes & Features (Oct 26)

| Migration | Purpose | Keep? | Notes |
|-----------|---------|-------|-------|
| `20251026160000_rebuild_rls_policies.sql` | RLS policy rebuild | ⚠️ CONSOLIDATED | Could merge into initial |
| `20251026170000_add_setlist_items.sql` | Add items JSONB column to setlists | ✅ FEATURE | Real feature addition |
| `20251026170100_fix_setlist_trigger.sql` | Fix last_modified trigger bug | ⚠️ FIX | Should have been in previous |
| `20251026190000_add_gig_type.sql` | Add 'gig' type to practices | ❌ OBSOLETE | Replaced by shows table |
| `20251026190100_add_show_fields.sql` | Add show fields to practices | ❌ OBSOLETE | Replaced by shows table |
| `20251026190200_add_setlist_forking.sql` | Add show_id to setlists | ✅ FEATURE | Real feature addition |
| `20251026213000_enable_rls.sql` | Enable RLS on tables | ⚠️ CONSOLIDATED | Should be in initial |
| `20251026221000_fix_rls_recursion.sql` | Fix RLS recursion (v1) | ❌ SUPERSEDED | v2 replaces this |
| `20251026221100_fix_rls_recursion_v2.sql` | Fix RLS recursion (v2) | ✅ FIX | Critical security fix |
| `20251026221500_fix_song_delete_policy.sql` | Fix song deletion RLS | ✅ FIX | Critical security fix |

### Shows Table (Oct 28)

| Migration | Purpose | Keep? |
|-----------|---------|-------|
| `20251028000000_create_shows_table.sql` | **Separate shows table** | ✅ CRITICAL |

---

## The Problem: Migration Debt

### What "Migration Debt" Means

**Good Migrations:**
- `20251025000000_initial_schema.sql` - Clean foundation
- `20251026170000_add_setlist_items.sql` - New feature
- `20251028000000_create_shows_table.sql` - Architecture improvement

**Bad Migrations (Technical Debt):**
- `fix_setlist_trigger.sql` - Should have been in `add_setlist_items.sql`
- `fix_rls_recursion.sql` + `fix_rls_recursion_v2.sql` - Should have been in `rebuild_rls_policies.sql`
- `rebuild_rls_policies.sql` + `enable_rls.sql` - Should have been in initial schema

**Obsolete Migrations:**
- `add_gig_type.sql` - Superseded by `create_shows_table.sql`
- `add_show_fields.sql` - Superseded by `create_shows_table.sql`

---

## Analysis: What Should Be Source of Truth?

### Option 1: Keep Migrations (Current State)

**Pros:**
- ✅ Already working
- ✅ Supabase CLI handles automatically
- ✅ Standard Supabase workflow
- ✅ Easy to collaborate (migrations in version control)
- ✅ Incremental changes tracked

**Cons:**
- ❌ 12 files to understand
- ❌ Contains "fix" and obsolete migrations
- ❌ Migration history is messy
- ❌ Harder to understand current schema

**Recommendation:** ⚠️ **Consolidate but keep migrations**

### Option 2: Use Fresh Init (Documented Approach)

**Pros:**
- ✅ Single file to understand
- ✅ Clean schema without history
- ✅ Fast setup for new devs

**Cons:**
- ❌ Currently BROKEN (missing shows table)
- ❌ Must manually sync with migrations
- ❌ Doubles maintenance burden
- ❌ Can drift out of sync

**Recommendation:** ❌ **Abandon or auto-generate from migrations**

---

## Detailed Migration Content

### Critical Foundation

**`20251025000000_initial_schema.sql`** (Lines: ~350)
- Creates all tables: users, bands, songs, setlists, practice_sessions, etc.
- Creates all indexes
- Creates triggers (updated_date)
- Enables RLS on all tables
- Creates helper functions

**Status**: ✅ **Essential baseline**

### Obsolete Migrations (Shows Architecture)

**`20251026190000_add_gig_type.sql`**
```sql
-- Adds 'gig' to practice_sessions type enum
ALTER TABLE practice_sessions
  DROP CONSTRAINT practice_sessions_type_check;

ALTER TABLE practice_sessions
  ADD CONSTRAINT practice_sessions_type_check
  CHECK (type IN ('rehearsal', 'writing', 'recording', 'audition', 'lesson', 'gig'));
```
**Status**: ❌ **OBSOLETE** - Shows now in separate table

**`20251026190100_add_show_fields.sql`**
```sql
-- Adds show-specific fields to practice_sessions
ALTER TABLE practice_sessions
  ADD COLUMN name TEXT,
  ADD COLUMN venue TEXT,
  ADD COLUMN load_in_time TEXT,
  -- etc...
```
**Status**: ❌ **OBSOLETE** - Shows table has these fields

**`20251028000000_create_shows_table.sql`** (Latest)
```sql
-- Creates dedicated shows table
CREATE TABLE public.shows (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  venue TEXT,
  -- Modern clean structure
  ...
);

-- Migrates data from practice_sessions
-- Removes gig records from practice_sessions
```
**Status**: ✅ **CRITICAL** - Current architecture

---

## Fresh Init Status

### What's in `scripts/fresh_init.sql`?

**Created**: Oct 27, 2025
**Last Modified**: Oct 27, 2025
**Line Count**: 726 lines

**Structure**:
```sql
-- Tables (OLD structure)
CREATE TABLE practice_sessions (
  ...
  type CHECK (type IN (..., 'gig')),  -- ❌ WRONG
  name TEXT,                           -- ❌ WRONG
  venue TEXT,                          -- ❌ WRONG
  -- Show fields mixed with practice fields
);

-- NO shows table!  ❌ CRITICAL MISSING
```

**Problems**:
1. ❌ Missing `shows` table entirely
2. ❌ Has obsolete practice_sessions structure (with gig type and show fields)
3. ❌ Would create WRONG schema if used
4. ❌ Out of sync with migrations by 1 day

**Impact**: If someone runs `./scripts/reset_local_db.sh`, they get BROKEN database.

---

## Verification: What's Actually Running?

### Check Your Current Database

```bash
# Check if shows table exists
docker exec supabase_db_rock-on psql -U postgres -d postgres \
  -c "\d shows"

# Should show table definition
# If "relation does not exist" = using fresh_init (BROKEN)
# If shows table exists = using migrations (CORRECT)
```

**Result from today's session**: Shows table EXISTS = using migrations ✅

### Check Migration History

```bash
# Check which migrations were applied
docker exec supabase_db_rock-on psql -U postgres -d postgres \
  -c "SELECT version, name, executed_at FROM supabase_migrations.schema_migrations ORDER BY version;"
```

**Expected**: All 12 migrations listed

---

## Recommendations

### Immediate Actions (Dev Mode)

**Option A: Consolidate Migrations (Recommended)**

1. Create new consolidated initial migration
2. Squash all migrations into one clean file
3. Mark old migrations as applied
4. Update or delete fresh_init.sql

**Option B: Fix Fresh Init (Quick Fix)**

1. Update `scripts/fresh_init.sql` with latest schema
2. Add shows table from migration
3. Remove obsolete gig fields from practice_sessions
4. Update documentation

**Option C: Delete Fresh Init (Simplest)**

1. Delete `scripts/fresh_init.sql`
2. Delete `scripts/reset_local_db.sh`
3. Update documentation to only use `supabase db reset`
4. Rely purely on migrations

### Recommended: Option C (Delete Fresh Init)

**Why:**
- Simplest to maintain
- One source of truth: migrations
- Supabase CLI handles everything
- No risk of drift
- Standard Supabase practice

**Implementation:**
```bash
# Delete conflicting scripts
rm scripts/fresh_init.sql
rm scripts/seed_test_data.sql
rm scripts/reset_local_db.sh

# Update documentation
# Change: ./scripts/reset_local_db.sh
# To: supabase db reset

# For seeding, use: supabase/seed-local-dev.sql
```

**New Reset Command:**
```bash
# Reset database (applies all migrations)
supabase db reset

# Seed test data
cat supabase/seed-local-dev.sql | docker exec -i supabase_db_rock-on psql -U postgres
```

---

## Migration Consolidation Plan (Future)

### Phase 1: Audit

- [x] List all migrations (12 files)
- [x] Identify obsolete migrations (2 files)
- [x] Identify "fix" migrations (4 files)
- [x] Identify essential migrations (6 files)

### Phase 2: Create Consolidated Migration

**New Migration: `20251029000000_consolidated_schema.sql`**

Combines:
- Initial schema (20251025000000)
- RLS policies (20251026160000, 20251026213000)
- Setlist items (20251026170000, 20251026170100)
- Setlist forking (20251026190200)
- RLS fixes (20251026221100, 20251026221500)
- Shows table (20251028000000)

**Result**: 1 clean migration file instead of 12

### Phase 3: Mark Old Migrations

```sql
-- In consolidated migration:
-- Mark old migrations as applied (prevents re-running)
INSERT INTO supabase_migrations.schema_migrations (version, name, executed_at)
VALUES
  ('20251025000000', 'initial_schema', NOW()),
  ('20251026160000', 'rebuild_rls_policies', NOW()),
  -- etc...
ON CONFLICT (version) DO NOTHING;
```

### Phase 4: Clean Up

```bash
# Archive old migrations
mkdir supabase/migrations/archive/
mv supabase/migrations/202510*.sql supabase/migrations/archive/

# Only keep consolidated migration
# supabase/migrations/20251029000000_consolidated_schema.sql
```

---

## Current Setup Flow (What Actually Happens)

### When You Run `supabase start`:

```
1. Docker starts PostgreSQL
2. CLI checks supabase/migrations/ directory
3. Reads migration files in alphabetical order:
   - 20251025000000_initial_schema.sql           ✓ Applied
   - 20251026160000_rebuild_rls_policies.sql     ✓ Applied
   - 20251026170000_add_setlist_items.sql        ✓ Applied
   - 20251026170100_fix_setlist_trigger.sql      ✓ Applied
   - 20251026190000_add_gig_type.sql             ✓ Applied (then undone by 20251028000000)
   - 20251026190100_add_show_fields.sql          ✓ Applied (then undone by 20251028000000)
   - 20251026190200_add_setlist_forking.sql      ✓ Applied
   - 20251026213000_enable_rls.sql               ✓ Applied
   - 20251026221000_fix_rls_recursion.sql        ✓ Applied (superseded by v2)
   - 20251026221100_fix_rls_recursion_v2.sql     ✓ Applied (final version)
   - 20251026221500_fix_song_delete_policy.sql   ✓ Applied
   - 20251028000000_create_shows_table.sql       ✓ Applied (latest)

4. Final schema state: ✅ CORRECT (with shows table)
```

### When You Run `./scripts/reset_local_db.sh`:

```
1. Drops all tables (complete wipe)
2. Runs scripts/fresh_init.sql (Oct 27 schema)
   - Creates practice_sessions with gig type     ❌ WRONG
   - Creates practice_sessions with show fields  ❌ WRONG
   - Does NOT create shows table                 ❌ CRITICAL
3. Runs scripts/seed_test_data.sql
4. Final schema state: ❌ BROKEN (missing shows table)
```

---

## The Truth: What's Your Source of Truth?

### Answer: **Migrations ARE Your Source of Truth**

**Evidence:**
1. ✅ `supabase start` is documented in all setup guides
2. ✅ Shows table exists in your current database
3. ✅ Fresh init is outdated and would break if used
4. ✅ Migrations auto-apply on every `supabase start`

### The Confusion

**Documentation says**: Use `./scripts/reset_local_db.sh`
**Reality is**: Everyone uses `supabase start` → migrations

**Result**: fresh_init.sql is vestigial, never actually used by anyone

---

## Final Recommendation

### For Dev Mode (Current State)

**KEEP:**
- ✅ All 12 migrations in `supabase/migrations/`
- ✅ `supabase/seed-local-dev.sql` (single seed file)
- ✅ Current workflow: `supabase start` → auto-applies migrations

**DELETE:**
- ❌ `scripts/fresh_init.sql` (outdated, unused)
- ❌ `scripts/seed_test_data.sql` (redundant)
- ❌ `scripts/reset_local_db.sh` (broken, use `supabase db reset` instead)

**UPDATE DOCS:**
- Change `./scripts/reset_local_db.sh`
- To: `supabase db reset`

### For Production (Future)

**Consider:**
- Consolidate migrations (optional cleanup)
- Single comprehensive migration for fresh installs
- Archive old fixes/patches

**But for now:** Migrations work fine as-is!

---

## Commands Reference

### Using Migrations (Current Recommended)

```bash
# Fresh setup
supabase start  # Auto-applies all migrations

# Reset database
supabase db reset  # Drops all, re-applies migrations

# Seed data
cat supabase/seed-local-dev.sql | docker exec -i supabase_db_rock-on psql -U postgres

# Create new migration
supabase migration new add_feature_name
```

### ~~Using Fresh Init (BROKEN - Don't Use)~~

```bash
# ❌ DO NOT USE - Creates wrong schema
./scripts/reset_local_db.sh
```

---

## Summary

| Aspect | Migrations | Fresh Init |
|--------|-----------|------------|
| **Status** | ✅ Working | ❌ Broken |
| **Up to Date** | ✅ Yes (shows table) | ❌ No (Oct 27) |
| **Maintained** | ✅ Yes | ❌ No |
| **Documented** | ✅ Yes | ⚠️ Misleading |
| **Actually Used** | ✅ Always | ❌ Never |
| **Recommendation** | ✅ Keep | ❌ Delete |

**VERDICT**:
- ✅ **Migrations = Source of Truth**
- ❌ **Fresh Init = Delete It**
- 📝 **Update documentation to match reality**

---

**Created**: 2025-10-29T00:25
**Status**: Analysis Complete
**Action Required**: Delete fresh_init.sql and related scripts, update docs
