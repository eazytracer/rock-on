---
title: User Test Validation Plan - MVP Pre-Launch
created: 2025-11-03T16:25
context: Manual testing checklist for validating all behavior before MVP deployment
prompt: Create well-documented user-test plan to validate all behavior before deploying MVP
status: Ready for Execution
---

# 🎯 User Test Validation Plan - MVP Pre-Launch

**Created:** 2025-11-03T16:25
**Purpose:** Manual testing checklist to validate all critical behaviors before MVP launch
**Audience:** You (the developer) - step-by-step validation guide
**Prerequisite:** Developer Dashboard must be built first (Phase 5)

---

## 📋 Pre-Test Setup

### Environment Setup
```bash
# 1. Start local Supabase (if testing locally)
supabase start

# 2. Start dev server
npm run dev

# 3. Open Developer Dashboard
# Navigate to: http://localhost:5173/dev/dashboard
```

### Test Data Reset
```bash
# Clear all data for fresh start
# Via Developer Dashboard:
# - Click "Clear IndexedDB"
# - Click "Clear Supabase"
# - Verify counts show 0 in both
```

### Test Devices Setup
- **Device A:** Your primary browser (Chrome/Edge)
- **Device B:** Secondary browser (Firefox) or Incognito mode
- **Device C** (optional): Mobile device or third browser tab

---

## ✅ Critical Path Tests (Must Pass Before MVP)

### Test Suite 1: Authentication & Session (30 minutes)

#### Test 1.1: Quick Login Works
**Steps:**
1. Open app in fresh browser tab
2. Click "Quick Login" (dev mode)
3. Should log in immediately

**Expected:**
- ✅ User logged in within 2 seconds
- ✅ Dashboard shows "Welcome" or user info
- ✅ Can navigate to Songs page

**Validation:**
- [ ] Test passed
- [ ] Notes: _________________________________

---

#### Test 1.2: Session Timeout Handling (CRITICAL - Your Bug!)
**Steps:**
1. Log in and create a song ("Session Test Song")
2. Open Dev Dashboard → Force session timeout
   - Option A: Manually call `supabase.auth.signOut()`
   - Option B: Wait 1 hour for real timeout
   - Option C: Mock expired token
3. Try to create another song ("Post-Timeout Song")
4. Observe behavior

**Expected:**
- ✅ Shows "Session expired" error (not crash!)
- ✅ Can still view existing songs locally
- ✅ "Session Test Song" still visible
- ✅ Clear re-login prompt shown

**Validation:**
- [ ] Test passed
- [ ] Error message shown: _________________________________
- [ ] Local data preserved: YES / NO
- [ ] Notes: _________________________________

---

#### Test 1.3: Multi-Tab Session Sync
**Steps:**
1. Open app in Tab A and log in
2. Open app in Tab B (same browser)
3. In Tab A, log out
4. Switch to Tab B

**Expected:**
- ✅ Tab B detects logout within 5 seconds
- ✅ Tab B shows logged-out state or re-login prompt
- ✅ Local data still accessible in both tabs

**Validation:**
- [ ] Test passed
- [ ] Tab B detected logout: YES / NO (within ___ seconds)
- [ ] Notes: _________________________________

---

### Test Suite 2: Offline/Online Sync (45 minutes)

#### Test 2.1: Offline Data Access
**Steps:**
1. While online, create 3 songs:
   - "Online Song 1"
   - "Online Song 2"
   - "Online Song 3"
2. Open Dev Dashboard → Verify 3 songs in both IndexedDB and Supabase
3. Enable "Simulate Offline Mode" in Dev Dashboard
4. Navigate to Songs page

**Expected:**
- ✅ All 3 songs still visible
- ✅ Sync indicator shows "Offline" status
- ✅ Can navigate between pages
- ✅ UI remains functional

**Validation:**
- [ ] Test passed
- [ ] Songs visible offline: ___ /3
- [ ] Notes: _________________________________

---

#### Test 2.2: Offline Creation & Sync
**Steps:**
1. While in offline mode (from Test 2.1), create 2 more songs:
   - "Offline Song 1"
   - "Offline Song 2"
2. Verify songs appear in UI
3. Open Dev Dashboard → Check IndexedDB count (should be 5)
4. Check Supabase count (should still be 3)
5. Disable "Simulate Offline Mode"
6. Wait for sync (watch Dev Dashboard sync queue)

**Expected:**
- ✅ Songs created successfully while offline
- ✅ IndexedDB has 5 songs while offline
- ✅ Supabase has 3 songs while offline
- ✅ After going online, sync completes within 5 seconds
- ✅ Supabase ends with 5 songs
- ✅ IndexedDB still has 5 songs (no data loss)

