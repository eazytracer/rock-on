# Supabase Local Development Setup Guide

This guide walks you through setting up Supabase to run locally in Docker, giving you a full local database for development.

## Benefits of Local Supabase

✅ **Instant schema validation** - Check schema changes locally before pushing
✅ **Faster development** - No network latency
✅ **Free** - No cloud costs during development
✅ **Full control** - Direct PostgreSQL access
✅ **Migration testing** - Test migrations locally first
✅ **Supabase Studio** - Web UI at http://localhost:54323

---

## Step 1: Enable Docker in Dev Container

Since you're in a dev container, you need Docker-in-Docker or Docker-outside-Docker.

### Option A: Mount Host Docker Socket (Recommended)

Add this to your `.devcontainer/devcontainer.json`:

```json
{
  "mounts": [
    "source=/var/run/docker.sock,target=/var/run/docker.sock,type=bind"
  ],
  "features": {
    "ghcr.io/devcontainers/features/docker-outside-of-docker:1": {}
  }
}
```

Then rebuild your dev container.

### Option B: Docker-in-Docker

Add to `.devcontainer/devcontainer.json`:

```json
{
  "features": {
    "ghcr.io/devcontainers/features/docker-in-docker:2": {}
  }
}
```

Then rebuild your dev container.

---

## Step 2: Install Supabase CLI

```bash
# Install via npm (easiest)
npm install -D supabase

# Or via direct download (if npm doesn't work)
curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz | tar -xz
sudo mv supabase /usr/local/bin/
```

---

## Step 3: Initialize Supabase in Project

```bash
# Initialize Supabase (creates supabase/ directory)
npx supabase init

# This creates:
# supabase/
#   ├── config.toml        # Supabase configuration
#   ├── migrations/        # Already exists (your migrations)
#   └── seed.sql          # Seed data (optional)
```

---

## Step 4: Start Local Supabase

```bash
# Start all Supabase services in Docker
npx supabase start

# This will:
# 1. Pull Docker images (~1-2 minutes first time)
# 2. Start PostgreSQL, PostgREST, Auth, Storage, etc.
# 3. Apply your migrations from supabase/migrations/
# 4. Show you the connection details
```

You'll see output like:

```
Started supabase local development setup.

         API URL: http://localhost:54321
     GraphQL URL: http://localhost:54321/graphql/v1
          DB URL: postgresql://postgres:postgres@localhost:54322/postgres
      Studio URL: http://localhost:54323
    Inbucket URL: http://localhost:54324
      JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
        anon key: eyJhbG...
service_role key: eyJhbG...
```

---

## Step 5: Update Local Environment

Create `.env.local` for local development:

```bash
# Local Supabase (for development)
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=eyJhbGc... # Copy from supabase start output

# Production Supabase (comment out during local dev)
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-production-key
```

---

## Step 6: Access Supabase Studio

Open http://localhost:54323 in your browser. You'll see:

- **Table Editor** - Browse/edit data visually
- **SQL Editor** - Run queries directly
- **Database** - View schema, triggers, functions
- **Auth** - Manage users
- **Storage** - Manage files

**This is the killer feature** - you can instantly see your schema and validate changes!

---

## Common Commands

```bash
# Start Supabase
npx supabase start

# Stop Supabase (keeps data)
npx supabase stop

# Reset database (wipes all data, re-runs migrations)
npx supabase db reset

# Apply pending migrations
npx supabase db push

# Create a new migration
npx supabase migration new migration_name

# Generate TypeScript types from schema
npx supabase gen types typescript --local > src/types/database.types.ts

# View logs
npx supabase logs

# Check status
npx supabase status
```

---

## Workflow: Developing with Local Supabase

### 1. Start Local Supabase

```bash
npx supabase start
npm run dev
```

### 2. Make Schema Changes

**Option A: Write SQL migration**

```bash
npx supabase migration new add_items_to_setlists
# Edit supabase/migrations/TIMESTAMP_add_items_to_setlists.sql
npx supabase db reset  # Apply migration
```

**Option B: Use Studio**
1. Go to http://localhost:54323
2. Use Table Editor or SQL Editor to make changes
3. Generate migration from diff:

```bash
npx supabase db diff --schema public > supabase/migrations/TIMESTAMP_changes.sql
```

### 3. Validate Changes

```bash
# Check schema in Studio
open http://localhost:54323

# Or use psql
psql postgresql://postgres:postgres@localhost:54322/postgres

# Or our new tool (once working)
npm run schema:show
```

### 4. Test Your Code

Run your app against local Supabase - no waiting, no cloud costs!

### 5. Push to Production

```bash
# Push migrations to production Supabase
npx supabase db push --linked

# Or deploy manually via Supabase Dashboard
```

---

## Troubleshooting

### "Cannot connect to Docker daemon"

```bash
# Check Docker is running
docker ps

# If not, start Docker service (depends on your system)
sudo service docker start
```

### "Port already in use"

```bash
# Stop Supabase
npx supabase stop

# Or check what's using the port
lsof -i :54321
```

### "Migrations failed to apply"

```bash
# Reset and try again
npx supabase db reset

# Or check logs
npx supabase logs
```

### Need to access PostgreSQL directly?

```bash
# Using psql
psql postgresql://postgres:postgres@localhost:54322/postgres

# Using any PostgreSQL client
Host: localhost
Port: 54322
User: postgres
Password: postgres
Database: postgres
```

---

## Schema Validation Script (Future)

Once local Supabase is running, we can create a script that:

1. Connects to local Supabase PostgreSQL
2. Queries `information_schema.columns` directly
3. Validates against our TypeScript types
4. Generates type files automatically

This would have caught the `updated_date` vs `last_modified` issue immediately!

---

## Next Steps

After setup:

1. **Test the setlists migration locally first**
   ```bash
   npx supabase db reset
   # Verify in Studio that items column exists
   ```

2. **Run our app against local Supabase**
   ```bash
   npm run dev
   # Test creating/editing setlists
   ```

3. **Only push to production when local works**
   ```bash
   npx supabase db push --linked
   ```

This workflow prevents production issues and gives us instant feedback!
