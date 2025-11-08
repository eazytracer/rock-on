---
title: Rock-On Production Deployment Guide
created: 2025-11-03T19:02
summary: Comprehensive guide for deploying Rock-On to Vercel with Supabase production environment, including all environment variables, secrets, database migrations, and verification steps
status: Ready for Review
---

# 🚀 Rock-On Production Deployment Guide

**Status:** Ready for MVP Deployment
**Target Platform:** Vercel (Frontend) + Supabase (Backend)
**Estimated Deployment Time:** 2-3 hours

---

## 📋 Pre-Deployment Checklist

### ✅ Code Readiness
- [ ] All tests passing (`npm test`)
- [ ] TypeScript compilation successful (`npm run type-check`)
- [ ] Linting passes (`npm run lint`)
- [ ] Build succeeds locally (`npm run build`)
- [ ] Manual validation complete (see `.claude/artifacts/2025-11-03T16:25_user-test-validation-plan.md`)
- [ ] Journey tests validated (`npm test -- tests/journeys/`)
- [ ] Developer Dashboard tested (`/dev/dashboard` - should be inaccessible in production)

### ✅ Database Readiness
- [ ] All migrations tested locally
- [ ] Seed data working (optional for production)
- [ ] Audit log system validated
- [ ] Real-time subscriptions tested

### ✅ Documentation
- [ ] Environment variables documented (this guide)
- [ ] Deployment steps clear
- [ ] Rollback plan prepared
- [ ] Monitoring strategy defined

---

## 🗄️ Production Database Setup (Supabase)

### Step 1: Verify Supabase Project

**Production URL:** `https://khzeuxxhigqcmrytsfux.supabase.co`

1. **Log into Supabase Dashboard:**
   - Visit: https://app.supabase.com
   - Select project: `rock-on` (khzeuxxhigqcmrytsfux)

