---
title: Development Workflow and Test Data Specification
created: 2025-10-26T01:17
status: Reference Document
description: Dev environment setup, test users/bands, and development workflows
---

# Development Workflow and Test Data Specification

**Purpose:** This document defines the development environment setup, test data, and standard workflows for the rock-on application.

---

## Table of Contents

1. [Test Users](#test-users)
2. [Test Bands](#test-bands)
3. [Development Environment](#development-environment)
4. [Authentication Flow](#authentication-flow)
5. [Testing Workflows](#testing-workflows)
6. [Common Commands](#common-commands)
7. [Troubleshooting](#troubleshooting)

---

## Test Users

### Overview

Three test users are maintained for development and testing:

| Name  | Email                 | User ID                                | Role in Band | Password |
| ----- | --------------------- | -------------------------------------- | ------------ | -------- |
| Eric  | eric@ipodshuffle.com  | `7e75840e-9d91-422e-a949-849f0b8e2ea4` | admin        | test123  |
| Mike  | mike@ipodshuffle.com  | `0c9c3e47-a4e0-4b70-99db-3e14c89ba9b3` | member       | test123  |
| Sarah | sarah@ipodshuffle.com | `b7e6bb62-5c26-4a78-be6b-2e7a1cbe5f77` | member       | test123  |

### User Setup

**Location:** Supabase Dashboard > Authentication > Users

**Created via:**

- Manual creation in Supabase Auth Dashboard
- Seeded in `public.users` table via `supabase/seed-dev-users.sql`

**Properties:**

- All users use `email` auth provider
- All users are auto-confirmed (no email verification needed)
- All users have access to the "iPod Shuffle" test band

---

## Test Bands

### iPod Shuffle (Primary Test Band)

**Band Details:**

- Name: `iPod Shuffle`
- Description: `Dev test band`
- Created by: Eric (admin)
- Status: Active

**Members:**

- Eric (admin, owner)
- Mike (member)
- Sarah (member)

**Band ID:** Generated dynamically by seed script (save after running)

**Purpose:** Primary band for testing all multi-user features including:

- Song sharing
- Setlist collaboration
- Practice session scheduling
- Member permissions

---

## Development Environment

### Architecture Overview

```
┌─────────────────────────────────────────────────┐
│              Local Development                   │
│                                                  │
│  ┌──────────────┐         ┌──────────────┐     │
│  │  IndexedDB   │ ←─sync─→│  Supabase    │     │
│  │  (Dexie.js)  │         │  PostgreSQL  │     │
│  └──────────────┘         └──────────────┘     │
│        ↑                         ↑              │
│        │                         │              │
│  ┌─────┴────────────────────────┴─────┐        │
│  │      Application Layer              │        │
│  │   (React + SyncRepository)          │        │
│  └─────────────────────────────────────┘        │
└─────────────────────────────────────────────────┘
```

### Local-First Strategy

**Development Mode:**

1. Data writes go to IndexedDB first (optimistic UI)
2. SyncRepository queues changes for remote sync
3. SyncEngine syncs to Supabase in background
4. Offline-capable: app works without internet

**Production Mode:**

- Same architecture
- Requires initial auth with Supabase
- User data syncs across devices

### Technology Stack

- **Frontend:** React 18+ with TypeScript 5.x
- **Local Storage:** Dexie.js (IndexedDB wrapper)
- **Backend:** Supabase (PostgreSQL + Auth)
- **Styling:** TailwindCSS
- **Testing:** Vitest

---

## Authentication Flow

### Current Implementation (Dev Mode)

**Mock User Login:**

1. User clicks "Show Mock Users for Testing" on login page
2. Selects Eric, Mike, or Sarah
3. App authenticates with Supabase Auth using stored credentials
4. Session token stored in browser
5. User ID stored in localStorage: `currentUserId`
6. Band ID stored in localStorage: `currentBandId`
7. Navigate to Songs page

**File:** `src/pages/NewLayout/AuthPages.tsx` (line 556)

### Authentication Requirements

**Critical:** For sync to work, the following MUST be true:

1. ✅ User must be authenticated via Supabase Auth
   - `supabase.auth.getSession()` returns valid session
   - `auth.uid()` in PostgreSQL returns user ID

2. ✅ User must exist in `public.users` table
   - User ID matches Supabase Auth user ID
   - Required for RLS policies

3. ✅ User must be member of a band
   - Record exists in `band_memberships`
   - `currentBandId` stored in localStorage

**Why:** Supabase RLS policies check `auth.uid()` which only works with authenticated sessions.

---

## Testing Workflows

### Initial Setup (First Time)

1. **Create Auth Users** (Supabase Dashboard):

   ```
   Authentication > Users > Add User
   - eric@ipodshuffle.com (password: test123)
   - mike@ipodshuffle.com (password: test123)
   - sarah@ipodshuffle.com (password: test123)
   ```

2. **Update Seed Script** with actual UUIDs:

   ```sql
   -- Edit: supabase/seed-dev-users.sql
   v_eric_id UUID := 'YOUR-ERIC-UUID-HERE'::uuid;
   v_mike_id UUID := 'YOUR-MIKE-UUID-HERE'::uuid;
   v_sarah_id UUID := 'YOUR-SARAH-UUID-HERE'::uuid;
   ```

3. **Run Seed Script** (Supabase SQL Editor):

   ```sql
   -- Copy entire contents of supabase/seed-dev-users.sql
   -- Paste into SQL Editor
   -- Click "Run"
   ```

4. **Save Band ID** from script output:
   ```
   NOTICE: Band ID: <uuid>
   ```

### Daily Development Workflow

1. **Start Dev Server:**

   ```bash
   npm run dev
   ```

2. **Login as Test User:**
   - Navigate to http://localhost:5173
   - Click "Show Mock Users for Testing"
   - Click "Eric", "Mike", or "Sarah"
   - You should be redirected to /songs

3. **Verify Authentication:**

   ```javascript
   // In browser console:
   const session = await supabase.auth.getSession()
   console.log('User ID:', session.data.session?.user.id)
   console.log('Local user:', localStorage.getItem('currentUserId'))
   // Should match!
   ```

4. **Test Sync:**

   ```javascript
   // Create a test song
   // Then check sync queue:
   window.debugSync()
   // Should show: Pending or Syncing items
   ```

5. **Verify in Supabase:**
   - Dashboard > Table Editor > songs
   - Should see your test song

### Testing Sync Functionality

**Test Cases:**

1. **Create Song:**
   - Add new song via UI
   - Check `window.debugSync()` shows queue activity
   - Verify song in Supabase

2. **Update Song:**
   - Edit song details
   - Check sync queue
   - Verify changes in Supabase

3. **Delete Song:**
   - Delete a song
   - Check sync queue
   - Verify deletion in Supabase

4. **Offline Mode:**
   - Disconnect network (DevTools > Network > Offline)
   - Create/update songs
   - Check queue (should show pending)
   - Reconnect network
   - Wait for sync
   - Verify all changes in Supabase

5. **Multi-User:**
   - Login as Eric, create song
   - Logout, login as Mike
   - Verify Mike sees Eric's song (shared band)

---

## Common Commands

### Development

```bash
# Start dev server
npm run dev

# Run tests
npm test

# Run specific test file
npm test -- tests/unit/services/SyncRepository.test.ts

# Run tests in watch mode
npm test -- --watch

# Type checking
npm run type-check

# Linting
npm run lint

# Build for production
npm run build
```

### Database Operations

```bash
# Reset local IndexedDB
# DevTools > Application > Storage > IndexedDB > Right-click > Delete
```

```sql
-- Verify RLS policies (Supabase SQL Editor)
SELECT policyname, cmd, qual as using_clause, with_check as with_check_clause
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'band_memberships'
ORDER BY cmd, policyname;

-- Check auth status
SELECT auth.uid();  -- Should return your user ID when authenticated

-- View all test users
SELECT id, email, name FROM public.users WHERE email LIKE '%ipodshuffle.com';

-- View band memberships
SELECT u.email, b.name as band_name, bm.role, bm.status
FROM public.users u
JOIN public.band_memberships bm ON bm.user_id = u.id
JOIN public.bands b ON b.id = bm.band_id
WHERE u.email LIKE '%ipodshuffle.com';
```

### Debugging

```javascript
// Browser console commands:

// Check sync status
window.debugSync()

// Check auth session
const { data } = await supabase.auth.getSession()
console.log('Session:', data.session)

// Check localStorage
console.log('User ID:', localStorage.getItem('currentUserId'))
console.log('Band ID:', localStorage.getItem('currentBandId'))

// Manually query IndexedDB
const songs = await db.songs.toArray()
console.log('Local songs:', songs)

// Check sync queue
const queue = await db.syncQueue.toArray()
console.log('Sync queue:', queue)
```

---

## Troubleshooting

### "No items in sync queue"

**Symptoms:**

- Songs created but queue empty
- No data in Supabase

**Cause:** Hooks bypassing SyncRepository (should be fixed)

**Verify Fix:**

```typescript
// Check: src/hooks/useSongs.ts line 77
// Should call:
await getSyncRepository().addSong(newSong)
// NOT:
await db.songs.add(newSong) // ❌ WRONG
```

### "RLS policy violation"

**Symptoms:**

- 500 errors on sync
- "Row violates row-level security policy"

**Causes:**

1. Not authenticated with Supabase
2. User not in `public.users` table
3. `auth.uid()` doesn't match `currentUserId`

**Solutions:**

```javascript
// 1. Verify auth session
const { data } = await supabase.auth.getSession()
console.log('Authenticated:', !!data.session)

// 2. Check user exists in DB
// Supabase SQL Editor:
SELECT * FROM public.users WHERE id = '<your-user-id>';

// 3. Verify IDs match
console.log('Auth ID:', data.session?.user.id)
console.log('Local ID:', localStorage.getItem('currentUserId'))
// Must match!
```

### "Auth session is null"

**Symptoms:**

- Mock login doesn't work
- No session after login

**Cause:** Not calling Supabase Auth

**Fix:** Verify `handleMockUserLogin` uses:

```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: mockEmail,
  password: 'test123',
})
```

### "Sync queue stuck"

**Symptoms:**

- Items stay in "pending" or "syncing" state
- Never complete

**Debug:**

```javascript
// Check queue details
const queue = await db.syncQueue.toArray()
queue.forEach(item => {
  console.log(item.tableName, item.operation, item.status, item.error)
})

// Look for error messages
const failed = queue.filter(item => item.status === 'failed')
console.log('Failed items:', failed)
```

**Common Fixes:**

- Check network (offline?)
- Check RLS policies (denied?)
- Check Supabase logs (errors?)

---

## File Locations

### Key Files

```
.claude/specifications/
  ├── unified-database-schema.md       # Database schema (authoritative)
  └── dev-workflow-and-test-data.md    # This file

supabase/
  ├── seed-dev-users.sql                # Seed test users/band
  ├── migrations/
  │   ├── 20251025000000_initial_schema.sql
  │   └── 20251025000100_rls_policies.sql
  └── query*.sql                        # Diagnostic queries

src/
  ├── hooks/
  │   └── useSongs.ts                   # Song hooks (uses SyncRepository)
  ├── services/
  │   └── data/
  │       ├── SyncRepository.ts         # Main sync logic
  │       ├── SyncEngine.ts             # Queue processor
  │       ├── LocalRepository.ts        # IndexedDB operations
  │       └── RemoteRepository.ts       # Supabase operations
  └── pages/
      └── NewLayout/
          └── AuthPages.tsx             # Mock user login

.claude/artifacts/
  ├── 2025-10-26T00:57_sync-not-working-root-cause.md
  ├── 2025-10-26T01:06_sync-testing-setup-guide.md
  └── ...
```

---

## Environment Variables

### Required for Development

```bash
# .env.local
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Optional (for service role operations)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # ⚠️ NEVER expose in client!
```

### Current Values

- Stored in `.env.local` (gitignored)
- Get from Supabase Dashboard > Settings > API

---

## Future Considerations

### Production Auth

Current: Mock users for dev
Future: Real user registration/login

**Todo:**

- Implement proper signup flow
- Email verification
- Password reset
- OAuth providers (Google, etc.)

### Offline Sync Strategy

Current: Basic queue-based sync
Future: Conflict resolution

**Todo:**

- Detect conflicts (last-write-wins?)
- Merge strategies
- User conflict resolution UI

### Multi-Device Sync

Current: Works but not thoroughly tested
Future: Full cross-device support

**Todo:**

- Test on multiple devices
- Handle concurrent edits
- Optimize sync frequency

---

## Version History

| Date       | Version | Changes                       |
| ---------- | ------- | ----------------------------- |
| 2025-10-26 | 1.0     | Initial specification created |

---

## Notes

- This document should be updated whenever test data changes
- Always verify against unified-database-schema.md for schema details
- Keep test user credentials secure (never commit to public repos)
- Mock users are for development only - not for production
