---
timestamp: 2025-10-25T21:34
prompt: Create deployment checklist for beta release after fixing RLS policies
status: Ready for Beta Deployment
---

# Beta Deployment Checklist

## Pre-Deployment: Fix RLS Policies

### Step 1: Sign in to Supabase
1. Go to https://supabase.com/dashboard
2. Sign in to your account
3. Select your project: `khzeuxxhigqcmrytsfux`

### Step 2: Navigate to SQL Editor
1. Click **SQL Editor** in the left sidebar
2. Click **New query**

### Step 3: Run the RLS Fix Script
1. Open the file: `/workspaces/rock-on/supabase/fix-rls-policies.sql`
2. Copy the ENTIRE contents
3. Paste into Supabase SQL Editor
4. Click **Run** (or press Cmd/Ctrl + Enter)
5. Wait for "Success. No rows returned" message

### Step 4: Verify Policies Created
Run this verification query in SQL Editor:
```sql
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('band_memberships', 'songs', 'bands', 'setlists', 'practices', 'users', 'user_profiles')
ORDER BY tablename, cmd, policyname;
```

Expected result: 28 policies total (4 per table)
- ✅ band_memberships: 4 policies
- ✅ songs: 4 policies
- ✅ bands: 4 policies
- ✅ setlists: 4 policies
- ✅ practices: 4 policies
- ✅ users: 4 policies
- ✅ user_profiles: 4 policies

### Step 5: Test Sync Locally
1. Go back to your app: http://localhost:5173/songs
2. Open browser console (F12)
3. Create a new test song
4. Run: `debugSync()`
5. Verify:
   - [ ] No "infinite recursion" errors
   - [ ] Queue shows item briefly then clears
   - [ ] No errors in console
6. Check Supabase dashboard → Table Editor → songs
   - [ ] New song appears in table

### Step 6: Clean Up Test Data
Before deploying, clean up any test data:
```sql
-- Delete test songs
DELETE FROM songs WHERE title LIKE '%Test%' OR title LIKE '%test%';

-- Verify only real data remains
SELECT COUNT(*) FROM songs;
SELECT COUNT(*) FROM bands;
SELECT COUNT(*) FROM users;
```

## Deployment to Vercel

### Prerequisites Checklist
- [ ] RLS policies fixed and verified
- [ ] Local sync tested and working
- [ ] Test data cleaned up
- [ ] Google OAuth configured in Supabase
- [ ] Environment variables ready

### Step 1: Verify Environment Variables
Check that you have these values ready:
```
VITE_MOCK_AUTH=false
VITE_SUPABASE_URL=https://khzeuxxhigqcmrytsfux.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_GOOGLE_CLIENT_ID=570420132977-e1l397on38jvo0e7aqnjqgrbs7p0u35v.apps.googleusercontent.com
```

### Step 2: Configure Google OAuth in Supabase
1. Go to Supabase Dashboard → Authentication → Providers
2. Enable Google provider
3. Add Client ID: `570420132977-e1l397on38jvo0e7aqnjqgrbs7p0u35v.apps.googleusercontent.com`
4. Add Client Secret (from your Google Cloud Console)
5. Add authorized redirect URIs:
   - `https://khzeuxxhigqcmrytsfux.supabase.co/auth/v1/callback`
   - `https://your-app.vercel.app/auth/callback` (after Vercel deployment)
6. Save

### Step 3: Update Google OAuth Redirect URIs
1. Go to Google Cloud Console
2. Navigate to APIs & Services → Credentials
3. Click your OAuth 2.0 Client ID
4. Add Authorized redirect URIs:
   - `https://khzeuxxhigqcmrytsfux.supabase.co/auth/v1/callback`
   - `https://your-app.vercel.app/auth/callback` (add after deployment)
5. Save

### Step 4: Prepare for Vercel Deployment
1. Commit current changes:
```bash
git add .
git commit -m "Fix RLS policies and prepare for beta deployment"
git push origin user-mgmt
```

2. Merge to main (if ready):
```bash
git checkout main
git merge user-mgmt
git push origin main
```

### Step 5: Deploy to Vercel
1. Go to https://vercel.com
2. Sign in with GitHub
3. Import your repository
4. Configure project:
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Add Environment Variables:
   ```
   VITE_MOCK_AUTH=false
   VITE_SUPABASE_URL=https://khzeuxxhigqcmrytsfux.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   VITE_GOOGLE_CLIENT_ID=570420132977-e1l397on38jvo0e7aqnjqgrbs7p0u35v.apps.googleusercontent.com
   ```
6. Click **Deploy**

### Step 6: Update OAuth Redirect URIs (After Deployment)
1. Copy your Vercel URL (e.g., `https://rock-on.vercel.app`)
2. Update Google Cloud Console:
   - Add: `https://rock-on.vercel.app/auth/callback`
3. Update Supabase:
   - Authentication → URL Configuration
   - Add Site URL: `https://rock-on.vercel.app`
   - Add Redirect URLs: `https://rock-on.vercel.app/auth/callback`

