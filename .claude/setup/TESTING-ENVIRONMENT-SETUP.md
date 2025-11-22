# Testing Environment Setup Guide

Complete guide for setting up and testing the Rock On application locally with Supabase.

## Quick Start - Manual Testing

```bash
# 1. Reset database to fresh state
./scripts/reset_local_db.sh

# 2. Start dev server
npm run dev

# 3. Open browser
# http://localhost:5173

# 4. Log in with test user
# Email: eric@ipodshuffle.com (or mike/sarah)
# Password: test123
```

## Quick Start - Automated Tests

```bash
# Run all tests (recommended - includes Supabase setup)
npm run start:test

# Or run specific test types:
npm test                  # Unit tests (fast, no Supabase needed)
npm run test:e2e          # E2E tests (requires Supabase + dev server)
npm run test:db           # Database schema tests (pgTAP)
```

**See "Automated Test Execution" section below for detailed test type requirements.**

---

## Prerequisites

### Required Services

1. **Local Supabase** (running via Docker)
   - See `.claude/setup/SUPABASE-LOCAL-SETUP.md` for setup
   - Must be running before testing

2. **Node.js & npm**
   - Version: 18+ recommended
   - Check: `node --version`

3. **Docker** (for Supabase)
   - Running and accessible
   - Check: `docker ps | grep supabase`

### Verify Prerequisites

```bash
# Check Supabase is running
docker ps | grep supabase_db_rock-on

# Check Node/npm
node --version
npm --version

# Check environment
cat .env.local.dev
```

---

## Database Setup

### Fresh Database Initialization

The `./scripts/reset_local_db.sh` script provides a clean, repeatable database setup:

**What it does:**
1. Drops all existing tables and policies
2. Creates fresh schema from `scripts/fresh_init.sql`
3. Seeds test data from `scripts/seed_test_data.sql`
4. Verifies setup (15 tables, 33 RLS policies)

**When to use:**
- Initial setup
- After schema changes
- When database state is unclear
- Before integration testing
- To fix corruption or inconsistencies

**Usage:**
```bash
./scripts/reset_local_db.sh
```

**Expected output:**
```
==================================
Rock On - Database Reset Script
==================================

✓ Container is running
✓ Existing schema dropped
✓ Fresh schema created successfully
✓ Test data seeded successfully
✓ Schema verification passed

Tables created:     15
RLS policies created:     33

✓ Database reset complete!
```

### Manual Database Access

```bash
# Access Supabase database directly
docker exec -it supabase_db_rock-on psql -U postgres -d postgres

# Or run queries directly
docker exec supabase_db_rock-on psql -U postgres -d postgres -c "
  SELECT * FROM users;
"
```

---

## Test Users

The seed data creates 3 authenticated test users that match Supabase Auth:

### Eric (Admin)
- **Email:** `eric@ipodshuffle.com`
- **Password:** `test123`
- **Role:** Band admin
- **Instruments:** Guitar, Vocals
- **Band:** iPod Shuffle

### Mike (Member)
- **Email:** `mike@ipodshuffle.com`
- **Password:** `test123`
- **Role:** Band member
- **Instruments:** Bass, Harmonica, Vocals
- **Band:** iPod Shuffle

### Sarah (Member)
- **Email:** `sarah@ipodshuffle.com`
- **Password:** `test123`
- **Role:** Band member
- **Instruments:** Drums, Percussion
- **Band:** iPod Shuffle

**Note:** These users exist in both:
1. Supabase Auth (`auth.users`)
2. Application database (`public.users`)

---

## Test Data

After running `reset_local_db.sh`, the database contains:

### Band
- **Name:** iPod Shuffle
- **Members:** Eric (admin), Mike, Sarah
- **Settings:** Rehearsal on Thursdays at 7:00 PM

### Songs (5)
1. Sweet Child O' Mine - Guns N' Roses
2. Pride and Joy - Stevie Ray Vaughan
3. Wonderwall - Oasis
4. Enter Sandman - Metallica
5. Black Hole Sun - Soundgarden

### Setlists (2)
1. **Rock Classics Set** (active)
   - 4 songs + 1 break
   - Linked to upcoming show

2. **Blues Night** (draft)
   - 1 song
   - Linked to past show

### Shows (3)
1. **Toys 4 Tots Benefit Concert** (Upcoming)
   - Date: ~2 weeks from now
   - Venue: The Whiskey Room
   - Payment: $500
   - Status: Upcoming
   - Setlist: Rock Classics Set

