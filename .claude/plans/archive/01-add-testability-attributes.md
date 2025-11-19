# Add Testability Attributes to Setlists, Shows, and Practices Pages

**Agent:** nextjs-react-developer
**Status:** Ready to Start
**Dependencies:** None
**Blocks:** 02-create-e2e-tests.md
**Priority:** Critical (MVP Blocker)
**Estimated Time:** 3-4 hours

---

## Objective

Add `data-testid`, `id`, and `name` attributes to all interactive elements in three page components to enable E2E testing. Follow CLAUDE.md testability standards.

---

## Reference Documents

- **Specification:** `.claude/artifacts/2025-11-14T14:13_testability-attributes-for-setlists-shows-practices.md`
- **Standards:** `CLAUDE.md` (Testability Standards section)
- **Style Guide:** `.claude/specifications/2025-10-22T14:01_design-style-guide.md`

---

## Testability Standards Reminder

**All form inputs must include:**
- `name` attribute (camelCase) - For form functionality
- `id` attribute (kebab-case) - For label association
- `data-testid` attribute (full descriptor) - For E2E testing

**All buttons must include:**
- `data-testid` attribute - For E2E testing

**Naming Pattern:**
```tsx
<input
  name="setlistName"                 // camelCase
  id="setlist-name"                  // kebab-case
  data-testid="setlist-name-input"   // {context}-{field}-{type}
/>
```

---

## Task 1: SetlistsPage.tsx

**File:** `src/pages/NewLayout/SetlistsPage.tsx`
**Estimated:** 60-90 minutes

### 1.1 Main Page Elements

**Add to main container:**
```tsx
// Create button
<button data-testid="create-setlist-button">
  <Plus /> Create Setlist
</button>

// Setlist list
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

### 1.2 Create/Edit Modal Form

**Add to modal:**
```tsx
// Modal container
<div data-testid="setlist-modal">

  // Name input
  <input
    type="text"
    name="setlistName"
    id="setlist-name"
    data-testid="setlist-name-input"
    placeholder="Enter setlist name"
    required
  />

  // Status select
  <select
    name="status"
    id="setlist-status"
    data-testid="setlist-status-select"
  >
    <option value="draft">Draft</option>
    <option value="active">Active</option>
    <option value="archived">Archived</option>
  </select>

  // Associated show select
  <select
    name="associatedShow"
    id="setlist-show"
    data-testid="setlist-show-select"
  >
    <option value="">None</option>
    {/* Show options */}
  </select>
```

### 1.3 Song Selection UI

**Add to available songs list:**
```tsx
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
```

### 1.4 Setlist Items (Drag & Drop)

**Add to setlist items:**
```tsx
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
```

### 1.5 Action Buttons

**Add to buttons:**
```tsx
// Save
<button type="submit" data-testid="save-setlist-button">
  Save Setlist
</button>

// Cancel
<button type="button" data-testid="cancel-setlist-button">
  Cancel
</button>

// Edit
<button data-testid={`edit-setlist-${setlist.id}`}>
  <Edit2 /> Edit
</button>

// Delete
<button data-testid={`delete-setlist-${setlist.id}`}>
  <Trash2 /> Delete
</button>

// Duplicate
<button data-testid={`duplicate-setlist-${setlist.id}`}>
  <Copy /> Duplicate
</button>
```

### 1.6 Delete Confirmation Modal

**Add to delete modal:**
```tsx
<div data-testid="delete-setlist-modal">
  <p>Are you sure you want to delete this setlist?</p>
  <button data-testid="confirm-delete-setlist">Delete</button>
  <button data-testid="cancel-delete-setlist">Cancel</button>
