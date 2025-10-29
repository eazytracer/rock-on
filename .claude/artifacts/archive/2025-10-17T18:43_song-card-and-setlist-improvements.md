---
timestamp: 2025-10-17T18:43
prompt_summary: "Improve song card design to show only essential data (title, artist, length, guitar tuning), add guitar tuning field to song creation, and fix/improve setlist reordering with arrow buttons and desktop drag-n-drop support"
---

# Song Card Redesign & Setlist Reordering Improvements

## Overview
This document summarizes the improvements made to the Rock-On application, focusing on simplified song card design, guitar tuning support, and enhanced setlist reordering functionality.

---

## 1. Song Card Component Redesign

### Changes Made
**File:** `src/components/songs/SongCard.tsx`

#### Before
The song card displayed extensive information:
- Title, artist, album
- Difficulty badges
- Confidence level badges
- Key, BPM, duration, last practiced
- Tags (with truncation)
- Notes (with line clamp)
- Compact/expanded modes

#### After
Simplified to show only essential information:
- **Song title** (large, truncated)
- **Artist name** (smaller text, truncated)
- **Duration** (with clock icon)
- **Guitar tuning** (with music note icon, when available)

#### Benefits
- Cleaner, more focused interface
- Faster visual scanning
- Less cognitive load
- Better mobile experience
- Removed unnecessary `compact` prop complexity

### Code Changes
```typescript
// Removed compact mode prop
interface SongCardProps {
  song: Song
  onClick?: (song: Song) => void
  onEdit?: (song: Song) => void
  onDelete?: (song: Song) => void
  showActions?: boolean
  // Removed: compact?: boolean
}

// Simplified card layout with icon-based metadata
<div className="flex items-center gap-4 text-sm text-gray-500">
  <div className="flex items-center gap-1">
    <ClockIcon />
    <span>{formatDuration(song.duration)}</span>
  </div>
  {song.guitarTuning && (
    <div className="flex items-center gap-1">
      <MusicNoteIcon />
      <span>{song.guitarTuning}</span>
    </div>
  )}
</div>
```

---

## 2. Guitar Tuning Support

### Database Model Updates
**File:** `src/models/Song.ts`

Added optional `guitarTuning` field to Song interface:
```typescript
export interface Song {
  id: string
  title: string
  artist: string
  // ... other fields
  guitarTuning?: string  // NEW
  structure: SongSection[]
  // ... rest of fields
}
```

Updated database schema to include the new field.

### Song Creation Form Updates
**File:** `src/components/songs/AddSongForm.tsx`

