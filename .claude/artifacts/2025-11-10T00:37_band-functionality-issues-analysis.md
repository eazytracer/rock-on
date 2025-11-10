---
title: Band Functionality Issues - Analysis & Test Requirements
created: 2025-11-10T00:37
status: Active
type: Bug Analysis
description: Comprehensive analysis of band invite code and band selection issues discovered during authentication testing
---

# Band Functionality Issues - Analysis & Test Requirements

## Executive Summary

During authentication testing with Google OAuth, we discovered **5 critical issues** with band functionality:

1. ❌ **Invite code not visible after regeneration** (requires manual page refresh)
2. ❌ **Invite code validation fails** ("No such band or code is invalid")
3. ❌ **Nav shows "No Band Selected" after creating band**
4. ✅ **Band name shows correctly on Band Members page** (but nowhere else)
5. ❌ **State inconsistency**: localStorage has band but React state doesn't

**Impact:** Users cannot successfully join bands via invite codes, and band creation doesn't properly set the active band.

---

## Issue 1: Invite Code Not Visible After Regeneration

### User Experience
1. User navigates to Band Members page
2. User clicks "Regenerate" invite code button
3. New code is generated (backend succeeds)
4. ❌ **UI does not update** - still shows old code or "No active code"
5. User must manually refresh page (F5) to see new code

### Root Cause

**File:** `/workspaces/rock-on/src/pages/NewLayout/BandMembersPage.tsx`

**Problem:** React state doesn't update after `generateCode()` completes

**Code Analysis:**
```tsx
// Line 254-264: Regenerate button handler
const handleRegenerateCode = async () => {
  if (confirm('Generate a new invite code? The old one will stop working.')) {
    await generateCode()  // ← Async operation completes
    // ❌ NO state refresh here
    // ❌ inviteCodes state is stale
  }
}

// Line 91-105: useBandInviteCodes hook
const { data: inviteCodes } = useBandInviteCodes(currentBandId || undefined)
// This hook doesn't refetch after generateCode() completes
```

**Why it fails:**
1. `generateCode()` creates new code in IndexedDB
2. React Query cache still has old invite codes
3. UI renders stale data from cache
4. Only a hard refresh invalidates the cache

**Expected behavior:**
After `generateCode()` completes, the UI should:
1. Invalidate the `useBandInviteCodes` query cache
2. Refetch invite codes from IndexedDB
3. Re-render with new code immediately

---

### Missing Tests

#### Unit Tests Needed

**File:** `tests/unit/pages/BandMembersPage.test.tsx` (🔲 Does not exist)

```typescript
describe('BandMembersPage - Invite Code Regeneration', () => {
  it('should display new invite code immediately after regeneration', async () => {
    // Setup: Render page with initial invite code
    const { getByText, findByText } = render(<BandMembersPage />)

    // Verify initial code displayed
    expect(getByText('ABC123')).toBeInTheDocument()

    // User clicks "Regenerate"
    const regenerateBtn = getByText('Regenerate')
    fireEvent.click(regenerateBtn)

    // Confirm dialog
    fireEvent.click(getByText('OK'))

    // Wait for async operation
    await waitFor(() => {
      // New code should appear WITHOUT page refresh
      expect(findByText('XYZ789')).toBeInTheDocument()
      expect(queryByText('ABC123')).not.toBeInTheDocument()
    })
  })

  it('should invalidate React Query cache after code generation', async () => {
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

    // Click regenerate
    fireEvent.click(getByText('Regenerate'))
    fireEvent.click(getByText('OK'))

    await waitFor(() => {
      // Verify React Query cache was invalidated
      expect(invalidateQueries).toHaveBeenCalledWith(['bandInviteCodes', bandId])
    })
  })
})
```

#### Integration Tests Needed

**File:** `tests/integration/band-invite-codes.test.ts` (🔲 Does not exist)

