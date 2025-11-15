---
created: 2025-11-11T04:57
updated: 2025-11-11T14:13
type: implementation-plan
priority: critical
issue: Invite codes not syncing to Supabase - blocks multi-user functionality
root_cause: Schema mismatch - expires_at field (NOT NULL in DB, optional in TypeScript)
related_artifacts:
  - .claude/artifacts/2025-11-11T04:51_invite-codes-not-syncing-critical-bug.md
  - .claude/artifacts/2025-11-11T14:13_invite-code-root-cause-analysis.md
  - .claude/bug-reports/2025-11-11_invite-code-join-band-navigation-failure.md
  - .claude/specifications/2025-10-30T13:25_bidirectional-sync-specification.md
  - .claude/specifications/unified-database-schema.md
status: blocked-schema-fix-required
progress_report: .claude/artifacts/2025-11-11T05:21_invite-codes-sync-implementation-progress.md
tasks_completed: 7/11 (Repository layer complete, but has schema bug)
blocker: Database schema migration required to make expires_at nullable
---

# Implementation Plan: Fix Invite Codes Sync to Supabase

## ⚠️ CRITICAL UPDATE (2025-11-11T14:13)

**ROOT CAUSE IDENTIFIED:** Schema mismatch between TypeScript model and Supabase database

**BLOCKER:** Database migration required before continuing with remaining tasks

**Full Analysis:** See `.claude/artifacts/2025-11-11T14:13_invite-code-root-cause-analysis.md`

---

## Executive Summary

**Problem:** Invite codes are only saved to IndexedDB and never synced to Supabase, completely breaking multi-user band joining functionality.

**Original Hypothesis:** Invite codes were implemented using direct IndexedDB writes, bypassing the repository pattern. ✅ FIXED (Tasks 1-7 complete)

**Actual Root Cause (DISCOVERED):** Schema mismatch - `expires_at` field is `NOT NULL` in Supabase but `expiresAt` is optional (`Date?`) in TypeScript model. When invite codes are created without expiration dates, Supabase INSERT fails with constraint violation.

**Solution (UPDATED):**
1. ✅ Integrate invite codes into repository pattern (DONE)
2. ⚡ **Fix schema mismatch** - Make `expires_at` nullable in Supabase (REQUIRED)
3. 🔧 Improve error handling to surface Supabase errors
4. 🧪 Verify with multi-user E2E tests

**Effort:**
- Original estimate: 4-6 hours
- Actual progress: ~3 hours (Tasks 1-7 complete)
- Remaining: ~1 hour (schema fix + verification)

**Impact:** CRITICAL - Unblocks core MVP feature (band member invitations)

## Problem Analysis

### Current Broken Flow

```
User 1: Create Band
├─ POST bands → Supabase ✅ (via repository)
├─ POST band_memberships → Supabase ✅ (via repository)
└─ db.inviteCodes.add() → IndexedDB ONLY ❌ (direct write, no sync)

User 2: Join Band (different browser/device)
├─ Input code: "ROCK8388"
├─ validateInviteCode()
│  ├─ Query Supabase: SELECT * FROM invite_codes WHERE code = 'ROCK8388'
│  │  └─ Result: 0 rows ❌ (never synced from User 1)
│  └─ Fallback to User 2's IndexedDB
│     └─ Result: Not found ❌ (only in User 1's browser)
└─ Validation fails → No navigation, silent failure
```

### Why It's Broken

1. **Missing from Repository Interface:** `IDataRepository` has no invite code methods
2. **Direct IndexedDB Writes:**
   - `BandMembershipService.ts:51` - `db.inviteCodes.add()`
   - `AuthPages.tsx:813-822` - `db.inviteCodes.add()`
3. **No Sync Queue:** Changes never queued in SyncEngine
4. **No Realtime Subscription:** RealtimeManager doesn't subscribe to invite_codes table

### Expected Working Flow

```
User 1: Create Band
├─ POST bands → Supabase ✅
├─ POST band_memberships → Supabase ✅
└─ repository.addInviteCode() → LocalRepository + SyncEngine
   ├─ Write to IndexedDB ✅
   ├─ Queue for sync (100ms debounce)
   └─ POST to Supabase (~300ms latency) ✅

User 2: Join Band
├─ Input code: "ROCK8388"
├─ repository.getInviteCodeByCode('ROCK8388')
│  ├─ Query Supabase first (cloud-first read)
│  │  └─ Result: Found ✅
│  └─ Cache in IndexedDB
└─ Validation succeeds → Create membership → Navigate to /songs ✅
```

## Architecture Context

### Existing Sync Infrastructure (Working)

Rock-On has a **proven, tested sync architecture** already working for other entities:

- **Phase 3 Complete (95%)**: Immediate sync with ~300ms latency (3x better than target!)
- **Repository Pattern**: All entities go through LocalRepository ↔ SyncEngine ↔ RemoteRepository
- **Automatic Sync**: SyncEngine queues changes with 100ms debounce, auto-retries on failure
- **Cloud-First Reads**: Cache-first pattern (< 100ms) with background refresh
- **Real-Time Updates**: WebSocket-based sync for multi-device collaboration

**Invite codes just need to be added to this existing, working system.**

### Database Schema Reference

**Location:** `.claude/specifications/unified-database-schema.md`

**Table Names:**
- IndexedDB: `inviteCodes` (camelCase)
- Supabase: `invite_codes` (snake_case)

**Field Mappings:**

| Application/IndexedDB | Supabase | Type | Notes |
|----------------------|----------|------|-------|
| `id` | `id` | UUID | Primary key |
| `bandId` | `band_id` | UUID | Foreign key to bands |
| `code` | `code` | string | Invite code (6 chars, unique) |
| `createdBy` | `created_by` | UUID | Creator user ID |
| `createdDate` | `created_date` | Date/TIMESTAMPTZ | Creation timestamp |
| `expiresAt` | `expires_at` | Date/TIMESTAMPTZ | Optional expiration |
| `maxUses` | `max_uses` | number | Max usage limit |
| `currentUses` | `current_uses` | number | Current usage count |
| `isActive` | `is_active` | boolean | Active status |

**Repository Pattern:**
- Application always uses camelCase
- RemoteRepository converts camelCase ↔ snake_case
- LocalRepository uses camelCase (Dexie/IndexedDB)

## Implementation Tasks

### ⚡ Task 0: FIX SCHEMA MISMATCH (15 min) - **CRITICAL BLOCKER**

**Status:** ❌ NOT STARTED (blocks remaining tasks)

**Problem:** The `expires_at` field is defined as `NOT NULL` in Supabase but `expiresAt` is optional in TypeScript. This causes INSERT failures when invite codes are created without expiration dates.

**Current Schema:**
```sql
-- supabase/migrations/20251106000000_baseline_schema.sql:103
expires_at TIMESTAMPTZ NOT NULL,  -- ❌ BLOCKING ISSUE
```

**Required Fix - Option 1: Make expires_at Nullable (RECOMMENDED)**

Since we're in pre-1.0 development, modify the baseline migration directly:

**File:** `supabase/migrations/20251106000000_baseline_schema.sql`

**Line 103 - Change from:**
```sql
expires_at TIMESTAMPTZ NOT NULL,
```