**Validation:**
- [ ] Test passed
- [ ] Final IndexedDB count: ___
- [ ] Final Supabase count: ___
- [ ] Sync time: ___ seconds
- [ ] Notes: _________________________________

---

#### Test 2.3: Offline Edit & Sync
**Steps:**
1. While online, create song "Edit Test Song"
2. Go offline
3. Edit song title to "Edited While Offline"
4. Edit song artist to "Offline Artist"
5. Go online
6. Wait for sync

**Expected:**
- ✅ Edit persisted locally while offline
- ✅ After sync, Supabase has updated values
- ✅ No version conflicts or duplicates

**Validation:**
- [ ] Test passed
- [ ] Supabase has correct title: YES / NO
- [ ] Supabase has correct artist: YES / NO
- [ ] Notes: _________________________________

---

#### Test 2.4: Offline Delete & Sync
**Steps:**
1. While online, create "Delete Me Song"
2. Go offline
3. Delete "Delete Me Song"
4. Verify removed from UI
5. Go online
6. Wait for sync

**Expected:**
- ✅ Song removed from UI while offline
- ✅ Song removed from IndexedDB while offline
- ✅ After sync, song removed from Supabase
- ✅ No ghost records or duplicates

**Validation:**
- [ ] Test passed
- [ ] Song in IndexedDB: YES / NO
- [ ] Song in Supabase: YES / NO
- [ ] Notes: _________________________________

---

### Test Suite 3: Real-Time Sync (Two Devices) (45 minutes)

#### Test 3.1: Create on Device A → Appears on Device B
**Steps:**
1. Open app on Device A (Chrome) and log in as User A
2. Open app on Device B (Firefox) and log in as User B (different user, same band)
3. On Device A, create song "Real-Time Song 1"
4. Watch Device B

**Expected:**
- ✅ Song appears on Device B within 1 second
- ✅ Toast notification on Device B: "User A added 'Real-Time Song 1'"
- ✅ NO toast on Device A (user filter working)

**Validation:**
- [ ] Test passed
- [ ] Sync latency: ___ ms
- [ ] Toast on Device A: YES / NO (should be NO)
- [ ] Toast on Device B: YES / NO (should be YES)
- [ ] Notes: _________________________________

---

#### Test 3.2: Edit on Device A → Update on Device B
**Steps:**
1. With "Real-Time Song 1" from Test 3.1 visible on both devices
2. On Device A, edit title to "Updated Title"
3. Watch Device B

**Expected:**
- ✅ Updated title appears on Device B within 1 second
- ✅ Toast notification on Device B
- ✅ NO toast on Device A

**Validation:**
- [ ] Test passed
- [ ] Update latency: ___ ms
- [ ] Notes: _________________________________

---

#### Test 3.3: Delete on Device A → Removed from Device B
**Steps:**
1. On Device A, delete "Real-Time Song 1"
2. Watch Device B

**Expected:**
- ✅ Song removed from Device B within 1 second
- ✅ Toast notification on Device B
- ✅ NO toast on Device A

**Validation:**
- [ ] Test passed
- [ ] Delete latency: ___ ms
- [ ] Notes: _________________________________

---

#### Test 3.4: Rapid Changes from Both Devices
**Steps:**
1. On Device A, create "Song A1"
2. Immediately on Device B, create "Song B1"
3. On Device A, create "Song A2"
4. On Device B, create "Song B2"
5. Wait 3 seconds
6. Check both devices

**Expected:**
- ✅ Both devices have all 4 songs
- ✅ No duplicates
- ✅ Data consistent across devices

**Validation:**
- [ ] Test passed
- [ ] Device A song count: ___
- [ ] Device B song count: ___
- [ ] Duplicates: YES / NO
- [ ] Notes: _________________________________

---

#### Test 3.5: WebSocket Reconnection
**Steps:**
1. Both devices online with sync active
2. On Device B, go offline (Dev Dashboard)
3. On Device A, create "Missed Update Song"
4. On Device B, go back online
5. Watch Device B

**Expected:**
- ✅ Device B reconnects within 3 seconds
- ✅ "Missed Update Song" appears on Device B
- ✅ Sync status indicator updates correctly

**Validation:**
- [ ] Test passed
- [ ] Reconnect time: ___ seconds
- [ ] Missed update synced: YES / NO
- [ ] Notes: _________________________________

---

### Test Suite 4: Error Scenarios (30 minutes)

#### Test 4.1: Network Error During Create
**Steps:**
1. While online, start creating a song "Network Error Test"
2. Go offline BEFORE clicking save (if possible)
3. Click save
4. Go back online

**Expected:**
- ✅ Song saved locally
- ✅ Queued for sync (visible in Dev Dashboard)
- ✅ After going online, syncs successfully
- ✅ No data loss

**Validation:**
- [ ] Test passed
- [ ] Song in IndexedDB immediately: YES / NO
- [ ] Song synced after online: YES / NO
- [ ] Notes: _________________________________

