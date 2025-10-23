---
phase: Phase 2 - Database Integration
priority: critical
started: 2025-10-23
status: in-progress
dependencies:
  - Version 5 database schema
  - All MVP page mockups complete
references:
  - /workspaces/rock-on/.claude/specifications/database-schema.md
  - /workspaces/rock-on/.claude/specifications/2025-10-22T22:59_functional-mvp-spec.md
  - /workspaces/rock-on/.claude/artifacts/2025-10-23T04:33_version-5-schema-implementation-complete.md
  - /workspaces/rock-on/.claude/artifacts/2025-10-23T04:21_mvp-database-schema-mapping.md
  - /workspaces/rock-on/src/database/seedMvpData.ts
page-instructions:
  - /workspaces/rock-on/.claude/instructions/mvp-auth-pages.md
  - /workspaces/rock-on/.claude/instructions/mvp-band-members-page.md
  - /workspaces/rock-on/.claude/instructions/mvp-songs-page.md
  - /workspaces/rock-on/.claude/instructions/mvp-setlists-page.md
  - /workspaces/rock-on/.claude/instructions/mvp-shows-page.md
  - /workspaces/rock-on/.claude/instructions/mvp-practices-page.md
---

# MVP Phase 2: Database Integration

## Overview

**Goal:** Replace all mock data in `/src/pages/NewLayout/*` pages with real database operations using Version 5 schema.

**Current State:**
- ✅ All 6 MVP pages built with mock data under `/new-layout` route
- ✅ Version 5 database schema implemented with proper support for breaks/sections/show metadata
- ✅ Comprehensive seed data script created (`/src/database/seedMvpData.ts`)
- ✅ TypeScript interfaces updated for SetlistItem and show metadata

**Target State:**
- Replace old UI (root routes) with new `/new-layout` pages
- Wire all pages to IndexedDB via Dexie
- Full CRUD operations functional
- User authentication integrated
- Role-based permissions enforced

---

## 🎯 Agent Instructions

### Before You Start:
1. **Read the page-specific instructions** (mvp-*-page.md) to understand UI requirements
2. **Review database schema** at `/workspaces/rock-on/.claude/specifications/database-schema.md`
3. **Check seed data structure** at `/workspaces/rock-on/src/database/seedMvpData.ts`
4. **Import database** from `/workspaces/rock-on/src/services/database/index.ts`

### As You Work:
1. **Update checkboxes** in this file as you complete each task
2. **Test your changes** using Chrome MCP tool after each task
3. **Validate functionality** - don't just check for errors, actually test the feature works
4. **Mark task complete** only after validation passes

### Testing Protocol:
After completing each task:

```javascript
// 1. Open Chrome MCP tool
// 2. Navigate to the page: http://localhost:5174/new-layout/{page-name}
// 3. Test the specific feature you just implemented
// 4. Verify data loads from database
// 5. Test CRUD operations (Create, Read, Update, Delete)
// 6. Check console for errors
// 7. Verify responsive design (desktop + mobile)
```

**Example Test Commands:**
```javascript
// Test Songs page - verify songs load
await db.songs.toArray()  // Should return array of songs

// Test create operation
const newSong = await db.songs.add({ title: 'Test Song', ... })

// Test update operation
await db.songs.update(songId, { title: 'Updated Title' })

// Test delete operation
await db.songs.delete(songId)
```

---

## 📋 Phase 2 Tasks

### ⚙️ Setup & Preparation

#### Task 1: Database Initialization
- [ ] 1.1. Import `seedMvpData` function in app initialization (src/main.tsx or App.tsx)
- [ ] 1.2. Add conditional seed for development mode: `if (import.meta.env.DEV) { seedMvpData() }`
- [ ] 1.3. Clear existing database: Run in console: `indexedDB.deleteDatabase('RockOnDB'); location.reload()`
- [ ] 1.4. Verify seed data loads successfully in console
- [ ] 1.5. **VALIDATE:** Check database in DevTools → Application → IndexedDB → RockOnDB
  - Users: 3 entries (Eric, Mike, Sarah)
  - Bands: 1 entry (iPod Shuffle)
  - Songs: 17 entries
  - Setlists: 4 entries
  - Shows (practiceSessions type='gig'): 5 entries
  - Practices (practiceSessions type='rehearsal'): 5 entries