</div>
```

### 1.7 Verification Checklist

- [ ] All form inputs have `name`, `id`, and `data-testid`
- [ ] All buttons have `data-testid`
- [ ] List items have unique testids with IDs
- [ ] Empty state has testid
- [ ] Modal has testid
- [ ] Delete confirmation has testids
- [ ] No console warnings or errors
- [ ] TypeScript compiles without errors

---

## Task 2: ShowsPage.tsx

**File:** `src/pages/NewLayout/ShowsPage.tsx`
**Estimated:** 45-60 minutes

### 2.1 Main Page Elements

**Add to main container:**
```tsx
// Create button
<button data-testid="create-show-button">
  <Plus /> Schedule Show
</button>

// Show list
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

### 2.2 Create/Edit Modal Form

**Add to modal:**
```tsx
// Modal container
<div data-testid="show-modal">

  // Show name
  <input
    type="text"
    name="showName"
    id="show-name"
    data-testid="show-name-input"
    placeholder="Show name"
    required
  />

  // Date
  <input
    type="date"
    name="showDate"
    id="show-date"
    data-testid="show-date-input"
    required
  />

  // Time
  <input
    type="time"
    name="showTime"
    id="show-time"
    data-testid="show-time-input"
  />

  // Venue
  <input
    type="text"
    name="venue"
    id="show-venue"
    data-testid="show-venue-input"
    placeholder="Venue name"
    required
  />

  // Location
  <input
    type="text"
    name="location"
    id="show-location"
    data-testid="show-location-input"
    placeholder="City, State"
  />

  // Setlist select
  <select
    name="setlist"
    id="show-setlist"
    data-testid="show-setlist-select"
  >
    <option value="">Select setlist (optional)</option>
    {/* Setlist options */}
  </select>

  // Notes
  <textarea
    name="notes"
    id="show-notes"
    data-testid="show-notes-textarea"
    placeholder="Notes (optional)"
  />
```

### 2.3 Action Buttons

**Add to buttons:**
```tsx
// Save
<button type="submit" data-testid="save-show-button">
  Save Show
</button>

// Cancel
<button type="button" data-testid="cancel-show-button">
  Cancel
</button>

// Edit
<button data-testid={`edit-show-${show.id}`}>
  <Edit2 /> Edit
</button>

// Delete
<button data-testid={`delete-show-${show.id}`}>
  <Trash2 /> Delete
</button>

// Assign setlist
<button data-testid={`assign-setlist-${show.id}`}>
  <ListMusic /> Assign Setlist
</button>
```

### 2.4 Delete Confirmation Modal

**Add to delete modal:**
```tsx
<div data-testid="delete-show-modal">
  <p>Are you sure you want to delete this show?</p>
  <button data-testid="confirm-delete-show">Delete</button>
  <button data-testid="cancel-delete-show">Cancel</button>
</div>
```

### 2.5 Verification Checklist

- [ ] All form inputs have `name`, `id`, and `data-testid`
- [ ] All buttons have `data-testid`
- [ ] List items have unique testids with IDs
- [ ] Empty state has testid
- [ ] Modal has testid
- [ ] Delete confirmation has testids
- [ ] Date/time inputs use HTML5 types
- [ ] No console warnings or errors
- [ ] TypeScript compiles without errors

---

## Task 3: PracticesPage.tsx

**File:** `src/pages/NewLayout/PracticesPage.tsx`
**Estimated:** 45-60 minutes

### 3.1 Main Page Elements

**Add to main container:**
```tsx
// Create button
<button data-testid="create-practice-button">
  <Plus /> Schedule Practice
</button>

// Practice list
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

### 3.2 Create/Edit Modal Form

**Add to modal:**
```tsx
// Modal container
<div data-testid="practice-modal">

  // Date
  <input
    type="date"
    name="practiceDate"
    id="practice-date"
    data-testid="practice-date-input"
    required
  />

  // Time
  <input
    type="time"
    name="practiceTime"
    id="practice-time"
    data-testid="practice-time-input"
    required
  />

  // Duration
  <input
    type="number"
    name="duration"
    id="practice-duration"
    data-testid="practice-duration-input"
    placeholder="Duration (hours)"
    min="0.5"
    step="0.5"
  />

  // Location
  <input
    type="text"
    name="location"
    id="practice-location"
    data-testid="practice-location-input"
    placeholder="Location"
  />

  // Associated show
  <select
    name="associatedShow"
    id="practice-show"
    data-testid="practice-show-select"
  >
    <option value="">No show (optional)</option>
    {/* Show options */}
  </select>

  // Notes
  <textarea
    name="notes"
    id="practice-notes"
    data-testid="practice-notes-textarea"
    placeholder="Notes (optional)"
  />
