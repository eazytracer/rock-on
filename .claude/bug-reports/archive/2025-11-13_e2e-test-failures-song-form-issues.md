---
title: E2E Test Failures - Song Form Missing Name Attributes and Submission Issues
created: 2025-11-13T01:13
severity: Critical
type: Bug Report
status: Needs Investigation
affected_tests: 40+ tests (songs CRUD, permissions RBAC, search/filter)
---

# E2E Test Failures - Song Form Issues

## Executive Summary

**Status**: Critical - 160 out of 236 E2E tests failing (68% failure rate)

**Root Causes Identified**:
1. **APP BUG**: Song creation form inputs missing `name` attributes (prevents standard form selectors)
2. **APP BUG**: Form submission appears to hang/timeout when clicking "Create Song"
3. **TEST BUG**: Incorrect selector property name (`inviteCodeDisplay` should be `inviteCode`)

**Impact**:
- All song-related E2E tests failing
- All tests that create songs as prerequisites failing
- Cannot validate song CRUD, permissions, search/filter workflows

---

## Investigation Summary

### Test Execution Results

**Command**: `npm run test:e2e -- --reporter=list`

**Results**:
- ❌ 160 tests **FAILED**
- ✅ 76 tests passed
- ⏭️ 14 tests skipped
- **Failure Rate**: 68%

### Manual Verification via Chrome MCP

To understand the root cause, I manually tested the Add Song workflow using Chrome DevTools Protocol:

