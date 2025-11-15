---
created: 2025-11-11T14:13
type: root-cause-analysis
severity: critical
component: invite-codes, multi-user-sync, database-schema
status: diagnosed
related_files:
  - src/models/BandMembership.ts
  - supabase/migrations/20251106000000_baseline_schema.sql
  - src/services/data/RemoteRepository.ts
  - src/services/BandMembershipService.ts
  - tests/fixtures/bands.ts
bug_report: .claude/bug-reports/2025-11-11_invite-code-join-band-navigation-failure.md
implementation_plan: .claude/plans/invite-codes-sync-fix.md
---

# Root Cause Analysis: Invite Code Join Band Navigation Failure

## Executive Summary

**Problem:** Users cannot join bands via invite codes - page does not navigate after clicking "Join Band" button.

**Root Cause:** **SCHEMA MISMATCH** - The `expires_at` field is defined as `NOT NULL` in Supabase but marked as optional (`expiresAt?: Date`) in TypeScript. When invite codes are created without an expiration date, the Supabase INSERT fails with a NOT NULL constraint violation, causing the entire join flow to fail silently.

**Impact:** CRITICAL - Completely blocks multi-user band invitation functionality

**Fix Complexity:** LOW - Simple schema alignment fix

---

## Root Cause Details

### 1. PRIMARY ROOT CAUSE: Schema Mismatch on `expires_at` Field

#### TypeScript Model Definition
**File:** `src/models/BandMembership.ts:11-21`

```typescript
export interface InviteCode {
  id: string
  bandId: string
  code: string
  createdBy: string
  expiresAt?: Date           // ⚠️ OPTIONAL (undefined allowed)
  maxUses?: number
  currentUses: number
  createdDate: Date
  isActive: boolean
}
```

#### Supabase Schema Definition
**File:** `supabase/migrations/20251106000000_baseline_schema.sql:97-109`

```sql
CREATE TABLE public.invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,  -- ⚠️ NOT NULL (value required)
  max_uses INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  CONSTRAINT invite_code_check CHECK (char_length(code) >= 6),
  CONSTRAINT invite_uses_check CHECK (current_uses <= max_uses)
);
```

**Mismatch:**
- **TypeScript:** `expiresAt?: Date` (optional, can be `undefined`)
- **Supabase:** `expires_at TIMESTAMPTZ NOT NULL` (required, cannot be `NULL`)

---

### 2. Failure Flow Analysis

#### Step-by-Step Breakdown

**1. User 1 Creates Band (AuthPages.tsx:811-815)**
```typescript
const inviteCode = await BandMembershipService.createInviteCode({
  bandId,
  createdBy: user.id,
  maxUses: 999
  // ⚠️ NO expiresAt PROVIDED
})
```

**2. BandMembershipService Creates Invite Code (BandMembershipService.ts:37-47)**
```typescript
const inviteCode: InviteCode = {
  id: crypto.randomUUID(),
  bandId: request.bandId,
  code,
  createdBy: request.createdBy,
  expiresAt: request.expiresAt,  // ⚠️ undefined (not provided in request)
  maxUses: request.maxUses || 10,
  isActive: true,
  currentUses: 0,
  createdDate: new Date()
}
```

**3. Repository Adds to Local IndexedDB (LocalRepository.ts:356-361)**
```typescript
async addInviteCode(inviteCode: InviteCode): Promise<InviteCode> {
  if (!inviteCode.id) {
    inviteCode.id = crypto.randomUUID()
  }
  await db.inviteCodes.add(inviteCode)  // ✅ Works (IndexedDB allows undefined)
  return inviteCode
}
```

**4. SyncRepository Queues for Sync (SyncRepository.ts:365-376)**
```typescript
async addInviteCode(inviteCode: InviteCode): Promise<InviteCode> {
  // 1. Write to local first (instant response)
  const created = await this.local.addInviteCode(inviteCode)  // ✅ Success

  // 2. Queue for immediate sync to Supabase
  await this.syncEngine.queueCreate('invite_codes', created)
  if (this.isOnline) {
    this.syncEngine.syncNow()  // ⚠️ Triggers sync with undefined expiresAt
  }

  return created
}
```

**5. SyncEngine Executes Sync to Supabase (SyncEngine.ts:304-312)**
```typescript
case 'invite_codes':
  switch (operation) {
    case 'create':
      await this.remote.addInviteCode(data)  // ⚠️ Calls RemoteRepository
      break
    // ...
  }
```

