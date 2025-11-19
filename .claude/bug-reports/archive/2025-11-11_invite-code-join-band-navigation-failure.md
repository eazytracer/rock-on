---
created: 2025-11-11T13:40
type: bug-report
severity: high
component: invite-codes, multi-user-sync
status: debugging-required
related_files:
  - src/services/BandMembershipService.ts
  - src/pages/NewLayout/AuthPages.tsx
  - src/services/data/SyncRepository.ts
  - tests/e2e/auth/join-band.spec.ts
---

# Invite Code Join Band Navigation Failure

## Executive Summary

Implemented invite code repository pattern integration to enable multi-user band invitations via Supabase sync. The invite code creation and retrieval now works correctly, but the join band flow fails to navigate after clicking "Join Band" button in E2E tests.

**Impact:** Users cannot join bands via invite codes in multi-user scenarios (E2E test environment).

**Priority:** High - blocks multi-user collaboration feature

## Implemented Changes

### 1. Repository Pattern Integration (✅ COMPLETE)

Added invite code support to the repository pattern across all layers:

#### IDataRepository Interface
- `getInviteCodes(bandId)` - Get all codes for a band
- `getInviteCode(id)` - Get specific code by ID
- `getInviteCodeByCode(code)` - Get code by code string (for validation)
- `addInviteCode(inviteCode)` - Create new code
- `updateInviteCode(id, updates)` - Update code (e.g., increment currentUses)
- `deleteInviteCode(id)` - Delete/deactivate code

#### LocalRepository Implementation
- Uses Dexie/IndexedDB `db.inviteCodes` table
- Case-insensitive code lookup (`code.toUpperCase()`)
- Auto-generates UUID for `id` if not provided

#### RemoteRepository Implementation
- Supabase queries with field mapping
- camelCase ↔ snake_case conversion:
  - `bandId` ↔ `band_id`
  - `createdBy` ↔ `created_by`
  - `createdDate` ↔ `created_date`
  - `expiresAt` ↔ `expires_at`
  - `maxUses` ↔ `max_uses`
  - `currentUses` ↔ `current_uses`
  - `isActive` ↔ `is_active`

#### SyncRepository Implementation
- **`getInviteCodes(bandId)`**: Local-first (immediate consistency for own codes)
- **`getInviteCodeByCode(code)`**: Cloud-first (multi-user validation)
- All writes: Local-first with immediate sync queue

#### SyncEngine Updates
- Added invite_codes to `executeSyncOperation()`
- Added invite_codes to `performInitialSync()`
- Added `pullInviteCodes()` for incremental sync

### 2. Service Layer Refactoring (✅ COMPLETE)

#### BandMembershipService
**Before:** Direct database queries mixing `db.inviteCodes` and manual Supabase calls
**After:** Uses repository pattern exclusively

Key changes:
- `createInviteCode()` → uses `repository.addInviteCode()`
- `getBandInviteCodes()` → uses `repository.getInviteCodes()`
- `validateInviteCode()` → simplified from 56 lines to 20 lines
- Removed manual Supabase queries
- Removed duplicate field mapping

### 3. Frontend Integration (✅ COMPLETE)

#### AuthPages.tsx - handleCreateBand()
**Before:** Manual invite code creation via `db.inviteCodes.add()`
**After:** Uses `BandMembershipService.createInviteCode()`

```typescript
// Lines 811-815 (after refactor)
const inviteCode = await BandMembershipService.createInviteCode({
  bandId,
  createdBy: user.id,
  maxUses: 999
})
```

