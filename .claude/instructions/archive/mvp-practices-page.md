---
page: Practices
sprint: Sprint 3
priority: medium
references:
  - /workspaces/rock-on/.claude/specifications/2025-10-22T22:59_functional-mvp-spec.md
  - /workspaces/rock-on/.claude/specifications/2025-10-22T14:01_design-style-guide.md
output: /workspaces/rock-on/src/pages/NewLayout/PracticesPage.tsx
---

# MVP Practices Page - User Stories

## Overview
Build the Practices page mockup for scheduling practice sessions with song lists. **MVP focuses on scheduling only** - no execution tracking or attendance.

**Primary Color:** #f17827ff (Orange) - use for primary CTAs and active states

---

## User Stories

### Story 1: View Practice Sessions List
**As a** band member
**I want to** see all scheduled practice sessions
**So that** I know when and where to practice

**Acceptance Criteria:**
- [ ] Practices displayed as cards or list
- [ ] Each practice shows:
  - Date & time (prominent)
  - Duration (e.g., "2 hours")
  - Location/venue
  - Song count (e.g., "8 songs to practice")
  - Status badge (Scheduled/Completed/Cancelled)
  - Actions menu (•••)
- [ ] Sorted by date (upcoming first)
- [ ] Visual separation between upcoming and past practices
- [ ] Empty state: "No practices scheduled" with "+ Schedule Practice" CTA
- [ ] Loading state with skeleton loaders

**Design Notes:**
- Card layout, similar to Shows page
- Date badge: large, orange for upcoming
- Cards: #1a1a1a, rounded-xl, p-5
- Duration and location clearly visible

---

### Story 2: Filter Practices
**As a** band member
**I want to** filter practices by date
**So that** I can find specific sessions

**Acceptance Criteria:**
- [ ] Filter dropdown in page header
- [ ] Filter options:
  - Upcoming (default)
  - Past
  - All
  - By month
- [ ] Active filter shown in header
- [ ] Clear filter option

**Design Notes:**
- Consistent filter dropdown style
- Active filter highlighted in orange

---

### Story 3: Schedule New Practice
**As a** band member
**I want to** schedule a practice session
**So that** we can coordinate rehearsals

**Acceptance Criteria:**
- [ ] "+ Schedule Practice" button in page header (orange)
- [ ] Click opens Schedule Practice modal
- [ ] Modal sections:
  - **Basic Info:**
    - Date (required, date picker)
    - Time (required, time picker)
    - Duration (dropdown: 1h, 1.5h, 2h, 2.5h, 3h, custom)
    - Location (optional, text input)
    - Notes (optional, textarea)
  - **Songs to Practice:**
    - Search/select songs from band library
    - Selected songs show in list
    - Remove song (× button)
    - Drag to reorder (optional for MVP)
- [ ] "Auto-suggest from next show" feature:
  - If show scheduled, show button "Add songs from [Show Name]"
  - Click adds all songs from that show's setlist
- [ ] "Schedule Practice" button (orange, validates required)
- [ ] "Cancel" button
- [ ] Success toast: "Practice scheduled"
- [ ] New practice appears in list

**Design Notes:**
- Modal: max-width 600px, scrollable
- Two sections: Basic Info + Song List
- Duration dropdown with common options
- Song list: compact, with remove buttons

---

### Story 4: Add Songs to Practice
**As a** band member
**I want to** select which songs to practice
**So that** we focus on specific material

**Acceptance Criteria:**
- [ ] "Add Song" button opens song selector
- [ ] Search bar to filter band's songs
- [ ] Song list shows: title, artist, key, duration
- [ ] Click song or "+" to add to practice
- [ ] Selected songs appear in "Songs to Practice" list
- [ ] Can add same song multiple times
- [ ] Total practice time estimate updates
- [ ] Can remove songs easily

**Design Notes:**
- Song selector: modal or expandable panel
- Selected songs: list with checkmarks or badges
- Visual feedback when song added

---

### Story 5: Auto-Suggest Songs from Show
**As a** band member
**I want to** quickly add songs from an upcoming show
**So that** I can prepare for performances

**Acceptance Criteria:**
- [ ] "Add from show" button in practice modal
- [ ] Shows dropdown of upcoming shows
- [ ] Select show adds all songs from its setlist
- [ ] Success message: "Added X songs from [Show Name]"
- [ ] Songs appear in practice list
- [ ] Can still add/remove individual songs after