**6. RemoteRepository Maps to Supabase Format (RemoteRepository.ts:758-772)**
```typescript
async addInviteCode(inviteCode: InviteCode): Promise<InviteCode> {
  if (!supabase) throw new Error('Supabase client not initialized')

  const supabaseData = this.mapInviteCodeToSupabase(inviteCode)
  // ⚠️ supabaseData = { ..., expires_at: undefined, ... }
  // Since expiresAt is undefined, it's not included in result

  const { data, error } = await supabase
    .from('invite_codes')
    .insert(supabaseData as any)
    .select()
    .single()

  if (error) throw error  // ⚠️ PostgreSQL error: null value in column "expires_at"

  return this.mapInviteCodeFromSupabase(data)
}
```

**7. Mapping Function Skips Undefined Fields (RemoteRepository.ts:862-876)**
```typescript
private mapInviteCodeToSupabase(inviteCode: Partial<InviteCode>): Record<string, any> {
  const result: Record<string, any> = {}

  if (inviteCode.id !== undefined) result.id = inviteCode.id
  if (inviteCode.bandId !== undefined) result.band_id = inviteCode.bandId
  if (inviteCode.code !== undefined) result.code = inviteCode.code
  if (inviteCode.createdBy !== undefined) result.created_by = inviteCode.createdBy
  if (inviteCode.createdDate !== undefined) result.created_date = inviteCode.createdDate
  if (inviteCode.expiresAt !== undefined) result.expires_at = inviteCode.expiresAt
  // ⚠️ If expiresAt is undefined, expires_at is NOT added to result
  // This causes PostgreSQL NOT NULL constraint violation
  if (inviteCode.maxUses !== undefined) result.max_uses = inviteCode.maxUses
  if (inviteCode.currentUses !== undefined) result.current_uses = inviteCode.currentUses
  if (inviteCode.isActive !== undefined) result.is_active = inviteCode.isActive

  return result
}
```

**8. PostgreSQL Rejects Insert**
```sql
ERROR: null value in column "expires_at" of relation "invite_codes" violates not-null constraint
```