#### AuthPages.tsx - handleJoinBand()
**Before:**
- Queried `db.inviteCodes` directly (line 853)
- Only checked local IndexedDB (doesn't work for multi-user)
- Manual membership creation via `db.bandMemberships.add()` (line 889)
- Manual usage increment via `db.inviteCodes.update()` (line 900)

**After:**
- Uses `BandMembershipService.joinBandWithCode()` (line 853)
- Cloud-first validation via repository pattern
- Single service call handles all operations

**Lines reduced:** 92 → 48 (52% reduction)

## What's Working ✅

### 1. Invite Code Display (FIXED)
**Issue:** Band Members page showed "No active code" instead of actual invite code
**Root Cause:** `SyncRepository.getInviteCodes()` used cloud-first read, but sync hadn't completed
**Fix:** Changed to local-first read (line 335-338 in SyncRepository.ts)
**Verification:** Test output shows `Got invite code: KMC2QS` ✅

### 2. TypeScript Compilation
**Status:** Clean (only 1 pre-existing unrelated error in `debugRealtime.ts:127`)
**Suppressions:** 2 `@ts-expect-error` comments for Supabase type generation issues (documented)

### 3. Code Architecture
**Status:** Repository pattern correctly implemented across all layers
**Pattern:**
```
User Action
  ↓
Service Layer (BandMembershipService)
  ↓
Sync Layer (SyncRepository)
  ↓
Local Layer (LocalRepository - IndexedDB)
  ↓
Remote Layer (RemoteRepository - Supabase)
```

## What's Not Working ❌

### E2E Test Failure: Join Band Navigation

**Test:** `tests/e2e/auth/join-band.spec.ts:25` - "new user can join existing band via invite code"

**Symptom:**
- User 1 creates band successfully
- User 1's invite code retrieved successfully: `KMC2QS`
- User 2 enters invite code: `KMC2QS`
- User 2 clicks "Join Band" button
- **Page does not navigate** (stays on `/get-started`)
- Test times out waiting for navigation to `/songs`, `/band-members`, or `/bands`

**Test Output:**
```
Got invite code: KMC2QS
[joinBandViaUI] Starting join band flow...
[joinBandViaUI] Navigated to /get-started
[joinBandViaUI] Found invite code input and join button
[joinBandViaUI] Filled invite code: KMC2QS
[joinBandViaUI] URL before click: http://localhost:5173/get-started
[joinBandViaUI] Clicked join button, waiting for navigation...
[joinBandViaUI] URL after click: http://localhost:5173/get-started  ← STUCK HERE

TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
```

**Expected Behavior:**
After clicking "Join Band", should navigate to `/songs` (line 879 in AuthPages.tsx)

## Root Cause Analysis

### Hypothesis 1: Silent JavaScript Error
**Likelihood:** High
**Evidence:**
- Page doesn't navigate (suggests code execution stopped)
- No error toast displayed to user
- Test shows button was clicked successfully

**Investigation Needed:**
1. Check Playwright console logs in test output
2. Check error screenshots for error messages
3. Add console.log statements to `handleJoinBand()` and `BandMembershipService.joinBandWithCode()`

### Hypothesis 2: Supabase Connection Failure
**Likelihood:** Medium
**Evidence:**
- Multi-user flow requires Supabase (User 2 needs to fetch User 1's invite code)
- Local Supabase must be running for E2E tests

**Investigation Needed:**
1. Verify Supabase is running during E2E tests
2. Check if `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in test environment
3. Add error handling logging to `RemoteRepository.getInviteCodeByCode()`

### Hypothesis 3: Repository Method Returns Null/Undefined
**Likelihood:** Medium
**Evidence:**
- `BandMembershipService.joinBandWithCode()` returns `{success: false, error: string}` on failure
- `handleJoinBand()` checks `!result.success` (line 855)
- But error might not be displayed if error state update fails

**Investigation Needed:**
1. Check if error is being set but not rendered
2. Add console.log before setting error state (line 857)
3. Verify error toast/message appears in test screenshots

### Hypothesis 4: Band Not Synced to Supabase
**Likelihood:** Low
**Evidence:**
- User 1 successfully creates band
- Invite code shows correct format and is stored
- But User 2's query to Supabase might not find the band

**Investigation Needed:**
1. Verify band is synced to Supabase before User 2 joins
2. Check `SyncEngine.syncNow()` is called after band creation
3. Add wait/retry logic in test after band creation

## Code Locations

### Key Files Modified
1. **src/services/data/IDataRepository.ts** (lines 150-168)
   - Interface with 6 invite code methods

2. **src/services/data/LocalRepository.ts** (lines 280-330)
   - IndexedDB implementation

3. **src/services/data/RemoteRepository.ts** (lines 730-790)
   - Supabase implementation + field mapping

4. **src/services/data/SyncRepository.ts** (lines 334-385)
   - Sync coordination
   - ⚠️ Line 335-338: Changed `getInviteCodes()` to local-first

5. **src/services/data/SyncEngine.ts** (lines 500-530, 850-880, 1200-1230)
   - Added invite_codes to sync operations

6. **src/services/BandMembershipService.ts** (lines 31-51, 56-59, 64-89)
   - Refactored to use repository pattern
   - Simplified validation logic

7. **src/pages/NewLayout/AuthPages.tsx** (lines 810-815, 838-886)
   - `handleCreateBand()`: Uses service for code creation
   - `handleJoinBand()`: Refactored to use service (⚠️ FAILS HERE)

### Debug Points

Add logging at these locations:

```typescript
// src/pages/NewLayout/AuthPages.tsx:853
const result = await BandMembershipService.joinBandWithCode(user.id, inviteCode)
console.log('[handleJoinBand] Service result:', result)  // ADD THIS

// src/services/BandMembershipService.ts:98
const validation = await this.validateInviteCode(code)
console.log('[joinBandWithCode] Validation result:', validation)  // ADD THIS

// src/services/BandMembershipService.ts:70
const inviteCode = await repository.getInviteCodeByCode(code)
console.log('[validateInviteCode] Found code:', inviteCode)  // ADD THIS

// src/services/data/RemoteRepository.ts:738
const { data, error } = await supabase.from('invite_codes')...
console.log('[RemoteRepository] Query result:', { data, error })  // ADD THIS
```

## Test Environment Details

**Test:** E2E test with 2 separate browser contexts (simulating 2 users)
**Browser:** Chromium (Playwright)
**Local Supabase:** Required (not verified if running)
**Dev Server:** Running on `http://localhost:5173`

**Test Accounts:**
- User 1: Creates band + invite code
- User 2: Joins band via invite code (fails here)

## Reproduction Steps

1. Start local Supabase: `supabase start`
2. Start dev server: `npm run dev`
3. Run E2E test: `npm run test:e2e -- tests/e2e/auth/join-band.spec.ts --project=chromium`
4. Observe test failure at line 102 in `tests/fixtures/bands.ts`

## Artifacts

**Test Output Files:**
- `test-results/auth-join-band-Join-Existi-c5454-isting-band-via-invite-code-chromium/test-failed-1.png`
- `test-results/auth-join-band-Join-Existi-c5454-isting-band-via-invite-code-chromium/test-failed-2.png`
- `test-results/auth-join-band-Join-Existi-c5454-isting-band-via-invite-code-chromium/error-context.md`

**Related Implementation Plan:**
- `.claude/plans/invite-codes-sync-fix.md`

**Progress Report:**
- `.claude/artifacts/2025-11-11T05:21_invite-codes-sync-implementation-progress.md`

## Next Steps for Debugging Team

### Immediate Actions (Priority 1)
1. **Add debug logging** to the 4 locations listed above
2. **Check browser console errors** in test screenshots
3. **Verify Supabase is running** during E2E tests
4. **Check error state rendering** - is error message shown but not visible?

### Follow-up Actions (Priority 2)
5. **Test manually** with 2 browser windows (Chrome Incognito + Firefox)
6. **Verify band sync timing** - add wait after band creation in test
7. **Check network tab** in Playwright trace for failed Supabase requests
8. **Add retry logic** to handle sync delays

### Long-term (Priority 3)
9. **Unit test** `BandMembershipService.joinBandWithCode()` with mocked repository
10. **Integration test** repository pattern with real Supabase (test DB)
11. **E2E test** with explicit sync wait/verify steps

## Success Criteria

- [ ] User 2 can join User 1's band via invite code
- [ ] Page navigates to `/songs` after successful join
- [ ] Both users see each other in band members list
- [ ] Invite code usage count increments correctly
- [ ] E2E test passes consistently

## User Question Answered

**Q:** "should bands start with a code, or will they have to click regenerate to make one the first time?"

**A:** Bands automatically start with an invite code when created. The code is generated immediately via `BandMembershipService.createInviteCode()` during band creation (AuthPages.tsx:810-815). Users do NOT need to click "regenerate" - the code is there from the start.

The issue in the screenshot ("NO ACTIVE CODE") was a timing bug where the UI tried to display the code before it loaded from IndexedDB. This has been fixed by changing `getInviteCodes()` to use local-first reads.

## Contact

**Implementer:** Claude (AI Assistant)
**Date:** 2025-11-11
**Session:** Invite code repository pattern integration
**Related Ticket:** `.claude/plans/invite-codes-sync-fix.md`
