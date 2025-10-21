# Multi-User Implementation Roadmap
## User Authentication + Song Variants + Context-Specific Casting

**Objective**: Enable multiple band members to join, manage personal song catalogs, create shared setlists, and test context-specific casting with real users.

---

## User Stories Overview

### Epic 1: Multi-User Foundation
**As a band member**, I want to create my own account and join my band, **so that** I can maintain my personal song catalog while collaborating with my bandmates.

### Epic 2: Personal vs Band Song Management
**As a musician**, I want to keep my personal songs separate from band songs while linking related versions, **so that** I can practice independently and contribute to band setlists.

### Epic 3: Context-Specific Casting
**As a band leader**, I want to assign different roles to members for different songs and contexts, **so that** everyone knows their parts for acoustic vs electric shows.

### Epic 4: Live Multi-User Testing
**As the development team**, we want to test with multiple real users creating bands and setlists, **so that** we can validate the user experience before broader rollout.

---

## Phase 1: Authentication Foundation (3-4 days)
*Get multiple users logged in and accessing the app*

### P1.1: Database Schema Evolution
```typescript
// New tables for user management
users: '++id, email, name, createdDate, lastLogin, authProvider',
userProfiles: '++id, userId, displayName, primaryInstrument, *instruments, avatarUrl',
bandMemberships: '++id, userId, bandId, role, joinedDate, status, permissions',
inviteCodes: '++id, bandId, code, createdBy, expiresAt, maxUses, currentUses'

// Enhanced existing models
songs: '++id, title, artist, ..., contextType, contextId, createdBy, songGroupId?',
```

#### User Stories:
- **US-P1.1.1**: As a developer, I want to create new database models that support multi-user functionality from the start
- **US-P1.1.2**: As a developer, I want to use both mock and real authentication services with the same interface for flexible development

### P1.2: Supabase Authentication Integration
```typescript
// src/services/auth/
├── SupabaseAuthService.ts    // OAuth + email/password
├── AuthContext.tsx           // React context for auth state
├── useAuth.ts                // Hook for components
└── SessionManager.ts         // Handle offline sessions
```

#### User Stories:
- **US-P1.2.1**: As a new user, I want to sign up with Google OAuth or email/password, so that I can quickly access the app
- **US-P1.2.2**: As a returning user, I want to stay logged in across browser sessions, so that I don't have to re-authenticate constantly
- **US-P1.2.3**: As a user, I want my session to persist offline, so that I can use the app during practice even without internet
- **US-P1.2.4**: As a developer, I want to easily switch between mock authentication (for fast development) and real authentication (for testing OAuth flows) using environment variables

### P1.3: Band Creation & Joining
```typescript
// src/components/auth/
├── LoginForm.tsx
├── SignupForm.tsx
├── BandCreationForm.tsx
└── JoinBandForm.tsx
```

#### User Stories:
- **US-P1.3.1**: As a band leader, I want to create a new band and get an invite code, so that I can invite my bandmates
- **US-P1.3.2**: As a band member, I want to join a band using an invite code, so that I can access our shared setlists and songs
- **US-P1.3.3**: As a band leader, I want to see pending member invitations and manage permissions, so that I can control who accesses our band data

### P1.4: Initial Data Setup & Default Band Creation
```typescript
// src/services/setup/
├── InitialSetupService.ts    // Create default band for new users
├── DefaultDataService.ts     // Populate sample data for testing
└── DevDataService.ts         // Mock users and bands for development
```

#### User Stories:
- **US-P1.4.1**: As a new user, I want a default band created automatically so I can start using the app immediately
- **US-P1.4.2**: As a developer, I want sample data populated for testing multi-user workflows
- **US-P1.4.3**: As a developer, I want mock users (Alice, Bob, Charlie) available for testing band collaboration without creating multiple real accounts

---

## Phase 2: Personal vs Band Song Spaces (2-3 days)
*Enable users to have personal songs while contributing to band catalogs*

### P2.1: Song Context System
```typescript
// Enhanced Song model
Song {
  // ... existing fields
  contextType: 'personal' | 'band'
  contextId: string              // userId for personal, bandId for band
  createdBy: string             // Always track who added it
  visibility: 'private' | 'band_only' | 'public'

  // NEW: Song variant linking
  songGroupId?: string          // Links related versions
  linkedFromSongId?: string     // Original song this was copied from
}
```