**9. Error Propagates Back**
- `RemoteRepository.addInviteCode()` throws error
- `SyncEngine.executeSyncOperation()` catches error (likely logs but doesn't bubble up)
- UI shows success message but invite code is NOT in Supabase
- User 2 tries to join with code → `RemoteRepository.getInviteCodeByCode()` returns `null`
- Validation fails → No error displayed (UI issue) → Page doesn't navigate

---

## Evidence from Codebase

### 1. Invite Code Creation Without expiresAt

**Location:** `src/pages/NewLayout/AuthPages.tsx:811-815`

```typescript
const inviteCode = await BandMembershipService.createInviteCode({
  bandId,
  createdBy: user.id,
  maxUses: 999 // Allow many uses
  // ❌ NO expiresAt PROVIDED - will be undefined
})
```

### 2. Test Fixture Also Has Issues

**Location:** `tests/fixtures/bands.ts:148-158`

```typescript
const { error: inviteError } = await supabase.from('invite_codes').insert({
  id: crypto.randomUUID(),
  code: inviteCode,
  band_id: bandId,
  created_by: band.ownerId,
  created_at: new Date().toISOString(),        // ⚠️ WRONG FIELD NAME (should be created_date)
  expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),  // ✅ Correct
  max_uses: 10,
  current_uses: 0,
  is_active: true,
});
```

**Issues:**
- Uses `created_at` instead of `created_date` (column doesn't exist)
- This means test fixture might also fail when creating bands directly in DB

### 3. Error Handling Gap

**Location:** `src/pages/NewLayout/AuthPages.tsx:881-886`

```typescript
} catch (err) {
  console.error('Error joining band:', err)  // ⚠️ Logs to console only
  setErrors({ inviteCode: 'Failed to join band. Please try again.' })  // Generic error
  setLoading(false)
}
```

**Issues:**
- Error message is generic, doesn't indicate root cause
- Actual Supabase error is hidden in console
- User sees "Failed to join band" instead of "Invite code not found"

---

## Why This Wasn't Caught Earlier

### 1. Local Development Works (Sometimes)
- IndexedDB allows `undefined` for optional fields
- If testing with only local IndexedDB (no Supabase sync), invite codes work
- Problem only surfaces when Supabase sync is enabled

### 2. TypeScript Doesn't Catch Runtime Errors
- TypeScript allows `expiresAt?: Date` (optional)
- Type system permits `undefined` values
- PostgreSQL constraint is runtime validation, not compile-time

### 3. Error Handling Swallows Errors
- Sync errors may be logged but not surfaced to UI
- Generic "Failed to join band" message doesn't indicate schema issue
- E2E test times out waiting for navigation instead of showing actual error

### 4. Test Fixture Has Different Bug
- Test fixture in `bands.ts` uses `created_at` instead of `created_date`
- This might mask the `expires_at` issue if test fixture was used for testing

---

## Impact Assessment

### Affected User Flows
1. ✅ **Band Creation** - Works (IndexedDB write succeeds)
2. ❌ **Invite Code Sync** - Fails (Supabase INSERT fails)
3. ❌ **Multi-User Join** - Fails (invite code not in Supabase)
4. ❌ **Cross-Device Join** - Fails (invite code only in creator's IndexedDB)
5. ✅ **Single-Device Testing** - Works (if only using IndexedDB)

### Data Consistency Issues
- **IndexedDB:** Contains invite codes with `expiresAt: undefined`
- **Supabase:** Missing invite codes (INSERT failed)
- **Result:** Database is out of sync, breaking multi-user functionality

---

## Recommended Fixes (Priority Order)

### FIX 1: Schema Alignment - Make expiresAt Optional in Database (RECOMMENDED)

**Rationale:** Invite codes should be allowed to have no expiration (permanent codes)

**Change 1:** Update Supabase Schema
**File:** `supabase/migrations/20251106000000_baseline_schema.sql:103`

```sql
-- BEFORE:
expires_at TIMESTAMPTZ NOT NULL,

-- AFTER:
expires_at TIMESTAMPTZ,  -- Nullable, allows permanent codes
```

**Change 2:** Update Default Value Logic
**File:** `src/services/data/RemoteRepository.ts:862-876`

No changes needed - mapping function already handles optional fields correctly.

**Pros:**
- ✅ Simplest fix
- ✅ Makes sense semantically (some codes never expire)
- ✅ No code changes required (only migration)
- ✅ Backward compatible (existing NULL values allowed)

**Cons:**
- ⚠️ Requires migration deployment
- ⚠️ Need to reset local Supabase: `supabase db reset`

---

### FIX 2: Default Expiration Date (ALTERNATIVE)

**Rationale:** If business logic requires all codes to expire, set a default

**Change 1:** Add Default in BandMembershipService
**File:** `src/services/BandMembershipService.ts:42`

```typescript
const inviteCode: InviteCode = {
  id: crypto.randomUUID(),
  bandId: request.bandId,
  code,
  createdBy: request.createdBy,
  expiresAt: request.expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Default: 1 year
  maxUses: request.maxUses || 10,
  isActive: true,
  currentUses: 0,
  createdDate: new Date()
}
```

**Change 2:** Update TypeScript Model
**File:** `src/models/BandMembership.ts:16`

```typescript
export interface InviteCode {
  id: string
  bandId: string
  code: string
  createdBy: string
  expiresAt: Date  // ⚠️ Remove optional (make required)
  maxUses?: number
  currentUses: number
  createdDate: Date
  isActive: boolean
}
```

**Pros:**
- ✅ No schema migration needed
- ✅ Enforces expiration policy
- ✅ Fixes issue at source

**Cons:**
- ⚠️ Requires code changes in multiple places
- ⚠️ Less flexible (can't create permanent codes)
- ⚠️ Need to update all callers to provide expiresAt

---

### FIX 3: Fix Test Fixture Bug

**File:** `tests/fixtures/bands.ts:153`

**Change:**
```typescript
// BEFORE:
created_at: new Date().toISOString(),  // ❌ Wrong field name

// AFTER:
created_date: new Date().toISOString(),  // ✅ Correct field name
```

This fix is required regardless of which primary fix is chosen.

---

### FIX 4: Improve Error Handling

**File:** `src/pages/NewLayout/AuthPages.tsx:881-886`

**Change:**
```typescript
} catch (err) {
  console.error('Error joining band:', err)

  // Extract meaningful error message
  const errorMessage = err instanceof Error
    ? err.message
    : 'Failed to join band. Please try again.'

  // Show specific error (e.g., "Invite code not found")
  setErrors({ inviteCode: errorMessage })
  setLoading(false)
}
```

**Also Add Logging in SyncEngine** (to surface Supabase errors)
**File:** `src/services/data/SyncEngine.ts` (around line 308)

```typescript
case 'invite_codes':
  switch (operation) {
    case 'create':
      try {
        await this.remote.addInviteCode(data)
      } catch (error) {
        console.error('[SyncEngine] Failed to sync invite code:', error)
        throw error  // Re-throw to trigger retry logic
      }
      break
    // ...
  }
```

---

## Verification Steps (After Fix)

### 1. Schema Verification
```sql
-- In Supabase SQL Editor
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'invite_codes' AND column_name = 'expires_at';

-- Should return: is_nullable = 'YES'
```

### 2. Manual Testing
```bash
# 1. Reset local Supabase
supabase db reset

# 2. Start dev server
npm run dev

# 3. Test flow:
#    - User 1: Create band
#    - Verify invite code in both IndexedDB and Supabase
#    - User 2 (different browser): Join with code
#    - Verify navigation to /songs
#    - Verify both users see each other in band members
```

### 3. Database Validation
```sql
-- After User 1 creates band
SELECT code, band_id, created_by, expires_at, is_active
FROM invite_codes
WHERE band_id = 'USER1_BAND_ID';

-- Should return 1 row with code, expires_at = NULL (if Fix 1) or future date (if Fix 2)
```

### 4. E2E Test
```bash
npm run test:e2e -- tests/e2e/auth/join-band.spec.ts --project=chromium

# Should pass all tests
```

---

## Updated Implementation Plan Priority

**BEFORE (from original plan):**
1. ~~Add to IDataRepository~~ ✅ DONE
2. ~~LocalRepository implementation~~ ✅ DONE
3. ~~RemoteRepository implementation~~ ✅ DONE (but has bug)
4. ~~SyncRepository implementation~~ ✅ DONE
5. ~~Update SyncEngine~~ ✅ DONE
6. ~~Update BandMembershipService~~ ✅ DONE (but has bug)
7. ~~Update AuthPages~~ ✅ DONE (but has bug)
8. Unit tests
9. Manual testing
10. E2E testing

**NOW (updated priority):**
1. **FIX 1: Schema Migration** - Make `expires_at` nullable ⚡ CRITICAL
2. **FIX 3: Test Fixture** - Fix `created_at` → `created_date` bug ⚡ CRITICAL
3. **FIX 4: Error Handling** - Surface Supabase errors properly 🔧 HIGH
4. **Verification** - Manual testing with 2 browsers 🧪 HIGH
5. **E2E Tests** - Ensure tests pass 🧪 HIGH
6. **Unit Tests** - Add test coverage for error cases 📝 MEDIUM

---

## Success Criteria (Updated)

### Must Pass
- [x] Repository pattern implemented (DONE)
- [ ] Schema mismatch resolved (BLOCKED - need migration)
- [ ] Invite codes sync to Supabase successfully
- [ ] User 2 can retrieve User 1's invite code from Supabase
- [ ] User 2 can join User 1's band via invite code
- [ ] Page navigates to /songs after successful join
- [ ] E2E test passes consistently

### Performance Targets (Still Valid)
- Local write: < 50ms (instant UI update)
- Sync to Supabase: ~300ms average latency
- Validation query: < 200ms (direct Supabase query)

---

## Timeline

**Estimated Fix Time:**
- Schema migration: 15 minutes
- Test fixture fix: 5 minutes
- Error handling improvement: 20 minutes
- Testing & verification: 30 minutes

**Total:** ~70 minutes (1.2 hours)

---

## Related Documentation

**Must Read:**
- `.claude/bug-reports/2025-11-11_invite-code-join-band-navigation-failure.md` - Original bug report
- `.claude/plans/invite-codes-sync-fix.md` - Implementation plan (needs update)
- `.claude/specifications/unified-database-schema.md` - Schema reference

**Related Files:**
- `src/models/BandMembership.ts:16` - InviteCode model (expiresAt optional)
- `supabase/migrations/20251106000000_baseline_schema.sql:103` - Schema (expires_at NOT NULL)
- `src/services/data/RemoteRepository.ts:862-876` - Field mapping function
- `src/services/BandMembershipService.ts:27-51` - Invite code creation
- `tests/fixtures/bands.ts:148-158` - Test fixture with bug

---

## Conclusion

The invite code join failure is caused by a **schema mismatch** between the TypeScript model (where `expiresAt` is optional) and the Supabase schema (where `expires_at` is `NOT NULL`).

When invite codes are created without an expiration date, the sync to Supabase fails with a constraint violation. This causes the invite code to exist only in the creator's IndexedDB, making it impossible for other users to join the band.

**Recommended Solution:** Make `expires_at` nullable in the Supabase schema (Fix 1), as this is the simplest fix and aligns with the semantic meaning of "optional expiration." This requires a single migration change and no code modifications.

**Critical Next Step:** Create a new migration to alter the `invite_codes` table and make `expires_at` nullable, then test the complete flow.

---

**Status:** Root cause identified, fix proposed, awaiting implementation
**Blocker:** Schema migration required to proceed
**Last Updated:** 2025-11-11T14:13
