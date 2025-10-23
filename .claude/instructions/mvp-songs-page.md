---
page: Songs
sprint: Sprint 2
priority: high
references:
  - /workspaces/rock-on/.claude/specifications/2025-10-22T22:59_functional-mvp-spec.md
  - /workspaces/rock-on/.claude/specifications/2025-10-22T14:01_design-style-guide.md
  - /workspaces/rock-on/src/pages/NewLayout/NewLayout.tsx
output: /workspaces/rock-on/src/pages/NewLayout/SongsPage.tsx
---

# MVP Songs Page - User Stories

## Overview
Build the Songs page mockup following the existing NewLayout design pattern. This page displays the band's song library with search, filtering, and CRUD operations.

**Design Reference:** The existing NewLayout component demonstrates the visual style and structure to follow.

**Primary Color:** #f17827ff (Orange) - use for primary CTAs and active states

---

## User Stories

### Story 1: View Song Library
**As a** band member
**I want to** see all songs in my band's library
**So that** I can quickly browse and find songs we play

**Acceptance Criteria:**
- [ ] Desktop displays songs in table format with columns:
  - Song (avatar + title + artist)
  - Duration
  - Key
  - Tuning
  - BPM
  - Next Show (if scheduled)
  - Actions menu (•••)
- [ ] Mobile displays songs as cards with essential metadata
- [ ] Empty state shows "No songs yet" with "+ Add Song" CTA
- [ ] Loading state shows skeleton loaders
- [ ] Songs are sorted alphabetically by title (default)
- [ ] Each song avatar uses colored circle with initials

**Design Notes:**
- Background: #121212
- Song rows: #1a1a1a with hover state #252525
- Border radius: 12px on cards/rows
- Text: White primary, #a0a0a0 secondary, #707070 tertiary
- Match spacing and typography from NewLayout.tsx

---

### Story 2: Search Songs
**As a** band member
**I want to** search for songs by title, artist, or album
**So that** I can quickly find specific songs

**Acceptance Criteria:**
- [ ] Search input in page header with search icon
- [ ] Live search filters results as user types
- [ ] Searches across: title, artist, album fields
- [ ] Shows "No results found" message when no matches
- [ ] Clear search button (×) appears when text entered
- [ ] Search is case-insensitive
- [ ] Debounced to 300ms for performance

