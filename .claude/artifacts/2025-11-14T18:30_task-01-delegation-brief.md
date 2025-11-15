---
created: 2025-11-14T18:30
type: delegation-brief
agent: nextjs-react-developer
task: Task 01 - Add Testability Attributes
status: delegating
priority: critical-path
---

# Task 01 Delegation Brief: Add Testability Attributes

## Mission
Add testability attributes (`data-testid`, `id`, `name`) to three React page components to enable E2E test implementation. This is a critical MVP blocker.

## Context
- **Task ID:** 01-add-testability-attributes
- **Agent:** nextjs-react-developer
- **Estimated Time:** 3-4 hours
- **Blocks:** Task 02 (E2E test creation)
- **Priority:** CRITICAL (MVP blocker)

## Objective
Modify three page components to add testability attributes following CLAUDE.md standards:

1. **SetlistsPage.tsx** - ~50 attributes (60-90 minutes)
2. **ShowsPage.tsx** - ~30 attributes (45-60 minutes)
3. **PracticesPage.tsx** - ~25 attributes (45-60 minutes)

## Files to Modify

### Primary Files
- `/workspaces/rock-on/src/pages/NewLayout/SetlistsPage.tsx`
- `/workspaces/rock-on/src/pages/NewLayout/ShowsPage.tsx`
- `/workspaces/rock-on/src/pages/NewLayout/PracticesPage.tsx`

### Reference Documents
- **Implementation Plan:** `/workspaces/rock-on/.claude/plans/01-add-testability-attributes.md`
- **Specification:** `/workspaces/rock-on/.claude/artifacts/2025-11-14T14:13_testability-attributes-for-setlists-shows-practices.md`
- **Standards:** `/workspaces/rock-on/CLAUDE.md` (Testability Standards section)
- **Task Tracker:** `/workspaces/rock-on/.claude/plans/task-tracker.md`

## Testability Standards (CRITICAL)

All form inputs (`<input>`, `<textarea>`, `<select>`) MUST have:
```tsx
<input
  name="fieldName"                // camelCase - form functionality
  id="{page}-{field}"             // kebab-case - label association
  data-testid="{page}-{field}-input"  // E2E testing selector
/>
```

All buttons MUST have:
```tsx
<button data-testid="{action}-{entity}-button">
```

All list items MUST have dynamic testids:
```tsx
<div data-testid={`{entity}-item-${item.id}`}>
```

## Work Breakdown

### Task 1.1: SetlistsPage.tsx (~50 attributes)
**Location:** `/workspaces/rock-on/src/pages/NewLayout/SetlistsPage.tsx`

**Add attributes to:**
1. Main page elements (create button, list container, empty state)
2. Create/edit modal form (name input, status select, show select)
3. Song selection UI (available songs list, add buttons)
4. Setlist items (drag-and-drop list, remove buttons, position indicators)
5. Action buttons (save, cancel, edit, delete, duplicate)
6. Delete confirmation modal

**Example pattern for setlist name input:**
```tsx
<input
  type="text"
  name="setlistName"
  id="setlist-name"
  data-testid="setlist-name-input"
  placeholder="Enter setlist name"
  value={name}
  onChange={(e) => setName(e.target.value)}
/>
```

### Task 1.2: ShowsPage.tsx (~30 attributes)
**Location:** `/workspaces/rock-on/src/pages/NewLayout/ShowsPage.tsx`

**Add attributes to:**
1. Main page elements (create button, list container, empty state)
2. Create/edit modal form (all date/time/text inputs)
3. Action buttons (save, cancel, edit, delete, assign setlist)
4. Delete confirmation modal

**Example pattern for show date input:**
```tsx
<input
  type="date"
  name="showDate"
  id="show-date"
  data-testid="show-date-input"
  value={date}
  onChange={(e) => setDate(e.target.value)}
  required
/>
```

### Task 1.3: PracticesPage.tsx (~25 attributes)
**Location:** `/workspaces/rock-on/src/pages/NewLayout/PracticesPage.tsx`

**Add attributes to:**
1. Main page elements (create button, list container, empty state)
2. Create/edit modal form (date/time/duration/location inputs)
3. Song selection UI (checkboxes with proper label association)
4. Action buttons (save, cancel, edit, delete)
5. Delete confirmation modal

**Example pattern for practice song checkbox:**
```tsx
<input
  type="checkbox"
  name={`song-${song.id}`}
  id={`practice-song-${song.id}-checkbox`}
  data-testid={`practice-song-${song.id}-checkbox`}
  checked={selectedSongs.includes(song.id)}
  onChange={() => toggleSong(song.id)}
/>
<label htmlFor={`practice-song-${song.id}-checkbox`}>
  {song.title} - {song.artist}
</label>
```

