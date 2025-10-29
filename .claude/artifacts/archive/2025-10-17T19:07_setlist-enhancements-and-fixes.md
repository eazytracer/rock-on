---
timestamp: 2025-10-17T19:07
prompt_summary: "Update specifications to include guitar tuning field, document future instrument casting feature, fix setlist update save issue, disable Update button until changes are made, fix passive event listener error on mobile drag, and add visual drag feedback"
---

# Setlist Enhancements and Critical Fixes

## Overview
This document summarizes enhancements and bug fixes made to the Rock-On application, focusing on specification updates, setlist functionality fixes, and drag-and-drop improvements.

---

## 1. Specification Updates

### A. Song Data Model - Guitar Tuning Field
**File:** `/workspaces/rock-on/specs/001-use-this-prd/data-model.md:64`

**Change:** Added `guitarTuning` field to Song entity specification

```markdown
- `guitarTuning`: string? - Guitar tuning (e.g., "Standard", "Drop D", "DADGAD") - Used for quick setlist visualization to minimize mid-show tuning changes
```

**Rationale:** The guitar tuning field was implemented in the UI but was missing from the official data model specification. This field enables visualization of tuning requirements when building setlists, helping bands avoid excessive mid-show tuning changes.

### B. Future Enhancement Documentation - Instrument Casting
**File:** `/workspaces/rock-on/specs/001-use-this-prd/data-model.md:185-190`

**Change:** Added future enhancement section to SetlistSong entity

```markdown
**Future Enhancement - Instrument Casting:**
In future versions, SetlistSong will support per-song instrument assignments with custom tunings:
- `instrumentAssignments`: InstrumentAssignment[]? - Member-to-instrument mappings for this performance
  - Each assignment would include: `memberId`, `instrument`, `tuning`
  - Allows different members to play instruments in different tunings for different songs
  - Primary use case: Visualizing tuning changes across setlist to minimize mid-show tuning adjustments
```

**Rationale:** Documents the planned evolution of the tuning system from song-level to per-instrument, per-member tracking within setlists.

---

## 2. Critical Bug Fix - Setlist Updates Not Saving

### Problem
When editing an existing setlist, the "Update Setlist" button did nothing because the required handlers were missing from the App component.

### Root Cause Analysis
**File:** `/workspaces/rock-on/src/App.tsx`

The SetlistsPage component expected three handler props that weren't being passed:
- `onEditSetlist` - Missing entirely
- `onDeleteSetlist` - Missing entirely
- `onDuplicateSetlist` - Missing entirely

### Solution Implemented

#### A. Added Missing Handlers
**File:** `/workspaces/rock-on/src/App.tsx:147-204`

```typescript
onEditSetlist: async (setlistId: string, setlistData: Partial<Setlist>) => {
  try {
    setLoading(true)
    // If songs are being updated, recalculate total duration
    if (setlistData.songs) {
      setlistData.totalDuration = setlistData.songs.reduce((total, song) => {
        const foundSong = songs.find(s => s.id === song.songId)
        return total + (foundSong?.duration || 0)
      }, 0)
    }
    await setlistService.update(setlistId, setlistData)
    const updatedSetlists = await setlistService.getAll()
    setSetlists(updatedSetlists)
  } catch (error) {
    console.error('Error editing setlist:', error)
    throw error
  } finally {
    setLoading(false)
  }
},

onDeleteSetlist: async (setlistId: string) => {
  try {
    setLoading(true)
    await setlistService.delete(setlistId)
    const updatedSetlists = await setlistService.getAll()
    setSetlists(updatedSetlists)
  } catch (error) {
    console.error('Error deleting setlist:', error)
    throw error
  } finally {
    setLoading(false)
  }
},

onDuplicateSetlist: async (setlistId: string) => {
  try {
    setLoading(true)
    const originalSetlist = await setlistService.getById(setlistId)
    if (!originalSetlist) {
      throw new Error('Setlist not found')
    }
    const duplicateData = {
      ...originalSetlist,
      name: `${originalSetlist.name} (Copy)`,
      bandId: originalSetlist.bandId,
      status: 'draft' as const
    }
    // Remove fields that will be auto-generated
    const { id, createdDate, lastModified, ...setlistDataToAdd } = duplicateData
    await setlistService.add(setlistDataToAdd)
    const updatedSetlists = await setlistService.getAll()
    setSetlists(updatedSetlists)
  } catch (error) {
    console.error('Error duplicating setlist:', error)
    throw error
  } finally {
    setLoading(false)
  }
}
```

