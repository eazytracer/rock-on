---
description: Common Supabase CLI commands for local development and migrations
project: true
---

# Supabase CLI Commands

Common Supabase CLI operations for local development with our migration-based workflow.

## Environment Setup

**Supabase Local Stack:**
- Running in Docker containers via `supabase start`
- API URL: `http://127.0.0.1:54321`
- Studio URL: `http://127.0.0.1:54323`
- Database URL: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`

**Migration Files:**
- Location: `/workspaces/rock-on/supabase/migrations/`
- Format: `YYYYMMDDHHMMSS_description.sql`
- Applied in timestamp order

**Seed File:**
- Location: `/workspaces/rock-on/supabase/seed-mvp-data.sql`
- Configured in: `supabase/config.toml` → `[db.seed]` → `sql_paths`
- Contains test users (eric@, mike@, sarah@) with password: `test123`
- Auto-runs after migrations during `supabase db reset`

## Common Commands

### Start/Stop Supabase

```bash
# Start local Supabase (Docker containers)
supabase start

# Stop local Supabase
supabase stop

# Stop and remove all data (fresh start)
supabase stop --no-backup

# Check status
supabase status
```

### Database Operations

```bash
# Reset database (drops all data, re-runs migrations)
supabase db reset

# Push new migrations to database
supabase db push

# Create a new migration file
supabase migration new <migration_name>

# List all migrations
supabase migration list

# Diff database changes (see what changed)
supabase db diff

# Dump current schema to SQL file
supabase db dump -f supabase/schema.sql
```

### Common Workflow: Apply New Migration

When you create a new migration file like `20251101000001_enable_audit_log_realtime.sql`:

```bash
# Option 1: Reset and re-run all migrations (fresh start)
supabase db reset

# Option 2: Push just the new migration
supabase db push

# Verify it worked
supabase db diff  # Should show no differences
```

### Seed Data

```bash
# Run seed file (after migrations)
supabase db reset  # Runs migrations + seed

# Or manually run seed SQL
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres < supabase/seed-mvp-data.sql
```

### Studio (Web UI)

```bash
# Open Supabase Studio in browser
open http://127.0.0.1:54323

# Or get the URL
supabase status | grep Studio
```

### Troubleshooting

```bash
# View logs
supabase logs

# View realtime logs specifically
docker logs supabase_realtime_rock-on

# Connect to database directly
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres

# Check if realtime is enabled for a table
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';"

# Check replica identity
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "SELECT relname, CASE relreplident WHEN 'd' THEN 'DEFAULT' WHEN 'f' THEN 'FULL' END as replica_identity FROM pg_class WHERE relname IN ('songs', 'setlists', 'shows', 'practice_sessions', 'audit_log');"
```

## Current Migration Status

Check applied migrations (local and remote):

```bash
# Local migrations
supabase migration list

# Remote migrations
source .env.supabase && supabase migration list
```

Current migrations:
- ✅ `20251106000000_baseline_schema.sql` (Consolidated baseline - all 17 tables)
- ✅ `20251110060100_fix_bands_insert_policy.sql` (RLS policy fix)

## Remote Supabase (Production/Staging)

### Setup Remote Connection

**Prerequisites:**
1. Valid Supabase access token in `.env.supabase`
2. Project reference ID (e.g., `khzeuxxhigqcmrytsfux`)

**Authentication:**
```bash
# Load token from .env.supabase
source .env.supabase
export SUPABASE_ACCESS_TOKEN

# Link to remote project
supabase link --project-ref khzeuxxhigqcmrytsfux
```

### Remote Operations

```bash
# Check migration status (local vs remote)
export SUPABASE_ACCESS_TOKEN=$(grep SUPABASE_ACCESS_TOKEN .env.supabase | cut -d '=' -f2) && supabase migration list

# Push migrations to remote
export SUPABASE_ACCESS_TOKEN=$(grep SUPABASE_ACCESS_TOKEN .env.supabase | cut -d '=' -f2) && supabase db push --linked

# Mark a manually-applied migration as applied
export SUPABASE_ACCESS_TOKEN=$(grep SUPABASE_ACCESS_TOKEN .env.supabase | cut -d '=' -f2) && supabase migration repair --status applied <migration_id>

# Pull remote schema to compare with local
export SUPABASE_ACCESS_TOKEN=$(grep SUPABASE_ACCESS_TOKEN .env.supabase | cut -d '=' -f2) && supabase db pull --schema public
```

### Manual SQL Execution via Dashboard

For complex migrations or RLS policy fixes:

1. Go to: https://supabase.com/dashboard/project/khzeuxxhigqcmrytsfux
2. Navigate to **SQL Editor** (left sidebar)
3. Click **"+ New query"**
4. Paste SQL from `.claude/scripts/supabase/*.sql`
5. Click **"Run"** (Ctrl+Enter)
6. Mark migration as applied: `supabase migration repair --status applied <id>`

⚠️ **WARNING**: Always test migrations locally first!

## Quick Reference

| Task | Command |
|------|---------|
| Fresh start | `supabase db reset` |
| Apply new migration (local) | `supabase db push` |
| Apply new migration (remote) | `source .env.supabase && supabase db push --linked` |
| Create migration | `supabase migration new <name>` |
| Check status | `supabase status` |
| View Studio (local) | `open http://127.0.0.1:54323` |
| View Studio (remote) | `open https://supabase.com/dashboard/project/khzeuxxhigqcmrytsfux` |
| View logs | `supabase logs` |
| Connect to DB (local) | `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Link to remote | `source .env.supabase && supabase link --project-ref khzeuxxhigqcmrytsfux` |
| Check remote migrations | `source .env.supabase && supabase migration list` |

## Pro Tips

1. **Always test locally first** - Use `supabase db reset` to test migrations from scratch
2. **Name migrations clearly** - Use descriptive names: `add_user_roles.sql` not `update.sql`
3. **One logical change per migration** - Don't bundle unrelated changes
4. **Include verification queries** - Add SELECT queries at the end to verify the migration worked
5. **Document breaking changes** - Add comments explaining why changes were made

## Current Issue: Apply Latest Migration

Right now, you need to apply the `audit_log` realtime migration:

```bash
cd /workspaces/rock-on
supabase db reset
```

This will fix the "mismatch between server and client bindings" error.
