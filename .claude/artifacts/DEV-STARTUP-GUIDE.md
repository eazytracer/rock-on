# 🚀 Dev System Startup Guide (Local Supabase)

## Quick Start (TL;DR)

```bash
# 1. Start Supabase (if not running)
supabase start

# 2. Start dev server
npm run dev

# 3. Open browser
# App: http://localhost:5173
# Supabase Studio: http://127.0.0.1:54323
```

That's it! 🎉

---

## Detailed Startup Instructions

### Step 1: Start Supabase Local

**Check if Supabase is already running**:

```bash
supabase status
```

**If you see this**, Supabase is already running ✅:
```
supabase local development setup is running.

         API URL: http://127.0.0.1:54321
      Studio URL: http://127.0.0.1:54323
    Database URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

**If you see "services are not running"**, start Supabase:

```bash
supabase start
```

This will:
- Start PostgreSQL database
- Start Supabase API server
- Start Supabase Studio (web UI)
- Apply all migrations
- First time: Download Docker images (~2-5 minutes)
- Subsequent times: Start in ~30 seconds

**Wait for the success message**:
```
Started supabase local development setup.

         API URL: http://127.0.0.1:54321
      Studio URL: http://127.0.0.1:54323
    Database URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

---

### Step 2: Verify Supabase is Working

**Open Supabase Studio**:
```
http://127.0.0.1:54323
```

**Navigate through the UI**:
1. Click `Table Editor` in left sidebar
2. You should see your tables: `songs`, `setlists`, `shows`, `bands`, etc.
3. If tables are empty or missing, you may need to run migrations

**Check if tables exist**:
```bash
# List all tables
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "\dt"
```

**If tables are missing**, apply migrations:
```bash
supabase db reset
```

---

### Step 3: Seed Database (Optional but Recommended)

**Check if you have data**:

Open Supabase Studio → Table Editor → `users` table

**If empty, seed the database**:

```bash
# Method 1: Use seed file
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -f supabase/seed-local-dev.sql

# Method 2: Use Supabase CLI
supabase db seed
```

**Verify seeding worked**:
- Refresh Supabase Studio
- Check `users` table → Should have test users
- Check `bands` table → Should have test band(s)
- Check `songs` table → Should have test songs

---

### Step 4: Start Dev Server

```bash
npm run dev
```

**Expected output**:
```
  VITE v5.x.x  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h to show help
```

**If you see errors**:
- `EADDRINUSE`: Port 5173 is already in use → Kill existing process or change port
- `Module not found`: Run `npm install` first
- TypeScript errors: Run `npm run type-check` to see details

---

### Step 5: Open the App

**Open browser and go to**:
```
http://localhost:5173
```

**You should see**:
- The app login screen
- No errors in browser console
- Blue banner if sync is running

**Login with a test user**:

If you seeded the database, use:
- Email: `test@example.com`
- Password: (check your seed file for password)

Or create a new account via the signup flow.

---

### Step 6: Verify Sync is Working

**After login, check the browser console** (F12 → Console):

You should see logs like:
```
🚀 Rock On running in production mode
☁️  Using production mode (Dexie + Supabase sync)
🔄 Initial sync needed - downloading data from cloud...
🔄 Starting initial sync for user: [user-id]
📥 Syncing data for 1 bands
  ✓ Songs for band [band-id]: X
  ✓ Setlists for band [band-id]: X
  ✓ Practices for band [band-id]: X
  ✓ Shows for band [band-id]: X
✅ Initial sync complete: XX total records synced
✅ Initial sync complete
```

**If you DON'T see these logs**:
- Check that `VITE_MOCK_AUTH=false` in `.env.local`
- Check that Supabase URL is correct in `.env.local`
- Check browser Network tab for failed API calls

---

## Useful URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **App** | http://localhost:5173 | Your React app |
| **Supabase Studio** | http://127.0.0.1:54323 | Database UI |
| **Supabase API** | http://127.0.0.1:54321 | API endpoint |
| **Database** | postgresql://postgres:postgres@127.0.0.1:54322/postgres | Direct DB access |
| **Mailpit** | http://127.0.0.1:54324 | Email testing |

---

## Common Commands

### Supabase Commands

```bash
# Start Supabase
supabase start

# Stop Supabase
supabase stop

# Restart Supabase
supabase stop && supabase start

# Check status
supabase status

# View logs
supabase logs

# Reset database (drops all data!)
supabase db reset

# Create new migration
supabase migration new <name>

# Apply migrations
supabase db push

# Generate TypeScript types from schema
supabase gen types typescript --local > src/types/supabase.ts
```

### Dev Server Commands

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm test

# Run tests in watch mode
npm test -- --watch

# Type check
npm run type-check

# Lint
npm run lint
```

### Database Commands

```bash
# Connect to PostgreSQL
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres

# List tables
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\dt"

# Query data
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "SELECT * FROM songs LIMIT 10;"

# Seed database
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -f supabase/seed-local-dev.sql
```

---

## Troubleshooting

### Issue: Supabase won't start

**Error**: "Docker daemon is not running"

**Solution**:
```bash
# Check if Docker is running
docker ps

# If not, start Docker
# (Method depends on your system)
```

**Error**: "Port 54321 is already in use"

**Solution**:
```bash
# Check what's using the port
lsof -i :54321

# Kill the process or stop Supabase
supabase stop
```

### Issue: Dev server won't start

**Error**: "EADDRINUSE: address already in use :::5173"

**Solution**:
```bash
# Find process using port 5173
lsof -i :5173