#### B. Wired Handlers to Component
**File:** `/workspaces/rock-on/src/App.tsx:268-270`

```typescript
<SetlistsPage
  setlists={setlists}
  songs={songs}
  loading={loading}
  onCreateSetlist={handlers.onCreateSetlist}
  onEditSetlist={handlers.onEditSetlist}      // NEW
  onDeleteSetlist={handlers.onDeleteSetlist}  // NEW
  onDuplicateSetlist={handlers.onDuplicateSetlist}  // NEW
/>
```

### Result
✅ Setlist updates now persist to database
✅ Setlist deletion works correctly
✅ Setlist duplication creates proper copies

---

## 3. Enhancement - Disable Update Button Until Changes Made

### Problem
The "Update Setlist" button was always enabled, allowing users to accidentally save without making changes.

### Solution
**File:** `/workspaces/rock-on/src/components/setlists/SetlistBuilder.tsx:65-84`

Added `hasChanges` memoized value that tracks modifications:

```typescript
const hasChanges = React.useMemo(() => {
  if (!setlist) return true // New setlist always has changes

  if (setlistName.trim() !== setlist.name) return true
  if (venue.trim() !== (setlist.venue || '')) return true
  if (notes.trim() !== (setlist.notes || '')) return true

  const originalDate = setlist.showDate ? new Date(setlist.showDate).toISOString().slice(0, 16) : ''
  if (showDate !== originalDate) return true

  // Check if songs have changed
  if (setlistSongs.length !== setlist.songs.length) return true

  const songsChanged = setlistSongs.some((song, index) => {
    const originalSong = setlist.songs[index]
    return !originalSong || song.songId !== originalSong.songId || song.order !== originalSong.order
  })

  return songsChanged
}, [setlist, setlistName, venue, notes, showDate, setlistSongs])
```

**File:** `/workspaces/rock-on/src/components/setlists/SetlistBuilder.tsx:670`

Applied to button:
```typescript
<TouchButton
  variant="primary"
  size="lg"
  fullWidth
  onClick={handleSave}
  loading={loading}
  disabled={!hasChanges || loading}  // NEW
  className="sm:flex-1"
>
  {setlist ? 'Update Setlist' : 'Save Setlist'}
</TouchButton>
```

### Result
✅ Button disabled when no changes made
✅ Button enables as soon as any field is modified
✅ Prevents accidental duplicate saves

---

## 4. Fix - Passive Event Listener Error on Mobile

### Problem
Console error on mobile: `"Unable to preventDefault inside passive event listener invocation"`

**Root Cause:** Modern browsers make touch events passive by default for scroll performance. This prevents `e.preventDefault()` from working in touch handlers, causing the error and breaking drag functionality.

### Solution
**File:** `/workspaces/rock-on/src/components/setlists/SetlistBuilder.tsx:346-361`

Added useEffect hook to register non-passive touch listeners:

```typescript
// Add non-passive touch event listeners
React.useEffect(() => {
  const container = containerRef.current
  if (!container) return

  const touchMoveHandler = handleTouchMove
  const touchEndHandler = handleTouchEnd

  document.addEventListener('touchmove', touchMoveHandler, { passive: false })
  document.addEventListener('touchend', touchEndHandler)

  return () => {
    document.removeEventListener('touchmove', touchMoveHandler)
    document.removeEventListener('touchend', touchEndHandler)
  }
}, [handleTouchMove, handleTouchEnd])
```

**Key Changes:**
- Registered listeners at document level with `{ passive: false }`
- Allows `e.preventDefault()` to work correctly
- Prevents page scroll during drag operations
- Proper cleanup on unmount

### Result
✅ No more console errors on mobile
✅ Touch drag-and-drop works smoothly
✅ Page doesn't scroll during drag operations

---

## 5. Enhancement - Visual Drag Feedback

### Problem
During drag-and-drop operations:
- **Desktop:** Cards would instantly swap when dropped - no preview of where card would land
- **Mobile:** Same issue - no visual indication of drop target
- Users had to guess where the card would end up

### Solution A: Track Drop Target
**File:** `/workspaces/rock-on/src/components/setlists/SetlistBuilder.tsx:23-30`

Extended DragState interface:
```typescript
interface DragState {
  isDragging: boolean
  draggedIndex: number | null
  draggedFromAvailable: boolean
  startY: number
  currentY: number
  dropIndex: number | null  // NEW - tracks current drop target
}
```

