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

- Location: `supabase/migrations/`
- Format: `YYYYMMDDHHMMSS_description.sql`
- Applied in timestamp order
- The baseline (`20251106000000_baseline_schema.sql`) is frozen; changes go in
  one incremental, idempotent migration per release/feature, amended in place
  while in development (see CLAUDE.md "Database & Migrations")

**Seed File:**

- Location: `supabase/seed-mvp-data.sql`
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
source .env.supabase.local && supabase migration list
```

The migrations themselves are in `supabase/migrations/`; always run
`supabase migration list --linked` before (and after) a remote push.

## Remote Supabase (Production/Staging)

### Setup Remote Connection

**Prerequisites:**

1. Valid Supabase access token in `.env.supabase.local` (gitignored)
2. Project reference ID (e.g., `khzeuxxhigqcmrytsfux`)

**Create token file:**

```bash
# Get token from: https://supabase.com/dashboard/account/tokens
# The file holds exactly one line; rewrite the whole file when rotating.
# Never echo/cat the file or the token (see CLAUDE.md "Secret handling").
printf 'export SUPABASE_ACCESS_TOKEN=%s\n' "<paste-token>" > .env.supabase.local
```

**Authentication:**

```bash
# Load token from .env.supabase.local
source .env.supabase.local
export SUPABASE_ACCESS_TOKEN

# Link to remote project
supabase link --project-ref khzeuxxhigqcmrytsfux
```

### Remote Operations

```bash
# Check migration status (local vs remote)
export SUPABASE_ACCESS_TOKEN=$(grep SUPABASE_ACCESS_TOKEN .env.supabase.local | cut -d '=' -f2) && supabase migration list

# Push migrations to remote
export SUPABASE_ACCESS_TOKEN=$(grep SUPABASE_ACCESS_TOKEN .env.supabase.local | cut -d '=' -f2) && supabase db push --linked

# Mark a manually-applied migration as applied
export SUPABASE_ACCESS_TOKEN=$(grep SUPABASE_ACCESS_TOKEN .env.supabase.local | cut -d '=' -f2) && supabase migration repair --status applied <migration_id>

# Pull remote schema to compare with local
export SUPABASE_ACCESS_TOKEN=$(grep SUPABASE_ACCESS_TOKEN .env.supabase.local | cut -d '=' -f2) && supabase db pull --schema public
```

### Manual SQL Execution via Dashboard

For complex migrations or RLS policy fixes:

1. Go to: https://supabase.com/dashboard/project/khzeuxxhigqcmrytsfux
2. Navigate to **SQL Editor** (left sidebar)
3. Click **"+ New query"**
4. Paste the migration's SQL from `supabase/migrations/`
5. Click **"Run"** (Ctrl+Enter)
6. Mark migration as applied: `supabase migration repair --status applied <id>`

⚠️ **WARNING**: Always test migrations locally first!

## Quick Reference

| Task                         | Command                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------- |
| Fresh start                  | `supabase db reset`                                                              |
| Apply new migration (local)  | `supabase db push`                                                               |
| Apply new migration (remote) | `source .env.supabase.local && supabase db push --linked`                        |
| Create migration             | `supabase migration new <name>`                                                  |
| Check status                 | `supabase status`                                                                |
| View Studio (local)          | `open http://127.0.0.1:54323`                                                    |
| View Studio (remote)         | `open https://supabase.com/dashboard/project/khzeuxxhigqcmrytsfux`               |
| View logs                    | `supabase logs`                                                                  |
| Connect to DB (local)        | `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres`                   |
| Link to remote               | `source .env.supabase.local && supabase link --project-ref khzeuxxhigqcmrytsfux` |
| Check remote migrations      | `source .env.supabase.local && supabase migration list`                          |

## Pro Tips

1. **Always test locally first** - Use `supabase db reset` to test migrations from scratch
2. **Name migrations clearly** - Use descriptive names: `add_user_roles.sql` not `update.sql`
3. **One migration per release/feature** - Amend it in place until it ships; deployed migrations are frozen
4. **Idempotent, with GRANTs** - `IF NOT EXISTS`, `DROP POLICY IF EXISTS`, explicit `GRANT`s on new tables (`npm run lint:migrations`)
5. **Test with pgTAP** - `supabase db reset && npm run test:db` (`just test-db` on the host)