2. **Verify Project Settings:**
   - Go to Settings → General
   - Note the following values (you'll need them):
     - Project URL: `https://khzeuxxhigqcmrytsfux.supabase.co`
     - API URL: `https://khzeuxxhigqcmrytsfux.supabase.co/rest/v1`
     - Realtime URL: `wss://khzeuxxhigqcmrytsfux.supabase.co/realtime/v1`

3. **Get API Keys:**
   - Go to Settings → API
   - Copy the following keys:
     - `anon` key (public) - This is safe for client-side use
     - `service_role` key (secret) - Keep this private! (Not needed for client app)

---

### Step 2: Apply Database Migrations

**CRITICAL:** Migrations must be applied in order. Your production database needs:

1. **Baseline Schema** (if not already applied)
2. **Version Tracking** (`20251029000001_add_version_tracking.sql`)
3. **Real-time Support** (`20251030000001_enable_realtime.sql`)
4. **Replica Identity** (`20251030000002_enable_realtime_replica_identity.sql`)
5. **Audit System** (`20251031000001_add_audit_tracking.sql`)
6. **Audit Realtime** (`20251101000001_enable_audit_log_realtime.sql`)

#### Option A: Use Supabase CLI (Recommended)

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Link to production project (one-time setup)
supabase link --project-ref khzeuxxhigqcmrytsfux

# Apply all pending migrations
supabase db push

# Verify migrations applied
supabase db remote --help  # Shows connection info
```

#### Option B: Manual SQL Execution via Dashboard

If CLI doesn't work, manually run each migration file in order:

1. Go to Supabase Dashboard → SQL Editor
2. Create new query for each migration file
3. Copy content from `supabase/migrations/` files
4. Execute in order:
   - `20251029000001_add_version_tracking.sql`
   - `20251030000001_enable_realtime.sql`
   - `20251030000002_enable_realtime_replica_identity.sql`
   - `20251031000001_add_audit_tracking.sql`
   - `20251101000001_enable_audit_log_realtime.sql`

#### Verification

After applying migrations, verify:

```sql
-- Check tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Expected tables:
-- - audit_log
-- - band_memberships
-- - bands
-- - practice_sessions
-- - setlists
-- - shows
-- - songs
-- - users

-- Check triggers exist
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- Should see triggers like:
-- - update_last_modified_by_*
-- - set_created_by_*
-- - log_*_changes

-- Check realtime enabled
SELECT schemaname, tablename,
       CASE
         WHEN replication_policy = 'f' THEN 'DISABLED'
         WHEN replication_policy = 't' THEN 'ENABLED'
       END as realtime_status
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';

-- All tables should show ENABLED
```

---

### Step 3: Configure Row-Level Security (RLS)

**CRITICAL for Security:** Ensure RLS is enabled on all tables.

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE band_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE setlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Verify RLS policies exist
SELECT schemaname, tablename, policyname, permissive, roles, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

**Expected Policies:**
- Users can read/write their own data
- Band members can read/write band data
- Audit log is read-only for band members

If policies don't exist, they should be in your baseline migration. If missing, create them based on your local migrations.

---

### Step 4: Enable Realtime

Verify realtime is configured:

1. Go to Database → Replication
2. Enable replication for these tables:
   - ✅ `songs`
   - ✅ `setlists`
   - ✅ `shows`
   - ✅ `practice_sessions`
   - ✅ `audit_log` (CRITICAL for real-time sync!)

3. For each table, set:
   - **Realtime:** Enabled
   - **Replica Identity:** FULL (required for update/delete events)

---

## 🔐 Environment Variables

### Production Environment Variables for Vercel

**Location:** Vercel Dashboard → Project Settings → Environment Variables

Add the following environment variables:

#### Required Variables

| Variable Name | Value | Notes |
|--------------|-------|-------|
| `VITE_SUPABASE_URL` | `https://khzeuxxhigqcmrytsfux.supabase.co` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `[YOUR_ANON_KEY]` | Get from Supabase Dashboard → Settings → API |
| `VITE_GOOGLE_CLIENT_ID` | `[YOUR_GOOGLE_OAUTH_CLIENT_ID]` | If using Google OAuth (optional) |
| `VITE_MOCK_AUTH` | `false` | Ensure real auth is used in production |

#### Getting the Anon Key

1. Go to Supabase Dashboard
2. Navigate to Settings → API
3. Copy the `anon` `public` key (not the `service_role` key!)
4. This key is safe to expose in client-side code

#### Setting Variables in Vercel

```bash
# Using Vercel CLI (alternative to dashboard)
vercel env add VITE_SUPABASE_URL
# Paste: https://khzeuxxhigqcmrytsfux.supabase.co

vercel env add VITE_SUPABASE_ANON_KEY
# Paste: your anon key

vercel env add VITE_MOCK_AUTH
# Type: false

vercel env add VITE_GOOGLE_CLIENT_ID
# Paste: your Google OAuth client ID (if applicable)
```

**Environment Scope:**
- Set for: Production, Preview, Development
- This ensures consistent behavior across all Vercel environments

---

## 📦 Vercel Deployment Configuration

### Step 1: Connect Repository to Vercel

1. **Go to Vercel Dashboard:**
   - Visit: https://vercel.com
   - Click "Add New Project"

2. **Import Git Repository:**
   - Select your GitHub repository: `rock-on`
   - Choose the branch: `main`

3. **Configure Build Settings:**
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

4. **Root Directory:**
   - Leave as default (repository root)

### Step 2: Verify vercel.json Configuration

Your `vercel.json` should already be configured correctly:

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "functions": {},
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/sw.js",
      "headers": [
        {
          "key": "Service-Worker-Allowed",
          "value": "/"
        }
      ]
    }
  ]
}
```

**Key Features:**
- **SPA Routing:** All routes redirect to `/index.html` (React Router handles navigation)
- **Service Worker Support:** Allows service worker registration (for PWA features)

### Step 3: Deploy

#### Option A: Automatic Deployment (Recommended)

Once connected, Vercel will automatically deploy on:
- Every push to `main` branch → Production deployment
- Every pull request → Preview deployment

#### Option B: Manual Deployment via CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod

# Or deploy for preview
vercel
```

