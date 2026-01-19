---
feature: Multi-Band Support
created: 2025-11-19T23:30:00Z
status: not-started
---

# Tasks: Multi-Band Support Implementation

## Phase 1: Preparation & Validation (2-3 hours)

### Task 1.1: Validate Existing Infrastructure

- [ ] Test `switchBand()` function works in AuthContext
- [ ] Verify hooks re-render when `currentBandId` changes
- [ ] Confirm RLS policies allow access to multiple bands
- [ ] Check SyncEngine loads data for all bands
- **Status:** Not Started
- **Assigned:** TBD
- **Estimated:** 1 hour

### Task 1.2: Update Seed Data

- [ ] Add second band "The Cover Artists" for Eric
- [ ] Add invite code "COVER2025"
- [ ] Add test songs/setlists for second band
- [ ] Create band membership for Eric in both bands
- **Status:** Not Started
- **Assigned:** TBD
- **Estimated:** 1-2 hours
- **File:** `/workspaces/rock-on/supabase/seed-mvp-data.sql`

## Phase 2: BandSelector Component (3-4 hours)

### Task 2.1: Extract BandSelector Component

- [ ] Create `/src/components/bands/BandSelector.tsx`
- [ ] Extract `_BandSelectorDropdown` from AuthPages.tsx:1126-1239
- [ ] Add testability attributes (`data-testid`)
- [ ] Add loading state during band switch
- [ ] Make mobile-responsive
- **Status:** Not Started
- **Assigned:** TBD
- **Estimated:** 2 hours

### Task 2.2: Add Visual Polish

- [ ] Add band icon/avatar
- [ ] Add keyboard navigation (up/down arrows)
- [ ] Add "No bands" empty state
- [ ] Add tooltip showing band members count
- **Status:** Not Started
- **Assigned:** TBD
- **Estimated:** 1-2 hours

## Phase 3: UI Integration (2-3 hours)

### Task 3.1: Add to Sidebar (Desktop)

- [ ] Import BandSelector in Sidebar.tsx
- [ ] Add above navigation items
- [ ] Style to match sidebar design
- [ ] Test on desktop browsers
- **Status:** Not Started
- **Assigned:** TBD
- **Estimated:** 1 hour

### Task 3.2: Add to Mobile Header

- [ ] Import BandSelector in MobileHeader.tsx
- [ ] Add to header next to user profile
- [ ] Test on mobile devices
- **Status:** Not Started
- **Assigned:** TBD
- **Estimated:** 1 hour

### Task 3.3: Add Band Context Indicators

- [ ] Add "Viewing: [Band Name]" to pages
- [ ] Add band badge to page titles
- [ ] Style with subtle background color
- **Status:** Not Started
- **Assigned:** TBD
- **Estimated:** 1 hour

## Phase 4: Enhanced UX & Edge Cases (2-3 hours)

### Task 4.1: Data Refresh on Band Switch

- [ ] Verify hooks auto-refresh
- [ ] Add manual refetch if needed
- [ ] Add loading state during data refresh
- **Status:** Not Started
- **Assigned:** TBD
- **Estimated:** 1 hour

### Task 4.2: Unsaved Changes Warning

- [ ] Detect if user has unsaved form data
- [ ] Show confirmation dialog before band switch
- [ ] Provide "Save and Switch" option
- **Status:** Not Started
- **Assigned:** TBD
- **Estimated:** 1 hour

### Task 4.3: Handle Band Removal

- [ ] Detect if user loses access to current band
- [ ] Auto-switch to another band
- [ ] Show toast notification
- **Status:** Not Started
- **Assigned:** TBD
- **Estimated:** 1 hour

## Phase 5: Testing & Documentation (3-4 hours)

### Task 5.1: Write E2E Tests

- [ ] Create `/tests/e2e/bands/multi-band-switching.spec.ts`
- [ ] Test switching between bands
- [ ] Test data isolation
- [ ] Test persistence after refresh
- **Status:** Not Started
- **Assigned:** TBD
- **Estimated:** 2-3 hours

### Task 5.2: Update Documentation

- [ ] Update CLAUDE.md with multi-band patterns
- [ ] Add screenshots to feature docs
- [ ] Document testability standards
- **Status:** Not Started
- **Assigned:** TBD
- **Estimated:** 1 hour

## Summary

**Total Tasks:** 12
**Completed:** 0
**In Progress:** 0
**Not Started:** 12

**Total Estimated Effort:** 14 hours (likely case)

## Notes

- All infrastructure already exists (95% complete)
- This is primarily UI integration work
- Can be completed in 1-2 week sprint
- Low risk (no database changes)
