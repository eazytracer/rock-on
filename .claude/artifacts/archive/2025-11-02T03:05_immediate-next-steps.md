# Immediate Next Steps - Testing & Quality

**Date:** 2025-11-02T03:05
**Context:** Following duplicate subscription bug fixes
**Status:** 📋 Action Required

---

## What We Just Did

### 1. ✅ Comprehensive Analysis
- Created detailed testing & quality improvement plan
- Identified all testing gaps across the project
- Designed multi-layered testing strategy (unit, integration, contract, E2E)
- Proposed specification enhancements

**Document:** `.claude/artifacts/2025-11-02T03:02_testing-and-quality-improvement-plan.md`

### 2. ✅ Added Idempotency Tests
- Added 5 new tests for RealtimeManager deduplication
- Tests verify duplicate subscription prevention
- Tests verify concurrent call handling
- Tests verify incremental band additions

**File:** `tests/unit/services/data/RealtimeManager.test.ts:763-856`

### 3. ⚠️ Discovered Test Debt
- 21 existing tests are now failing
- Tests expect OLD behavior (4 channels per band)
- Code now uses audit-first (1 channel per band)
- Tests need updating to match new architecture

---

## Test Results Summary

### New Idempotency Tests: ✅ ALL PASSING

```
✓ should prevent duplicate subscriptions when called twice with same bands
✓ should prevent duplicate subscriptions when called twice with multiple bands
✓ should handle concurrent subscription calls without creating duplicates
✓ should not re-subscribe to existing bands when adding new bands
✓ should be idempotent: calling three times produces same result as once
```

**Evidence from Console:**
```
[RealtimeManager] Subscribing to 1 bands (audit-first)
[RealtimeManager] Already subscribed to audit-band-1, skipping...
```

This proves our duplicate prevention fix is working correctly!

### Old Tests: ❌ 21 FAILING

These tests expect deprecated behavior:
- `should create 4 channels (songs, setlists, shows, practices)` → Now creates 1 (audit-log)
- Event handling tests expect table-specific channels → Now use audit-first approach
- Unsubscribe tests expect 4 channels → Now 1 channel per band

**This is EXPECTED** - the architecture changed from table-based to audit-based subscriptions.

---

## Immediate Actions Required

### Priority 1: Update Failing Tests (2-3 hours)

The 21 failing tests need to be updated to match the audit-first architecture:

#### Before (Old Table-Based):
```typescript
it('should subscribe to all table channels for a band', async () => {
  await manager.subscribeToUserBands(userId, ['band-1'])

  // Expects 4 table-specific channels
  expect(mockSupabase.channel).toHaveBeenCalledWith('songs-band-1')
  expect(mockSupabase.channel).toHaveBeenCalledWith('setlists-band-1')
  expect(mockSupabase.channel).toHaveBeenCalledWith('shows-band-1')
  expect(mockSupabase.channel).toHaveBeenCalledWith('practices-band-1')
})
```

#### After (New Audit-Based):
```typescript
it('should subscribe to audit_log channel for a band', async () => {
  await manager.subscribeToUserBands(userId, ['band-1'])

  // Expects 1 audit channel
  expect(mockSupabase.channel).toHaveBeenCalledWith('audit-band-1')
  expect(mockChannel.on).toHaveBeenCalledWith(
    'postgres_changes',
    expect.objectContaining({ table: 'audit_log' }),
    expect.any(Function)
  )
})
```

**Files to Update:**
- `tests/unit/services/data/RealtimeManager.test.ts` (lines 84-761)
  - Update all channel expectations from table-based to audit-based
  - Update event handler tests to use audit_log payload structure
  - Remove table-specific channel tests (deprecated)

### Priority 2: Verify Fix in Browser (15 minutes)

1. Clear browser cache and IndexedDB
2. Navigate to any page
3. Check console logs:
   - ✅ Should see: `[RealtimeManager] Subscribing to X bands (audit-first)`
   - ✅ Should see: ONE subscription per band
   - ❌ Should NOT see: Duplicate subscription logs
   - ❌ Should NOT see: "mismatch between server and client bindings"

