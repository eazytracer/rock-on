---
timestamp: 2025-10-25T17:07
prompt: Complete Task 56 - Migrate CastingService to Repository Pattern with TDD approach
task: Task 56 - CastingService Migration
---

# Task 56 Analysis: CastingService Migration Status

## Executive Summary

**Status**: ✅ **Tests Created** (16/16 passing) | ⚠️ **Migration Blocked** (Repository support needed)

CastingService comprehensive test suite has been created following TDD best practices. However, full migration to the repository pattern is **blocked** because the `IDataRepository` interface does not yet include methods for casting-related entities (SongCasting, SongAssignment, AssignmentRole).

## What Was Accomplished

### 1. Comprehensive Test Suite Created

**Created**: `tests/unit/services/CastingService.test.ts`

**Test Coverage**: 16 comprehensive tests covering all major operations:

1. ✅ `createCasting()` - Creates new casting with metadata
2. ✅ `getCasting()` - Retrieves casting by context + song
3. ✅ `getCastingsForContext()` - Gets all castings in a context
4. ✅ `deleteCasting()` - Cascading delete (casting → assignments → roles)
5. ✅ `assignMember()` - Assigns member with multiple roles
6. ✅ `assignMember()` - Defaults addedBy to memberId
7. ✅ `updateAssignment()` - Updates confidence, notes, isPrimary
8. ✅ `addRoleToAssignment()` - Adds additional role to existing assignment
9. ✅ `removeRoleFromAssignment()` - Removes specific role
10. ✅ `getAssignments()` - Retrieves all assignments for casting
11. ✅ `getRoles()` - Retrieves all roles for assignment
12. ✅ `unassignMember()` - Removes member and their roles
13. ✅ `isMemberAssigned()` - Returns true when assigned
14. ✅ `isMemberAssigned()` - Returns false when not assigned
15. ✅ `getUnassignedSongs()` - Identifies songs without castings
16. ✅ `bulkAssign()` - Assigns multiple members at once

### 2. Test Quality Metrics

- **Mock Strategy**: Uses Vitest's `vi.mock()` to mock database module
- **Coverage**: Tests cover CRUD operations, validation, cascading deletes, bulk operations
- **Assertions**: Verifies both database calls and return values
- **Edge Cases**: Tests both success paths and edge cases (defaults, empty results)

### 3. Test Results

```bash
✓ tests/unit/services/CastingService.test.ts (16 tests) 11ms

Test Files  1 passed (1)
     Tests  16 passed (16)
  Duration  964ms
```

**All tests passing** ✅

## Why Migration is Blocked

### Repository Interface Gap

The current `IDataRepository` interface (`src/services/data/IDataRepository.ts`) only supports:
- ✅ Songs
- ✅ Bands
- ✅ Setlists
- ✅ Practice Sessions
- ✅ Band Memberships

**Missing**:
- ❌ SongCasting
- ❌ SongAssignment
- ❌ AssignmentRole
- ❌ CastingTemplate
- ❌ MemberCapability

### CastingService Database Dependencies

CastingService makes **17+ direct database calls** across 3 tables:

1. **db.songCastings** (7 operations)
   - `.add()` - Create casting
   - `.get()` - Get casting by ID
   - `.where()` - Query castings
   - `.delete()` - Delete casting

2. **db.songAssignments** (6 operations)
   - `.add()` - Create assignment
   - `.update()` - Update assignment
   - `.where()` - Query assignments
   - `.delete()` - Delete assignment

3. **db.assignmentRoles** (4 operations)
   - `.add()` - Add role
   - `.where()` - Query roles
   - `.delete()` - Delete role

**None of these operations can be migrated** to the repository pattern without first extending the repository interface.

## Comparison to SongService Migration

### SongService (Task 51 - ✅ Completed)

**Repository methods available**:
- ✅ `repository.getSongs()`
- ✅ `repository.addSong()`
- ✅ `repository.updateSong()`
- ✅ `repository.deleteSong()`

**Temporary direct Dexie calls** (for entities not in repository):
- `db.setlists` - Used in `deleteSong()` to check dependencies
- `db.bandMemberships` - Used in `getUserAccessibleSongs()`

**Migration feasibility**: ✅ **High** - Core operations use repository, only edge cases use Dexie

### CastingService (Task 56 - ⚠️ Blocked)

**Repository methods available**:
- ❌ None for SongCasting
- ❌ None for SongAssignment
- ❌ None for AssignmentRole

**Direct Dexie calls required**:
- ✅ **All operations** (100% of the service)

**Migration feasibility**: ❌ **Blocked** - Cannot migrate anything without repository support

## Recommended Path Forward

### Option 1: Extend Repository Interface First (Recommended)