**Line 103 - Change to:**
```sql
expires_at TIMESTAMPTZ,  -- Nullable - allows permanent invite codes
```

**Rationale:**
- Simpler fix (no code changes needed)
- Semantically correct (some codes should never expire)
- Aligns with TypeScript model (`expiresAt?: Date`)
- Follows pre-1.0 migration policy (modify baseline directly)

**Alternative - Option 2: Set Default Expiration (if permanent codes not desired)**

If business logic requires all codes to expire, add default in code:

**File:** `src/services/BandMembershipService.ts:42`
```typescript
expiresAt: request.expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Default: 1 year
```

**AND update TypeScript model to make expiresAt required:**

**File:** `src/models/BandMembership.ts:16`
```typescript
expiresAt: Date  // Remove optional (?)
```

**Validation After Fix:**
```bash
# 1. Reset local Supabase (applies updated baseline)
supabase db reset

# 2. Verify schema change
supabase db push

# 3. Check schema (should show is_nullable = 'YES')
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_name = 'invite_codes' AND column_name = 'expires_at';"

# Should output:
#  column_name | is_nullable | data_type
# -------------+-------------+-----------
#  expires_at  | YES         | timestamp with time zone
```

**Notes:**
- This fix is required before Task 8 (Unit Tests) will pass
- E2E tests will continue to fail until this is fixed
- Current implementation in Tasks 1-7 is correct, just blocked by schema

---

### ⚡ Task 0.5: FIX TEST FIXTURE BUG (5 min) - **HIGH PRIORITY**

**Status:** ❌ NOT STARTED

**Problem:** Test fixture uses wrong field name `created_at` instead of `created_date`

**File:** `tests/fixtures/bands.ts:153`

**Change from:**
```typescript
created_at: new Date().toISOString(),  // ❌ Wrong field name (column doesn't exist)
```

**Change to:**
```typescript
created_date: new Date().toISOString(),  // ✅ Correct field name
```

**Validation:**
```bash
npm run test:e2e -- tests/e2e/auth/join-band.spec.ts
# Should not throw column "created_at" does not exist error
```

---

### Task 1: Add Invite Codes to Repository Interface (30 min)

**Status:** ✅ COMPLETE (2025-11-11)

**File:** `src/services/data/IDataRepository.ts:70-101`

**What Was Added:** 6 invite code methods following same pattern as other entities

```typescript
// ========== INVITE CODES ==========
/**
 * Get all invite codes for a band
 */
getInviteCodes(bandId: string): Promise<InviteCode[]>

/**
 * Get a specific invite code by ID
 */
getInviteCode(id: string): Promise<InviteCode | null>

/**
 * Get an invite code by its code string
 * Used for validation during band joining
 */
getInviteCodeByCode(code: string): Promise<InviteCode | null>

/**
 * Create a new invite code
 * Automatically syncs to Supabase via SyncEngine
 */
addInviteCode(inviteCode: InviteCode): Promise<InviteCode>

/**
 * Update an invite code (e.g., increment currentUses)
 */
updateInviteCode(id: string, updates: Partial<InviteCode>): Promise<InviteCode>

/**
 * Delete/deactivate an invite code
 */
deleteInviteCode(id: string): Promise<void>
```

**Notes:**
- Follow exact same pattern as other entities (songs, bands, setlists)
- `getInviteCodeByCode()` is critical for validation flow
- All methods return Promises (async operations)

**Validation:**
```bash
# TypeScript should compile without errors
npm run type-check
```

---

### Task 2: Implement LocalRepository Methods (45 min)

**Status:** ✅ COMPLETE (2025-11-11)

**File:** `src/services/data/LocalRepository.ts:333-375`

**What to Add:** Implement all 6 invite code methods using Dexie

**Reference Implementation:** Look at existing `getSongs()`, `addSong()`, etc. in same file

**Example Implementation:**

```typescript
// ========== INVITE CODES ==========

async getInviteCodes(bandId: string): Promise<InviteCode[]> {
  return db.inviteCodes
    .where('bandId')
    .equals(bandId)
    .toArray()
}

async getInviteCode(id: string): Promise<InviteCode | null> {
  const code = await db.inviteCodes.get(id)
  return code || null
}

async getInviteCodeByCode(code: string): Promise<InviteCode | null> {
  const upperCode = code.toUpperCase()
  const inviteCode = await db.inviteCodes
    .where('code')
    .equals(upperCode)
    .first()
  return inviteCode || null
}

async addInviteCode(inviteCode: InviteCode): Promise<InviteCode> {
  await db.inviteCodes.add(inviteCode)
  return inviteCode
}

async updateInviteCode(id: string, updates: Partial<InviteCode>): Promise<InviteCode> {
  await db.inviteCodes.update(id, updates)
  const updated = await db.inviteCodes.get(id)
  if (!updated) {
    throw new Error(`InviteCode ${id} not found after update`)
  }
  return updated
}

async deleteInviteCode(id: string): Promise<void> {
  await db.inviteCodes.delete(id)
}
```

**Notes:**
- Use exact same error handling patterns as existing methods
- `getInviteCodeByCode()` should convert to uppercase (codes are case-insensitive)
- All methods work with IndexedDB only (no Supabase calls)

**Validation:**
```typescript
// Unit test example (add to tests/unit/services/data/LocalRepository.test.ts)
describe('InviteCode operations', () => {
  it('should add and retrieve invite code', async () => {
    const code: InviteCode = {
      id: crypto.randomUUID(),
      bandId: 'band-123',
      code: 'ROCK1234',
      createdBy: 'user-123',
      createdDate: new Date(),
      isActive: true,
      currentUses: 0,
      maxUses: 10
    }

    await localRepo.addInviteCode(code)
    const retrieved = await localRepo.getInviteCode(code.id)

    expect(retrieved).toEqual(code)
  })

  it('should retrieve invite code by code string (case insensitive)', async () => {
    const code: InviteCode = { /* ... */ code: 'ROCK1234' }
    await localRepo.addInviteCode(code)

    const retrieved = await localRepo.getInviteCodeByCode('rock1234') // lowercase
    expect(retrieved?.code).toBe('ROCK1234')
  })
})
```

---

### Task 3: Implement RemoteRepository Methods (60 min)

**Status:** ✅ COMPLETE (2025-11-11) - ⚠️ Has schema bug (see Task 0)

**File:** `src/services/data/RemoteRepository.ts:715-890`

**What to Add:** Implement all 6 invite code methods with Supabase queries + field mapping

**Critical:** Must map camelCase ↔ snake_case (see unified-database-schema.md)

**Example Implementation:**