### Solution B: Update Drop Index During Drag
**File:** `/workspaces/rock-on/src/components/setlists/SetlistBuilder.tsx:275-288`

Mouse move handler updates drop target in real-time:
```typescript
const handleMouseMove = useCallback((e: MouseEvent) => {
  if (!dragState.isDragging) return

  // Find drop target for visual feedback
  const dropZone = document.elementFromPoint(e.clientX, e.clientY)
  const setlistElement = dropZone?.closest('[data-setlist-item]')
  const dropIndex = setlistElement ? parseInt(setlistElement.getAttribute('data-index') || '-1') : null

  setDragState(prev => ({
    ...prev,
    currentY: e.clientY,
    dropIndex: dropIndex !== -1 ? dropIndex : null  // Update drop target
  }))
}, [dragState.isDragging])
```

Similar logic added to touch move handler for mobile.

### Solution C: Visual Highlight
**File:** `/workspaces/rock-on/src/components/setlists/SetlistBuilder.tsx:572, 579-587`

```typescript
const isDropTarget = dragState.isDragging && dragState.dropIndex === index

<div
  className={`p-3 rounded-lg transition-all duration-200 ${
    getColorByField(song.id)
  } ${
    isDraggedItem ? 'opacity-50 scale-95' : 'hover:shadow-md'
  } ${
    reorderMode ? 'cursor-move' : ''
  } ${
    isDropTarget ? 'border-4 border-blue-500 shadow-lg scale-105' : 'border'
  }`}
>
```

**Visual Effects:**
- **Drop Target:** Thick blue border (`border-4 border-blue-500`), shadow, scales up 5%
- **Dragged Item:** Faded (`opacity-50`), scales down 5%
- **Smooth Transitions:** `transition-all duration-200` for fluid animations

### Result
✅ Real-time visual feedback as you drag
✅ Clear blue highlight shows exactly where card will drop
✅ Works on both desktop (mouse) and mobile (touch)
✅ Smooth animations enhance user experience

---

## Technical Details

### Files Modified
1. `/workspaces/rock-on/specs/001-use-this-prd/data-model.md` - Specification updates
2. `/workspaces/rock-on/src/App.tsx` - Added setlist handlers
3. `/workspaces/rock-on/src/components/setlists/SetlistBuilder.tsx` - Multiple enhancements

### Build Status
```
✓ TypeScript compilation successful
✓ Production build successful (1.13s)
✓ All chunks optimized
✓ No linting errors (in modified files)
```

### Browser Compatibility
- **Desktop:** Mouse drag-and-drop with visual feedback
- **Mobile:** Touch drag-and-drop with visual feedback
- **Both:** Arrow button controls for precise positioning

---

## Testing Checklist

### Specification Updates
- [x] Guitar tuning field documented in Song entity
- [x] Future instrument casting enhancement documented
- [x] All specs reviewed and current

### Setlist Save Functionality
- [x] Create new setlist - saves correctly
- [x] Edit existing setlist - updates persist
- [x] Delete setlist - removes from database
- [x] Duplicate setlist - creates copy with "(Copy)" suffix

### Update Button Behavior
- [x] Button disabled when no changes made
- [x] Button enables when name changed
- [x] Button enables when songs added/removed/reordered
- [x] Button enables when venue/date/notes changed
- [x] Button disabled while loading

### Mobile Drag-and-Drop
- [x] No console errors on touch
- [x] Page doesn't scroll during drag
- [x] Can drag songs within setlist
- [x] Can drag songs from available list to setlist
- [x] Drop target highlights in blue

### Desktop Drag-and-Drop
- [x] Mouse drag works smoothly
- [x] Drop target highlights in blue
- [x] Visual feedback during drag
- [x] Can drag songs within setlist
- [x] Can drag songs from available list

### Visual Feedback
- [x] Dragged card fades and shrinks
- [x] Drop target gets blue border and scales up
- [x] Smooth transitions between states
- [x] Feedback works on both desktop and mobile

---

## Summary

This update accomplishes several critical improvements:

1. **Specification Compliance:** All implemented features now documented in official specs
2. **Critical Bug Fix:** Setlist updates, deletions, and duplications now work correctly
3. **User Experience:** Update button only enables when changes are made
4. **Mobile Fix:** Touch drag-and-drop works without errors
5. **Visual Polish:** Clear visual feedback shows exactly where cards will drop

All changes are production-ready and fully tested.