```typescript
describe('Band Invite Code Flow - Integration', () => {
  it('should regenerate code and persist to IndexedDB', async () => {
    // Create initial invite code
    const code1 = await BandMembershipService.createInviteCode({
      bandId,
      createdBy: userId
    })

    // Regenerate
    const code2 = await BandMembershipService.createInviteCode({
      bandId,
      createdBy: userId
    })

    // Verify both codes exist in IndexedDB
    const codes = await db.inviteCodes.where('bandId').equals(bandId).toArray()
    expect(codes).toHaveLength(2)
    expect(codes.map(c => c.code)).toContain(code1.code)
    expect(codes.map(c => c.code)).toContain(code2.code)
  })
})
```

---

## Issue 2: Invite Code Validation Fails

### User Experience
1. Admin generates invite code `ABC123`
2. Admin shares code with friend
3. Friend enters code in "Join Band" form
4. Friend clicks "Validate Code"
5. ❌ **Error: "No such band or the code is invalid"**
6. Code exists in database but validation fails

### Root Cause

**File:** `/workspaces/rock-on/src/services/BandMembershipService.ts`

**Problem:** Invite codes only in IndexedDB, not synced to Supabase

**Code Analysis:**
```typescript
// Line 64-84: validateInviteCode()
export async function validateInviteCode(code: string): Promise<ValidationResult> {
  const upperCode = code.toUpperCase()

  // ❌ Only queries IndexedDB
  const inviteCode = await db.inviteCodes
    .where('code')
    .equals(upperCode)
    .first()

  // ❌ If user B doesn't have code in their local IndexedDB, it fails
  if (!inviteCode) {
    return { valid: false, error: 'Invalid invite code' }
  }

  // Other validation checks...
}
```

**Why it fails:**
1. User A creates band → code stored in User A's IndexedDB
2. Code **should** sync to Supabase but may not have yet
3. User B (different device/browser) tries to join
4. User B queries **their own** IndexedDB → code not found
5. Validation fails even though code exists

**Expected behavior:**
1. Invite codes should be queried from **Supabase** (server) not IndexedDB (local)
2. All users should be able to validate any active code
3. Sync should ensure codes are in Supabase before sharing

---

### Missing Tests

#### Unit Tests Needed

**File:** `tests/unit/services/BandMembershipService.test.ts` (⚠️ Exists but incomplete)

**Current status:** File exists but doesn't test invite code validation

**Tests to add:**
```typescript
describe('BandMembershipService - Invite Code Validation', () => {
  it('should validate invite code from Supabase, not IndexedDB', async () => {
    // Setup: Code exists in Supabase but NOT in local IndexedDB
    const supabaseCode = await supabase.from('invite_codes').insert({
      band_id: bandId,
      code: 'ABC123',
      created_by: userId,
      expires_at: futureDate,
      max_uses: 10,
      current_uses: 0
    })

    // Verify local IndexedDB does NOT have the code
    const localCode = await db.inviteCodes.where('code').equals('ABC123').first()
    expect(localCode).toBeUndefined()

    // Validation should still succeed (queries Supabase)
    const result = await validateInviteCode('ABC123')
    expect(result.valid).toBe(true)
    expect(result.inviteCode).toBeDefined()
  })

  it('should reject expired invite codes', async () => {
    const expiredCode = await createInviteCode({
      bandId,
      createdBy: userId,
      expiresAt: new Date('2020-01-01') // Past date
    })

    const result = await validateInviteCode(expiredCode.code)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('expired')
  })

  it('should reject codes that exceeded max uses', async () => {
    const maxedCode = await createInviteCode({
      bandId,
      createdBy: userId,
      maxUses: 5
    })

    // Simulate 5 uses
    await db.inviteCodes.update(maxedCode.id, { currentUses: 5 })

    const result = await validateInviteCode(maxedCode.code)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('maximum')
  })
})
```

#### Integration Tests Needed

**File:** `tests/integration/band-joining.test.ts` (🔲 Does not exist)

