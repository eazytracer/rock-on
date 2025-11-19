---
title: User Authentication Flow Specification
created: 2025-11-09T22:07
status: Active
type: User Journey
description: Complete user journey for authentication, account creation, and band setup
---

# User Authentication Flow Specification

## Purpose

This document defines the expected user experience for authentication flows in RockOn. It focuses on **what the user sees and experiences**, not implementation details. This specification drives test cases and validates that the authentication system works correctly from a user perspective.

---

## Core Principles

1. **Local-first**: Users can access their data even when offline or session expires
2. **Progressive enhancement**: Basic functionality works, then sync/collaboration enhances it
3. **Clear feedback**: Users always know what's happening (loading, error, success)
4. **No data loss**: Authentication issues never cause users to lose their work
5. **Frictionless**: Minimize steps to get users into the app

---

## Authentication Methods

RockOn supports two authentication methods:

1. **Email/Password**: Traditional username and password authentication
2. **Google OAuth**: Sign in with Google account

Both methods follow the same post-authentication flow (band creation/joining).

---

# User Journey 1: New User with Email/Password

## Journey Overview
A brand new user creates an account using email and password, then creates or joins their first band.

## Steps

### 1. User Arrives at Sign In Page
**User sees:**
- Sign in form (email + password)
- "Sign in with Google" button
- "Don't have an account? Sign up" link

**Actions available:**
- Enter email/password and click "Sign In"
- Click "Sign in with Google"
- Click "Sign up" link

**Expected behavior:**
- Form is empty and ready for input
- No loading states visible
- No error messages visible

---

### 2. User Clicks "Sign Up"
**User sees:**
- Sign up form (name, email, password, confirm password)
- Password requirements clearly stated
- "Already have an account? Sign in" link
- "Sign up" button

**Actions available:**
- Fill in form fields
- Click "Sign up" button
- Click "Sign in" link to go back

**Expected behavior:**
- Form validates as user types:
  - Email format validation
  - Password strength indicator
  - Password confirmation match
- Submit button disabled until form is valid

---

### 3. User Submits Sign Up Form
**User sees:**
- Loading indicator on submit button
- Form fields become disabled during submission
- Success message: "Account created successfully!"

**Actions available:**
- None (waiting for account creation)

**Expected behavior:**
- Loading state appears immediately
- Form submits to Supabase
- If email confirmation required:
  - User sees: "Check your email to confirm your account"
  - User cannot proceed until email confirmed
- If no confirmation required (dev mode):
  - User automatically signs in
  - Proceeds to next step

**Test cases:**
- ✅ Valid email/password creates account
- ✅ Duplicate email shows error: "Email already registered"
- ✅ Weak password shows error: "Password must be at least 8 characters"
- ✅ Mismatched passwords shows error: "Passwords do not match"
- ✅ Network error shows: "Unable to create account. Please try again."

---

### 4. User Confirms Email (if required)
**User sees:**
- Email in their inbox from RockOn
- Confirmation link in email
- Message: "Click the link to confirm your account"

**Actions available:**
- Click confirmation link in email
- Request new confirmation email if expired

**Expected behavior:**
- Clicking link opens `/auth/callback?code=...`
- Callback page shows: "Confirming your account..."
- Session is established
- User is redirected to get-started flow

**Test cases:**
- ✅ Confirmation link creates valid session
- ✅ Expired link shows: "Confirmation link expired. Request a new one."
- ✅ Already confirmed link shows: "Email already confirmed. Please sign in."

---

### 5. User Arrives at Get Started Flow
**User sees:**
- Welcome message: "Welcome to RockOn! Let's get you set up."
- Two options presented as cards:
  1. "Create a new band" (with icon/illustration)
  2. "Join an existing band" (with icon/illustration)

**Actions available:**
- Click "Create a new band"
- Click "Join an existing band"

**Expected behavior:**
- Both options are clearly clickable
- No band context exists yet (`currentBandId = null`)
- User profile has been created in IndexedDB
- User record exists in local database

**Test cases:**
- ✅ New user sees get-started flow (not redirected to home)
- ✅ User data exists in IndexedDB (users table)
- ✅ User profile exists in IndexedDB (userProfiles table)
- ✅ No bands in IndexedDB yet
- ✅ `localStorage.currentUserId` is set
- ✅ `localStorage.currentBandId` is null

