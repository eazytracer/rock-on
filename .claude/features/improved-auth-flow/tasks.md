# Improved Authentication Flow - Implementation Tasks

**Feature**: improved-auth-flow
**Estimate**: 4-6 hours
**Strategy**: Browser-strict session validation, short grace period for brief offline
**Status**: Phases 1-4 COMPLETE ✅ | E2E Tests (T013-T014) COMPLETE ✅ | Remaining: T023-T029 (validation/polish)

---

## Phase 1: Setup (30 minutes) ✅ COMPLETE

- [x] T001: Create hooks directory and skeleton files
  - Files:
    - `src/hooks/useAuthCheck.ts` (create)
    - `src/hooks/index.ts` (create or update)
  - Depends: None
  - Acceptance:
    - `src/hooks/` directory exists
    - `useAuthCheck.ts` created with basic function signature
    - Hook exported from `index.ts`
  - Notes: Create directory if it doesn't exist

- [x] T002: Add helper utilities for auth check
  - Files: `src/hooks/useAuthCheck.ts`
  - Depends: T001
  - Acceptance:
    - `clearLocalStorageKeys()` function - clears currentUserId, currentBandId
    - `getHoursExpired(expiresAt: number)` function - calculates hours since expiry
    - Constants defined: `GRACE_PERIOD_HOURS = 1.5`
  - Notes: Pure functions, easy to unit test

---

## Phase 2: Tests (Write Tests First) (1.5-2 hours) ✅ COMPLETE

### Unit Tests for useAuthCheck Hook

- [x] T003: Write unit test - no localStorage keys [P]
  - Files: `tests/unit/hooks/useAuthCheck.test.ts` (create)
  - Depends: T001
  - Acceptance:
    - Test: `returns unauthorized when no localStorage keys`
    - Clears localStorage before test
    - Asserts `isAuthenticated = false`
    - Asserts `isChecking = false`
  - Notes: Test should fail initially (TDD)

- [x] T004: Write unit test - no session [P]
  - Files: `tests/unit/hooks/useAuthCheck.test.ts`
  - Depends: T001
  - Acceptance:
    - Test: `returns unauthorized when session is null`
    - Sets localStorage keys (currentUserId, currentBandId)
    - Mocks `SessionManager.loadSession()` to return null
    - Asserts localStorage keys are cleared
    - Asserts `isAuthenticated = false`
  - Notes: Test should fail initially (TDD)

- [x] T005: Write unit test - valid session [P]
  - Files: `tests/unit/hooks/useAuthCheck.test.ts`
  - Depends: T001
  - Acceptance:
    - Test: `returns authorized when session is valid`
    - Sets localStorage keys
    - Mocks valid session (expiresAt > Date.now())
    - Mocks `SessionManager.isSessionValid()` to return true
    - Asserts `isAuthenticated = true`
  - Notes: Test should fail initially (TDD)

- [x] T006: Write unit test - expired session beyond grace [P]
  - Files: `tests/unit/hooks/useAuthCheck.test.ts`
  - Depends: T001
  - Acceptance:
    - Test: `returns unauthorized when session expired > grace period`
    - Sets localStorage keys
    - Mocks expired session (3 hours ago)
    - Asserts localStorage cleared
    - Asserts `isAuthenticated = false`
  - Notes: Test should fail initially (TDD)

- [x] T007: Write unit test - expired session within grace [P]
  - Files: `tests/unit/hooks/useAuthCheck.test.ts`
  - Depends: T001
  - Acceptance:
    - Test: `returns authorized when session expired within grace period`
    - Sets localStorage keys
    - Mocks expired session (30 minutes ago)
    - Asserts `isAuthenticated = true`
    - Logs warning message about grace period
  - Notes: Test should fail initially (TDD)

- [x] T008: Write unit test - clears localStorage on invalid [P]
  - Files: `tests/unit/hooks/useAuthCheck.test.ts`
  - Depends: T001
  - Acceptance:
    - Test: `clears localStorage keys when session is invalid`
    - Sets localStorage keys
    - Mocks invalid session
    - Asserts `localStorage.removeItem` called for currentUserId
    - Asserts `localStorage.removeItem` called for currentBandId
  - Notes: Test should fail initially (TDD)