## Verification Checklist

Before marking task complete, you MUST verify:

### Build Verification
```bash
# TypeScript compilation
npm run type-check

# Linting
npm run lint

# Dev server starts without errors
npm run dev
```

### Manual Verification
1. Navigate to each page: `/setlists`, `/shows`, `/practices`
2. Open browser DevTools
3. Inspect elements to verify `data-testid` attributes are present
4. Check console for errors
5. Verify forms still work as expected

### Task Tracker Update
After completion, update `/workspaces/rock-on/.claude/plans/task-tracker.md`:
1. Change status from ⏸️ to ✅
2. Mark all checklist items as complete
3. Add completion time
4. Update overall completion percentage
5. Note that Task 02 is now unblocked

## Common Patterns Reference

### Form Input (General)
```tsx
<input
  type="text"
  name="fieldName"              // camelCase
  id="{page}-{field}"           // kebab-case
  data-testid="{page}-{field}-input"
  placeholder="Enter value"
  value={value}
  onChange={handler}
  required  // if applicable
/>
```

### Select Dropdown
```tsx
<select
  name="fieldName"
  id="{page}-{field}"
  data-testid="{page}-{field}-select"
  value={value}
  onChange={handler}
>
  <option value="">Select...</option>
  {options.map(opt => (
    <option key={opt.id} value={opt.id}>{opt.name}</option>
  ))}
</select>
```

### Textarea
```tsx
<textarea
  name="fieldName"
  id="{page}-{field}"
  data-testid="{page}-{field}-textarea"
  placeholder="Enter notes"
  value={value}
  onChange={handler}
  rows={4}
/>
```

### Action Button
```tsx
<button
  type="submit"
  data-testid="{action}-{entity}-button"
  onClick={handler}
>
  {icon} Button Text
</button>
```

### List Item
```tsx
<div
  key={item.id}
  data-testid={`{entity}-item-${item.id}`}
>
  <span data-testid={`{entity}-{field}-${item.id}`}>
    {item.value}
  </span>
</div>
```

### Modal Container
```tsx
<div data-testid="{entity}-modal">
  {/* Modal content */}
</div>
```

### Empty State
```tsx
<div data-testid="{entity}-empty-state">
  <p>No {entities} yet. Create your first!</p>
</div>
```

## Important Notes

### DO:
- ✅ Follow CLAUDE.md testability standards exactly
- ✅ Use dynamic IDs for list items (`${item.id}`)
- ✅ Add all three attributes to form inputs (name, id, data-testid)
- ✅ Run type-check and lint before marking complete
- ✅ Update task tracker with completion status
- ✅ Verify attributes are visible in browser DevTools

### DON'T:
- ❌ Skip any of the three required attributes on form inputs
- ❌ Use static testids for dynamic lists
- ❌ Change any component logic or behavior
- ❌ Remove existing classes or styles
- ❌ Mark task complete without running verification steps

## Expected Outcome

After completion:
- All 3 page components have testability attributes
- TypeScript compiles without errors
- Linter passes without warnings
- Dev server runs without console errors
- All form inputs have `name`, `id`, and `data-testid`
- All buttons have `data-testid`
- All list items have unique dynamic testids
- Task tracker updated to show Task 01 complete
- Task 02 unblocked and ready to start

## Success Criteria

- ✅ SetlistsPage.tsx: ~50 attributes added
- ✅ ShowsPage.tsx: ~30 attributes added
- ✅ PracticesPage.tsx: ~25 attributes added
- ✅ `npm run type-check` passes
- ✅ `npm run lint` passes
- ✅ `npm run dev` starts without errors
- ✅ Attributes visible in browser DevTools
- ✅ Task tracker updated
- ✅ No functionality broken

## Next Task (DO NOT START)

After Task 01 is complete and verified, Task 02 will be delegated to execute-agent:
- Create E2E test files for setlists, shows, and practices
- This is BLOCKED until Task 01 is complete
- Do NOT start Task 02 yourself

## Questions or Issues?

If you encounter any blockers:
1. Document the blocker in task tracker
2. Provide specific details (file, line, error message)
3. Suggest potential solutions if possible
4. Mark task as blocked and wait for guidance

---

**Status:** Ready to delegate
**Agent:** nextjs-react-developer
**Start Time:** 2025-11-14T18:30
**Expected Completion:** 2025-11-14T21:30 (3 hours)
**Blocker for:** Task 02 (E2E test creation)
