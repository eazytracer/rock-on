---
title: Shows Table Separation - Orchestration Plan
created: 2025-10-27T17:36
status: ACTIVE ORCHESTRATION
description: Comprehensive execution plan for separating shows from practice_sessions table
parent_spec: proposed-unified-schema-v2.md
---

# Shows Table Separation - Orchestration Plan

## Executive Summary

**Objective:** Separate shows (gigs) from practice_sessions into a dedicated `shows` table as specified in `proposed-unified-schema-v2.md`.

**Current State:**
- Shows stored in `practice_sessions` with `type='gig'`
- Causes sparse columns, JSON parsing bugs, mixed business logic
- ShowsPage exists but uses incorrect model/service

**Target State:**
- Dedicated `shows` table in both IndexedDB and Supabase
- Separate Show model and ShowService
- Clean separation of concerns
- Fixed JSON handling for contacts field

**Estimated Effort:** 8-12 hours (split across parallel work units)

---

## Work Breakdown Structure

### Phase 1: Foundation (Sequential) - ~2 hours
**Dependencies:** None
**Deliverables:** Core models and database schema

#### Task 1.1: Create Show Model
- **File:** `src/models/Show.ts` (NEW)
- **What:** Define Show and ShowContact interfaces
- **Acceptance:**
  - Show interface with all fields from spec
  - ShowContact interface with proper structure
  - TypeScript types match camelCase conventions
  - Export ShowStatus type
- **Spec Reference:** Lines 625-655 of proposed-unified-schema-v2.md

#### Task 1.2: Update PracticeSession Model
- **File:** `src/models/PracticeSession.ts`
- **What:** Remove show-specific fields
- **Acceptance:**
  - Remove: name, venue, loadInTime, soundcheckTime, payment, contacts
  - Keep: All practice-specific fields
  - Update comments to reflect new scope
- **Spec Reference:** Lines 660-685 of proposed-unified-schema-v2.md

#### Task 1.3: Add Shows Table to IndexedDB
- **File:** `src/services/database/index.ts`
- **What:** Add shows table to Dexie schema
- **Acceptance:**
  - New `shows!: Table<Show>` declaration
  - Version 7 migration with proper indexes
  - Dexie hooks for automatic timestamps (createdDate, updatedDate)
  - Schema: `++id, bandId, setlistId, scheduledDate, status, venue`
- **Critical:** Import Show model from new location

---

### Phase 2: Repository Layer (Parallel after Phase 1) - ~3 hours

Can be split into two parallel sub-tasks:

#### Task 2.1: LocalRepository - Shows Support
- **File:** `src/services/data/LocalRepository.ts`
- **What:** Add IndexedDB CRUD operations for shows
- **Methods to add:**
  - `getShows(bandId): Promise<Show[]>`
  - `getShow(id): Promise<Show | null>`
  - `addShow(show): Promise<Show>`
  - `updateShow(id, updates): Promise<Show>`
  - `deleteShow(id): Promise<void>`
- **Acceptance:**
  - All methods use `db.shows` table
  - Proper error handling
  - Returns Show objects in camelCase

#### Task 2.2: RemoteRepository - Shows Mapping
- **File:** `src/services/data/RemoteRepository.ts`
- **What:** Add Supabase mapping for shows
- **Methods to add:**
  - `getShows(bandId): Promise<Show[]>`
  - `getShow(id): Promise<Show | null>`
  - `addShow(show): Promise<Show>`
  - `updateShow(id, updates): Promise<Show>`
  - `deleteShow(id): Promise<void>`
  - `mapShowToSupabase(show): any` (private)
  - `mapShowFromSupabase(row): Show` (private)
- **CRITICAL:**
  - JSON.stringify on contacts when sending to Supabase
  - JSON.parse on contacts when reading from Supabase
  - Field mapping: camelCase ↔ snake_case
  - Handle undefined → null for optional fields
- **Spec Reference:** Lines 202-246 of proposed-unified-schema-v2.md

---

### Phase 3: Service Layer (Depends on Phase 2) - ~2 hours

