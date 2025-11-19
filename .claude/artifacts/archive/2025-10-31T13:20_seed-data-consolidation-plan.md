---
title: Seed Data Consolidation Plan
created: 2025-10-31T13:20
type: Implementation Plan
status: Ready for Review
purpose: Eliminate redundant seeding mechanisms and establish single source of truth
---

# Seed Data Consolidation Plan

## Executive Summary

**Problem:** Multiple seeding mechanisms (TypeScript + SQL) are causing data inconsistency, duplicate records, and "user bubble" isolation issues where band members can't see each other's data.

**Root Cause:** IndexedDB is being seeded directly via TypeScript (`seedMvpData.ts`) while ALSO syncing from Supabase, creating conflicting band IDs and user IDs.

**Solution:** Remove all TypeScript-based IndexedDB seeding. Use Supabase as single source of truth.

---

## Current State Analysis

### Seeding Mechanisms Found

| File | Type | Purpose | Status | Issues |
|------|------|---------|--------|--------|
| `supabase/seed-mvp-data.sql` | SQL | Seeds Supabase (auth + public schema) | ✅ KEEP | None - works correctly |
| `src/database/seedMvpData.ts` | TS | Seeds IndexedDB directly | ❌ REMOVE | Causes duplicate data, wrong IDs |
| `src/database/seedData.ts` | TS | Legacy IndexedDB seeding | ❌ REMOVE | Outdated, creates wrong data |
| `src/database/seedCatalog.ts` | TS | Song catalog for SQL generation | ⚠️ KEEP | Helper only, not used at runtime |
| `scripts/generateSeedSQL.ts` | TS | Generates SQL from catalog | ⚠️ KEEP | Helper only, generates SQL files |
| `supabase/seed-local-dev.sql` | SQL | Old minimal seed | ❌ DEPRECATE | Replaced by seed-mvp-data.sql |
| `supabase/seed-full-catalog.sql` | SQL | Auto-generated full catalog | ❌ DEPRECATE | Not maintained |

### Where TypeScript Seeding Is Called

**File:** `src/main.tsx` (lines 76-90)

```typescript
// ❌ PROBLEM: This seeds IndexedDB directly
if (shouldSeed) {
  console.log('🌱 Dev environment detected - preparing to seed database...')
  try {
    await seedMvpData()  // ← Seeds IndexedDB with random UUIDs
    console.log('✅ Seeding complete, ready to render app')
  } catch (error) {
    console.error('❌ Failed to seed database:', error)
  }
}
```

**Issue:** This creates data in IndexedDB with UUIDs that DON'T match Supabase, causing the "user bubble" problem.

---

## The "User Bubble" Problem Explained

### What Happened

1. User logs in for the first time
2. `main.tsx` calls `seedMvpData()` → Seeds IndexedDB with Band ID `99f47077...`
3. AuthContext calls `performInitialSync()` → Downloads from Supabase with Band ID `accfd37c...`
4. IndexedDB now has **TWO sets of 45 songs** with different band IDs
5. UI shows songs from IndexedDB, but filters by `currentBandId` from Supabase
6. Result: Users see their own "bubble" of data, can't see band members

### Evidence

