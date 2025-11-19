---
created: 2025-11-14T14:13
type: implementation-guide
status: ready-for-implementation
priority: critical
blocks: E2E test implementation
---

# Testability Attributes Required for Setlists, Shows, and Practices E2E Tests

## Executive Summary

To complete E2E test coverage for MVP (Flows 11-12, 14-16), we need to add testability attributes to three page components. This document specifies exactly which attributes must be added to enable E2E testing without relying on fragile text selectors or CSS classes.

**Files to Modify:**
1. `src/pages/NewLayout/SetlistsPage.tsx` - Setlists CRUD
2. `src/pages/NewLayout/ShowsPage.tsx` - Shows CRUD
3. `src/pages/NewLayout/PracticesPage.tsx` - Practices CRUD

**Testability Standards** (from CLAUDE.md):
- `name` attribute (camelCase) - For form functionality
- `id` attribute (kebab-case) - For label association
- `data-testid` attribute (full descriptor) - For E2E test stability

---

## 1. Setlists Page (`SetlistsPage.tsx`)

### Priority: Critical (Blocks Flows 11-12)

### Required Testability Attributes

#### Main Actions
```tsx
// Add setlist button
<button data-testid="create-setlist-button">
  <Plus /> Create Setlist
</button>

// Setlist list items
<div data-testid="setlist-list">
  {setlists.map(setlist => (
    <div key={setlist.id} data-testid={`setlist-item-${setlist.id}`}>
      <h3 data-testid={`setlist-name-${setlist.id}`}>{setlist.name}</h3>
      <span data-testid={`setlist-song-count-${setlist.id}`}>{setlist.songCount} songs</span>
      <span data-testid={`setlist-duration-${setlist.id}`}>{setlist.totalDuration}</span>
    </div>
  ))}
</div>

// Empty state
<div data-testid="setlist-empty-state">
  No setlists yet. Create your first setlist!
</div>
```

#### Create/Edit Setlist Modal
```tsx
// Modal container
<div data-testid="setlist-modal">

  // Form inputs
  <input
    type="text"
    name="setlistName"
    id="setlist-name"
    data-testid="setlist-name-input"
    placeholder="Enter setlist name"
  />

  <select
    name="status"
    id="setlist-status"
    data-testid="setlist-status-select"
  >
    <option value="draft">Draft</option>
    <option value="active">Active</option>
    <option value="archived">Archived</option>
  </select>

  <select
    name="associatedShow"
    id="setlist-show"
    data-testid="setlist-show-select"
  >
    <option value="">None</option>
    {/* Show options */}
  </select>

  // Song list (available to add)
  <div data-testid="available-songs-list">
    {availableSongs.map(song => (
      <div
        key={song.id}
        data-testid={`available-song-${song.id}`}
      >
        <span>{song.title} - {song.artist}</span>
        <button data-testid={`add-song-${song.id}`}>
          <Plus /> Add
        </button>
      </div>
    ))}
  </div>

  // Setlist items (drag and drop area)
  <div data-testid="setlist-items-list">
    {items.map((item, index) => (
      <div
        key={item.id}
        data-testid={`setlist-item-${index}`}
        data-song-id={item.songId}
      >
        <button data-testid={`remove-item-${index}`}>
          <X />
        </button>
        <span data-testid={`item-position-${index}`}>{index + 1}</span>
        <span data-testid={`item-title-${index}`}>{item.song?.title}</span>
      </div>
    ))}
  </div>

  // Action buttons
  <button
    type="submit"
    data-testid="save-setlist-button"
  >
    Save Setlist
  </button>

  <button
    type="button"
    data-testid="cancel-setlist-button"
  >
    Cancel
  </button>
</div>
```

#### Setlist Actions Menu
```tsx
// Edit button
<button data-testid={`edit-setlist-${setlist.id}`}>
  <Edit2 /> Edit
</button>

// Delete button
<button data-testid={`delete-setlist-${setlist.id}`}>
  <Trash2 /> Delete
</button>

// Duplicate button
<button data-testid={`duplicate-setlist-${setlist.id}`}>
  <Copy /> Duplicate
</button>
```