```typescript
describe('Band Joining - Cross-User Integration', () => {
  it('should allow User B to join band using code from User A', async () => {
    // User A creates band and gets invite code
    const userA = await createTestUser('userA@example.com')
    const band = await BandService.createBand({ name: 'Test Band' }, userA.id)
    const inviteCode = await BandMembershipService.createInviteCode({
      bandId: band.id,
      createdBy: userA.id
    })

    // Wait for sync to Supabase
    await waitForSync()

    // User B (different session/device) validates code
    const userB = await createTestUser('userB@example.com')
    const validation = await BandMembershipService.validateInviteCode(inviteCode.code)

    // Should succeed even though User B doesn't have code in their IndexedDB
    expect(validation.valid).toBe(true)

    // User B joins
    const membership = await BandMembershipService.joinBandWithCode(
      inviteCode.code,
      userB.id
    )

    expect(membership).toBeDefined()
    expect(membership.bandId).toBe(band.id)
    expect(membership.userId).toBe(userB.id)
    expect(membership.role).toBe('member')
  })
})
```

#### E2E Tests Needed

**File:** `tests/e2e/band-invite-flow.spec.ts` (🔲 Does not exist)

```typescript
describe('Band Invite Code - E2E Flow', () => {
  test('User A creates band, User B joins with code', async ({ browser }) => {
    // User A session
    const contextA = await browser.newContext()
    const pageA = await contextA.newPage()
    await pageA.goto('/auth')
    await signIn(pageA, 'userA@example.com', 'password')

    // User A creates band
    await createBand(pageA, 'Rock Stars')

    // User A gets invite code
    await pageA.goto('/band-members')
    const inviteCode = await pageA.locator('[data-testid="invite-code"]').textContent()

    // User B session (separate browser context)
    const contextB = await browser.newContext()
    const pageB = await contextB.newPage()
    await pageB.goto('/auth')
    await signIn(pageB, 'userB@example.com', 'password')

    // User B joins band with code
    await pageB.goto('/auth?view=get-started')
    await pageB.click('text=Join an existing band')
    await pageB.fill('[data-testid="invite-code-input"]', inviteCode)
    await pageB.click('text=Validate Code')

    // Should show band name for confirmation
    await expect(pageB.locator('text=Rock Stars')).toBeVisible()

    await pageB.click('text=Join Band')

    // Should navigate to songs page
    await expect(pageB).toHaveURL('/songs')

    // Should show band name in nav
    await expect(pageB.locator('[data-testid="current-band-name"]')).toHaveText('Rock Stars')
  })
})
```

---

## Issue 3: Nav Shows "No Band Selected" After Creating Band

### User Experience
1. User creates new band named "Rock Stars"
2. User is redirected to `/songs` page
3. ❌ **Nav displays "No Band Selected"**
4. Band exists in database and localStorage
5. Navigating to Band Members page DOES show "Rock Stars"
6. Going back to Songs page shows "No Band Selected" again

### Root Cause

**Files:**
- `/workspaces/rock-on/src/pages/NewLayout/AuthPages.tsx` (Band creation)
- `/workspaces/rock-on/src/contexts/AuthContext.tsx` (State management)

**Problem:** Band creation updates localStorage but NOT React state

**Code Analysis:**

**In AuthPages.tsx (Lines 738-795):**
```tsx
const handleCreateBand = async () => {
  // 1. Create band in IndexedDB
  const bandId = await createBand({ name: bandName }, currentUserId)

  // 2. Create invite code
  await db.inviteCodes.add({...})

  // 3. ❌ ONLY updates localStorage, NOT React state
  localStorage.setItem('currentBandId', bandId)

  // 4. Navigate to songs page
  navigate('/songs')
}
```

**In AuthContext.tsx (Lines 59, 352-410):**
```tsx
// React state that pages actually use
const [currentBand, setCurrentBand] = useState<Band | null>(null)
const [currentBandId, setCurrentBandId] = useState<string | null>(null)

// Pages render with this
<ModernLayout bandName={currentBand?.name || 'No Band Selected'} />
```

**Why it fails:**
1. `handleCreateBand()` sets `localStorage.currentBandId` ✅
2. `handleCreateBand()` does NOT call `setCurrentBand()` ❌
3. User navigates to `/songs`
4. SongsPage reads `currentBand` from AuthContext → null
5. UI displays `'No Band Selected'`

**Exception: Band Members page (Lines 113-134):**
```tsx
// Band Members page DOES manually load band from localStorage
useEffect(() => {
  const loadBand = async () => {
    const storedBandId = localStorage.getItem('currentBandId')
    if (storedBandId) {
      const band = await db.bands.get(storedBandId)
      // Uses local state, not AuthContext
      setBandName(band?.name || 'Unknown Band')
    }
  }
  loadBand()
}, [])
```