**Design Notes:**
- Search input: h-10, bg-#1a1a1a, border-#2a2a2a
- Placeholder: #707070
- Focus border: Orange (#f17827ff)

---

### Story 3: Filter Songs
**As a** band member
**I want to** filter songs by tuning, tags, or upcoming show
**So that** I can narrow down the song list

**Acceptance Criteria:**
- [ ] "Filter" button in page header opens filter panel
- [ ] Filter options:
  - Guitar tuning (Standard, Drop D, Half-step down, etc.)
  - Tags (multi-select checkboxes)
  - Upcoming show (dropdown)
- [ ] Active filters shown as chips/badges
- [ ] Click chip to remove individual filter
- [ ] "Clear All" button when filters active
- [ ] Filter count badge on Filter button (e.g., "Filter (2)")
- [ ] Filters persist until cleared

**Design Notes:**
- Filter panel: slide-down or side panel on desktop, bottom sheet on mobile
- Filter chips: rounded, #2a2a2a bg, × to remove
- Active filter count: orange badge

---

### Story 4: Sort Songs
**As a** band member
**I want to** sort songs by different criteria
**So that** I can organize the list my preferred way

**Acceptance Criteria:**
- [ ] Sort dropdown in page header (or column headers)
- [ ] Sort options:
  - Alphabetical (Title A-Z)
  - Alphabetical (Artist A-Z)
  - Recently Added
  - Upcoming Show
- [ ] Current sort indicated visually
- [ ] Sort direction toggleable (asc/desc)
- [ ] Sort persists during session

**Design Notes:**
- Sort dropdown: matches filter styling
- Active sort: orange highlight or checkmark

---

### Story 5: Add New Song
**As a** band member
**I want to** add a new song to the library
**So that** I can build our repertoire

**Acceptance Criteria:**
- [ ] "+ Add Song" button in page header (orange, prominent)
- [ ] Click opens "Add Song" modal
- [ ] Modal fields:
  - **Required:** Title, Artist, Key
  - **Optional:** Album, Duration, BPM, Tuning, Tags, Notes, Reference Links
- [ ] Duration input with mm:ss format validation
- [ ] Key dropdown with common keys (C, D, E, F, G, A, B + sharps/flats/minor)
- [ ] Tuning dropdown with common tunings
- [ ] Tags: comma-separated input or tag selector
- [ ] Reference Links: add multiple URLs (YouTube, Spotify, tabs)
- [ ] "Save Song" button (orange, validates required fields)
- [ ] "Cancel" button (secondary style)
- [ ] Success toast: "Song added successfully"
- [ ] Auto-generate avatar initials from title
- [ ] Modal closes on successful save
- [ ] New song appears at top of list

**Design Notes:**
- Modal: centered, max-width 600px on desktop
- Form inputs: h-44px, rounded-lg, border-#2a2a2a
- Label above input with 8px margin
- Required field indicator (red asterisk)

---

### Story 6: Edit Song
**As a** band member
**I want to** edit song details
**So that** I can correct mistakes or update information

**Acceptance Criteria:**
- [ ] Click row or "Edit" in actions menu opens edit modal
- [ ] Modal pre-populated with current song data
- [ ] Same fields and validation as Add Song
- [ ] "Save Changes" button (orange)
- [ ] "Cancel" button
- [ ] Success toast: "[Song Name] updated"
- [ ] Changes reflected immediately in list
- [ ] Modal closes on save

**Design Notes:**
- Same modal design as Add Song
- Consider showing "Last updated" timestamp

---

### Story 7: Delete Song
**As a** band member
**I want to** delete a song from the library
**So that** I can remove songs we no longer play

**Acceptance Criteria:**
- [ ] "Delete" in actions menu (•••)
- [ ] Confirmation dialog appears
- [ ] Dialog shows: "Delete [Song Name]? This cannot be undone."
- [ ] If song in setlists: "This song is in X setlist(s). It will be removed from those setlists."
- [ ] "Delete" button (red, danger style)
- [ ] "Cancel" button
- [ ] Success toast: "[Song Name] deleted"
- [ ] Song removed from list immediately
- [ ] Admins only can delete others' songs

**Design Notes:**
- Confirmation modal: smaller, centered
- Danger button: #D7263D background
- Warning icon for setlist message

---

### Story 8: Song Actions Menu
**As a** band member
**I want to** access quick actions for each song
**So that** I can perform common operations

**Acceptance Criteria:**
- [ ] Actions menu icon (•••) on each row
- [ ] Click opens dropdown menu with:
  - Edit Song
  - Add to Setlist
  - Duplicate Song
  - Delete Song (red text)
- [ ] Menu positioned to not overflow viewport
- [ ] Click outside closes menu
- [ ] Keyboard accessible (Escape to close)

**Design Notes:**
- Dropdown: #1f1f1f background, #2a2a2a border
- Items: hover state with slight highlight
- Delete option in red (#D7263D)

---

### Story 9: View Song Details
**As a** band member
**I want to** see full song details
**So that** I can review all information about a song

**Acceptance Criteria:**
- [ ] Click on song row opens detail view/modal
- [ ] Display all fields:
  - Title, Artist, Album
  - Duration, Key, BPM, Tuning
  - Tags
  - Notes (full text, formatted)
  - Reference Links (clickable)
  - Created date, Created by
  - Last modified
- [ ] "Edit" button if user has permission
- [ ] "Close" button or click outside to dismiss
- [ ] Links open in new tab

**Design Notes:**
- Modal or side panel
- Organized in sections
- Link buttons with external link icon

---

### Story 10: Add Song to Setlist (Quick Action)
**As a** band member
**I want to** quickly add a song to a setlist
**So that** I can build setlists efficiently

**Acceptance Criteria:**
- [ ] "Add to Setlist" in actions menu
- [ ] Opens small modal/dropdown with band's setlists
- [ ] Shows setlist names with song counts
- [ ] Click setlist name to add song
- [ ] Success toast: "[Song Name] added to [Setlist Name]"
- [ ] Option to "Create New Setlist" at bottom
- [ ] If no setlists: show "No setlists yet. Create one?"

**Design Notes:**
- Compact list style
- Checkmark for setlists already containing song
- "+ Create New Setlist" button at bottom

---

### Story 11: Responsive Mobile View
**As a** mobile user
**I want to** view and manage songs on my phone
**So that** I can access the library anywhere

**Acceptance Criteria:**
- [ ] Cards instead of table on screens < 768px
- [ ] Each card shows:
  - Avatar
  - Title & Artist
  - Duration, Key, Tuning, BPM in grid
  - Next Show (if applicable)
- [ ] Swipe actions for quick access (future)
- [ ] Mobile-optimized modals (full screen)
- [ ] Touch-friendly buttons (min 44px)
- [ ] Search and filter accessible
- [ ] Smooth scrolling

**Design Notes:**
- Cards: rounded-xl, p-4, mb-3
- Metadata grid: 2 columns
- Icons with labels for clarity

---

### Story 12: Empty State
**As a** band member
**I want to** see helpful guidance when there are no songs
**So that** I know what to do next

**Acceptance Criteria:**
- [ ] Shows when band has zero songs
- [ ] Displays:
  - Icon (musical note or empty state graphic)
  - "No songs yet"
  - "Add your first song to get started"
  - Large "+ Add Song" button (orange)
- [ ] Button opens Add Song modal
- [ ] Friendly, encouraging tone

**Design Notes:**
- Centered vertically and horizontally
- Large icon (48-64px)
- Text: #a0a0a0
- Button prominent but not overwhelming

---

## Technical Implementation Notes

### Component Structure
```
SongsPage.tsx
├── PageHeader (title, search, filter, add button)
├── FilterPanel (conditional)
├── SongTable (desktop)
│   └── SongRow
│       └── ActionsMenu
├── SongCardList (mobile)
│   └── SongCard
├── AddSongModal
├── EditSongModal
├── DeleteConfirmDialog
├── AddToSetlistMenu
└── EmptyState
```

### State Management
- Song list (fetch from database)
- Search query
- Active filters
- Sort order
- Selected song (for edit/delete)
- Modal states (isAddModalOpen, isEditModalOpen, etc.)
- Loading and error states

### Data Fetching
- Fetch songs for current band context
- Filter by: contextType='band' AND contextId=currentBandId
- Sort on client-side or server-side
- Consider pagination for large libraries (50+ songs)

### Validation
- Title: required, max 100 chars
- Artist: required, max 100 chars
- Duration: optional, format mm:ss, validate range
- Key: required, from predefined list
- BPM: optional, number between 40-300
- URLs: validate URL format

### Performance
- Debounce search: 300ms
- Virtualize list for 100+ songs
- Lazy load images/avatars
- Optimize re-renders with React.memo

---

## Design Specifications Reference

### Colors (from design-style-guide.md)
- **Background:** #121212 (Stage Black)
- **Cards:** #1a1a1a
- **Borders:** #2a2a2a
- **Text Primary:** #ffffff
- **Text Secondary:** #a0a0a0
- **Text Tertiary:** #707070
- **Primary CTA:** #f17827ff (Orange) ⭐
- **Danger:** #D7263D (Amp Red)

### Typography
- Page title: text-2xl font-bold
- Song title: text-sm font-semibold
- Artist: text-xs text-[#a0a0a0]
- Metadata: text-sm text-[#a0a0a0]

### Spacing
- Page padding: p-8
- Card padding: p-4
- Row padding: p-4
- Gap between items: gap-4
- Margins: mb-8 (page sections)

### Components
- Button height: h-10 (40px)
- Input height: h-10
- Border radius: rounded-lg (8px), rounded-xl (12px)
- Hover transitions: 200ms ease

---

## Testing Checklist
- [ ] Can add song with all required fields
- [ ] Cannot submit without required fields
- [ ] Search filters correctly
- [ ] Filters apply and clear properly
- [ ] Sort changes order correctly
- [ ] Edit updates song immediately
- [ ] Delete removes song and shows confirmation
- [ ] Actions menu works for each song
- [ ] Add to setlist functions correctly
- [ ] Mobile cards display properly
- [ ] Responsive at all breakpoints
- [ ] Loading states show during fetch
- [ ] Error states display helpful messages
- [ ] Empty state shows when no songs
- [ ] Avatar initials generate correctly
- [ ] Reference links open in new tab

---

## Acceptance Definition of Done
- [ ] All user stories implemented
- [ ] Matches NewLayout design style
- [ ] Responsive on mobile and desktop
- [ ] All interactions functional
- [ ] Loading and error states handled
- [ ] Orange primary color used consistently
- [ ] Accessible (keyboard navigation, focus states)
- [ ] No console errors
- [ ] Code reviewed and tested