#### Delete Confirmation Modal
```tsx
<div data-testid="delete-setlist-modal">
  <p>Are you sure you want to delete this setlist?</p>
  <button data-testid="confirm-delete-setlist">
    Delete
  </button>
  <button data-testid="cancel-delete-setlist">
    Cancel
  </button>
</div>
```

---

## 2. Shows Page (`ShowsPage.tsx`)

### Priority: Critical (Blocks Flows 15-16)

### Required Testability Attributes

#### Main Actions
```tsx
// Add show button
<button data-testid="create-show-button">
  <Plus /> Schedule Show
</button>

// Show list items
<div data-testid="show-list">
  {shows.map(show => (
    <div key={show.id} data-testid={`show-item-${show.id}`}>
      <h3 data-testid={`show-name-${show.id}`}>{show.name}</h3>
      <span data-testid={`show-date-${show.id}`}>{show.date}</span>
      <span data-testid={`show-venue-${show.id}`}>{show.venue}</span>
      <span data-testid={`show-location-${show.id}`}>{show.location}</span>
    </div>
  ))}
</div>

// Empty state
<div data-testid="show-empty-state">
  No shows scheduled. Add your first show!
</div>
```

#### Create/Edit Show Modal
```tsx
// Modal container
<div data-testid="show-modal">

  // Form inputs
  <input
    type="text"
    name="showName"
    id="show-name"
    data-testid="show-name-input"
    placeholder="Show name"
  />

  <input
    type="date"
    name="showDate"
    id="show-date"
    data-testid="show-date-input"
  />

  <input
    type="time"
    name="showTime"
    id="show-time"
    data-testid="show-time-input"
  />

  <input
    type="text"
    name="venue"
    id="show-venue"
    data-testid="show-venue-input"
    placeholder="Venue name"
  />

  <input
    type="text"
    name="location"
    id="show-location"
    data-testid="show-location-input"
    placeholder="City, State"
  />

  <select
    name="setlist"
    id="show-setlist"
    data-testid="show-setlist-select"
  >
    <option value="">Select setlist (optional)</option>
    {/* Setlist options */}
  </select>

  <textarea
    name="notes"
    id="show-notes"
    data-testid="show-notes-textarea"
    placeholder="Notes (optional)"
  />

  // Action buttons
  <button
    type="submit"
    data-testid="save-show-button"
  >
    Save Show
  </button>

  <button
    type="button"
    data-testid="cancel-show-button"
  >
    Cancel
  </button>
</div>
```

#### Show Actions Menu
```tsx
// Edit button
<button data-testid={`edit-show-${show.id}`}>
  <Edit2 /> Edit
</button>

// Delete button
<button data-testid={`delete-show-${show.id}`}>
  <Trash2 /> Delete
</button>

// Assign setlist button (if no setlist)
<button data-testid={`assign-setlist-${show.id}`}>
  <ListMusic /> Assign Setlist
</button>
```

#### Delete Confirmation Modal
```tsx
<div data-testid="delete-show-modal">
  <p>Are you sure you want to delete this show?</p>
  <button data-testid="confirm-delete-show">
    Delete
  </button>
  <button data-testid="cancel-delete-show">
    Cancel
  </button>
</div>
```

---

## 3. Practices Page (`PracticesPage.tsx`)

### Priority: Critical (Blocks Flow 14)

### Required Testability Attributes

#### Main Actions
```tsx
// Add practice button
<button data-testid="create-practice-button">
  <Plus /> Schedule Practice
</button>

// Practice list items
<div data-testid="practice-list">
  {practices.map(practice => (
    <div key={practice.id} data-testid={`practice-item-${practice.id}`}>
      <h3 data-testid={`practice-date-${practice.id}`}>{practice.date}</h3>
      <span data-testid={`practice-time-${practice.id}`}>{practice.time}</span>
      <span data-testid={`practice-duration-${practice.id}`}>{practice.duration}</span>
      <span data-testid={`practice-location-${practice.id}`}>{practice.location}</span>
    </div>
  ))}
</div>

// Empty state
<div data-testid="practice-empty-state">
  No practices scheduled. Schedule your first practice!
</div>
```

