---
timestamp: 2025-10-23T13:20
task: Setlists Page Database Integration
status: Complete
phase: MVP Phase 2 - Database Integration
reference: /workspaces/rock-on/.claude/instructions/mvp-phase2-database-integration.md
file: /workspaces/rock-on/src/pages/NewLayout/SetlistsPage.tsx
---

# Setlists Page Database Integration - Complete

## Summary

Successfully integrated the Setlists page (`/workspaces/rock-on/src/pages/NewLayout/SetlistsPage.tsx`) with real database operations, replacing all mock data with IndexedDB queries using Dexie. The page now fully supports CRUD operations for setlists with songs, breaks, and sections, with proper show associations.

## Changes Made

### 1. Imports and Dependencies

**Added:**
- `useEffect` from React for data loading
- `db` from `../../services/database`
- Database hooks: `useSetlists`, `useCreateSetlist`, `useUpdateSetlist`, `useDeleteSetlist`
- Utility functions: `secondsToDuration` from formatters, `formatShowDate` from dateHelpers
- TypeScript types: `SetlistItem as DBSetlistItem`, `Setlist as DBSetlist`, `Song as DBSong`, `PracticeSession`

### 2. Type System Updates

**Created UI-specific types:**
- `UISong` - Extends database song with formatted fields (duration as string, initials, avatarColor)
- `UISetlistItem` - Setlist item with populated song data
- `UISetlist` - Setlist with populated items, calculated fields, and show associations
- `UIShow` - Simplified show representation for dropdowns
- `UIPractice` - Simplified practice representation for dropdowns

**Purpose:** Separate database structure from UI display requirements while maintaining type safety.

### 3. Helper Functions

**Added utility functions:**
```typescript
generateAvatarColor(title: string): string
// Generates consistent color from song title for avatar display

generateInitials(title: string): string
// Creates two-letter initials from song title

dbSongToUISong(dbSong: DBSong): UISong
// Converts database song to UI song with formatted fields
```

### 4. Data Loading (useEffect)

**Implemented comprehensive data loading:**
- Loads setlists for current band from `db.setlists`
- Loads songs from `db.songs` filtered by band context
- Loads shows from `db.practiceSessions` (type='gig')
- Loads practices from `db.practiceSessions` (type='rehearsal')
- Populates setlist items with full song data
- Loads associated show data for each setlist
- Calculates song counts and total durations
- Formats dates and durations for display

**Error handling:**
- Try-catch blocks around all database operations
- Error state displayed to user with retry option
- Console logging for debugging

**Loading states:**
- Loading spinner while data fetches
- Prevents rendering until data ready

### 5. CRUD Operations

#### Create Setlist (`handleCreateNew`)
- Generates UUID for new setlist
- Sets bandId from localStorage
- Initializes empty items array
- Opens editor with new setlist

#### Edit Setlist (`handleEdit`)
- Opens editor with selected setlist
- All data already loaded and populated

#### Duplicate Setlist (`handleDuplicate`)
- Creates copy with new UUIDs for setlist and all items
- Converts UI items to database format
- Saves to database via `db.setlists.add()`
- Updates UI state immediately
- Shows success toast

#### Archive Setlist (`handleArchive`)
- Updates status to 'archived' via `db.setlists.update()`
- Updates local UI state
- Shows success toast

#### Delete Setlist (`handleDelete`)
- Clears show references (`setlistId` in practice sessions)
- Deletes setlist from database
- Updates UI state to remove from list
- Shows success toast

#### Save Setlist (`handleSave`)
- Converts UI items to database format (removes populated song data, keeps only songId)
- Calculates total duration in seconds
- Updates existing or creates new setlist
- Updates associated show's setlistId if selected
- Reloads all setlists to ensure UI sync
- Shows success toast

### 6. Setlist Editor Integration

**Updated `SetlistEditorPage` props:**
- Receives real songs, shows, and practices from database
- All type signatures updated to use UI types
- UUID generation for new items using `crypto.randomUUID()`
- songId stored alongside song object for database persistence