#### Task 2: Create Utility Functions
- [ ] 2.1. Create `/src/utils/formatters.ts` with helper functions:
  - `durationToSeconds(duration: string): number` - Convert "3:14" → 194
  - `secondsToDuration(seconds: number): string` - Convert 194 → "3:14"
  - `centsToDollars(cents: number): string` - Convert 50000 → "$500.00"
  - `dollarsToCents(dollars: string): number` - Convert "$500" → 50000
- [ ] 2.2. Create `/src/utils/dateHelpers.ts` with date functions:
  - `formatShowDate(date: Date): string` - Format for display
  - `parseTime12Hour(time: string): Date` - Parse "8:00 PM" to Date
  - `formatTime12Hour(date: Date): string` - Format Date to "8:00 PM"
- [ ] 2.3. **VALIDATE:** Write unit tests or manual tests for each formatter function

#### Task 3: Create Database Service Hooks
- [ ] 3.1. Create `/src/hooks/useSongs.ts` with:
  - `useSongs(bandId: string)` - Fetch songs for band
  - `useCreateSong()` - Create new song
  - `useUpdateSong()` - Update song
  - `useDeleteSong()` - Delete song
- [ ] 3.2. Create `/src/hooks/useSetlists.ts` with CRUD hooks
- [ ] 3.3. Create `/src/hooks/useShows.ts` with CRUD hooks (filter type='gig')
- [ ] 3.4. Create `/src/hooks/usePractices.ts` with CRUD hooks (filter type='rehearsal')
- [ ] 3.5. Create `/src/hooks/useBands.ts` with band and membership hooks
- [ ] 3.6. **VALIDATE:** Test each hook in browser console

---

### 🎵 Sprint 1: Authentication & Band Management

**Reference Instructions:**
- `/workspaces/rock-on/.claude/instructions/mvp-auth-pages.md`
- `/workspaces/rock-on/.claude/instructions/mvp-band-members-page.md`

#### Task 4: Authentication Pages (AuthPages.tsx)
- [ ] 4.1. Wire up Sign Up form to create user in `db.users` and `db.userProfiles`
- [ ] 4.2. Wire up Log In form to query `db.users` by email
- [ ] 4.3. Implement Get Started flow:
  - Create band → `db.bands`
  - Add user as owner → `db.bandMemberships` with role='owner'
  - Join band via code → lookup `db.inviteCodes`, add membership
- [ ] 4.4. Store authenticated user ID in localStorage or context
- [ ] 4.5. Store current bandId in localStorage or context
- [ ] 4.6. **VALIDATE with Chrome MCP:**
  - Navigate to http://localhost:5174/new-layout/auth
  - Sign up new user → verify user created in db.users
  - Log in as Eric (eric@ipodshuffle.com) → verify authentication
  - Create new band → verify band in db.bands
  - Join band with code ROCK2024 → verify membership in db.bandMemberships

#### Task 5: Band Members Page (BandMembersPage.tsx)
- [ ] 5.1. Load current band info from `db.bands.get(bandId)`
- [ ] 5.2. Load band members from `db.bandMemberships.where('bandId').equals(bandId)`
- [ ] 5.3. Load user profiles for each member from `db.userProfiles`
- [ ] 5.4. Display invite code from `db.inviteCodes.where('bandId').equals(bandId).and(code => code.isActive)`
- [ ] 5.5. Wire up "Generate New Code" → create new code in `db.inviteCodes`
- [ ] 5.6. Wire up edit instruments → update `db.userProfiles.instruments`
- [ ] 5.7. Wire up remove member → delete from `db.bandMemberships`
- [ ] 5.8. Wire up role changes (make admin/remove admin) → update `db.bandMemberships.role`
- [ ] 5.9. Implement transfer ownership flow
- [ ] 5.10. **VALIDATE with Chrome MCP:**
  - Navigate to http://localhost:5174/new-layout/band-members
  - Verify iPod Shuffle band info displays
  - Verify 3 members show (Eric, Mike, Sarah)
  - Copy invite code → verify it's ROCK2024
  - Edit Mike's instruments → verify saves to database
  - Remove Sarah → verify removed from db.bandMemberships

