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

Run this to see which migrations have been applied:

```bash
supabase migration list
```

Expected migrations:
- ✅ `20251029000001_add_version_tracking.sql`
- ✅ `20251030000001_enable_realtime.sql`
- ✅ `20251030000002_enable_realtime_replica_identity.sql`
- ✅ `20251031000001_add_audit_tracking.sql`
- 🆕 `20251101000001_enable_audit_log_realtime.sql` (NEW - needs to be applied)

## Applying the Latest Migration

To fix the current audit_log realtime error:

```bash
# Reset database (recommended - ensures clean state)
supabase db reset

# This will:
# 1. Drop all tables
# 2. Re-run ALL migrations in order
# 3. Run seed data
# 4. Give you a fresh, consistent database
```

Or if you prefer to just add the new migration:

```bash
# Push the new migration only
supabase db push

# Verify it worked
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'audit_log';"

# Should return one row with 'audit_log'
```

## Production Migrations

**DO NOT** run these against production manually. Use Supabase Dashboard:

1. Go to your project in Supabase Dashboard
2. Navigate to Database → Migrations
3. Upload migration file or paste SQL
4. Review and apply

Or use `supabase link` to connect CLI to production:

```bash
# Link to production project
supabase link --project-ref <your-project-ref>

# Push migrations to production
supabase db push --linked
```

⚠️ **WARNING**: Always test migrations locally first!

## Quick Reference

| Task | Command |
|------|---------|
| Fresh start | `supabase db reset` |
| Apply new migration | `supabase db push` |
| Create migration | `supabase migration new <name>` |
| Check status | `supabase status` |
| View Studio | `open http://127.0.0.1:54323` |
| View logs | `supabase logs` |
| Connect to DB | `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

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