```typescript
// ========== INVITE CODES ==========

async getInviteCodes(bandId: string): Promise<InviteCode[]> {
  const { data, error } = await this.supabase
    .from('invite_codes')
    .select('*')
    .eq('band_id', bandId)
    .eq('is_active', true)

  if (error) {
    console.error('[RemoteRepository] Error fetching invite codes:', error)
    throw error
  }

  return (data || []).map(this.mapInviteCodeFromSupabase)
}

async getInviteCode(id: string): Promise<InviteCode | null> {
  const { data, error } = await this.supabase
    .from('invite_codes')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    console.error('[RemoteRepository] Error fetching invite code:', error)
    throw error
  }

  return data ? this.mapInviteCodeFromSupabase(data) : null
}

async getInviteCodeByCode(code: string): Promise<InviteCode | null> {
  const upperCode = code.toUpperCase()
  const { data, error } = await this.supabase
    .from('invite_codes')
    .select('*')
    .eq('code', upperCode)
    .eq('is_active', true)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    console.error('[RemoteRepository] Error fetching invite code by code:', error)
    throw error
  }

  return data ? this.mapInviteCodeFromSupabase(data) : null
}

async addInviteCode(inviteCode: InviteCode): Promise<InviteCode> {
  const supabaseData = this.mapInviteCodeToSupabase(inviteCode)

  const { data, error } = await this.supabase
    .from('invite_codes')
    .insert(supabaseData)
    .select()
    .single()

  if (error) {
    console.error('[RemoteRepository] Error creating invite code:', error)
    throw error
  }

  return this.mapInviteCodeFromSupabase(data)
}

async updateInviteCode(id: string, updates: Partial<InviteCode>): Promise<InviteCode> {
  const supabaseUpdates = this.mapInviteCodeToSupabase(updates)

  const { data, error } = await this.supabase
    .from('invite_codes')
    .update(supabaseUpdates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[RemoteRepository] Error updating invite code:', error)
    throw error
  }

  return this.mapInviteCodeFromSupabase(data)
}

async deleteInviteCode(id: string): Promise<void> {
  const { error } = await this.supabase
    .from('invite_codes')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[RemoteRepository] Error deleting invite code:', error)
    throw error
  }
}

// ========== MAPPING FUNCTIONS ==========

/**
 * Convert InviteCode from Supabase format (snake_case) to application format (camelCase)
 */
private mapInviteCodeFromSupabase(row: any): InviteCode {
  return {
    id: row.id,
    bandId: row.band_id,
    code: row.code,
    createdBy: row.created_by,
    createdDate: new Date(row.created_date),
    expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
    maxUses: row.max_uses,
    currentUses: row.current_uses,
    isActive: row.is_active
  }
}

/**
 * Convert InviteCode from application format (camelCase) to Supabase format (snake_case)
 */
private mapInviteCodeToSupabase(inviteCode: Partial<InviteCode>): any {
  const result: any = {}

  if (inviteCode.id !== undefined) result.id = inviteCode.id
  if (inviteCode.bandId !== undefined) result.band_id = inviteCode.bandId
  if (inviteCode.code !== undefined) result.code = inviteCode.code
  if (inviteCode.createdBy !== undefined) result.created_by = inviteCode.createdBy
  if (inviteCode.createdDate !== undefined) result.created_date = inviteCode.createdDate
  if (inviteCode.expiresAt !== undefined) result.expires_at = inviteCode.expiresAt
  if (inviteCode.maxUses !== undefined) result.max_uses = inviteCode.maxUses
  if (inviteCode.currentUses !== undefined) result.current_uses = inviteCode.currentUses
  if (inviteCode.isActive !== undefined) result.is_active = inviteCode.isActive

  return result
}
```

**CRITICAL Field Mappings:**

| Application (camelCase) | Supabase (snake_case) |
|------------------------|----------------------|
| `bandId` | `band_id` |
| `createdBy` | `created_by` |
| `createdDate` | `created_date` |
| `expiresAt` | `expires_at` |
| `maxUses` | `max_uses` |
| `currentUses` | `current_uses` |
| `isActive` | `is_active` |

**Notes:**
- **ALWAYS** map field names in both directions
- Handle `null` vs `undefined` for optional fields (`expiresAt`)
- Convert date strings to Date objects when reading from Supabase
- Use `single()` for methods that return one item, handle `PGRST116` error (not found)
- Follow exact same patterns as existing `mapSongToSupabase()` / `mapSongFromSupabase()`

**Validation:**
```typescript
// Unit test example (add to tests/unit/services/data/RemoteRepository.test.ts)
describe('InviteCode operations', () => {
  it('should map invite code to Supabase format', () => {
    const code: InviteCode = {
      id: 'id-123',
      bandId: 'band-123',
      code: 'ROCK1234',
      createdBy: 'user-123',
      createdDate: new Date('2025-11-11'),
      expiresAt: new Date('2025-12-11'),
      maxUses: 10,
      currentUses: 5,
      isActive: true
    }

    const mapped = remoteRepo['mapInviteCodeToSupabase'](code)

    expect(mapped.band_id).toBe('band-123')
    expect(mapped.created_by).toBe('user-123')
    expect(mapped.max_uses).toBe(10)
    expect(mapped.is_active).toBe(true)
  })
})
```

---

### Task 4: Update SyncRepository to Inherit Methods (10 min)

**Status:** ✅ COMPLETE (2025-11-11)

**File:** `src/services/data/SyncRepository.ts:332-400`

**What to Do:** Add invite code methods that delegate to LocalRepository + queue for sync

**Example Implementation:**

```typescript
// ========== INVITE CODES ==========

async getInviteCodes(bandId: string): Promise<InviteCode[]> {
  // Cloud-first read: try remote first, fallback to local
  if (this.isOnline() && this.remoteRepository) {
    try {
      return await this.remoteRepository.getInviteCodes(bandId)
    } catch (error) {
      console.warn('[SyncRepository] Remote fetch failed, using local:', error)
    }
  }
  return this.localRepository.getInviteCodes(bandId)
}

async getInviteCode(id: string): Promise<InviteCode | null> {
  if (this.isOnline() && this.remoteRepository) {
    try {
      return await this.remoteRepository.getInviteCode(id)
    } catch (error) {
      console.warn('[SyncRepository] Remote fetch failed, using local:', error)
    }
  }
  return this.localRepository.getInviteCode(id)
}

async getInviteCodeByCode(code: string): Promise<InviteCode | null> {
  // CRITICAL: Must query Supabase for multi-user validation
  if (this.isOnline() && this.remoteRepository) {
    try {
      return await this.remoteRepository.getInviteCodeByCode(code)
    } catch (error) {
      console.warn('[SyncRepository] Remote fetch failed, using local:', error)
    }
  }
  return this.localRepository.getInviteCodeByCode(code)
}

async addInviteCode(inviteCode: InviteCode): Promise<InviteCode> {
  // 1. Write to local first (instant response)
  const created = await this.localRepository.addInviteCode(inviteCode)

  // 2. Queue for immediate sync to Supabase
  if (this.syncEngine) {
    await this.syncEngine.queueCreate('invite_codes', created)
  }

  return created
}

async updateInviteCode(id: string, updates: Partial<InviteCode>): Promise<InviteCode> {
  // 1. Update local first
  const updated = await this.localRepository.updateInviteCode(id, updates)

  // 2. Queue for sync
  if (this.syncEngine) {
    await this.syncEngine.queueUpdate('invite_codes', id, updates)
  }

  return updated
}

async deleteInviteCode(id: string): Promise<void> {
  // 1. Delete from local
  await this.localRepository.deleteInviteCode(id)

  // 2. Queue delete operation
  if (this.syncEngine) {
    await this.syncEngine.queueDelete('invite_codes', id)
  }
}
```

**Notes:**
- **Reads:** Cloud-first pattern (try remote, fallback to local if offline)
- **Writes:** Local-first pattern (write to IndexedDB immediately, queue for sync)
- `getInviteCodeByCode()` MUST check Supabase for multi-user validation
- SyncEngine automatically handles the ~300ms sync to Supabase