---

### 6a. User Chooses "Create a New Band"
**User sees:**
- Form with fields:
  - Band name (required)
  - Band description (optional)
  - "Create Band" button

**Actions available:**
- Enter band name
- Enter description
- Click "Create Band"
- Click "Back" to return to choice

**Expected behavior:**
- Band name field auto-focused
- Submit button disabled until band name entered
- Description is optional

**Test cases:**
- ✅ Empty band name shows validation error
- ✅ Valid band name enables submit button

---

### 6b. User Submits "Create Band" Form
**User sees:**
- Loading indicator
- Success message: "Band created successfully!"
- Automatic redirect to home page

**Actions available:**
- None (automatic redirect)

**Expected behavior:**
- Band created in Supabase
- Band synced to IndexedDB
- Band membership created (user = admin)
- Membership synced to IndexedDB
- `localStorage.currentBandId` set to new band ID
- User redirected to `/` (home page)

**Test cases:**
- ✅ Band exists in Supabase `bands` table
- ✅ Band exists in IndexedDB `bands` table
- ✅ Membership exists in Supabase `band_memberships` table
- ✅ Membership exists in IndexedDB `bandMemberships` table
- ✅ User role is 'admin'
- ✅ Membership status is 'active'
- ✅ `localStorage.currentBandId` matches created band ID
- ✅ User is redirected to home page
- ✅ Home page shows empty state (no songs, setlists, etc.)

---

### 6c. User Chooses "Join an Existing Band"
**User sees:**
- Form with field:
  - Invite code input
  - "Join Band" button
- Message: "Enter the invite code your band admin shared with you"

**Actions available:**
- Enter invite code
- Click "Join Band"
- Click "Back" to return to choice

**Expected behavior:**
- Submit button disabled until code entered
- Code input accepts alphanumeric characters

**Test cases:**
- ✅ Empty code shows validation error
- ✅ Valid code enables submit button

---

### 6d. User Submits Invite Code
**User sees:**
- Loading indicator
- On success: "Joined [Band Name] successfully!"
- Automatic redirect to home page

**Actions available:**
- None (automatic redirect on success)

**Expected behavior:**
- Invite code validated against Supabase
- Band membership created (user = member)
- Band and membership synced to IndexedDB
- `localStorage.currentBandId` set to band ID
- User redirected to home page
- Initial sync downloads band's songs, setlists, etc.

**Test cases:**
- ✅ Invalid code shows error: "Invalid invite code"
- ✅ Expired code shows error: "Invite code has expired"
- ✅ Already used code shows error: "Invite code already used"
- ✅ Valid code creates membership
- ✅ Membership exists in Supabase `band_memberships`
- ✅ Membership exists in IndexedDB `bandMemberships`
- ✅ User role is 'member' (not admin)
- ✅ Band data synced to IndexedDB
- ✅ Band's songs synced to IndexedDB
- ✅ `localStorage.currentBandId` set correctly
- ✅ User redirected to home page
- ✅ Home page shows band's existing data

---

### 7. User Arrives at Home Page (First Time)
**User sees:**
- If created band:
  - Empty state: "Start building your setlist!"
  - Call to action: "Add your first song"
  - Band name in header
- If joined band:
  - Existing band data (songs, setlists, shows)
  - Band name in header
  - Welcome message: "You're now a member of [Band Name]!"

**Actions available:**
- Browse songs (if any)
- Add new song
- Create setlist
- Navigate to other sections

**Expected behavior:**
- User is fully authenticated
- Session persists on page refresh
- All data accessible offline
- Sync engine running in background

**Test cases:**
- ✅ Page refresh maintains session
- ✅ User data persists in IndexedDB
- ✅ Can create new songs/setlists
- ✅ Changes sync to Supabase
- ✅ Sign out button visible and works

---

# User Journey 2: New User with Google OAuth

## Journey Overview
A brand new user signs in using Google, then creates or joins their first band.

## Steps

### 1. User Arrives at Sign In Page
**User sees:**
- Same as email/password journey
- "Sign in with Google" button prominent

**Actions available:**
- Click "Sign in with Google"

**Expected behavior:**
- Google button is clearly visible
- Clicking initiates OAuth flow

