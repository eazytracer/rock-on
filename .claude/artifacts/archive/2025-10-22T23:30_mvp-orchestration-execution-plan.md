---
timestamp: 2025-10-22T23:30
prompt: "Orchestrate the parallel development of Rock-On MVP across 6 page components using specialized React developer agents, coordinating sprints, dependencies, and integration"
type: orchestration-plan
status: executing
---

# Rock-On MVP Build Orchestration Plan

## Executive Summary

This document outlines the comprehensive orchestration strategy for building the Rock-On MVP - a complete band management application across 6 main page components. The strategy utilizes parallel development workflows through intelligent sub-agent delegation while managing dependencies and ensuring design consistency.

**Orchestrator:** Development Project Orchestrator (DPO)
**Target Delivery:** Complete MVP with all 6 pages functional
**Approach:** Sprint-based parallel development with validation gates

---

## Project Context

### Scope
- 6 main page components (Auth, Band Members, Songs, Setlists, Shows, Practices)
- Full CRUD operations for all entities
- Role-based permissions system
- Responsive design (mobile + desktop)
- Orange (#f17827ff) primary color throughout
- Dark theme (#121212 background)

### Critical Design Requirements
- **Primary Color:** #f17827ff (Orange) - NOT blue (major design change from previous mockups)
- **Design System:** Follow NewLayout.tsx reference exactly
- **Responsive:** Mobile-first with card views, desktop with tables
- **Database:** Dexie.js (IndexedDB) with existing schema
- **Context:** All content is band-scoped in MVP

---

## Dependency Analysis

### Dependency Graph
```
Sprint 1 (Foundation)
├── Auth Pages [NO DEPENDENCIES] ✓ Can start immediately
└── Band Members Page [Depends: Auth context] ✓ Can start in parallel

Sprint 2 (Content Creation)
├── Songs Page [Depends: Auth + Band Members complete]
└── Setlists Page [Depends: Songs data models] ⚠️ Sequential dependency

Sprint 3 (Scheduling)
├── Shows Page [Depends: Setlists complete]
└── Practices Page [Depends: Songs + Shows complete] ⚠️ Multiple dependencies
```

### Critical Path
Auth → Band Members → Songs → Setlists → Shows → Practices

**Parallelization Opportunities:**
- Sprint 1: Both pages can build simultaneously (Auth has no deps)
- Sprint 2: Songs and Setlists structure can be built in parallel, but Setlists needs Songs data models
- Sprint 3: Shows and Practices structure can be built in parallel after Sprint 2

---

## Work Package Breakdown

### Sprint 1: Foundation (Critical)
**Goal:** Users can sign up, create/join bands, and manage members

#### Work Package 1A: Authentication Pages
**Agent:** nextjs-react-developer (instance: auth-builder)
**Output:** `/workspaces/rock-on/src/pages/NewLayout/AuthPages.tsx`
**Dependencies:** None
**Estimated Time:** 30-40 minutes
**Start:** Immediately

**Components to Build:**
1. Sign Up Form (`/signup`)
   - Email, password, confirm password, display name
   - Validation and error handling
   - Orange CTA button
2. Log In Form (`/login`)
   - Email, password
   - "Forgot password" placeholder link
3. Get Started Screen
   - Create Band card
   - Join Band card (invite code input)
4. Account Settings Page
   - Profile section
   - Security section
   - Preferences
   - Account actions

**Key Requirements:**
- Centered layout, max-width 400px for forms
- Full-width orange buttons
- Dark background (#121212)
- Integration with AuthContext
- Redirect logic post-auth

**Reference Files:**
- `/workspaces/rock-on/.claude/instructions/mvp-auth-pages.md`
- `/workspaces/rock-on/.claude/specifications/2025-10-22T22:59_functional-mvp-spec.md`
- `/workspaces/rock-on/.claude/specifications/2025-10-22T14:01_design-style-guide.md`

---

#### Work Package 1B: Band Members Page
**Agent:** nextjs-react-developer (instance: band-members-builder)
**Output:** `/workspaces/rock-on/src/pages/NewLayout/BandMembersPage.tsx`
**Dependencies:** Auth context (can build in parallel with Auth Pages)
**Estimated Time:** 35-45 minutes
**Start:** Immediately (parallel with 1A)

**Components to Build:**
1. Band Info Section
   - Band name (editable by admin)
   - Description
   - Member count badge
2. Invite Code Section (admin only)
   - Display current invite code
   - Copy to clipboard
   - Regenerate code
   - Share functionality
3. Members List
   - Member cards/table
   - Avatar, name, email, role badge
   - Instruments display
   - Actions menu (•••)
4. Modals:
   - Edit Band Info
   - Edit Member Instruments
   - Remove Member confirmation
   - Transfer Ownership confirmation

**Key Requirements:**
- Role-based UI rendering (Owner/Admin/Member)
- Orange accent for primary actions
- Responsive: table on desktop, cards on mobile
- Integration with BandMembershipService

**Reference Files:**
- `/workspaces/rock-on/.claude/instructions/mvp-band-members-page.md`
- `/workspaces/rock-on/.claude/specifications/database-schema.md` (bandMemberships, inviteCodes)

---

### Sprint 2: Content Creation (High Priority)
**Goal:** Users can add songs and create setlists

#### Work Package 2A: Songs Page
**Agent:** nextjs-react-developer (instance: songs-builder)
**Output:** `/workspaces/rock-on/src/pages/NewLayout/SongsPage.tsx`
**Dependencies:** Sprint 1 complete (Auth + Band Members)
**Estimated Time:** 40-50 minutes
**Start:** After Sprint 1 validation passes

**Components to Build:**
1. Song Library View
   - Desktop: Table with columns (Song, Duration, Key, Tuning, BPM, Next Show, Actions)
   - Mobile: Stacked cards
   - Colored avatar circles with initials
2. Search & Filter Bar
   - Live search (title, artist, album)
   - Filter button with panel
   - Sort options dropdown
3. New Song Modal
   - Required: Title, Artist, Key
   - Optional: Album, Duration, BPM, Tuning, Tags, Notes, Links
   - Orange "Save Song" button
4. Edit Song Modal (same as New Song, pre-populated)
5. Delete Confirmation Dialog
6. Actions Menu (•••)
   - Edit, Add to Setlist, Duplicate, Delete

**Key Requirements:**
- Reference NewLayout.tsx visual style exactly
- Avatar color generation from song name
- Debounced search (300ms)
- Empty state: "No songs yet" with CTA
- Loading skeletons
- Integration with SongService

**Reference Files:**
- `/workspaces/rock-on/.claude/instructions/mvp-songs-page.md`
- `/workspaces/rock-on/src/pages/NewLayout/NewLayout.tsx` (design reference)
- `/workspaces/rock-on/src/components/songs/NewSongModal.tsx` (existing modal - can reference/refactor)

---

#### Work Package 2B: Setlists Page
**Agent:** nextjs-react-developer (instance: setlists-builder)
**Output:** `/workspaces/rock-on/src/pages/NewLayout/SetlistsPage.tsx`
**Dependencies:** Songs Page data models defined (can start structure in parallel)
**Estimated Time:** 45-55 minutes
**Start:** After Songs Page data models are complete

**Components to Build:**
1. Setlist Library View
   - Card/table showing: name, show, song count, duration, status
   - Status badges (Draft/Active/Archived)
   - Preview of first 5 songs
   - Actions menu (•••)
2. Create/Edit Setlist Page (full-screen or modal)
   - Header: Name, Associated Show, Status, Notes
   - Left Panel: Setlist songs (ordered, drag-drop)
   - Right Panel: Available songs (searchable)
   - Running total duration
3. Drag-and-Drop Reordering
   - Visual drag handles (☰)
   - Drop zones
   - Position numbers
4. Filter Options
   - Status filter (All/Draft/Active/Archived)
   - By show
   - By date

**Key Requirements:**
- Drag-drop library integration (react-beautiful-dnd or @dnd-kit)
- Dual-panel layout for editing
- Song duration calculation
- Orange CTAs
- Integration with SetlistService

**Reference Files:**
- `/workspaces/rock-on/.claude/instructions/mvp-setlists-page.md`
- Songs Page (for data model reference)

---

### Sprint 3: Scheduling (High Priority)
**Goal:** Users can schedule shows and practices

#### Work Package 3A: Shows Page
**Agent:** nextjs-react-developer (instance: shows-builder)
**Output:** `/workspaces/rock-on/src/pages/NewLayout/ShowsPage.tsx`
**Dependencies:** Setlists Page complete
**Estimated Time:** 40-50 minutes
**Start:** After Sprint 2 validation passes

**Components to Build:**
1. Shows List View
   - Upcoming shows (default)
   - Past shows (grayed out)
   - Large date badge
   - Show details: name, venue, date/time, location
   - Associated setlist display
   - Status badge (Scheduled/Confirmed/Completed/Cancelled)
   - Actions menu (•••)
2. Create/Edit Show Modal
   - Required: Show name, Date, Time
   - Optional: Venue, Address, Setlist (dropdown), Load-in, Soundcheck, Set Length, Payment, Notes, Contacts
   - Status selector
3. Assign Setlist Dropdown
   - Shows band's available setlists
4. Filter Options
   - Upcoming/Past/All
   - By month
   - By venue

**Key Requirements:**
- Timeline/calendar view for shows
- Payment tracking fields
- Integration with practiceSessions table (type: 'gig')
- Setlist association
- Orange CTAs

**Reference Files:**
- `/workspaces/rock-on/.claude/instructions/mvp-shows-page.md`
- Setlists Page (for setlist data reference)

---

#### Work Package 3B: Practices Page
**Agent:** nextjs-react-developer (instance: practices-builder)
**Output:** `/workspaces/rock-on/src/pages/NewLayout/PracticesPage.tsx`
**Dependencies:** Songs + Shows complete (needs both for auto-suggestions)
**Estimated Time:** 35-45 minutes
**Start:** After Shows Page is complete

**Components to Build:**
1. Practices List View
   - Upcoming practices
   - Past practices (marked Completed)
   - Details: date/time, duration, location, song count
   - Status badge (Scheduled/Completed/Cancelled)
   - Actions menu (•••)
2. Create/Edit Practice Modal
   - Required: Date, Time
   - Optional: Duration (default 2 hrs), Location, Notes
   - Songs to Practice section
   - Auto-suggestion from upcoming shows
3. Song Selection
   - Search/select from band songs
   - Remove songs (× button)
   - Optional drag-to-reorder
4. Show Suggestions
   - "Add songs from [Show Name]" button
   - Auto-populates from show's setlist

**Key Requirements:**
- Simplified for MVP (no execution tracking)
- Auto-suggestion logic from Shows
- Integration with practiceSessions table (type: 'rehearsal')
- Orange CTAs

**Reference Files:**
- `/workspaces/rock-on/.claude/instructions/mvp-practices-page.md`
- Shows Page (for show data reference)
- Songs Page (for song data reference)

---

## Orchestration Strategy

### Phase 1: Sprint 1 Parallel Launch
**Execution:**
1. Launch TWO agents simultaneously:
   - Agent 1: Auth Pages builder
   - Agent 2: Band Members builder
2. Both agents work independently
3. DPO monitors progress via completion signals
4. No blocking dependencies between them

**Success Criteria:**
- Both pages render without errors
- Auth flow works end-to-end (sign up → create band → view band)
- Band members page displays with role-based UI
- Navigation between auth and band pages works

---

### Phase 2: Sprint 1 Validation
**Execution:**
1. Run build command: `npm run build`
2. Check for TypeScript errors
3. Check for linting issues
4. Visual inspection using Chrome MCP:
   - Test sign up flow
   - Test log in flow
   - Test band creation
   - Test invite code generation
   - Test member management
5. Verify database integration (check IndexedDB in DevTools)

**Pass Criteria:**
- Build succeeds with no errors
- All user flows work end-to-end
- UI matches design specification
- Orange (#f17827ff) color is used correctly
- Responsive design works on mobile + desktop

**Fail Actions:**
- Identify specific issues
- Create corrective work package
- Re-delegate to appropriate agent
- Re-validate

---

### Phase 3: Sprint 2 Sequential Launch
**Execution:**
1. Launch Agent 1: Songs Page builder
2. Wait for Songs data models to be defined
3. Launch Agent 2: Setlists Page builder (can start structure immediately)
4. Songs builder provides data model reference to Setlists builder
5. DPO coordinates handoff of data structures

**Success Criteria:**
- Songs page displays band song library
- Search and filter work
- Add/Edit/Delete songs work
- Setlists page displays setlist library
- Drag-drop song reordering works
- Setlists can be associated with shows (placeholder for now)

---

### Phase 4: Sprint 2 Validation
**Execution:**
1. Run build command: `npm run build`
2. Visual inspection using Chrome MCP:
   - Add songs to band
   - Search and filter songs
   - Create setlist
   - Add songs to setlist
   - Drag-drop reorder songs in setlist
   - Verify duration calculation
3. Check database persistence
4. Test responsive design

**Pass Criteria:**
- Build succeeds
- All CRUD operations work
- Drag-drop is smooth and functional
- Data persists across page refreshes
- UI matches design system

---

### Phase 5: Sprint 3 Sequential Launch
**Execution:**
1. Launch Agent 1: Shows Page builder
2. Wait for Shows page completion
3. Launch Agent 2: Practices Page builder (needs Shows for auto-suggestions)
4. DPO coordinates data sharing between agents

**Success Criteria:**
- Shows page displays show list
- Shows can be associated with setlists
- Shows have full CRUD operations
- Practices page displays practice list
- Practices can auto-suggest songs from upcoming shows
- Practices have full CRUD operations

---

### Phase 6: Sprint 3 Validation
**Execution:**
1. Run build command: `npm run build`
2. Visual inspection using Chrome MCP:
   - Schedule a show
   - Associate setlist with show
   - Schedule a practice
   - Auto-add songs from show to practice
   - Test all CRUD operations
3. Check database persistence
4. Test end-to-end workflow:
   - Create band → Add songs → Create setlist → Schedule show → Schedule practice

**Pass Criteria:**
- Build succeeds
- All CRUD operations work
- Auto-suggestion logic works
- Complete workflow functions end-to-end

---

### Phase 7: Final Integration & Synthesis
**Execution:**
1. System-wide build verification
2. End-to-end user journey testing:
   - New user signs up
   - Creates band
   - Invites members
   - Adds songs
   - Creates setlists
   - Schedules shows
   - Schedules practices
3. Cross-page integration checks:
   - Navigation between all pages
   - Shared components consistency
   - Role-based permissions across pages
4. Performance check:
   - Page load times
   - Search/filter responsiveness
   - Drag-drop smoothness
5. Responsive design validation:
   - Mobile (< 768px)
   - Desktop (≥ 768px)
6. Design consistency audit:
   - Orange color usage
   - Typography consistency
   - Spacing consistency
   - Component pattern consistency

**Deliverables:**
- Comprehensive test report
- List of any known issues
- Performance metrics
- Deployment readiness assessment

---

## Integration Points to Monitor

### Shared State Management
- **AuthContext:** Used by all pages for current user
- **Current Band:** Stored in context/localStorage, affects all content pages
- **User Role:** Affects UI rendering on all pages

### Navigation
- Band Selector dropdown (top-left)
- Primary nav tabs (Songs, Setlists, Shows, Practices)
- Band Members accessed via "Manage Current Band"
- User menu (top-right)

### Database Services
- All pages must use services from `/workspaces/rock-on/src/services/`
- Database at `/workspaces/rock-on/src/services/database/index.ts`
- Context system: `contextType: 'band'`, `contextId: bandId` for all MVP content

### Design System
- All pages must reference NewLayout.tsx for visual patterns
- Color: #f17827ff (Orange) for all primary CTAs
- Dark theme: #121212 background, #1a1a1a cards
- Typography: White primary, #a0a0a0 secondary, #707070 tertiary
- Components: h-10 buttons, rounded-lg borders, 12px border-radius on cards

---

## Risk Management

### Risk 1: Design Inconsistency Across Pages
**Mitigation:**
- All agents receive identical design specification
- Reference NewLayout.tsx in every work package
- DPO performs visual consistency audit during validation

### Risk 2: Database Schema Misalignment
**Mitigation:**
- Provide database-schema.md to all agents
- Enforce use of existing service layer
- No direct database access, only through services

### Risk 3: Dependency Chain Delays
**Mitigation:**
- Clear dependency graph communicated upfront
- Sequential sprints ensure dependencies are met
- Structure work can start before data models finalized

### Risk 4: Build Failures from Integration Issues
**Mitigation:**
- Mandatory build check after each sprint
- Early detection of TypeScript errors
- Rollback capability if validation fails

### Risk 5: Orange Color Not Used (Blue Used Instead)
**Mitigation:**
- Explicit warning in every work package about orange (#f17827ff)
- Visual inspection validates color usage
- Search codebase for incorrect blue references

---

## Agent Communication Protocol

### Work Package Format
Each agent receives:
1. **Context Section:** Overall project goals and current sprint
2. **Specific Task:** Detailed component breakdown
3. **Design References:** Links to all relevant specification files
4. **Technical Constraints:** Database schema, service layer, existing patterns
5. **Success Criteria:** Specific acceptance criteria for the page
6. **Output Location:** Exact file path for deliverables

### Handoff Protocol
When one agent's work is needed by another:
1. DPO extracts relevant data models/types
2. DPO creates integration guide
3. DPO provides to dependent agent
4. Dependent agent acknowledges understanding before starting

### Validation Feedback Loop
1. Agent completes work
2. DPO runs validation (build + visual)
3. If pass: proceed to next phase
4. If fail: DPO creates corrective work package with specific issues
5. Agent receives feedback and corrects
6. Re-validation

---

## Progress Tracking

### Metrics
- [ ] Sprint 1 Complete (Auth + Band Members)
- [ ] Sprint 1 Validated (Build + Visual)
- [ ] Sprint 2 Complete (Songs + Setlists)
- [ ] Sprint 2 Validated (Build + Visual)
- [ ] Sprint 3 Complete (Shows + Practices)
- [ ] Sprint 3 Validated (Build + Visual)
- [ ] Final Integration Complete
- [ ] End-to-End Testing Complete
- [ ] MVP Deployment Ready

### Time Estimates
- Sprint 1: 80-90 minutes (both agents in parallel)
- Sprint 1 Validation: 15-20 minutes
- Sprint 2: 85-105 minutes (sequential)
- Sprint 2 Validation: 15-20 minutes
- Sprint 3: 75-95 minutes (sequential)
- Sprint 3 Validation: 15-20 minutes
- Final Integration: 30-40 minutes

**Total Estimated Time:** 4.5 - 6 hours of active development

---

## Success Definition

The MVP is complete and successful when:

1. **All Pages Functional:**
   - Auth Pages (Sign Up, Log In, Get Started, Account Settings)
   - Band Members Page
   - Songs Page
   - Setlists Page
   - Shows Page
   - Practices Page

2. **Core Workflows Complete:**
   - User can sign up → create band → add songs → create setlists → schedule shows → schedule practices
   - User can join existing band via invite code
   - Admins can manage members and assign roles

3. **Technical Quality:**
   - Build succeeds with no errors
   - No TypeScript errors
   - No linting errors
   - All pages responsive (mobile + desktop)
   - Data persists correctly in IndexedDB

4. **Design Quality:**
   - Orange (#f17827ff) used consistently for primary CTAs
   - Dark theme throughout (#121212 background)
   - Visual consistency across all pages
   - Matches NewLayout.tsx design patterns

5. **User Experience:**
   - Smooth navigation between pages
   - Loading states and error handling
   - Role-based permissions enforced
   - Empty states guide user actions

---

## Next Steps

1. **Immediate:** Launch Sprint 1 agents (Auth Pages + Band Members Page)
2. **After Sprint 1 Validation:** Launch Sprint 2 agents
3. **After Sprint 2 Validation:** Launch Sprint 3 agents
4. **After Sprint 3 Validation:** Perform final integration
5. **Final Deliverable:** Comprehensive report with file paths, code snippets, and deployment notes

---

**Orchestrator Status:** READY TO EXECUTE
**Awaiting Confirmation to Begin:** Sprint 1 Agent Launch

