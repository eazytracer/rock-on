---
feature: Multi-Band Support
created: 2025-11-19T23:30:00Z
status: planned
estimated_effort: 14 hours
---

# Implementation Plan: Multi-Band Support

## Executive Summary

**Status:** 95% of infrastructure already exists - this is primarily a UI integration task.

**Key Finding:** Rock-On already has complete backend support for users in multiple bands. The database schema, state management, data filtering, RLS policies, and sync engine all work correctly. What's missing is UI integration and testing.

**Total Effort Estimate:**

- **Best Case:** 9 hours
- **Likely Case:** 14 hours
- **Worst Case:** 24 hours
- **Recommended (with padding):** 17 hours

**Risk Level:** LOW (minimal code changes, existing infrastructure)

## What Already Works ✅

1. **Database Schema** - `band_memberships` table supports N:M relationships
2. **State Management** - `AuthContext` has `currentBandId` and `switchBand()` function
3. **Data Filtering** - All hooks (`useSongs`, `useSetlists`, etc.) filter by `currentBandId`
4. **RLS Policies** - Already enforce band isolation on all tables
5. **Sync Engine** - Already syncs all user's bands
6. **Personal Songs** - Work across bands via `context_id = NULL`
7. **BandSelector Component** - `_BandSelectorDropdown` exists in `AuthPages.tsx:1126-1239`

## What Needs Implementation ❌

1. Band selector not integrated into Header/Sidebar
2. No visual indicator of current band context on pages
3. Seed data only creates 1 band (need 2+ for testing)
4. No E2E tests for multi-band scenarios
5. No handling for edge cases (unsaved changes, band removal)

## Implementation Phases

### Phase 1: Preparation & Validation (2-3 hours)

**Complexity:** EASY
**Confidence:** 95%

**Tasks:**

1. **Validate Existing Infrastructure (1 hour)**
   - [ ] Test `switchBand()` function in AuthContext works
   - [ ] Verify hooks re-render when `currentBandId` changes
   - [ ] Confirm RLS policies allow access to multiple bands
   - [ ] Check SyncEngine loads data for all bands

   **Acceptance Criteria:**
   - Can manually call `switchBand(bandId)` in browser console
   - All data hooks update automatically
   - No RLS errors in Supabase logs
   - IndexedDB contains data for all user's bands

2. **Update Seed Data (1-2 hours)**
   - [ ] Add second band "The Cover Artists" for Eric
   - [ ] Add invite code "COVER2025"
   - [ ] Add test songs/setlists for second band
   - [ ] Create band membership for Eric in both bands

   **File to Modify:** `/workspaces/rock-on/supabase/seed-mvp-data.sql`

   **Acceptance Criteria:**
   - After `supabase db reset`, Eric has 2 bands
   - Each band has 3-5 test songs
   - Each band has 1-2 test setlists
   - Band memberships table shows Eric in both bands

**Dependencies:** None

### Phase 2: BandSelector Component (3-4 hours)

**Complexity:** EASY-MEDIUM
**Confidence:** 85%

**Tasks:**