### Step 4: Monitor Build

1. Watch the build logs in Vercel Dashboard
2. Verify build completes successfully
3. Check for any environment variable errors

**Common Build Issues:**
- Missing environment variables → Add them in Vercel settings
- TypeScript errors → Run `npm run type-check` locally first
- Build timeout → Contact Vercel support (unlikely)

---

## ✅ Post-Deployment Verification

### Step 1: Verify Deployment

1. **Visit Production URL:**
   - Vercel will provide a URL like: `https://rock-on.vercel.app`
   - Or your custom domain if configured

2. **Check Console:**
   - Open browser DevTools → Console
   - Should see: `✅ Supabase schema verified`
   - Should NOT see: `💡 Call seedMvpData()`
   - No errors related to environment variables

### Step 2: Test Authentication

1. **Sign Up / Log In:**
   - Try creating a new account
   - Or log in with existing credentials
   - Verify email confirmation works (if enabled)

2. **Session Persistence:**
   - Log in
   - Refresh page
   - Should remain logged in

3. **Multi-Tab:**
   - Open app in 2 browser tabs
   - Log out from one tab
   - Other tab should detect logout

### Step 3: Test Core Features

**Song Management:**
- [ ] Create a song
- [ ] Edit a song
- [ ] Delete a song
- [ ] Verify sync indicator shows success

**Setlist Builder:**
- [ ] Create a setlist
- [ ] Add songs to setlist
- [ ] Reorder songs
- [ ] Add breaks/sections

**Shows:**
- [ ] Create a show
- [ ] Assign a setlist
- [ ] Mark as completed

**Practice Sessions:**
- [ ] Start a practice
- [ ] Mark songs as practiced
- [ ] Complete session

### Step 4: Test Real-Time Sync

**Two-Device Test:**
1. Open production app on Device A (e.g., laptop)
2. Open production app on Device B (e.g., phone)
3. Log in with same account on both devices
4. On Device A: Create a song
5. On Device B: Should appear within 1 second with toast notification

**Expected Behavior:**
- ✅ Changes appear on other device < 1 second
- ✅ Toast notification shows: "Bob added 'Song Name'"
- ✅ Sync indicator shows connected (green)
- ✅ No toast for your own changes (user filtering)

### Step 5: Test Offline Behavior

1. **Go Offline:**
   - DevTools → Network tab → Throttle to "Offline"
   - Or turn off WiFi

2. **Create/Edit Data:**
   - Should work immediately (IndexedDB)
   - Sync indicator shows "offline" or "pending"

3. **Go Back Online:**
   - Turn network back on
   - Changes should sync to Supabase automatically
   - Other devices should receive updates

### Step 6: Verify Developer Dashboard is Disabled

1. Try accessing: `https://your-app.vercel.app/dev/dashboard`
2. Should show 404 or redirect
3. Environment guard should prevent access in production

---

## 🔍 Monitoring & Debugging

### Vercel Logs

**View Real-Time Logs:**
```bash
# Using Vercel CLI
vercel logs --follow
```

**Or via Dashboard:**
- Vercel Dashboard → Project → Deployments → Select deployment → Logs

### Supabase Logs

**Database Logs:**
- Supabase Dashboard → Logs → Database
- Filter by error level
- Check for failed queries, trigger errors

**Realtime Logs:**
- Supabase Dashboard → Logs → Realtime
- Check WebSocket connections
- Verify subscriptions

**API Logs:**
- Supabase Dashboard → Logs → API
- Check for failed requests
- Verify RLS policies working

### Browser Console