#### User Stories:
- **US-P2.1.1**: As a musician, I want to add songs to my personal catalog that only I can see, so that I can track my individual practice
- **US-P2.1.2**: As a band member, I want to add songs to our band catalog that all members can access, so that we can plan setlists together
- **US-P2.1.3**: As a user, I want to easily distinguish between my personal songs and band songs in the interface

### P2.2: Song Variant Linking System
```typescript
// New tables for song relationships
songGroups: '++id, createdBy, name, createdDate',
songGroupMemberships: '++id, songId, songGroupId, addedBy, addedDate'
```

#### User Stories:
- **US-P2.2.1**: As a musician, I want to link my personal version of "Wonderwall" with my band's version, so that I can see how they relate
- **US-P2.2.2**: As a user, I want to see suggestions to link similar songs when I add a song that matches one in my personal or band library
- **US-P2.2.3**: As a band member, I want to contribute my personal arrangement of a song to the band catalog while keeping my personal version separate

### P2.3: Cross-Context Song Interface
```typescript
// src/components/songs/
├── SongContextTabs.tsx       // Switch between Personal/Band views
├── SongLinkingSuggestions.tsx // Smart linking recommendations
├── LinkedSongView.tsx        // Compare linked variants
└── SongContributionFlow.tsx  // Add personal song to band
```

#### User Stories:
- **US-P2.3.1**: As a user, I want to easily switch between viewing my personal songs and my band's songs
- **US-P2.3.2**: As a musician, I want to see side-by-side comparisons of linked song versions (my personal vs band arrangement)
- **US-P2.3.3**: As a band member, I want to contribute a song from my personal library to the band catalog with one click

---

## Phase 3: Context-Specific Casting System (3-4 days)
*Enable dynamic role assignments for different performance contexts*

### P3.1: Casting Database Schema
```typescript
// New casting system
songCastings: '++id, contextType, contextId, songId, createdBy, createdDate',
songAssignments: '++id, songCastingId, memberId, role, isPrimary, confidence, notes',
assignmentRoles: '++id, assignmentId, type, name, arrangement'
```

#### User Stories:
- **US-P3.1.1**: As a band leader, I want to assign specific roles to members for each song in a setlist, so that everyone knows their parts
- **US-P3.1.2**: As a member, I want to see my assigned roles for each song in upcoming performances and practices
- **US-P3.1.3**: As a multi-instrumentalist, I want to be assigned multiple roles for the same song (guitar + backup vocals)

### P3.2: Casting Management Interface
```typescript
// src/components/casting/
├── SetlistCastingView.tsx    // Assign roles for entire setlist
├── SongCastingEditor.tsx     // Detailed role assignment per song
├── MemberRoleSelector.tsx    // Multi-role assignment interface
└── CastingComparison.tsx     // Compare casting across contexts
```

#### User Stories:
- **US-P3.2.1**: As a band leader creating a setlist, I want to assign roles to each member for each song in an intuitive interface
- **US-P3.2.2**: As a band leader, I want to copy casting from a previous setlist and modify it for a new performance context
- **US-P3.2.3**: As a member, I want to indicate my confidence level for each assigned role and add practice notes

### P3.3: Smart Casting Suggestions
```typescript
// src/services/casting/
├── CastingSuggestionService.ts  // AI-powered role suggestions
├── MemberCapabilityService.ts   // Track member skills/experience
└── ContextAnalyzer.ts           // Acoustic vs electric context analysis
```

#### User Stories:
- **US-P3.3.1**: As a band leader, I want the system to suggest role assignments based on member capabilities and song requirements
- **US-P3.3.2**: As a band leader, I want different default casting suggestions for acoustic vs electric arrangements
- **US-P3.3.3**: As a user, I want the system to learn from my role assignments and improve future suggestions

### P3.4: Practice Session Integration
```typescript
// Enhanced practice sessions with casting
practiceSessionSongs: '++id, sessionId, songId, songCastingId, practiceNotes, roleProgress'
```

