# Security Incident: .env Files Exposed in Git History

**Date:** 2025-11-22
**Severity:** CRITICAL
**Status:** REMEDIATED (git history cleaned)

## Summary

Multiple `.env` files containing sensitive credentials were committed to the public GitHub repository and present in git history. The files have been successfully removed from git history and the remote repository has been force-pushed with cleaned history.

## Files Removed from Git History

The following files were removed from all commits:
- `.env.development`
- `.env.local.dev`
- `.env.local.production`
- `.env.production`
- `.env.staging`
- `.env.test`
- `.env.vercel`

## Potentially Exposed Credentials

Based on the environment file templates, the following credentials **may have been exposed**:

### 🔴 CRITICAL - Rotate Immediately

1. **Supabase Credentials**
   - `VITE_SUPABASE_URL` - Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
   - **Action Required:**
     - Go to: https://supabase.com/dashboard/project/khzeuxxhigqcmrytsfux/settings/api
     - Generate new anon key
     - Update Vercel environment variables
     - Update local `.env.local` file

2. **Google OAuth Client ID**
   - `VITE_GOOGLE_CLIENT_ID` - Google OAuth client ID
   - **Action Required:**
     - Go to: https://console.cloud.google.com/apis/credentials
     - Delete exposed client ID
     - Create new OAuth 2.0 client ID
     - Update Vercel environment variables
     - Update local `.env.local` file

### 🟡 MEDIUM - Review and Consider Rotating

3. **Vercel Environment Variables**
   - Check Vercel dashboard for any other sensitive environment variables
   - **Action Required:**
     - Go to: https://vercel.com/[your-account]/rock-on/settings/environment-variables
     - Review all environment variables
     - Rotate any that were in the exposed `.env` files

## Remediation Steps Completed

✅ **Step 1:** Updated `.gitignore` to properly exclude all `.env` files except `.example` templates
✅ **Step 2:** Installed `git-filter-repo` tool
✅ **Step 3:** Removed sensitive files from entire git history
✅ **Step 4:** Force-pushed cleaned history to GitHub
✅ **Step 5:** Verified files are no longer tracked in repository
✅ **Step 6:** Created this security incident document

## Required Actions (URGENT)

### Immediate Actions (Do Now)

1. **Rotate Supabase Credentials**
   ```bash
   # 1. Go to Supabase Dashboard
   # 2. Navigate to: Settings > API
   # 3. Generate new anon key
   # 4. Update the following:
   #    - Vercel environment variables
   #    - Local .env.local file
   ```

2. **Rotate Google OAuth Client ID**
   ```bash
   # 1. Go to Google Cloud Console
   # 2. Navigate to: APIs & Services > Credentials
   # 3. Delete old client ID
   # 4. Create new OAuth 2.0 client ID
   # 5. Update the following:
   #    - Vercel environment variables
   #    - Local .env.local file
   ```

3. **Update Vercel Environment Variables**
   ```bash
   # 1. Go to Vercel Dashboard
   # 2. Navigate to: Settings > Environment Variables
   # 3. Update all rotated credentials
   # 4. Redeploy application
   ```

### Follow-up Actions (Within 24 Hours)

4. **Review GitHub Access**
   - Check repository access logs (if available)
   - Review who has cloned the repository
   - Consider whether any unauthorized access occurred

5. **Monitor for Unauthorized Access**
   - Monitor Supabase logs for unusual activity
   - Monitor Google OAuth logs for unauthorized sign-ins
   - Set up alerts for suspicious activity

6. **Update Team**
   - Notify team members that credentials have been rotated
   - Ensure everyone updates their local `.env.local` files
   - Remind team of `.gitignore` policies

## Prevention Measures Implemented

### Technical Controls
✅ Updated `.gitignore` to block all `.env` files by default
✅ Only `.env*.example` files are allowed in git
✅ Force-pushed cleaned history to remote

### Recommended Additional Controls

1. **Pre-commit Hooks**
   ```bash
   # Install pre-commit hook to prevent .env files from being committed
   # Add to .git/hooks/pre-commit or use husky
   ```

2. **GitHub Secret Scanning**
   - Enable GitHub secret scanning on repository
   - Set up alerts for exposed credentials

3. **Environment Variable Management**
   - Consider using a secrets management service (e.g., Doppler, Vault)
   - Implement environment variable validation in CI/CD

## Timeline

- **2025-11-22 16:15** - Issue discovered: `.env` files found in git history
- **2025-11-22 16:18** - `.gitignore` updated to exclude all `.env` files
- **2025-11-22 16:20** - `git-filter-repo` installed and executed
- **2025-11-22 16:21** - Force-pushed cleaned history to GitHub
- **2025-11-22 16:22** - Verified remediation and created incident report

## Root Cause

The `.gitignore` file contained **negation patterns** (lines starting with `!`) that explicitly forced git to track environment files:

```gitignore
# OLD (INCORRECT) .gitignore
!.env.development
!.env.staging
!.env.test
!.env.production
```

These patterns overrode the default ignore rules and caused git to track these sensitive files.

## New .gitignore Configuration

```gitignore
# NEW (CORRECT) .gitignore
# Ignore ALL .env files by default
.env
.env.*

# ONLY track .example and .template files
!.env*.example
!.env*.template
```

## Verification Commands

To verify the cleanup was successful:

```bash
# Check which .env files are tracked
git ls-files | grep -E "\.env"
# Should only show: .env.local.example, .env.production.example, .env.local.production.example

# Check git history for removed files
git log --all --oneline --source --decorate -- .env.development
# Should return no results

# Check git status
git status
# Should show: "nothing to commit, working tree clean"
```

## References

- Repository: https://github.com/eazytracer/rock-on
- Supabase Dashboard: https://supabase.com/dashboard/project/khzeuxxhigqcmrytsfux
- Google Cloud Console: https://console.cloud.google.com
- Vercel Dashboard: https://vercel.com

---

**Next Steps:** Immediately rotate all exposed credentials as outlined in "Required Actions" section.