3. **Extract BandSelector Component (2 hours)**
   - [ ] Create `/src/components/bands/BandSelector.tsx`
   - [ ] Extract `_BandSelectorDropdown` from AuthPages.tsx
   - [ ] Add testability attributes (`data-testid`)
   - [ ] Add loading state during band switch
   - [ ] Make mobile-responsive

   **Reference Code:** `AuthPages.tsx:1126-1239`

   **Acceptance Criteria:**
   - Component displays all user's bands
   - Current band shows checkmark
   - Clicking band calls `switchBand(bandId)`
   - Shows loading spinner during switch
   - Works on mobile (dropdown doesn't overflow)

4. **Add Visual Polish (1-2 hours)**
   - [ ] Add band icon/avatar
   - [ ] Add keyboard navigation (up/down arrows)
   - [ ] Add "No bands" empty state
   - [ ] Add tooltip on hover showing band members count

   **Acceptance Criteria:**
   - Passes accessibility audit (keyboard nav)
   - Empty state shows "Create your first band" CTA
   - Tooltips work correctly

**Dependencies:** Phase 1 complete

### Phase 3: UI Integration (2-3 hours)

**Complexity:** EASY
**Confidence:** 90%

**Tasks:**

5. **Add to Sidebar (Desktop) (1 hour)**
   - [ ] Import BandSelector in `/src/components/layout/Sidebar.tsx`
   - [ ] Add above navigation items
   - [ ] Style to match sidebar design
   - [ ] Test on desktop (Chrome, Firefox, Safari)

   **Acceptance Criteria:**
   - Appears in sidebar above "Songs"
   - Matches sidebar styling
   - Switching band updates all pages instantly

6. **Add to Mobile Header (1 hour)**
   - [ ] Import BandSelector in `/src/components/layout/MobileHeader.tsx`
   - [ ] Add to header next to user profile
   - [ ] Test on mobile (iOS Safari, Android Chrome)

   **Acceptance Criteria:**
   - Visible on mobile screens
   - Dropdown doesn't cause horizontal scroll
   - Works with hamburger menu

7. **Add Band Context Indicators (1 hour)**
   - [ ] Add "Viewing: [Band Name]" to Dashboard
   - [ ] Add band badge to page titles (Songs, Setlists, etc.)
   - [ ] Style with subtle background color

   **Files to Modify:**
   - `/src/pages/NewLayout/Dashboard.tsx`
   - `/src/pages/NewLayout/SongsPage.tsx`
   - `/src/pages/NewLayout/SetlistsPage.tsx`
   - `/src/pages/NewLayout/PracticesPage.tsx`
   - `/src/pages/NewLayout/ShowsPage.tsx`

   **Acceptance Criteria:**
   - User always knows which band they're viewing
   - Indicators are visually consistent
   - Don't clutter the UI

**Dependencies:** Phase 2 complete

### Phase 4: Enhanced UX & Edge Cases (2-3 hours)

**Complexity:** MEDIUM
**Confidence:** 75%

**Tasks:**

8. **Data Refresh on Band Switch (1 hour)**
   - [ ] Verify hooks auto-refresh (they should via useEffect)
   - [ ] Add manual refetch if auto-refresh doesn't work
   - [ ] Add loading state during data refresh

   **Acceptance Criteria:**
   - Switching band updates all visible data
   - No stale data from previous band
   - Loading indicators show during refresh

9. **Unsaved Changes Warning (1 hour)**
   - [ ] Detect if user has unsaved form data
   - [ ] Show confirmation dialog before band switch
   - [ ] Provide "Save and Switch" option

   **Files to Modify:**
   - `/src/components/songs/SongForm.tsx`
   - `/src/components/setlists/SetlistForm.tsx`

   **Acceptance Criteria:**
   - Warning shows if form is dirty
   - User can cancel band switch
   - User can save before switching

10. **Handle Band Removal (1 hour)**
    - [ ] Detect if user loses access to current band
    - [ ] Auto-switch to another band
    - [ ] Show toast notification

    **Acceptance Criteria:**
    - User removed from Band A while viewing it
    - App auto-switches to Band B
    - Toast shows: "You were removed from [Band Name]"

**Dependencies:** Phase 3 complete

### Phase 5: Testing & Documentation (3-4 hours)

**Complexity:** MEDIUM
**Confidence:** 80%

**Tasks:**

11. **E2E Tests (2-3 hours)**
    - [ ] Create `/tests/e2e/bands/multi-band-switching.spec.ts`
    - [ ] Test: User with 2 bands can switch between them
    - [ ] Test: Songs in Band A not visible in Band B
    - [ ] Test: Switching updates Dashboard, Songs, Setlists
    - [ ] Test: Current band shows checkmark
    - [ ] Test: Creating song in Band A doesn't appear in Band B

    **Acceptance Criteria:**
    - All E2E tests pass
    - Coverage > 80% for band switching flows
    - Tests run in CI/CD

12. **Update Documentation (1 hour)**
    - [ ] Update CLAUDE.md with multi-band patterns
    - [ ] Add screenshots to feature docs
    - [ ] Document testability standards for BandSelector

    **Acceptance Criteria:**
    - Docs explain how band selection works
    - Code examples for common patterns
    - Screenshots show UI

**Dependencies:** Phases 1-4 complete

## File Changes Checklist

### New Files to Create

- [ ] `/workspaces/rock-on/src/components/bands/BandSelector.tsx` - Main component
- [ ] `/workspaces/rock-on/src/components/bands/BandContextIndicator.tsx` - Badge component
- [ ] `/workspaces/rock-on/tests/e2e/bands/multi-band-switching.spec.ts` - E2E tests
- [ ] `/workspaces/rock-on/.claude/features/multi-band-support/tasks.md` - Task tracking

### Existing Files to Modify

- [ ] `/workspaces/rock-on/supabase/seed-mvp-data.sql` - Add 2nd band for Eric
- [ ] `/workspaces/rock-on/src/components/layout/Sidebar.tsx` - Integrate BandSelector
- [ ] `/workspaces/rock-on/src/components/layout/MobileHeader.tsx` - Integrate BandSelector
- [ ] `/workspaces/rock-on/src/pages/NewLayout/Dashboard.tsx` - Add band context indicator
- [ ] `/workspaces/rock-on/src/pages/NewLayout/SongsPage.tsx` - Add band context indicator
- [ ] `/workspaces/rock-on/src/pages/NewLayout/SetlistsPage.tsx` - Add band context indicator
- [ ] `/workspaces/rock-on/src/pages/NewLayout/PracticesPage.tsx` - Add band context indicator
- [ ] `/workspaces/rock-on/src/pages/NewLayout/ShowsPage.tsx` - Add band context indicator
- [ ] `/workspaces/rock-on/src/components/songs/SongForm.tsx` - Add unsaved changes warning
- [ ] `/workspaces/rock-on/src/components/setlists/SetlistForm.tsx` - Add unsaved changes warning
- [ ] `/workspaces/rock-on/tests/helpers/selectors.ts` - Add testids for band selector
- [ ] `/workspaces/rock-on/CLAUDE.md` - Update with multi-band patterns

### No Changes Needed (Already Works)

- ✅ All data hooks (`useSongs`, `useSetlists`, etc.)
- ✅ Database schema and RLS policies
- ✅ State management in AuthContext
- ✅ Sync engine
- ✅ Repository layer

## Testing Strategy

### Unit Tests

**Files:** `/tests/unit/components/bands/BandSelector.test.tsx`

- [ ] Test component renders user's bands
- [ ] Test clicking band calls `switchBand()`
- [ ] Test current band shows checkmark
- [ ] Test loading state displays
- [ ] Test empty state (0 bands)
- [ ] Test keyboard navigation
- [ ] Test testability attributes exist

### Integration Tests

**Files:** `/tests/integration/multi-band-workflow.test.ts`

- [ ] Test switching bands updates data hooks
- [ ] Test personal songs visible across all bands
- [ ] Test band-specific songs only visible in that band
- [ ] Test sync works across multiple bands
- [ ] Test RLS blocks access to other bands' data

### E2E Tests

**Files:** `/tests/e2e/bands/multi-band-switching.spec.ts`

**Scenarios:**

1. **Basic Switching**
   - User with 2 bands logs in
   - BandSelector shows both bands
   - Switching band updates all data views
   - Current band persists after refresh

2. **Data Isolation**
   - Create song in Band A
   - Switch to Band B
   - Song not visible in Band B
   - Switch back to Band A
   - Song visible again

3. **Edge Cases**
   - User with 0 bands sees "Create your first band"
   - User with 1 band selector still works
   - User removed from band auto-switches
   - Unsaved changes warning blocks switch

### Manual Testing Checklist

**Desktop (Chrome, Firefox, Safari):**

- [ ] Band selector appears in sidebar
- [ ] Dropdown opens/closes correctly
- [ ] Switching updates Dashboard
- [ ] Switching updates Songs page
- [ ] Switching updates Setlists page
- [ ] Switching updates Practices page
- [ ] Switching updates Shows page
- [ ] Loading state shows during switch
- [ ] Current band selection persists after refresh

**Mobile (iOS Safari, Android Chrome):**

- [ ] Band selector appears in header
- [ ] Dropdown doesn't overflow screen
- [ ] Touch interaction works
- [ ] Switching updates all pages
- [ ] Works in portrait mode
- [ ] Works in landscape mode

**Edge Cases:**

- [ ] User with 0 bands
- [ ] User with 1 band
- [ ] User with 10+ bands (scroll behavior)
- [ ] Unsaved changes warning
- [ ] User removed from band while viewing
- [ ] Offline mode (band switch uses local data)

## Risk Assessment & Mitigation

### Low Risk Areas

**Database Schema** (No Changes)

- Risk: None
- Mitigation: N/A - already supports multi-band

**RLS Policies** (No Changes)

- Risk: None
- Mitigation: N/A - already enforce band isolation

**Backward Compatibility** (Purely Additive)

- Risk: Very Low
- Mitigation: Feature is additive, users with 1 band see no change

### Medium Risk Areas

**Data Hook Refresh**

- Risk: Hooks might not auto-refresh on band switch
- Mitigation:
  - Phase 1: Validate hooks have `currentBandId` in deps
  - Phase 4: Add manual refetch if needed
  - Fallback: Force re-mount of pages on switch

**Mobile UX**

- Risk: Dropdown overflow on small screens
- Mitigation:
  - Test early on real devices
  - Use CSS `position: fixed` for dropdown
  - Add max-height with scroll

**Unsaved Changes**

- Risk: Complex state tracking across forms
- Mitigation:
  - Start with simple confirm dialog
  - Enhance later with react-hook-form dirty state
  - Document pattern for future forms

### Contingency Plans

**If hooks don't auto-refresh:**

- Add manual `refetch()` call in `switchBand()`
- Force re-render via key prop on pages

**If mobile dropdown overflows:**

- Use modal instead of dropdown on mobile
- Add separate mobile menu item

**If unsaved changes too complex:**

- Ship v1 without this feature
- Add in follow-up PR

**If testing reveals major issues:**

- Feature flag to hide BandSelector
- Revert in < 5 minutes

## Rollout Strategy

### Phase A: Local Testing (Day 1-2)

1. **Setup:**
   - Run `supabase db reset` with updated seed data
   - Eric has 2 bands: "The Test Band" and "The Cover Artists"
   - Each band has test songs/setlists

2. **Validation:**
   - Login as eric@ipodshuffle.com
   - Verify BandSelector shows 2 bands
   - Switch between bands multiple times
   - Verify data updates correctly
   - Run E2E test suite

3. **Success Criteria:**
   - 100% E2E tests passing
   - 0 console errors
   - < 500ms switch latency
   - Data isolation confirmed

### Phase B: Remote Testing (Day 3)

1. **Deploy to Staging:**
   - Deploy to staging Supabase
   - Create test users with 2+ bands
   - Multi-device testing

2. **Validation:**
   - Desktop testing (3 browsers)
   - Mobile testing (iOS + Android)
   - Multi-user realtime sync
   - Performance monitoring

3. **Success Criteria:**
   - Staging tests pass
   - No performance regressions
   - Realtime sync works across bands

### Phase C: Production (Day 4)

1. **Gradual Rollout:**
   - Deploy to production
   - Monitor error rates
   - Watch Supabase logs for RLS issues

2. **Monitoring:**
   - Track `switchBand()` calls
   - Monitor page load times
   - Watch for 403 errors
   - Check localStorage usage

3. **Rollback Plan:**
   - Feature flag to hide component
   - Revert in < 5 minutes if needed
   - Communicate to users via toast

## Implementation Order & Dependencies

### Critical Path (Can't Parallelize)

1. Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
2. Must update seed data before testing
3. Must extract component before integration
4. Must integrate before E2E tests

### Parallel Work Opportunities

**After Phase 2:**

- Task 5 (Sidebar) and Task 6 (Mobile) can be done in parallel
- Task 7 (Indicators) independent of 5+6

**During Phase 5:**

- Documentation can be written while tests run
- Screenshots can be captured during manual testing

### Recommended Sprint

**Sprint 1 (Week 1):**

- Day 1-2: Phases 1-2 (Prep + Component)
- Day 3-4: Phase 3 (Integration)
- Day 5: Phase 4 (UX + Edge Cases)

**Sprint 2 (Week 2):**

- Day 1-2: Phase 5 (Testing)
- Day 3: Rollout to staging
- Day 4-5: Production rollout + monitoring

## Success Metrics

### Functional Metrics

- [ ] 100% E2E tests passing
- [ ] 0 console errors during band switch
- [ ] < 500ms switch latency
- [ ] 100% data isolation (no band leakage)
- [ ] Works offline (uses local IndexedDB)

### UX Metrics

- [ ] Band selector discoverable (> 80% users find it)
- [ ] < 3 clicks to switch bands
- [ ] Visual loading feedback on all actions
- [ ] Mobile experience smooth (no overflow/scroll issues)
- [ ] Current band always visible

### Performance Metrics

- [ ] Page load time unchanged (< +50ms)
- [ ] IndexedDB query time < 100ms
- [ ] No memory leaks (test with 10+ bands)
- [ ] Realtime sync < 2s after band data changes

## Open Questions & Decisions

### Answered During Planning

1. ✅ **Where to place BandSelector?**
   - Desktop: Sidebar (above navigation)
   - Mobile: Header (next to user profile)

2. ✅ **How to handle data refresh?**
   - Verify hooks auto-refresh via useEffect
   - Add manual refetch if needed

3. ✅ **Unsaved changes approach?**
   - Start with simple confirm dialog
   - Enhance later with form state tracking

4. ✅ **Testing strategy?**
   - Update seed data for Eric (2 bands)
   - Write comprehensive E2E tests
   - Manual testing checklist

### Need Product Decision

1. **Band limit per user?**
   - Options: No limit, 10 bands, 25 bands
   - Impact: UI performance with many bands
   - Recommendation: No limit for MVP, monitor usage

2. **Default band selection?**
   - Options: Last used, alphabetical, user preference
   - Impact: User experience on login
   - Current: Last used (via localStorage)
   - Recommendation: Keep current behavior

3. **Personal songs filter?**
   - Options: Always show, add toggle, hide by default
   - Impact: Songs page complexity
   - Recommendation: Always show for MVP, add toggle later

## Next Steps

1. **Review & Approve** - Get stakeholder sign-off on plan
2. **Confirm Scope** - All 5 phases or MVP (Phases 1-3)?
3. **Assign Developer** - Who's implementing?
4. **Set Timeline** - 1-week or 2-week sprint?
5. **Begin Phase 1** - Can start immediately

## References

- Research Document: `.claude/features/multi-band-support/research.md`
- Existing Component: `src/pages/NewLayout/AuthPages.tsx:1126-1239`
- Related Issue: Song creation 403 error (may be multi-band related)
- Test User: eric@ipodshuffle.com (currently in 2 bands)
