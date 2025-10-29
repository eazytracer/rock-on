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

## Common Commands

```bash
# Check Supabase status
supabase status

# Seed database
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -f supabase/seed-local-dev.sql

# Run tests
npm test

# Type check
npm run type-check

# Stop Supabase
supabase stop
```

## Need Help?

See detailed guide: `.claude/artifacts/DEV-STARTUP-GUIDE.md`
