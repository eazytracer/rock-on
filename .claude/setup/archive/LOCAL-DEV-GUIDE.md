# Local Development Guide - Rock On with Supabase

Complete guide for running Rock On locally with Supabase.

**Last Updated:** 2025-10-27T17:14

---

## Quick Start

```bash
# 1. Start Supabase (once)
npx supabase start

# 2. Reset database with fresh data
./scripts/reset_local_db.sh

# 3. Run app (choose one method below)

# Option A: Direct (Recommended for development)
npm run dev

# Option B: Docker Compose
docker-compose --profile dev --env-file .env.local up
```

**Access app:** http://localhost:5173

---

## Prerequisites

### Required

- ✅ Node.js 18+ (`node --version`)
- ✅ npm (`npm --version`)
- ✅ Docker Desktop (for Supabase)
- ✅ Git

### Optional

- Docker Compose (for containerized development)
- Chrome (for MCP testing)

---

## Setup Instructions

### 1. Install Dependencies

```bash
# Install Node dependencies
npm install

# Verify installation
npm list --depth=0
```

### 2. Start Supabase

Supabase runs in Docker containers managed by the Supabase CLI:

```bash
# Start all Supabase services
npx supabase start

# Expected output:
# API URL: http://127.0.0.1:54321
# Database URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
# Studio URL: http://127.0.0.1:54323
```

**Supabase will start:**

- PostgreSQL database (port 54322)
- API server (port 54321)
- Studio dashboard (port 54323)
- Auth server
- Storage server

### 3. Configure Environment

The `.env.local` file is already configured for local Supabase:

```bash
# View current configuration
cat .env.local
```

**Should show:**

```bash
VITE_MOCK_AUTH=false
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
VITE_GOOGLE_CLIENT_ID=mock
```

**Note:** The anon key is from `npx supabase status`

### 4. Initialize Database

Run the reset script to set up a fresh database with test data:

```bash
# Reset database to fresh state
./scripts/reset_local_db.sh

# Expected output:
# ✓ Existing schema dropped
# ✓ Fresh schema created successfully
# ✓ Test data seeded successfully
# ✓ Schema verification passed
# Tables created: 15
# RLS policies created: 33
```

This script:

- Drops all existing tables
- Creates fresh schema from `scripts/fresh_init.sql`
- Seeds test data from `scripts/seed_test_data.sql`
- Verifies setup

---

## Running the Application

### Method 1: Direct NPM (Recommended)

**Best for:** Active development, hot reload, debugging

```bash
# Start development server
npm run dev

# Open browser
# http://localhost:5173
```

**Features:**

- ✅ Fast hot module reload (HMR)
- ✅ Direct access to node_modules
- ✅ Easy debugging
- ✅ No container overhead

**To stop:** Press `Ctrl+C`

### Method 2: Docker Compose

**Best for:** Consistent environment, production-like setup

```bash
# Start with docker-compose
docker-compose --profile dev --env-file .env.local up

# Or build and start
docker-compose --profile dev --env-file .env.local up --build

# Run in background (detached)
docker-compose --profile dev --env-file .env.local up -d
```

**Features:**

- ✅ Isolated environment
- ✅ Consistent across machines
- ✅ Production-like setup

**To stop:**

```bash
# If running in foreground
Ctrl+C

# If running in background
docker-compose --profile dev down
```

**To view logs:**

```bash
docker-compose --profile dev logs -f rock-on-dev
```

---

## Test Users

After running `./scripts/reset_local_db.sh`, you'll have 3 test users:

### Eric (Admin)

- **Email:** `eric@ipodshuffle.com`
- **Password:** `test123`
- **Role:** Band admin
- **Instruments:** Guitar, Vocals

### Mike (Member)

- **Email:** `mike@ipodshuffle.com`
- **Password:** `test123`
- **Role:** Band member
- **Instruments:** Bass, Harmonica, Vocals

### Sarah (Member)

- **Email:** `sarah@ipodshuffle.com`
- **Password:** `test123`
- **Role:** Band member
- **Instruments:** Drums, Percussion

**Quick Login:**

1. Open http://localhost:5173
2. Click "Show Mock Users for Testing"
3. Click any user to auto-fill and log in

---

## Development Workflow

### Typical Day-to-Day

```bash
# Morning: Start Supabase (if not running)
npx supabase status  # Check if running
npx supabase start   # Start if needed

# Start dev server
npm run dev

# Make changes to code
# Hot reload will automatically update browser

# Stop dev server when done
Ctrl+C
```