**Design Notes:**
- Button: secondary style, with icon (calendar or setlist)
- Dropdown: lists shows with dates
- Quick action, minimal clicks

---

### Story 6: Edit Practice Session
**As a** band member
**I want to** edit practice details
**So that** I can update time, location, or songs

**Acceptance Criteria:**
- [ ] Click practice card or "Edit" in actions menu
- [ ] Opens edit modal (same as Schedule)
- [ ] Pre-populated with current data
- [ ] Can change date, time, duration, location, notes
- [ ] Can add/remove songs
- [ ] "Save Changes" button (orange)
- [ ] "Cancel" button
- [ ] Success toast: "Practice updated"
- [ ] Changes reflected immediately

**Design Notes:**
- Same modal as Schedule Practice
- Show "Last updated" timestamp

---

### Story 7: Mark Practice as Completed
**As a** band member
**I want to** mark a practice as completed
**So that** it moves to past practices

**Acceptance Criteria:**
- [ ] "Mark as Completed" in actions menu
- [ ] Changes status to "Completed"
- [ ] Practice moves to "Past Practices" section
- [ ] Date updated to completion date
- [ ] No confirmation needed (can undo by editing)
- [ ] Success toast: "Practice marked as completed"

**Design Notes:**
- Quick action, one click
- Status badge updates to green "Completed"

---

### Story 8: Cancel Practice
**As a** band member
**I want to** cancel a practice session
**So that** I can update plans

**Acceptance Criteria:**
- [ ] "Cancel Practice" in actions menu
- [ ] Confirmation dialog: "Cancel this practice?"
- [ ] Option to add cancellation reason (optional)
- [ ] Changes status to "Cancelled"
- [ ] Practice shown with cancelled badge
- [ ] Can reschedule by editing
- [ ] Success toast: "Practice cancelled"

**Design Notes:**
- Confirmation modal: quick and simple
- Cancelled badge: red, muted appearance
- Option to delete instead of cancel

---

### Story 9: Delete Practice
**As a** band admin
**I want to** delete a practice session
**So that** I can remove incorrect entries

**Acceptance Criteria:**
- [ ] "Delete" in actions menu (admin only)
- [ ] Confirmation dialog: "Delete this practice? This cannot be undone."
- [ ] "Delete" button (red, danger)
- [ ] "Cancel" button
- [ ] Success toast: "Practice deleted"
- [ ] Practice removed from list immediately

**Design Notes:**
- Confirmation modal: danger styling
- Clear permanent deletion warning

---

### Story 10: View Practice Details
**As a** band member
**I want to** see full practice details
**So that** I know what to prepare

**Acceptance Criteria:**
- [ ] Click practice card opens detail view/modal
- [ ] Display all fields:
  - Date & time
  - Duration
  - Location (with map link if address)
  - Song list (ordered)
    - For each song: title, artist, key, duration
  - Notes
  - Status
  - Created date
- [ ] "Edit" button
- [ ] "Get Directions" link if location set
- [ ] Links to song details

**Design Notes:**
- Clean, organized layout
- Song list: compact table or cards
- Action buttons at bottom

---

### Story 11: Practice Song List
**As a** band member
**I want to** see which songs to practice
**So that** I can prepare

**Acceptance Criteria:**
- [ ] Song list displayed in practice detail
- [ ] Each song shows: title, artist, key, duration
- [ ] Total estimated time calculated
- [ ] Click song opens song details
- [ ] Order indicates suggested practice sequence
- [ ] Print-friendly format (future)

**Design Notes:**
- Numbered or bulleted list
- Compact, easy to scan
- Total time at bottom

---

### Story 12: Calendar View (Future)
**As a** band member
**I want to** see practices in a calendar
**So that** I can visualize our schedule

**Acceptance Criteria:**
- [ ] Toggle between List and Calendar views
- [ ] Calendar shows practices on dates
- [ ] Month/week views
- [ ] Click practice opens details
- [ ] Can drag to reschedule (future)
- [ ] Shows conflicts with shows

**Design Notes:**
- Calendar: month grid or week timeline
- Practices: colored blocks
- Integration with Shows for conflicts

---

### Story 13: Practice Duration Estimate
**As a** band member
**I want to** see estimated practice duration
**So that** I can plan my time