---

### 2. User Clicks "Sign in with Google"
**User sees:**
- Browser redirects to Google OAuth consent screen
- Google asks to sign in (if not already signed in)
- Google asks for permission to share email/profile

**Actions available:**
- Select Google account
- Grant permissions
- Deny permissions (cancels flow)

**Expected behavior:**
- New tab/window opens for Google OAuth
- User sees familiar Google sign-in interface
- Permissions requested are minimal (email, profile)

**Test cases:**
- ✅ OAuth redirect URL is correct (`/auth/callback`)
- ✅ OAuth scopes requested are appropriate
- ✅ Denying permissions returns to sign-in with error

---

### 3. User Grants Google Permissions
**User sees:**
- Redirect back to RockOn at `/auth/callback`
- Loading message: "Completing sign in..."
- Brief loading state

**Actions available:**
- None (automatic processing)

**Expected behavior:**
- OAuth callback receives auth code
- Auth code exchanged for session
- User record created in Supabase (if new user)
- User synced to IndexedDB
- Profile created with Google name/email

**Test cases:**
- ✅ Callback receives valid auth code
- ✅ Code exchange succeeds
- ✅ Session established
- ✅ User created in Supabase `users` table
- ✅ User synced to IndexedDB `users` table
- ✅ User profile created with Google data
- ✅ `authProvider` field set to 'google'

---

### 4. User Redirected to Get Started Flow
**Same as email/password journey from step 5 onward**

The flow from here is identical to the email/password journey:
- User sees get-started page
- User creates or joins band
- User arrives at home page

**Test cases:**
- ✅ New Google user without band goes to get-started
- ✅ Returning Google user with band goes to home
- ✅ All subsequent flows work identically to email/password

---

# User Journey 3: Returning User Sign In

## Journey Overview
A user who already has an account signs back in.

## Steps

### 1. User Arrives at Sign In Page
**User sees:**
- Sign in form (email/password)
- "Sign in with Google" button
- "Forgot password?" link

**Actions available:**
- Enter credentials and sign in
- Click "Sign in with Google"

**Expected behavior:**
- Form is empty (no saved credentials shown by RockOn)
- Browser may autofill credentials (browser behavior)

---

### 2. User Enters Credentials and Clicks "Sign In"
**User sees:**
- Loading indicator on submit button
- Form fields disabled during submission
- On success: Brief redirect to home page

**Actions available:**
- None (automatic redirect on success)

**Expected behavior:**
- Credentials validated against Supabase
- Session created
- User data synced from Supabase to IndexedDB
- Bands/memberships synced to IndexedDB
- If data already in IndexedDB: incremental sync only
- `localStorage.currentUserId` set
- `localStorage.currentBandId` set (if user has bands)

**Test cases:**
- ✅ Valid credentials sign in successfully
- ✅ Invalid password shows error: "Invalid email or password"
- ✅ Non-existent email shows error: "Invalid email or password"
- ✅ User with bands goes directly to home
- ✅ User without bands goes to get-started
- ✅ Existing local data is preserved
- ✅ New data from Supabase is synced down
- ✅ Sync engine starts automatically

---

### 3. User Arrives at Home Page
**User sees:**
- Full band data (songs, setlists, shows)
- Band name in header
- Welcome back message (optional)
- Latest activity/changes since last login

**Actions available:**
- All normal app functionality
- Browse/edit songs, setlists, shows
- Sign out

**Expected behavior:**
- All user's data is accessible
- Session persists across tabs
- Session persists across page refreshes
- Real-time updates from other band members appear
- Changes sync to Supabase automatically

**Test cases:**
- ✅ Page refresh maintains session
- ✅ Multiple tabs share same session
- ✅ Real-time updates work
- ✅ Offline mode works (can view/edit local data)
- ✅ Coming back online syncs changes

---

# User Journey 4: Google OAuth Returning User

## Journey Overview
A user who previously signed in with Google signs in again.

## Steps

### 1. User Clicks "Sign in with Google"
**Same as new user Google flow (steps 1-3)**

**Expected behavior:**
- If user already signed into Google in browser:
  - May skip Google sign-in screen (seamless)
  - Automatic redirect back to RockOn
- Session established
- User data synced from Supabase

---