**Validation:**
```bash
# TypeScript should compile without errors
npm run type-check

# All existing sync tests should still pass
npm test -- tests/unit/services/data/SyncRepository.test.ts
```

---

### Task 5: Update SyncEngine to Handle Invite Codes (20 min)

**Status:** ✅ COMPLETE (2025-11-11)

**File:** `src/services/data/SyncEngine.ts` (multiple locations)

**What to Check:** Ensure `invite_codes` table is included in sync operations

**Likely Changes Needed:**

1. **Add to table list** if it's defined:
```typescript
const SYNCED_TABLES = [
  'songs',
  'bands',
  'setlists',
  'shows',
  'practice_sessions',
  'band_memberships',
  'invite_codes' // ADD THIS
]
```

2. **Add to performInitialSync()** if tables are listed:
```typescript
async performInitialSync(userId: string): Promise<void> {
  // ... existing code

  // Sync invite codes for user's bands
  const inviteCodes = await this.remoteRepository.getInviteCodes(bandId)
  for (const code of inviteCodes) {
    await db.inviteCodes.put(code)
  }
}
```

3. **Verify queueCreate/queueUpdate/queueDelete** handle generic table names

**Notes:**
- SyncEngine should already be table-agnostic (uses table name string)
- If it's hardcoded for specific tables, add `invite_codes` case
- Check `pushQueuedChanges()` method to ensure it handles all queued operations

**Validation:**
```bash
# Run SyncEngine unit tests
npm test -- tests/unit/services/data/SyncEngine.test.ts

# All existing tests should pass (shouldn't break anything)
```

---

### Task 6: Update BandMembershipService (20 min)

**Status:** ✅ COMPLETE (2025-11-11) - ⚠️ Has schema bug (see Task 0)

**File:** `src/services/BandMembershipService.ts:27-135`

**What to Change:** Replace direct IndexedDB writes with repository calls

**Changes:**

1. **Line 51** - `createInviteCode()`:
```typescript
// ❌ REMOVE THIS:
await db.inviteCodes.add(inviteCode)

// ✅ REPLACE WITH:
await repository.addInviteCode(inviteCode)
```

2. **Line 59** - `getBandInviteCodes()`:
```typescript
// ❌ REMOVE THIS:
return db.inviteCodes.where('bandId').equals(bandId).toArray()

// ✅ REPLACE WITH:
return repository.getInviteCodes(bandId)
```

3. **Line 33-36** - `createInviteCode()` uniqueness check:
```typescript
// ❌ REMOVE THIS:
const existingCode = await db.inviteCodes.where('code').equals(code).first()

// ✅ REPLACE WITH:
const existingCode = await repository.getInviteCodeByCode(code)
```

4. **Lines 161-163** - `joinBandWithCode()` usage increment:
```typescript
// ❌ REMOVE THIS:
await db.inviteCodes.update(inviteCode.id, {
  currentUses: inviteCode.currentUses + 1
})

// ✅ REPLACE WITH:
await repository.updateInviteCode(inviteCode.id, {
  currentUses: inviteCode.currentUses + 1
})
```

5. **Remove validateInviteCode() Supabase query** (lines 66-121):
```typescript
// ❌ REMOVE ENTIRE validateInviteCode() METHOD
// This method manually queries Supabase and has duplicate logic

// ✅ REPLACE WITH simple repository call:
static async validateInviteCode(code: string): Promise<{
  valid: boolean
  inviteCode?: InviteCode
  error?: string
}> {
  const upperCode = code.toUpperCase()

  // Repository handles Supabase query automatically (cloud-first read)
  const inviteCode = await repository.getInviteCodeByCode(upperCode)

  if (!inviteCode) {
    return { valid: false, error: 'Invalid invite code' }
  }

  if (inviteCode.expiresAt && inviteCode.expiresAt < new Date()) {
    return { valid: false, error: 'Invite code has expired' }
  }

  if (inviteCode.maxUses && inviteCode.currentUses >= inviteCode.maxUses) {
    return { valid: false, error: 'Invite code has reached maximum uses' }
  }

  return { valid: true, inviteCode }
}
```

**Notes:**
- **Critical:** Remove all direct `db.inviteCodes` calls
- Use `repository` singleton (already imported at top of file)
- Validation logic stays the same, just use repository for data access
- Repository automatically handles sync to Supabase

**Validation:**
```bash
# TypeScript should compile
npm run type-check

# Run any existing BandMembershipService tests
npm test -- BandMembershipService
```

---

### Task 7: Update Band Creation Code (15 min)

**Status:** ✅ COMPLETE (2025-11-11) - ⚠️ Has schema bug (see Task 0)

**File:** `src/pages/NewLayout/AuthPages.tsx:810-815, 838-886`

**Location:** Lines 813-822 in `handleCreateBand()` function

**What to Change:** Replace direct IndexedDB write with repository call

**Current Code (REMOVE):**
```typescript
// Generate initial invite code
const randomDigits = Math.floor(1000 + Math.random() * 9000)
const generatedCode = 'ROCK' + randomDigits

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
```

**New Code (ADD):**
```typescript
// Generate initial invite code via BandMembershipService
// This ensures proper sync to Supabase
await BandMembershipService.createInviteCode({
  bandId,
  createdBy: user.id,
  maxUses: 999
})
```

**Notes:**
- Use `BandMembershipService.createInviteCode()` (already uses repository after Task 6)
- This generates the code internally (no need to generate manually)
- Automatically syncs to Supabase via repository pattern
- Ensure `BandMembershipService` is imported at top of file

**Validation:**
```typescript
// After change, verify imports
import { BandMembershipService } from '../../services/BandMembershipService'

// Test manually:
// 1. Create a new band
// 2. Check IndexedDB for invite code (DevTools → Application → IndexedDB)
// 3. Check Supabase for invite code (Supabase Studio → invite_codes table)
// 4. Both should have the same code
```

---

### Task 8: Add Unit Tests for Repository Methods (60 min)

**Files to Create/Update:**
- `tests/unit/services/data/LocalRepository.test.ts` (add InviteCode tests)
- `tests/unit/services/data/RemoteRepository.test.ts` (add InviteCode tests)
- `tests/unit/services/data/SyncRepository.test.ts` (add InviteCode tests)

**Test Coverage Required:**

#### LocalRepository Tests