### After Pulling Code

```bash
# Update dependencies
npm install

# Verify Supabase running
npx supabase status

# If schema changed, reset database
./scripts/reset_local_db.sh

# Start dev server
npm run dev
```

### After Schema Changes

```bash
# Apply fresh schema
./scripts/reset_local_db.sh

# Verify changes
docker exec supabase_db_rock-on psql -U postgres -d postgres -c "\dt"
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/unit/services/data/SyncRepository.test.ts

# Run tests in watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage
```

---

## Common Commands

### Supabase Management

```bash
# Start Supabase
npx supabase start

# Stop Supabase
npx supabase stop

# Check status
npx supabase status

# Restart Supabase
npx supabase stop && npx supabase start

# Open Supabase Studio
open http://localhost:54323
```

### Database Commands

```bash
# Reset database
./scripts/reset_local_db.sh

# Direct database access
docker exec -it supabase_db_rock-on psql -U postgres -d postgres

# Run SQL query
docker exec supabase_db_rock-on psql -U postgres -d postgres -c "SELECT * FROM users;"

# Check table count
docker exec supabase_db_rock-on psql -U postgres -d postgres -c "\dt"

# Check RLS policies
docker exec supabase_db_rock-on psql -U postgres -d postgres -c "\
  SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';"
```

### App Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run preview          # Preview production build

# Quality
npm test                 # Run tests
npm run lint             # Lint code
npm run type-check       # TypeScript validation

# Cleanup
rm -rf node_modules dist # Clean build artifacts
npm install              # Reinstall dependencies
```

### Docker Commands

```bash
# Development mode
docker-compose --profile dev --env-file .env.local up
docker-compose --profile dev down

# Production mode
docker-compose --profile prod --env-file .env.production up
docker-compose --profile prod down

# View logs
docker-compose --profile dev logs -f

# Rebuild
docker-compose --profile dev build --no-cache
```

---

## Troubleshooting

### Supabase Not Starting

**Problem:** `npx supabase start` fails or hangs

**Solutions:**

```bash
# 1. Check Docker is running
docker ps

# 2. Stop any conflicting services
npx supabase stop

# 3. Clean start
npx supabase stop
docker system prune -f
npx supabase start
```

### App Can't Connect to Supabase

**Problem:** App shows connection errors or sync failures

**Solutions:**

```bash
# 1. Verify Supabase is running
npx supabase status

# 2. Check .env.local configuration
cat .env.local

# 3. Verify URL and key match
npx supabase status | grep "API URL"
npx supabase status | grep "Publishable key"

# 4. Update .env.local if needed
# Copy URL and anon key from 'npx supabase status'
```

### Database Reset Fails

**Problem:** `./scripts/reset_local_db.sh` errors

**Solutions:**

```bash
# 1. Verify container name
docker ps | grep supabase_db

# 2. Try manual reset
docker exec supabase_db_rock-on psql -U postgres -d postgres -f /docker-entrypoint-initdb.d/fresh_init.sql

# 3. Or copy scripts into container
docker cp scripts/fresh_init.sql supabase_db_rock-on:/tmp/
docker exec supabase_db_rock-on psql -U postgres -d postgres -f /tmp/fresh_init.sql
```

### Port Already in Use

**Problem:** Port 5173 already in use

**Solutions:**

```bash
# 1. Find what's using the port
lsof -i :5173
# or
netstat -an | grep 5173

# 2. Kill the process
kill -9 <PID>

# 3. Or change Vite port in vite.config.ts
# server: { port: 5174 }
```

### Hot Reload Not Working

**Problem:** Changes don't reflect in browser

**Solutions:**

```bash
# 1. Hard refresh browser
Ctrl+Shift+R  # Windows/Linux
Cmd+Shift+R   # Mac

# 2. Restart dev server
Ctrl+C
npm run dev

# 3. Clear browser cache
# DevTools → Application → Clear storage

# 4. Check file watchers (Linux)
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### RLS Policy Errors

**Problem:** Queries fail with RLS permission errors

**Solutions:**

```bash
# 1. Reset database with fixed policies
./scripts/reset_local_db.sh

# 2. Check policies exist
docker exec supabase_db_rock-on psql -U postgres -d postgres -c "\
  SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';"

# 3. Test as authenticated user
docker exec supabase_db_rock-on psql -U postgres -d postgres -c "\
  SET ROLE authenticated;
  SET request.jwt.claims TO '{\"sub\": \"<user-id>\"}';
  SELECT * FROM songs LIMIT 1;"
```