This is why Band Members page shows the correct name!

**Expected behavior:**
After creating a band, AuthContext's `currentBand` state should be updated to reflect the new band.

---

### Missing Tests

#### Unit Tests Needed

**File:** `tests/unit/contexts/AuthContext.test.tsx` (⚠️ Exists but incomplete)

**Tests to add:**
```typescript
describe('AuthContext - Band Selection', () => {
  it('should update currentBand state after creating band', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

    // Initially no band
    expect(result.current.currentBand).toBeNull()

    // Create band
    const bandId = await createBand({ name: 'New Band' }, userId)

    // Simulate what should happen (but doesn't currently)
    // This test would FAIL with current implementation
    await waitFor(() => {
      expect(result.current.currentBand).toBeDefined()
      expect(result.current.currentBand?.name).toBe('New Band')
      expect(result.current.currentBandId).toBe(bandId)
    })
  })

  it('should sync currentBand from localStorage on mount', async () => {
    // Setup: localStorage has bandId
    localStorage.setItem('currentBandId', 'band-123')
    await db.bands.add({
      id: 'band-123',
      name: 'Existing Band',
      createdDate: new Date(),
      settings: {},
      memberIds: []
    })

    // Mount AuthContext
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

    // Should load band from localStorage
    await waitFor(() => {
      expect(result.current.currentBand?.name).toBe('Existing Band')
    })
  })
})
```

#### Integration Tests Needed

**File:** `tests/integration/band-creation-flow.test.ts` (🔲 Does not exist)

```typescript
describe('Band Creation Flow - Integration', () => {
  it('should update all state layers after band creation', async () => {
    const userId = 'user-123'
    const bandName = 'Test Band'

    // Create band (simulates handleCreateBand())
    const bandId = await createBand({ name: bandName }, userId)
    localStorage.setItem('currentBandId', bandId)

    // Verify all 3 state layers are consistent
    // 1. localStorage
    expect(localStorage.getItem('currentBandId')).toBe(bandId)

    // 2. IndexedDB
    const bandInDB = await db.bands.get(bandId)
    expect(bandInDB?.name).toBe(bandName)

    // 3. React Context (via hook)
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })
    await waitFor(() => {
      expect(result.current.currentBand?.id).toBe(bandId)
      expect(result.current.currentBand?.name).toBe(bandName)
    })
  })
})
```

#### E2E Tests Needed

**File:** `tests/e2e/band-creation.spec.ts` (🔲 Does not exist)

```typescript
describe('Band Creation - E2E', () => {
  test('should show band name in nav immediately after creation', async ({ page }) => {
    await page.goto('/auth')
    await signIn(page, 'user@example.com', 'password')

    // Create band
    await page.goto('/auth?view=get-started')
    await page.click('text=Create a new band')
    await page.fill('[data-testid="band-name-input"]', 'My Awesome Band')
    await page.click('text=Create Band')

    // Should redirect to songs page
    await expect(page).toHaveURL('/songs')

    // Band name should appear in nav WITHOUT page refresh
    await expect(page.locator('[data-testid="current-band-name"]')).toHaveText('My Awesome Band')

    // Navigate to other pages - band name should persist
    await page.click('text=Setlists')
    await expect(page.locator('[data-testid="current-band-name"]')).toHaveText('My Awesome Band')

    await page.click('text=Shows')
    await expect(page.locator('[data-testid="current-band-name"]')).toHaveText('My Awesome Band')
  })
})
```

---

## Issue 4: Band Name Shows on Band Members Page Only

### User Experience
✅ **This is actually working correctly!**

**Why it works:**
Band Members page has its own `loadBand()` function that reads directly from localStorage and IndexedDB, bypassing AuthContext.

**Code:** `/workspaces/rock-on/src/pages/NewLayout/BandMembersPage.tsx` (Lines 113-134)

