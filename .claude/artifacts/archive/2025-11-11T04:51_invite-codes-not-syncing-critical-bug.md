---
created: 2025-11-11T04:51
type: critical-bug-report
status: urgent
priority: critical
severity: blocks-multi-user-functionality
related-tests: tests/e2e/auth/join-band.spec.ts
discovered-by: E2E test failure + database investigation
---

# CRITICAL BUG: Invite Codes Not Syncing to Supabase

## Executive Summary

**🚨 SEVERITY: CRITICAL - Multi-user band joining is completely broken**

Invite codes are only saved to local IndexedDB and never synced to Supabase, making it impossible for users to join bands via invite codes. This completely breaks the core multi-user collaboration feature of Rock-On.

## Impact

- ❌ **User 1** creates a band → Invite code saved to IndexedDB only
- ❌ **User 2** tries to join with invite code → Code doesn't exist in Supabase
- ❌ Join validation fails silently, no navigation occurs
- ❌ E2E tests failing for `join-band.spec.ts`
- ❌ "Regenerate Code" button appears non-functional (generates local-only codes)
- ❌ Multi-user bands cannot be created via the application

## Database Evidence

**Test Case:** E2E test creates band "Multi User Band 1762827178102" and displays invite code `ROCK8388`

**Database Query Results:**
```sql
-- Band was created successfully ✅
SELECT name FROM bands WHERE name = 'Multi User Band 1762827178102';
=> Found: "Multi User Band 1762827178102" (created 2025-11-11 02:12:58)

-- Invite code does NOT exist ❌
SELECT code FROM invite_codes WHERE code = 'ROCK8388';
=> 0 rows (code never written to Supabase)

-- Only 1 invite code exists in entire database
SELECT COUNT(*) FROM invite_codes;
=> 1 row (ROCK2025 from manual testing)
```

## Root Cause Analysis

### Problem 1: Invite Codes Not in Repository Pattern

Invite codes are completely missing from the sync infrastructure:

**File:** `src/services/data/IDataRepository.ts`

```typescript
export interface IDataRepository {
  // ========== SONGS ==========
  getSongs(filter?: SongFilter): Promise<Song[]>
  // ... songs methods

  // ========== BANDS ==========
  getBands(filter?: BandFilter): Promise<Band[]>
  // ... bands methods

  // ========== SETLISTS ==========
  // ... setlists methods

  // ========== PRACTICE SESSIONS ==========
  // ... practice sessions methods

  // ========== SHOWS ==========
  // ... shows methods

  // ========== BAND MEMBERSHIPS ==========
  getBandMemberships(bandId: string): Promise<BandMembership[]>
  // ... band memberships methods

  // ❌ NO INVITE CODES SECTION - COMPLETELY MISSING
}
```

### Problem 2: Direct IndexedDB Writes Without Supabase Sync

**File:** `src/pages/NewLayout/AuthPages.tsx:813-822`

```typescript
const handleCreateBand = async () => {
  // ... create band logic

  // Generate initial invite code
  const randomDigits = Math.floor(1000 + Math.random() * 9000)
  const generatedCode = 'ROCK' + randomDigits

  // ❌ ONLY writes to IndexedDB, NEVER to Supabase
  await db.inviteCodes.add({
    id: crypto.randomUUID(),
    bandId,
    code: generatedCode,
    createdBy: user.id,
    currentUses: 0,
    maxUses: 999,
    createdDate: new Date(),
    isActive: true
  })
  // ❌ No Supabase sync follows
}
```

**File:** `src/services/BandMembershipService.ts:29-53`

```typescript
static async createInviteCode(request: CreateInviteCodeRequest): Promise<InviteCode> {
  const code = this.generateCode()

  // Check if code exists (in IndexedDB only)
  const existingCode = await db.inviteCodes.where('code').equals(code).first()
  if (existingCode) {
    return this.createInviteCode(request) // Retry
  }

  const inviteCode: InviteCode = {
    id: crypto.randomUUID(),
    bandId: request.bandId,
    code,
    createdBy: request.createdBy,
    expiresAt: request.expiresAt,
    maxUses: request.maxUses || 10,
    isActive: true,
    currentUses: 0,
    createdDate: new Date()
  }

  // ❌ ONLY writes to IndexedDB
  await db.inviteCodes.add(inviteCode)
  // ❌ No Supabase sync

  return inviteCode
}
```

### Problem 3: Validation Queries Supabase First

**File:** `src/services/BandMembershipService.ts:66-121`

```typescript
static async validateInviteCode(code: string): Promise<{
  valid: boolean
  inviteCode?: InviteCode
  error?: string
}> {
  const upperCode = code.toUpperCase()
  let inviteCode: InviteCode | null = null

  // ✅ Queries Supabase FIRST (correct for multi-user validation)
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('invite_codes')
        .select('*')
        .eq('code', upperCode)
        .eq('is_active', true)
        .single()

      if (!error && data) {
        // Map Supabase data to InviteCode model
        inviteCode = { /* ... */ }
      }
    }
  } catch (error) {
    console.warn('Failed to query Supabase, falling back to IndexedDB:', error)
  }

  // ❌ Fallback to IndexedDB (only works for creator, not other users)
  if (!inviteCode) {
    inviteCode = await db.inviteCodes.where('code').equals(upperCode).first() || null
  }

  // ❌ Code doesn't exist in Supabase → validation fails for User 2
  if (!inviteCode) {
    return { valid: false, error: 'Invalid invite code' }
  }

  return { valid: true, inviteCode }
}
```