```typescript
describe('InviteCode operations - LocalRepository', () => {
  let localRepo: LocalRepository

  beforeEach(async () => {
    localRepo = new LocalRepository()
    await db.delete() // Clear IndexedDB
    await db.open()
  })

  describe('addInviteCode', () => {
    it('should add invite code to IndexedDB', async () => {
      const code: InviteCode = {
        id: crypto.randomUUID(),
        bandId: 'band-123',
        code: 'ROCK1234',
        createdBy: 'user-123',
        createdDate: new Date(),
        isActive: true,
        currentUses: 0,
        maxUses: 10
      }

      const result = await localRepo.addInviteCode(code)
      expect(result).toEqual(code)

      const stored = await db.inviteCodes.get(code.id)
      expect(stored).toEqual(code)
    })
  })

  describe('getInviteCode', () => {
    it('should retrieve invite code by ID', async () => {
      const code: InviteCode = { /* ... */ }
      await db.inviteCodes.add(code)

      const result = await localRepo.getInviteCode(code.id)
      expect(result).toEqual(code)
    })

    it('should return null for non-existent ID', async () => {
      const result = await localRepo.getInviteCode('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('getInviteCodeByCode', () => {
    it('should retrieve invite code by code string', async () => {
      const code: InviteCode = { /* ... */ code: 'ROCK1234' }
      await db.inviteCodes.add(code)

      const result = await localRepo.getInviteCodeByCode('ROCK1234')
      expect(result).toEqual(code)
    })

    it('should be case-insensitive', async () => {
      const code: InviteCode = { /* ... */ code: 'ROCK1234' }
      await db.inviteCodes.add(code)

      const result = await localRepo.getInviteCodeByCode('rock1234')
      expect(result?.code).toBe('ROCK1234')
    })

    it('should return null for non-existent code', async () => {
      const result = await localRepo.getInviteCodeByCode('INVALID')
      expect(result).toBeNull()
    })
  })

  describe('getInviteCodes', () => {
    it('should retrieve all invite codes for a band', async () => {
      const code1: InviteCode = { /* ... */ bandId: 'band-123' }
      const code2: InviteCode = { /* ... */ bandId: 'band-123' }
      const code3: InviteCode = { /* ... */ bandId: 'band-456' }

      await db.inviteCodes.bulkAdd([code1, code2, code3])

      const result = await localRepo.getInviteCodes('band-123')
      expect(result).toHaveLength(2)
      expect(result.map(c => c.id)).toContain(code1.id)
      expect(result.map(c => c.id)).toContain(code2.id)
    })

    it('should return empty array for band with no codes', async () => {
      const result = await localRepo.getInviteCodes('nonexistent')
      expect(result).toEqual([])
    })
  })

  describe('updateInviteCode', () => {
    it('should update invite code fields', async () => {
      const code: InviteCode = { /* ... */ currentUses: 0 }
      await db.inviteCodes.add(code)

      const result = await localRepo.updateInviteCode(code.id, {
        currentUses: 5
      })

      expect(result.currentUses).toBe(5)

      const stored = await db.inviteCodes.get(code.id)
      expect(stored?.currentUses).toBe(5)
    })

    it('should throw error if invite code not found', async () => {
      await expect(
        localRepo.updateInviteCode('nonexistent', { currentUses: 5 })
      ).rejects.toThrow()
    })
  })

  describe('deleteInviteCode', () => {
    it('should delete invite code from IndexedDB', async () => {
      const code: InviteCode = { /* ... */ }
      await db.inviteCodes.add(code)

      await localRepo.deleteInviteCode(code.id)

      const stored = await db.inviteCodes.get(code.id)
      expect(stored).toBeUndefined()
    })

    it('should not throw error if invite code does not exist', async () => {
      await expect(
        localRepo.deleteInviteCode('nonexistent')
      ).resolves.not.toThrow()
    })
  })
})
```

#### RemoteRepository Tests

```typescript
describe('InviteCode operations - RemoteRepository', () => {
  let remoteRepo: RemoteRepository
  let mockSupabase: any

  beforeEach(() => {
    // Mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn()
    }

    remoteRepo = new RemoteRepository(mockSupabase)
  })

  describe('Field Mapping', () => {
    it('should map camelCase to snake_case when writing', () => {
      const code: InviteCode = {
        id: 'id-123',
        bandId: 'band-123',
        code: 'ROCK1234',
        createdBy: 'user-123',
        createdDate: new Date('2025-11-11'),
        expiresAt: new Date('2025-12-11'),
        maxUses: 10,
        currentUses: 5,
        isActive: true
      }

      const mapped = remoteRepo['mapInviteCodeToSupabase'](code)

      expect(mapped.band_id).toBe('band-123')
      expect(mapped.created_by).toBe('user-123')
      expect(mapped.expires_at).toEqual(new Date('2025-12-11'))
      expect(mapped.max_uses).toBe(10)
      expect(mapped.current_uses).toBe(5)
      expect(mapped.is_active).toBe(true)
    })

    it('should map snake_case to camelCase when reading', () => {
      const supabaseRow = {
        id: 'id-123',
        band_id: 'band-123',
        code: 'ROCK1234',
        created_by: 'user-123',
        created_date: '2025-11-11T00:00:00Z',
        expires_at: '2025-12-11T00:00:00Z',
        max_uses: 10,
        current_uses: 5,
        is_active: true
      }

      const mapped = remoteRepo['mapInviteCodeFromSupabase'](supabaseRow)

      expect(mapped.bandId).toBe('band-123')
      expect(mapped.createdBy).toBe('user-123')
      expect(mapped.expiresAt).toBeInstanceOf(Date)
      expect(mapped.maxUses).toBe(10)
      expect(mapped.currentUses).toBe(5)
      expect(mapped.isActive).toBe(true)
    })
  })

  describe('addInviteCode', () => {
    it('should insert invite code into Supabase with correct field mapping', async () => {
      const code: InviteCode = {
        id: 'id-123',
        bandId: 'band-123',
        code: 'ROCK1234',
        createdBy: 'user-123',
        createdDate: new Date(),
        isActive: true,
        currentUses: 0,
        maxUses: 10
      }

      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'id-123',
          band_id: 'band-123',
          code: 'ROCK1234',
          created_by: 'user-123',
          created_date: code.createdDate.toISOString(),
          is_active: true,
          current_uses: 0,
          max_uses: 10
        },
        error: null
      })

      const result = await remoteRepo.addInviteCode(code)

      expect(mockSupabase.from).toHaveBeenCalledWith('invite_codes')
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          band_id: 'band-123',
          created_by: 'user-123'
        })
      )
      expect(result.bandId).toBe('band-123')
    })
  })

  describe('getInviteCodeByCode', () => {
    it('should query Supabase with correct filters', async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'id-123',
          band_id: 'band-123',
          code: 'ROCK1234',
          created_by: 'user-123',
          created_date: '2025-11-11T00:00:00Z',
          is_active: true,
          current_uses: 0,
          max_uses: 10
        },
        error: null
      })

      await remoteRepo.getInviteCodeByCode('ROCK1234')

      expect(mockSupabase.from).toHaveBeenCalledWith('invite_codes')
      expect(mockSupabase.eq).toHaveBeenCalledWith('code', 'ROCK1234')
      expect(mockSupabase.eq).toHaveBeenCalledWith('is_active', true)
    })

    it('should convert code to uppercase', async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })

      await remoteRepo.getInviteCodeByCode('rock1234')

      expect(mockSupabase.eq).toHaveBeenCalledWith('code', 'ROCK1234')
    })
  })
})
```

#### SyncRepository Tests