### Step 7: Test Production Deployment
1. Visit your Vercel URL
2. Test sign up with email/password
3. Test sign in with Google
4. Create test data:
   - [ ] Create a band
   - [ ] Add band members
   - [ ] Create songs
   - [ ] Create setlists
   - [ ] Create practice sessions
5. Open browser console and run `debugSync()`
6. Verify data appears in Supabase

### Step 8: Monitor Sync Status
1. Watch the sync indicator in bottom-right corner:
   - Green checkmark = synced
   - Blue spinning = syncing
   - Yellow warning = pending
   - Red X = errors
2. Check browser console for any errors
3. Verify data in Supabase dashboard

## Post-Deployment Verification

### Functionality Checklist
- [ ] User signup with email/password works
- [ ] User signin with Google OAuth works
- [ ] User can create a band
- [ ] User can invite band members
- [ ] User can add songs to band
- [ ] User can create setlists
- [ ] User can schedule practice sessions
- [ ] All data syncs to Supabase within 30 seconds
- [ ] Offline mode works (data queued when offline)
- [ ] Data syncs when coming back online
- [ ] No console errors
- [ ] Sync status indicator shows correct state

### Performance Checklist
- [ ] Page loads in < 3 seconds
- [ ] Song list renders quickly (< 500ms)
- [ ] Sync doesn't block UI
- [ ] No jank or freezing
- [ ] Mobile responsive works

### Security Checklist
- [ ] RLS policies prevent unauthorized access
- [ ] Users can only see their own bands
- [ ] Users can only modify their own data
- [ ] API keys not exposed in client code
- [ ] HTTPS enabled on all requests

## Troubleshooting

### If sync still fails:
1. Check browser console for specific error
2. Run `debugSync()` to see queue status
3. Check Supabase logs:
   - Dashboard → Logs → Postgres Logs
4. Look for RLS policy violations
5. Verify user is authenticated: `testSupabaseConnection()`

### If OAuth fails:
1. Verify redirect URIs match exactly
2. Check Google Cloud Console credentials
3. Verify Supabase has correct Client ID/Secret
4. Check Site URL in Supabase matches Vercel URL

### If data doesn't appear:
1. Check RLS policies are active
2. Verify user_id matches auth.uid()
3. Check that band_id is set correctly
4. Run query in Supabase SQL Editor to debug

## Beta Testing Plan

### Invite Beta Testers
1. Share Vercel URL with trusted users
2. Provide test credentials OR ask them to sign up
3. Ask them to test key workflows:
   - Create a band
   - Add songs
   - Create a setlist
   - Schedule a practice
4. Collect feedback on:
   - Usability
   - Performance
   - Bugs/errors
   - Feature requests

### Monitor During Beta
1. Check Supabase usage daily
2. Monitor error logs
3. Watch sync queue for failures
4. Collect user feedback
5. Fix critical bugs quickly

## Next Steps After Beta

### Phase 2 Features to Implement
1. Casting feature (deferred from Phase 1)
2. Song confidence ratings
3. Advanced filtering/sorting
4. Setlist sharing
5. Practice notes and recordings
6. Band chat/messaging
7. Calendar integration

### Infrastructure Improvements
1. Add error reporting (Sentry)
2. Add analytics (PostHog, Amplitude)
3. Set up monitoring (Vercel Analytics)
4. Add automated tests for critical flows
5. Set up CI/CD pipeline

### Documentation
1. Create user guide
2. Document API
3. Create troubleshooting guide
4. Write deployment runbook

## Success Criteria

Your beta is successful when:
- [ ] 5+ beta testers actively using the app
- [ ] No critical bugs reported
- [ ] Sync works reliably (>95% success rate)
- [ ] Performance is acceptable (< 3s load time)
- [ ] Positive feedback from testers
- [ ] Ready to onboard more users

## Congratulations!

Once you complete this checklist, you'll have:
- ✅ Fixed RLS policies (no more infinite recursion)
- ✅ Working sync system (local-first with Supabase)
- ✅ Production deployment on Vercel
- ✅ Google OAuth authentication
- ✅ Beta version ready for testing

**You're ready to rock! 🎸**

---

## Quick Reference Commands

### Local Testing
```bash
# Start dev server
npm run dev

# Run tests
npm test

# Type check
npm run type-check

# Lint
npm run lint
```

### Browser Console Commands
```javascript
// Check sync status
debugSync()

// Test Supabase connection
testSupabaseConnection()

// Reset database (dev only)
resetDB()
```

### Supabase Queries
```sql
-- View all policies
SELECT * FROM pg_policies WHERE tablename = 'band_memberships';

-- Check data counts
SELECT
  (SELECT COUNT(*) FROM songs) as songs,
  (SELECT COUNT(*) FROM bands) as bands,
  (SELECT COUNT(*) FROM users) as users;

-- View recent sync activity
SELECT * FROM songs ORDER BY created_date DESC LIMIT 10;
```