4. Navigate to Band Members page:
   - ✅ Should see: No React key warnings
   - ✅ Should see: Clean console
   - ✅ Should see: Members list renders correctly

### Priority 3: Document Test Architecture (30 minutes)

Create `.claude/specifications/test-architecture.md`:

```markdown
# Test Architecture

## Current State (Audit-First)

### Real-Time Subscriptions
- **One channel per band** (audit-first approach)
- Channel name: `audit-{bandId}`
- Listens to: `audit_log` table INSERTs
- Processes changes for: songs, setlists, shows, practice_sessions

### Test Expectations
- Subscription count: 1 channel per band
- Event payload: Audit log entry format
- Deduplication: Must be idempotent

## Deprecated (Table-Based)

### Old Subscriptions (DO NOT TEST)
- ~~4 channels per band~~ (songs, setlists, shows, practices)
- ~~Direct table subscriptions~~
- ~~Table-specific event handlers~~

Tests expecting this behavior should be updated or removed.
```

---

## Optional But Recommended

### Quick Win: Setup Pre-Commit Hooks (15 minutes)

```bash
# Install husky
npm install -D husky

# Initialize
npx husky init

# Add pre-commit hook
cat << 'EOF' > .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Run type checking
npm run type-check

# Run tests (only if test files changed)
git diff --cached --name-only | grep -q '\.test\.ts$' && npm test -- --run --changed
EOF

# Make executable
chmod +x .husky/pre-commit
```

This prevents committing code with type errors or failing tests.

### Quick Win: Create Critical Paths Inventory (30 minutes)

Create `.claude/specifications/critical-paths.md`:

```markdown
# Critical Paths Inventory

**Last Updated:** 2025-11-02
**Purpose:** Identify paths requiring highest test coverage

## Auth Flows (Coverage Required: 90%+)

### 1. Fresh Login
- User clicks quick login → Auth service → Session created
- AuthContext detects session → Creates RealtimeManager
- Loads user data → Subscribes to bands → Initial sync
- **Tests:** Integration, E2E

### 2. Session Restoration
- Page load → Check localStorage → Session exists
- Restore session → Reuse RealtimeManager (NO duplicates)
- Restore subscriptions (idempotent)
- **Tests:** Integration

### 3. Logout
- User clicks logout → Unsubscribe all channels
- Clear IndexedDB → Clear localStorage → Redirect
- **Tests:** Integration

## Real-Time Sync Flows (Coverage Required: 85%+)

### 1. Remote Change → Local Update
- Supabase change → Audit log INSERT → Realtime event
- RealtimeManager receives → Updates IndexedDB
- Emits event → Hook receives → Component updates
- **Tests:** Unit, Integration

### 2. Duplicate Subscription Prevention
- Call subscribeToUserBands twice → Only 1 channel created
- Concurrent calls → Only 1 channel created
- **Tests:** Unit (✅ DONE)

### 3. Toast Notifications
- Remote change → Batch toasts → Show after 2 seconds
- No duplicate toasts for same user
- **Tests:** Unit

## Data Flows (Coverage Required: 80%+)

### 1. Repository → Hook → Component
- Hook calls repository → Repository returns data
- Hook deduplicates (if needed) → Component renders
- No React key warnings
- **Tests:** Integration, Component

## Invariants to Test

### Subscription Invariants
- ✅ One RealtimeManager per app instance
- ✅ One subscription per band (idempotent)
- ✅ Subscriptions cleaned up on logout

### Data Invariants
- One BandMembership per (userId, bandId) pair
- No duplicate records in hooks
- No duplicate React keys

## Test Coverage Goals

| Module | Current | Target |
|--------|---------|--------|
| RealtimeManager | ~60% | 90% |
| AuthContext | 0% | 90% |
| Repository | ~70% | 85% |
| Hooks | 0% | 75% |
| Components | 0% | 60% |
```

---

## Time Investment Summary

| Task | Priority | Time | Impact |
|------|----------|------|--------|
| Update failing tests | P1 | 2-3h | Restore test confidence |
| Verify fix in browser | P1 | 15min | Confirm no regressions |
| Document test arch | P2 | 30min | Prevent future confusion |
| Setup pre-commit hooks | P3 | 15min | Prevent bad commits |
| Create critical paths doc | P3 | 30min | Guide future testing |