#### Task 3.1: Create ShowService
- **File:** `src/services/ShowService.ts` (NEW)
- **What:** Business logic for show operations
- **Pattern:** Follow SetlistService structure
- **Methods:**
  - `getShows(bandId): Promise<Show[]>`
  - `getShow(id): Promise<Show | null>`
  - `createShow(data): Promise<Show>`
  - `updateShow(id, updates): Promise<Show>`
  - `deleteShow(id): Promise<void>`
  - Validation helpers
- **Acceptance:**
  - Uses repository layer (not direct DB access)
  - Proper validation
  - Error handling with meaningful messages
  - Works with both online/offline modes

#### Task 3.2: Update Hooks to Use ShowService
- **File:** `src/hooks/useShows.ts`
- **What:** Replace PracticeSessionService with ShowService
- **Acceptance:**
  - Import ShowService instead of PracticeSessionService
  - Update all hook implementations
  - Remove type='gig' filtering (no longer needed)
  - Keep same hook API for backwards compatibility

---

### Phase 4: Sync Engine (Depends on Phase 2) - ~1.5 hours

#### Task 4.1: Add Shows to SyncEngine
- **File:** `src/services/data/SyncEngine.ts`
- **What:** Enable bidirectional sync for shows
- **Methods to add:**
  - `pullShows(bandIds: string[]): Promise<void>`
  - `pushShows(): Promise<void>`
- **Updates needed:**
  - Add shows to `pullFromRemote()` method
  - Add shows to `pushToRemote()` method
  - Handle sync conflicts for shows
- **Acceptance:**
  - Shows sync from Supabase to IndexedDB
  - Shows sync from IndexedDB to Supabase
  - Conflicts handled gracefully
  - Sync queue processes show operations

---

### Phase 5: UI Layer (Depends on Phase 3) - ~2 hours

#### Task 5.1: Update ShowsPage
- **File:** `src/pages/NewLayout/ShowsPage.tsx`
- **What:** Use Show model instead of PracticeSession
- **Changes:**
  - Import Show model
  - Remove ShowContact definition (use from model)
  - Update type annotations from PracticeSession to Show
  - Verify all field access uses Show interface
  - Test contacts array handling
- **Acceptance:**
  - Page displays shows correctly
  - Create/edit/delete operations work
  - Contacts field handled as array of ShowContact
  - Setlist forking still works

---

### Phase 6: Seed Data (Parallel with Phase 3-5) - ~1.5 hours

Can run in parallel with other phases once models exist.

#### Task 6.1: Update Seed Scripts
- **Files:**
  - `src/database/seedData.ts`
  - `src/database/seedMvpData.ts`
- **What:** Create shows separately from practices
- **Acceptance:**
  - Shows created in `shows` table
  - Practices created in `practiceSessions` table (no type='gig')
  - Example shows include: contacts array, payment, venue details
  - Setlists linked to shows via showId
  - Seed data can reset database from scratch

---

## Critical Implementation Notes

### 1. JSON Handling for Contacts (CRITICAL!)
```typescript
// ❌ WRONG (current bug)
contacts: show.contacts

// ✅ CORRECT (fix)
// TO Supabase
contacts: show.contacts ? JSON.stringify(show.contacts) : null

// FROM Supabase
contacts: row.contacts ? JSON.parse(row.contacts) : undefined
```

### 2. Field Name Mappings
```typescript
// Application (camelCase) ↔ Supabase (snake_case)
bandId ↔ band_id
setlistId ↔ setlist_id
scheduledDate ↔ scheduled_date
loadInTime ↔ load_in_time
soundcheckTime ↔ soundcheck_time
createdDate ↔ created_date
updatedDate ↔ updated_date
```

### 3. Timestamp Fields
- Shows use `updatedDate` (NOT `last_modified` like setlists)
- Both `createdDate` and `updatedDate` required
- Auto-set by Dexie hooks in IndexedDB
- Auto-set by Supabase DEFAULT NOW() and triggers

### 4. Setlist Bidirectional Relationship
```typescript
// Show → Setlist
show.setlistId = 'uuid-of-setlist'

// Setlist → Show
setlist.showId = 'uuid-of-show'
```

### 5. Payment Handling
- Stored as cents (integer) in database
- Display as dollars in UI
- Use existing formatters: `centsToDollars()`, `dollarsToCents()`

---

## Execution Strategy

### Optimal Parallelization

**Round 1 (Sequential):**
- Phase 1: Foundation (all tasks) - MUST complete first