2. **New Year's Eve Bash** (Upcoming)
   - Date: ~4 weeks from now
   - Venue: Downtown Music Hall
   - Payment: $1000
   - Status: Upcoming

3. **Blues Night at Smokey's** (Past)
   - Date: ~1 week ago
   - Venue: Smokey's Bar & Grill
   - Payment: $300
   - Status: Completed
   - Setlist: Blues Night

### Practice Sessions (2)
- 1 upcoming rehearsal (in 3 days)
- 1 past rehearsal (3 days ago)

---

## Development Workflow

### 1. Start Services

```bash
# Start Supabase (if not running)
npx supabase start

# Start dev server
npm run dev
```

### 2. Reset Database (as needed)

```bash
# When you need fresh data
./scripts/reset_local_db.sh

# Reload browser to clear IndexedDB cache
```

### 3. Test Features

**Login:**
- Navigate to http://localhost:5173
- Click "Show Mock Users for Testing"
- Click "Eric (Guitar, Vocals)"
- Auto-fills credentials and logs in

**Shows:**
- Click "Shows" in sidebar
- View existing shows
- Create new show
- Edit show
- Delete show
- Verify sync to Supabase

**Sync Verification:**
```bash
# Check shows in database
docker exec supabase_db_rock-on psql -U postgres -d postgres -c "
  SELECT name, venue, scheduled_date, payment/100.0 as payment_dollars
  FROM practice_sessions
  WHERE type = 'gig'
  ORDER BY scheduled_date;
"
```

### 4. Monitor Sync

**Browser Console:**
- Open DevTools (F12)
- Check for sync messages:
  - `🔄 Pulling changes from remote`
  - `✅ Pull from remote complete`
  - `❌ Pull from remote failed` (if errors)

**Common Sync Issues:**
- RLS policy errors → Check policies in database
- Field mapping errors → Check RemoteRepository.ts
- Network errors → Check Supabase is running

---

## Testing Checklist

### Initial Setup
- [ ] Supabase is running (`docker ps | grep supabase`)
- [ ] Database reset successful (`./scripts/reset_local_db.sh`)
- [ ] Dev server started (`npm run dev`)
- [ ] Can access http://localhost:5173

### Authentication
- [ ] Can see login page
- [ ] Mock users button shows Eric/Mike/Sarah
- [ ] Can log in as Eric
- [ ] Redirects to home page after login
- [ ] User info displayed in header

### Shows Feature
- [ ] Can navigate to Shows page
- [ ] See 3 test shows (2 upcoming, 1 past)
- [ ] Can filter shows (upcoming/past/all)
- [ ] Can create new show
  - All fields save correctly
  - Contacts array works
  - Payment in dollars converts to cents
  - Setlist association works
- [ ] Can edit existing show
- [ ] Can delete show
- [ ] Changes sync to Supabase within ~30 seconds

### Sync Verification
- [ ] No console errors
- [ ] See sync messages in console
- [ ] Data appears in Supabase:
  ```bash
  docker exec supabase_db_rock-on psql -U postgres -d postgres -c "
    SELECT COUNT(*) FROM practice_sessions WHERE type = 'gig';
  "
  # Should show 3 (or more if you created shows)
  ```

### Data Integrity
- [ ] Songs display correctly
- [ ] Setlists display correctly
- [ ] Shows link to setlists
- [ ] Member info correct
- [ ] No RLS errors in console

---

## Troubleshooting

### Database Issues

**Problem:** "Container not running"
```bash
# Start Supabase
npx supabase start

# Check status
npx supabase status
```

**Problem:** "Tables already exist"
```bash
# Reset will drop and recreate
./scripts/reset_local_db.sh
```

**Problem:** "RLS infinite recursion"
```bash
# Fixed in fresh_init.sql
# Just reset database
./scripts/reset_local_db.sh
```

### Sync Issues

**Problem:** "No bands found"
```bash
# User has no band memberships
# Reset database to get test data
./scripts/reset_local_db.sh

# Or manually add membership
docker exec supabase_db_rock-on psql -U postgres -d postgres -c "
  INSERT INTO band_memberships (user_id, band_id, role, status)
  VALUES (
    (SELECT id FROM auth.users WHERE email = 'eric@ipodshuffle.com'),
    (SELECT id FROM bands LIMIT 1),
    'admin',
    'active'
  );
"
```

**Problem:** "Sync fails with 500 error"
```bash
# Check console for specific error
# Common: RLS policy rejection

# Check RLS policies
docker exec supabase_db_rock-on psql -U postgres -d postgres -c "
  SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
"
```