```typescript
describe('InviteCode operations - SyncRepository', () => {
  let syncRepo: SyncRepository
  let mockLocalRepo: jest.Mocked<LocalRepository>
  let mockRemoteRepo: jest.Mocked<RemoteRepository>
  let mockSyncEngine: jest.Mocked<SyncEngine>

  beforeEach(() => {
    mockLocalRepo = {
      addInviteCode: jest.fn(),
      getInviteCode: jest.fn(),
      getInviteCodeByCode: jest.fn(),
      getInviteCodes: jest.fn(),
      updateInviteCode: jest.fn(),
      deleteInviteCode: jest.fn()
    } as any

    mockRemoteRepo = {
      getInviteCodeByCode: jest.fn()
    } as any

    mockSyncEngine = {
      queueCreate: jest.fn(),
      queueUpdate: jest.fn(),
      queueDelete: jest.fn()
    } as any

    syncRepo = new SyncRepository(mockLocalRepo, mockRemoteRepo, mockSyncEngine)
  })

  describe('addInviteCode', () => {
    it('should write to local and queue for sync', async () => {
      const code: InviteCode = { /* ... */ }
      mockLocalRepo.addInviteCode.mockResolvedValue(code)

      const result = await syncRepo.addInviteCode(code)

      expect(mockLocalRepo.addInviteCode).toHaveBeenCalledWith(code)
      expect(mockSyncEngine.queueCreate).toHaveBeenCalledWith('invite_codes', code)
      expect(result).toEqual(code)
    })
  })

  describe('getInviteCodeByCode', () => {
    it('should query remote first when online', async () => {
      const code: InviteCode = { /* ... */ }
      mockRemoteRepo.getInviteCodeByCode.mockResolvedValue(code)

      const result = await syncRepo.getInviteCodeByCode('ROCK1234')

      expect(mockRemoteRepo.getInviteCodeByCode).toHaveBeenCalledWith('ROCK1234')
      expect(result).toEqual(code)
    })

    it('should fallback to local if remote fails', async () => {
      const code: InviteCode = { /* ... */ }
      mockRemoteRepo.getInviteCodeByCode.mockRejectedValue(new Error('Network error'))
      mockLocalRepo.getInviteCodeByCode.mockResolvedValue(code)

      const result = await syncRepo.getInviteCodeByCode('ROCK1234')

      expect(mockRemoteRepo.getInviteCodeByCode).toHaveBeenCalled()
      expect(mockLocalRepo.getInviteCodeByCode).toHaveBeenCalledWith('ROCK1234')
      expect(result).toEqual(code)
    })
  })

  describe('updateInviteCode', () => {
    it('should update local and queue for sync', async () => {
      const updated: InviteCode = { /* ... */ currentUses: 5 }
      mockLocalRepo.updateInviteCode.mockResolvedValue(updated)

      const result = await syncRepo.updateInviteCode('id-123', { currentUses: 5 })

      expect(mockLocalRepo.updateInviteCode).toHaveBeenCalledWith('id-123', { currentUses: 5 })
      expect(mockSyncEngine.queueUpdate).toHaveBeenCalledWith('invite_codes', 'id-123', { currentUses: 5 })
      expect(result).toEqual(updated)
    })
  })
})
```

**Validation:**
```bash
# Run all unit tests
npm test

# Run specific repository tests
npm test -- LocalRepository
npm test -- RemoteRepository
npm test -- SyncRepository

# All tests should pass
```

---

### Task 9: Manual Integration Testing (30 min)

**Test Scenario 1: Create Band → Verify Sync**

1. **Clear existing data:**
```bash
# In browser DevTools console
indexedDB.deleteDatabase('RockOnDB')
location.reload()
```

2. **Create a new band:**
   - Log in as User 1
   - Navigate to Bands page
   - Click "Create New Band"
   - Enter name: "Test Sync Band"
   - Submit

3. **Verify invite code in IndexedDB:**
```javascript
// In browser console
const db = await window.indexedDB.databases()
// Open RockOnDB, check inviteCodes store
```

4. **Verify invite code in Supabase:**
```sql
-- In Supabase SQL Editor
SELECT code, band_id, is_active, current_uses
FROM invite_codes
WHERE band_id IN (SELECT id FROM bands WHERE name = 'Test Sync Band');

-- Should return 1 row with the generated code
```

**Expected:** Both IndexedDB and Supabase have the same invite code

---

**Test Scenario 2: Join Band → Multi-User Validation**

1. **Get invite code from User 1:**
   - Navigate to Band Details → Members tab
   - Copy the displayed invite code (e.g., "ROCK8388")

2. **Join as User 2 (different browser/incognito):**
   - Log in as different user
   - Navigate to Bands page
   - Click "Join Band"
   - Enter invite code: "ROCK8388"
   - Submit

3. **Verify join succeeded:**
   - User 2 should navigate to /songs
   - User 2 should see band in their bands list
   - User 1 should see User 2 in band members list

4. **Verify usage count updated:**
```sql
-- In Supabase SQL Editor
SELECT code, current_uses FROM invite_codes WHERE code = 'ROCK8388';

-- Should show current_uses = 1
```

**Expected:** User 2 successfully joins band, usage count increments

---

**Test Scenario 3: Regenerate Code**

1. **As admin, regenerate invite code:**
   - Navigate to Band Details → Members tab
   - Click "Regenerate Code"
   - Confirm

2. **Verify old code invalidated:**
```sql
SELECT code, is_active FROM invite_codes WHERE band_id = 'band-id';

-- Old code should have is_active = false
-- New code should have is_active = true
```

3. **Verify new code works:**
   - User 3 tries old code → Should fail
   - User 3 tries new code → Should succeed

**Expected:** Old code disabled, new code works

---

**Validation Checklist:**
- [ ] Invite code appears in IndexedDB immediately after band creation
- [ ] Invite code appears in Supabase within ~300ms
- [ ] Code validation queries Supabase (not just IndexedDB)
- [ ] User 2 can join band created by User 1
- [ ] Usage count increments in both IndexedDB and Supabase
- [ ] Regenerating code invalidates old code
- [ ] All operations work offline (queued for sync when back online)

---

### Task 10: Run E2E Tests (15 min)

**Test File:** `tests/e2e/auth/join-band.spec.ts`

**What to Test:** E2E test should now pass without modification

**Run Tests:**
```bash
# Ensure local Supabase is running
supabase start

# Run the failing E2E test
npm run test:e2e -- tests/e2e/auth/join-band.spec.ts --project=chromium

# Should now pass all tests
```

**Expected Results:**
- ✅ User 1 creates band
- ✅ Invite code displayed in UI
- ✅ User 2 joins band with code
- ✅ User 2 sees band in their bands list
- ✅ User 1 sees User 2 in band members

**If Tests Fail:**
- Check browser console for errors
- Verify Supabase database has invite codes
- Check SyncEngine logs for sync errors
- Use Chrome DevTools → Network tab to inspect Supabase requests

---

### Task 11: Optional - Add Realtime Sync for Invite Codes (30 min)

**File:** `src/services/data/RealtimeManager.ts`

**What to Add:** Subscribe to `invite_codes` table for real-time updates

**Implementation:**