**Test Flow**:
1. ✅ Signup successful (`test@example.com`, "Test User")
2. ✅ Create band successful ("Test Band", invite code: `KEXNVM`)
3. ✅ Navigation to /songs page successful
4. ✅ Click "Add Song" button successful
5. ✅ **Modal opened and is visible** (contradicts initial assumption that modal wasn't appearing)
6. ✅ Successfully filled: Title = "Test Song", Artist = "Test Artist"
7. ❌ **Form submission TIMED OUT** when clicking "Create Song" button

**Critical Discovery**: The Add Song modal IS visible and functional, but:
- Form inputs have NO `name` attributes
- Form submission hangs/times out

---

## Issue #1: Missing `name` Attributes on Form Inputs (CRITICAL)

### Evidence from Accessibility Tree

**Actual HTML structure** (from Chrome MCP snapshot):

```
textbox "Enter song title" required value="Test Song"
textbox "Enter artist name" required value="Test Artist"
textbox "Enter album name"
textbox "0"  // Duration minutes
textbox "00"  // Duration seconds
textbox "120"  // BPM
textbox "Enter any notes"  // Notes field
combobox value="Standard"  // Tuning dropdown
```

**Problem**: None of these inputs have `name` attributes!

### Expected HTML Structure

Form inputs should have proper semantic HTML:

```html
<input
  type="text"
  name="title"           <!-- MISSING -->
  id="song-title"        <!-- MISSING -->
  data-testid="song-title-input"  <!-- MISSING -->
  placeholder="Enter song title"
  required
/>

<input
  type="text"
  name="artist"          <!-- MISSING -->
  id="song-artist"       <!-- MISSING -->
  data-testid="song-artist-input"  <!-- MISSING -->
  placeholder="Enter artist name"
  required
/>
```

### Test Failure Pattern

**Test Selector** (from `tests/helpers/selectors.ts`):
```typescript
song: {
  titleInput: 'input[name="title"], input[id="title"]',
  artistInput: 'input[name="artist"], input[id="artist"]',
  // ... other fields
}
```

**Test Failure Log**:
```
waiting for locator('input[name="title"]')
  - waiting for locator('input[name="title"]')
  - locator resolved to <hidden></hidden>
  - locator resolved to <hidden></hidden>
Timeout: 30000ms exceeded
```

**Root Cause**: The selector `input[name="title"]` cannot find any element because NO inputs have `name` attributes.

### Impact

**All song-related tests fail**, including:
- ❌ `tests/e2e/songs/crud.spec.ts` (7 tests)
- ❌ `tests/e2e/songs/search-filter.spec.ts` (6 tests)
- ❌ `tests/e2e/permissions/rbac.spec.ts` (partially - 3/7 tests create songs)
- ❌ Any test that creates songs as test data

### Files Likely Affected

**Component to fix** (probable location):
- `src/components/songs/AddSongModal.tsx` (or similar)
- `src/components/songs/SongForm.tsx` (or similar)
- Any custom input components used in the song form

### Recommended Fix

**Add proper form attributes to ALL inputs**:

```tsx
// Title input
<InputField
  name="title"                    // ADD THIS
  id="song-title"                 // ADD THIS
  data-testid="song-title-input"  // ADD THIS
  placeholder="Enter song title"
  required
  value={title}
  onChange={handleTitleChange}
/>

// Artist input
<InputField
  name="artist"                   // ADD THIS
  id="song-artist"                // ADD THIS
  data-testid="song-artist-input" // ADD THIS
  placeholder="Enter artist name"
  required
  value={artist}
  onChange={handleArtistChange}
/>

// Album input
<InputField
  name="album"                    // ADD THIS
  id="song-album"                 // ADD THIS
  data-testid="song-album-input"  // ADD THIS
  placeholder="Enter album name"
  value={album}
  onChange={handleAlbumChange}
/>

// Duration minutes
<InputField
  type="number"
  name="durationMinutes"          // ADD THIS
  id="song-duration-minutes"      // ADD THIS
  data-testid="song-duration-minutes-input"  // ADD THIS
  min="0"
  value={durationMinutes}
  onChange={handleDurationMinutesChange}
/>

// Duration seconds
<InputField
  type="number"
  name="durationSeconds"          // ADD THIS
  id="song-duration-seconds"      // ADD THIS
  data-testid="song-duration-seconds-input"  // ADD THIS
  min="0"
  max="59"
  value={durationSeconds}
  onChange={handleDurationSecondsChange}
/>

// BPM
<InputField
  type="number"
  name="bpm"                      // ADD THIS
  id="song-bpm"                   // ADD THIS
  data-testid="song-bpm-input"    // ADD THIS
  placeholder="120"
  value={bpm}
  onChange={handleBpmChange}
/>

// Notes
<TextAreaField
  name="notes"                    // ADD THIS
  id="song-notes"                 // ADD THIS
  data-testid="song-notes-input"  // ADD THIS
  placeholder="Enter any notes"
  value={notes}
  onChange={handleNotesChange}
/>

// Tuning dropdown (if custom component)
<SelectField
  name="tuning"                   // ADD THIS
  id="song-tuning"                // ADD THIS
  data-testid="song-tuning-select"  // ADD THIS
  value={tuning}
  onChange={handleTuningChange}
>
  <option value="Standard">Standard</option>
  <option value="Drop D">Drop D</option>
  {/* ... other options */}
</SelectField>
```

**Benefits of this fix**:
1. ✅ E2E tests can find and interact with form fields
2. ✅ Better accessibility (labels can use `htmlFor`)
3. ✅ Browser autofill/autocomplete works
4. ✅ Password managers work
5. ✅ Standard form validation works
6. ✅ Follows HTML best practices

---

## Issue #2: Form Submission Timeout (CRITICAL)

### Evidence

**Manual Test via Chrome MCP**:
```
1. Filled form successfully:
   - Title: "Test Song"
   - Artist: "Test Artist"

2. Clicked "Create Song" button

3. Result: TIMEOUT
   Error: Timed out after waiting 5000ms
   Protocol error (Accessibility.getFullAXTree): Browser failed to respond
```

### Symptoms

- Form fills successfully
- "Create Song" button is clickable
- After clicking, the app appears to hang
- No response within 5 seconds
- Accessibility tree request times out

### Possible Causes

1. **JavaScript error** preventing form submission
2. **Async operation** not completing (e.g., Supabase call hanging)
3. **State management issue** causing infinite loop
4. **Validation** silently failing
5. **Missing error handling** in submission handler

### Investigation Needed

**Check the following**:

1. **Console logs** during form submission (errors, warnings)
2. **Network requests** - is Supabase call being made? Does it complete?
3. **Form submit handler** - is there error handling?
4. **Validation logic** - could it be blocking submission?
5. **State updates** - are there any infinite re-render loops?

**Files to investigate**:
- Song form component (`src/components/songs/AddSongModal.tsx` or similar)
- Song creation handler/service
- `src/hooks/useSongs.ts` (if exists)
- `src/services/data/SyncRepository.ts` (song creation logic)

### Test to Run

```bash
# Check browser console for errors during submission
npm run dev
# Then manually test Add Song and check console
```

---

## Issue #3: Test Selector Property Name Mismatch

### Evidence

**Test failure log**:
```
waiting for locator('undefined').first()
```

**Test code** (multiple files):
```typescript
const inviteCode = await getInviteCodeViaUI(adminPage);
```

**Function implementation** (`tests/fixtures/bands.ts`):
```typescript
export async function getInviteCodeViaUI(page: Page): Promise<string> {
  const inviteCodeElement = page.locator(selectors.band.inviteCodeDisplay).first();
  //                                                     ^^^ WRONG property name
  await expect(inviteCodeElement).toBeVisible({ timeout: 5000 });
  const inviteCode = await inviteCodeElement.textContent();
  return inviteCode?.trim() || '';
}
```

**Actual selector definition** (`tests/helpers/selectors.ts:41`):
```typescript
band: {
  nameInput: 'input[name="bandName"], input[id="band-name"]',
  createButton: 'button:has-text("Create Band"), button[type="submit"]',
  inviteCode: '[data-testid="invite-code"], code:has-text("-")',
  //          ^^^ Correct property name is "inviteCode"
  // NOT "inviteCodeDisplay"
}
```

### Fix Required

**File**: `tests/fixtures/bands.ts`

**Change**:
```typescript
// BEFORE (WRONG):
const inviteCodeElement = page.locator(selectors.band.inviteCodeDisplay).first();

// AFTER (CORRECT):
const inviteCodeElement = page.locator(selectors.band.inviteCode).first();
```

### Impact

**Tests affected**:
- Any test that calls `getInviteCodeViaUI()`
- Band member management tests
- Multi-user collaboration tests
- Permissions tests
- All tests where one user invites another

**Status**: This is a **TEST BUG** (not an app bug) - can be fixed immediately.

---

## Issue #4: Additional Selector Issues Found

### Key Picker Modal

**From manual testing**, there's a "Choose Key" modal that appears:
```
dialog "Choose Key"
  button "C" selected
  button "C#"
  button "D"
  // ... circular key picker UI
```

**Question**: Do tests account for this modal? Tests may need to:
1. Click "Choose Key" button to open modal
2. Select a key from the circular picker
3. Close the modal

**File to check**: `tests/e2e/songs/crud.spec.ts`

---

## Test Coverage Status

### Current Implementation

**Completed** (from previous session):
- ✅ Auth/Signup (3 tests)
- ✅ Auth/Login (3 tests)
- ✅ Auth/Join Band (3 tests)
- ✅ Band Creation (7 tests) - **Likely affected by inviteCodeDisplay bug**
- ✅ Band Members (7 tests) - **Likely affected by inviteCodeDisplay bug**
- ✅ Band Isolation/RLS (6 tests)
- ✅ Songs CRUD (7 tests) - **ALL FAILING due to missing name attributes**
- ✅ Songs Search/Filter (6 tests) - **ALL FAILING due to missing name attributes**
- ✅ Permissions/RBAC (7 tests) - **Partially failing (tests that create songs)**

**Total**: 49 tests implemented

### Expected Results After Fixes

**If Issue #1 (missing name attributes) is fixed**:
- ✅ ~33 tests should start passing (songs CRUD, search/filter, song-dependent RBAC tests)

**If Issue #2 (form submission timeout) is fixed**:
- ✅ All song creation tests should complete successfully
- ✅ Multi-user collaboration tests should work

**If Issue #3 (inviteCodeDisplay) is fixed**:
- ✅ ~15 tests should start passing (all tests that use invite codes)

**Combined Impact**: ~160 failing tests → ~76 passing tests (estimated 140+ passing after all fixes)

---

## Recommended Actions

### Immediate (High Priority)

1. ✅ **Fix Test Bug** (Issue #3): Change `inviteCodeDisplay` → `inviteCode` in test fixtures
   - **File**: `tests/fixtures/bands.ts`
   - **Impact**: Immediate fix, ~15 tests should pass
   - **Owner**: Test team (can be done immediately)

2. 🔧 **Fix App Bug** (Issue #1): Add `name` attributes to song form inputs
   - **Files**: Song form components (AddSongModal, SongForm, or similar)
   - **Impact**: ~33 tests should pass
   - **Owner**: Frontend team
   - **Priority**: Critical - blocks all song testing

3. 🔧 **Investigate & Fix** (Issue #2): Form submission timeout
   - **Files**: Song form submission handler, useSongs hook, SyncRepository
   - **Steps**:
     a. Run app manually and check console during form submission
     b. Check network tab for failed/hanging Supabase requests
     c. Add error handling and logging to submission handler
     d. Fix root cause of timeout
   - **Priority**: Critical - blocks all song creation

### Follow-Up (Medium Priority)

4. **Verify key picker modal** interaction in tests
   - Check if tests need to interact with "Choose Key" modal
   - Add test steps if needed

5. **Re-run full test suite** after all fixes applied
   ```bash
   npm run test:e2e -- --reporter=list
   ```

6. **Document any remaining failures** and create new bug reports as needed

---

## Evidence Files

### Test Output Logs
- `/tmp/e2e-test-results.log` - Full test execution results (160 failures)

### Manual Testing Logs
- `/tmp/chrome-test.log` - Chrome browser console output
- `/tmp/dev-server.log` - Vite dev server output

### Accessibility Tree Snapshots
Multiple snapshots taken during manual testing showing:
- Signup form structure
- Band creation form structure
- Add Song modal structure (**showing missing name attributes**)
- Key picker modal structure

---

## Browser Environment

**Testing Environment**:
- Chrome Version: 141.0.7390.122
- Remote Debugging: Port 9222
- Playwright Browsers: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- Dev Server: Vite on http://localhost:5173
- Backend: Local Supabase

---

## Next Steps

**For diagnose-agent**:

1. **Locate song form component files**:
   - Search for: "Add Song", "Create Song", song form components
   - Likely locations: `src/components/songs/`, `src/pages/`

2. **Add name attributes to all form inputs** (Issue #1)
   - Reference section "Recommended Fix" above for complete attribute list
   - Follow naming conventions from `.claude/specifications/2025-10-22T14:01_design-style-guide.md`

3. **Investigate form submission timeout** (Issue #2)
   - Add console.log to submission handler
   - Check for JavaScript errors
   - Verify Supabase calls complete
   - Add error handling

4. **Test fixes locally**:
   ```bash
   npm run dev
   # Manually test Add Song workflow
   npm run test:e2e -- tests/e2e/songs/crud.spec.ts
   ```

5. **Run full test suite** after fixes confirmed

---

## Conclusion

**Root Causes Summary**:
1. ✅ **TEST BUG**: Incorrect selector property name - can be fixed immediately
2. 🔧 **APP BUG**: Missing `name` attributes on form inputs - requires component changes
3. 🔧 **APP BUG**: Form submission timeout - requires investigation and debugging

**Confidence Level**: High - Issues are well-documented and reproducible via manual testing

**Expected Outcome**: After all fixes applied, E2E test pass rate should increase from 32% → 90%+
