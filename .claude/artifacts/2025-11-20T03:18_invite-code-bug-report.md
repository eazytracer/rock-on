---
title: "Band Invite Code Bug Report & Root Cause Analysis"
created: 2025-11-20T03:18
status: Active Bug Report
severity: Critical
prompt: "User reported bugs with invite code functionality: codes created on mobile not appearing in Supabase, codes in Supabase showing as invalid when joining, no network traffic when attempting to join"
---

# Band Invite Code Bug Report & Root Cause Analysis

## Executive Summary

**CRITICAL BUGS IDENTIFIED:**
1. ❌ **Invite codes sync via queue (not direct)** - Code creation may silently fail to reach Supabase
2. ❌ **Silent fallback on validation failures** - No visible errors when Supabase lookups fail
3. ⚠️ **Sync queue lacks user visibility** - Failed syncs are invisible to users
4. ⚠️ **Invite codes shouldn't be in IndexedDB** - Join band is online-only, shouldn't use local storage

## User-Reported Symptoms

1. Created invite code on phone → **Code never appeared in Supabase**
2. Regenerated code on PC → **Did not show phone's code** (expected, since it wasn't in Supabase)
3. Used PC-generated code to join as another user → **"Code doesn't exist" error**
4. Verified code EXISTS in Supabase (via dashboard)
5. **No network traffic or console messages** when attempting to join

## Root Cause Analysis

### BUG #1: Invite Code Creation Uses Async Queue (Not Direct Sync)

**Location:** `src/services/data/SyncRepository.ts:409-420`

```typescript
async addInviteCode(inviteCode: InviteCode): Promise<InviteCode> {
  // 1. Write to local first (instant response)
  const created = await this.local.addInviteCode(inviteCode)

  // 2. Queue for immediate sync to Supabase
  await this.syncEngine.queueCreate('invite_codes', created)
  if (this.isOnline) {
    this.syncEngine.syncNow()  // ⚠️ ASYNC - doesn't wait!
  }

  return created  // ⚠️ Returns before Supabase sync completes!
}
```

**Flow:**
```
User clicks "Generate Code"
    ↓
BandMembershipService.createInviteCode()
    ↓
repository.addInviteCode(inviteCode)  ← Uses SyncRepository
    ↓
├─→ LocalRepository.addInviteCode()  ← Writes to IndexedDB ✅
├─→ syncEngine.queueCreate()         ← Adds to sync queue
├─→ syncEngine.syncNow()              ← ASYNC (doesn't wait)
└─→ RETURN inviteCode                ← UI shows code immediately

Later (async):
syncEngine.pushQueuedChanges()
    ↓
executeSyncOperation('invite_codes', 'create', data)
    ↓
remote.addInviteCode(data)  ← May fail silently!
```

**Problems:**
- ❌ Code appears in UI immediately (from IndexedDB)
- ❌ Supabase sync happens asynchronously
- ❌ If sync fails (network error, RLS policy issue, etc.), user never knows
- ❌ Code exists locally but NOT in cloud → other users can't see it
- ❌ Sync queue failures are logged to console but not shown to user

**Evidence:**
- User created code on phone (saved to IndexedDB ✅)
- Sync queue failed or didn't complete (never reached Supabase ❌)
- PC couldn't see code (not in Supabase)

### BUG #2: Validation Has Silent Fallback (No Visible Errors)

**Location:** `src/services/data/SyncRepository.ts:397-407`

```typescript
async getInviteCodeByCode(code: string): Promise<InviteCode | null> {
  // CRITICAL: Must query Supabase for multi-user validation
  if (this.isOnline && this.remote) {
    try {
      return await this.remote.getInviteCodeByCode(code)
    } catch (error) {
      console.warn('[SyncRepository] Remote fetch failed, using local:', error)
      // ⚠️ Falls back to IndexedDB silently!
    }
  }
  return this.local.getInviteCodeByCode(code)
}
```

**Location:** `src/services/BandMembershipService.ts:101-106`

```typescript
const validation = await this.validateInviteCode(code)
console.log('[BandMembershipService] Validation result:', validation)

if (!validation.valid || !validation.inviteCode) {
  console.log('[BandMembershipService] Validation failed:', validation.error)
  return { success: false, error: validation.error }
}
```

**Problems:**
- ❌ If Supabase lookup fails, silently checks IndexedDB
- ❌ Errors are logged to console (requires dev tools to see)
- ❌ No toast/alert shown to user when lookup fails
- ❌ User sees "Invalid invite code" but no network activity (lookup failed before HTTP request)