From browser console (Sarah's session):

```json
{
  "totalSongs": 90,
  "duplicateExamples": [
    ["Black", [
      {"id": "02555327...", "contextId": "accfd37c...", "createdBy": "6ee2bc47..."},  // Supabase
      {"id": "147c9d94...", "contextId": "99f47077...", "createdBy": "b0183ece..."}   // seedMvpData
    ]],
    // ... 44 more duplicates
  ]
}
```

**Two band IDs:**
- `accfd37c-2bac-4e27-90b1-257659f58d44` (Real band from Supabase)
- `99f47077-0f8f-4c07-a39d-ba47df16a61d` (Fake band from seedMvpData)

**Two user IDs:**
- `6ee2bc47-0014-4cdc-b063-68646bb5d3ba` (Eric from Supabase auth)
- `b0183ece-fb53-4cb3-a1aa-5127c3399a6e` (Random from seedMvpData)

---

## Proposed Architecture

### Single Source of Truth: Supabase

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: supabase db reset                                  │
│  • Runs migrations                                          │
│  • Seeds auth.users (Eric, Mike, Sarah)                     │
│  • Seeds public schema (bands, songs, etc)                  │
│  • ONE band ID, consistent user IDs                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ STEP 2: User logs in
                       ↓
┌─────────────────────────────────────────────────────────────┐
│  AuthContext.tsx                                            │
│  • User authenticates with Supabase                         │
│  • Checks: isInitialSyncNeeded()                            │
│  • Runs: performInitialSync(userId)                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ STEP 3: Sync engine downloads data
                       ↓
┌─────────────────────────────────────────────────────────────┐
│  SyncEngine.performInitialSync()                            │
│  • Downloads bands, songs, setlists, shows from Supabase    │
│  • Stores in IndexedDB                                      │
│  • Uses SAME UUIDs as Supabase                              │
└─────────────────────────────────────────────────────────────┘
```

### Benefits

1. **No Duplicates:** Only one set of data with consistent IDs
2. **Real Sync Testing:** Actually exercises the sync engine
3. **Cloud-First:** Matches production architecture
4. **Shared Data:** All band members see the same band/songs/shows
5. **Easier Debugging:** One source of truth to check

---

## Implementation Plan

### Phase 1: Disable TypeScript Seeding (IMMEDIATE)

**File:** `src/main.tsx`

```typescript
// BEFORE:
if (shouldSeed) {
  await seedMvpData()  // ❌ Remove this
}

// AFTER:
// ✅ Remove all seeding code - sync engine will populate IndexedDB
// App will perform initial sync on first login
```

**Expected Behavior After Change:**
1. User opens app → IndexedDB is empty
2. User logs in → AuthContext detects empty IndexedDB
3. AuthContext calls `performInitialSync()` → Downloads from Supabase
4. UI shows synced data

### Phase 2: Update Imports (IMMEDIATE)

**File:** `src/main.tsx`

```typescript
// BEFORE:
import { seedMvpData } from './database/seedMvpData'  // ❌ Remove

// AFTER:
// (no import needed)
```

### Phase 3: Mark Files as Deprecated (DOCUMENTATION)

Add deprecation comments to these files:

**File:** `src/database/seedMvpData.ts` (line 1)

```typescript
/**
 * @deprecated DO NOT USE - This file seeds IndexedDB directly and causes data duplication.
 * Use Supabase seeding instead: `supabase db reset`
 * See: .claude/specifications/2025-10-27T18:16_test-data-and-seeding-specification.md
 */
```

**File:** `src/database/seedData.ts` (line 1)

```typescript
/**
 * @deprecated DO NOT USE - Legacy seeding file with outdated data.
 * Use Supabase seeding instead: `supabase db reset`
 * See: .claude/specifications/2025-10-27T18:16_test-data-and-seeding-specification.md
 */
```

### Phase 4: Update Developer Documentation (IMMEDIATE)

**File:** `README.md` (if exists)

```markdown
## Local Development

### Setup

1. Start Supabase:
   ```bash
   supabase start
   ```

2. Reset and seed database:
   ```bash
   supabase db reset
   ```
   This creates test users (Eric, Mike, Sarah) with password `test123`.

3. Start app:
   ```bash
   npm run dev
   ```

4. Login as a test user:
   - Click "Show Mock Users for Testing"
   - Click Eric, Mike, or Sarah
   - App will sync data from Supabase to IndexedDB

### Reset Data

```bash
# Clear everything and start fresh
supabase db reset

# Then in browser console:
await indexedDB.deleteDatabase('RockOnDB')
localStorage.clear()
location.reload()
```
```

### Phase 5: Verification Steps (BEFORE MERGE)

**Step 1: Clean slate**
```bash
# Reset Supabase
supabase db reset

# Clear browser data (in console)
await indexedDB.deleteDatabase('RockOnDB')
localStorage.clear()
location.reload()
```

**Step 2: Login as Eric**
```
1. Click "Show Mock Users for Testing"
2. Click "Eric (Guitar, Vocals)"
3. Wait for sync to complete
```

**Step 3: Verify data**
```javascript
// In browser console
const songs = await db.songs.toArray()
console.log('Song count:', songs.length)  // Should be 45

const bands = await db.bands.toArray()
console.log('Band count:', bands.length)  // Should be 1

const bandId = bands[0].id
const songsByBand = songs.filter(s => s.contextId === bandId)
console.log('Songs for band:', songsByBand.length)  // Should be 45

// Check for duplicates
const titles = songs.map(s => s.title)
const uniqueTitles = new Set(titles)
console.log('Unique titles:', uniqueTitles.size)  // Should be 45 (no duplicates)
```

**Step 4: Login as Mike (different browser/incognito)**
```
1. Open incognito window
2. Login as Mike
3. Verify: Mike sees same band and same 45 songs as Eric
4. Verify: Navigate to "Band Members" → Should see Eric, Mike, Sarah
```

**Step 5: Verify band members page**
```
1. As Eric: Navigate to Band Members
2. Should see:
   - Eric Johnson (Guitar, Vocals) - Admin
   - Mike Thompson (Bass, Harmonica, Vocals) - Admin
   - Sarah Chen (Drums, Percussion) - Member
```

---

## Files to Modify

### High Priority (MUST DO)

| File | Action | Lines | Change |
|------|--------|-------|--------|
| `src/main.tsx` | Edit | 76-90 | Remove seedMvpData() call |
| `src/main.tsx` | Edit | 10 | Remove import statement |
| `src/database/seedMvpData.ts` | Edit | 1 | Add @deprecated comment |
| `src/database/seedData.ts` | Edit | 1 | Add @deprecated comment |

### Medium Priority (SHOULD DO)

| File | Action | Purpose |
|------|--------|---------|
| `README.md` | Update | Add local development setup instructions |
| `.claude/specifications/2025-10-27T18:16_test-data-and-seeding-specification.md` | Already done | Updated with Supabase-only architecture |

### Low Priority (NICE TO HAVE)

| File | Action | Purpose |
|------|--------|---------|
| `src/database/seedMvpData.ts` | Delete | Remove after confirming no usage |
| `src/database/seedData.ts` | Delete | Remove after confirming no usage |
| `supabase/seed-local-dev.sql` | Delete | Replaced by seed-mvp-data.sql |
| `supabase/seed-full-catalog.sql` | Delete | Auto-generated, not maintained |

---

## Testing Plan

### Test Case 1: Fresh Install

**Scenario:** New developer clones repo

**Steps:**
```bash
git clone <repo>
cd rock-on
supabase start
supabase db reset
npm install
npm run dev
```

**Expected:**
1. App loads with login page
2. Click "Show Mock Users"
3. Click Eric button
4. ✅ Login succeeds
5. ✅ Initial sync completes
6. ✅ UI shows 45 songs
7. ✅ Status line shows "iPod Shuffle", "eric@ipodshuffle.com", "Connected"

### Test Case 2: Multi-User Access

**Scenario:** Multiple users in same band

**Steps:**
1. Browser 1: Login as Eric
2. Browser 2 (incognito): Login as Mike
3. Browser 3 (incognito): Login as Sarah

**Expected:**
- ✅ All 3 users see "iPod Shuffle" band
- ✅ All 3 users see same 45 songs
- ✅ All 3 users see each other in "Band Members" page
- ✅ No duplicate songs
- ✅ No "user bubble" isolation

### Test Case 3: Data Reset

**Scenario:** Developer needs clean slate

**Steps:**
```bash
# Reset Supabase
supabase db reset

# Clear browser
# (in console)
await indexedDB.deleteDatabase('RockOnDB')
localStorage.clear()
location.reload()
```

**Expected:**
- ✅ All data cleared
- ✅ Login triggers fresh sync
- ✅ Data appears correctly

---

## Rollback Plan

If issues arise after removing TypeScript seeding:

### Option 1: Revert Commit

```bash
git revert <commit-hash>
```

### Option 2: Re-enable Seeding Temporarily

**File:** `src/main.tsx`

```typescript
// Temporary rollback - re-enable seeding
import { seedMvpData } from './database/seedMvpData'

// ... in initializeApp()
if (shouldSeed) {
  await seedMvpData()
}
```

---

## Success Criteria

✅ **Complete when:**

1. `main.tsx` no longer calls `seedMvpData()`
2. Fresh login syncs data from Supabase (verified via console logs)
3. All 3 test users can see same band and songs
4. "Band Members" page shows all 3 members
5. No duplicate songs in IndexedDB
6. IndexedDB song count = 45 (not 90)
7. All songs have same `contextId` (band ID)

---

## Timeline

| Phase | Duration | Priority |
|-------|----------|----------|
| Phase 1: Disable seeding | 5 minutes | CRITICAL |
| Phase 2: Update imports | 2 minutes | HIGH |
| Phase 3: Deprecation comments | 10 minutes | MEDIUM |
| Phase 4: Documentation | 15 minutes | HIGH |
| Phase 5: Verification | 20 minutes | CRITICAL |

**Total estimated time:** 52 minutes

---

## Related Documentation

- **Updated Specification:** `.claude/specifications/2025-10-27T18:16_test-data-and-seeding-specification.md`
- **Database Schema:** `.claude/specifications/unified-database-schema.md`
- **Sync Engine:** `.claude/instructions/40-sync-engine-implementation.md`

---

## Questions & Answers

**Q: Won't removing seeding break local development?**

A: No. Supabase local seeding (`supabase db reset`) provides all test data. The sync engine populates IndexedDB on first login.

**Q: What about tests that use seedMvpData()?**

A: Tests should use `repository.performInitialSync(testUserId)` instead, which syncs from Supabase just like the real app.

**Q: Can we keep seedCatalog.ts?**

A: Yes, it's a helper for generating SQL. It's not called at runtime, so it's safe to keep.

**Q: What if sync fails?**

A: The sync engine has error handling. If sync fails, user sees error message and can retry. The app doesn't crash.

---

**Status:** Ready for implementation
**Created:** 2025-10-31T13:20
**Author:** Claude Code
**Reviewed By:** (pending)