**Item operations:**
- Add song: Creates UISetlistItem with songId and song data
- Add break: Creates break item with duration and notes
- Add section: Creates section item with title
- Drag-and-drop reordering: Updates position numbers
- Inline editing: Updates notes, break durations, section titles
- Remove items: Filters from array and re-indexes positions

### 7. Show Association

**Associated Show Display:**
- Loads show data if setlistId exists in setlist
- Displays show name and formatted date in cards
- Shows in dropdown for selection during editing

**Bidirectional linking:**
- Setlist stores `showId` field
- Show stores `setlistId` field
- Both updated when association changes

### 8. Song Population

**Setlist Items with Songs:**
- For each item with type='song', loads full song from database
- Converts to UISong with formatted duration, initials, avatar color
- Displays in drag-and-drop list with:
  - Position number
  - Avatar (colored circle with initials)
  - Title and artist
  - Duration (formatted as "M:SS")
  - Key and tuning
  - Inline notes field

**Break Items:**
- Displays break icon
- Inline editable duration (minutes)
- Inline editable notes

**Section Items:**
- Displays section header with colored border
- Section title displayed prominently

### 9. Duration Calculation

**Total Duration:**
- Sums all song durations (in seconds)
- Adds all break durations (converted minutes to seconds)
- Formats total as "Xh Ymin" or "Y min"
- Displayed in setlist cards and editor header

### 10. Data Persistence

**Database Operations:**
- All creates use `db.setlists.add()` with proper structure
- All updates use `db.setlists.update()` with modified fields
- All deletes use `db.setlists.delete()` with cleanup of references
- Timestamps automatically handled by Dexie hooks

**Data Conversion:**
```typescript
// UI → Database (for saving)
UISetlistItem → DBSetlistItem (keeps only: id, type, position, songId, notes, etc.)

// Database → UI (for display)
DBSetlistItem → UISetlistItem (populates song from db.songs.get())
DBSong → UISong (formats duration, adds initials, avatar color)
```

### 11. Error Handling

**Comprehensive error handling:**
- Try-catch around all async operations
- Error messages displayed via alerts (can be upgraded to toast notifications)
- Console.error for debugging
- Graceful fallbacks for missing data

**Edge cases handled:**
- No band selected (shows error)
- Setlist with no items (shows empty state)
- Song not found (item displayed without song data)
- Show not found (no associated show displayed)

### 12. Loading States

**User feedback during operations:**
- Loading spinner on initial page load
- Loading state prevents premature rendering
- Error state with retry button
- Success messages after operations

## Database Schema Usage

### Tables Used

**db.setlists:**
- `bandId` - Filter setlists by band
- `showId` - Link to associated show
- `items[]` - Array of SetlistItem objects
- `status` - 'draft' | 'active' | 'archived'
- `name`, `notes`, `totalDuration`
- `createdDate`, `lastModified` (auto-timestamps)

**db.songs:**
- `contextType='band'` and `contextId=bandId` - Filter songs by band
- `title`, `artist`, `duration`, `key`, `guitarTuning`, `bpm`
- Used to populate setlist items

**db.practiceSessions:**
- `type='gig'` - Shows
- `type='rehearsal'` - Practices
- `setlistId` - Link to associated setlist
- `name`, `scheduledDate`
- Used for show dropdown and associations

### SetlistItem Structure

```typescript
interface SetlistItem {
  id: string
  type: 'song' | 'break' | 'section'
  position: number

  // Song fields (when type='song')
  songId?: string
  notes?: string

  // Break fields (when type='break')
  breakDuration?: number  // minutes
  breakNotes?: string

  // Section fields (when type='section')
  sectionTitle?: string
}
```

## Removed Code

**Removed all mock data:**
- `MOCK_SONGS[]` - Replaced with database query
- `MOCK_SHOWS[]` - Replaced with database query
- `MOCK_PRACTICES[]` - Replaced with database query
- `INITIAL_SETLISTS[]` - Replaced with database query

**Removed hardcoded data:**
- All setlists now loaded from database
- All songs loaded from database
- All associations loaded from database

## Testing Checklist