---

### 🎸 Sprint 2: Songs & Setlists

**Reference Instructions:**
- `/workspaces/rock-on/.claude/instructions/mvp-songs-page.md`
- `/workspaces/rock-on/.claude/instructions/mvp-setlists-page.md`

#### Task 6: Songs Page (SongsPage.tsx) - Data Loading
- [ ] 6.1. Load songs from `db.songs.where('contextType').equals('band').and(s => s.contextId === bandId)`
- [ ] 6.2. Convert duration from database (seconds) to display format ("3:14") using `secondsToDuration()`
- [ ] 6.3. Convert BPM from database (number) to display format ("104 bpm")
- [ ] 6.4. Load "Next Show" for each song by:
  - Query setlists containing song (`db.setlists` where `items` array contains songId)
  - Query shows linked to those setlists (`db.practiceSessions` where type='gig' and `setlistId` matches)
  - Find nearest upcoming show (scheduledDate > now)
- [ ] 6.5. Implement search functionality (filter by title, artist, album)
- [ ] 6.6. Implement filter by tuning, tags, show
- [ ] 6.7. Implement sort (title, artist, date added)
- [ ] 6.8. **VALIDATE with Chrome MCP:**
  - Navigate to http://localhost:5174/new-layout/songs
  - Verify 17 songs load from database
  - Verify "All Star" shows duration "3:14" and BPM "104 bpm"
  - Search "Hotel" → verify filters to Hotel California
  - Filter by tuning "Standard" → verify correct songs show
  - Verify "Next Show" displays "Toys 4 Tots" for songs in that setlist

#### Task 7: Songs Page (SongsPage.tsx) - CRUD Operations
- [ ] 7.1. Wire up Add Song modal to create in `db.songs` with:
  - Convert duration from "3:14" → seconds using `durationToSeconds()`
  - Convert BPM from string → number
  - Set contextType='band', contextId=bandId
  - Set createdBy=currentUserId
  - Set visibility='band_only'
- [ ] 7.2. Wire up Edit Song modal to update in `db.songs.update()`
- [ ] 7.3. Wire up Delete Song to:
  - Remove from `db.songs.delete()`
  - Remove from any setlists (update setlist.items arrays)
  - Show warning if song is in setlists
- [ ] 7.4. Wire up Duplicate Song → create copy with new ID
- [ ] 7.5. **VALIDATE with Chrome MCP:**
  - Add new song "Test Song" → verify created in db.songs
  - Edit "Test Song" title → verify updates in database
  - Duplicate "All Star" → verify copy created
  - Delete "Test Song" → verify removed from database
  - Try to delete "All Star" → verify warning about setlists

#### Task 8: Setlists Page (SetlistsPage.tsx) - Data Loading
- [ ] 8.1. Load setlists from `db.setlists.where('bandId').equals(bandId)`
- [ ] 8.2. For each setlist, load associated show data:
  - If setlist.showId exists, load from `db.practiceSessions.get(showId)`
  - Display show name and date
- [ ] 8.3. For each song item in setlist.items:
  - Load full song data from `db.songs.get(item.songId)`
  - Display avatar, title, artist, duration, key, tuning