#### User Stories:
- **US-P3.4.1**: As a band, we want our practice sessions to use the casting from our upcoming setlist automatically
- **US-P3.4.2**: As a member, I want to track my progress on specific roles during practice sessions
- **US-P3.4.3**: As a band leader, I want to see which roles need more practice before our next performance

---

## Phase 4: Multi-User Testing & Validation (2-3 days)
*Test with real users to validate the multi-user experience*

### P4.1: Test Band Setup
#### User Stories:
- **US-P4.1.1**: As a developer, I want to test with both mock users (for rapid iteration) and real users (for actual collaboration) to validate the multi-user experience
- **US-P4.1.2**: As a test band member, I want to add both personal songs and band songs to verify the separation works
- **US-P4.1.3**: As a test band, we want to create setlists with different casting for acoustic vs electric shows

### P4.2: User Experience Validation
#### User Stories:
- **US-P4.2.1**: As a test user, I want to verify that song linking suggestions work correctly when I add duplicate songs
- **US-P4.2.2**: As a test band leader, I want to verify that role assignments save correctly and sync across all band members
- **US-P4.2.3**: As a test band member, I want to verify that I can see my assigned roles on mobile and update my confidence levels

### P4.3: Performance & Sync Testing
#### User Stories:
- **US-P4.3.1**: As test users, we want to verify that IndexedDB handles multiple bands and personal catalogs efficiently
- **US-P4.3.2**: As a test user, I want to verify that the app works offline and maintains state correctly when switching between mock and real auth modes
- **US-P4.3.3**: As test users, we want to verify that invite codes work reliably for joining bands in both mock and real environments

---

## Implementation Tasks (Ordered for Parallel Execution)

### Phase 1 Tasks (Authentication Foundation)

#### Phase 1.1: Schema & Models (Can be parallel)
- **T101** [P] Create User and UserProfile models with Dexie schema in `src/models/User.ts`
- **T102** [P] Create BandMembership and InviteCode models in `src/models/BandMembership.ts`
- **T103** [P] Create MockAuthService for local development without external dependencies in `src/services/auth/MockAuthService.ts`
- **T104** [P] Add contextType and contextId fields to existing Song model in `src/models/Song.ts`

#### Phase 1.2: Supabase Integration (Sequential after T101-T104)
- **T105** Setup Supabase project and configure environment variables
- **T106** Create SupabaseAuthService with OAuth and email/password support in `src/services/auth/SupabaseAuthService.ts`
- **T107** Create AuthContext and useAuth hook in `src/contexts/AuthContext.tsx`
- **T108** Create session persistence for offline functionality in `src/services/auth/SessionManager.ts`

#### Phase 1.3: Auth UI Components (Can be parallel after T105-T108)
- **T109** [P] Create LoginForm component with OAuth buttons in `src/components/auth/LoginForm.tsx`
- **T110** [P] Create SignupForm component in `src/components/auth/SignupForm.tsx`
- **T111** [P] Create BandCreationForm component in `src/components/auth/BandCreationForm.tsx`
- **T112** [P] Create JoinBandForm component with invite code input in `src/components/auth/JoinBandForm.tsx`

#### Phase 1.4: Integration & Testing (Sequential after auth components)
- **T113** Create AuthGuard component to protect routes in `src/components/auth/AuthGuard.tsx`
- **T114** Add authentication to main App.tsx and protect existing routes
- **T115** Create InitialSetupService to create default bands for new users in `src/services/setup/InitialSetupService.ts`
- **T116** Test multi-user signup and band joining flow with mock and real auth

### Phase 2 Tasks (Song Context System)

#### Phase 2.1: Song Context Models (Can be parallel)
- **T201** [P] Create SongGroup and SongGroupMembership models in `src/models/SongGroup.ts`
- **T202** [P] Update Song model with variant linking fields and context system
- **T203** [P] Create SongLinkingService for managing song relationships in `src/services/SongLinkingService.ts`
- **T204** [P] Update existing SongService to handle personal vs band contexts

#### Phase 2.2: Song Context UI (Can be parallel after models)
- **T205** [P] Create SongContextTabs component for Personal/Band switching in `src/components/songs/SongContextTabs.tsx`
- **T206** [P] Create SongLinkingSuggestions component in `src/components/songs/SongLinkingSuggestions.tsx`
- **T207** [P] Create LinkedSongView component for variant comparison in `src/components/songs/LinkedSongView.tsx`
- **T208** [P] Update existing SongList component to show context indicators

