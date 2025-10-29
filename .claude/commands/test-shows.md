# Test Shows Implementation

Quick command to set up and test the shows feature.

## Usage

```bash
# 1. Reset database to fresh state
./scripts/reset_local_db.sh

# 2. Start dev server (if not running)
npm run dev

# 3. Open browser to http://localhost:5173

# 4. Log in with test user:
#    - Click "Show Mock Users for Testing"
#    - Click "Eric (Guitar, Vocals)"
#    - OR manually enter:
#      Email: eric@ipodshuffle.com
#      Password: test123

# 5. Navigate to Shows page
#    - Click "Shows" in sidebar
#    - Should see 3 test shows (after sync completes)

# 6. Test CRUD operations:
#    - Create new show
#    - Edit existing show
#    - Delete show
#    - Verify changes sync to Supabase
```

## Verify Data in Supabase

```bash
# Check shows in database
docker exec supabase_db_rock-on psql -U postgres -d postgres -c "
  SELECT name, venue, scheduled_date::date, payment/100.0 as dollars
  FROM practice_sessions
  WHERE type = 'gig'
  ORDER BY scheduled_date;
"

# Check band memberships
docker exec supabase_db_rock-on psql -U postgres -d postgres -c "
  SELECT u.email, b.name as band_name, bm.role
  FROM band_memberships bm
  JOIN users u ON bm.user_id = u.id
  JOIN bands b ON bm.band_id = b.id;
"
```

## Test Data Included

After running `./scripts/reset_local_db.sh`:

**Shows:**
1. Toys 4 Tots Benefit Concert - The Whiskey Room - $500
2. New Year's Eve Bash - Downtown Music Hall - $1000
3. Blues Night at Smokey's - Smokey's Bar & Grill - $300

**Songs:** 5 classic rock songs
**Setlists:** 2 setlists
**Band:** iPod Shuffle
**Members:** Eric (admin), Mike, Sarah

## Troubleshooting

**Problem: No shows appear in UI**
- Check browser console for sync errors
- Verify data exists in Supabase (see commands above)
- Try manual sync: Reload page (Ctrl+R / Cmd+R)
- Check IndexedDB in DevTools → Application → IndexedDB

**Problem: Can't log in**
- Use mock user buttons (Eric, Mike, or Sarah)
- Password for all test users: `test123`

**Problem: Sync errors**
- Check Supabase is running: `docker ps | grep supabase`
- Reset database: `./scripts/reset_local_db.sh`
- Clear browser cache and reload

## See Also

- Setup Guide: `.claude/setup/TESTING-ENVIRONMENT-SETUP.md`
- Implementation Details: `.claude/artifacts/2025-10-27T15:23_shows-mvp-deployment-complete.md`
