---
title: Test Data and Seeding Specification
created: 2025-10-27T18:16
updated: 2025-10-31T13:20
status: ACTIVE
type: Development Reference
purpose: Single source of truth for test data seeding - Supabase ONLY
---

# Test Data and Seeding Specification

**⚠️ CRITICAL:** As of 2025-10-31, we use **SUPABASE ONLY** for seeding test data. IndexedDB is populated via sync from Supabase.

## Table of Contents

- [Philosophy & Architecture](#philosophy--architecture)
- [Seed Data Files](#seed-data-files)
- [Standard Test Users](#standard-test-users)
- [Standard Test Band](#standard-test-band)
- [Standard Test Data](#standard-test-data)
- [Usage Guide](#usage-guide)
- [Reseed Process](#reseed-process)

---

## Philosophy & Architecture

### Single Source of Truth

**Supabase is the single source of truth for test data.**

```
┌─────────────────────────────────────────┐
│   SUPABASE (PostgreSQL)                 │
│   - Auth users (auth.users)             │
│   - Public schema (bands, songs, etc)   │
│   - Seeded via SQL migrations           │
└──────────────┬──────────────────────────┘
               │
               │ sync via SyncEngine
               ↓
┌─────────────────────────────────────────┐
│   INDEXEDDB (Client-side)               │
│   - Populated from Supabase             │
│   - Never seeded directly               │
└─────────────────────────────────────────┘
```

### Why This Architecture?

1. **Data Consistency:** Everyone sees the same data from Supabase
2. **No Duplicates:** Eliminates conflicting band IDs and user IDs
3. **Real Sync Testing:** Tests actually exercise the sync engine
4. **Cloud-First:** Matches production architecture

### What Changed (2025-10-31)

**DEPRECATED:**

- ❌ `src/database/seedMvpData.ts` - Direct IndexedDB seeding
- ❌ `src/database/seedData.ts` - Legacy IndexedDB seeding
- ❌ `src/database/seedCatalog.ts` - Only used to generate SQL
- ❌ Automatic seeding in `main.tsx`

**ACTIVE:**

- ✅ `supabase/seed-mvp-data.sql` - Single source of truth
- ✅ `scripts/generateSeedSQL.ts` - Generates SQL from TypeScript catalog (helper only)
- ✅ IndexedDB populated via `SyncEngine.performInitialSync()`

---

## Seed Data Files

### Primary Seed File

**File:** `supabase/seed-mvp-data.sql`

**Purpose:** Seeds Supabase local development environment with realistic test data.

**Contents:**

- 3 auth users (Eric, Mike, Sarah)
- 3 public.users records
- 3 user_profiles
- 1 band (iPod Shuffle)
- 3 band_memberships
- 45 songs
- 3 shows
- 3 setlists
- 2 practice sessions

**How to Run:**

```bash
# Reset database and reseed
supabase db reset

# Or manually apply
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres < supabase/seed-mvp-data.sql
```

### Helper Files (Generation Only)

**File:** `src/database/seedCatalog.ts`

**Purpose:** TypeScript catalog of songs for SQL generation. NOT used at runtime.

**Usage:**

```bash
# Generate SQL from catalog
npm run generate-seed       # Full catalog
npm run generate-seed:min   # Minimal (3 songs)
npm run generate-seed:med   # Medium (8 songs)
```

**File:** `scripts/generateSeedSQL.ts`

**Purpose:** Converts TypeScript song catalog to SQL INSERT statements.

### Deprecated Files

These files still exist but should NOT be used:

- `src/database/seedMvpData.ts` - Direct IndexedDB seeding (causes duplicates)
- `src/database/seedData.ts` - Legacy seeding (outdated)
- `supabase/seed-local-dev.sql` - Old minimal seed (replaced by seed-mvp-data.sql)
- `supabase/seed-full-catalog.sql` - Auto-generated, not maintained

---

## Standard Test Users

### Test User Accounts

All test users have password: `test123`

| Name          | Email                 | Role   | Instruments             | Band Role     |
| ------------- | --------------------- | ------ | ----------------------- | ------------- |
| Eric Johnson  | eric@ipodshuffle.com  | Lead   | Guitar, Vocals          | Admin (Owner) |
| Mike Thompson | mike@ipodshuffle.com  | Multi  | Bass, Harmonica, Vocals | Admin         |
| Sarah Chen    | sarah@ipodshuffle.com | Rhythm | Drums, Percussion       | Member        |

### User IDs

**Note:** UUIDs are generated during seeding via `gen_random_uuid()`. They are NOT hardcoded.

**To get user IDs:**

```sql
SELECT id, name, email FROM users ORDER BY name;
```

**Example output:**

```
                  id                  |      name       |         email
--------------------------------------+-----------------+-----------------------
 6ee2bc47-0014-4cdc-b063-68646bb5d3ba | Eric Johnson    | eric@ipodshuffle.com
 a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d | Mike Thompson   | mike@ipodshuffle.com
 b0183ece-fb53-4cb3-a1aa-5127c3399a6e | Sarah Chen      | sarah@ipodshuffle.com
```

### Authentication

**Login via UI:**

1. Click "Show Mock Users for Testing"
2. Click user button (Eric, Mike, or Sarah)
3. Form auto-fills and submits

**Login via API:**

```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'eric@ipodshuffle.com',
  password: 'test123',
})
```

---

## Standard Test Band

### Band Details

**Name:** iPod Shuffle

**Description:** "A rockin' cover band playing hits from every decade"

**Band ID:** Generated via `gen_random_uuid()` during seeding

**Created:** 2024-01-15

**Members:** 3 (Eric, Mike, Sarah)

**Invite Code:** `ROCK2025`

**Settings:**

```json
{
  "defaultPracticeTime": 120,
  "reminderMinutes": [60, 30, 10],
  "autoSaveInterval": 30
}
```

### Band Memberships

| User  | Role   | Joined     | Status | Permissions        |
| ----- | ------ | ---------- | ------ | ------------------ |
| Eric  | admin  | 2024-01-15 | active | ['owner', 'admin'] |
| Mike  | admin  | 2024-01-20 | active | ['admin']          |
| Sarah | member | 2024-02-01 | active | ['member']         |

---

## Standard Test Data

### Songs (45 total)

**Breakdown by Decade:**

| Decade | Count | Examples                                                            |
| ------ | ----- | ------------------------------------------------------------------- |
| 60s    | 1     | White Rabbit                                                        |
| 70s    | 6     | Hotel California, Dream On, Free Bird, La Grange, Heartache Tonight |
| 80s    | 4     | Sweet Child O' Mine, Livin' on a Prayer, Jump, Kickstart My Heart   |
| 90s    | 20    | Wonderwall, Smells Like Teen Spirit, Black, Enter Sandman, etc      |
| 2000s  | 14    | Mr. Brightside, Hey There Delilah, Seven Nation Army, etc           |

**All songs:**

- Created by Eric (owner)
- Scoped to band (contextType: 'band', contextId: bandId)
- Visible to all band members
- Include key, tempo, tuning, duration
- Most have standard tuning

**Query to verify:**

```sql
SELECT COUNT(*) FROM songs WHERE context_id = (SELECT id FROM bands WHERE name = 'iPod Shuffle');
-- Expected: 45
```

### Setlists (3 total)

| Name                | Status | For Show | Song Count | Duration | Notes                        |
| ------------------- | ------ | -------- | ---------- | -------- | ---------------------------- |
| Toys 4 Tots Benefit | Active | Yes      | 15         | 60 min   | Family-friendly, high energy |
| New Year's Eve Bash | Active | Yes      | 20         | 90 min   | Two sets with break          |
| Summer Festival     | Active | Yes      | 12         | 50 min   | Outdoor, upbeat              |

**Setlist Items:**

- Mix of songs, breaks, and sections
- Items include breaks (15-30 min) and sections ("Acoustic Set", "Rock Out")
- All linked to shows

### Shows (3 total)

| Name                  | Venue         | Date       | Payment | Status    |
| --------------------- | ------------- | ---------- | ------- | --------- |
| Summer Music Festival | Woodland Park | 2025-11-30 | $750    | scheduled |
| Toys 4 Tots Benefit   | The Crocodile | 2025-12-08 | $500    | scheduled |
| New Year's Eve Party  | The Showbox   | 2025-12-31 | $1200   | scheduled |

**Each show includes:**

- venue, scheduledDate, duration
- loadInTime, soundcheckTime
- payment (in cents)
- contacts (promoter/venue manager)
- status: 'scheduled'

### Practice Sessions (2 total)

| Date               | Location      | Duration | Songs   |
| ------------------ | ------------- | -------- | ------- |
| 2025-11-24 7:00 PM | Mike's Garage | 120 min  | 5 songs |
| 2025-12-01 7:00 PM | Eric's Studio | 90 min   | 3 songs |

**Each practice includes:**

- scheduledDate, duration, location
- type: 'rehearsal'
- status: 'scheduled'
- songs: Array of songs to practice
- objectives: Practice goals
- attendees: Empty (to be filled during practice)

---

## Usage Guide

### Local Development Setup

**Step 1: Start Supabase**

```bash
cd /workspaces/rock-on
supabase start
```

**Step 2: Reset & Reseed Database**

```bash
supabase db reset
```

This runs all migrations and applies `supabase/seed-mvp-data.sql`.

**Step 3: Start App**

```bash
npm run dev
```

**Step 4: Login**

- Go to http://localhost:5173
- Click "Show Mock Users for Testing"
- Click Eric, Mike, or Sarah
- App will sync data from Supabase → IndexedDB

### First Login Process

When a user logs in for the first time:

1. **Authentication:** User authenticates with Supabase
2. **Session:** Supabase creates JWT session
3. **Initial Sync Check:** `AuthContext` calls `repository.isInitialSyncNeeded()`
4. **Initial Sync:** If needed, `repository.performInitialSync(userId)` runs
5. **Data Download:** SyncEngine downloads all data from Supabase → IndexedDB
6. **UI Ready:** App displays synced data

**Console output:**

```
🔄 Initial sync needed - downloading data from cloud...
✅ Initial sync complete
```

### Verifying Seed Data

**In Browser Console:**

```javascript
// Check IndexedDB
const songs = await db.songs.toArray()
console.log('Songs:', songs.length) // Should be 45

const band = await db.bands.toArray()
console.log('Bands:', band) // Should be 1: iPod Shuffle

// Check band ID consistency
const bandId = band[0].id
const songsByBand = songs.filter(s => s.contextId === bandId)
console.log('Songs for band:', songsByBand.length) // Should be 45
```

**In Supabase SQL:**

```sql
-- Verify users
SELECT COUNT(*) FROM auth.users; -- Should be 3
SELECT COUNT(*) FROM users; -- Should be 3

-- Verify band
SELECT * FROM bands WHERE name = 'iPod Shuffle';

-- Verify memberships
SELECT
  u.name,
  bm.role,
  b.name as band_name
FROM band_memberships bm
JOIN users u ON bm.user_id = u.id
JOIN bands b ON bm.band_id = b.id;

-- Verify songs
SELECT COUNT(*) FROM songs; -- Should be 45

-- Verify shows
SELECT COUNT(*) FROM shows; -- Should be 3
```

---

## Reseed Process

### Quick Reset (Recommended)

```bash
# One command - resets and reseeds everything
supabase db reset
```

This:

1. Drops all tables
2. Re-runs all migrations
3. Applies seed-mvp-data.sql
4. Database is ready

### Manual Reseed (Advanced)

```bash
# Just reapply seed data (without full reset)
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres < supabase/seed-mvp-data.sql
```

**Warning:** This may create duplicates if data already exists. Use `supabase db reset` instead.

### Clear Client Data

**If users need to clear IndexedDB and localStorage:**

```javascript
// Browser console
// 1. Delete IndexedDB
await indexedDB.deleteDatabase('RockOnDB')

// 2. Clear localStorage
localStorage.clear()

// 3. Reload page
location.reload()

// App will perform initial sync from Supabase on next login
```

---

## Data Consistency Rules

### Critical Rules

1. **Single Band ID**
   - All data (songs, setlists, shows) must reference the SAME band ID
   - Band ID comes from Supabase, not hardcoded

2. **User IDs from Auth**
   - User IDs come from `auth.users`, generated via `gen_random_uuid()`
   - Never hardcode user IDs

3. **No Direct IndexedDB Seeding**
   - Do NOT call `seedMvpData()` or `seedDatabase()`
   - Do NOT add data directly to IndexedDB
   - Always seed via Supabase and let sync engine populate IndexedDB

4. **Context ID Field**
   - Songs use `context_id` (TEXT in Supabase, string in IndexedDB)
   - Other tables use `band_id` (UUID in Supabase, string in IndexedDB)
   - Repository handles conversion

### Data Integrity Checks

**Before committing changes:**

```bash
# Reset database
supabase db reset

# Check seed data
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "
SELECT
  (SELECT COUNT(*) FROM auth.users) as auth_users,
  (SELECT COUNT(*) FROM users) as public_users,
  (SELECT COUNT(*) FROM bands) as bands,
  (SELECT COUNT(*) FROM band_memberships) as memberships,
  (SELECT COUNT(*) FROM songs) as songs,
  (SELECT COUNT(*) FROM setlists) as setlists,
  (SELECT COUNT(*) FROM shows) as shows,
  (SELECT COUNT(*) FROM practice_sessions) as practices;
"
```

**Expected output:**

```
 auth_users | public_users | bands | memberships | songs | setlists | shows | practices
------------+--------------+-------+-------------+-------+----------+-------+-----------
          3 |            3 |     1 |           3 |    45 |        3 |     3 |         2
```

---

## Troubleshooting

### Issue: "No band selected" after login

**Cause:** Initial sync didn't complete or failed

**Solution:**

```javascript
// Check sync status
const needsSync = await repository.isInitialSyncNeeded()
console.log('Needs sync?', needsSync)

// Force initial sync
await repository.performInitialSync(userId)
```

### Issue: Duplicate songs with different band IDs

**Cause:** IndexedDB was seeded directly via `seedMvpData()` AND synced from Supabase

**Solution:**

```javascript
// Clear IndexedDB completely
await indexedDB.deleteDatabase('RockOnDB')
localStorage.clear()
location.reload()

// On next login, sync will populate from Supabase only
```

### Issue: Mike/Sarah can't see Eric's songs

**Cause:** RLS policy issue or band membership not seeded correctly

**Solution:**

```sql
-- Check band memberships
SELECT
  u.name,
  bm.band_id,
  bm.role,
  bm.status
FROM band_memberships bm
JOIN users u ON bm.user_id = u.id
WHERE u.email IN ('eric@ipodshuffle.com', 'mike@ipodshuffle.com', 'sarah@ipodshuffle.com');

-- All 3 users should be in the SAME band_id
-- All should have status = 'active'
```

### Issue: Login works but no data appears

**Cause:** Initial sync failed silently

**Check:**

1. Supabase is running: `supabase status`
2. Seed data exists: `SELECT COUNT(*) FROM songs;`
3. RLS policies allow access
4. Console shows sync errors

---

## Migration Guide (Old → New)

### For Developers

**If you see this code:**

```typescript
// ❌ OLD - Do NOT use
import { seedMvpData } from './database/seedMvpData'
await seedMvpData()
```

**Replace with:**

```typescript
// ✅ NEW - Let sync engine handle it
// Just login, sync happens automatically
await authService.signIn({ email, password })
```

**If you see this in tests:**

```typescript
// ❌ OLD
beforeEach(async () => {
  await db.songs.clear()
  await seedMvpData()
})
```

**Replace with:**

```typescript
// ✅ NEW
beforeEach(async () => {
  // Clear IndexedDB
  await db.songs.clear()
  await db.bands.clear()
  // ... clear other tables

  // Sync from Supabase
  await repository.performInitialSync(testUserId)
})
```

### For CI/CD

**Build scripts:**

```bash
# ❌ OLD - Don't seed IndexedDB
npm run seed

# ✅ NEW - Just start Supabase
supabase start
supabase db reset  # Seeds Supabase
npm run dev        # App syncs from Supabase
```

---

## Version History

| Date       | Version | Changes                                                             |
| ---------- | ------- | ------------------------------------------------------------------- |
| 2025-10-31 | 8.0     | **BREAKING:** Removed IndexedDB seeding, Supabase-only architecture |
| 2025-10-27 | 7.0     | Added `shows` table, separated from `practice_sessions`             |
| 2024-11-01 | 6.0     | Added setlist items structure (breaks, sections)                    |

---

## Related Documentation

- **Database Schema:** `.claude/specifications/unified-database-schema.md`
- **Sync Engine:** `.claude/instructions/40-sync-engine-implementation.md`
- **Repository Pattern:** `.claude/instructions/30-repository-pattern-implementation.md`
- **Seed Data Consolidation Plan:** `.claude/artifacts/2025-10-31T13:20_seed-data-consolidation-plan.md`

---

**Last Updated:** 2025-10-31T13:20
**Maintained By:** Claude Code
**Status:** ACTIVE - Single source of truth for test data