### Authentication Issues

**Problem:** "Invalid email or password"
- Use test users: `eric@ipodshuffle.com` / `test123`
- Or use mock user buttons
- Password is `test123` for all test users

**Problem:** "User exists but can't log in"
- User might be in `public.users` but not `auth.users`
- Use the mock users which are in both

---

## Automated Test Execution

Rock-On has 5 different categories of automated tests, each with different requirements and execution environments.

### Test Type Overview

| Test Type | Count | Needs Supabase | Runner | Command |
|-----------|-------|----------------|--------|---------|
| **Unit** | 23 files | ❌ No (uses mocks) | Vitest | `npm test -- tests/unit/` |
| **Integration** | 1 file | ✅ Yes | Vitest | `npm test -- tests/integration/` |
| **Journey** | 4 files | ✅ **Yes** | Vitest | `npm test -- tests/journeys/` |
| **Contract** | 3 files | ✅ Yes | Vitest | `npm test -- tests/contract/` |
| **E2E** | 11 files | ✅ Yes + Dev Server | Playwright | `npm run test:e2e` |
| **Database** | 11 files | ✅ Yes | pgTAP | `npm run test:db` |

### Recommended Test Execution

**Option 1: Run All Tests (Recommended)**
```bash
# This script handles everything:
# 1. Starts Supabase if not running
# 2. Sets test environment
# 3. Runs all test suites
npm run start:test
```

**Option 2: Run Specific Test Types**
```bash
# Unit tests only (fast, no setup needed)
npm test -- tests/unit/

# Journey + Contract tests (requires Supabase)
supabase start
npm test -- tests/journeys/ tests/contract/

# E2E tests (requires Supabase + dev server)
npm run test:e2e

# Database schema tests
npm run test:db
```

### Test Type Details

#### 1. Unit Tests (`tests/unit/`)
**Purpose:** Test individual functions/components in isolation
**Dependencies:** Mocked repositories, fake-indexeddb
**Supabase Required:** ❌ No
**Examples:**
- `services/BandService.test.ts` - Service layer with mocked repository
- `hooks/useSyncStatus.test.ts` - React hooks
- `components/SyncStatusIndicator.test.tsx` - UI components

**Run:**
```bash
npm test -- tests/unit/
```

#### 2. Integration Tests (`tests/integration/`)
**Purpose:** Test multiple components working together
**Dependencies:** Real database interactions
**Supabase Required:** ✅ Yes
**Examples:**
- `template.test.ts` - Template for integration tests

**Run:**
```bash
supabase start
npm test -- tests/integration/
```

#### 3. Journey Tests (`tests/journeys/`)
**Purpose:** Test complete user workflows (offline sync, real-time, auth)
**Dependencies:** **REQUIRES real Supabase** (calls `getSupabaseClient()` directly)
**Supabase Required:** ✅ **Yes** (critical)
**Examples:**
- `sync-journeys.test.ts` - Offline/online sync scenarios
- `realtime-sync-journeys.test.ts` - Multi-device sync
- `auth-journeys.test.ts` - Session timeout, multi-tab auth
- `error-recovery-journeys.test.ts` - Network failures, data corruption

**Important:** These tests simulate multi-device scenarios using the `TestDevice` class, which directly interacts with Supabase. They will fail if Supabase is not running.

**Run:**
```bash
supabase start
npm test -- tests/journeys/
```

#### 4. Contract Tests (`tests/contract/`)
**Purpose:** Verify API contracts match expectations
**Dependencies:** Real Supabase API
**Supabase Required:** ✅ Yes
**Examples:**
- `songs-api.test.ts` - Songs API contract
- `setlists-api.test.ts` - Setlists API contract
- `practice-sessions-api.test.ts` - Practice sessions API

**Run:**
```bash
supabase start
npm test -- tests/contract/
```

#### 5. E2E Tests (`tests/e2e/`)
**Purpose:** Test complete user flows in real browser
**Dependencies:** Real Supabase + running dev server
**Supabase Required:** ✅ Yes + dev server
**Runner:** Playwright (separate from Vitest)
**Examples:**
- `auth/login-smoke.spec.ts` - Login flow
- `bands/create-band.spec.ts` - Band creation
- `songs/crud.spec.ts` - Song management

**Run:**
```bash
supabase start
npm run test:e2e  # Playwright starts dev server automatically
```