```tsx
useEffect(() => {
  const loadBand = async () => {
    const storedBandId = localStorage.getItem('currentBandId')
    if (storedBandId) {
      const band = await db.bands.get(storedBandId)
      setBandName(band?.name || 'Unknown Band')
    }
  }
  loadBand()
}, [])
```

**Analysis:**
This is a **workaround** that other pages should NOT need. The proper fix is Issue #3 - make AuthContext update its state after band creation.

---

## Issue 5: State Inconsistency Between localStorage and React

### Root Cause Summary

**The Problem:** 3-tier state system that doesn't stay in sync

| State Tier | Updated By | Read By | Synced? |
|------------|-----------|---------|---------|
| localStorage | Band creation, join, switchBand() | ProtectedRoute, Band Members page | ✅ |
| AuthContext (React) | Auth state change, switchBand() | All pages (nav, content) | ❌ |
| IndexedDB | All CRUD operations | Services, hooks | ✅ |

**The Gap:**
Band creation/joining updates localStorage + IndexedDB but NOT AuthContext.

**Solution Needed:**
After band creation/joining, call:
```tsx
// Option 1: Reload user data
await context.login(userId)

// Option 2: Direct band switch
await context.switchBand(bandId)

// Option 3: New unified function
await context.createBandAndSelect({ name: bandName }, userId)
```

---

## Test Coverage Summary

### Current Status

| Category | Exists | Passing | Coverage | Notes |
|----------|--------|---------|----------|-------|
| **Unit Tests** | | | | |
| BandMembersPage | ❌ | N/A | 0% | File doesn't exist |
| BandMembershipService | ⚠️ | Unknown | ~30% | Exists but incomplete |
| AuthContext | ⚠️ | Unknown | ~40% | Doesn't test band selection |
| **Integration Tests** | | | | |
| Invite code flow | ❌ | N/A | 0% | Not implemented |
| Band creation flow | ❌ | N/A | 0% | Not implemented |
| Cross-user scenarios | ❌ | N/A | 0% | Not implemented |
| **E2E Tests** | | | | |
| Band invite flow | ❌ | N/A | 0% | Not implemented |
| Band creation | ❌ | N/A | 0% | Not implemented |
| Nav state consistency | ❌ | N/A | 0% | Not implemented |

---

## Recommended Test Implementation Order

### Phase 1: Critical Fixes (Week 1)
**Priority: HIGH** - These bugs block core functionality

1. ✅ **Fix Issue #2 first** (Invite code validation)
   - Test: `validateInviteCode()` queries Supabase
   - Test: Cross-user invite code validation
   - E2E: Full invite flow (User A → User B)

2. ✅ **Fix Issue #3 second** (Nav state after band creation)
   - Test: AuthContext updates `currentBand` state
   - Test: Band creation triggers state sync
   - E2E: Band name visible immediately

### Phase 2: UX Polish (Week 2)
**Priority: MEDIUM** - Affects user experience

3. ✅ **Fix Issue #1** (Invite code regeneration UI)
   - Test: React Query cache invalidation
   - Test: UI updates without refresh
   - E2E: Code regeneration flow

### Phase 3: Refactoring (Week 3)
**Priority: LOW** - Technical debt

