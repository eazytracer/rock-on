---
page: Shows
sprint: Sprint 3
priority: high
references:
  - /workspaces/rock-on/.claude/specifications/2025-10-22T22:59_functional-mvp-spec.md
  - /workspaces/rock-on/.claude/specifications/2025-10-22T14:01_design-style-guide.md
output: /workspaces/rock-on/src/pages/NewLayout/ShowsPage.tsx
---

# MVP Shows Page - User Stories

## Overview
Build the Shows page mockup for scheduling and tracking band performances and gigs.

**Primary Color:** #f17827ff (Orange) - use for primary CTAs and active states

---

## User Stories

### Story 1: View Shows List
**As a** band member
**I want to** see all scheduled shows
**So that** I can track upcoming performances

**Acceptance Criteria:**
- [ ] Shows displayed as cards or timeline
- [ ] Each show shows:
  - Date badge (large, prominent)
  - Show/event name
  - Venue/location
  - Time (load-in, soundcheck, performance)
  - Associated setlist (if any)
  - Status badge (Scheduled/Confirmed/Completed/Cancelled)
  - Actions menu (•••)
- [ ] Sorted by date (upcoming first)
- [ ] Visual separation between upcoming and past shows
- [ ] Empty state: "No shows scheduled" with "+ Schedule Show" CTA
- [ ] Loading state with skeleton loaders

**Design Notes:**
- Card layout with emphasis on date
- Date badge: large, colored (orange for upcoming, gray for past)
- Cards: #1a1a1a, rounded-xl, p-5
- Status badges: colored pills

---

### Story 2: Filter Shows
**As a** band member
**I want to** filter shows by status or date
**So that** I can find specific performances

**Acceptance Criteria:**
- [ ] Filter dropdown in page header
- [ ] Filter options:
  - Upcoming (default)
  - Past
  - All
  - By month/year
  - By status (Scheduled/Confirmed/Completed/Cancelled)
- [ ] Active filter shown in header
- [ ] Clear filter option

**Design Notes:**
- Dropdown matches filter style from other pages
- Active filter highlighted in orange

---

### Story 3: Schedule New Show
**As a** band admin
**I want to** schedule a new show
**So that** we can prepare for performances

**Acceptance Criteria:**
- [ ] "+ Schedule Show" button in page header (orange)
- [ ] Click opens Schedule Show modal
- [ ] Modal fields:
  - **Required:**
    - Show/Event Name (e.g., "Toys 4 Tots Benefit")
    - Date
    - Time
  - **Optional:**
    - Venue/Location
    - Address
    - Associated Setlist (dropdown)
    - Load-in Time
    - Soundcheck Time
    - Set Length (duration)
    - Payment Amount ($)
    - Contacts (name, phone, email)
    - Notes
- [ ] Status dropdown: Scheduled (default), Confirmed
- [ ] Date picker (calendar UI)
- [ ] Time picker (12h or 24h format)
- [ ] "Schedule Show" button (orange, validates required)
- [ ] "Cancel" button
- [ ] Success toast: "Show scheduled"
- [ ] New show appears in list

**Design Notes:**
- Modal: max-width 700px, scrollable if long
- Form sections: Basic Info, Schedule, Financials, Notes
- Collapsible sections for optional fields
- Date badge preview as you type

---

### Story 4: Edit Show Details
**As a** band admin
**I want to** edit show information
**So that** I can update details as they change

**Acceptance Criteria:**
- [ ] Click show card or "Edit" in actions menu
- [ ] Opens edit modal (same as Schedule Show)
- [ ] Pre-populated with current data
- [ ] Can change any field
- [ ] "Save Changes" button (orange)
- [ ] "Cancel" button
- [ ] Success toast: "[Show Name] updated"
- [ ] Changes reflected immediately in list

**Design Notes:**
- Same modal design as Schedule Show
- Show "Last updated" timestamp

---

### Story 5: Associate Setlist with Show
**As a** band member
**I want to** link a setlist to a show
**So that** I know which songs to perform

**Acceptance Criteria:**
- [ ] "Setlist" dropdown in show modal
- [ ] Lists all band setlists
- [ ] Shows setlist name and song count
- [ ] Can select or clear setlist
- [ ] Selected setlist displayed on show card
- [ ] Click setlist name opens setlist view
- [ ] Can change setlist anytime before show

**Design Notes:**
- Dropdown with preview (name + song count)
- Setlist linked with icon on show card
- Click setlist name = navigate to setlist

---

### Story 6: Update Show Status
**As a** band admin
**I want to** update show status
**So that** I can track progress and completion