```

### 3.3 Song Selection (Checkboxes)

**Add to songs list:**
```tsx
<div data-testid="practice-songs-list">
  {songs.map(song => (
    <div key={song.id} data-testid={`practice-song-${song.id}`}>
      <input
        type="checkbox"
        name={`song-${song.id}`}
        id={`practice-song-${song.id}-checkbox`}
        data-testid={`practice-song-${song.id}-checkbox`}
      />
      <label htmlFor={`practice-song-${song.id}-checkbox`}>
        {song.title} - {song.artist}
      </label>
    </div>
  ))}
</div>
```

### 3.4 Action Buttons

**Add to buttons:**
```tsx
// Save
<button type="submit" data-testid="save-practice-button">
  Save Practice
</button>

// Cancel
<button type="button" data-testid="cancel-practice-button">
  Cancel
</button>

// Edit
<button data-testid={`edit-practice-${practice.id}`}>
  <Edit2 /> Edit
</button>

// Delete
<button data-testid={`delete-practice-${practice.id}`}>
  <Trash2 /> Delete
</button>
```

### 3.5 Delete Confirmation Modal

**Add to delete modal:**
```tsx
<div data-testid="delete-practice-modal">
  <p>Are you sure you want to delete this practice session?</p>
  <button data-testid="confirm-delete-practice">Delete</button>
  <button data-testid="cancel-delete-practice">Cancel</button>
</div>
```

### 3.6 Verification Checklist

- [ ] All form inputs have `name`, `id`, and `data-testid`
- [ ] All buttons have `data-testid`
- [ ] List items have unique testids with IDs
- [ ] Empty state has testid
- [ ] Modal has testid
- [ ] Song checkboxes have proper label association
- [ ] Delete confirmation has testids
- [ ] No console warnings or errors
- [ ] TypeScript compiles without errors

---

## Final Verification

### Before Marking Complete

1. **Run TypeScript check:**
   ```bash
   npm run type-check
   ```

2. **Run linter:**
   ```bash
   npm run lint
   ```

3. **Start dev server and verify:**
   ```bash
   npm run dev
   ```
   - Navigate to /setlists, /shows, /practices
   - Open browser DevTools
   - Inspect elements to verify testids are present
   - Check console for errors

4. **Update task tracker:**
   - Mark this task as completed in `task-tracker.md`
   - Note completion time
   - Report any issues or blockers

---

## Common Patterns Reference

### Form Input
```tsx
<input
  type="text"
  name="fieldName"              // camelCase
  id="{page}-{field}"           // kebab-case
  data-testid="{page}-{field}-input"
  placeholder="Enter value"
  required  // if applicable
/>
```

### Button
```tsx
<button data-testid="{action}-{entity}-button">
  {/* Icon */} Button Text
</button>
```

### List Item
```tsx
<div data-testid={`{entity}-item-${item.id}`}>
  <span data-testid={`{entity}-{field}-${item.id}`}>{value}</span>
</div>
```

### Modal
```tsx
<div data-testid="{entity}-modal">
  {/* Modal content */}
</div>
```

---

## Success Criteria

- ✅ All 3 page files modified
- ✅ ~105 testability attributes added
- ✅ No TypeScript errors
- ✅ No linting errors
- ✅ Dev server runs without console errors
- ✅ All elements inspectable in browser DevTools
- ✅ Task tracker updated with completion status

---

**Ready to Start:** YES
**Next Task:** 02-create-e2e-tests.md (waits for this completion)