```typescript
private async subscribeToBand(_userId: string, bandId: string): Promise<void> {
  // ... existing subscriptions (songs, setlists, shows, practice_sessions)

  // Subscribe to invite codes
  await this.subscribeToTable('invite_codes', bandId, this.handleInviteCodeChange.bind(this))
}

private async handleInviteCodeChange(payload: RealtimePayload): Promise<void> {
  console.log('[RealtimeManager] Invite code change:', payload)

  const { eventType, new: newRecord, old: oldRecord } = payload

  if (eventType === 'INSERT' || eventType === 'UPDATE') {
    // Fetch latest from Supabase
    const inviteCode = await this.remoteRepository.getInviteCode(newRecord.id)
    if (inviteCode) {
      // Update local IndexedDB
      await db.inviteCodes.put(inviteCode)

      // Emit event for UI (optional)
      this.emit('invite_codes:changed', {
        bandId: inviteCode.bandId,
        action: eventType,
        recordId: inviteCode.id
      })
    }
  } else if (eventType === 'DELETE') {
    // Remove from local cache
    await db.inviteCodes.delete(oldRecord.id)

    this.emit('invite_codes:changed', {
      bandId: oldRecord.band_id,
      action: 'DELETE',
      recordId: oldRecord.id
    })
  }
}
```

**Notes:**
- This is **optional** but recommended for consistency
- Allows admins on different devices to see regenerated codes instantly
- Follow same pattern as existing `handleSongChange()`, `handleSetlistChange()`, etc.
- Emit events if UI needs to react (e.g., refresh invite code display)

**Validation:**
```bash
# Test with two browser windows:
# 1. User 1 regenerates code
# 2. User 2 (same band admin) should see new code within 1 second
```

---

## Testing Strategy

### Unit Tests (Required)

**Coverage Required:** 80%+ for new code

**What to Test:**
- LocalRepository invite code methods
- RemoteRepository invite code methods (with field mapping)
- SyncRepository invite code methods (with queueing)
- BandMembershipService refactored methods

**Test Files:**
- `tests/unit/services/data/LocalRepository.test.ts`
- `tests/unit/services/data/RemoteRepository.test.ts`
- `tests/unit/services/data/SyncRepository.test.ts`
- `tests/unit/services/BandMembershipService.test.ts` (if exists)

**Run Tests:**
```bash
npm test
```

---

### Integration Tests (Recommended)

**Scenario: End-to-End Sync Flow**

```typescript
describe('InviteCode sync integration', () => {
  it('should sync invite code from creation to Supabase', async () => {
    // 1. Create band
    const band = await repository.addBand({ name: 'Test Band', /* ... */ })

    // 2. Create invite code via service
    const inviteCode = await BandMembershipService.createInviteCode({
      bandId: band.id,
      createdBy: 'user-123',
      maxUses: 10
    })

    // 3. Verify in IndexedDB immediately
    const localCode = await db.inviteCodes.get(inviteCode.id)
    expect(localCode).toBeDefined()

    // 4. Wait for sync to complete (~300ms)
    await new Promise(resolve => setTimeout(resolve, 500))

    // 5. Verify in Supabase
    const { data } = await supabase
      .from('invite_codes')
      .select('*')
      .eq('id', inviteCode.id)
      .single()

    expect(data).toBeDefined()
    expect(data.code).toBe(inviteCode.code)
    expect(data.band_id).toBe(band.id)
  })
})
```

---

### E2E Tests (Required)

**Test File:** `tests/e2e/auth/join-band.spec.ts`