Added guitar tuning dropdown with common tunings:
- Standard (E A D G B E)
- Drop D (D A D G B E)
- Drop C (C G C F A D)
- Drop B (B F# B E G# C#)
- Half Step Down (Eb Ab Db Gb Bb Eb)
- Dropped Db (Db Ab Db Gb Bb Eb)
- Whole Step Down (D G C F A D)
- Open G (D G D G B D)
- Open D (D A D F# A D)
- DADGAD

Positioned between BPM/Difficulty fields and Tags section for logical flow.

### Service Layer Updates
**File:** `src/services/SongService.ts`

Updated `CreateSongRequest` interface and song creation logic to handle guitar tuning:
```typescript
export interface CreateSongRequest {
  // ... existing fields
  guitarTuning?: string  // NEW
  // ... rest of fields
}

const newSong: Song = {
  // ... other fields
  guitarTuning: songData.guitarTuning,
  // ... rest of fields
}
```

---

## 3. Setlist Reordering Improvements

### Problem Statement
- Drag-n-drop only worked on mobile (touch events only)
- No desktop mouse support
- Risk of accidental reordering
- No precise control for moving songs

### Solution Architecture
**File:** `src/components/setlists/SetlistBuilder.tsx`

#### A. Reorder Mode Toggle
Added state-controlled reorder mode:
```typescript
const [reorderMode, setReorderMode] = useState(false)
```

Toggle button appears when songs exist in setlist:
- **Inactive state:** "Reorder Songs" (secondary button style)
- **Active state:** "Done Reordering" (primary button style)

#### B. Arrow Up/Down Controls
Added `moveSongUp()` and `moveSongDown()` functions:
```typescript
const moveSongUp = (index: number) => {
  if (index === 0) return
  reorderSongs(index, index - 1)
}

const moveSongDown = (index: number) => {
  if (index === setlistSongs.length - 1) return
  reorderSongs(index, index + 1)
}
```

Arrow buttons:
- Only visible when in reorder mode
- Automatically disabled at list boundaries (first song can't move up, last song can't move down)
- Visual feedback for disabled state
- Touch-friendly button sizing

#### C. Desktop Drag-n-Drop Support
Added mouse event handlers alongside existing touch events:

```typescript
// Mouse events for desktop
const handleMouseDown = useCallback((e: React.MouseEvent, index: number, fromAvailable: boolean = false) => {
  if (!reorderMode && !fromAvailable) return
  e.preventDefault()
  setDragState({
    isDragging: true,
    draggedIndex: index,
    draggedFromAvailable: fromAvailable,
    startY: e.clientY,
    currentY: e.clientY
  })
}, [reorderMode])

const handleMouseMove = useCallback((e: MouseEvent) => {
  if (!dragState.isDragging) return
  setDragState(prev => ({
    ...prev,
    currentY: e.clientY
  }))
}, [dragState.isDragging])

const handleMouseUp = useCallback((e: MouseEvent) => {
  // Handle drop logic
}, [dragState, availableSongs, setlistSongs])
```

Event listener management with cleanup:
```typescript
React.useEffect(() => {
  if (dragState.isDragging) {
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }
}, [dragState.isDragging, handleMouseMove, handleMouseUp])
```

#### D. Safety Features
**Reorder Mode Gating:**
- Drag-n-drop for reordering within setlist ONLY works when reorder mode is enabled
- Dragging from "Available Songs" list ALWAYS works (for adding songs)
- Prevents accidental song reordering during normal operations

**Visual Feedback:**
- Cursor changes to `cursor-move` when in reorder mode
- Drag handle icon only shows when reorder mode is active
- Opacity and scale changes during drag operations

### User Experience Flow

1. **Initial State:** Songs are locked, arrow buttons hidden
2. **Click "Reorder Songs":**
   - Button changes to "Done Reordering"
   - Arrow buttons appear for each song
   - Cursor changes to move cursor when hovering over songs
   - Drag handle icons appear
3. **Reordering Options:**
   - Click arrow up/down for precise movement
   - Drag with mouse (desktop) or touch (mobile)
4. **Click "Done Reordering":**
   - Locks songs in place
   - Hides arrow buttons and drag handles
   - Returns to normal view mode

---

## Additional Improvements

### Setlist Display Enhancement
Guitar tuning now displayed in setlist song cards:
```typescript
{song.guitarTuning && (
  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
    {song.guitarTuning}
  </span>
)}
```

### Empty State Update
Changed empty state message to be clearer:
- **Before:** "Drag songs here to build your setlist"
- **After:** "Click songs from the right to add them to your setlist"

More accurate since clicking is the primary interaction method.

---

## Technical Details

### Files Modified
1. `src/models/Song.ts` - Added guitarTuning field
2. `src/components/songs/SongCard.tsx` - Simplified design
3. `src/components/songs/AddSongForm.tsx` - Added guitar tuning input
4. `src/services/SongService.ts` - Updated service layer
5. `src/components/setlists/SetlistBuilder.tsx` - Reordering improvements
6. `src/components/songs/SongList.tsx` - Removed compact prop usage

### Build Status
✅ All TypeScript compilation successful
✅ No ESLint errors
✅ Production build successful

### Browser Compatibility
- Desktop: Mouse drag-n-drop support
- Mobile: Touch drag-n-drop support
- Both: Arrow button controls for precise positioning

---

## Testing Recommendations

### Song Cards
- [ ] Verify cards display correctly without guitar tuning
- [ ] Verify cards display guitar tuning when present
- [ ] Test card interactions (click, edit, delete)
- [ ] Test on various screen sizes

### Guitar Tuning
- [ ] Create new song with guitar tuning
- [ ] Create new song without guitar tuning (optional field)
- [ ] Edit existing song to add guitar tuning
- [ ] Verify tuning displays in song cards

### Setlist Reordering
- [ ] Add songs to setlist (click from available songs)
- [ ] Enable reorder mode
- [ ] Test arrow up button (disabled at top)
- [ ] Test arrow down button (disabled at bottom)
- [ ] Test drag-n-drop on desktop with mouse
- [ ] Test drag-n-drop on mobile with touch
- [ ] Verify reorder mode prevents accidental changes when disabled
- [ ] Test dragging from available songs (should always work)
- [ ] Disable reorder mode and verify controls disappear

---

## Future Considerations

### Potential Enhancements
1. **Custom Tuning Input:** Allow users to enter custom tunings not in the preset list
2. **Drag Visual Feedback:** Add ghost element following cursor during drag
3. **Bulk Reordering:** Select multiple songs and move together
4. **Keyboard Shortcuts:** Arrow keys for reordering when song is focused
5. **Undo/Redo:** For setlist changes
6. **Auto-save:** Draft setlists to localStorage

### Performance Optimizations
- Consider virtualizing long setlists (100+ songs)
- Debounce search inputs in available songs
- Lazy load song metadata for very large libraries

---

## Summary

These improvements significantly enhance the user experience by:
1. **Simplifying information hierarchy** - Only showing what matters most
2. **Adding critical metadata** - Guitar tuning for band coordination
3. **Improving control precision** - Arrow buttons for exact positioning
4. **Fixing platform gaps** - Desktop drag-n-drop now works
5. **Preventing accidents** - Reorder mode gates potentially disruptive actions

The changes maintain backward compatibility while adding substantial value to the core workflows of viewing songs and building setlists.
