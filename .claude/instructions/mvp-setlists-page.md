---
page: Setlists
sprint: Sprint 2
priority: high
references:
  - /workspaces/rock-on/.claude/specifications/2025-10-22T22:59_functional-mvp-spec.md
  - /workspaces/rock-on/.claude/specifications/2025-10-22T14:01_design-style-guide.md
  - /workspaces/rock-on/src/pages/NewLayout/NewLayout.tsx
output: /workspaces/rock-on/src/pages/NewLayout/SetlistsPage.tsx
---

# MVP Setlists Page - User Stories

## Overview
Build the Setlists page mockup for creating and managing performance setlists with drag-and-drop song ordering.

**Primary Color:** #f17827ff (Orange) - use for primary CTAs and active states

---

## User Stories

### Story 1: View Setlist Library
**As a** band member
**I want to** see all our setlists
**So that** I can choose one for upcoming performances

**Acceptance Criteria:**
- [ ] Desktop displays setlists as cards or table rows
- [ ] Each setlist shows:
  - Setlist name
  - Associated show (name & date, if any)
  - Song count (e.g., "12 songs")
  - Total duration (e.g., "48 min")
  - Status badge (Draft / Active / Archived)
  - Preview of first 5 songs
  - Last modified date
  - Actions menu (•••)
- [ ] Empty state: "No setlists yet" with "+ Create Setlist" CTA
- [ ] Setlists sorted by last modified (newest first)
- [ ] Loading state shows skeleton loaders

**Design Notes:**
- Card layout: 3 columns on desktop, 1 on mobile
- Cards: #1a1a1a bg, rounded-xl, p-4
- Status badges: colored pills (Draft=gray, Active=orange, Archived=muted)

---

### Story 2: Filter Setlists
**As a** band member
**I want to** filter setlists by status or show
**So that** I can find specific setlists quickly

**Acceptance Criteria:**
- [ ] Filter dropdown in page header
- [ ] Filter options:
  - Status: All / Draft / Active / Archived
  - By show: dropdown of upcoming shows
  - By date: date range picker
- [ ] Active filter shown in header
- [ ] Clear filter option
- [ ] Filter persists during session

**Design Notes:**
- Dropdown matches Songs page filter style
- Active filter highlighted in orange

---

### Story 3: Create New Setlist
**As a** band member
**I want to** create a new setlist
**So that** I can organize songs for a performance

**Acceptance Criteria:**
- [ ] "+ Create Setlist" button in page header (orange)
- [ ] Click opens Create Setlist page/modal
- [ ] Two-panel layout:
  - **Left:** Setlist header + ordered song list
  - **Right:** Available songs panel
- [ ] Header fields:
  - Setlist Name (required)
  - Associated Show (optional dropdown)
  - Status (Draft/Active/Archived)
  - Notes (textarea)
- [ ] "Save Setlist" button (orange)
- [ ] "Cancel" button
- [ ] Success toast: "Setlist created"
- [ ] Redirect to setlist list or stay in edit mode

**Design Notes:**
- Full-page editor on desktop
- Stacked panels on mobile
- Clear visual separation between panels

---

### Story 4: Add Songs to Setlist
**As a** band member
**I want to** add songs to a setlist
**So that** I can build the performance lineup

**Acceptance Criteria:**
- [ ] Right panel shows all band songs
- [ ] Search bar to filter available songs
- [ ] Song cards show: title, artist, duration, key
- [ ] Click song or "+" button to add to setlist
- [ ] Song appears in left panel (setlist order)
- [ ] Can add same song multiple times (e.g., for encore)
- [ ] Running total duration updates automatically
- [ ] Visual feedback when song added (animation)

**Design Notes:**
- Available songs: compact list/grid
- "+" button on hover or always visible on mobile
- Smooth animation when song added

---

### Story 5: Reorder Songs in Setlist
**As a** band member
**I want to** drag songs to reorder them
**So that** I can arrange the performance flow

**Acceptance Criteria:**
- [ ] Drag handle (☰) on each song in setlist
- [ ] Drag to reorder within list
- [ ] Position numbers update automatically
- [ ] Visual indicator during drag (preview, highlight)
- [ ] Smooth animation on drop
- [ ] Touch-friendly on mobile (hold to drag)
- [ ] Changes saved automatically or on Save button

**Design Notes:**
- Drag handle: left side, subtle gray
- Dragging item: elevated with shadow
- Drop zone: highlighted border
- Use react-beautiful-dnd or similar library

---

### Story 6: Remove Song from Setlist
**As a** band member
**I want to** remove a song from a setlist
**So that** I can adjust the lineup

