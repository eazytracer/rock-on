# Testing Environment Setup Guide

Complete guide for setting up and testing the Rock On application locally with Supabase.

## Quick Start

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