#### Create/Edit Practice Modal
```tsx
// Modal container
<div data-testid="practice-modal">

  // Form inputs
  <input
    type="date"
    name="practiceDate"
    id="practice-date"
    data-testid="practice-date-input"
  />

  <input
    type="time"
    name="practiceTime"
    id="practice-time"
    data-testid="practice-time-input"
  />

  <input
    type="number"
    name="duration"
    id="practice-duration"
    data-testid="practice-duration-input"
    placeholder="Duration (hours)"
  />

  <input
    type="text"
    name="location"
    id="practice-location"
    data-testid="practice-location-input"
    placeholder="Location"
  />

  <select
    name="associatedShow"
    id="practice-show"
    data-testid="practice-show-select"
  >
    <option value="">No show (optional)</option>
    {/* Show options - auto-populate songs */}
  </select>

  <textarea
    name="notes"
    id="practice-notes"
    data-testid="practice-notes-textarea"
    placeholder="Notes (optional)"
  />

  // Songs to practice (checkboxes or list)
  <div data-testid="practice-songs-list">
    {songs.map(song => (
      <div key={song.id} data-testid={`practice-song-${song.id}`}>
        <input
          type="checkbox"
          id={`practice-song-${song.id}-checkbox`}
          data-testid={`practice-song-${song.id}-checkbox`}
        />
        <label htmlFor={`practice-song-${song.id}-checkbox`}>
          {song.title} - {song.artist}
        </label>
      </div>
    ))}
  </div>

  // Action buttons
  <button
    type="submit"
    data-testid="save-practice-button"
  >
    Save Practice
  </button>

  <button
    type="button"
    data-testid="cancel-practice-button"
  >
    Cancel
  </button>
</div>
```

#### Practice Actions Menu
```tsx
// Edit button
<button data-testid={`edit-practice-${practice.id}`}>
  <Edit2 /> Edit
</button>

// Delete button
<button data-testid={`delete-practice-${practice.id}`}>
  <Trash2 /> Delete
</button>
```

#### Delete Confirmation Modal
```tsx
<div data-testid="delete-practice-modal">
  <p>Are you sure you want to delete this practice session?</p>
  <button data-testid="confirm-delete-practice">
    Delete
  </button>
  <button data-testid="cancel-delete-practice">
    Cancel
  </button>
</div>
```

---

## Implementation Checklist

### Phase 1: Add Testability Attributes (This Artifact)
- [ ] Update `SetlistsPage.tsx` with all data-testid attributes
  - [ ] Main list and empty state
  - [ ] Create/edit modal form
  - [ ] Song selection UI
  - [ ] Drag-and-drop items
  - [ ] Action buttons
  - [ ] Delete confirmation
- [ ] Update `ShowsPage.tsx` with all data-testid attributes
  - [ ] Main list and empty state
  - [ ] Create/edit modal form
  - [ ] Setlist assignment
  - [ ] Action buttons
  - [ ] Delete confirmation
- [ ] Update `PracticesPage.tsx` with all data-testid attributes
  - [ ] Main list and empty state
  - [ ] Create/edit modal form
  - [ ] Song selection checkboxes
  - [ ] Show association
  - [ ] Action buttons
  - [ ] Delete confirmation

### Phase 2: Create E2E Test Files
- [ ] `tests/e2e/setlists/crud.spec.ts` (Flow 11-12)
- [ ] `tests/e2e/shows/crud.spec.ts` (Flow 15-16)
- [ ] `tests/e2e/practices/crud.spec.ts` (Flow 14)

### Phase 3: Verification
- [ ] Run E2E tests: `npm run test:e2e`
- [ ] Verify all browsers passing (Chromium, Firefox, WebKit, Mobile)
- [ ] Check for console errors
- [ ] Update test coverage reports

---

## Expected Test Coverage After Implementation

### Setlists (Flows 11-12)
**Flow 11: Create Setlist**
- User navigates to /setlists
- User clicks "Create Setlist"
- User enters setlist name
- User adds songs from available list
- User reorders songs with drag-and-drop
- User sets status (draft/active)
- User saves setlist
- ✅ Setlist appears in list
- ✅ All band members can see setlist

