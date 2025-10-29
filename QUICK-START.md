# 🚀 Quick Start

## Start Development

```bash
# 1. Start Supabase (if not running)
supabase start

# 2. Start dev server
npm run dev
```

**Open**: http://localhost:5173

## Useful URLs

- **App**: http://localhost:5173
- **Supabase Studio**: http://127.0.0.1:54323
- **Database**: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`

## Database Setup

```bash
# Start Supabase (applies all migrations automatically)
supabase start

# Seed test data
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -f supabase/seed-local-dev.sql

# Verify setup
supabase status
psql $DATABASE_URL -c "SELECT COUNT(*) FROM songs;"
```

## Reset Database

```bash
# Clean reset (removes all data and re-applies migrations)
supabase db reset

# Re-seed test data
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -f supabase/seed-local-dev.sql
```

## Common Commands

```bash
# Check Supabase status
supabase status

# Run tests
npm test

# Type check
npm run type-check

# Stop Supabase
supabase stop
```

## Need Help?

See detailed guide: `.claude/artifacts/DEV-STARTUP-GUIDE.md`