---

## Environment Modes

### Local Development (.env.local)

**Use for:** Daily development with real Supabase

```bash
VITE_MOCK_AUTH=false
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
```

**Start with:**

```bash
npm run dev
# Automatically uses .env.local
```

### Mock Mode (.env.local.dev)

**Use for:** Testing without Supabase, offline development

```bash
VITE_MOCK_AUTH=true
VITE_SUPABASE_URL=mock
VITE_SUPABASE_ANON_KEY=mock
```

**Start with:**

```bash
cp .env.local.dev .env.local
npm run dev
```

### Production (.env.production)

**Use for:** Production deployment

```bash
VITE_SUPABASE_URL=https://khzeuxxhigqcmrytsfux.supabase.co
VITE_SUPABASE_ANON_KEY=<production-key>
```

**Build with:**

```bash
npm run build
# Outputs to /dist
```

---

## Useful URLs

### Local Development

- **App:** http://localhost:5173
- **Supabase Studio:** http://localhost:54323
- **Supabase API:** http://localhost:54321
- **Database:** postgresql://postgres:postgres@localhost:54322/postgres

### Production

- **App:** https://rock-on-app.vercel.app (example)
- **Supabase:** https://khzeuxxhigqcmrytsfux.supabase.co

---

## Performance Tips

### Development Server

```bash
# 1. Use SSD for node_modules
# Already on SSD? Check with: df -h

# 2. Increase Node memory if needed
export NODE_OPTIONS="--max-old-space-size=4096"
npm run dev

# 3. Disable source maps in dev (if slow)
# Edit vite.config.ts: build.sourcemap = false
```

### Supabase

```bash
# 1. Limit log output
# Edit supabase/config.toml:
# [analytics] enabled = false

# 2. Reduce CPU throttling (Docker Desktop)
# Settings → Resources → increase CPU/Memory

# 3. Stop unused services
npx supabase stop
# Only restart when needed
```

---

## Advanced: Custom Setup

### Custom Supabase Port

If port 54321 is taken:

1. **Stop Supabase:**

   ```bash
   npx supabase stop
   ```

2. **Edit `supabase/config.toml`:**

   ```toml
   [api]
   port = 54325  # Change to available port
   ```

3. **Update `.env.local`:**

   ```bash
   VITE_SUPABASE_URL=http://127.0.0.1:54325
   ```

4. **Restart:**
   ```bash
   npx supabase start
   ```

### Using Docker Compose with Supabase

The updated `docker-compose.yml` connects to host Supabase:

```bash
# Start app in Docker, connected to host Supabase
docker-compose --profile dev --env-file .env.local up

# App container accesses Supabase via host.docker.internal:54321
```

**Note:** Requires `extra_hosts` configuration (already in docker-compose.yml)

---

## Quick Reference

### Start Everything

```bash
# One-liner to start fresh
npx supabase start && ./scripts/reset_local_db.sh && npm run dev
```

### Stop Everything

```bash
# Stop dev server: Ctrl+C

# Stop Supabase
npx supabase stop

# Stop Docker containers
docker-compose --profile dev down
```

### Daily Workflow

```bash
# Morning
npx supabase status || npx supabase start
npm run dev

# Afternoon (code changes)
# Just save files - HMR handles updates

# Evening
Ctrl+C  # Stop dev server
# Supabase can keep running
```

### Full Clean Slate

```bash
# Nuclear option - complete reset
npx supabase stop
docker system prune -af
rm -rf node_modules dist
npm install
npx supabase start
./scripts/reset_local_db.sh
npm run dev
```

---

## Support & Resources

### Documentation

- **Setup:** `.claude/setup/TESTING-ENVIRONMENT-SETUP.md`
- **Schema:** `.claude/specifications/unified-database-schema.md`
- **Testing:** `.claude/commands/test-shows.md`

### Commands

```bash
# Help
npm run --help
npx supabase --help

# Status
npx supabase status
docker ps
npm list

# Logs
docker-compose --profile dev logs -f
tail -f ~/.npm/_logs/*.log
```

### Common Issues

- **Can't connect:** Check Supabase is running (`npx supabase status`)
- **Database errors:** Reset database (`./scripts/reset_local_db.sh`)
- **Build errors:** Clear and reinstall (`rm -rf node_modules && npm install`)
- **Port conflicts:** Change Vite port in `vite.config.ts`

---

**Updated:** 2025-10-27T17:14
**Status:** Production Ready