### 2. User Redirected to Appropriate Page
**User sees:**
- If has bands: Redirect to home page
- If no bands: Redirect to get-started

**Expected behavior:**
- Same as email/password returning user
- Fast sign-in (Google remembers consent)

**Test cases:**
- ✅ Returning Google user signs in quickly
- ✅ User with bands goes to home
- ✅ All data syncs correctly

---

# Edge Cases & Error Scenarios

## 1. Session Timeout While Using App

### What Happens
User is actively using the app when their session expires (1 hour default).

### Expected Behavior
**User sees:**
- Sync operations start failing silently in background
- After 3 failed attempts: Toast notification appears
  - "Your session has expired. Please sign in again."
- Sign in modal appears over current page
- Current page content remains visible (read-only)

**Actions available:**
- Sign in again in the modal
- Continue viewing local data
- Close modal (but can't make changes until re-authenticated)

**Expected behavior:**
- Local data remains accessible (can view)
- Cannot create/edit until re-authenticated
- After re-auth: pending changes sync automatically
- No data loss

**Test cases:**
- ✅ Session expiration detected within 30 seconds
- ✅ Toast notification appears
- ✅ Sign-in modal appears
- ✅ Local data remains viewable
- ✅ Cannot create new items until re-auth
- ✅ After re-auth: pending changes sync
- ✅ No data loss occurs

---

## 2. Network Error During Sign In

### What Happens
User tries to sign in but network is unavailable.

### Expected Behavior
**User sees:**
- Loading indicator for 5-10 seconds
- Error message: "Unable to connect. Please check your internet connection."
- Retry button appears

**Actions available:**
- Click "Retry"
- Wait for network to return

**Expected behavior:**
- Sign in form remains filled (doesn't lose input)
- User can retry when network returns
- Clear error messaging (not technical jargon)

**Test cases:**
- ✅ Network error shows clear message
- ✅ Retry button works
- ✅ Form input preserved during error
- ✅ Successful retry signs in correctly

---

## 3. OAuth Callback Errors

### 3a. Invalid/Expired Auth Code
**User sees:**
- Error message: "Sign in failed. Please try again."
- Redirect back to sign in page after 3 seconds

**Expected behavior:**
- No crash or blank page
- Clear error message
- Automatic redirect to retry

**Test cases:**
- ✅ Invalid code handled gracefully
- ✅ Expired code handled gracefully
- ✅ User redirected to sign in
- ✅ Error parameter in URL shows error message

---

### 3b. Missing Auth Code in Callback
**User sees:**
- Error message: "Authentication incomplete. Please try again."
- Redirect to sign in page

**Expected behavior:**
- Handles missing code parameter
- Doesn't crash or hang

**Test cases:**
- ✅ Missing code parameter handled
- ✅ User redirected appropriately
- ✅ Error logged for debugging

---

## 4. User Already Signed In Accesses Auth Page

### Expected Behavior
**User navigates to `/auth` while signed in:**
- Automatic redirect to home page
- No sign in form shown
- Session preserved

**Test cases:**
- ✅ Signed-in user accessing `/auth` redirects to `/`
- ✅ Session remains active during redirect
- ✅ No "flashing" of auth form before redirect

---

## 5. User Signs Out

### Expected Behavior
**User clicks "Sign Out":**
- Confirmation dialog appears: "Are you sure you want to sign out?"
  - "Cancel" button
  - "Sign Out" button

**After confirming:**
- Session cleared from Supabase
- Local storage auth tokens cleared
- User redirected to sign in page
- IndexedDB data PRESERVED (for next sign in)

**Test cases:**
- ✅ Sign out clears session
- ✅ User redirected to `/auth`
- ✅ Can't access protected routes after sign out
- ✅ IndexedDB data preserved
- ✅ Re-signing in restores data access
- ✅ All tabs detect sign out (multi-tab sync)

---

## 6. Multiple Tabs Open

### Expected Behavior
**User has multiple tabs open:**
- Sign in in one tab → All tabs receive session
- Sign out in one tab → All tabs sign out
- Session expiry in background → All tabs show re-auth prompt
- Creating data in one tab → Other tabs see updates (real-time)

**Test cases:**
- ✅ Sign in syncs across all tabs
- ✅ Sign out syncs across all tabs
- ✅ Session expiry detected in all tabs
- ✅ Real-time data updates across tabs

---

## 7. Email Already Registered

### Expected Behavior
**User tries to sign up with existing email:**
- Error message: "An account with this email already exists. Please sign in."
- "Sign in" link in error message
- Form remains filled (except password)

**Test cases:**
- ✅ Duplicate email shows clear error
- ✅ Sign in link navigates to sign in page
- ✅ Email field preserved in form

---

## 8. Password Reset Flow

### Expected Behavior
**User clicks "Forgot password?" link:**
- Navigate to password reset page
- Form with email input
- Submit sends reset email

**User receives reset email:**
- Clicks link in email
- Opens RockOn with token
- Form to enter new password
- Submit resets password and signs in

**Test cases:**
- ✅ Reset email sent successfully
- ✅ Reset link opens app correctly
- ✅ New password saved
- ✅ User signed in after reset
- ✅ Can use new password to sign in

---

# State Transitions

## Authentication States

```
┌─────────────────────────────────────────────────────────────┐
│                     UNAUTHENTICATED                         │
│  - No session                                               │
│  - Local data accessible (read-only)                        │
│  - Redirected to /auth for protected routes                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Sign in/Sign up successful
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    AUTHENTICATED (No Band)                   │
│  - Valid session                                            │
│  - User record in Supabase + IndexedDB                      │
│  - No band memberships                                      │
│  - Redirected to /auth?view=get-started                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Create/join band
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                 AUTHENTICATED (With Band)                    │
│  - Valid session                                            │
│  - User record in Supabase + IndexedDB                      │
│  - Active band membership                                   │
│  - Full app access                                          │
│  - Sync engine running                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Session expires
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    SESSION EXPIRED                          │
│  - Invalid/missing session                                  │
│  - Local data accessible (read-only)                        │
│  - Re-auth prompt shown                                     │
│  - Cannot sync/create new data                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Re-authenticate
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                 AUTHENTICATED (With Band)                    │
│  - Valid session restored                                   │
│  - Pending changes sync                                     │
│  - Full functionality restored                              │
└─────────────────────────────────────────────────────────────┘
```

---

# Data Sync Behavior by Auth State

## New User Sign Up

```
1. User submits sign up form
   ↓
2. Supabase creates user record
   ↓
3. Session established
   ↓
4. AuthService.onAuthStateChange fires
   ↓
5. User synced to IndexedDB (users table)
   ↓
6. User profile created in IndexedDB (userProfiles table)
   ↓
7. No bands yet → Skip band sync
   ↓
8. Redirect to get-started
```

## New User Creates Band

```
1. User submits "Create Band" form
   ↓
2. Band created in Supabase (bands table)
   ↓
3. Band membership created in Supabase (band_memberships table)
   ↓
4. Band synced to IndexedDB (bands table)
   ↓
5. Membership synced to IndexedDB (bandMemberships table)
   ↓
6. localStorage.currentBandId set
   ↓
7. Redirect to home page
   ↓
8. Sync engine starts (empty band, nothing to sync down)
```

## New User Joins Band

```
1. User submits invite code
   ↓
2. Invite code validated (Supabase)
   ↓
3. Band membership created in Supabase
   ↓
4. Band synced to IndexedDB
   ↓
5. Membership synced to IndexedDB
   ↓
6. localStorage.currentBandId set
   ↓
7. Initial sync starts:
   - Download all band songs
   - Download all setlists
   - Download all shows
   - Download all practice sessions
   ↓
8. Initial sync completes
   ↓
9. Redirect to home page (with band data)
   ↓
10. Sync engine starts for real-time updates
```

## Returning User Sign In

```
1. User signs in (email/password or Google)
   ↓
2. Session established
   ↓
3. AuthService.onAuthStateChange fires
   ↓
4. User last login updated in IndexedDB
   ↓
5. Bands/memberships synced from Supabase to IndexedDB
   ↓
6. Check if initial sync needed:
   - If IndexedDB empty: Full initial sync
   - If IndexedDB has data: Incremental sync (changes only)
   ↓
7. Redirect to home page
   ↓
8. Sync engine starts for real-time updates
```

---

# Test Case Summary

## Critical Test Cases (Must Pass)

### Sign Up (Email/Password)
- [ ] TC-001: Valid email/password creates account
- [ ] TC-002: Duplicate email shows error
- [ ] TC-003: Weak password shows error
- [ ] TC-004: Mismatched passwords show error
- [ ] TC-005: New user redirected to get-started
- [ ] TC-006: User record created in Supabase
- [ ] TC-007: User synced to IndexedDB

### Sign In (Email/Password)
- [ ] TC-008: Valid credentials sign in successfully
- [ ] TC-009: Invalid password shows error
- [ ] TC-010: User with band redirected to home
- [ ] TC-011: User without band redirected to get-started
- [ ] TC-012: Session persists on page refresh
- [ ] TC-013: Session persists across tabs

### Google OAuth
- [ ] TC-014: Google sign in initiates OAuth flow
- [ ] TC-015: OAuth callback creates session
- [ ] TC-016: New Google user redirected to get-started
- [ ] TC-017: Returning Google user redirected to home
- [ ] TC-018: User record has authProvider='google'

### Band Creation
- [ ] TC-019: Create band form validates input
- [ ] TC-020: Band created in Supabase
- [ ] TC-021: Band synced to IndexedDB
- [ ] TC-022: Membership created with role='admin'
- [ ] TC-023: Membership synced to IndexedDB
- [ ] TC-024: localStorage.currentBandId set
- [ ] TC-025: User redirected to home after creation

### Band Joining
- [ ] TC-026: Invalid invite code shows error
- [ ] TC-027: Valid invite code creates membership
- [ ] TC-028: Membership has role='member'
- [ ] TC-029: Band data synced to IndexedDB
- [ ] TC-030: Band songs synced to IndexedDB
- [ ] TC-031: localStorage.currentBandId set
- [ ] TC-032: User redirected to home after joining

### Session Management
- [ ] TC-033: Session expires after 1 hour
- [ ] TC-034: Session expiry shows re-auth prompt
- [ ] TC-035: Local data accessible after expiry (read-only)
- [ ] TC-036: Re-auth restores full functionality
- [ ] TC-037: Pending changes sync after re-auth

### Sign Out
- [ ] TC-038: Sign out clears session
- [ ] TC-039: Sign out clears localStorage auth tokens
- [ ] TC-040: Sign out preserves IndexedDB data
- [ ] TC-041: Sign out redirects to /auth
- [ ] TC-042: Sign out syncs across all tabs

### Error Handling
- [ ] TC-043: Network error shows clear message
- [ ] TC-044: Network error allows retry
- [ ] TC-045: OAuth error redirects to sign in
- [ ] TC-046: No data loss on auth errors

---

## Test Implementation Notes

### Test File Locations
- Journey tests: `tests/journeys/auth-journeys.test.ts`
- Unit tests: `tests/unit/services/auth/`
- Integration tests: `tests/integration/auth/`
- E2E tests: `tests/e2e/auth-flow.spec.ts` (Playwright)

### Test Data Requirements
- Valid test email: `test-user@example.com`
- Valid test password: `TestPass123!`
- Test band name: `Test Band`
- Valid invite code: Generated in setup
- Invalid invite code: `INVALID123`

### Mocking Strategy
- Supabase client mocked in unit tests
- Real Supabase in integration tests (local instance)
- Real Supabase in E2E tests
- Google OAuth mocked in CI/CD

---

## References

### Related Specifications
- Database Schema: `.claude/specifications/unified-database-schema.md`
- Permissions: `.claude/specifications/permissions-and-use-cases.md`
- Sync Specification: `.claude/specifications/2025-10-30T13:25_bidirectional-sync-specification.md`

### Implementation Files
- Auth Service: `src/services/auth/SupabaseAuthService.ts`
- Auth Context: `src/contexts/AuthContext.tsx`
- Auth Callback: `src/pages/auth/AuthCallback.tsx`
- Auth Pages: `src/pages/NewLayout/AuthPages.tsx`

### Test Files
- Journey Tests: `tests/journeys/auth-journeys.test.ts`
- Logout Tests: `tests/unit/services/auth/SupabaseAuthService.logout.test.ts`

---

**Last Updated:** 2025-11-09T22:07
**Status:** Active - Drives all auth testing
**Maintainer:** Claude Code Development Team
