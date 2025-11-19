---
timestamp: 2025-10-22T22:28
prompt: "Review existing specifications and create a specification that outlines every section of the app and what functionality should be achievable from each page. Focus on band member management as minimum starting point."
type: specification
status: draft
---

# Rock-On Application Pages & Workflows Specification

## Document Overview
This specification defines all pages/sections in the Rock-On application, their functionality, user flows, and implementation priorities. This document serves as the master reference for building out the complete application UI.

**Priority Focus:** Band Member Management (Phase 1 requirement)

---

## Navigation Structure

### Primary Navigation (Always Available)
1. **Dashboard** - Home overview with quick actions
2. **Songs** - Song library and management
3. **Setlists** - Performance setlist builder
4. **Practices** - Session planning and tracking
5. **Band Members** - Band and member management ⭐ PRIORITY
6. **Profile** - User settings and preferences

### Context Switcher
- Located in header/navbar
- Switches between:
  - Personal context (user's personal songs)
  - Band(s) context (selected band's songs, allows switching bands in the future)
- Displays current context prominently

---

# Page Specifications

## 1. Dashboard Page

### Purpose
Central hub providing overview of user's musical activities, upcoming events, and quick actions.

### Key Sections

#### 1.1 Welcome Banner
- **Content:**
  - Greeting with user name
  - Current band context display
  - Quick context switcher
- **Actions:**
  - Switch between Personal/Band contexts
  - Access profile settings

#### 1.2 Upcoming Events
- **Displays:**
  - Next practice session (date, time, location, link to event and planned songs)
  - Next 3 shows/performances (venue, date, setlist name)
  - Calendar integration status
- **Actions:**
  - View full event details
  - Navigate to full Calendar view
  - Add new event

#### 1.3 Recently Active Songs
- **Displays:**
  - Last 5 practiced songs with confidence levels
  - Days since last practiced
  - Next scheduled performance (if any)
- **Actions:**
  - Click to view song details
  - Quick edit song
  - Add to setlist

#### 1.4 Band Quick Stats (Band Context Only)
- **Displays:**
  - Band member count
  - Total songs in repertoire
  - Active setlists count
  - Upcoming shows count
- **Actions:**
  - Navigate to Bands page
  - View member list
  - Quick invite member

#### 1.5 Quick Actions
- **Buttons:**
  - Add New Song
  - Create Setlist
  - Schedule Practice
  - View All Bands (if multi-band user)

### User Roles & Permissions
- **All Users:** View dashboard, see personal context
- **Band Members:** View band stats, see band events
- **Band Admins:** Access to admin quick actions

### Mobile Considerations
- Cards stack vertically
- Swipe to view more items in lists
- Bottom nav for primary navigation

---

## 2. Songs Page

### Purpose
Comprehensive song library with search, filtering, and management capabilities. Context-aware to show personal or band songs.

### Key Sections

#### 2.1 Page Header
- **Content:**
  - Page title "Songs"
  - Context indicator (Personal / Band Name)
  - Song count badge
- **Actions:**
  - Add New Song (primary CTA)

#### 2.2 Filters & Search Bar
- **Search:**
  - Live search across title, artist, album
  - Search history/suggestions
- **Filters:**
  - Confidence level (1-5 stars)
  - Guitar tuning  
  - Tags/categories
  - Last practiced (date range)
  - Needs practice (alert status)
- **Sort Options:**
  - Alphabetical (title, artist)
  - Recently added
  - Last practiced
  - Confidence level
  - Upcoming show

#### 2.3 Song List/Grid View
- **Desktop Table View:**
  - Song avatar/initials
  - Title & Artist
  - Duration
  - Key & Tuning
  - BPM
  - Next Show
  - Quick actions menu (•••)
- **Mobile Card View:**
  - Compact card per song
  - Essential metadata
  - Swipe actions (edit, delete, add to setlist)

#### 2.4 Song Actions (Per Song)
- **Primary:**
  - View/Edit Song Details
  - Practice Now (log practice)
  - Add to Setlist
  - Update Confidence Level
- **Secondary:**
  - Duplicate Song
  - Link/Variant (create song group)
  - Share Song (within band)
  - Archive/Delete Song
- **Contextual:**
  - Copy to Band (if personal song)
  - Make Personal Copy (if band song)

#### 2.5 Song Detail Modal/Page
- **Tabs:**
  1. **Overview** - Basic info, metadata
  2. **Structure** - Song sections, arrangement
  3. **Lyrics** - Full lyrics with chords
  4. **References** - Links to tabs, YouTube, Spotify
  5. **Practice History** - Log of practice sessions
  6. **Linked Variants** - Related song versions

- **Overview Tab Fields:**
  - Title, Artist, Album
  - Duration, Key, BPM
  - Guitar tuning
  - Difficulty rating (1-5)
  - Current confidence (1-5)
  - Tags/categories
  - Notes/description
  - Created date, Last practiced
  - Context (personal/band)
  - Visibility (private/band_only/public)

- **Actions:**
  - Edit (inline or modal)
  - Save changes
  - Cancel/discard
  - Delete song

#### 2.6 Add New Song Modal
- **Required Fields:**
  - Title
  - Artist
  - Key
  - Context (personal/band selection)
- **Optional Fields:**
  - Album, Duration, BPM
  - Guitar tuning
  - Difficulty, Confidence
  - Tags, Notes
- **Advanced:**
  - Import from URL (future: auto-populate from Spotify/YouTube)
  - Link to existing song (create variant)

### User Roles & Permissions
- **All Users:** View/add personal songs, view band songs
- **Band Members:** Add songs to band context, vote on confidence
- **Band Admins:** Edit/delete any band song, manage visibility

### Data Integration
- **Tables Used:** `songs`, `songGroups`, `songGroupMemberships`, `users`, `bands`
- **Context Filtering:** Filter by `contextType` and `contextId`

---

## 3. Setlists Page

### Purpose
Create, manage, and organize setlists for performances. Drag-and-drop song ordering with performance planning features.

### Key Sections

#### 3.1 Page Header
- **Content:**
  - Page title "Setlists"
  - Context indicator
  - Setlist count by status (Draft, Active, Archived)
- **Actions:**
  - Create New Setlist
  - Filter by status

#### 3.2 Setlist List View
- **Display:**
  - Setlist name
  - Associated show (venue, date)
  - Song count & total duration
  - Status badge (Draft/Active/Archived)
  - Last modified date
- **Actions:**
  - View/Edit setlist
  - Duplicate setlist
  - Print setlist
  - Share setlist
  - Archive/Delete setlist

#### 3.3 Setlist Builder (Edit Mode)
- **Metadata Section:**
  - Setlist name
  - Associated show/event
  - Venue, Date, Expected duration
  - Notes
  - Status

- **Song List Section:**
  - Drag-and-drop reordering
  - Song cards showing:
    - Title, Artist
    - Duration, Key
    - Transition notes
    - Instrument assignments (casting)
  - Running total duration
  - Set break markers

- **Available Songs Panel:**
  - Searchable/filterable song list
  - Click or drag to add to setlist
  - Shows confidence levels
  - Highlights "needs practice" songs

- **Actions:**
  - Add Song
  - Remove Song
  - Reorder Songs
  - Add Set Break
  - Add Encore Section
  - Save Setlist
  - Print/Export

#### 3.4 Instrument Casting (Per Song in Setlist)
- **For Each Song:**
  - Assign band members to instruments
  - Override default assignments
  - Visual indicator of who's playing what
  - Detect conflicts (person playing 2 instruments)
- **Smart Suggestions:**
  - Based on member's default instruments
  - Based on previous casting history
  - Highlight when member plays unusual instrument

#### 3.5 Setlist Performance View
- **Live Mode Features:**
  - Current song highlighted
  - "What's Next" prominent display
  - Quick navigation (prev/next)
  - Mark song as played
  - Add performance notes
  - Timer/stopwatch
  - Full-screen mode

### User Roles & Permissions
- **Band Members:** Create/view setlists, suggest changes
- **Band Admins:** Edit/delete any setlist, finalize performance order

### Data Integration
- **Tables Used:** `setlists`, `songs`, `bandMemberships`, `bands`

---

## 4. Practice Sessions Page

### Purpose
Plan, schedule, and track band practice sessions with attendance, objectives, and progress monitoring.

### Key Sections

#### 4.1 Page Header
- **Content:**
  - Page title "Practice Sessions"
  - Calendar/List view toggle
- **Actions:**
  - Schedule New Session
  - View Calendar

#### 4.2 Session List View
- **Upcoming Sessions:**
  - Date, Time, Duration
  - Location
  - Session type (Rehearsal/Recording/Writing)
  - Attendee count / RSVP status
  - Song count
  - Status (Scheduled/In-Progress/Completed/Cancelled)
- **Past Sessions:**
  - Same info + completion summary
  - Session rating
  - Objectives met count

#### 4.3 Calendar View
- **Features:**
  - Month/Week/Day views
  - Color-coded sessions by type
  - Click date to schedule session
  - Drag to reschedule
  - Integration with Google/Apple Calendar

#### 4.4 Create/Edit Session Modal
- **Basic Info:**
  - Date & Time
  - Duration (default: 2 hours)
  - Location
  - Session Type
  - Description/Notes
- **Songs to Practice:**
  - Add songs from repertoire (suggest songs from next scheduled show)
  - Set focus type (Rehearse/Workshop/Learn)
  - Estimated time per song
  - Running total time
- **Attendees:**
  - Select band members
  - RSVP tracking
  - Send invitations (email/notification)

#### 4.5 Session Execution View (Future Feature)
- **During Practice:**
  - Check-in/attendance tracking
  - Song list with checkboxes
  - Time spent per song
  - Real-time notes per song
  - Session-wide notes
  - Rate practice quality
  - Mark objectives complete
- **Actions:**
  - Start Session
  - Mark Song Complete
  - Add Notes
  - Update Confidence Levels
  - End Session

#### 4.6 Session Summary View (Future Feature)
- **Post-Session:**
  - Attendees list
  - Songs practiced with time spent
  - Objectives met vs planned
  - Overall session rating
  - Notes and improvements
  - Photo/audio attachments
  - Confidence level changes
- **Actions:**
  - Edit summary
  - Share with band
  - Schedule next session

### User Roles & Permissions
- **Band Members:** RSVP, view sessions, add notes during session
- **Band Admins:** Create/edit/cancel sessions, manage attendance

### Data Integration
- **Tables Used:** `practiceSessions`, `songs`, `bandMemberships`, `bands`

---

## 5. Bands Page ⭐ PRIORITY IMPLEMENTATION

### Purpose
Central hub for band management including member roster, invite codes, band settings, and member permissions. This is the MINIMUM REQUIRED functionality to start. Should behave similar to slack for creating new workspaces or editing workspaces.

### Key Sections

#### 5.1 Page Header
- **Content:**
  - Page title "My Bands" or "Band Management"
  - Band count badge
- **Actions:**
  - Create New Band (primary CTA)
  - Join Band (via invite code)

#### 5.2 Band List View (If User in Multiple Bands)
- **Display:**
  - Band card for each band
  - Band name
  - Member count
  - User's role (Owner/Admin/Member)
  - Last activity
  - Quick stats (songs, setlists, upcoming shows)
- **Actions:**
  - View band details
  - Quick switch to band context
  - Leave band (non-owners)

#### 5.3 Band Details Page (Single Band View)

##### 5.3.1 Band Info Section
- **Display:**
  - Band name (editable by admin)
  - Description (editable by admin)
  - Genre/tags
  - Created date
  - Current member count
  - Active status
- **Actions (Admin Only):**
  - Edit Band Info
  - Delete Band (owner only, danger zone)

##### 5.3.2 Invite Code Section (Admin Only)
- **Display:**
  - Current active invite code (large, prominent)
  - Copy to Clipboard button
  - QR Code (future enhancement)
  - Code usage stats (if max uses set)
  - Code expiration (if set)
- **Actions:**
  - Copy Invite Code
  - Share Invite (native share on mobile)
  - Regenerate Code (with confirmation)
  - Set Expiration (optional)
  - Set Max Uses (optional)

##### 5.3.3 Members Section ⭐ CORE FUNCTIONALITY
- **Display List:**
  - Member avatar/initial
  - Member name
  - Email address
  - Role badge (Owner 👑 / Admin / Member)
  - Default instruments (icons + text)
  - Join date
  - Status (Active/Inactive/Pending)

- **Sort/Filter:**
  - By role
  - By instrument
  - By join date
  - Active vs Inactive

- **Per-Member Actions:**
  - **View Profile** (all users)
  - **Edit Instruments** (admin)
  - **Assign Role** (owner only)
    - Make Admin
    - Remove Admin
    - Transfer Ownership (owner only, requires confirmation)
  - **Remove from Band** (admin only, with confirmation)
  - **Send Message** (future)

##### 5.3.4 Member Detail Modal
- **View Mode (All Users):**
  - Full name
  - Email
  - Profile picture
  - Bio
  - All instruments with proficiency levels
  - Join date
  - Contributions (songs added, setlists created)

- **Edit Mode (Admin or Self):**
  - Edit display name (self)
  - Edit instruments (admin or self)
    - Add instrument
    - Set proficiency (Beginner/Intermediate/Advanced/Expert)
    - Set as primary instrument
    - Remove instrument
  - Edit bio (self)
  - Update profile picture (self)

- **Admin-Only Actions:**
  - Assign custom role/title
  - Set band-specific nickname
  - View full activity history
  - Manage permissions

##### 5.3.5 Member Capabilities Matrix (Future Enhancement)
- **Display:**
  - Table with members as rows, instruments as columns
  - Cells show proficiency or checkmark
  - Quick reference for casting decisions
- **Features:**
  - Filter by instrument
  - Highlight gaps in capabilities
  - Export to PDF

##### 5.3.6 Band Settings Section (Admin Only)
- **Settings:**
  - Band name
  - Description
  - Privacy (Private/Public)
  - Default song visibility
  - Notification preferences
  - Member permissions defaults
- **Danger Zone:**
  - Delete Band (owner only)
    - Requires typing band name to confirm
    - Warning: deletes all band songs, setlists, sessions
    - Cannot be undone

#### 5.4 Create New Band Modal
- **Fields:**
  - Band Name (required, min 2 chars)
  - Description (optional)
  - Genre (optional)
- **Process:**
  1. User submits form
  2. System creates band with auto-generated ID
  3. User automatically added as Owner
  4. Invite code auto-generated
  5. Redirect to band details page
  6. Show success message with invite code

#### 5.5 Join Band via Invite Code Modal
- **Fields:**
  - Invite Code (required, text input)
  - Display band name when valid code entered
- **Validation:**
  - Code exists and is active
  - Code not expired (if expiration set)
  - Max uses not exceeded (if limit set)
  - User not already a member
- **Process:**
  1. User enters code
  2. System validates
  3. If valid: Add user as Member, show band details
  4. If invalid: Show error with helpful message
- **Error Messages:**
  - "Invalid invite code. Please check and try again."
  - "This invite code has expired."
  - "You're already a member of this band."
  - "This invite code has reached its usage limit."

#### 5.6 Leave Band Flow
- **Trigger:** User clicks "Leave Band" in band settings
- **Confirmation Modal:**
  - "Are you sure you want to leave [Band Name]?"
  - Warning: "You will lose access to all band songs and setlists."
  - Special case for owners: "You must transfer ownership before leaving."
- **Process:**
  1. User confirms
  2. Remove bandMembership record
  3. User redirected to Bands list
  4. Show success message
  5. User can rejoin with invite code

#### 5.7 Transfer Ownership Flow (Owner Only)
- **Trigger:** Owner clicks "Transfer Ownership" on member
- **Confirmation Modal:**
  - "Transfer ownership of [Band Name] to [Member Name]?"
  - Warning: "You will become an admin. This cannot be undone."
  - Require typing "TRANSFER" to confirm
- **Process:**
  1. Owner confirms
  2. Update new owner's role to 'admin' then 'owner'
  3. Update previous owner's role to 'admin'
  4. Log ownership change
  5. Notify new owner
  6. Show success message

### User Roles & Permissions

#### Owner (👑)
- **Can Do Everything:**
  - Edit band info
  - Delete band
  - Manage all members
  - Promote/demote admins
  - Transfer ownership
  - Generate invite codes
  - View all settings
- **Restrictions:**
  - Cannot leave without transferring ownership
  - Only one owner per band

#### Admin
- **Can:**
  - Edit band info (name, description)
  - Manage members (add, remove, edit instruments)
  - Generate/regenerate invite codes
  - View member details
  - Manage band songs/setlists
- **Cannot:**
  - Delete band
  - Remove other admins
  - Remove owner
  - Transfer ownership
  - Promote to admin

#### Member
- **Can:**
  - View band details
  - View member list
  - Edit own profile/instruments
  - Add songs to band
  - Create setlists
  - Leave band
- **Cannot:**
  - Edit band info
  - Manage other members
  - Generate invite codes
  - Delete band
  - Remove anyone

### Data Integration
- **Tables Used:**
  - `bands` - Band info
  - `users` - User accounts
  - `userProfiles` - Extended user info
  - `bandMemberships` - User-band relationships with roles
  - `inviteCodes` - Band invitation codes

### Mobile Considerations
- **Member List:** Card-based layout, swipe for actions
- **Invite Code:** Large tap target for copy, native share button
- **Modals:** Full-screen on mobile, slide-up panels
- **Actions:** Bottom sheet for member actions

### Implementation Priority

#### Phase 1 - MVP (MUST HAVE) ⭐
1. View band details with member list
2. Display member roles and instruments
3. Edit band name (admin)
4. View/copy invite code (admin)
5. Join band via invite code
6. Leave band (members)
7. Basic member management (add/remove)

#### Phase 2 - Core Features
1. Assign/edit member instruments
2. Remove members (admin)
3. Regenerate invite code
4. Member detail modal with full profile
5. Edit member permissions

#### Phase 3 - Advanced Features
1. Promote/demote admins (owner)
2. Transfer ownership (owner)
3. Delete band (owner)
4. Member capabilities matrix
5. Advanced permissions
6. Notification system

---

## 6. User Profile Page

### Purpose
User account settings, personal preferences, and profile management.

### Key Sections

#### 6.1 Profile Info
- **Display:**
  - Profile picture/avatar
  - Display name
  - Email address
  - Account creation date
  - Last login
- **Edit:**
  - Update display name
  - Upload profile picture
  - Change email (requires verification)
  - Bio/description

#### 6.2 Musical Profile
- **Fields:**
  - Primary instrument
  - All instruments (with proficiency)
  - Skill level (beginner/intermediate/advanced/professional)
  - Musical interests/genres
  - Location

#### 6.3 Bands Overview
- **Display:**
  - List of all bands user is in
  - Role in each band
  - Quick navigation to band details

#### 6.4 Preferences
- **Settings:**
  - Default context (personal vs last used band)
  - Notification preferences
  - Email preferences
  - Calendar integration
  - Theme (dark/light)
  - Language

#### 6.5 Account Management
- **Actions:**
  - Change password
  - Manage connected accounts (Google, etc.)
  - Export user data
  - Delete account (danger zone)

### User Roles & Permissions
- **All Users:** Full access to own profile

---

## 7. Settings/Admin Page (Future)

### Purpose
Application-wide settings and administrative functions.

### Key Sections

#### 7.1 Application Settings
- Theme preferences
- Default views
- Feature flags

#### 7.2 Integrations
- Calendar sync (Google, Apple, Outlook)
- Music services (Spotify, YouTube)
- File storage
- Push notifications

#### 7.3 Data Management
- Export all data
- Import songs (CSV, JSON)
- Backup and restore
- Clear cache

---

## Cross-Page Features

### Context Switching
- **Available In:** All pages (header component)
- **Options:**
  - "Personal" - Shows user's personal songs/data
  - "[Band Name]" - Shows selected band's songs/data
- **Behavior:**
  - Persisted in localStorage
  - Updates page content dynamically
  - Clear visual indicator of current context

### Search (Global)
- **Accessible From:** Header/navbar
- **Searches:**
  - Songs (title, artist, album)
  - Setlists (name, songs)
  - Band members (name, instruments)
  - Practice sessions (date, location)
- **Results:**
  - Grouped by type
  - Click to navigate to item
  - Show context (personal/band)

### Notifications (Future)
- **Types:**
  - Practice session reminders
  - RSVP requests
  - Band member changes
  - Song confidence votes
  - Upcoming shows
- **Delivery:**
  - In-app notification center
  - Email
  - Push notifications (mobile)

---

## User Flows - Priority Scenarios

### Flow 1: New User Creates Band and Invites Members ⭐

1. User logs in for first time
2. Dashboard shows "Create Your First Band"
3. User clicks "Create New Band"
4. Enters band name "The Rock Legends"
5. Submits → Band created with user as Owner
6. Redirect to Band Details page
7. "Getting Started" guide shows:
   - ✅ Band created
   - ⏭️ Invite members
   - ⏭️ Add songs
8. User clicks "Invite Members"
9. Modal shows invite code with Copy button
10. User copies code and shares via text/email
11. Bandmate receives code
12. Bandmate logs in, clicks "Join Band"
13. Enters code → Validated → Added as Member
14. Owner sees notification "John Doe joined The Rock Legends"
15. Owner navigates to Members tab
16. Sees John Doe listed as Member
17. Clicks on John Doe
18. Clicks "Edit Instruments"
19. Adds "Guitar" and "Vocals"
20. Sets "Guitar" as primary with "Advanced" proficiency
21. Saves → John's profile updated
22. Both users can now see each other in Members list

### Flow 2: Admin Manages Band Members

1. Admin navigates to Bands → The Rock Legends
2. Views Members tab (5 members listed)
3. Notices new member "Jane Smith" has no instruments
4. Clicks on Jane Smith
5. Clicks "Edit Instruments"
6. Adds "Drums" as primary, "Expert"
7. Adds "Percussion" as secondary, "Advanced"
8. Saves → Jane's instruments updated
9. Admin scrolls to find inactive member "Bob Johnson"
10. Clicks on Bob Johnson
11. Reviews last activity: "90 days ago"
12. Clicks "Remove from Band"
13. Confirmation: "Remove Bob Johnson from The Rock Legends? He will lose access to all band content."
14. Admin confirms
15. Bob removed, list now shows 4 members
16. Bob receives notification (if enabled)

### Flow 3: Member Edits Own Instruments

1. Member "Sarah" logs in
2. Navigates to Profile page
3. Sees current instruments: "Bass - Intermediate"
4. Clicks "Edit Instruments"
5. Changes Bass proficiency to "Advanced"
6. Adds "Guitar - Beginner"
7. Sets Bass as primary instrument
8. Saves changes
9. Changes reflected in:
   - User profile
   - Band member list
   - Casting suggestions for setlists

---

## Technical Requirements

### Performance
- Page load < 2 seconds on 3G
- Search results < 500ms
- Context switching < 300ms
- Smooth drag-and-drop (60fps)

### Accessibility
- WCAG 2.1 AA compliance
- Keyboard navigation for all features
- Screen reader support
- High contrast mode
- Focus indicators

### Responsive Design
- Mobile-first approach
- Breakpoints: 320px, 768px, 1024px, 1440px
- Touch-friendly targets (44px minimum)
- Swipe gestures on mobile
- Optimized table → card transitions

### Data Validation
- Required field validation
- Email format validation
- Duplicate detection (band names OK, invite codes unique)
- Character limits enforced
- Date/time validation

### Error Handling
- User-friendly error messages
- Retry mechanisms for network failures
- Graceful degradation for offline mode
- Validation errors shown inline
- Success confirmations for destructive actions

---

## Success Metrics

### User Engagement
- Daily active users
- Songs added per user per week
- Setlists created per band per month
- Practice sessions logged per month

### Feature Adoption
- % of users in at least one band
- % of bands with 3+ members
- Invite code usage rate
- Member instrument completion rate

### Technical Performance
- Page load times
- Error rates
- API response times
- Search performance

---

## Future Enhancements

### Short-Term (Next 3 Months)
1. Calendar integration (Google, Apple)
2. Push notifications
3. Advanced member permissions
4. Bulk song operations
5. Export/print capabilities

### Medium-Term (3-6 Months)
1. Real-time collaboration features
2. Voice memo recording
3. Video practice recordings
4. Equipment management
5. Financial tracking

### Long-Term (6+ Months)
1. Public band profiles
2. Social features (follow bands)
3. Marketplace (find bands, gigs)
4. Advanced analytics and reporting
5. AI-powered practice recommendations
6. Music notation integration

---

## Appendix

### Database Tables Reference
See `/workspaces/rock-on/.claude/specifications/database-schema.md` for complete schema.

### Design Guidelines
See `/workspaces/rock-on/.claude/specifications/2025-10-22T14:01_design-style-guide.md` for visual design specs.

### User Flows
See `/workspaces/rock-on/.claude/artifacts/2025-10-22T00:51_band-management-userflows.md` for detailed workflows.

---

**Document Status:** Draft - Ready for Review
**Next Steps:** Review and modify this specification, then begin Phase 1 Band Management implementation
**Owner:** Development Team
**Last Updated:** 2025-10-22T22:28
