# Supabase Local Development in Devcontainer Setup

**Timestamp:** 2025-10-26T19:45
**Context:** Setting up local Supabase instance for development to enable better schema validation and local testing

## Problem Discovered

When attempting to run `npx supabase start`, the command consistently failed with:

```
Starting database...
Stopping containers...
failed to connect to postgres: failed to connect to `host=127.0.0.1 user=postgres database=postgres`: dial error (dial tcp 127.0.0.1:54322: connect: connection refused)
```

## Root Cause

This is a **known issue** with Supabase CLI running in devcontainers using `docker-outside-of-docker` (DooD). The problem occurs because:

1. Supabase CLI hardcodes `127.0.0.1` for local container connections
2. In DooD environments, containers run on the host Docker daemon, not inside the devcontainer
3. Container-to-container communication fails due to network isolation
4. The CLI tries to stop/verify containers during startup and cannot connect

**Related GitHub Issues:**
- [Issue #1603](https://github.com/supabase/cli/issues/1603) - DinD connection failures
- [Issue #1939](https://github.com/supabase/cli/issues/1939) - Devcontainer without `network_mode: "host"`

## Solution Implemented

Updated `.devcontainer/devcontainer.json` to use **docker-in-docker** instead of docker-outside-of-docker:

**Before:**
```json
"features": {
  "ghcr.io/devcontainers/features/docker-outside-of-docker:1.6.5": {}
}
```

**After:**
```json
"features": {
  "ghcr.io/devcontainers/features/docker-in-docker:2": {
    "moby": false
  }
}
```

The critical setting is `"moby": false` which resolves container health issues.

## Next Steps

### 1. Rebuild Dev Container

**You must rebuild your devcontainer for this change to take effect:**

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type "Dev Containers: Rebuild Container"
3. Select it and wait for the rebuild (2-5 minutes)

**Important:** Any unsaved work will be lost. Commit your changes first!

### 2. After Rebuild, Start Supabase

Once the devcontainer has rebuilt:

```bash
# Start Supabase (first time will pull images)
npx supabase start

# This should now work and display:
# - API URL: http://localhost:54321
# - DB URL: postgresql://postgres:postgres@localhost:54322/postgres
# - Studio URL: http://localhost:54323
# - anon key and service_role key
```

### 3. Configure App for Local Development

Create `.env.local.supabase` (or update `.env.local`):

```bash
# Local Supabase
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<anon-key-from-supabase-start-output>
VITE_MOCK_AUTH=false

# For local auth testing with real users
VITE_GOOGLE_CLIENT_ID=<your-google-client-id-or-mock>
```

### 4. Verify Setup

```bash
# Check status
npx supabase status

# Access Supabase Studio
open http://localhost:54323

# Verify migrations applied
# In Studio, go to Database > Tables and verify your schema
```

### 5. Test Sync with Local Supabase

```bash
# Run dev server
npm run dev

# Test creating/syncing data with local Supabase
# Check Studio to see data appears in real-time
```

## Benefits Once Working

✅ **Instant schema validation** - See exact Supabase schema locally
✅ **No cloud costs** during development
✅ **Faster development** - No network latency
✅ **Test migrations locally** before pushing to production
✅ **Direct PostgreSQL access** for debugging
✅ **Supabase Studio** - Visual database management at localhost:54323

## Common Commands

```bash
# Start Supabase
npx supabase start

# Stop Supabase (keeps data)
npx supabase stop

# Reset database (wipes data, re-runs migrations)
npx supabase db reset

# View status
npx supabase status

# View logs
npx supabase logs

# Generate TypeScript types from schema
npx supabase gen types typescript --local > src/types/database.types.ts
```

## Troubleshooting

If you still have issues after rebuild:

1. **Check Docker is running inside devcontainer:**
   ```bash
   docker ps
   docker version
   ```

2. **Clean Docker state:**
   ```bash
   npx supabase stop
   docker system prune -af
   ```

3. **Check port availability:**
   ```bash
   netstat -tulpn | grep -E '54321|54322|54323'
   ```

4. **Review logs:**
   ```bash
   npx supabase start --debug
   ```

## Alternative: Manual Docker Compose

If docker-in-docker still doesn't work, you can use Supabase's self-hosting Docker Compose as an alternative:
https://github.com/supabase/supabase/tree/master/docker

This requires more manual setup but provides full control.

---

**Status:** Configuration updated, awaiting devcontainer rebuild