**Why This Design Fails:**
1. User 1 creates band → Invite code saved to User 1's IndexedDB only
2. User 1 sees invite code `ROCK8388` in UI (from local IndexedDB)
3. User 2 (different browser/device) tries to join with `ROCK8388`
4. `validateInviteCode()` queries Supabase → Not found (never synced)
5. Fallback to User 2's IndexedDB → Not found (only in User 1's browser)
6. Validation fails → Join silently fails, no navigation

### Problem 4: Realtime Sync Doesn't Include Invite Codes

**File:** `src/services/data/RealtimeManager.ts:221-233`

```typescript
private async subscribeToBand(_userId: string, bandId: string): Promise<void> {
  // Subscribe to songs
  await this.subscribeToTable('songs', bandId, this.handleSongChange.bind(this))

  // Subscribe to setlists
  await this.subscribeToTable('setlists', bandId, this.handleSetlistChange.bind(this))

  // Subscribe to shows
  await this.subscribeToTable('shows', bandId, this.handleShowChange.bind(this))

  // Subscribe to practice sessions
  await this.subscribeToTable('practice_sessions', bandId, this.handlePracticeSessionChange.bind(this))

  // ❌ NO invite_codes subscription
}
```

## Complete Data Flow Analysis

### Current (Broken) Flow:

```
User 1: Create Band
├─ POST bands → Supabase ✅
├─ POST band_memberships → Supabase ✅ (via repository)
└─ db.inviteCodes.add() → IndexedDB ONLY ❌

User 2: Join Band
├─ Input code: "ROCK8388"
├─ validateInviteCode()
│  ├─ Query Supabase: SELECT * FROM invite_codes WHERE code = 'ROCK8388'
│  │  └─ Result: 0 rows ❌
│  └─ Fallback to User 2's IndexedDB
│     └─ Result: Not found ❌
└─ Validation fails → No navigation, silent failure
```

### Expected (Working) Flow:

```
User 1: Create Band
├─ POST bands → Supabase ✅
├─ POST band_memberships → Supabase ✅
└─ POST invite_codes → Supabase ✅ (MISSING)
   └─ Sync to local IndexedDB ✅

User 2: Join Band
├─ Input code: "ROCK8388"
├─ validateInviteCode()
│  ├─ Query Supabase: SELECT * FROM invite_codes WHERE code = 'ROCK8388'
│  │  └─ Result: Found ✅
│  └─ Return valid invite code ✅
└─ Create membership → Redirect to /songs ✅
```

## Files Requiring Changes

### 1. Add Invite Codes to Repository Interface

**File:** `src/services/data/IDataRepository.ts`

Add new section:
```typescript
// ========== INVITE CODES ==========
getInviteCodes(bandId: string): Promise<InviteCode[]>
getInviteCode(id: string): Promise<InviteCode | null>
getInviteCodeByCode(code: string): Promise<InviteCode | null>
addInviteCode(inviteCode: InviteCode): Promise<InviteCode>
updateInviteCode(id: string, updates: Partial<InviteCode>): Promise<InviteCode>
deleteInviteCode(id: string): Promise<void>
```

### 2. Implement Repository Methods

**Files:**
- `src/services/data/LocalRepository.ts` - Add invite code methods (IndexedDB)
- `src/services/data/RemoteRepository.ts` - Add invite code methods (Supabase)
- `src/services/data/SyncRepository.ts` - Inherit from interface

**Field Mappings (camelCase ↔ snake_case):**
```typescript
// Application (IndexedDB) → Supabase
{
  id: string              → id
  bandId: string          → band_id
  code: string            → code
  createdBy: string       → created_by
  createdDate: Date       → created_date
  expiresAt?: Date        → expires_at
  maxUses: number         → max_uses
  currentUses: number     → current_uses
  isActive: boolean       → is_active
}
```

### 3. Update BandMembershipService to Use Repository

**File:** `src/services/BandMembershipService.ts`

```typescript
// Change line 51 from:
await db.inviteCodes.add(inviteCode)

// To:
await repository.addInviteCode(inviteCode)
```

```typescript
// Change line 162-164 from:
await db.inviteCodes.update(inviteCode.id, {
  currentUses: inviteCode.currentUses + 1
})

// To:
await repository.updateInviteCode(inviteCode.id, {
  currentUses: inviteCode.currentUses + 1
})
```

```typescript
// Change line 59 from:
return db.inviteCodes.where('bandId').equals(bandId).toArray()

// To:
return repository.getInviteCodes(bandId)
```

```typescript
// Change validateInviteCode() to query repository instead of direct Supabase:
// This will use RemoteRepository if online, LocalRepository if offline
const inviteCode = await repository.getInviteCodeByCode(upperCode)
```