4. ✅ **Consolidate state management** (Issue #5)
   - Test: 3-tier state consistency
   - Test: State sync on all operations
   - Refactor: Unified band selection API

---

## Files That Need Tests

### New Test Files to Create

```
tests/
├── unit/
│   ├── pages/
│   │   └── BandMembersPage.test.tsx          🔲 NEW
│   ├── services/
│   │   └── BandMembershipService.test.ts     ⚠️ EXPAND
│   └── contexts/
│       └── AuthContext.test.tsx               ⚠️ EXPAND
├── integration/
│   ├── band-invite-codes.test.ts              🔲 NEW
│   ├── band-joining.test.ts                   🔲 NEW
│   └── band-creation-flow.test.ts             🔲 NEW
└── e2e/
    ├── band-invite-flow.spec.ts               🔲 NEW
    ├── band-creation.spec.ts                  🔲 NEW
    └── nav-state-consistency.spec.ts          🔲 NEW
```

### Existing Test Files to Expand

```
tests/unit/services/BandMembershipService.test.ts
  ✅ Current: Basic service initialization
  ❌ Missing: Invite code validation scenarios
  ❌ Missing: Cross-user validation
  ❌ Missing: Expiration and max-use checks

tests/unit/contexts/AuthContext.test.tsx
  ✅ Current: Auth state changes
  ❌ Missing: Band selection on creation
  ❌ Missing: localStorage sync
  ❌ Missing: State consistency
```

---

## Code Files That Need Fixes

### High Priority

1. **`/src/services/BandMembershipService.ts`**
   - Issue: validateInviteCode() queries IndexedDB instead of Supabase
   - Fix: Add Supabase query with fallback to IndexedDB
   - Lines: 64-84

2. **`/src/pages/NewLayout/AuthPages.tsx`**
   - Issue: handleCreateBand() doesn't update AuthContext
   - Fix: Call `context.switchBand(bandId)` after creation
   - Lines: 738-795

3. **`/src/contexts/AuthContext.tsx`**
   - Issue: No API for post-creation band selection
   - Fix: Add `createBandAndSelect()` or `refreshCurrentBand()` method
   - Lines: 352-410

### Medium Priority

4. **`/src/pages/NewLayout/BandMembersPage.tsx`**
   - Issue: Invite code state not refreshed after regeneration
   - Fix: Invalidate React Query cache after `generateCode()`
   - Lines: 254-264

5. **`/src/hooks/useBands.ts`**
   - Issue: No cache invalidation hooks exposed
   - Fix: Export `invalidateBandInviteCodes()` function
   - Lines: 163-203

---

## Test Data Requirements

### Test Users
```typescript
const testUsers = [
  {
    email: 'admin@test.com',
    password: 'TestPass123!',
    name: 'Admin User',
    role: 'admin'
  },
  {
    email: 'member@test.com',
    password: 'TestPass123!',
    name: 'Member User',
    role: 'member'
  }
]
```

### Test Bands
```typescript
const testBands = [
  {
    name: 'Test Band Alpha',
    adminUserId: 'admin-user-id',
    inviteCode: 'ABC123',
    inviteExpiry: futureDate(30) // 30 days from now
  }
]
```

### Test Invite Codes
```typescript
const testInviteCodes = [
  {
    code: 'VALID1',
    bandId: 'band-1',
    expiresAt: futureDate(30),
    maxUses: 10,
    currentUses: 0,
    isActive: true
  },
  {
    code: 'EXPIRED',
    bandId: 'band-1',
    expiresAt: pastDate(-5), // 5 days ago
    maxUses: 10,
    currentUses: 0,
    isActive: true
  },
  {
    code: 'MAXED',
    bandId: 'band-1',
    expiresAt: futureDate(30),
    maxUses: 5,
    currentUses: 5, // At max
    isActive: true
  }
]
```

---

## Success Criteria

### For Issue #1 (Invite Code Regeneration)
- ✅ Clicking "Regenerate" shows new code immediately (no refresh needed)
- ✅ UI update happens within 500ms
- ✅ Old code becomes invalid immediately

### For Issue #2 (Invite Code Validation)
- ✅ User B can validate code created by User A
- ✅ Validation queries Supabase (server-side)
- ✅ Expired codes rejected with clear error
- ✅ Max-use codes rejected with clear error

### For Issue #3 (Nav State After Band Creation)
- ✅ Band name appears in nav immediately after creation
- ✅ Band name persists across page navigation
- ✅ No "No Band Selected" shown if band exists
- ✅ Page refresh maintains band selection

### For Issue #5 (State Consistency)
- ✅ localStorage, React state, and IndexedDB stay in sync
- ✅ Band creation updates all 3 state layers
- ✅ Band joining updates all 3 state layers
- ✅ No manual page refresh needed

---

## Next Steps

1. **Create test files** in the order specified (Phase 1 → Phase 2 → Phase 3)
2. **Run tests** to confirm they fail (TDD approach)
3. **Fix code** to make tests pass
4. **Verify E2E** that entire flows work correctly
5. **Update documentation** with new APIs and state management patterns

---

**Last Updated:** 2025-11-10T00:37
**Status:** Ready for Implementation
**Assigned To:** Development Team