### E2E Tests for Protected Routes

- [x] T009: Write E2E test - redirect without session [P]
  - Files: `tests/e2e/auth/protected-routes.spec.ts` (create)
  - Depends: None
  - Acceptance:
    - Test: `redirects to /auth when accessing /songs without session`
    - Clears all localStorage
    - Navigates to `/songs`
    - Asserts redirected to `/auth`
    - Asserts protected content NOT visible
  - Notes: Test should fail initially (TDD), parallelizable with other E2E tests

- [x] T010: Write E2E test - redirect with expired session [P]
  - Files: `tests/e2e/auth/protected-routes.spec.ts`
  - Depends: None
  - Acceptance:
    - Test: `redirects to /auth when accessing /songs with expired session`
    - Sets localStorage keys (currentUserId, currentBandId)
    - Sets expired session in localStorage (rock_on_session with old expiresAt)
    - Navigates to `/songs`
    - Asserts redirected to `/auth`
    - Asserts protected content NOT visible
  - Notes: Test should fail initially (TDD)

- [x] T011: Write E2E test - shows loading state [P]
  - Files: `tests/e2e/auth/protected-routes.spec.ts`
  - Depends: None
  - Acceptance:
    - Test: `shows loading state before checking auth`
    - Sets valid session
    - Navigates to `/songs`
    - Asserts loading indicator visible (briefly)
    - Asserts `/songs` page renders after loading
  - Notes: May need to slow down check with mock delay

- [x] T012: Write E2E test - redirect to get-started [P]
  - Files: `tests/e2e/auth/protected-routes.spec.ts`
  - Depends: None
  - Acceptance:
    - Test: `redirects to /auth?view=get-started when user has no band`
    - Sets currentUserId in localStorage
    - Do NOT set currentBandId
    - Navigates to `/songs`
    - Asserts redirected to `/auth?view=get-started`
  - Notes: Test should fail initially (TDD)

### E2E Tests for Session Expiry ✅ COMPLETE

- [x] T013: Write E2E test - session expires on page [P]
  - Files: `tests/e2e/auth/session-expiry.spec.ts` ✅ Created
  - Depends: None
  - Acceptance:
    - ✅ Test: `redirects to /auth when session expires on protected page`
    - ✅ Test: `allows access within grace period (1 hour expired)`
    - ✅ Test: `redirects at exact grace period boundary (1.5 hours + 1 minute)`
    - ✅ Test: `shows toast notification when session expires`
  - Notes: Uses localStorage manipulation to set expired session timestamp (more reliable than timer mocking)

- [x] T014: Write E2E test - no modal on protected pages [P]
  - Files: `tests/e2e/auth/session-expiry.spec.ts` ✅ Created
  - Depends: None
  - Acceptance:
    - ✅ Test: `does NOT show SessionExpiredModal on protected pages - redirects instead`
    - ✅ Test: `localStorage is cleared when session expires`
    - ✅ Test: `shows session expired message when redirected with reason param`
  - Notes: SessionExpiredModal now returns null (redirect-only component)

---

## Phase 3: Core Implementation (1.5-2 hours) ✅ COMPLETE

- [x] T015: Implement useAuthCheck hook
  - Files: `src/hooks/useAuthCheck.ts`
  - Depends: T002, T003-T008 (tests written)
  - Acceptance:
    - Hook checks localStorage keys (currentUserId, currentBandId)
    - Calls `SessionManager.loadSession()`
    - Calls `SessionManager.isSessionValid()`
    - Implements grace period logic (1.5 hours)
    - Clears localStorage on invalid session
    - Returns `{ isAuthenticated: boolean | null, isChecking: boolean }`
    - All unit tests (T003-T008) pass
  - Notes: Follow TDD - make tests pass one by one

- [x] T016: Update ProtectedRoute to use useAuthCheck
  - Files: `src/components/ProtectedRoute.tsx`
  - Depends: T015
  - Acceptance:
    - Imports and uses `useAuthCheck` hook
    - Removes direct localStorage checks
    - Shows loading state when `isChecking === true`
    - Redirects to `/auth` when `isAuthenticated === false`
    - Redirects to `/auth?view=get-started` when user but no band
    - Renders children when `isAuthenticated === true`
  - Notes: Keep existing redirect logic for no-band case

