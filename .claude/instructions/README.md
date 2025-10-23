# Rock-On MVP Build Instructions

## Overview
This directory contains detailed user stories and implementation guides for building the complete Rock-On MVP. Each file focuses on a specific page/section of the application.

## 🚀 Current Phase: Phase 2 - Database Integration

**Phase 1 Status:** ✅ Complete - All 6 MVP pages built with mock data
**Phase 2 Status:** 🚧 In Progress - Wiring pages to Version 5 database schema

**Active Instructions:** `/workspaces/rock-on/.claude/instructions/mvp-phase2-database-integration.md`

## Primary References
- **Phase 2 Integration Guide:** `/workspaces/rock-on/.claude/instructions/mvp-phase2-database-integration.md` ⭐ **START HERE**
- **Functional MVP Spec:** `/workspaces/rock-on/.claude/specifications/2025-10-22T22:59_functional-mvp-spec.md`
- **Design Style Guide:** `/workspaces/rock-on/.claude/specifications/2025-10-22T14:01_design-style-guide.md`
- **Database Schema (Version 5):** `/workspaces/rock-on/.claude/specifications/database-schema.md`
- **Schema Implementation:** `/workspaces/rock-on/.claude/artifacts/2025-10-23T04:33_version-5-schema-implementation-complete.md`
- **Design Reference:** `/workspaces/rock-on/src/pages/NewLayout/NewLayout.tsx`

## Design System Quick Reference

### Colors
- **Background:** #121212 (Stage Black)
- **Cards:** #1a1a1a
- **Borders:** #2a2a2a
- **Text Primary:** #ffffff
- **Text Secondary:** #a0a0a0
- **Text Tertiary:** #707070
- **Primary CTA:** #f17827ff (Orange) ⭐ **Changed from blue!**
- **Danger:** #D7263D (Amp Red)
- **Success:** #4ade80 (Green)

### Component Patterns
- **Buttons:** h-10 (40px), rounded-lg, px-4
- **Inputs:** h-10, rounded-lg, border-#2a2a2a, focus:border-orange
- **Cards:** #1a1a1a bg, rounded-xl, p-4
- **Modals:** max-width 600px (centered), full-screen on mobile
- **Touch targets:** minimum 44px
- **Scrollbars:** Use `custom-scrollbar` or `custom-scrollbar-thin` classes for themed scrollbars

### Shared Components
- **TimePicker** (`/src/components/common/TimePicker.tsx`) - Google Calendar style time selector with hour/minute dropdowns and custom minute input
- **DurationPicker** (`/src/components/common/DurationPicker.tsx`) - Duration selector with presets (30min, 1hr, 2hr, etc.) and custom input, or time-range mode (start/end time)

---

## Build Order (Sprint Sequence)

**Phase 1:** ✅ Complete - UI mockups built with mock data
**Phase 2:** 🚧 In Progress - Database integration (see `mvp-phase2-database-integration.md`)

### Sprint 1: Foundation (Critical) - ✅ UI Complete, 🚧 Database Integration
**Goal:** Users can sign up, create/join bands, and manage members

1. **Authentication Pages** (`mvp-auth-pages.md`)
   - Sign Up
   - Log In
   - Get Started screen
   - Account Settings (basic)

2. **Band Members Page** (`mvp-band-members-page.md`)
   - View band info
   - Invite code management
   - Member list with roles
   - Assign instruments
   - Remove members
   - Basic permissions

**Output:** `/workspaces/rock-on/src/pages/NewLayout/`
- `AuthPages.tsx`
- `BandMembersPage.tsx`

---

### Sprint 2: Content Creation (High Priority) - ✅ UI Complete, 🚧 Database Integration
**Goal:** Users can add songs and create setlists

3. **Songs Page** (`mvp-songs-page.md`)
   - View song library (table/cards)
   - Add/edit/delete songs
   - Search and filter
   - Song details

4. **Setlists Page** (`mvp-setlists-page.md`)
   - View setlists
   - Create/edit setlists
   - Drag-drop song ordering
   - Associate with shows

**Output:** `/workspaces/rock-on/src/pages/NewLayout/`
- `SongsPage.tsx`
- `SetlistsPage.tsx`

---

### Sprint 3: Scheduling (High Priority) - ✅ UI Complete, 🚧 Database Integration
**Goal:** Users can schedule shows and practices

5. **Shows Page** (`mvp-shows-page.md`)
   - View shows list/timeline
   - Schedule shows
   - Link setlists to shows
   - Payment tracking

6. **Practices Page** (`mvp-practices-page.md`)
   - View practices list
   - Schedule practices
   - Add song lists
   - Auto-suggest from shows