**Steps**:
1. **Add to `IDataRepository`** interface:
   ```typescript
   // ========== CASTING ==========
   getCastings(filter: CastingFilter): Promise<SongCasting[]>
   getCasting(id: number): Promise<SongCasting | null>
   addCasting(casting: SongCasting): Promise<SongCasting>
   updateCasting(id: number, updates: Partial<SongCasting>): Promise<SongCasting>
   deleteCasting(id: number): Promise<void>

   // ========== ASSIGNMENTS ==========
   getAssignments(castingId: number): Promise<SongAssignment[]>
   addAssignment(assignment: SongAssignment): Promise<SongAssignment>
   updateAssignment(id: number, updates: Partial<SongAssignment>): Promise<SongAssignment>
   deleteAssignment(id: number): Promise<void>

   // ========== ROLES ==========
   getRoles(assignmentId: number): Promise<AssignmentRole[]>
   addRole(role: AssignmentRole): Promise<AssignmentRole>
   deleteRole(id: number): Promise<void>
   ```

2. **Implement in `SyncRepository`** (src/services/data/SyncRepository.ts)
   - Add Supabase schema mappings
   - Add sync logic for each table
   - Add conflict resolution for casting changes

3. **Update Supabase Schema** (if needed)
   - Verify tables exist: `song_castings`, `song_assignments`, `assignment_roles`
   - Add RLS policies for casting data
   - Add indexes for common queries

4. **Then migrate CastingService**
   - Replace `db.songCastings.*` with `repository.getCastings()` etc.
   - Replace `db.songAssignments.*` with `repository.getAssignments()` etc.
   - Replace `db.assignmentRoles.*` with `repository.getRoles()` etc.

**Estimated time**: 6-8 hours
- Repository interface updates: 1 hour
- SyncRepository implementation: 3-4 hours
- Supabase schema verification: 1 hour
- CastingService migration: 2-3 hours
- Testing: 1 hour

### Option 2: Defer Task 56 (Alternative)

Mark Task 56 as **deferred** until casting support is needed in production MVP.

**Rationale**:
- Casting is a complex feature used for advanced setlist/role management
- May not be critical for initial MVP launch
- Can continue using direct Dexie access (works offline)
- No sync = no conflicts to resolve

**Trade-off**: Casting changes won't sync to Supabase in production mode

### Option 3: Partial Migration (Not Recommended)

Keep tests ✅, keep using Dexie directly, document as "legacy" service.

**Problems**:
- Inconsistent with other services
- Won't benefit from sync infrastructure
- Creates technical debt

## Current Service Migration Status

Based on `.claude/artifacts/2025-10-25T15:12_task-51-songservice-migration-complete.md`:

| Service | Repository Support | Migration Status |
|---------|-------------------|------------------|
| SongService | ✅ Full | ✅ Complete (Task 51) |
| BandService | ✅ Full | ⏳ Pending (Task 52) |
| SetlistService | ✅ Full | ⏳ Pending (Task 53) |
| PracticeSessionService | ✅ Full | ⏳ Pending (Task 54) |
| BandMembershipService | ✅ Full | ⏳ Pending (Task 55) |
| **CastingService** | ❌ **None** | ⚠️ **Blocked (Task 56)** |
| SongGroupService | ❌ None? | ⏳ Pending (Task 57) |

## Files Created

1. ✅ `/workspaces/rock-on/tests/unit/services/CastingService.test.ts` - 16 comprehensive tests

## Files Not Modified

1. ⏸️ `/workspaces/rock-on/src/services/CastingService.ts` - Cannot migrate without repository support

## Recommendations

### Immediate Action

**Ask user**:
> "Task 56 (CastingService migration) is blocked because the repository doesn't have methods for SongCasting, SongAssignment, or AssignmentRole. I've created comprehensive tests (16/16 passing), but cannot migrate the service implementation.
>
> Should I:
> 1. **Extend the repository interface first** to add casting support (6-8 hours), then migrate CastingService
> 2. **Defer Task 56** and move to Task 52 (BandService) which has full repository support
> 3. **Keep tests only** and mark CastingService as using direct Dexie access for now"

### Long-term Planning

If casting is critical for MVP:
- **Week 3**: Add casting repository support
- **Week 4**: Migrate CastingService
- **Week 5**: Test casting sync in production mode

If casting is not critical for MVP:
- **Defer** to post-MVP
- Focus on core services (Songs, Bands, Setlists, Sessions, Memberships)
- Ship MVP without casting sync support

## Success Criteria

### Completed ✅
- [x] Comprehensive test suite created (16 tests)
- [x] All tests passing
- [x] Test patterns match SongService tests
- [x] Mock strategy working correctly
- [x] Edge cases covered

### Blocked ⚠️
- [ ] Service migrated to repository pattern (blocked - no repository methods)
- [ ] Repository methods available for casting
- [ ] Sync support for casting entities

### Not Started ❌
- [ ] Repository interface extended with casting methods
- [ ] SyncRepository implementation for casting
- [ ] Supabase schema verification for casting tables

## Conclusion

Task 56 demonstrates the importance of **dependency planning** in migration work. While the test suite is complete and valuable (16 passing tests), the actual migration cannot proceed without first extending the repository infrastructure.

**Next Steps**:
1. Consult with user on prioritization (Option 1 vs Option 2)
2. If Option 1: Create new task "Add Casting Repository Support" (prerequisite for Task 56)
3. If Option 2: Mark Task 56 as deferred, proceed with Task 52 (BandService)

---

**Document Status**: ✅ Complete
**Test Status**: ✅ 16/16 passing
**Migration Status**: ⚠️ Blocked (repository support needed)
**Recommendation**: Extend repository first OR defer task
