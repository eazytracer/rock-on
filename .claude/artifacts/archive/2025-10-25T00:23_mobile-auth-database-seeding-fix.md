---
timestamp: 2025-10-25T00:23
prompt: User reported that mock user login doesn't work on mobile device (first time loading app). Error message suggested running resetDB(). Investigation revealed database seeding race condition.
type: bug-fix-summary
status: fixed
---

# Mobile Authentication Database Seeding Fix

## Problem Summary

When accessing the Rock-On app from a mobile device over the network for the first time, the mock user login buttons (Eric, Mike, Sarah) failed with the error:

> "User not found in database. Try running resetDB() in console."

## Root Cause Analysis

The issue was caused by **two separate database seeding systems** competing with each other and a **race condition** in the application initialization:

### Issue 1: Conflicting Seeding Systems

1. **Old System** (`src/database/seedData.ts`)
   - Called from `App.tsx` useEffect
   - Creates users: `alice@test.com`, `bob@test.com`, `charlie@test.com`
   - Runs with `await` (waits for completion)

2. **New System** (`src/database/seedMvpData.ts`)
   - Called from `main.tsx` on app initialization
   - Creates users: `eric@ipodshuffle.com`, `mike@ipodshuffle.com`, `sarah@ipodshuffle.com`
   - Ran asynchronously **without** waiting for completion

### Issue 2: Race Condition

Both seeding functions check if users already exist before seeding:

```typescript
// seedData.ts
const songCount = await db.songs.count()
if (songCount > 0) return

// seedMvpData.ts
const existingUsers = await db.users.count()
if (existingUsers > 0) return
```

**Execution sequence:**
1. `main.tsx` calls `seedMvpData()` asynchronously (doesn't wait)
2. React app renders
3. `App.tsx` useEffect calls `await seedDatabase()`
4. `seedDatabase()` completes first, adds alice/bob/charlie
5. `seedMvpData()` finally runs, sees users exist, **skips seeding** eric/mike/sarah
6. User clicks "Eric (Guitar, Vocals)" button
7. Login queries for `eric@ipodshuffle.com` → **not found!**

### Issue 3: IndexedDB Origin Isolation

Desktop (`http://localhost:5173`) and mobile (`http://<ip>:5173`) have completely separate IndexedDB databases due to browser security (different origins). This meant:
- Desktop database might have been seeded properly at some point
- Mobile device starting fresh triggered the race condition every time

## Solution Implemented

### 1. Removed Old Seeding System
**File:** `src/App.tsx`

Removed the conflicting `seedDatabase()` call and related imports:
```typescript
// REMOVED:
import { seedDatabase } from './database/seedData'
import { BandMembershipService } from './services/BandMembershipService'
import { db } from './services/database'
import { User } from './models/User'

// REMOVED entire useEffect that called seedDatabase()
```

### 2. Fixed Race Condition
**File:** `src/main.tsx`

Changed async seeding to **wait for completion** before rendering:

```typescript
// BEFORE:
seedMvpData().catch(error => {
  console.error('Failed to seed database:', error)
})

ReactDOM.createRoot(document.getElementById('root')!).render(...)

// AFTER:
async function initializeApp() {
  if (import.meta.env.DEV) {
    try {
      // Wait for seeding to complete before rendering
      await seedMvpData()
    } catch (error) {
      console.error('Failed to seed database:', error)
    }
  }

  // Now render the app
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

initializeApp()
```

### 3. Fixed Invite Code
**File:** `src/database/seedMvpData.ts`

Updated the default invite code to match the UI suggestion:
```typescript
// BEFORE:
code: 'ROCK2024',

// AFTER:
code: 'ROCK2025',
```

### 4. Added Missing TypeScript Property
**File:** `src/pages/NewLayout/AuthPages.tsx`

Added `isActive: true` to invite code creation (2 locations) to match the `InviteCode` interface requirements.

## Testing

After the fix:
1. Mobile device loads the app for the first time
2. `seedMvpData()` completes **before** React renders
3. Eric, Mike, and Sarah users are in the database
4. Mock user login buttons work immediately

## Files Modified

- `src/main.tsx` - Fixed initialization race condition
- `src/App.tsx` - Removed old seeding system
- `src/database/seedMvpData.ts` - Updated invite code
- `src/pages/NewLayout/AuthPages.tsx` - Added isActive property to invite codes

## Impact

- ✅ Mobile devices can now use mock user login on first load
- ✅ No more race condition between seeding systems
- ✅ Single source of truth for test data (seedMvpData)
- ✅ App initialization is deterministic
- ⚠️ Slightly longer initial load in dev mode (waits for seeding)

## Notes

- The `seedData.ts` file still exists but is no longer used
- Could be removed in future cleanup
- The `resetDB()` console function is still available in dev mode
- Production builds are unaffected (seeding only runs in dev mode)