**Why user saw no network traffic:**
1. User entered valid code in Supabase
2. `getInviteCodeByCode()` called Supabase
3. Supabase query succeeded BUT returned null (code exists but RLS policy may have blocked it?)
4. OR: Query threw error → caught by try/catch → fell back to IndexedDB
5. IndexedDB also returned null (code not in local DB)
6. Validation failed with "Invalid invite code"
7. **User never saw the actual Supabase error** (logged to console only)

### BUG #3: Sync Queue Has No User Visibility

**Location:** `src/services/data/SyncEngine.ts:171-214`

```typescript
private async pushQueuedChanges(): Promise<void> {
  // ... for each queued item:
  try {
    await this.executeSyncOperation(item)
    await db.syncQueue.delete(item.id!)  // Success
  } catch (error) {
    console.error(`Failed to sync ${item.table}:`, error)  // ⚠️ Console only!

    // Retry up to 3 times
    if (newRetries >= 3) {
      await db.syncQueue.update(item.id!, {
        status: 'failed',  // ⚠️ Marked as failed but user never notified
        lastError: (error as Error).message
      })
    }
  }
}
```

**Problems:**
- ❌ Queue failures only logged to console
- ❌ No UI indicator for pending/failed syncs
- ❌ User thinks code is created (it's in IndexedDB) but doesn't know sync failed
- ❌ After 3 retries, item marked as "failed" and sits in queue forever

**Evidence:**
Check user's IndexedDB `syncQueue` table for failed items:
```javascript
// In browser console on user's phone:
const db = await window.db;
const failedItems = await db.syncQueue.where('status').equals('failed').toArray();
console.log('Failed sync items:', failedItems);
```

### BUG #4: Architecture Issue - Invite Codes Shouldn't Use IndexedDB

**Opinion:** Invite codes should ONLY exist in Supabase, not IndexedDB.

**Rationale:**
- ✅ **Joining a band is an exclusively online activity** (user's words)
- ✅ Invite codes are cross-user entities (User A creates, User B validates)
- ✅ Validation MUST query Supabase (can't trust local cache)
- ✅ Creation MUST be synchronous to Supabase (can't appear before it's shareable)
- ❌ IndexedDB copy provides no value (offline users can't join anyway)
- ❌ IndexedDB sync adds complexity and failure modes

**Recommended flow:**
```typescript
// Create code (direct to Supabase, no queue)
async createInviteCode(request): Promise<InviteCode> {
  const code = generateCode()

  // Write DIRECTLY to Supabase (no IndexedDB, no queue)
  const created = await this.remote.addInviteCode({...})

  // Show success toast with code
  return created
}

// Validate code (direct from Supabase, no IndexedDB)
async validateInviteCode(code: string): Promise<...> {
  // Query Supabase ONLY (never IndexedDB)
  const inviteCode = await this.remote.getInviteCodeByCode(code)

  if (!inviteCode) {
    return { valid: false, error: 'Invalid invite code' }
  }
  // ... validation logic
}
```

## Verification Steps

### 1. Check Sync Queue for Failed Items

**On user's phone:**
```javascript
// Open browser dev tools → Console
const db = await window.db;

// Check pending items
const pending = await db.syncQueue.where('status').equals('pending').toArray();
console.log('Pending sync items:', pending);

// Check failed items
const failed = await db.syncQueue.where('status').equals('failed').toArray();
console.log('Failed sync items:', failed);

// Check invite_codes specifically
const inviteCodes = await db.syncQueue.where('table').equals('invite_codes').toArray();
console.log('Invite code sync items:', inviteCodes);
```

**Expected findings:**
- Phone likely has a failed/pending `invite_codes` create operation
- `lastError` field should reveal why Supabase sync failed

### 2. Check RLS Policies for Invite Codes

**Location:** `supabase/migrations/20251106000000_baseline_schema.sql:1034-1044`

```sql
-- Can authenticated users SELECT invite codes?
CREATE POLICY "invite_codes_select_authenticated"
  ON public.invite_codes FOR SELECT TO authenticated
  USING (true);  -- ✅ All authenticated users can read

-- Can authenticated users INSERT invite codes?
CREATE POLICY "invite_codes_insert_if_admin"
  ON public.invite_codes FOR INSERT TO authenticated
  WITH CHECK (is_band_admin(invite_codes.band_id, (select auth.uid())));  -- ⚠️ Must be admin

-- Can authenticated users UPDATE invite codes?
CREATE POLICY "invite_codes_update_if_admin"
  ON public.invite_codes FOR UPDATE TO authenticated
  USING (is_band_admin(invite_codes.band_id, (select auth.uid())));  -- ⚠️ Must be admin
```

**Potential issue:**
- User must be a band admin to INSERT invite codes
- If user's membership hasn't synced yet, `is_band_admin()` returns false
- INSERT fails with RLS policy error
- Error is caught by sync queue, logged to console, user never sees it

**Test query (via Supabase SQL Editor):**
```sql
-- Check if user is band admin (replace UUIDs)
SELECT is_band_admin('BAND_UUID', 'USER_UUID');

-- Check invite codes for band
SELECT * FROM invite_codes WHERE band_id = 'BAND_UUID';

-- Check band memberships
SELECT * FROM band_memberships WHERE band_id = 'BAND_UUID';
```

### 3. Check Network Activity When Joining

**In browser dev tools → Network tab:**
1. Enter invite code
2. Click "Join Band"
3. Look for POST/GET requests to Supabase

**Expected:**
- Should see `POST /rest/v1/rpc/increment_invite_code_usage`
- Should see `POST /rest/v1/band_memberships` (if code is valid)
- Should see `GET /rest/v1/invite_codes?code=eq.XXXXX`

**If no network activity:**
- Validation failed before making request
- Check console for logged errors
- Likely: Code lookup returned null, validation failed immediately

### 4. Reproduce Issue (Controlled Test)

**Test Case: Create invite code and verify Supabase sync**

```typescript
// 1. Create invite code
const inviteCode = await BandMembershipService.createInviteCode({
  bandId: 'test-band-id',
  createdBy: currentUserId,
  maxUses: 10
});

console.log('Created code:', inviteCode.code);

// 2. IMMEDIATELY check Supabase (before async sync completes)
const supabaseCode = await supabase
  .from('invite_codes')
  .select('*')
  .eq('code', inviteCode.code)
  .maybeSingle();

console.log('In Supabase:', supabaseCode);
// ⚠️ Likely NULL - sync hasn't completed yet!

// 3. Wait 5 seconds for sync to complete
await new Promise(resolve => setTimeout(resolve, 5000));

// 4. Check again
const supabaseCodeAfterSync = await supabase
  .from('invite_codes')
  .select('*')
  .eq('code', inviteCode.code)
  .maybeSingle();

console.log('In Supabase after sync:', supabaseCodeAfterSync);
// ✅ Should exist now (if sync succeeded)
// ❌ Still null if sync failed
```

## Impact Assessment

**Severity:** 🔴 **CRITICAL** - Core feature completely broken for multi-device/multi-user scenarios

**Affected Users:**
- ✅ Any user creating invite codes on mobile
- ✅ Any user joining a band via invite code
- ✅ Multi-band scenarios (switching between bands)
- ✅ Production users trying to invite band members

**Data Integrity:**
- ⚠️ Invite codes may exist in IndexedDB but not Supabase
- ⚠️ Orphaned codes in local DB (never synced)
- ⚠️ Sync queue may have failed items user doesn't know about

## Recommended Fixes

### Fix #1: Make Invite Code Operations Direct (Bypass Queue)

**Priority:** 🔴 CRITICAL

**Change:** Modify `SyncRepository.addInviteCode()` to write directly to Supabase

```typescript
// src/services/data/SyncRepository.ts

async addInviteCode(inviteCode: InviteCode): Promise<InviteCode> {
  // CRITICAL: Invite codes must sync immediately (not queued)
  // Joining a band is an online-only operation

  if (!this.isOnline || !this.remote) {
    throw new Error('Cannot create invite code while offline. Please check your internet connection.')
  }

  // 1. Create in Supabase FIRST (synchronously)
  const created = await this.remote.addInviteCode(inviteCode)

  // 2. Store in local cache for admins to view
  await this.local.addInviteCode(created).catch(err => {
    console.warn('Failed to cache invite code locally:', err)
    // Non-fatal - code is in Supabase which is what matters
  })

  return created
}
```

**Benefits:**
- ✅ Code appears in UI only AFTER it's in Supabase
- ✅ If Supabase fails, user sees error immediately
- ✅ No silent failures
- ✅ Other users can join immediately

**Breaking Change:**
- ⚠️ Offline users can't create invite codes (but they couldn't join anyway)
- ⚠️ May need loading state while creating code

### Fix #2: Remove Silent Fallback in getInviteCodeByCode

**Priority:** 🔴 CRITICAL

**Change:** Never fall back to IndexedDB for code validation

```typescript
// src/services/data/SyncRepository.ts

async getInviteCodeByCode(code: string): Promise<InviteCode | null> {
  // CRITICAL: Must query Supabase for multi-user validation
  // Never use IndexedDB cache for validation

  if (!this.isOnline || !this.remote) {
    throw new Error('Cannot validate invite code while offline. Please check your internet connection.')
  }

  // Query Supabase ONLY (no fallback)
  return await this.remote.getInviteCodeByCode(code)
}
```

**Benefits:**
- ✅ Validation always uses source of truth (Supabase)
- ✅ Errors are thrown (not silently caught)
- ✅ User sees real error message
- ✅ Network activity is visible

### Fix #3: Add User Visibility for Sync Queue

**Priority:** 🟡 HIGH

**Add sync status indicator to UI:**

```typescript
// src/components/SyncStatusIndicator.tsx

export function SyncStatusIndicator() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  useEffect(() => {
    const unsubscribe = repository.onSyncStatusChange((status) => {
      setSyncStatus(status);
    });
    return unsubscribe;
  }, []);

  if (!syncStatus) return null;

  // Show warning if pending items or failed items
  if (syncStatus.pendingCount > 0 || syncStatus.failedCount > 0) {
    return (
      <div className="sync-status-warning">
        ⚠️ {syncStatus.pendingCount} items syncing, {syncStatus.failedCount} failed
        <button onClick={handleRetrySync}>Retry</button>
      </div>
    );
  }

  return null;
}
```

**Benefits:**
- ✅ Users can see when sync is pending/failing
- ✅ Users can retry failed syncs
- ✅ Prevents "code created but not synced" confusion

### Fix #4: Add E2E Test for Invite Code Sync

**Priority:** 🟢 MEDIUM

**Test:** Verify invite code appears in Supabase before UI returns

```typescript
// tests/e2e/bands/invite-code-sync.spec.ts

test('invite code is immediately available in Supabase after creation', async ({ page }) => {
  const supabase = await getSupabaseAdmin();

  // Create band
  const bandName = `Test Band ${Date.now()}`;
  await createBandViaUI(page, bandName);

  // Navigate to members page and get invite code
  await page.goto('/band-members');
  const inviteCode = await getInviteCodeViaUI(page);

  // CRITICAL: Check Supabase immediately (should exist)
  const { data, error } = await supabase
    .from('invite_codes')
    .select('*')
    .eq('code', inviteCode)
    .maybeSingle();

  expect(error).toBeNull();
  expect(data).toBeTruthy();
  expect(data.code).toBe(inviteCode);
  expect(data.is_active).toBe(true);

  // Verify another user can validate this code
  const validation = await BandMembershipService.validateInviteCode(inviteCode);
  expect(validation.valid).toBe(true);
});

test('failed invite code sync shows user-visible error', async ({ page }) => {
  // TODO: Mock Supabase failure and verify user sees error toast
});
```

## Testing Checklist

After implementing fixes:

### Manual Testing

- [ ] Create invite code → Verify appears in Supabase immediately
- [ ] Create invite code → Copy → Join as different user → Success
- [ ] Create invite code offline → Shows error (not silent failure)
- [ ] Join with valid code → Shows network activity in dev tools
- [ ] Join with invalid code → Shows error message (not just console.log)
- [ ] Check sync queue → No pending/failed invite_codes items

### Automated Testing

- [ ] E2E test: Create code → Verify in Supabase → Join from another user
- [ ] E2E test: Offline code creation shows error
- [ ] E2E test: Invalid code validation shows user-visible error
- [ ] Integration test: Direct Supabase sync (not queued)
- [ ] Unit test: getInviteCodeByCode throws error when offline (no silent fallback)

### Data Cleanup

- [ ] Clear sync queue on all test devices
- [ ] Remove orphaned invite codes from IndexedDB
- [ ] Verify all invite codes in IndexedDB also exist in Supabase

## References

**Code Locations:**
- Invite code creation: `src/services/BandMembershipService.ts:28-52`
- Sync repository: `src/services/data/SyncRepository.ts:409-420`
- Sync queue: `src/services/data/SyncEngine.ts:42-57, 171-214`
- Remote validation: `src/services/data/RemoteRepository.ts:759-774`
- Join flow: `src/services/BandMembershipService.ts:95-175`

**Database:**
- Table: `supabase/migrations/20251106000000_baseline_schema.sql:134-146`
- RLS Policies: `supabase/migrations/20251106000000_baseline_schema.sql:1034-1044`
- Increment function: `supabase/migrations/20251106000000_baseline_schema.sql:857-893`

**Tests:**
- E2E join test: `tests/e2e/auth/join-band.spec.ts`
- Band fixtures: `tests/fixtures/bands.ts`

**Specifications:**
- Database schema: `.claude/specifications/unified-database-schema.md` (no invite_codes section - needs update)

---

**Status:** Ready for implementation
**Next Steps:** Implement Fix #1 and Fix #2 (critical), then Fix #3 (high priority)