### 4. Update Band Creation Code

**File:** `src/pages/NewLayout/AuthPages.tsx:813-822`

```typescript
// Change from:
await db.inviteCodes.add({
  id: crypto.randomUUID(),
  bandId,
  code: generatedCode,
  createdBy: user.id,
  currentUses: 0,
  maxUses: 999,
  createdDate: new Date(),
  isActive: true
})

// To:
await repository.addInviteCode({
  id: crypto.randomUUID(),
  bandId,
  code: generatedCode,
  createdBy: user.id,
  currentUses: 0,
  maxUses: 999,
  createdDate: new Date(),
  isActive: true
})
```

### 5. Add Realtime Sync for Invite Codes (Optional)

**File:** `src/services/data/RealtimeManager.ts`

Add invite_codes subscription:
```typescript
private async subscribeToBand(_userId: string, bandId: string): Promise<void> {
  // ... existing subscriptions

  // Subscribe to invite codes
  await this.subscribeToTable('invite_codes', bandId, this.handleInviteCodeChange.bind(this))
}

private async handleInviteCodeChange(payload: RealtimePayload): Promise<void> {
  // Handle INSERT/UPDATE/DELETE events for invite codes
}
```

## Related Issues

### Issue: Band Memberships Also Bypass Repository

**File:** `src/hooks/useBands.ts:240`

```typescript
// ⚠️ ALSO BYPASSES REPOSITORY
await db.bandMemberships.add(membership)
```

This suggests band memberships might also not be syncing properly. Need to verify if this is another bug or if band_memberships are handled differently.

## Testing Requirements

After implementing the fix:

1. **Unit Tests:**
   - Test `RemoteRepository.addInviteCode()` creates in Supabase
   - Test `RemoteRepository.getInviteCodeByCode()` retrieves from Supabase
   - Test `LocalRepository.addInviteCode()` creates in IndexedDB
   - Test `SyncRepository` syncs invite codes bidirectionally

2. **Integration Tests:**
   - Test band creation creates invite code in both IndexedDB and Supabase
   - Test regenerate creates new code in both stores
   - Test code validation queries Supabase first

3. **E2E Tests:**
   - `tests/e2e/auth/join-band.spec.ts` should pass
   - Verify User 2 can join User 1's band via invite code
   - Verify both users see each other in band members list

4. **Database Verification:**
   ```sql
   -- After creating band, verify invite code exists in Supabase
   SELECT code, band_id, is_active FROM invite_codes WHERE code = 'ROCK####';

   -- Should return 1 row with matching band_id
   ```

## Workaround (Temporary)

For immediate testing, manually insert invite codes into Supabase:

```sql
INSERT INTO invite_codes (
  id,
  code,
  band_id,
  created_by,
  created_date,
  expires_at,
  max_uses,
  current_uses,
  is_active
) VALUES (
  gen_random_uuid(),
  'ROCK8388',  -- Use the code from UI
  'caca1281-...',  -- Band ID from bands table
  'user-id-here',
  NOW(),
  NOW() + INTERVAL '30 days',
  10,
  0,
  true
);
```

## Priority Justification

**CRITICAL** because:
- ❌ Blocks all multi-user band functionality
- ❌ Core feature completely broken
- ❌ E2E tests failing
- ❌ No workaround for end users
- ❌ Affects every band creation attempt
- ❌ Silent failure (no error messages to user)
- ❌ Database architecture issue, not a UI bug

## Estimated Effort

- **High:** Requires changes across 5+ files
- **Medium Complexity:** Following existing repository pattern
- **Low Risk:** Pattern already established for other tables
- **Time Estimate:** 4-6 hours for implementation + testing

## Recommended Fix Order

1. ✅ Add invite code methods to `IDataRepository` interface
2. ✅ Implement `LocalRepository` invite code methods
3. ✅ Implement `RemoteRepository` invite code methods (with field mapping)
4. ✅ Update `BandMembershipService` to use repository
5. ✅ Update `AuthPages.tsx` band creation to use repository
6. ✅ Update `useBands.ts` to use repository
7. ✅ Add unit tests for repository methods
8. ✅ Run E2E tests to verify fix
9. ✅ Test manually with two separate browsers/devices
10. ✅ Verify invite codes appear in Supabase after creation

## Additional Notes

- The Supabase schema already has `invite_codes` table ✅
- RLS policies exist for `invite_codes` ✅
- The repository pattern is already working for bands, songs, etc. ✅
- This is purely an implementation gap, not an architecture issue ✅

## Related Artifacts

- `.claude/artifacts/2025-11-10T22:48_testability-improvements-band-members.md` - Testability fixes for band members page
- `.claude/specifications/unified-database-schema.md` - Database schema reference
- `tests/e2e/auth/join-band.spec.ts` - Failing E2E test
- `tests/fixtures/bands.ts` - Test fixtures for band operations

---

**Status:** Blocking multi-user functionality - needs immediate attention
**Discovered:** 2025-11-11 during E2E test debugging
**Database Evidence:** Confirmed via PostgreSQL queries on local Supabase instance
