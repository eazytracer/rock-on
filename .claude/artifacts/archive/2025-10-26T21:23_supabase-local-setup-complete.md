# Supabase Local Development Setup - Complete

**Timestamp:** 2025-10-26T21:23
**Context:** Successfully set up local Supabase instance with docker-in-docker for local development and testing

## Status: ✅ COMPLETE

Local Supabase is now running successfully with all migrations applied!

## What Was Done

### 1. Docker-in-Docker Configuration
- Devcontainer was rebuilt with docker-in-docker support
- This resolves the network isolation issues that prevented Supabase from working with docker-outside-of-docker

### 2. Supabase CLI Installation
- Installed Supabase CLI v2.53.6 via direct binary download
- CLI is now available at `/usr/local/bin/supabase`

### 3. Migration Cleanup
- Identified and resolved duplicate RLS policy migrations that were causing conflicts
- Moved old migrations to `.backup/`:
  - `20251025000100_rls_policies.sql` (original)
  - `20251026000000_fix_rls_policies.sql` (partial fix)
  - `20251026000000_rls_policies_corrected.sql` (duplicate)
- Kept `20251026160000_rebuild_rls_policies.sql` which properly drops and recreates all policies

### 4. Supabase Started Successfully
All migrations applied without errors:
- ✅ Initial schema created
- ✅ RLS policies rebuilt
- ✅ Setlist items added
- ✅ Show fields added
- ✅ Setlist forking support added

### 5. App Configuration
Updated `.env.local` to use local Supabase:
```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
VITE_MOCK_AUTH=false
```

## Local Supabase Connection Details

```
API URL:       http://127.0.0.1:54321
GraphQL URL:   http://127.0.0.1:54321/graphql/v1
Studio URL:    http://127.0.0.1:54323
Database URL:  postgresql://postgres:postgres@127.0.0.1:54322/postgres
Mailpit URL:   http://127.0.0.1:54324

Publishable key: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
Secret key:      sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz
```

## How to Use

### Start Development Server
```bash
npm run dev
```

The app will now use the local Supabase instance instead of the cloud version.

### Access Supabase Studio
Open your browser to: **http://localhost:54323**

This gives you a visual interface to:
- Browse tables and data
- Run SQL queries
- View RLS policies
- Monitor real-time updates
- Test authentication

### Common Commands

```bash
# Check status
supabase status

# View logs
supabase logs

# Stop Supabase (keeps data)
supabase stop

# Start Supabase again
supabase start

# Reset database (wipes data, re-runs migrations)
supabase db reset

# Generate TypeScript types from schema
supabase gen types typescript --local > src/types/database.types.ts
```

## Benefits Now Available

✅ **Instant schema validation** - See exact Supabase schema locally
✅ **No cloud costs** during development
✅ **Faster development** - No network latency
✅ **Test migrations locally** before pushing to production
✅ **Direct PostgreSQL access** for debugging
✅ **Supabase Studio** - Visual database management
✅ **Email testing** - Mailpit catches all emails at http://localhost:54324

## Next Steps for Development

1. **Verify Schema in Studio**
   - Open http://localhost:54323
   - Go to Database > Tables
   - Verify all tables are created with correct columns
   - Check RLS policies are applied

2. **Test Sync Operations**
   - Create a song in the app
   - Check Supabase Studio to see it appear in real-time
   - Verify RLS policies are working (can only see your own data)

3. **Seed Test Data** (Optional)
   - Add seed data to `supabase/seeds/seed.sql`
   - Run `supabase db reset` to apply

4. **Test Authentication**
   - Try signing up with email
   - Check Mailpit (http://localhost:54324) for confirmation emails
   - Test OAuth flows

## Switching Between Local and Production

### To use Local Supabase (current):
```bash
# .env.local is already configured
npm run dev
```

### To use Production Supabase:
```bash
# Update .env.local with production credentials
VITE_SUPABASE_URL=https://khzeuxxhigqcmrytsfux.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_GOOGLE_CLIENT_ID=570420132977-e1l397on38jvo0e7aqnjqgrbs7p0u35v.apps.googleusercontent.com
```

### To use Mock Auth (no Supabase):
```bash
# Use .env.local.dev
cp .env.local.dev .env.local
```

## Troubleshooting

### If Supabase won't start:
```bash
# Check Docker is running
docker ps

# Clean up and restart
supabase stop
docker system prune -f
supabase start
```

### If migrations fail:
```bash
# Reset database and reapply migrations
supabase db reset
```

### If port conflicts:
```bash
# Check what's using the ports
netstat -tulpn | grep -E '54321|54322|54323|54324'

# Kill conflicting processes or change ports in supabase/config.toml
```

## Important Notes

- **Local data is isolated** - Changes in local Supabase don't affect production
- **Migrations are applied on start** - Any new migration files will be applied automatically
- **Stop Supabase when not in use** - Saves Docker resources
- **RLS policies are enforced** - You'll need to authenticate to see data

---

**Status:** Local Supabase is ready for development! 🚀