**Acceptance Criteria:**
- [ ] Calculate total time based on:
  - Number of songs × average practice time per song (e.g., 5 min)
  - Or use actual song durations × 2
  - Or set duration manually in modal
- [ ] Display: "Estimated: 1h 30min for 8 songs"
- [ ] Compare to scheduled duration
- [ ] Warn if estimate exceeds scheduled time

**Design Notes:**
- Display in practice modal and card
- Warning color if exceeds (orange/red)
- Help text explaining calculation

---

### Story 14: Mobile Responsive Practices
**As a** mobile user
**I want to** manage practices on my phone
**So that** I can coordinate on-the-go

**Acceptance Criteria:**
- [ ] Practices display as stacked cards
- [ ] Date/time prominent on each card
- [ ] Modal fields stack vertically
- [ ] Touch-friendly date/time pickers
- [ ] Song selection mobile-optimized
- [ ] Swipe actions for quick edit/delete
- [ ] Save button fixed at bottom

**Design Notes:**
- Full-width cards, mb-3
- Large touch targets
- Native pickers on iOS/Android
- Smooth scrolling

---

### Story 15: Empty State
**As a** band member
**I want to** see helpful guidance when no practices scheduled
**So that** I know how to get started

**Acceptance Criteria:**
- [ ] Shows when band has zero practices
- [ ] Displays:
  - Icon (calendar or metronome)
  - "No practices scheduled"
  - "Schedule your first practice to get started"
  - Large "+ Schedule Practice" button (orange)
- [ ] Button opens Schedule Practice modal

**Design Notes:**
- Centered, large icon (48-64px)
- Encouraging message
- Orange CTA button

---

## Technical Implementation Notes

### Component Structure
```
PracticesPage.tsx
├── PageHeader (title, filter, schedule button)
├── PracticesList
│   └── PracticeCard
│       ├── DateBadge
│       ├── PracticeInfo (time, location, songs)
│       └── ActionsMenu
├── SchedulePracticeModal
│   ├── BasicInfoForm (date, time, duration, location)
│   └── SongSelector
├── EditPracticeModal (same as Schedule)
├── PracticeDetailView
├── DeleteConfirmDialog
└── EmptyState
```

### State Management
- Practices array (fetched from DB)
- Filter state (upcoming/past/all)
- Selected practice (for edit/detail)
- Modal states
- Song selection state
- Loading and error states

### Data Model
```typescript
interface Practice {
  id: string
  bandId: string
  scheduledDate: Date
  duration: number  // minutes
  location?: string
  type: 'rehearsal'  // fixed for MVP
  status: 'scheduled' | 'completed' | 'cancelled'
  songs: PracticeSong[]  // ordered array
  notes?: string
  createdDate: Date
  lastModified: Date
}

interface PracticeSong {
  songId: string
  position: number  // order in practice
}
```

### Auto-Suggest Logic
- Fetch upcoming shows for band
- Get setlist associated with nearest show
- Extract song IDs from setlist
- Populate practice song list
- Maintain order from setlist

---

## Design Specifications Reference

### Colors
- **Upcoming Practice:** #f17827ff (Orange) accent
- **Completed:** #4ade80 (green) badge
- **Cancelled:** #D7263D (red) badge
- **Past Practice:** muted, #707070 text

### Date Badge
- Large, prominent
- Day of week + date
- Colored for upcoming (orange)

---

## Testing Checklist
- [ ] Can schedule practice with required fields
- [ ] Cannot submit without date/time
- [ ] Edit updates practice correctly
- [ ] Delete removes after confirmation
- [ ] Mark as completed changes status
- [ ] Cancel practice updates status
- [ ] Song selection works
- [ ] Auto-suggest from show populates songs
- [ ] Duration estimate calculates
- [ ] Filter by upcoming/past works
- [ ] Mobile view responsive
- [ ] Empty state displays
- [ ] All user roles can schedule

---

## Acceptance Definition of Done
- [ ] All user stories implemented
- [ ] Matches design style guide
- [ ] Responsive on mobile and desktop
- [ ] Orange primary color used
- [ ] Loading and error states
- [ ] Accessible
- [ ] No console errors
- [ ] Code reviewed and tested

---

## Out of Scope for MVP
- ❌ Attendance tracking
- ❌ Real-time session execution
- ❌ Per-song notes during practice
- ❌ Practice ratings
- ❌ Objective tracking
- ❌ RSVP system
- ❌ Email notifications/invitations
- ❌ Practice history analytics