**Acceptance Criteria:**
- [ ] Status dropdown in show modal
- [ ] Status options:
  - **Scheduled:** Initial booking (gray/blue)
  - **Confirmed:** Venue confirmed (orange)
  - **Completed:** Show performed (green)
  - **Cancelled:** Show cancelled (red)
- [ ] Status badge visible on show card
- [ ] Color-coded for quick identification
- [ ] Completed shows move to "Past Shows" section
- [ ] Cancelled shows shown with strikethrough or muted

**Design Notes:**
- Status badges: rounded pills, colored backgrounds
- Completed shows: grayed out but still visible
- Cancelled: red badge, possibly grayed out

---

### Story 7: View Show Details
**As a** band member
**I want to** see full show details
**So that** I have all info for the performance

**Acceptance Criteria:**
- [ ] Click show card opens detail view/modal
- [ ] Display all fields:
  - Show name
  - Date, Time
  - Venue, Address (with map link)
  - Load-in, Soundcheck times
  - Set length
  - Associated setlist (link to view)
  - Payment amount
  - Contacts (name, phone, email)
  - Notes
  - Status
  - Created date, Last modified
- [ ] "Edit" button (admin only)
- [ ] "Get Directions" link (opens maps)
- [ ] "Call Venue" link (tel: link)
- [ ] "View Setlist" button if associated

**Design Notes:**
- Clean, organized layout
- Sections: Event Info, Schedule, Setlist, Contacts, Payment, Notes
- Icons for each section
- Action buttons at bottom

---

### Story 8: Delete Show
**As a** band admin
**I want to** delete a show
**So that** I can remove cancelled or incorrect entries

**Acceptance Criteria:**
- [ ] "Delete" in actions menu (admin only)
- [ ] Confirmation dialog: "Delete [Show Name]? This cannot be undone."
- [ ] "Delete" button (red, danger)
- [ ] "Cancel" button
- [ ] Success toast: "[Show Name] deleted"
- [ ] Show removed from list immediately
- [ ] Associated setlist NOT deleted (just unlinked)

**Design Notes:**
- Confirmation modal: warning icon, danger button
- Clear message about permanent deletion

---

### Story 9: Show Timeline View
**As a** band member
**I want to** see shows in a timeline/calendar format
**So that** I can visualize our schedule

**Acceptance Criteria:**
- [ ] Toggle between List and Timeline views
- [ ] Timeline shows shows on a date line
- [ ] Month markers visible
- [ ] Click show on timeline opens details
- [ ] Upcoming shows more prominent
- [ ] Past shows muted/grayed

**Design Notes:**
- Timeline: horizontal or vertical
- Date markers: clear, evenly spaced
- Show cards: compact on timeline
- Smooth scrolling to today/next show

---

### Story 10: Upcoming Show Preview
**As a** band member
**I want to** see my next show highlighted
**So that** I can quickly see what's coming up

**Acceptance Criteria:**
- [ ] First upcoming show card highlighted/enlarged
- [ ] Shows:
  - "Next Show" badge
  - Days until show (e.g., "In 5 days")
  - All key details prominent
  - Direct link to associated setlist
- [ ] Countdown timer (days, hours for very close shows)
- [ ] Call-to-action if no setlist assigned

**Design Notes:**
- Next show card: larger, bordered in orange
- Countdown: large, bold text
- "Assign Setlist" button if none assigned

---

### Story 11: Show Payment Tracking
**As a** band admin
**I want to** track payment for shows
**So that** I can manage finances

**Acceptance Criteria:**
- [ ] "Payment Amount" field in show modal
- [ ] Optional: Currency symbol/dropdown
- [ ] Optional: Payment status (Not Paid/Partial/Paid)
- [ ] Optional: Payment notes
- [ ] Shows payment info on show card (if set)
- [ ] Filter by payment status
- [ ] Total earnings visible (optional dashboard)

**Design Notes:**
- Payment field: $ prefix or dropdown
- Payment badge on card if set
- Color-coded by status (red=unpaid, green=paid)

---

### Story 12: Show Contacts Management
**As a** band admin
**I want to** store venue/promoter contacts
**So that** I can easily reach out

**Acceptance Criteria:**
- [ ] "Contacts" section in show modal
- [ ] Can add multiple contacts
- [ ] Fields per contact:
  - Name
  - Role (Venue Manager, Promoter, etc.)
  - Phone
  - Email
- [ ] Click phone = tel: link (mobile)
- [ ] Click email = mailto: link
- [ ] Can add/remove contacts
- [ ] Contacts shown on show detail view

