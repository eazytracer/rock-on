---
timestamp: 2025-10-23T03:57
summary: Fixed Setlists page breaks and song layout per user requirements
---

# Setlists Page Fixes

## Changes Implemented

### 1. Breaks - Inline Editing
**Before:**
- Predefined duration options (15min, 30min, 10min)
- No notes field
- Static display

**After:**
- Single "Add Break" button (no predefined durations)
- Inline text input for notes (placeholder: "Break notes...")
- Inline number input for duration in minutes (placeholder: "15")
- Editable directly in the setlist view
- Break durations now properly calculated in total set length

**Code Changes:**
- Updated `SetlistItem` interface to include `breakNotes?: string`
- Simplified `addBreakToSetlist()` to not take duration parameter
- Added inline input fields for both notes and duration
- Changed menu from 2 break options to 1 generic break option

### 2. Song Row Layout - Match Songs Page
**Before:**
- All content in single row
- Notes not visible/editable

**After:**
- Main row: [Position] [Avatar] [Title/Artist] [Duration] [Key] [Tuning] [Actions]
- Fixed widths for consistent spacing matching Songs page
- Notes on separate line below main row
- Notes display as muted text when viewing
- Click notes to edit in textarea
- Hover to see action buttons

**Code Changes:**
- Restructured song item to use `flex-col` with two rows
- Main row uses fixed widths: Duration (90px), Key (60px), Tuning (130px)
- Added `notes` field to `SetlistItem` interface
- Implemented inline editing for notes with textarea
- Added `onUpdateItem` handler to update item properties

### 3. Quick-Add to Practice - Individual Songs
**Before:**
- Only "Add All to Practice" button in header

**After:**
- Individual Practice button on EACH song card (Play icon)
- "Add All to Practice" button remains in header
- Both individual song AND whole setlist options available

**Code Changes:**
- Added `onAddToPractice` optional prop to `SortableSetlistItem`
- Created `handleAddSongToPractice()` function
- Added Play icon button on each song row (visible on hover)
- Renamed header button text to "Add All to Practice" for clarity

## Layout Structure

### Break Item
```
┌─────────────────────────────────────────────────────────────┐
│ [Grip] [☕] Break | [Input: Notes...] | [Input: 15] min [X] │
└─────────────────────────────────────────────────────────────┘
```

### Song Item
```
┌──────────────────────────────────────────────────────────────────┐
│ [Grip] [#] [🎸] Title - Artist | 3:14 | G | Drop D | [▶] [X]   │
│        Notes: "Watch the bridge timing..." (click to edit)      │
└──────────────────────────────────────────────────────────────────┘
```

## Features Preserved
- Drag-and-drop reordering
- Sliding drawer for adding songs
- Section dividers
- All other existing functionality

## Files Modified
- `/workspaces/rock-on/src/pages/NewLayout/SetlistsPage.tsx`

## Type Safety
All changes maintain TypeScript type safety with proper interfaces and types.