# Kill it
kill -9 <PID>

# Or change port in vite.config.ts
```

**Error**: "Module not found"

**Solution**:
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Issue: No data after login

**Possible causes**:
1. Supabase database is empty
2. User not in any bands
3. Initial sync failed

**Solutions**:

**1. Check if Supabase has data**:
```bash
# Count records
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "SELECT 'songs' as table_name, count(*) FROM songs
      UNION ALL
      SELECT 'bands', count(*) FROM bands;"
```

**2. Seed the database**:
```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -f supabase/seed-local-dev.sql
```

**3. Check browser console for errors**:
- Open DevTools (F12)
- Look for red errors
- Check Network tab for failed API calls

**4. Force initial sync**:
```javascript
// In browser console:
localStorage.removeItem('last_full_sync')
location.reload()
```

### Issue: "Initial sync needed" but nothing happens

**Cause**: Supabase not running or connection failing

**Solutions**:

**1. Verify Supabase is running**:
```bash
supabase status
```

**2. Test API connection**:
```bash
curl http://127.0.0.1:54321/rest/v1/
```

**3. Check browser Network tab**:
- Open DevTools → Network
- Look for failed requests to `127.0.0.1:54321`
- Check error messages

**4. Check environment variables**:
```bash
cat .env.local
```

Should show:
```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
```

### Issue: TypeScript errors

**Run type check**:
```bash
npm run type-check
```

**Common fixes**:
- Restart VS Code
- Restart TypeScript server (VS Code: Cmd/Ctrl + Shift + P → "Restart TypeScript Server")
- Clear TypeScript cache: `rm -rf node_modules/.cache`

---

## Development Workflow

### Daily Workflow

```bash
# 1. Start Supabase (if not running)
supabase status || supabase start

# 2. Start dev server
npm run dev

# 3. Open browser to http://localhost:5173

# 4. Code, test, repeat!

# 5. When done, optionally stop Supabase
supabase stop
```

### Making Database Changes

**1. Create a new migration**:
```bash
supabase migration new add_new_column
```

**2. Edit the migration file** in `supabase/migrations/`

**3. Apply the migration**:
```bash
supabase db reset  # Resets and applies all migrations
```

**4. Generate TypeScript types** (optional):
```bash
supabase gen types typescript --local > src/types/supabase.ts
```

### Testing Sync

**1. Open two browser windows**:
- Window 1: http://localhost:5173 (logged in as User A)
- Window 2: http://localhost:5173 (incognito, logged in as User B)

**2. Create/edit data in Window 1**

**3. Wait 30 seconds**

**4. Check Window 2** → Should see the changes!

---

## Environment Modes

### Local Dev Mode (Current Setup)

**`.env.local`**:
```bash
VITE_MOCK_AUTH=false
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
```

- Uses local Supabase (Docker)
- Real auth and database
- Syncs between devices
- Fast (no network latency)

### Pure Local Mode (No Sync)

**Create `.env.local`**:
```bash
VITE_MOCK_AUTH=true
```

- No Supabase needed
- Mock authentication
- IndexedDB only
- No sync between devices
- Fastest for UI development

### Production Mode

**Create `.env.production.local`**:
```bash
VITE_MOCK_AUTH=false
VITE_SUPABASE_URL=https://khzeuxxhigqcmrytsfux.supabase.co
VITE_SUPABASE_ANON_KEY=<your-production-anon-key>
```

- Uses hosted Supabase
- Real production data
- Syncs across all devices
- Network latency

---

## Quick Reference Card

```bash
# STARTUP
supabase start           # Start Supabase
npm run dev             # Start dev server
open http://localhost:5173  # Open app

# USEFUL URLS
# App:              http://localhost:5173
# Supabase Studio:  http://127.0.0.1:54323
# Database:         postgresql://postgres:postgres@127.0.0.1:54322/postgres

# COMMON TASKS
supabase status         # Check if running
supabase logs          # View logs
supabase db reset      # Reset database
npm test               # Run tests
npm run type-check     # Check TypeScript

# DEBUGGING
supabase status        # Check Supabase
curl http://127.0.0.1:54321/rest/v1/  # Test API
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres  # Connect to DB

# SHUTDOWN
# Ctrl+C in dev server terminal
supabase stop          # Stop Supabase
```

---

## Performance Tips

### Speed Up Startup

**Keep Supabase running**:
```bash
# Don't stop Supabase between sessions
# Just leave it running in background
```

**Use PM2 or similar** (optional):
```bash
# Install PM2
npm install -g pm2

# Start dev server with PM2
pm2 start "npm run dev" --name rock-on

# View logs
pm2 logs rock-on

# Stop
pm2 stop rock-on
```

### Reduce Build Time

**Use Vite's fast refresh**:
- Saves on every file change
- No full page reload
- Preserves React state

**Skip TypeScript checks during dev**:
- Type checking runs in editor (VS Code)
- Run `npm run type-check` before committing

---

## Next Steps

Once your dev environment is running:

1. ✅ Run the sync tests from the testing guide
2. ✅ Create some songs/setlists
3. ✅ Test multi-device sync
4. ✅ Make your changes
5. ✅ Commit and push!

**Happy coding!** 🚀

---

**Quick Help**:
- Supabase not working? → `supabase status`
- No data? → `psql ... -f supabase/seed-local-dev.sql`
- Sync not working? → Check browser console
- TypeScript errors? → `npm run type-check`

See troubleshooting section above for detailed solutions!