**Production Debugging:**
```javascript
// Check Supabase connection
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL)

// Check realtime status (in DevTools console)
// Note: Don't expose internal state in production
// Use proper monitoring tools instead
```

### Error Tracking (Recommended)

**Add Sentry for Production:**
```bash
npm install @sentry/react

# Configure in src/main.tsx
import * as Sentry from '@sentry/react'

Sentry.init({
  dsn: 'YOUR_SENTRY_DSN',
  environment: 'production',
  enabled: import.meta.env.PROD
})
```

---

## 🚨 Rollback Plan

### If Deployment Fails

**Option 1: Revert via Vercel Dashboard**
1. Go to Deployments tab
2. Find last working deployment
3. Click "..." → "Promote to Production"

**Option 2: Revert Git Commit**
```bash
git revert HEAD
git push origin main
# Vercel will auto-deploy the reverted commit
```

### If Database Migration Fails

**Rollback Migration:**
```bash
# Using Supabase CLI
supabase db reset --local  # Test locally first
supabase db push           # Re-apply working migrations
```

**Manual Rollback:**
- Restore from Supabase backup (Settings → Backups)
- Or manually drop tables/triggers and re-apply working migrations

### If Real-Time Sync Breaks

**Emergency Fix:**
- Realtime failures won't break core functionality
- App still works with periodic background sync
- Users can still create/edit data (stored in IndexedDB)
- Fix realtime configuration and redeploy

---

## 📊 Performance Optimization (Post-Deployment)

### CDN & Caching

Vercel automatically provides:
- ✅ Global CDN for static assets
- ✅ Automatic image optimization
- ✅ Edge caching

### Database Indexes

Verify indexes exist (should be in migrations):