**What E2E Tests Verify:**
- Full user flow from band creation to joining
- Multi-user validation (User 2 can join User 1's band)
- UI correctly displays invite codes
- Navigation after successful join

**Run E2E Tests:**
```bash
npm run test:e2e -- tests/e2e/auth/join-band.spec.ts
```

**Expected:** All tests pass

---

## Validation & Acceptance Criteria

### Success Criteria

**Must Pass:**
1. ✅ Unit tests for all repository methods pass
2. ✅ E2E test `join-band.spec.ts` passes
3. ✅ Invite codes appear in Supabase within ~300ms of creation
4. ✅ User 2 can join User 1's band using invite code
5. ✅ Both users see each other in band members list
6. ✅ Usage count increments correctly in both IndexedDB and Supabase
7. ✅ TypeScript compiles without errors
8. ✅ No regression - all existing tests still pass

**Performance Targets:**
- Local write: < 50ms (instant UI update)
- Sync to Supabase: ~300ms average latency
- Validation query: < 200ms (direct Supabase query)

---

### Database Verification Queries

**After implementing, run these SQL queries to verify:**

```sql
-- 1. Check invite code exists in Supabase
SELECT code, band_id, created_by, is_active, current_uses
FROM invite_codes
WHERE code = 'YOUR_CODE_HERE';
-- Should return 1 row matching IndexedDB

-- 2. Verify field mapping (snake_case in Supabase)
SELECT
  id,
  band_id,      -- NOT bandId
  created_by,   -- NOT createdBy
  created_date, -- NOT createdDate
  max_uses,     -- NOT maxUses
  current_uses, -- NOT currentUses
  is_active     -- NOT isActive
FROM invite_codes
LIMIT 1;
-- All column names should be snake_case

-- 3. Check usage count updates
SELECT code, current_uses FROM invite_codes WHERE code = 'YOUR_CODE_HERE';
-- Should increment after each successful join

-- 4. Verify RLS policies work
SELECT * FROM invite_codes; -- Run as different user
-- Should only see invite codes for bands you're in
```

---

## Risk Assessment

### Low Risk
- **Why:** Following established patterns that already work for songs, bands, setlists
- **Mitigation:** All changes isolated to invite codes, won't affect existing sync

### Potential Issues & Mitigations

**Issue 1: Field Mapping Errors**
- **Symptom:** `undefined` fields in Supabase or TypeScript
- **Solution:** Double-check `mapInviteCodeToSupabase()` / `mapInviteCodeFromSupabase()`
- **Validation:** Unit tests for mapping functions

**Issue 2: Sync Queue Not Processing**
- **Symptom:** Codes in IndexedDB but not in Supabase after 1 second
- **Solution:** Check `SyncEngine.queueCreate()` is called, inspect queue in DevTools
- **Validation:** Integration test with timing check

**Issue 3: RLS Policy Blocks Writes**
- **Symptom:** Supabase returns permission error
- **Solution:** Verify RLS policies allow INSERT for band members
- **Validation:** SQL test in Supabase Studio

**Issue 4: E2E Test Flakiness**
- **Symptom:** Test passes sometimes, fails others
- **Solution:** Add proper waits for sync completion (500ms buffer)
- **Validation:** Run test 10 times, should pass 10/10

---

## Rollback Plan

**If implementation fails or causes regressions:**

1. **Revert code changes:**
```bash
git checkout HEAD~1 -- src/services/data/
git checkout HEAD~1 -- src/services/BandMembershipService.ts
git checkout HEAD~1 -- src/pages/NewLayout/AuthPages.tsx
```

2. **Restore direct IndexedDB writes:**
- Keep `db.inviteCodes.add()` in BandMembershipService
- Keep `db.inviteCodes.add()` in AuthPages.tsx
- Keep manual Supabase query in `validateInviteCode()`

3. **Manual workaround for testing:**
```sql
-- Manually insert invite codes into Supabase for E2E tests
INSERT INTO invite_codes (id, code, band_id, created_by, created_date, is_active, max_uses, current_uses)
VALUES (gen_random_uuid(), 'ROCK8388', 'band-id-here', 'user-id-here', NOW(), true, 10, 0);
```

---

## Estimated Effort Breakdown

| Task | Estimated Time | Complexity |
|------|---------------|-----------|
| 1. Add to IDataRepository | 30 min | Low |
| 2. LocalRepository implementation | 45 min | Low |
| 3. RemoteRepository implementation | 60 min | Medium (field mapping) |
| 4. SyncRepository implementation | 10 min | Low |
| 5. Update SyncEngine | 20 min | Low |
| 6. Update BandMembershipService | 20 min | Low |
| 7. Update AuthPages | 15 min | Low |
| 8. Unit tests | 60 min | Medium |
| 9. Manual testing | 30 min | Low |
| 10. E2E testing | 15 min | Low |
| 11. Realtime sync (optional) | 30 min | Medium |

**Total Core Tasks (1-10):** 4-5 hours
**Total with Optional Realtime (11):** 5-6 hours

---

## Related Documentation

**Must Read Before Starting:**
- `.claude/specifications/unified-database-schema.md` - Field mappings reference
- `.claude/specifications/2025-10-30T13:25_bidirectional-sync-specification.md` - Sync architecture
- `.claude/artifacts/2025-11-11T04:51_invite-codes-not-syncing-critical-bug.md` - Problem analysis

**Code Reference:**
- `src/services/data/RemoteRepository.ts` - See `mapSongToSupabase()` for field mapping pattern
- `src/services/data/SyncRepository.ts` - See `addSong()` for queue pattern
- `tests/unit/services/data/RemoteRepository.test.ts` - See field mapping tests

**User Flows:**
- `.claude/specifications/2025-10-22T22:28_app-pages-and-workflows.md` - Band management flows

---

## Success Indicators

**You'll know it's working when:**

1. **Developer Console:**
```
[SyncEngine] Queued CREATE for invite_codes: { id: '...', code: 'ROCK8388', ... }
[SyncEngine] Successfully synced invite_codes (300ms)
[RemoteRepository] Created invite code in Supabase: ROCK8388
```

2. **Browser DevTools → IndexedDB:**
```
RockOnDB → inviteCodes → { id: '...', code: 'ROCK8388', bandId: '...', ... }
```

3. **Supabase Studio → invite_codes table:**
```
id | code     | band_id | created_by | is_active | current_uses | max_uses
---|----------|---------|------------|-----------|--------------|----------
...| ROCK8388 | band-id | user-id    | true      | 0            | 10
```

4. **E2E Test Output:**
```
✓ User 1 creates band and gets invite code (2.3s)
✓ User 2 joins band with invite code (1.8s)
✓ Both users see each other in band members (1.2s)

3 passing (5.3s)
```

---

## Next Steps After Completion

Once invite codes sync is working:

1. **Verify production behavior:**
   - Deploy to staging environment
   - Test with real Supabase instance (not local)
   - Verify RLS policies work correctly

2. **Monitor sync performance:**
   - Check SyncEngine logs for latency
   - Ensure sync queue doesn't back up
   - Verify retries work on network failures

3. **Consider enhancements:**
   - Add invite code expiration notifications
   - Show usage statistics in UI
   - Add invite link generation (not just codes)
   - QR code generation for easy sharing

4. **Update documentation:**
   - Document invite code lifecycle
   - Update API documentation
   - Add troubleshooting guide for common issues

---

---

## 🚨 UPDATED SUMMARY (2025-11-11T14:13)

### Current Status: BLOCKED

**Tasks Complete:** 7/11 (64%)
- ✅ Task 1: Repository interface updated
- ✅ Task 2: LocalRepository implemented
- ✅ Task 3: RemoteRepository implemented (but has schema bug)
- ✅ Task 4: SyncRepository implemented
- ✅ Task 5: SyncEngine updated
- ✅ Task 6: BandMembershipService refactored (but has schema bug)
- ✅ Task 7: AuthPages updated (but has schema bug)

**Tasks Blocked:** 4/11 (36%)
- ❌ Task 0: **CRITICAL** - Schema fix required (NEW, blocks all remaining)
- ❌ Task 0.5: Test fixture bug fix (NEW, blocks E2E tests)
- 🔄 Task 8: Unit tests (blocked by Task 0)
- 🔄 Task 9: Manual testing (blocked by Task 0)
- 🔄 Task 10: E2E testing (blocked by Task 0, 0.5)
- ⏭️ Task 11: Realtime sync (optional, skippable)

### What's Working
- ✅ Repository pattern integration complete
- ✅ Invite code creation writes to IndexedDB successfully
- ✅ Invite code retrieval from IndexedDB works
- ✅ TypeScript compilation passes (1 pre-existing unrelated error)
- ✅ Code architecture is correct

### What's Broken
- ❌ Sync to Supabase fails (NOT NULL constraint violation on expires_at)
- ❌ Multi-user join fails (User 2 can't retrieve User 1's invite code)
- ❌ E2E tests fail (page doesn't navigate after join attempt)
- ❌ Test fixture has wrong field name (created_at vs created_date)

### Root Cause
**Schema Mismatch:** The `expires_at` column is `NOT NULL` in Supabase but `expiresAt` is optional in TypeScript model. When invite codes are created without expiration dates, Supabase INSERT fails silently.

See `.claude/artifacts/2025-11-11T14:13_invite-code-root-cause-analysis.md` for complete analysis.

### Immediate Next Steps (Priority Order)

1. **⚡ Fix Schema (15 min) - CRITICAL**
   - Edit `supabase/migrations/20251106000000_baseline_schema.sql:103`
   - Change `expires_at TIMESTAMPTZ NOT NULL,` to `expires_at TIMESTAMPTZ,`
   - Run `supabase db reset` to apply changes
   - Verify with SQL query

2. **⚡ Fix Test Fixture (5 min) - HIGH**
   - Edit `tests/fixtures/bands.ts:153`
   - Change `created_at` to `created_date`
   - Verify test fixture can create bands

3. **🔧 Improve Error Handling (20 min) - MEDIUM**
   - Add better error logging in SyncEngine
   - Surface Supabase errors in AuthPages
   - Display specific error messages to users

4. **🧪 Manual Testing (30 min) - HIGH**
   - Reset local database
   - Test band creation with 2 browsers
   - Verify invite code in Supabase
   - Test multi-user join flow

5. **🧪 E2E Testing (15 min) - HIGH**
   - Run `npm run test:e2e -- tests/e2e/auth/join-band.spec.ts`
   - All tests should pass
   - Verify no console errors

6. **📝 Unit Tests (60 min) - MEDIUM**
   - Add repository method tests
   - Add field mapping tests
   - Add error case tests

### Estimated Time to Complete
- **With schema fix:** ~1-1.5 hours (Tasks 0, 0.5, 8-10)
- **Without schema fix:** BLOCKED indefinitely

### Success Metrics
- [ ] Schema change applied and verified
- [ ] Invite codes sync to Supabase (< 500ms)
- [ ] User 2 can join User 1's band
- [ ] E2E test passes consistently
- [ ] No console errors during flow
- [ ] Usage count increments correctly

---

**Status:** Implementation 64% complete, blocked on schema fix
**Last Updated:** 2025-11-11T14:13 (comprehensive root cause analysis complete)
**Original Estimate:** 4-6 hours
**Actual Time Spent:** ~3 hours (Tasks 1-7)
**Remaining Estimate:** ~1.5 hours (Tasks 0, 0.5, 8-10)
**Blocker:** Database schema migration required before testing can proceed