- [ ] 8.4. Calculate total duration from all song durations + break durations
- [ ] 8.5. Display breaks with inline editable duration and notes
- [ ] 8.6. Display section markers with titles
- [ ] 8.7. **VALIDATE with Chrome MCP:**
  - Navigate to http://localhost:5174/new-layout/setlists
  - Verify 4 setlists load (Toys 4 Tots, New Year's Eve, Summer Festival, New Songs)
  - Click "Toys 4 Tots" setlist → verify shows 15 items
  - Verify break shows "15 min - Quick break"
  - Verify section shows "Acoustic Set"
  - Verify associated show displays "Toys 4 Tots Benefit Concert"

#### Task 9: Setlists Page (SetlistsPage.tsx) - CRUD Operations
- [ ] 9.1. Wire up Create Setlist:
  - Create in `db.setlists` with empty items array
  - Set bandId, status='draft'
  - Generate UUID for id
- [ ] 9.2. Wire up Add Song to Setlist:
  - Add new SetlistItem to items array with type='song'
  - Assign position number (max + 1)
  - Update setlist in database
- [ ] 9.3. Wire up Add Break:
  - Add new SetlistItem with type='break'
  - Include breakDuration and breakNotes fields
- [ ] 9.4. Wire up Add Section:
  - Add new SetlistItem with type='section'
  - Include sectionTitle field
- [ ] 9.5. Wire up Drag-and-Drop reordering:
  - Update position numbers in items array
  - Save to database with `db.setlists.update()`
- [ ] 9.6. Wire up Edit inline notes (per-song notes in setlist)
- [ ] 9.7. Wire up Edit break duration/notes inline
- [ ] 9.8. Wire up Remove item from setlist
- [ ] 9.9. Wire up Delete setlist → `db.setlists.delete()`
- [ ] 9.10. Wire up Duplicate setlist
- [ ] 9.11. Wire up Associate with show → set showId field
- [ ] 9.12. **VALIDATE with Chrome MCP:**
  - Create new setlist "Test Setlist" → verify in database
  - Add "All Star" to setlist → verify item added to items array
  - Add break "15 min - Rest" → verify break item created
  - Add section "Rock Set" → verify section item created
  - Drag songs to reorder → verify positions update in database
  - Edit song notes inline → verify saves
  - Edit break duration → verify saves
  - Remove song from setlist → verify item removed
  - Delete "Test Setlist" → verify removed from database

---

### 🎤 Sprint 3: Shows & Practices

**Reference Instructions:**
- `/workspaces/rock-on/.claude/instructions/mvp-shows-page.md`
- `/workspaces/rock-on/.claude/instructions/mvp-practices-page.md`

#### Task 10: Shows Page (ShowsPage.tsx) - Data Loading
- [ ] 10.1. Load shows from `db.practiceSessions.where('bandId').equals(bandId).and(s => s.type === 'gig')`
- [ ] 10.2. Filter upcoming shows (scheduledDate >= now) and past shows separately
- [ ] 10.3. For each show, load associated setlist if setlistId exists:
  - Load from `db.setlists.get(show.setlistId)`
  - Display setlist name
- [ ] 10.4. Display show metadata:
  - name, venue, scheduledDate, duration
  - location, loadInTime, soundcheckTime
  - payment (convert cents → dollars using `centsToDollars()`)
  - contacts, status, notes
- [ ] 10.5. Format times using 12-hour format ("8:00 PM")
- [ ] 10.6. Sort shows by scheduledDate (ascending for upcoming, descending for past)
- [ ] 10.7. **VALIDATE with Chrome MCP:**
  - Navigate to http://localhost:5174/new-layout/shows
  - Verify 3 upcoming shows display (Toys 4 Tots, New Year's, Summer Fest)
  - Verify 2 past shows display (Halloween, Spring Fling)
  - Verify "Toys 4 Tots" shows:
    - Venue: The Crocodile
    - Load-in: 6:00 PM
    - Soundcheck: 7:00 PM
    - Payment: $500.00
    - Setlist: "Toys 4 Tots Benefit Set"

#### Task 11: Shows Page (ShowsPage.tsx) - CRUD Operations
- [ ] 11.1. Wire up Create Show (Schedule Show modal):
  - Create in `db.practiceSessions` with type='gig'
  - Set bandId, scheduledDate, duration
  - Set show-specific fields: name, venue, location
  - Convert payment from dollars → cents using `dollarsToCents()`
  - Set loadInTime, soundcheckTime, contacts
  - Set status='scheduled' by default
- [ ] 11.2. Wire up Edit Show → update all fields
- [ ] 11.3. Wire up Associate Setlist → set setlistId field
- [ ] 11.4. Wire up Change Status (scheduled/confirmed/completed/cancelled)
- [ ] 11.5. Wire up Delete Show → `db.practiceSessions.delete()`
- [ ] 11.6. **VALIDATE with Chrome MCP:**
  - Create new show "Test Concert" → verify in database with type='gig'
  - Set payment "$750" → verify saves as 75000 cents in database
  - Set load-in time "5:00 PM" → verify saves correctly
  - Associate with setlist → verify setlistId set
  - Change status to "confirmed" → verify updates
  - Delete "Test Concert" → verify removed from database

#### Task 12: Practices Page (PracticesPage.tsx) - Data Loading
- [ ] 12.1. Load practices from `db.practiceSessions.where('bandId').equals(bandId).and(p => p.type === 'rehearsal')`
- [ ] 12.2. Filter upcoming practices (scheduledDate >= now) and past practices
- [ ] 12.3. For each practice, load songs from songs array:
  - For each song in practice.songs, load from `db.songs.get(song.songId)`
  - Display song list with count
- [ ] 12.4. Display practice details:
  - scheduledDate, duration, location, status, notes
- [ ] 12.5. Format times using 12-hour format
- [ ] 12.6. Sort by scheduledDate
- [ ] 12.7. **VALIDATE with Chrome MCP:**
  - Navigate to http://localhost:5174/new-layout/practices
  - Verify 2 upcoming practices display
  - Verify 3 past practices display
  - Verify practice shows song count "8 songs to practice"
  - Verify practice location "Mike's Garage" displays

#### Task 13: Practices Page (PracticesPage.tsx) - CRUD & Auto-Suggest
- [ ] 13.1. Wire up Create Practice:
  - Create in `db.practiceSessions` with type='rehearsal'
  - Set bandId, scheduledDate, duration, location
  - Initialize empty songs array
  - Set status='scheduled'
- [ ] 13.2. Wire up Add Songs to Practice:
  - Add SessionSong objects to songs array
  - Include songId, initialize timeSpent=0, status='not-started'
- [ ] 13.3. Implement Auto-Suggest from Upcoming Shows:
  - Query upcoming shows (type='gig', scheduledDate >= now)
  - For each show, get associated setlist
  - Extract songs from setlist.items
  - Present as suggestions when creating practice
- [ ] 13.4. Wire up Edit Practice → update fields
- [ ] 13.5. Wire up Mark as Completed → set status='completed'
- [ ] 13.6. Wire up Delete Practice → `db.practiceSessions.delete()`
- [ ] 13.7. **VALIDATE with Chrome MCP:**
  - Create new practice for today 7 PM → verify in database with type='rehearsal'
  - Click "Add songs from upcoming show" → verify suggests songs from Toys 4 Tots setlist
  - Add 5 songs to practice → verify songs array populated
  - Mark practice as completed → verify status updates
  - Delete practice → verify removed from database

---

### 🔗 Sprint 4: Cross-Page Integration & Polish

#### Task 14: Navigation & Routing Updates
- [ ] 14.1. Update App.tsx routing to use new pages as primary routes:
  - `/songs` → SongsPage
  - `/setlists` → SetlistsPage
  - `/shows` → ShowsPage
  - `/practices` → PracticesPage
  - `/band-members` → BandMembersPage
  - `/auth` → AuthPages
- [ ] 14.2. Remove or redirect old routes to new pages
- [ ] 14.3. Update navigation menu links
- [ ] 14.4. **VALIDATE with Chrome MCP:**
  - Navigate to http://localhost:5174/songs (without /new-layout)
  - Verify redirects to new SongsPage
  - Test all navigation links work

#### Task 15: Context/State Management
- [ ] 15.1. Create AuthContext with:
  - currentUser
  - currentBand
  - isAuthenticated
  - login(), logout(), switchBand()
- [ ] 15.2. Create BandContext or use AuthContext for:
  - currentBandId
  - currentUserRole (owner/admin/member)
- [ ] 15.3. Wrap app with context providers
- [ ] 15.4. Update all pages to use context instead of localStorage directly
- [ ] 15.5. **VALIDATE with Chrome MCP:**
  - Log in as Eric → verify context updates
  - Check currentUser in React DevTools
  - Switch bands (if multiple) → verify context updates

#### Task 16: Role-Based Permissions
- [ ] 16.1. Implement permission checks in Band Members page:
  - Only owner/admin can edit members
  - Only owner can transfer ownership
  - Members can only view
- [ ] 16.2. Implement permission checks in Songs page:
  - Owner/admin can delete songs
  - Members can add songs
- [ ] 16.3. Implement permission checks in Setlists page:
  - Owner/admin can delete setlists
  - All members can create/edit
- [ ] 16.4. Implement permission checks in Shows/Practices:
  - Owner/admin can delete
  - All members can create/edit
- [ ] 16.5. Hide action buttons based on role
- [ ] 16.6. **VALIDATE with Chrome MCP:**
  - Log in as Eric (owner) → verify can delete songs
  - Log in as Sarah (member) → verify cannot delete songs
  - Verify delete button hidden for member role

#### Task 17: Error Handling & Loading States
- [ ] 17.1. Add try-catch blocks around all database operations
- [ ] 17.2. Display error messages in toast notifications
- [ ] 17.3. Add loading spinners for data fetching
- [ ] 17.4. Add skeleton loaders for lists
- [ ] 17.5. Handle empty states gracefully
- [ ] 17.6. Add form validation errors inline
- [ ] 17.7. **VALIDATE with Chrome MCP:**
  - Disconnect network → verify error messages show
  - Wait for slow load → verify loading states appear
  - Submit invalid form → verify validation errors show

#### Task 18: Data Consistency & Relationships
- [ ] 18.1. When deleting song, remove from all setlists:
  - Query setlists containing song
  - Update items arrays to remove song items
  - Show confirmation with warning
- [ ] 18.2. When deleting setlist, clear showId references:
  - Query shows with this setlistId
  - Set setlistId to null
- [ ] 18.3. When deleting show, handle setlist association:
  - Clear setlist.showId if it points to this show
- [ ] 18.4. When member leaves band:
  - Remove from bandMemberships
  - Handle orphaned data (keep songs/setlists but mark as created by [deleted user])
- [ ] 18.5. **VALIDATE with Chrome MCP:**
  - Delete song that's in setlist → verify setlist updates
  - Delete setlist → verify show's setlistId clears
  - Delete show → verify setlist's showId clears

---

### 🧪 Sprint 5: Testing & Validation

#### Task 19: End-to-End User Flows
- [ ] 19.1. **Complete User Journey Test:**
  - [ ] Sign up new user
  - [ ] Create new band
  - [ ] Add 5 songs
  - [ ] Create setlist with songs + break + section
  - [ ] Schedule show with setlist
  - [ ] Schedule practice with auto-suggested songs
  - [ ] Verify all data persists across page refreshes
- [ ] 19.2. **VALIDATE with Chrome MCP:**
  - Execute full user journey above
  - Check database at each step
  - Verify no console errors
  - Test on both desktop and mobile viewports

#### Task 20: CRUD Operations Testing
- [ ] 20.1. Test Songs CRUD:
  - [ ] Create 3 songs with different tunings/keys
  - [ ] Edit song details
  - [ ] Duplicate song
  - [ ] Delete song
  - [ ] Search and filter
- [ ] 20.2. Test Setlists CRUD:
  - [ ] Create setlist
  - [ ] Add 10 songs
  - [ ] Add 2 breaks
  - [ ] Add 2 sections
  - [ ] Reorder with drag-drop
  - [ ] Edit inline notes
  - [ ] Delete setlist
- [ ] 20.3. Test Shows CRUD:
  - [ ] Create show with all metadata
  - [ ] Associate setlist
  - [ ] Edit show details
  - [ ] Change status
  - [ ] Delete show
- [ ] 20.4. Test Practices CRUD:
  - [ ] Create practice
  - [ ] Use auto-suggest from show
  - [ ] Add manual songs
  - [ ] Mark complete
  - [ ] Delete practice
- [ ] 20.5. **VALIDATE with Chrome MCP:**
  - Execute all CRUD operations above
  - Verify data persists correctly
  - Check for any data corruption

#### Task 21: Edge Cases & Error Scenarios
- [ ] 21.1. Test with empty database (no seed data)
- [ ] 21.2. Test with single user, single band
- [ ] 21.3. Test with multiple bands (switch between)
- [ ] 21.4. Test with no songs (empty state)
- [ ] 21.5. Test with very long setlist (100+ songs)
- [ ] 21.6. Test with special characters in names (emojis, unicode)
- [ ] 21.7. Test with past dates (completed shows/practices)
- [ ] 21.8. Test deleting items with dependencies
- [ ] 21.9. **VALIDATE with Chrome MCP:**
  - Test each edge case above
  - Document any issues found
  - Fix critical bugs

#### Task 22: Performance & Optimization
- [ ] 22.1. Profile page load times with React DevTools
- [ ] 22.2. Optimize queries with indexes (already in schema)
- [ ] 22.3. Implement pagination for songs list (if > 50 songs)
- [ ] 22.4. Debounce search inputs (300ms)
- [ ] 22.5. Memoize expensive computations (setlist durations)
- [ ] 22.6. Lazy load modals/dialogs
- [ ] 22.7. **VALIDATE with Chrome MCP:**
  - Measure page load times
  - Test with 100+ songs
  - Verify smooth performance

#### Task 23: Responsive Design Testing
- [ ] 23.1. Test all pages at mobile viewport (375px width)
- [ ] 23.2. Test all pages at tablet viewport (768px width)
- [ ] 23.3. Test all pages at desktop viewport (1920px width)
- [ ] 23.4. Verify touch targets >= 44px on mobile
- [ ] 23.5. Test modals on mobile (should be full-screen)
- [ ] 23.6. Test tables collapse to cards on mobile
- [ ] 23.7. **VALIDATE with Chrome MCP:**
  - Use device toolbar to test viewports
  - Test all interactive elements on mobile
  - Verify no horizontal scroll

---

## ✅ Completion Checklist

### Phase 2 is Complete When:

**Database Integration:**
- [ ] All pages load data from IndexedDB (no mock data)
- [ ] All CRUD operations functional
- [ ] Seed data script working
- [ ] Database persists across refreshes

**Authentication & Authorization:**
- [ ] Users can sign up and log in
- [ ] Users can create/join bands
- [ ] Current user and band stored in context
- [ ] Role-based permissions enforced

**Songs & Library:**
- [ ] Songs CRUD operations working
- [ ] Search and filter functional
- [ ] Duration/BPM conversions correct
- [ ] "Next Show" displays correctly

**Setlists:**
- [ ] Setlists CRUD operations working
- [ ] Breaks and sections supported
- [ ] Drag-and-drop reordering works
- [ ] Show associations functional
- [ ] Total duration calculation correct

**Shows & Practices:**
- [ ] Shows CRUD with full metadata
- [ ] Practices CRUD with song lists
- [ ] Show-setlist linking works
- [ ] Auto-suggest from shows works
- [ ] Payment conversion (cents/dollars) correct

**Quality & Polish:**
- [ ] No console errors
- [ ] Loading states implemented
- [ ] Error handling in place
- [ ] Responsive design verified
- [ ] Cross-page navigation works
- [ ] Data relationships maintained

**Testing:**
- [ ] End-to-end user journey tested
- [ ] All CRUD operations tested
- [ ] Edge cases handled
- [ ] Performance acceptable
- [ ] Mobile experience smooth

---

## 📚 Reference Documents

### Primary Specifications:
1. **Database Schema:** `/workspaces/rock-on/.claude/specifications/database-schema.md`
   - Version 5 schema details
   - Table definitions
   - Field types and indexes
   - Migration notes

2. **Functional MVP Spec:** `/workspaces/rock-on/.claude/specifications/2025-10-22T22:59_functional-mvp-spec.md`
   - Feature requirements
   - User flows
   - Data models
   - Success criteria

3. **Schema Mapping:** `/workspaces/rock-on/.claude/artifacts/2025-10-23T04:21_mvp-database-schema-mapping.md`
   - Page-to-database mappings
   - Field conversions needed
   - Type transformations

4. **Schema Implementation:** `/workspaces/rock-on/.claude/artifacts/2025-10-23T04:33_version-5-schema-implementation-complete.md`
   - Version 5 changes
   - SetlistItem structure
   - Show metadata fields
   - Seed data details

### Page-Specific Instructions:
1. **Auth:** `/workspaces/rock-on/.claude/instructions/mvp-auth-pages.md`
2. **Band Members:** `/workspaces/rock-on/.claude/instructions/mvp-band-members-page.md`
3. **Songs:** `/workspaces/rock-on/.claude/instructions/mvp-songs-page.md`
4. **Setlists:** `/workspaces/rock-on/.claude/instructions/mvp-setlists-page.md`
5. **Shows:** `/workspaces/rock-on/.claude/instructions/mvp-shows-page.md`
6. **Practices:** `/workspaces/rock-on/.claude/instructions/mvp-practices-page.md`

### Code References:
- Database service: `/workspaces/rock-on/src/services/database/index.ts`
- Seed data: `/workspaces/rock-on/src/database/seedMvpData.ts`
- Type definitions: `/workspaces/rock-on/src/types/index.ts`
- Model interfaces: `/workspaces/rock-on/src/models/*.ts`

---

## 🐛 Troubleshooting

### Common Issues:

**Database not found:**
```typescript
// Make sure importing from correct location
import { db } from '../services/database'  // ✅ Correct
import { db } from '../database/db'        // ❌ Deprecated
```

**Data not showing:**
```typescript
// Check if seed data loaded
await db.songs.count()  // Should return 17

// Check context filtering
const songs = await db.songs
  .where('contextType').equals('band')
  .and(s => s.contextId === currentBandId)
  .toArray()
```

**Type mismatches:**
```typescript
// Use formatter functions
import { durationToSeconds, secondsToDuration } from '@/utils/formatters'

// When saving to database
const song = {
  duration: durationToSeconds("3:14")  // Convert to number
}

// When displaying
const displayDuration = secondsToDuration(song.duration)  // Convert to string
```

**Setlist items not displaying:**
```typescript
// Check items structure
console.log(setlist.items)  // Should be array of SetlistItem objects

// Verify song IDs valid
for (const item of setlist.items) {
  if (item.type === 'song') {
    const song = await db.songs.get(item.songId)
    console.log('Song:', song)
  }
}
```

**Shows not linking to setlists:**
```typescript
// Check setlistId is set
console.log(show.setlistId)  // Should be UUID string

// Verify setlist exists
const setlist = await db.setlists.get(show.setlistId)
console.log('Linked setlist:', setlist)
```

---

## 🎯 Success Metrics

**Phase 2 is successful when:**
1. ✅ All 6 pages load real data from database
2. ✅ Full user journey works end-to-end
3. ✅ CRUD operations persist data correctly
4. ✅ No mock data remains in codebase
5. ✅ Authentication and roles enforced
6. ✅ Cross-page features work (auto-suggest, etc.)
7. ✅ Performance is smooth on typical hardware
8. ✅ Mobile experience is polished
9. ✅ No critical bugs remain
10. ✅ Ready for user testing

---

**Last Updated:** 2025-10-23
**Status:** In Progress - Ready to begin Task 1
**Next Milestone:** Complete Setup & Preparation (Tasks 1-3)