```sql
-- Check indexes
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

**Critical Indexes:**
- `songs.context_id` (for band filtering)
- `setlists.band_id` (for band filtering)
- `audit_log.band_id` (for realtime filtering)
- `audit_log.changed_at` (for audit queries)

### Supabase Connection Pooling

Enable if experiencing connection issues:
- Supabase Dashboard → Database Settings → Connection Pooling
- Enable "Session" mode for web apps

---

## 🔒 Security Checklist

### Pre-Deployment Security

- [ ] **RLS Enabled:** All tables have Row-Level Security
- [ ] **API Keys:** Only `anon` key in client, never `service_role`
- [ ] **Environment Variables:** No secrets in code
- [ ] **CORS:** Supabase project allows your domain
- [ ] **Authentication:** Email verification enabled (optional)
- [ ] **Password Policy:** Strong passwords required
- [ ] **Rate Limiting:** Consider adding rate limits for auth endpoints

### Supabase Security Settings

1. **Authentication Settings:**
   - Go to Authentication → Settings
   - Enable email confirmation (recommended)
   - Set password requirements
   - Configure redirect URLs for production domain

2. **API Settings:**
   - Go to Settings → API
   - Verify allowed domains (for CORS)
   - Consider adding rate limits

3. **Backup Strategy:**
   - Supabase provides automatic daily backups
   - Consider more frequent backups for production
   - Test restore process

---

## 📝 Post-Deployment Tasks

### Immediate (Day 1)

- [ ] Monitor error logs for 24 hours
- [ ] Test all critical user journeys in production
- [ ] Verify real-time sync working across devices
- [ ] Check performance metrics (load time, sync latency)
- [ ] Set up uptime monitoring (e.g., UptimeRobot)

### Short-term (Week 1)

- [ ] Monitor user feedback
- [ ] Track any authentication issues
- [ ] Verify data consistency (IndexedDB vs Supabase)
- [ ] Check for memory leaks (browser DevTools → Memory)
- [ ] Review Supabase database size and query performance

### Ongoing

- [ ] Regular database backups (automated via Supabase)
- [ ] Monitor Supabase usage (stay within free tier or upgrade)
- [ ] Review Vercel bandwidth usage
- [ ] Check for dependency updates (`npm outdated`)
- [ ] Security audits (`npm audit`)

---

## 🆘 Troubleshooting

### "Supabase client not configured" Error

**Symptom:** Console shows Supabase connection errors

**Fix:**
1. Verify environment variables in Vercel
2. Check variable names match exactly (case-sensitive)
3. Redeploy after adding variables

### Real-Time Sync Not Working

**Symptom:** Changes don't appear on other devices

**Checklist:**
- [ ] Realtime enabled on all tables (Supabase Dashboard)
- [ ] `audit_log` table has realtime enabled
- [ ] REPLICA IDENTITY set to FULL
- [ ] WebSocket connection established (check browser DevTools → Network → WS)
- [ ] No firewall blocking WebSocket connections

**Debug:**
```javascript
// In browser console (temporary debug code)
// Note: Remove after debugging
import { getSupabaseClient } from './services/supabase/client'
const supabase = getSupabaseClient()
supabase.channel('test').subscribe((status) => {
  console.log('Realtime status:', status)
})
```

### Session Timeout Issues

**Symptom:** Users logged out unexpectedly

**Fix:**
1. Check Supabase auth settings (session duration)
2. Implement refresh token logic (should be automatic with Supabase JS)
3. Add session timeout detection (see journey tests)

### Data Not Syncing from IndexedDB to Supabase

**Symptom:** Local changes don't reach Supabase

**Debug:**
1. Check sync queue: Developer Dashboard → Sync Queue Viewer (dev only)
2. Check network errors in browser DevTools
3. Verify RLS policies allow user to write data
4. Check `SyncEngine` error logs

---

## 📋 Deployment Checklist Summary

### Pre-Deployment
- [ ] Tests passing
- [ ] Build succeeds
- [ ] Migrations tested locally
- [ ] Environment variables documented

### Supabase Setup
- [ ] Migrations applied
- [ ] RLS enabled
- [ ] Realtime configured
- [ ] Indexes verified

### Vercel Deployment
- [ ] Repository connected
- [ ] Environment variables set
- [ ] Build configuration correct
- [ ] Deployment successful

### Verification
- [ ] App loads
- [ ] Authentication works
- [ ] CRUD operations work
- [ ] Real-time sync works
- [ ] Offline mode works

### Monitoring
- [ ] Logs configured
- [ ] Error tracking enabled (Sentry)
- [ ] Uptime monitoring active
- [ ] Performance baselines established

---

## 🎯 Success Criteria

Your deployment is successful when:

✅ **Functionality:**
- Users can sign up/log in
- All CRUD operations work
- Real-time sync < 1 second
- Offline mode stores data locally
- Data syncs when back online

✅ **Performance:**
- Initial load < 3 seconds
- Sync operations < 50ms (local)
- Real-time updates < 1 second
- No memory leaks after 1 hour of use

✅ **Reliability:**
- No console errors
- RLS policies protecting data
- Session persistence working
- Multi-tab logout working

✅ **Security:**
- HTTPS enabled (automatic with Vercel)
- RLS enabled on all tables
- No secrets in client code
- CORS properly configured

---

## 🎉 You're Ready to Deploy!

**Next Steps:**
1. Complete pre-deployment checklist
2. Apply database migrations to production Supabase
3. Set environment variables in Vercel
4. Deploy to Vercel
5. Run post-deployment verification
6. Monitor for 24 hours

**Support:**
- Vercel Docs: https://vercel.com/docs
- Supabase Docs: https://supabase.com/docs
- Project Roadmap: `.claude/artifacts/2025-10-29T16:15_unified-implementation-roadmap.md`

**Rollback Plan Ready:** See "Rollback Plan" section above if anything goes wrong.

---

**Document Version:** 1.0
**Last Updated:** 2025-11-03T19:02
**Status:** Ready for Production Deployment