**Acceptance Criteria:**
- [ ] "×" button on each song in setlist
- [ ] Hover shows delete icon
- [ ] Click removes song immediately
- [ ] Smooth animation as song disappears
- [ ] Position numbers of remaining songs update
- [ ] Total duration recalculates
- [ ] No confirmation needed (can re-add easily)

**Design Notes:**
- "×" button: right side, appears on hover (desktop) or always visible (mobile)
- Red color on hover
- Fade-out animation

---

### Story 7: Associate Setlist with Show
**As a** band member
**I want to** link a setlist to a show
**So that** I know which songs to perform

**Acceptance Criteria:**
- [ ] "Associated Show" dropdown in setlist header
- [ ] Shows list of upcoming shows
- [ ] Can select or clear show
- [ ] Show name & date displayed when selected
- [ ] One setlist can be linked to multiple shows (or enforce 1:1)
- [ ] Selecting show updates "Next Show" info on songs

**Design Notes:**
- Dropdown styled consistently
- Show info prominently displayed when selected
- Icon for show (calendar or ticket)

---

### Story 8: Edit Setlist
**As a** band member
**I want to** edit an existing setlist
**So that** I can make changes before a show

**Acceptance Criteria:**
- [ ] Click setlist card or "Edit" in actions menu
- [ ] Opens same editor as Create Setlist
- [ ] Pre-populated with current data and songs
- [ ] Can change name, show, status, notes
- [ ] Can add/remove/reorder songs
- [ ] "Save Changes" button
- [ ] "Cancel" discards changes
- [ ] Success toast: "[Setlist Name] updated"

**Design Notes:**
- Same UI as Create
- Consider "Unsaved changes" warning on cancel

---

### Story 9: Duplicate Setlist
**As a** band member
**I want to** duplicate an existing setlist
**So that** I can quickly create variations

**Acceptance Criteria:**
- [ ] "Duplicate" in actions menu
- [ ] Creates copy with name "[Original Name] (Copy)"
- [ ] Copies all songs in same order
- [ ] Copies notes
- [ ] Does NOT copy associated show
- [ ] Status set to "Draft"
- [ ] Success toast: "Setlist duplicated"
- [ ] Opens editor for new setlist (or returns to list)

**Design Notes:**
- Quick action, minimal UI
- Differentiate copy clearly from original

---

### Story 10: Archive/Delete Setlist
**As a** band member
**I want to** archive or delete old setlists
**So that** I can keep the list organized

**Acceptance Criteria:**
- [ ] "Archive" in actions menu (moves to Archived status)
- [ ] "Delete" in actions menu (admin only)
- [ ] Delete shows confirmation: "Delete [Setlist Name]? This cannot be undone."
- [ ] "Delete" button (red)
- [ ] Success toast for both actions
- [ ] Archived setlists hidden by default (show with filter)
- [ ] Setlist removed from UI immediately

**Design Notes:**
- Archive: simple status change, no confirmation needed
- Delete: confirmation modal with danger styling

---

### Story 11: View Setlist Song Details
**As a** band member
**I want to** see song details while building setlist
**So that** I can verify keys, tunings, etc.

**Acceptance Criteria:**
- [ ] Click song in setlist shows mini detail card
- [ ] Shows: title, artist, duration, key, tuning, BPM
- [ ] Shows reference links (YouTube, tabs)
- [ ] Can open full song detail from here
- [ ] Positioned as popover or side panel
- [ ] Click outside to close

**Design Notes:**
- Popover: floating card, positioned near song
- Compact info display
- Links styled as buttons

---

### Story 12: Setlist Total Duration
**As a** band member
**I want to** see the total setlist duration
**So that** I can plan for time constraints

**Acceptance Criteria:**
- [ ] Total duration displayed prominently
- [ ] Updates automatically when songs added/removed
- [ ] Format: "48 min" or "1h 23min"
- [ ] Shows song count: "12 songs"
- [ ] Color-coded if exceeds target (e.g., show duration)

**Design Notes:**
- Displayed in setlist header or footer
- Large, easy to read
- Use orange if approaching/exceeding limit

---

### Story 13: Setlist Status Management
**As a** band admin
**I want to** change setlist status
**So that** I can track which are ready to perform

**Acceptance Criteria:**
- [ ] Status dropdown in setlist header
- [ ] Options: Draft, Active, Archived
- [ ] **Draft:** Work in progress (gray)
- [ ] **Active:** Ready to perform (orange)
- [ ] **Archived:** Past performance (muted)
- [ ] Status badge visible in setlist list
- [ ] Filter by status in main list

**Design Notes:**
- Status dropdown or toggle buttons
- Colored badges match status
- Clear visual distinction

---

### Story 14: Empty Setlist State
**As a** band member
**I want to** see guidance in an empty setlist
**So that** I know how to add songs