- [x] T017: Add loading state component
  - Files: `src/components/ProtectedRoute.tsx`
  - Depends: T016
  - Acceptance:
    - Shows centered spinner or skeleton during auth check
    - Matches existing loading patterns in codebase
    - Accessible (aria-label, role)
    - No flash of content before check completes
  - Notes: Can be simple spinner div, doesn't need to be fancy

- [x] T018: Clear localStorage on session expiry in AuthContext
  - Files: `src/contexts/AuthContext.tsx`
  - Depends: T015
  - Acceptance:
    - In `checkSession()` function (line 110-122):
      - Clears `currentUserId` from localStorage
      - Clears `currentBandId` from localStorage
    - Sets session and user to null
    - Does NOT set `sessionExpired = true` (we'll redirect instead)
  - Notes: This prevents stale keys from allowing access

---

## Phase 4: Integration (1 hour) ✅ COMPLETE

- [x] T019: Add redirect logic to AuthContext on session expiry
  - Files: `src/contexts/AuthContext.tsx`
  - Depends: T018
  - Acceptance:
    - Import `useNavigate` from react-router-dom (or use alternative approach)
    - On session expiry, navigate to `/auth?reason=session-expired`
    - Log warning: "Session expired - redirecting to login"
  - Notes: May need to handle redirect via effect or callback pattern

- [x] T020: Simplify SessionExpiredModal
  - Files: `src/components/auth/SessionExpiredModal.tsx`
  - Depends: T019
  - Acceptance:
    - ✅ Option A implemented: useEffect redirects to /auth on sessionExpired
    - ✅ Shows toast notification: "Your session has expired. Please log in again."
    - ✅ Modal removed - component now returns null (redirect-only)
  - Notes: Simplified to redirect + toast pattern

- [x] T021: Add session expiry message on auth page
  - Files: `src/pages/AuthPages.tsx`
  - Depends: T019
  - Acceptance:
    - Checks for `?reason=session-expired` query param
    - Shows info message: "Your session expired. Please log in again."
    - Message is dismissible or auto-hides
    - Styled consistently with existing UI
  - Notes: Use React Router's `useSearchParams` hook

- [x] T022: Add toast notification helper (if not exists)
  - Files: `src/contexts/ToastContext.tsx` (already exists)
  - Depends: T020
  - Acceptance:
    - ✅ ToastContext already provides `useToast()` hook with `showToast(message, type)`
    - ✅ Supports 'success' | 'error' | 'info' types
    - ✅ Auto-dismisses after 4 seconds
  - Notes: Already existed in codebase - no changes needed

---

## Phase 5: Polish & Validation (1 hour)

- [ ] T023: Run all unit tests
  - Files: All test files
  - Depends: T015 (implementation complete)
  - Acceptance:
    - `npm test tests/unit/hooks/useAuthCheck.test.ts` passes
    - All 6 unit tests pass
    - Coverage > 90% for useAuthCheck hook
  - Notes: Tests should already pass from T015 (TDD)

- [ ] T024: Run all E2E tests
  - Files: All E2E test files
  - Depends: T016, T017, T018, T019, T020 (integration complete)
  - Acceptance:
    - `npm run test:e2e tests/e2e/auth/protected-routes.spec.ts` passes
    - `npm run test:e2e tests/e2e/auth/session-expiry.spec.ts` passes
    - All new E2E tests (T009-T014) pass
  - Notes: Requires local Supabase running

- [ ] T025: Manual testing - happy path
  - Files: N/A (manual testing)
  - Depends: T024
  - Acceptance:
    - User can sign in successfully
    - User can access protected routes with valid session
    - Pages load without "Not logged in" status
    - User can navigate between protected pages
    - Session persists across page reloads
  - Notes: Test in Chrome, Firefox, Safari (if available)

- [ ] T026: Manual testing - session expiry scenarios
  - Files: N/A (manual testing)
  - Depends: T024
  - Acceptance:
    - Scenario 1: Direct URL to /songs with expired session → redirects to /auth
    - Scenario 2: Session expires while on /songs → redirects to /auth
    - Scenario 3: Go offline with valid session → can access for 1.5 hours
    - Scenario 4: Return after 3 hours offline → requires re-auth
    - Scenario 5: Multi-tab logout → all tabs redirect
  - Notes: Use browser DevTools to manipulate localStorage

- [ ] T027: Manual testing - loading states
  - Files: N/A (manual testing)
  - Depends: T024
  - Acceptance:
    - Loading spinner visible briefly during auth check
    - No flash of protected content before redirect
    - No flash of "Not logged in" status
    - Loading state styled consistently
  - Notes: May need to throttle network to see loading state

- [ ] T028: Update documentation
  - Files:
    - `CLAUDE.md` (if needed)
    - `.claude/features/improved-auth-flow/README.md` (create)
  - Depends: T027
  - Acceptance:
    - Document new useAuthCheck hook
    - Document grace period behavior
    - Document session expiry flow
    - Update any outdated auth flow diagrams
  - Notes: Keep it concise, focus on key changes

- [ ] T029: Code review checklist
  - Files: All modified files
  - Depends: T028
  - Acceptance:
    - All files have proper TypeScript types
    - No console.log statements (use proper logging)
    - Error handling for all edge cases
    - Accessible UI elements (aria labels)
    - No hardcoded strings (use constants)
    - Code follows project conventions
  - Notes: Self-review before submitting PR

---

## Task Summary

**Total Tasks**: 29
**Parallelizable**: 11 (marked with [P])
**Sequential**: 18

**Estimated Time Breakdown**:

- Phase 1 (Setup): 30 minutes
- Phase 2 (Tests): 1.5-2 hours
- Phase 3 (Core): 1.5-2 hours
- Phase 4 (Integration): 1 hour
- Phase 5 (Polish): 1 hour
- **Total**: 5.5-6.5 hours (slightly over 6h estimate due to thorough testing)

**Critical Path**:

1. T001 (Setup) → T002 (Helpers)
2. T003-T008 (Unit tests) → T015 (Implement hook)
3. T015 → T016 (Update ProtectedRoute) → T017 (Loading state)
4. T018 (Clear localStorage) → T019 (Redirect logic) → T020 (Simplify modal)
5. T024 (Run tests) → T025-T027 (Manual testing) → T028 (Docs) → T029 (Review)

**Dependencies**:

- No external dependencies
- Requires local Supabase for E2E tests
- Uses existing SessionManager and AuthContext

**Risks**:

- Grace period implementation may need tuning based on user feedback
- Redirect logic in AuthContext may require refactor (navigate hook usage)
- SessionExpiredModal simplification needs team decision (Option A vs B)

---

## Implementation Notes

### TDD Approach

This plan follows Test-Driven Development:

1. Write unit tests first (T003-T008) - they will fail
2. Write E2E tests (T009-T014) - they will fail
3. Implement useAuthCheck hook (T015) - make unit tests pass
4. Update ProtectedRoute (T016-T017) - make E2E tests pass
5. Integrate with AuthContext (T018-T022) - complete the flow

### Parallelization Opportunities

Tasks marked [P] can be worked on simultaneously by different developers:

- Unit tests (T003-T008) - 6 tests, can split
- E2E tests (T009-T014) - 6 tests, can split
- Phase 5 manual testing (T025-T027) - can split by scenario

### Testing Strategy

- **Unit tests**: Fast, isolated, test logic only
- **E2E tests**: Slow, integrated, test full user flow
- **Manual testing**: Validates UX, catches edge cases

### Grace Period Tuning

The 1.5-hour grace period is configurable:

```typescript
// src/hooks/useAuthCheck.ts
const GRACE_PERIOD_HOURS = 1.5 // Adjust based on feedback
```

If users report too many re-auth prompts → increase to 2 hours
If users report security concerns → decrease to 1 hour

### Alternative Approaches

If redirect from AuthContext is problematic:

1. Use event emitter pattern to notify components
2. Set a flag and let ProtectedRoute handle redirect
3. Use React Router's loader/action patterns

---

**Ready for Implementation** ✅