**Output:** `/workspaces/rock-on/src/pages/NewLayout/`
- `ShowsPage.tsx`
- `PracticesPage.tsx`

---

### Sprint 4: Polish & Integration
**Goal:** Refine UX, add cross-page features

- Search and filtering refinements
- Responsive design testing
- Error handling and validation
- Loading states
- Success/error toasts
- Navigation improvements
- Accessibility

---

### Sprint 5: Testing & Deployment
**Goal:** Launch MVP

- End-to-end testing
- Bug fixes
- Performance optimization
- User acceptance testing
- Deployment to production

---

## Page-by-Page Guides

### Authentication & Account (`mvp-auth-pages.md`)
- **Sprint:** 1
- **Priority:** Critical
- **UI Status:** ✅ Complete
- **Database Status:** 🚧 Integration needed (see Phase 2 Task 4)
- **Dependencies:** None (start here)
- **Key Features:**
  - Sign up with email/password
  - Log in
  - Get started flow (create/join band)
  - Basic account settings
  - User menu & band selector dropdowns

### Band Members (`mvp-band-members-page.md`)
- **Sprint:** 1
- **Priority:** Critical
- **UI Status:** ✅ Complete
- **Database Status:** 🚧 Integration needed (see Phase 2 Task 5)
- **Dependencies:** Auth complete
- **Key Features:**
  - View/edit band info
  - Generate/share invite codes
  - Member list with roles (Owner/Admin/Member)
  - Assign instruments
  - Remove members
  - Transfer ownership
  - Role-based permissions

### Songs (`mvp-songs-page.md`)
- **Sprint:** 2
- **Priority:** High
- **UI Status:** ✅ Complete
- **Database Status:** 🚧 Integration needed (see Phase 2 Tasks 6-7)
- **Dependencies:** Auth, Band Members
- **Key Features:**
  - Song library (table on desktop, cards on mobile)
  - Add/edit/delete songs
  - Search (title, artist, album)
  - Filter (tuning, tags, show)
  - Sort (title, artist, date, show)
  - Quick actions (add to setlist, duplicate)
  - Empty state guidance

### Setlists (`mvp-setlists-page.md`)
- **Sprint:** 2
- **Priority:** High
- **UI Status:** ✅ Complete
- **Database Status:** 🚧 Integration needed (see Phase 2 Tasks 8-9)
- **Dependencies:** Songs complete
- **Key Features:**
  - Setlist library with previews
  - Create/edit setlists
  - Drag-drop song reordering
  - Associate with shows
  - Total duration calculation
  - Status management (Draft/Active/Archived)
  - Duplicate setlists

### Shows (`mvp-shows-page.md`)
- **Sprint:** 3
- **Priority:** High
- **UI Status:** ✅ Complete
- **Database Status:** 🚧 Integration needed (see Phase 2 Tasks 10-11)
- **Dependencies:** Setlists complete
- **Key Features:**
  - Shows list/timeline
  - Schedule shows with venue details
  - Link setlists to shows
  - Status tracking (Scheduled/Confirmed/Completed)
  - Payment tracking
  - Contact management
  - Next show preview

### Practices (`mvp-practices-page.md`)
- **Sprint:** 3
- **Priority:** Medium
- **UI Status:** ✅ Complete
- **Database Status:** 🚧 Integration needed (see Phase 2 Tasks 12-13)
- **Dependencies:** Songs, Shows
- **Key Features:**
  - Practices list
  - Schedule practices
  - Add song lists
  - Auto-suggest songs from upcoming shows
  - Mark as completed
  - Duration estimation
  - **Note:** No execution tracking in MVP

---

## How to Use These Instructions

### For AI Agents Building Pages:
1. Read the **Functional MVP Spec** first to understand overall architecture
2. Open the specific page instruction file (e.g., `mvp-songs-page.md`)
3. Review all user stories before starting
4. Follow the design specifications exactly (colors, spacing, components)
5. Implement user stories in order
6. Reference the **NewLayout.tsx** for visual style
7. Use the **database schema** for data models
8. Check the **Testing Checklist** at the end of each file
9. Mark **Acceptance Criteria** as you complete them

### For Developers:
1. Each `.md` file is a complete specification for one page
2. User stories follow "As a [role], I want to [action], So that [benefit]" format
3. Acceptance criteria are checkboxes you can track
4. Design notes provide specific styling guidance
5. Technical implementation sections include component structures and data models
6. Testing checklists ensure nothing is missed

---

## Common Patterns Across All Pages

### Header Structure
```
Page Title                            [Filter] [Search] [+ Primary Action]
```

### Card/Table Layout
- **Desktop:** Table view with multiple columns
- **Mobile:** Stacked cards with essential info
- **Breakpoint:** 768px (md)