**Flow 12: Edit Setlist**
- User clicks on existing setlist
- User edits name
- User removes song
- User adds new song
- User reorders songs
- User saves changes
- ✅ Changes persist
- ✅ Updates visible to all members

### Shows (Flows 15-16)
**Flow 15: Schedule Show**
- User navigates to /shows
- User clicks "Schedule Show"
- User enters show details (name, date, venue, location)
- User optionally selects setlist
- User saves show
- ✅ Show appears in upcoming shows
- ✅ Show date prominent and correct
- ✅ All band members see show

**Flow 16: Assign Setlist to Show**
- User clicks on show without setlist
- User clicks "Assign Setlist"
- User selects setlist from dropdown
- ✅ Setlist linked to show
- Show displays setlist details
- Song count matches setlist

### Practices (Flow 14)
**Flow 14: Schedule Practice**
- User navigates to /practices
- User clicks "Schedule Practice"
- User enters date, time, duration, location
- User optionally associates with show
- User selects songs to practice
- User saves practice
- ✅ Practice appears in upcoming list
- ✅ All band members see practice

---

## Notes for Implementation

### Testability Best Practices
1. **Always use `data-testid`** for E2E test selectors (never rely on text or CSS classes)
2. **Use dynamic IDs** with item IDs for list items (e.g., `setlist-item-${id}`)
3. **Add both `id` and `data-testid`** to form inputs for accessibility + testing
4. **Use descriptive naming** following pattern: `{context}-{field}-{type}`
5. **Test modals separately** with unique testids (e.g., `setlist-modal`, `show-modal`)

### Common Patterns
```tsx
// List item
<div data-testid={`${entity}-item-${item.id}`}>

// Form input
<input
  name="fieldName"              // camelCase for form
  id="{entity}-{field}"         // kebab-case for accessibility
  data-testid="{entity}-{field}-input"  // full descriptor for testing
/>

// Button
<button data-testid="{action}-{entity}-button">

// Modal
<div data-testid="{entity}-modal">
```

### Drag-and-Drop Testing
Setlists use `@dnd-kit/core` for reordering. Test attributes must support:
- Identifying draggable items by position: `setlist-item-${index}`
- Verifying order changes: Check position numbers after drag
- Confirming persistence: Reload page and verify order maintained

### Date/Time Inputs
All date/time inputs should use native HTML5 input types:
- `<input type="date">` - Cross-browser support
- `<input type="time">` - 24-hour format
- Playwright can fill these with `.fill('2025-06-15')` syntax

---

## Impact Assessment

### Files to Modify: 3
1. `src/pages/NewLayout/SetlistsPage.tsx` (~50 attribute additions)
2. `src/pages/NewLayout/ShowsPage.tsx` (~30 attribute additions)
3. `src/pages/NewLayout/PracticesPage.tsx` (~25 attribute additions)

### Estimated Effort
- Adding attributes: 1-2 hours per file
- Creating E2E tests: 2-3 hours per test file
- Total: ~12-15 hours

### Risk Level: LOW
- Changes are additive (no logic modification)
- No breaking changes to existing functionality
- Improves accessibility (proper label association)
- Enables browser autofill and password managers

### Benefits
✅ Complete E2E test coverage for MVP
✅ Catch bugs before production
✅ Confident deployments
✅ Better accessibility
✅ Improved observability and debugging

---

## Next Steps

**Option A: Apply changes now**
Modify all three page files with testability attributes, then create E2E tests.

**Option B: Delegate to specialized agent**
Use Task tool to launch `nextjs-react-developer` agent to apply testability attributes, then create E2E tests afterward.

**Option C: Incremental approach**
Implement one page at a time (setlists → shows → practices) with full E2E tests for each before moving to next.

**Recommendation:** Option C (incremental) provides fastest feedback loop and catches issues early.

---

**Status:** Ready for implementation
**Created:** 2025-11-14T14:13
**Blocks:** MVP E2E test completion (Flows 11-12, 14-16)
**Priority:** Critical
