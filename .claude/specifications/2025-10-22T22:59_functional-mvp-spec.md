---
timestamp: 2025-10-22T22:59
prompt: "Create a functional MVP specification focusing on core band management workflow: create account, create/join band, add songs, create setlists, schedule shows, schedule practices. Remove confidence ratings, practice execution, and personal context for MVP."
type: specification
status: active
version: mvp-v1
---

# Rock-On Functional MVP Specification

## Document Purpose
This specification defines the **Minimum Viable Product** for Rock-On - a band management app focused on the essential workflow needed to get a band organized and running. This is the target for the first deployed version.

**Design Reference:** `/workspaces/rock-on/src/pages/NewLayout/NewLayout.tsx`

---

## Core MVP User Journey

```
User Signs Up → Creates/Joins Band → Adds Songs → Creates Setlists → Schedules Shows → Schedules Practices
```

### Out of Scope for MVP
- ❌ Personal song context (everything is band-scoped)
- ❌ Confidence rating system
- ❌ Practice session execution/tracking
- ❌ Complex analytics/reporting
- ❌ Calendar integrations
- ❌ Dashboard page
- ❌ Song variant linking
- ❌ Advanced member permissions
- ❌ Profile customization beyond basics

---

## App Structure & Navigation

### Band-First Architecture
The app operates like **Slack workspaces** or **Discord servers** - users are always viewing content for a specific band.

### Top Navigation Bar
```
┌─────────────────────────────────────────────────────────────┐
│ [Band Selector ▼]  │  Songs  Setlists  Shows  Practices    │
│                    │                              [Profile]│
└─────────────────────────────────────────────────────────────┘
```

#### Band Selector (Top Left)
- **Displays:** Current band name with dropdown icon
- **Click Action:** Opens dropdown menu with:
  - List of user's bands (if multiple)
  - "Manage Current Band" (→ Band Members page)
  - "Create New Band"
  - "Join Band"

#### Primary Navigation Tabs (Left Sidebar)
1. **Songs** - Band's song library
2. **Setlists** - Performance setlists
3. **Shows** - Scheduled performances
4. **Practices** - Practice sessions
5. **Band Members** - Member management (accessed via Band Selector)

#### User Menu (Top Right)
- **Displays:** User avatar/initial
- **Click Action:** Dropdown with:
  - User email
  - "Account Settings"
  - "Log Out"

---

# Page Specifications

## 1. Songs Page

### Purpose
Band's song library with search, filtering, and basic management.