### Modal Pattern
- **Desktop:** Centered, max-width 600px (or specified)
- **Mobile:** Full-screen
- **Header:** Title + close button (×)
- **Footer:** Cancel + Primary action (orange)

### Actions Menu (•••)
- Click opens dropdown
- Common actions: Edit, Duplicate, Delete
- Delete in red at bottom
- Positioned to avoid viewport overflow

### Empty States
- Icon (48-64px)
- Heading: "No [items] yet"
- Description: Helpful guidance
- Primary action button (orange)

### Confirmation Dialogs
- For destructive actions (delete, remove, etc.)
- Clear warning about consequences
- Danger button (red) + Cancel button
- For critical actions: require typing to confirm

### Loading States
- Skeleton loaders for lists
- Spinner for single items
- Disabled buttons during save

### Error Handling
- Inline validation errors (below field)
- Toast notifications for success/error
- Friendly error messages (avoid technical jargon)

---

## Navigation Structure

### Top Navigation Bar
```
┌────────────────────────────────────────────────────────────┐
│ [Band Selector ▼] │ Songs Setlists Shows Practices    [👤] │
└────────────────────────────────────────────────────────────┘
```

### Band Selector Dropdown (Top Left)
- Current band name
- List of user's bands (click to switch)
- "Manage Current Band" → Band Members page
- "Create New Band"
- "Join Band"

### User Menu Dropdown (Top Right)
- User name & email
- "Account Settings"
- "Log Out"

### Primary Navigation Tabs
1. Songs
2. Setlists
3. Shows
4. Practices

**Note:** Band Members accessed via Band Selector, not a tab

---

## Role-Based Permissions

### Owner (👑)
- All permissions
- Transfer ownership
- Delete band
- Manage admins
- Cannot leave without transferring ownership

### Admin
- Edit band info
- Invite/remove members
- Manage songs, setlists, shows, practices
- Edit member instruments
- Generate invite codes
- Cannot delete band or manage other admins

### Member
- View all band content
- Add songs, create setlists
- Schedule practices
- Edit own instruments
- Leave band
- Cannot remove others or change settings

---

## Database Integration

### Key Tables for MVP
- `users` - User accounts
- `userProfiles` - Extended user info
- `bands` - Band information
- `bandMemberships` - User-band relationships with roles
- `inviteCodes` - Band invitation codes
- `songs` - Song library (contextType='band')
- `setlists` - Performance setlists
- `practiceSessions` - Practice sessions (type='rehearsal') AND Shows (type='gig')
- `songGroups`, `songGroupMemberships` - For future variant linking (ignore in MVP)

### Context System
- All content is **band-scoped** in MVP
- Songs: `contextType='band'`, `contextId=bandId`
- User switches bands via Band Selector
- Current band stored in state/localStorage

---

## Out of Scope for MVP

These features are documented but **NOT** implemented in MVP:

❌ Personal song context (all songs are band-scoped)
❌ Confidence rating system
❌ Practice execution tracking (just scheduling)
❌ Attendance/RSVP tracking
❌ Complex analytics/reporting
❌ Calendar integrations
❌ Dashboard page (future)
❌ Song variant linking
❌ Real-time collaboration
❌ Push notifications
❌ Advanced member permissions (just Owner/Admin/Member)

---

## Success Criteria

### MVP is Complete When:
- [ ] All Sprint 1-3 features implemented
- [ ] User can sign up and create account
- [ ] User can create or join band
- [ ] User can invite members and manage roles
- [ ] User can add songs to band library
- [ ] User can create setlists with songs
- [ ] User can schedule shows and link setlists
- [ ] User can schedule practices with song lists
- [ ] All pages responsive (mobile + desktop)
- [ ] All user roles have correct permissions
- [ ] Orange (#f17827ff) primary color used throughout
- [ ] Design matches NewLayout style
- [ ] No critical bugs
- [ ] Basic error handling and validation
- [ ] Loading states and user feedback

---

## Questions During Development?

Refer back to:
1. **This README** for overall structure
2. **Functional MVP Spec** for feature scope
3. **Design Style Guide** for visual specifications
4. **Specific page .md file** for detailed user stories
5. **NewLayout.tsx** for code reference

---

## File Outputs

All page components should be created in:
```
/workspaces/rock-on/src/pages/NewLayout/
├── AuthPages.tsx
├── BandMembersPage.tsx
├── SongsPage.tsx
├── SetlistsPage.tsx
├── ShowsPage.tsx
└── PracticesPage.tsx
```

Shared components (modals, forms, etc.) in:
```
/workspaces/rock-on/src/components/
```

---

**Last Updated:** 2025-10-22
**Target:** MVP v1.0 Deployment
**Status:** Ready for Development