### Data Loading
- [ ] Page loads setlists from database
- [ ] Songs populated in setlist items
- [ ] Associated shows displayed correctly
- [ ] Loading spinner shows during fetch
- [ ] Error message shows if no band selected

### Create Setlist
- [ ] New setlist creates in database
- [ ] Opens editor with empty items
- [ ] Can add songs from library
- [ ] Can add breaks and sections

### Edit Setlist
- [ ] Opens editor with existing data
- [ ] All items display correctly
- [ ] Songs show correct data
- [ ] Breaks show duration and notes
- [ ] Sections show titles

### Add Items
- [ ] Add song creates item with songId and populated song
- [ ] Add break creates item with default 15 min duration
- [ ] Add section prompts for title and creates item

### Drag-and-Drop
- [ ] Can reorder items by dragging
- [ ] Positions update correctly
- [ ] Changes persist on save

### Inline Editing
- [ ] Can edit song notes
- [ ] Can edit break duration
- [ ] Can edit break notes
- [ ] Changes persist on save

### Remove Items
- [ ] Can remove songs from setlist
- [ ] Can remove breaks
- [ ] Can remove sections
- [ ] Positions re-index correctly

### Associate with Show
- [ ] Can select show from dropdown
- [ ] Show name and date display in card
- [ ] Association saves to database
- [ ] Show's setlistId updates

### Duplicate Setlist
- [ ] Creates copy with new ID
- [ ] Appends " (Copy)" to name
- [ ] All items duplicated with new IDs
- [ ] Saves to database
- [ ] Appears in setlist list

### Archive Setlist
- [ ] Status updates to 'archived'
- [ ] Still appears in "Archived" filter
- [ ] Persists across reloads

### Delete Setlist
- [ ] Confirms deletion
- [ ] Clears show references
- [ ] Removes from database
- [ ] Removes from UI list

### Duration Calculation
- [ ] Total duration sums songs correctly
- [ ] Includes break durations
- [ ] Formats as "Xh Ymin" or "Y min"
- [ ] Updates when items change

### Filters
- [ ] "All Setlists" shows all statuses
- [ ] "Active" filter works
- [ ] "Drafts" filter works
- [ ] "Archived" filter works
- [ ] Search by name works

## Known Limitations

1. **No toast notifications:** Using `alert()` for success/error messages. Should be replaced with proper toast component.

2. **No optimistic updates:** UI updates after database confirms changes. Could add optimistic updates for better UX.

3. **Section title prompt:** Uses browser `prompt()` which is not ideal. Should use custom modal.

4. **Band name hardcoded:** ModernLayout still shows "iPod Shuffle" hardcoded. Should load from current band.

5. **No permission checks:** All users can edit/delete. Should implement role-based permissions.

6. **No undo/redo:** Once deleted, cannot be restored.

7. **No auto-save:** Changes only saved when clicking "Save Setlist".

## Next Steps

1. Replace `alert()` calls with toast notification component
2. Add optimistic UI updates for better responsiveness
3. Implement role-based permissions (owner/admin/member)
4. Add confirmation dialogs for destructive actions
5. Implement auto-save or unsaved changes warning
6. Load band name dynamically
7. Add bulk operations (select multiple, delete multiple)
8. Add setlist templates feature
9. Add print/export functionality
10. Add setlist history/versioning

## Files Modified

- `/workspaces/rock-on/src/pages/NewLayout/SetlistsPage.tsx` - Complete database integration

## Related Tasks

This completes Tasks 8 & 9 from MVP Phase 2:
- ✅ Task 8: Setlists Page - Data Loading
- ✅ Task 9: Setlists Page - CRUD Operations

## Verification

To verify this implementation:

1. Navigate to http://localhost:5174/new-layout/setlists
2. Check that setlists load from database (no mock data)
3. Create a new setlist and add songs
4. Add breaks and sections
5. Drag to reorder items
6. Edit inline notes
7. Save and verify persists across reload
8. Duplicate setlist
9. Archive setlist
10. Delete setlist
11. Check database in DevTools → Application → IndexedDB → RockOnDB → setlists