### Layout
Matches `/workspaces/rock-on/src/pages/NewLayout/NewLayout.tsx` design:
- Dark background (#121212)
- Table view on desktop, card view on mobile
- Clean, modern styling

### Page Header
```
Songs                                    [Filter] [Search...] [+ Add Song]
```

### Song List - Desktop Table View
**Columns:**
1. **Song** - Avatar with initials, Title, Artist (subtitle)
2. **Duration** - Song length (e.g., "3:14")
3. **Key** - Musical key (e.g., "F#")
4. **Tuning** - Guitar tuning (e.g., "Standard")
5. **BPM** - Tempo (e.g., "104 bpm")
6. **Next Show** - Show name & date (if scheduled)
7. **Actions** - Menu (•••)

### Song List - Mobile Card View
Each card shows:
- Avatar with initials
- Title & Artist
- Grid with: Duration, Key, Tuning, BPM
- Next Show (if applicable)

### Filters & Search
- **Search:** Live search across title, artist, album
- **Filters:**
  - Guitar tuning
  - Tags/categories
  - Next show
- **Sort:**
  - Alphabetical (title or artist)
  - Recently added
  - Upcoming show

### Song Actions (Per Row)
- **Quick Actions Menu (•••):**
  - Edit Song
  - Add to Setlist
  - Duplicate Song
  - Delete Song

### Add New Song Modal
**Required Fields:**
- Title
- Artist
- Key

**Optional Fields:**
- Album
- Duration (mm:ss)
- BPM
- Guitar Tuning
- Tags (comma-separated)
- Notes
- Reference Links (YouTube, Spotify, tabs)

**Actions:**
- Save Song
- Cancel

### Edit Song
Same modal as Add Song, pre-populated with existing data.

### Delete Song
- Confirmation dialog: "Delete [Song Name]? This cannot be undone."
- If song is in setlists, show warning: "This song is in X setlist(s). It will be removed from those setlists."

---

## 2. Setlists Page

### Purpose
Create and manage performance setlists with song ordering.

### Page Header
```
Setlists                                     [Filter: All ▼] [+ Create Setlist]
```

### Setlist List View
**Card/Table showing:**
- Setlist name
- Associated show (if any) - show name & date
- Song count (e.g., "12 songs")
- Total duration (e.g., "48 min")
- Status badge (Draft / Active / Archived)
- Last modified date
- Actions menu (•••)
- Preview of first 5 songs on list

**Filters:**
- Status (All / Draft / Active / Archived)
- By show
- By date

**Actions per Setlist:**
- View/Edit Setlist
- Duplicate Setlist
- Print Setlist (future)
- Archive Setlist
- Delete Setlist

### Create/Edit Setlist Page

#### Setlist Header
**Fields:**
- Setlist Name (required)
- Associated Show (dropdown, optional)
- Status (Draft / Active / Archived)
- Notes (textarea)

#### Song List Section
**Left Panel: Setlist Songs (Ordered)**
- Drag-and-drop reordering
- Each song shows:
  - Position number
  - Song title & artist
  - Duration
  - Key
  - Drag handle (☰)
  - Remove button (×)
- Running total duration at bottom

**Right Panel: Available Songs**
- Search/filter band's songs
- Click to add to setlist
- Shows:
  - Title & artist
  - Duration
  - Key
  - "+" button to add

**Actions:**
- Save Setlist
- Cancel
- Delete Setlist (if editing existing)

### Setlist Performance View (Future)
*Out of MVP scope - just show the ordered list for now*

---

## 3. Shows Page

### Purpose
Schedule and track performances/gigs.

### Page Header
```
Shows                                        [Filter: Upcoming ▼] [+ Schedule Show]
```

### Show List View

**Upcoming Shows (Default View):**
- Large date badge
- Show/venue name
- Date & time
- Location/venue
- Associated setlist (if any)
- Status badge (Scheduled / Confirmed / Completed / Cancelled)
- Actions menu (•••)

**Past Shows:**
- Same layout, grayed out
- Show "Completed" badge

**Filters:**
- Upcoming / Past / All
- By month
- By venue

**Actions per Show:**
- View/Edit Show
- Assign Setlist
- Cancel Show
- Delete Show

### Create/Edit Show Modal

**Required Fields:**
- Show/Event Name (e.g., "Toys 4 Tots Benefit")
- Date
- Time

**Optional Fields:**
- Venue/Location
- Address
- Setlist (dropdown of band's setlists)
- Load-in Time
- Soundcheck Time
- Set Length
- Payment Amount
- Notes
- Contacts (venue/promoter)

**Status:**
- Scheduled (default)
- Confirmed
- Completed
- Cancelled

**Actions:**
- Save Show
- Cancel
- Delete Show (with confirmation)

---

## 4. Practices Page

### Purpose
Schedule practice sessions with song lists.

**Simplified for MVP:** Just scheduling with date, time, location, and song list. No execution tracking or attendance.

### Page Header
```
Practices                                    [View: List ▼] [+ Schedule Practice]
```

### Practice List View

**Upcoming Practices:**
- Date & time (prominent)
- Duration
- Location
- Song count (e.g., "8 songs to practice")
- Status badge (Scheduled / Completed / Cancelled)
- Actions menu (•••)

**Past Practices:**
- Same layout, marked as Completed
- Date completed

**View Options:**
- List View (default)
- Calendar View (future)

**Actions per Practice:**
- View/Edit Practice
- Mark as Completed
- Cancel Practice
- Delete Practice

### Create/Edit Practice Modal

**Basic Info:**
- Date (required)
- Time (required)
- Duration (default: 2 hours)
- Location (optional)
- Notes (optional)

**Songs to Practice:**
- Search/select from band's songs
- Shows selected songs as a list
- "Add Song" button
- Remove song (× button)
- Drag to reorder (optional)

**Suggestions (Auto-populate):**
- If a show is selected: "Songs from [Show Name] - [Date]"
- Automatically add songs from that show's setlist

**Actions:**
- Save Practice
- Cancel
- Delete Practice (if editing)

---

## 5. Band Members Page

### Purpose
Manage band roster, invite members, assign instruments. Accessed via "Manage Current Band" in Band Selector.

### Page Layout
```
[← Back to Songs]                            Band Name: iPod Shuffle

┌─────────────────────────────────────────────────────────────┐
│ Band Info Section                                            │
│ - Band Name (editable by admin)                             │
│ - Member count                                               │
│ - [Edit Band Info] (admin only)                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Invite Members Section (admin only)                         │
│ - Invite Code: ABC123 [Copy]                                │
│ - [Regenerate Code] [Share]                                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Members List                                                 │
│ [Search members...]                      [+ Invite Members]  │
│                                                              │
│ [Member Cards/Table]                                         │
└─────────────────────────────────────────────────────────────┘
```

### Band Info Section
**Display:**
- Band name (large, editable by admin)
- Description (optional)
- Member count badge
- Created date

**Actions (Admin Only):**
- Edit Band Name
- Edit Description
- Delete Band (owner only, in settings)

### Invite Code Section (Admin Only)
**Display:**
- Large, easy-to-read invite code
- Copy to Clipboard button
- Share button (native share on mobile)

**Actions:**
- Copy Invite Code
- Share Invite (generates share text with code)
- Regenerate Code (with confirmation)

### Members List

**Display per Member:**
- Avatar/initial
- Name
- Email
- Role badge (Owner 👑 / Admin / Member)
- Instruments (with icons)
- Actions menu (•••)

**Sort/Filter:**
- By role (Owner, Admin, Member)
- By instrument
- By join date

**Member Actions (Admin Only):**
- Edit Instruments
- Make Admin (owner only)
- Remove Admin (owner only)
- Remove from Band
- Transfer Ownership (owner only)

### Edit Member Instruments Modal

**Current Instruments:**
- List of assigned instruments
- Remove button per instrument

**Add Instrument:**
- Dropdown: Guitar, Bass, Drums, Keys, Vocals, Other
- Proficiency: Beginner / Intermediate / Advanced / Expert
- Set as Primary (checkbox)

**Actions:**
- Save Changes
- Cancel

### Remove Member
**Confirmation Dialog:**
- "Remove [Member Name] from [Band Name]?"
- Warning: "They will lose access to all band content."
- Confirm / Cancel

### Transfer Ownership (Owner Only)
**Confirmation Dialog:**
- "Transfer ownership of [Band Name] to [Member Name]?"
- Warning: "You will become an admin. This cannot be undone."
- Require typing "TRANSFER" to confirm
- Confirm / Cancel

---

## 6. Account Settings Page

### Purpose
Basic user account management.

### Access
- Top-right user menu → "Account Settings"

### Sections

#### Profile
- Display name (editable)
- Email (read-only for now)
- Profile picture (future)

#### Security
- Change password
- Connected accounts (Google, etc.)

#### Preferences
- Theme (Dark / Light) - default Dark
- Email notifications toggle

#### Account Actions
- Log Out
- Delete Account (danger zone, with confirmation)

---

## Authentication Flow

### Sign Up
**Screen: Sign Up Form**
- Email (required)
- Password (required, min 8 chars)
- Confirm Password (required)
- Display Name (required)
- "Create Account" button
- Link to "Already have an account? Log in"

**Post-Signup:**
- User logged in automatically
- Redirect to "Get Started" screen

### Log In
**Screen: Log In Form**
- Email (required)
- Password (required)
- "Log In" button
- "Forgot Password?" link (future)
- Link to "Don't have an account? Sign up"

**Post-Login:**
- If user has bands: Redirect to last-used band's Songs page
- If no bands: Redirect to "Get Started" screen

### Get Started Screen (First-Time Users)
**Display:**
- Welcome message
- "Create Your First Band" card
  - Input: Band Name
  - Button: "Create Band"
- "Join an Existing Band" card
  - Input: Invite Code
  - Button: "Join Band"

**After Creating/Joining:**
- User becomes Owner (if created) or Member (if joined)
- Redirect to band's Songs page
- Show success message with next steps

---

## Create Band Flow

### Trigger Points
1. "Get Started" screen (first-time users)
2. Band Selector → "Create New Band"
3. No bands state (anywhere in app)

### Create Band Modal
**Fields:**
- Band Name (required, min 2 chars)
- Description (optional)

**Process:**
1. User enters band name and submits
2. System creates band with auto-generated ID
3. User automatically added as Owner
4. System generates invite code
5. Redirect to Band Members page
6. Show success message: "Band created! Share this invite code with your bandmates: [CODE]"

---

## Join Band Flow

### Trigger Points
1. "Get Started" screen (first-time users)
2. Band Selector → "Join Band"

### Join Band Modal
**Fields:**
- Invite Code (required, text input)
- Auto-display band name when valid code detected

**Validation:**
- Code exists and is active
- User not already a member

**Process:**
1. User enters code
2. System validates and shows band name
3. User confirms
4. System adds user as Member
5. Redirect to band's Songs page
6. Show success message: "You've joined [Band Name]!"

**Error Messages:**
- "Invalid invite code. Please check and try again."
- "You're already a member of this band."

---

## User Roles & Permissions (MVP)

### Owner (👑)
**Can do everything:**
- All Member and Admin permissions
- Transfer ownership
- Delete band
- Manage admins (promote/demote)

**Restrictions:**
- Cannot leave band without transferring ownership
- Only one owner per band

### Admin
**Permissions:**
- Add/edit/delete songs
- Create/edit/delete setlists
- Schedule/edit/delete shows
- Schedule/edit/delete practices
- Manage members (invite, remove, edit instruments)
- Edit band info
- Generate/regenerate invite codes

**Cannot:**
- Delete band
- Manage other admins
- Transfer ownership

### Member
**Permissions:**
- View all band content
- Add songs
- Create setlists
- Schedule practices
- Edit own instruments
- Leave band

**Cannot:**
- Delete band content created by others
- Manage other members
- Edit band settings
- Generate invite codes

---

## Data Model Reference

### Tables Used in MVP

#### bands
- id, name, description, createdDate

#### users
- id, email, name, createdDate, lastLogin, authProvider

#### userProfiles
- id, userId, displayName, instruments[], primaryInstrument

#### bandMemberships
- id, userId, bandId, role, joinedDate, status

#### inviteCodes
- id, bandId, code, createdBy, createdDate, currentUses, isActive

#### songs
- id, title, artist, album, duration, key, bpm, tuning, tags, notes, contextType, contextId, createdBy, createdDate
- **For MVP:** contextType is always 'band', contextId is bandId

#### setlists
- id, name, bandId, showId (optional), songs[], notes, status, createdDate, lastModified

#### shows (uses practiceSessions table structure)
- id, bandId, name, venue, scheduledDate, duration, location, type: 'gig', status, notes, contacts

#### practiceSessions
- id, bandId, scheduledDate, duration, location, type: 'rehearsal', status, songs[]

---

## UI/UX Guidelines

### Design System
Follow `/workspaces/rock-on/.claude/specifications/2025-10-22T14:01_design-style-guide.md`

**Key Colors:**
- Background: #121212 (Stage Black)
- Cards: #1a1a1a
- Borders: #2a2a2a
- Text: #ffffff (primary), #a0a0a0 (secondary), #707070 (tertiary)
- Primary CTA: #f17827ff (Blue)
- Danger: #D7263D (Amp Red)

### Component Patterns

#### Buttons
- **Primary:** Blue background, white text (e.g., "+ Add Song")
- **Secondary:** Border style, gray text (e.g., "Filter")
- **Danger:** Red background, white text (e.g., "Delete")

#### Cards
- Background: #1a1a1a
- Border: 1px solid #2a2a2a
- Border-radius: 12px
- Padding: 16-20px
- Hover: slight brightness increase

#### Modals
- Centered on desktop
- Full-screen on mobile
- Dark background with semi-transparent overlay
- Clear close button (×)

#### Forms
- Input height: 40-44px
- Border: 2px solid #2a2a2a
- Focus border: blue
- Border-radius: 8px
- Label above input, 8px margin

### Mobile Responsiveness
- **Breakpoint:** 768px
- **Desktop:** Table views with multiple columns
- **Mobile:** Card views with essential info
- **Touch targets:** Minimum 44px
- **Bottom navigation:** Consider for mobile (future)

---

## MVP Feature Checklist

### Authentication ✓
- [ ] Sign up with email/password
- [ ] Log in
- [ ] Log out
- [ ] Basic password requirements

### Band Management ✓
- [ ] Create band
- [ ] Join band via invite code
- [ ] Generate/regenerate invite code
- [ ] View band members
- [ ] Assign member instruments
- [ ] Remove members (admin)
- [ ] Transfer ownership (owner)
- [ ] Leave band

### Songs ✓
- [ ] Add song with required fields
- [ ] Edit song
- [ ] Delete song
- [ ] Search songs
- [ ] Filter by tuning/tags
- [ ] Sort songs

### Setlists ✓
- [ ] Create setlist
- [ ] Edit setlist
- [ ] Add/remove/reorder songs in setlist
- [ ] Associate setlist with show
- [ ] Delete setlist
- [ ] View setlist list

### Shows ✓
- [ ] Schedule show
- [ ] Edit show
- [ ] Associate setlist with show
- [ ] View upcoming shows
- [ ] View past shows
- [ ] Delete show

### Practices ✓
- [ ] Schedule practice
- [ ] Edit practice
- [ ] Add song list to practice
- [ ] Auto-suggest songs from upcoming show
- [ ] View upcoming practices
- [ ] Mark practice as completed
- [ ] Delete practice

### UI/UX ✓
- [ ] Band selector in top-left navbar
- [ ] Primary navigation tabs
- [ ] Responsive design (mobile + desktop)
- [ ] Dark theme
- [ ] Loading states
- [ ] Error handling
- [ ] Success messages
- [ ] Confirmation dialogs

---

## Post-MVP Features (Future)

### Phase 2 - Enhanced Features
- Personal song library (personal context)
- Song confidence rating system
- Practice session execution tracking
- Member attendance tracking
- Dashboard page with overview
- Calendar integration
- Song variant linking
- Advanced filtering and search
- Export/print capabilities

### Phase 3 - Collaboration
- Real-time updates
- Comments/notes on songs
- Member notifications
- In-app messaging
- Activity feed

### Phase 4 - Advanced
- Mobile apps (iOS/Android)
- Audio/video attachments
- Equipment management
- Financial tracking
- Analytics and insights
- Public band profiles
- Integration with Spotify/YouTube APIs

---

## Development Priorities

### Sprint 1: Foundation
1. Authentication (sign up, log in, log out)
2. Band creation and joining
3. Basic member management

### Sprint 2: Content Creation
1. Songs CRUD
2. Setlists CRUD
3. Song-to-setlist assignment

### Sprint 3: Scheduling
1. Shows CRUD
2. Practices CRUD
3. Show-to-setlist linking
4. Practice song suggestions

### Sprint 4: Polish
1. Search and filtering
2. Responsive design
3. Error handling
4. User feedback (toasts, confirmations)
5. Loading states

### Sprint 5: Testing & Deployment
1. End-to-end testing
2. Bug fixes
3. Performance optimization
4. MVP deployment

---

## Success Metrics

### User Activation
- User signs up
- Creates or joins at least 1 band
- Adds at least 3 songs
- Creates at least 1 setlist

### Engagement
- Users log in at least once per week
- Bands with 3+ active members
- Songs added per band per week
- Setlists created per band per month

### Retention
- 7-day retention rate
- 30-day retention rate
- Weekly active users

---

## Technical Notes

### Database
- Use existing schema from `/workspaces/rock-on/.claude/specifications/database-schema.md`
- Ignore unused fields (confidence levels, song structure, etc.)
- Focus on core fields only

### State Management
- Context: Current band (stored in localStorage)
- User session (auth state)
- Form state (local component state)

### Error Handling
- Network errors: Show retry option
- Validation errors: Inline, per-field
- Permission errors: Clear messaging
- 404s: Redirect to appropriate page

### Performance
- Lazy load pages
- Debounce search inputs
- Paginate long lists (50 items per page)
- Cache band data

---

**Document Status:** Active MVP Specification
**Target:** First Deployed Version
**Next Steps:** Begin Sprint 1 - Foundation
**Last Updated:** 2025-10-22T22:59