---

#### Test 4.2: Invalid Data Handling
**Steps:**
1. Try to create a song with empty title
2. Try to create a song with title that's 1000 characters long
3. Try to create a song with special characters in title

**Expected:**
- ✅ Empty title: Shows validation error, doesn't save
- ✅ Long title: Either truncates or shows error
- ✅ Special characters: Either escapes or shows error
- ✅ App doesn't crash

**Validation:**
- [ ] Test passed
- [ ] Empty title handled: YES / NO
- [ ] Long title handled: YES / NO
- [ ] Special chars handled: YES / NO
- [ ] Notes: _________________________________

---

#### Test 4.3: Sync Queue Overflow
**Steps:**
1. Go offline
2. Create 20 songs rapidly (use Dev Dashboard "Generate Test Data" if available)
3. Check Dev Dashboard sync queue
4. Go online
5. Watch sync queue process

**Expected:**
- ✅ All 20 songs queued while offline
- ✅ Sync queue shows 20 pending items
- ✅ After going online, all process successfully
- ✅ No errors or crashes
- ✅ Sync completes within 30 seconds

**Validation:**
- [ ] Test passed
- [ ] Initial queue count: ___
- [ ] Final queue count: 0
- [ ] Sync time for 20 items: ___ seconds
- [ ] Errors: YES / NO
- [ ] Notes: _________________________________

---

### Test Suite 5: Performance & Stability (30 minutes)

#### Test 5.1: Large Dataset Performance
**Steps:**
1. Use Dev Dashboard "Reset Test Data" to load 50 songs
2. Navigate to Songs page
3. Measure page load time
4. Scroll through entire list
5. Search/filter songs

**Expected:**
- ✅ Page loads within 2 seconds
- ✅ Scrolling is smooth (no lag)
- ✅ Search results instant (< 500ms)
- ✅ UI remains responsive

**Validation:**
- [ ] Test passed
- [ ] Page load time: ___ seconds
- [ ] Scrolling: Smooth / Laggy
- [ ] Search time: ___ ms
- [ ] Notes: _________________________________

---

#### Test 5.2: Long Running Session
**Steps:**
1. Leave app open for 30 minutes
2. Perform various operations:
   - Create 5 songs
   - Edit 5 songs
   - Delete 2 songs
   - Navigate between pages
3. Check Dev Dashboard memory usage

**Expected:**
- ✅ App still responsive after 30 minutes
- ✅ No memory leaks (< 100MB growth)
- ✅ All operations work correctly
- ✅ No UI glitches

**Validation:**
- [ ] Test passed
- [ ] Memory growth: ___ MB
- [ ] UI responsive: YES / NO
- [ ] Notes: _________________________________

---

#### Test 5.3: Concurrent Tab Operations
**Steps:**
1. Open app in 3 tabs (Tab A, B, C)
2. In Tab A, create "Tab A Song"
3. In Tab B, create "Tab B Song"
4. In Tab C, create "Tab C Song"
5. Wait 5 seconds
6. Verify all tabs show all 3 songs

**Expected:**
- ✅ All tabs synchronized
- ✅ No duplicates
- ✅ Correct song count in each tab

**Validation:**
- [ ] Test passed
- [ ] Tab A count: ___
- [ ] Tab B count: ___
- [ ] Tab C count: ___
- [ ] Notes: _________________________________

---

## 🎯 Data Consistency Validation (Using Dev Dashboard)

### Consistency Check 1: IndexedDB ↔ Supabase Match
**Steps:**
1. After completing all tests above
2. Open Dev Dashboard
3. Check "Database Inspector" tab
4. Compare IndexedDB count vs Supabase count for each table

**Expected:**
- ✅ Songs count matches
- ✅ Setlists count matches
- ✅ Shows count matches
- ✅ Practices count matches

**Validation:**
| Table | IndexedDB | Supabase | Match? |
|-------|-----------|----------|--------|
| Songs | ___ | ___ | YES / NO |
| Setlists | ___ | ___ | YES / NO |
| Shows | ___ | ___ | YES / NO |
| Practices | ___ | ___ | YES / NO |

---

### Consistency Check 2: No Orphaned Data
**Steps:**
1. In Dev Dashboard, click "Validate Data Integrity"
2. Check for:
   - Songs without valid band_id
   - Duplicate IDs
   - Missing required fields

**Expected:**
- ✅ No orphaned records
- ✅ No duplicate IDs
- ✅ All records have required fields

**Validation:**
- [ ] Check passed
- [ ] Orphaned records: ___ (should be 0)
- [ ] Duplicate IDs: ___ (should be 0)
- [ ] Notes: _________________________________

---

### Consistency Check 3: Sync Queue Clean
**Steps:**
1. Open Dev Dashboard → Sync Queue tab
2. Verify queue is empty (all operations completed)

