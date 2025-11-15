# Vercel Environment Variable Root Cause Analysis

**Created**: 2025-11-08T07:37
**Issue**: Production deployment using MockAuthService despite environment variables being set in Vercel

## Problem Summary

The production deployment on Vercel was using `MockAuthService` instead of `SupabaseAuthService`, despite:
- ✅ Environment variables being set correctly in Vercel dashboard
- ✅ Environment variables being set for all environments (Production, Preview, Development)
- ✅ Multiple redeployments attempted

### Symptoms

**Production Console Logs (Vercel)**:
```
MODE: 'production', PROD: true  // ✓ Correct
🚀 Rock On running in local mode  // ✗ WRONG!
🔧 Using MockAuthService          // ✗ WRONG!
```

**Expected Console Logs**:
```
MODE: 'production', PROD: true
🚀 Rock On running in production mode
☁️ Using SupabaseAuthService
```

## Root Cause

**The issue is NOT with Vercel environment variables.**

The problem is that **Vite requires environment variables to be available at BUILD TIME**, but Vercel was NOT properly injecting them during the build process.

### How Vite Environment Variables Work

1. **Build-Time Replacement**: Vite performs **static replacement** of `import.meta.env.*` references during the build process
2. **Not Runtime Variables**: These are NOT accessed at runtime like Node.js `process.env`
3. **Embedded in Bundle**: The actual values get hard-coded into the JavaScript bundle

### Example

**Source Code**:
```typescript
const mode = import.meta.env.VITE_MOCK_AUTH
const url = import.meta.env.VITE_SUPABASE_URL
```

**After Vite Build** (with env vars):
```javascript
const mode = "false"
const url = "https://khzeuxxhigqcmrytsfux.supabase.co"
```

**After Vite Build** (WITHOUT env vars):
```javascript
const mode = undefined  // Falls back to MockAuth
const url = undefined   // Falls back to MockAuth
```

## Investigation Results

### Test 1: Local Build WITHOUT Environment Variables
```bash
$ npm run build
# Result: Build succeeds but env vars are undefined
```

**Verification**:
```bash
$ grep "khzeuxxhigqcmrytsfux" dist/assets/*.js
# Result: No matches found - Supabase URL not in bundle
```

### Test 2: Local Build WITH Environment Variables
```bash
$ source .env.production && npm run build
# Result: Build succeeds AND env vars are embedded
```

**Verification**:
```bash
$ grep "khzeuxxhigqcmrytsfux" dist/assets/*.js
# Result: 1 match found - Supabase URL IS in bundle!
```

### Test 3: Production Build Testing
```bash
$ npm run preview  # Serves the production build locally
$ # Open http://localhost:4173 in browser
```

**Result**: When env vars are embedded during build, the app correctly uses `SupabaseAuthService`!

## Why Vercel Builds Are Failing

Vercel environment variables are available during builds, but **Vite may not be reading them**.

Possible causes:
1. **Build Command Issue**: The build command in Vercel may not properly expose env vars to Vite
2. **Sensitive Variables**: If variables are marked as "Sensitive" in Vercel, they might be encrypted and not available to the build process
3. **Vercel Build Environment**: Vercel's build container might not automatically expose environment variables to Vite

## Solution

### Option 1: Explicit Environment File for Vercel (RECOMMENDED)

Create a `.env.production.local` file specifically for Vercel builds:

```bash
# .env.production.local
VITE_MOCK_AUTH=false
VITE_SUPABASE_URL=https://khzeuxxhigqcmrytsfux.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
VITE_GOOGLE_CLIENT_ID=<your-google-client-id>
```

**Important**: This file should be:
- ❌ NOT committed to git (add to `.gitignore`)
- ✅ Created in Vercel's build environment via their UI or CLI

### Option 2: Modify Build Command in Vercel

Change the build command in `vercel.json` or Vercel dashboard:

**From**:
```json
{
  "buildCommand": "npm run build"
}
```

**To**:
```json
{
  "buildCommand": "env | grep VITE_ && npm run build"
}
```

This logs all VITE_ variables before building, helping debug if they're available.

### Option 3: Use Vercel CLI with Environment Variables

For manual deployments:
```bash
vercel --prod \
  --env VITE_MOCK_AUTH=false \
  --env VITE_SUPABASE_URL=https://khzeuxxhigqcmrytsfux.supabase.co \
  --env VITE_SUPABASE_ANON_KEY=<key> \
  --env VITE_GOOGLE_CLIENT_ID=<id>
```

### Option 4: Create Custom Build Script

Create `scripts/build-with-env.sh`:
```bash
#!/bin/bash
set -e

echo "=== Build Environment Check ==="
echo "VITE_MOCK_AUTH: ${VITE_MOCK_AUTH:-NOT SET}"
echo "VITE_SUPABASE_URL: ${VITE_SUPABASE_URL:0:30}..." # First 30 chars only
echo "================================"

if [ -z "$VITE_SUPABASE_URL" ]; then
  echo "ERROR: VITE_SUPABASE_URL not set!"
  exit 1
fi

npm run build
```

Update `vercel.json`:
```json
{
  "buildCommand": "bash scripts/build-with-env.sh"
}
```

## Verification Steps

After implementing the fix:

1. **Check Vercel Build Logs**:
   - Look for environment variable values in build output
   - Verify Vite is seeing the variables

2. **Inspect Deployed Bundle**:
   ```bash
   curl https://your-app.vercel.app/_next/static/.../main-[hash].js | grep "khzeuxxhigqcmrytsfux"
   ```
   Should return matches if Supabase URL is embedded.

3. **Check Browser Console**:
   Should see:
   ```
   🚀 Rock On running in production mode
   ☁️ Using SupabaseAuthService
   ```

4. **Test Authentication**:
   - Google sign-in should work
   - No mock users should be visible
   - Manual email/password login should authenticate with Supabase

## Key Takeaways

1. **Vite env vars are build-time, not runtime**
2. **Vercel environment variables must be accessible to Vite during build**
3. **Local builds with `source .env.production` work correctly**
4. **The code itself is correct - this is purely a build configuration issue**

## Test Results

✅ **Authentication Code**: All changes work correctly when env vars are present
✅ **Unit Tests**: 287 passing (6 pre-existing failures in cloud sync tests)
✅ **Local Production Build**: Works correctly with `source .env.production && npm run build`
❌ **Vercel Deployment**: Fails because Vite doesn't receive environment variables during build

## Next Steps

1. Implement Option 1 (recommended): Create `.env.production.local` in Vercel
2. Verify environment variables are visible in Vercel build logs
3. Redeploy and test authentication flow
4. Document the proper deployment process for future reference