#### Phase 2.3: Integration Testing (Sequential after UI components)
- **T209** Update Songs page to use context tabs and linking features
- **T210** Test song linking flow with multiple users
- **T211** Test personal song to band song contribution flow

### Phase 3 Tasks (Casting System)

#### Phase 3.1: Casting Models (Can be parallel)
- **T301** [P] Create SongCasting and SongAssignment models in `src/models/SongCasting.ts`
- **T302** [P] Create AssignmentRole model for multi-role support
- **T303** [P] Create CastingService for role management in `src/services/CastingService.ts`
- **T304** [P] Update SetlistService to integrate with casting system

#### Phase 3.2: Casting UI Components (Can be parallel after models)
- **T305** [P] Create SetlistCastingView component in `src/components/casting/SetlistCastingView.tsx`
- **T306** [P] Create SongCastingEditor component in `src/components/casting/SongCastingEditor.tsx`
- **T307** [P] Create MemberRoleSelector component in `src/components/casting/MemberRoleSelector.tsx`
- **T308** [P] Create CastingComparison component for context comparisons

#### Phase 3.3: Smart Features (Can be parallel after basic casting)
- **T309** [P] Create CastingSuggestionService in `src/services/casting/CastingSuggestionService.ts`
- **T310** [P] Create MemberCapabilityService to track skills in `src/services/MemberCapabilityService.ts`
- **T311** [P] Update PracticeSessionService to use casting information
- **T312** [P] Add casting inheritance from setlists to practice sessions

#### Phase 3.4: Integration (Sequential after casting components)
- **T313** Update Setlists page to include casting management
- **T314** Update practice session flow to show assigned roles
- **T315** Test casting flow with multiple performance contexts

### Phase 4 Tasks (Multi-User Testing)

#### Phase 4.1: Test Environment Setup (Can be parallel)
- **T401** [P] Create test user accounts and test band data
- **T402** [P] Create automated testing scripts for multi-user workflows
- **T403** [P] Setup monitoring for sync conflicts and performance issues
- **T404** [P] Create user feedback collection system

#### Phase 4.2: Live Testing (Sequential after all previous phases)
- **T405** Conduct live testing with 3-5 test users
- **T406** Test concurrent editing scenarios and conflict resolution
- **T407** Test offline/online sync with multiple devices
- **T408** Validate user experience flows and collect feedback

#### Phase 4.3: Polish & Fixes (Based on testing results)
- **T409** Fix any critical issues discovered during testing
- **T410** Optimize performance based on multi-user load
- **T411** Update documentation with multi-user setup instructions
- **T412** Prepare for production deployment with authentication

---

## Critical Path & Dependencies

### Must Complete in Order:
1. **Phase 1.1 → Phase 1.2** (Schema must exist before auth integration)
2. **Phase 1.2 → Phase 1.3** (Auth service before auth UI)
3. **Phase 1.3 → Phase 1.4** (Auth UI before integration)
4. **Phase 1 → Phase 2** (Users must exist before song contexts)
5. **Phase 2 → Phase 3** (Song contexts before casting)
6. **Phase 3 → Phase 4** (All features before testing)

### Can Run in Parallel:
- Within each phase, tasks marked [P] can run simultaneously
- All model creation tasks within a phase
- All UI component tasks after their models are complete
- All service tasks after their models are complete

### Time Estimates:
- **Phase 1**: 3-4 days (auth is complex)
- **Phase 2**: 2-3 days (building on existing song system)
- **Phase 3**: 3-4 days (new casting system)
- **Phase 4**: 2-3 days (testing and fixes)
- **Total**: 10-14 days

### Success Criteria:
1. ✅ Multiple users can create accounts and join bands
2. ✅ Personal and band song catalogs work independently with linking
3. ✅ Context-specific casting allows different role assignments per setlist
4. ✅ Real multi-user testing validates sync and collaboration features
5. ✅ App works offline for individual users and syncs when online

This roadmap provides a logical progression from single-user to multi-user while building the song variant and casting systems incrementally for easier testing and validation.