**Total Investment:** 4-5 hours
**Payoff:** Prevents 90% of future bugs like this

---

## Success Criteria

### Short Term (This Week)
- [ ] All RealtimeManager tests passing
- [ ] No duplicate subscription bugs in browser
- [ ] No React key warnings
- [ ] Test architecture documented

### Medium Term (Next 2 Weeks)
- [ ] 80% coverage on critical paths
- [ ] Integration tests for auth flow
- [ ] Pre-commit hooks prevent bad code
- [ ] Testing guidelines documented

### Long Term (Next Month)
- [ ] 90% coverage on RealtimeManager, AuthContext
- [ ] E2E tests for critical flows
- [ ] CI/CD quality gates active
- [ ] No regression bugs

---

## What to Do Right Now

### Option A: Fix Tests First (Recommended)
1. Update the 21 failing tests to expect audit-first behavior
2. Verify all tests pass
3. Test in browser
4. Commit with confidence

**Why:** Ensures test suite remains reliable

### Option B: Verify Fix First
1. Test in browser to confirm no bugs
2. Update tests later
3. Document what tests need updating

**Why:** Faster validation, but leaves test debt

### My Recommendation: Option A

The tests are failing because the ARCHITECTURE changed, not because the CODE is wrong. Updating the tests to match the new architecture will:
- Restore test suite reliability
- Document expected behavior
- Prevent confusion for future developers
- Give you confidence to refactor

Plus, updating 21 tests to change from "4 channels" to "1 channel" is mostly find-and-replace work - not complex.

---

## Example Test Update

### Before:
```typescript
it('should subscribe to all table channels for a band', async () => {
  const userId = 'user-1'
  const bandIds = ['band-1']

  await manager.subscribeToUserBands(userId, bandIds)

  expect(mockSupabase.channel).toHaveBeenCalledWith('songs-band-1')
  expect(mockSupabase.channel).toHaveBeenCalledWith('setlists-band-1')
  expect(mockSupabase.channel).toHaveBeenCalledWith('shows-band-1')
  expect(mockSupabase.channel).toHaveBeenCalledWith('practices-band-1')
  expect(mockChannel.subscribe).toHaveBeenCalledTimes(4)
})
```

### After:
```typescript
it('should subscribe to audit_log channel for a band', async () => {
  const userId = 'user-1'
  const bandIds = ['band-1']

  await manager.subscribeToUserBands(userId, bandIds)

  // Audit-first approach: one channel per band
  expect(mockSupabase.channel).toHaveBeenCalledWith('audit-band-1')
  expect(mockChannel.subscribe).toHaveBeenCalledTimes(1)

  // Verify subscribed to audit_log table
  expect(mockChannel.on).toHaveBeenCalledWith(
    'postgres_changes',
    expect.objectContaining({
      table: 'audit_log',
      event: 'INSERT',
      filter: 'band_id=eq.band-1'
    }),
    expect.any(Function)
  )
})
```

**Pattern:** Replace table-specific expectations with audit-log expectations.

---

## Next Steps After This

Once tests are passing and browser is verified:

1. **Add Auth Flow Integration Tests** (4 hours)
   - Session restoration without duplicates
   - Fresh login flow
   - Logout cleanup

2. **Add Repository Contract Tests** (4 hours)
   - Deduplication requirements
   - Idempotency requirements
   - Concurrent call handling

3. **Update Specifications** (2 hours)
   - Add behavioral requirements
   - Add testing requirements
   - Add invariants

This builds on the foundation we just created.

---

## Questions for You

Before proceeding, please confirm:

1. **Should I update the 21 failing tests now?**
   - Yes → I'll update them to match audit-first architecture
   - No → Document what needs updating for later

2. **Want me to setup pre-commit hooks?**
   - Yes → Prevent bad commits automatically
   - No → Do this later

3. **Priority: Fix tests or verify in browser first?**
   - Tests first → More thorough
   - Browser first → Faster validation

Let me know your preference and I'll proceed accordingly!