**Design Notes:**
- Contacts: list with add/remove buttons
- Icons for phone/email
- Quick-action buttons (call, email)

---

### Story 13: Export Show Schedule
**As a** band member
**I want to** export our show schedule
**So that** I can share with others or print

**Acceptance Criteria:**
- [ ] "Export" button in page header
- [ ] Export options:
  - PDF (formatted list)
  - CSV (spreadsheet)
  - iCal (calendar import)
- [ ] Includes all upcoming shows
- [ ] Option to filter date range
- [ ] Downloads file to device

**Design Notes:**
- Export button: secondary style
- Modal for export options
- Progress indicator during export

---

### Story 14: Mobile Responsive Shows View
**As a** mobile user
**I want to** view and manage shows on my phone
**So that** I can access schedule anywhere

**Acceptance Criteria:**
- [ ] Shows display as cards (stacked)
- [ ] Date badge prominent on each card
- [ ] Swipe actions for quick edit/delete
- [ ] Mobile-optimized modals (full screen)
- [ ] Touch-friendly date/time pickers
- [ ] Tap venue for directions
- [ ] Tap phone for quick call

**Design Notes:**
- Cards: full width, mb-3
- Large touch targets (44px min)
- Native pickers on iOS/Android
- Swipe reveals action buttons

---

### Story 15: Empty State
**As a** band member
**I want to** see helpful guidance when no shows scheduled
**So that** I know what to do

**Acceptance Criteria:**
- [ ] Shows when band has zero shows
- [ ] Displays:
  - Icon (calendar, ticket, or stage)
  - "No shows scheduled"
  - "Schedule your first show to get started"
  - Large "+ Schedule Show" button (orange)
- [ ] Button opens Schedule Show modal

**Design Notes:**
- Centered, large icon (48-64px)
- Encouraging message
- Orange CTA button

---

## Technical Implementation Notes

### Component Structure
```
ShowsPage.tsx
├── PageHeader (title, filter, view toggle, schedule button)
├── ShowsList (or Timeline)
│   └── ShowCard
│       ├── DateBadge
│       ├── ShowInfo
│       ├── SetlistLink
│       └── ActionsMenu
├── ScheduleShowModal
├── EditShowModal (same as Schedule)
├── ShowDetailView
├── DeleteConfirmDialog
└── EmptyState
```

### State Management
- Shows array (fetched from DB)
- Filter state (upcoming/past/all)
- View mode (list/timeline)
- Selected show (for edit/detail)
- Modal states
- Loading and error states

### Data Model
```typescript
interface Show {
  id: string
  bandId: string
  name: string
  date: Date
  time: string
  venue?: string
  address?: string
  setlistId?: string
  loadInTime?: string
  soundcheckTime?: string
  setLength?: number  // minutes
  paymentAmount?: number
  paymentStatus?: 'unpaid' | 'partial' | 'paid'
  contacts?: ShowContact[]
  notes?: string
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled'
  createdDate: Date
  lastModified: Date
}

interface ShowContact {
  name: string
  role?: string
  phone?: string
  email?: string
}
```

### Date Handling
- Use date-fns or dayjs for formatting
- Display relative dates ("In 5 days", "Yesterday")
- Support multiple time zones (future)
- Calendar integration (iCal export)

---

## Design Specifications Reference

### Colors
- **Upcoming Show:** #f17827ff (Orange) accent
- **Confirmed:** #f17827ff badge
- **Completed:** #4ade80 (green) badge
- **Cancelled:** #D7263D (red) badge
- **Past Show:** muted, #707070 text

### Date Badge
- Large, circular or rounded square
- Day of week + date number
- Month below or beside
- Colored border for upcoming

---

## Testing Checklist
- [ ] Can schedule show with required fields
- [ ] Cannot submit without required fields
- [ ] Edit updates show correctly
- [ ] Delete removes after confirmation
- [ ] Filter by upcoming/past works
- [ ] Status updates correctly
- [ ] Setlist links to correct setlist
- [ ] Date/time pickers work on all devices
- [ ] Payment tracking functional
- [ ] Contacts display and link correctly
- [ ] Export generates correct files
- [ ] Mobile view responsive
- [ ] Empty state displays
- [ ] All user roles have appropriate access

---

## Acceptance Definition of Done
- [ ] All user stories implemented
- [ ] Matches design style guide
- [ ] Responsive on mobile and desktop
- [ ] Date/time handling accurate
- [ ] Orange primary color used
- [ ] Loading and error states
- [ ] Accessible
- [ ] No console errors
- [ ] Code reviewed and tested
