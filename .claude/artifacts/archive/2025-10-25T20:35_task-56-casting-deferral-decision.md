---
timestamp: 2025-10-25T20:35
prompt: Update plan to highlight that CastingService migration is deferred to future work
---

# Task 56: CastingService Migration - Deferral Decision

**Decision Date**: 2025-10-25T20:35
**Status**: DEFERRED TO POST-MVP
**Priority**: High (but non-blocking for MVP)

## Executive Summary

**Decision**: Defer CastingService migration to post-MVP future work. The service will continue using Dexie directly (local-only, no sync) until the repository interface is extended to support casting entities.

## Rationale

### Why Defer?

1. **Repository Interface Limitation**: The current `IDataRepository` interface doesn't support the three casting-related entities:
   - `SongCasting` - Maps songs to setlists/sessions
   - `SongAssignment` - Assigns band members to songs
   - `AssignmentRole` - Defines member roles (vocals, guitar, etc.)

2. **Non-Critical for MVP**: Casting features work locally with Dexie, users can still assign members and roles within a device

3. **Clear Path Forward**: Comprehensive tests already exist (16 tests), making future migration straightforward

4. **Focus on Core MVP**: Prioritize Supabase deployment, authentication, and core service migrations

### Impact Assessment

**What Works Now**:
- ✅ Casting functionality fully operational (Dexie local-only)
- ✅ Users can assign members to songs within a device
- ✅ All existing UI features work as expected

**What Doesn't Work**:
- ❌ Casting assignments don't sync across devices
- ❌ Multi-device bands can't share casting assignments
- ❌ Offline casting changes won't sync when back online

**User Impact**:
- **Low Impact for MVP**: Most users work on single devices initially
- **Medium Impact Long-term**: Multi-device bands need casting sync eventually
- **Workaround Available**: Users can recreate casting assignments per device

## Work Already Completed

### Tests Created (16 comprehensive tests)
✅ **File**: `tests/unit/services/CastingService.test.ts`

**Coverage**:
- CRUD operations (create, get, delete castings)
- Context queries (by setlist, by session)
- Assignment management (assign, update, unassign members)
- Role management (add/remove roles)
- Complex queries (isMemberAssigned, getUnassignedSongs)
- Bulk operations (bulkAssign)
- Validation and error handling

**Status**: All 16 tests passing ✅

### Analysis Documents
✅ **Files Created**:
- `2025-10-25T17:07_task-56-castingservice-analysis.md` - Detailed analysis
- `2025-10-25T17:10_task-56-summary.md` - Migration options summary
- `2025-10-25T20:35_task-56-casting-deferral-decision.md` - This document

## Future Work Roadmap

### When to Revisit

**Triggers**:
1. Post-MVP launch (after Tasks 11-25 complete)
2. User feedback indicates casting sync is needed
3. Multi-device band usage increases
4. Time available for feature enhancement

**Priority**: High (once triggered)

### Implementation Plan (6-8 hours)

#### Step 1: Extend Repository Interface (2-3 hours)
```typescript
// Add to IDataRepository interface
interface IDataRepository {
  // ... existing methods

  // Casting methods
  getCastings(contextId: string, contextType: 'setlist' | 'session'): Promise<SongCasting[]>
  addCasting(casting: SongCasting): Promise<SongCasting>
  updateCasting(id: string, updates: Partial<SongCasting>): Promise<SongCasting>
  deleteCasting(id: string): Promise<void>

  // Assignment methods
  getAssignments(castingId: string): Promise<SongAssignment[]>
  addAssignment(assignment: SongAssignment): Promise<SongAssignment>
  updateAssignment(id: string, updates: Partial<SongAssignment>): Promise<SongAssignment>
  deleteAssignment(id: string): Promise<void>

  // Role methods
  getAssignmentRoles(assignmentId: string): Promise<AssignmentRole[]>
  addAssignmentRole(role: AssignmentRole): Promise<AssignmentRole>
  deleteAssignmentRole(id: string): Promise<void>
}
```

#### Step 2: Implement in LocalRepository (1-2 hours)
- Add Dexie table queries for casting tables
- Implement all 10 new methods
- Handle relationships and cascading deletes

#### Step 3: Implement in RemoteRepository (2-3 hours)
- Add Supabase queries for casting tables
- Implement field mapping (camelCase ↔ snake_case)
- Handle RLS policies and user context

#### Step 4: Migrate CastingService (1 hour)
- Replace Dexie calls with `repository.*` calls
- **Tests Already Exist**: Use the 16 existing tests
- Run tests to verify migration

#### Step 5: Verify Sync (1 hour)
- Test casting creates sync to Supabase
- Test offline casting queues properly
- Test conflict resolution
- Verify multi-device sync

## Current State Documentation

### Files in Current State

**Service** (unchanged):
- `src/services/CastingService.ts` - Still using Dexie directly

**Tests** (ready for future use):
- `tests/unit/services/CastingService.test.ts` - 16 passing tests

**Models** (already exist):
- `src/models/SongCasting.ts`
- `src/models/SongAssignment.ts`
- `src/models/AssignmentRole.ts`

### Database Tables (Dexie)

**Existing tables**:
- `castings` - SongCasting entities
- `assignments` - SongAssignment entities
- `assignmentRoles` - AssignmentRole entities

**Status**: Fully functional locally ✅

## Decision Tracking

### Updated Documents
- ✅ `TASK-INDEX.md` - Task 56 marked as 🔸 DEFERRED
- ✅ `IMPLEMENTATION-STATUS.md` - Added "Post-MVP Future Work" section
- ✅ Summary statistics updated (9 deferred tasks total)
- ✅ This decision document created

### Communication
- ✅ User informed of deferral decision
- ✅ Rationale clearly documented
- ✅ Future work plan defined
- ✅ Tests preserved for future use

## Success Metrics (Post-Implementation)

When revisited, success means:
- ✅ All 16 existing tests pass
- ✅ Casting assignments sync across devices
- ✅ Offline casting changes queue and sync
- ✅ Multi-device bands can share casting assignments
- ✅ No regressions in existing casting functionality
- ✅ Full integration with SyncRepository pattern

## Recommendation

**Proceed with MVP priorities**:
1. ✅ Complete remaining service migrations (done)
2. → Deploy Supabase schema (Tasks 11-13)
3. → Implement authentication (Tasks 20-25)
4. → Integration testing (Tasks 73-76)
5. → MVP launch

**Revisit casting sync after**:
- MVP is deployed and stable
- User feedback indicates need for cross-device casting
- Repository interface extensions become necessary

---

**Status**: DECISION APPROVED - DEFERRED TO POST-MVP
**Next Review**: After MVP launch or when user feedback triggers need
**Estimated Future Work**: 6-8 hours (tests already exist)
**Risk Level**: Low (functionality works locally, tests ready, clear path forward)