**Expected:**
- ✅ Pending operations: 0
- ✅ Failed operations: 0
- ✅ Retry queue empty

**Validation:**
- [ ] Check passed
- [ ] Pending: ___
- [ ] Failed: ___
- [ ] Notes: _________________________________

---

## 🐛 Known Issues Tracking

### Issues Found During Testing

| # | Test | Issue Description | Severity | Status |
|---|------|-------------------|----------|--------|
| 1 | ___ | ___________________________ | High/Med/Low | Open/Fixed |
| 2 | ___ | ___________________________ | High/Med/Low | Open/Fixed |
| 3 | ___ | ___________________________ | High/Med/Low | Open/Fixed |

---

## ✅ MVP Launch Readiness Checklist

### Critical (Must Pass)
- [ ] Test 1.2: Session timeout doesn't crash app ⭐
- [ ] Test 2.2: Offline creation syncs correctly ⭐
- [ ] Test 3.1: Real-time sync works (< 1s latency) ⭐
- [ ] Test 4.3: Sync queue handles load ⭐
- [ ] Consistency Check 1: All counts match ⭐

### High Priority (Should Pass)
- [ ] Test 1.3: Multi-tab session sync
- [ ] Test 2.3: Offline edit syncs
- [ ] Test 3.4: Rapid changes stay consistent
- [ ] Test 4.1: Network error recovery
- [ ] Test 5.1: Large dataset performance

### Medium Priority (Nice to Have)
- [ ] Test 2.4: Offline delete syncs
- [ ] Test 3.5: WebSocket reconnection
- [ ] Test 4.2: Invalid data handling
- [ ] Test 5.2: Long running session stability
- [ ] Test 5.3: Concurrent tab operations

---

## 📊 Test Results Summary

### Overall Pass Rate
- **Critical Tests:** ___ / 5 passing (Need 5/5 for MVP)
- **High Priority:** ___ / 5 passing (Need 4/5 for MVP)
- **Medium Priority:** ___ / 5 passing (Need 3/5 for MVP)
- **Total:** ___ / 15 passing (___%)\n\n### Recommendation
- [ ] **READY FOR MVP LAUNCH** - All critical tests pass
- [ ] **NEEDS WORK** - Critical issues found (see Known Issues)
- [ ] **BLOCKED** - Major bugs prevent MVP launch

---

## 📝 Post-Test Actions

### If All Tests Pass ✅
1. Document any minor issues in GitHub Issues
2. Tag commit as "MVP-Ready"
3. Deploy to staging environment
4. Perform smoke tests on staging
5. Deploy to production

### If Critical Tests Fail ❌
1. Document all issues in Known Issues section
2. Prioritize fixes (High → Medium → Low)
3. Fix critical issues
4. Re-run failed tests
5. Repeat until all critical tests pass

### If Edge Cases Found 🐛
1. Add issue to journey test suite
2. Write test for the edge case
3. Fix the bug
4. Verify test passes
5. Update this validation plan

---

## 🔗 Related Documents

### Test Implementation
- **Journey Tests:** `tests/journeys/*.test.ts`
- **Test Helpers:** `tests/journeys/helpers/testSetup.ts`

### Strategy & Plans
- **Test Strategy:** `.claude/artifacts/2025-11-03T15:20_comprehensive-test-strategy.md`
- **Phase 1 Complete:** `.claude/artifacts/2025-11-03T15:46_phase1-test-cleanup-complete.md`

### Developer Tools
- **Dev Dashboard:** (To be built in Phase 5)
- **Roadmap:** `.claude/artifacts/2025-10-29T16:15_unified-implementation-roadmap.md`

---

## 💡 Testing Tips

### Using Dev Dashboard Effectively
1. **Database Inspector:** Keep open during tests to watch real-time counts
2. **Sync Queue:** Monitor to verify operations complete
3. **Network Tools:** Use "Simulate Offline" instead of actual network disconnection
4. **Test Data:** Use "Reset Test Data" between test suites for clean state

### Troubleshooting
- **Sync not working?** Check WebSocket status in Dev Dashboard
- **Data mismatch?** Force full sync and check again
- **Toast not showing?** Check browser console for errors
- **Slow performance?** Check IndexedDB size in Dev Dashboard

### Best Practices
- ✅ Test one scenario at a time
- ✅ Record exact timings (sync latency, load times)
- ✅ Take screenshots of issues
- ✅ Clear data between major test suites
- ✅ Test on multiple browsers
- ✅ Test on mobile device if possible

---

**Status:** Ready for Execution
**Prerequisites:** Phase 5 (Dev Dashboard) must be complete
**Estimated Time:** 3-4 hours for full validation
**Next:** Build Developer Dashboard, then run this validation plan