**E2E Best Practice:** Start from fresh database each time:
```bash
supabase db reset
npm run test:e2e
```

#### 6. Database Tests (`supabase/tests/`)
**Purpose:** Validate database schema, RLS policies, triggers
**Dependencies:** Supabase with pgTAP extension
**Supabase Required:** ✅ Yes
**Examples:**
- `001-schema-tables.test.sql` - Table existence
- `006-rls-policies.test.sql` - RLS policy validation
- `010-audit-log.test.sql` - Audit logging

**Run:**
```bash
npm run test:db
```

### Environment Setup for Tests

**For Journey/Contract/E2E Tests:**

These tests require Supabase environment variables. The recommended workflow:

```bash
# Method 1: Use npm run start:test (recommended)
npm run start:test

# Method 2: Manual setup
supabase start
npm run env:test  # Copies .env.test → .env.local
npm test
```

**What `npm run start:test` does:**
1. Checks if Supabase is running, starts it if not
2. Copies `.env.test` → `.env.local` (sets environment variables)
3. Runs `npm run test:all` (unit + integration + journey + contract + database tests)

**Environment Variables Required:**
- `VITE_SUPABASE_URL` - Local Supabase URL (usually `http://127.0.0.1:54321`)
- `VITE_SUPABASE_ANON_KEY` - Local Supabase anon key (get from `supabase status`)

### Developer Workflow

**During Development (Fast Feedback):**
```bash
# Run unit tests in watch mode (no Supabase needed)
npm test -- tests/unit/services/BandService.test.ts --watch
```

**Before Committing:**
```bash
# Run all tests
npm run start:test

# Check types
npm run type-check

# Lint
npm run lint
```

**Debugging Test Failures:**
```bash
# Run single test file
npm test -- tests/journeys/sync-journeys.test.ts

# Run with verbose output
npm test -- tests/journeys/ --reporter=verbose

# Run E2E tests with UI
npm run test:e2e:ui
```

---

## Advanced: Custom Test Data

### Add Your Own Test User

```bash
# 1. Sign up through UI
# 2. Get user ID from browser console after login
# 3. Add to a band

docker exec supabase_db_rock-on psql -U postgres -d postgres -c "
  INSERT INTO band_memberships (user_id, band_id, role, status)
  VALUES (
    '<your-user-id>',
    (SELECT id FROM bands WHERE name = 'iPod Shuffle'),
    'member',
    'active'
  );
"
```

### Modify Seed Data

Edit `scripts/seed_test_data.sql` and add your data, then:

```bash
./scripts/reset_local_db.sh
```

---

## Scripts Reference

### reset_local_db.sh
**Purpose:** Complete database reset to fresh state
**Location:** `scripts/reset_local_db.sh`
**Usage:** `./scripts/reset_local_db.sh`
**Safe:** Yes - only affects local Supabase

### fresh_init.sql
**Purpose:** Complete database schema
**Location:** `scripts/fresh_init.sql`
**Usage:** Applied automatically by reset script
**Contains:** Tables, indexes, RLS policies, triggers

### seed_test_data.sql
**Purpose:** Test data for development
**Location:** `scripts/seed_test_data.sql`
**Usage:** Applied automatically by reset script
**Contains:** 3 users, 1 band, 5 songs, 2 setlists, 3 shows, 2 practices

---

## Environment Variables

### .env.local.dev (Local Development)

```bash
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<your-local-anon-key>
```

Get your local anon key:
```bash
npx supabase status | grep "anon key"
```

---

## Quick Commands Reference

```bash
# Database Management
./scripts/reset_local_db.sh              # Reset to fresh state
docker exec supabase_db_rock-on psql ... # Direct database access

# Development
npm run dev                               # Start dev server
npm test                                  # Run tests
npm run lint                              # Check code quality
npm run type-check                        # TypeScript validation

# Supabase
npx supabase start                        # Start local Supabase
npx supabase stop                         # Stop local Supabase
npx supabase status                       # Check status
npx supabase db reset                     # Reset (old approach)

# Verification
docker ps | grep supabase                 # Check containers
curl http://localhost:54321               # Check API
```

---

## Support

- **Database Schema:** `.claude/specifications/unified-database-schema.md`
- **Shows Implementation:** `.claude/artifacts/2025-10-27T15:23_shows-mvp-deployment-complete.md`
- **Supabase Setup:** `.claude/setup/SUPABASE-LOCAL-SETUP.md`

---

**Last Updated:** 2025-10-27
**Status:** Production Ready