**Round 2 (Parallel):**
- Task 2.1: LocalRepository
- Task 2.2: RemoteRepository
- Task 6.1: Seed Data (can start after Task 1.1 done)

**Round 3 (Parallel):**
- Task 3.1: ShowService
- Task 4.1: SyncEngine
- Task 5.1: ShowsPage (can start early with mock service)

**Round 4 (Sequential):**
- Integration testing
- Build verification
- Visual validation (Chrome MCP)

---

## Validation Checklist

### Build & Type Checks
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds
- [ ] No TypeScript errors in IDE

### Database Operations
- [ ] IndexedDB shows table exists
- [ ] Shows CRUD via LocalRepository works
- [ ] Shows CRUD via RemoteRepository works
- [ ] Contacts field JSON parse/stringify works
- [ ] Field mapping camelCase ↔ snake_case correct

### Service Layer
- [ ] ShowService.createShow() works
- [ ] ShowService.updateShow() works
- [ ] ShowService.deleteShow() works
- [ ] ShowService.getShows() returns correct data
- [ ] Validation catches invalid input

### Sync
- [ ] Shows sync to Supabase
- [ ] Shows sync from Supabase
- [ ] Contacts field survives round-trip
- [ ] No sync conflicts with practice_sessions

### UI
- [ ] ShowsPage displays shows
- [ ] Create show form works
- [ ] Edit show form works
- [ ] Delete show works
- [ ] Contacts array displays correctly
- [ ] Setlist forking for shows works
- [ ] Payment displays in dollars

### Seed Data
- [ ] Seed scripts create shows in shows table
- [ ] Seed scripts create practices in practiceSessions table
- [ ] No type='gig' in practiceSessions
- [ ] Shows have example contacts
- [ ] Setlists linked to shows

---

## Risk Assessment

### High Risk Items
1. **JSON parsing for contacts** - Known current bug, must fix
2. **Field name mapping** - Easy to miss camelCase ↔ snake_case
3. **Setlist bidirectional links** - Must update both directions

### Medium Risk Items
1. **Sync conflicts** - Shows and practices might conflict during migration
2. **Existing data** - Local dev environments have shows in practice_sessions
3. **UI dependencies** - ShowsPage heavily coupled to PracticeSession model

### Low Risk Items
1. **TypeScript compilation** - Types will catch most errors
2. **Repository pattern** - Well-established, easy to extend
3. **Seed data** - Can be re-run to reset state

---

## Rollback Plan

If issues arise:

1. **Before committing:**
   - Revert file changes
   - Clear IndexedDB via DevTools
   - Re-run seed scripts

2. **After committing:**
   - Git revert to previous commit
   - Clear IndexedDB
   - Re-seed database

3. **In production (if deployed):**
   - Rollback deployment
   - Keep Supabase shows table (no harm)
   - Migrate data back if needed

---

## Dependencies Graph

```
Task 1.1 (Show Model)
    ↓
Task 1.2 (PracticeSession Model)
    ↓
Task 1.3 (IndexedDB Schema)
    ↓
    ├─→ Task 2.1 (LocalRepository) ──→ Task 3.1 (ShowService) ──→ Task 5.1 (ShowsPage)
    ├─→ Task 2.2 (RemoteRepository) ──→ Task 4.1 (SyncEngine)   ──→ Integration Test
    └─→ Task 6.1 (Seed Data)
```

---

## Success Criteria

✅ **Definition of Done:**

1. All TypeScript compiles without errors
2. All tests pass (existing tests still work)
3. Build succeeds
4. Shows create/read/update/delete work in UI
5. Shows sync bidirectionally with Supabase
6. Contacts field properly serialized/deserialized
7. Seed scripts create clean separation
8. No shows in practice_sessions table
9. Setlist forking still works
10. Chrome MCP visual validation passes

---

## Next Steps

**Immediate Actions:**
1. Review this plan for accuracy
2. Confirm spec interpretation is correct
3. Begin Phase 1: Foundation tasks
4. Set up validation environment (local Supabase running)

**Monitoring:**
- Track progress in real-time
- Validate after each phase
- Adjust parallelization if dependencies discovered
- Document any deviations from plan

---

**Status:** READY TO EXECUTE
**Blocked By:** None (can start immediately)
**Estimated Completion:** 8-12 hours of coordinated work