**Acceptance Criteria:**
- [ ] Shows when setlist has zero songs
- [ ] Displays in left panel (setlist area):
  - Icon (setlist or music note)
  - "No songs yet"
  - "Add songs from the right panel"
  - Arrow or visual indicator pointing right
- [ ] Right panel shows available songs normally
- [ ] Helpful, encouraging tone

**Design Notes:**
- Centered in setlist panel
- Subtle, not overwhelming
- Icon: 32-48px

---

### Story 15: Mobile Responsive Setlist Editor
**As a** mobile user
**I want to** create and edit setlists on my phone
**So that** I can work on-the-go

**Acceptance Criteria:**
- [ ] Stacked layout (not side-by-side panels)
- [ ] Setlist songs at top, available songs below
- [ ] Toggle button to switch between views (optional)
- [ ] Drag-and-drop works with touch
- [ ] Add song button prominent and touch-friendly
- [ ] Modal fields stack vertically
- [ ] Save button fixed at bottom (easy thumb access)

**Design Notes:**
- Full-screen editor on mobile
- Back button in header
- Confirm navigation if unsaved changes

---

### Story 16: Setlist Print View (Future)
**As a** band member
**I want to** print a setlist
**So that** I have a physical copy for performance

**Acceptance Criteria:**
- [ ] "Print" in actions menu
- [ ] Opens print preview
- [ ] Clean, readable layout:
  - Setlist name
  - Show info (if associated)
  - Song list with: position, title, artist, key, duration
  - Total duration
- [ ] No UI elements in print (buttons, menus, etc.)
- [ ] Optimized for 8.5x11" paper
- [ ] Can save as PDF

**Design Notes:**
- Print stylesheet (@media print)
- Black text on white background
- Clear fonts, good spacing
- Band logo/name at top (optional)

---

## Technical Implementation Notes

### Component Structure
```
SetlistsPage.tsx
├── PageHeader (title, filter, create button)
├── SetlistCardList
│   └── SetlistCard
│       └── ActionsMenu
└── EmptyState

SetlistEditor.tsx
├── EditorHeader (name, show, status, notes)
├── SetlistPanel (left)
│   └── DraggableSongList
│       └── SongItem (with drag handle, remove button)
├── AvailableSongsPanel (right)
│   └── SongSearch
│   └── SongGrid/List
└── EditorFooter (total duration, save/cancel)
```

### State Management
- Setlists array (fetched from DB)
- Current setlist being edited
- Song list for current setlist (ordered)
- Available songs (band's full library)
- Search query for available songs
- Drag-and-drop state
- Modal/editor open state

### Data Model
```typescript
interface Setlist {
  id: string
  name: string
  bandId: string
  showId?: string  // optional link to show
  songs: SetlistSong[]  // ordered array
  notes: string
  status: 'draft' | 'active' | 'archived'
  totalDuration: number  // calculated
  createdDate: Date
  lastModified: Date
}

interface SetlistSong {
  songId: string
  position: number  // order in setlist
  // Reference to full song data fetched separately
}
```

### Drag-and-Drop Implementation
- Library: react-beautiful-dnd or @dnd-kit/core
- Smooth animations
- Touch support for mobile
- Update positions on drop
- Persist order to database

### Performance
- Lazy load setlist songs on expand
- Virtualize long song lists (100+ songs)
- Debounce search in available songs
- Optimize re-renders during drag

---

## Design Specifications Reference

### Colors
- **Background:** #121212
- **Cards:** #1a1a1a
- **Borders:** #2a2a2a
- **Primary CTA:** #f17827ff (Orange)
- **Draft Badge:** #707070
- **Active Badge:** #f17827ff (Orange)
- **Archived Badge:** #4a4a4a

### Layout
- Card grid: 3 columns desktop, 2 tablet, 1 mobile
- Card padding: p-4 to p-6
- Gap between cards: gap-4
- Editor panels: 60/40 split or 50/50

---

## Testing Checklist
- [ ] Can create setlist with name
- [ ] Can add songs to setlist
- [ ] Drag-and-drop reorders songs
- [ ] Remove song works and updates positions
- [ ] Total duration calculates correctly
- [ ] Can associate with show
- [ ] Edit updates setlist
- [ ] Duplicate creates copy
- [ ] Archive changes status
- [ ] Delete removes after confirmation
- [ ] Filter by status works
- [ ] Empty states display correctly
- [ ] Mobile layout functional
- [ ] Touch drag-and-drop works on mobile
- [ ] All user roles have appropriate access

---

## Acceptance Definition of Done
- [ ] All user stories implemented
- [ ] Matches NewLayout design style
- [ ] Drag-and-drop works smoothly
- [ ] Responsive on all screen sizes
- [ ] Orange primary color used
- [ ] Loading and error states
- [ ] Accessible (keyboard, screen readers)
- [ ] No console errors
- [ ] Code reviewed and tested
