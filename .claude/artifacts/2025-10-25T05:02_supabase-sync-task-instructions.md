---
timestamp: 2025-10-25T05:02
type: Implementation Task Instructions
status: Complete
original_prompt: Come up with task-based set of instructions in @.claude/instructions for agents to implement the new Supabase with offline sync setup, including unit tests that can be built first (test-driven-development)
context: Created comprehensive TDD-focused task instructions for Supabase offline sync implementation
---

# Supabase Offline Sync Implementation - Task Instructions Summary

## Overview

I've created a comprehensive set of task-based instructions in `.claude/instructions/` for implementing the Supabase offline sync architecture described in the deployment plan (`2025-10-24T00:43_deployment-plan-local-first-sync.md`).

## What Was Created

### Core Instruction Files

Located in `/workspaces/rock-on/.claude/instructions/`:

1. **00-OVERVIEW.md** - Project context, architecture overview, success criteria, and how to use the instructions

2. **01-environment-setup.md** - Environment configuration with mode detection (local vs production), including:
   - Complete test suite (TDD approach)
   - Implementation of `appMode.ts` configuration
   - Environment file templates
   - Validation steps

3. **10-supabase-schema-design.md** - Complete PostgreSQL schema design, including:
   - Full SQL migration files (15+ tables)
   - Row Level Security (RLS) policies
   - Indexes for performance
   - Field mapping (snake_case ↔ camelCase)
   - Schema testing approach

4. **30-repository-pattern-implementation.md** - Repository pattern implementation, including:
   - `IDataRepository` interface
   - `LocalRepository` (Dexie wrapper)
   - `RemoteRepository` (Supabase wrapper)
   - Complete test suites for both
   - Field mapping utilities

5. **40-sync-engine-implementation.md** - Sync engine core implementation, including:
   - Queue management system
   - Online/offline handling
   - Conflict resolution (last-write-wins)
   - Retry logic
   - Background sync
   - Complete test suite

6. **TASK-INDEX.md** - Complete task inventory with:
   - 80+ tasks organized by phase
   - Status tracking (Complete/In Progress/Pending)
   - Priority levels (Critical/High/Medium/Low)
   - Time estimates for each task
   - Dependency graph
   - Critical path identification

## Task Organization

Tasks are numbered sequentially and grouped by phase:

- **00-09**: Setup and prerequisites
- **10-19**: Supabase infrastructure
- **20-29**: Authentication system
- **30-39**: Repository pattern
- **40-49**: Sync engine
- **50-59**: Service migration
- **60-69**: UI/UX updates
- **70-79**: Testing
- **80-89**: Deployment
- **90-99**: Documentation

## Key Features of These Instructions

### 1. Test-Driven Development (TDD)

Every task includes:
- **Complete test code FIRST** - Tests are written before implementation
- **Vitest-based unit tests** - Using the project's testing framework
- **Acceptance criteria** - Clear definition of done
- **Validation steps** - How to verify success

### 2. Incremental Implementation

- Tasks build on each other logically
- Clear dependencies identified
- Small, testable increments
- No breaking changes to existing code

### 3. Dual-Mode Architecture

All tasks support:
- **Local development mode**: Mock auth + Dexie only (no Supabase needed)
- **Production mode**: Real auth + Dexie + Supabase sync
- Mode detection via environment variables

### 4. Complete Code Examples

Each task provides:
- Full TypeScript implementation
- SQL migration files
- Test code
- Configuration examples
- Validation commands

## Implementation Timeline

### Phase 1: Foundation (Week 1)
- Environment setup (Task 01)
- Supabase schema (Task 10)
- Authentication system (Tasks 20-26)

**Deliverable**: Local dev still works, Supabase schema deployed

### Phase 2: Repository Layer (Week 2)
- Repository interfaces (Task 30)
- LocalRepository (refactor existing Dexie code)
- RemoteRepository (new Supabase integration)
- Field mapping utilities

**Deliverable**: Can read/write from both Dexie and Supabase independently

### Phase 3: Sync Engine (Week 3)
- Sync queue infrastructure (Task 40)
- Background sync implementation
- Conflict resolution
- Online/offline handling

**Deliverable**: Changes sync between local and remote

### Phase 4: Service Migration (Week 4)
- Migrate services to use repositories (Tasks 50-57)
- Update UI components
- Add sync status indicators

**Deliverable**: All services use new repository layer

### Phase 5: Testing & Deployment (Week 5)
- Integration testing (Tasks 70-78)
- Deployment to Vercel (Tasks 80-85)
- Documentation (Tasks 90-96)

**Deliverable**: Fully deployed production app with sync

## Critical Path (Must Complete)

The minimum tasks required for a working system:

1. ✅ Environment Setup (01)
2. ✅ Supabase Schema (10)
3. ⬜ Authentication System (20-23)
4. ✅ Repository Pattern (30)
5. ⬜ RemoteRepository Core (31-33)
6. ✅ Sync Engine (40-41)
7. ⬜ Service Migration (50-56)
8. ⬜ Basic UI Integration (60-61)
9. ⬜ Testing (70-76)
10. ⬜ Deployment (80-85)

**Estimated Time**: 140-180 hours (3.5-4.5 weeks full-time)

## Tasks Currently Complete

The following task files are ready to use:

- [x] **00-OVERVIEW.md** - Start here for context
- [x] **01-environment-setup.md** - Begin implementation here
- [x] **10-supabase-schema-design.md** - Next step after environment
- [x] **30-repository-pattern-implementation.md** - Core abstraction layer
- [x] **40-sync-engine-implementation.md** - Sync orchestration

## Tasks Still To Create

While the critical path is defined, the following tasks need instruction files created:

### High Priority (Need Soon)
- **11-supabase-seeding.md** - Test data for development
- **20-auth-system.md** - Dual-mode authentication
- **31-remote-repository-completion.md** - Finish all RemoteRepository methods
- **41-sync-repository.md** - SyncRepository implementation
- **50-service-migration-strategy.md** - How to migrate services
- **51-54**: Individual service migrations

### Medium Priority (Need Later)
- **60-63**: UI components for sync status
- **70-76**: Testing strategy and tests
- **80-85**: Deployment tasks

### Lower Priority (Nice to Have)
- **90-96**: Documentation tasks
- Advanced features (conflict UI, analytics, etc.)

## How Agents Should Use These Instructions

### For Each Task:

1. **Read the entire task file** - Understand context and objectives

2. **Write tests FIRST** (TDD approach):
   ```bash
   # Create test file as specified in task
   # Write all test cases
   # Run tests - they should fail (red)
   npm test path/to/test.ts
   ```

3. **Implement the solution**:
   - Follow implementation steps
   - Write code to make tests pass
   - Run tests frequently

4. **Validate**:
   - All tests pass (green)
   - Run type checking: `npm run type-check`
   - Run linting: `npm run lint`
   - Manual validation as specified

5. **Mark complete** and move to next task

### For Human Developers:

1. Review the deployment plan first
2. Read `00-OVERVIEW.md` for architecture understanding
3. Start with `01-environment-setup.md`
4. Follow tasks sequentially
5. Commit after each completed task
6. Update task index with progress

## Example: Getting Started

### Step 1: Review Architecture
```bash
# Read the deployment plan
cat .claude/artifacts/2025-10-24T00:43_deployment-plan-local-first-sync.md

# Read the overview
cat .claude/instructions/00-OVERVIEW.md
```

### Step 2: Set Up Environment
```bash
# Follow task 01
cat .claude/instructions/01-environment-setup.md

# Create test file first (TDD)
mkdir -p src/config/__tests__
# Write tests as specified in task

# Implement solution
mkdir -p src/config
# Write implementation

# Validate
npm test src/config/__tests__/appMode.test.ts
npm run type-check
```

### Step 3: Set Up Supabase
```bash
# Follow task 10
cat .claude/instructions/10-supabase-schema-design.md

# Install Supabase CLI
npm install -g supabase

# Create migrations
mkdir -p supabase/migrations
# Write SQL as specified in task

# Test locally
supabase start
supabase db reset
```

### Step 4: Continue Through Tasks
Follow the critical path sequentially, always writing tests before implementation.

## Testing Strategy

### Unit Tests (70%+ coverage expected)

Every component should have unit tests:
- Repositories (local and remote)
- Sync engine
- Services
- Utilities

### Integration Tests

Test interactions between:
- Repository + Database
- Sync Engine + Repositories
- Services + Repositories

### E2E Tests

Test complete user flows:
- Offline song creation → sync → appears on other device
- Conflict resolution
- Auth flows

### Test Commands

```bash
# Run all tests
npm test

# Run specific test file
npm test path/to/test.ts

# Run tests in watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage

# Type check
npm run type-check

# Lint
npm run lint
```

## Directory Structure

After completing all tasks, the structure will be:

```
src/
├── config/
│   ├── appMode.ts              # Task 01 - Mode detection
│   └── __tests__/
│       └── appMode.test.ts
├── services/
│   ├── data/
│   │   ├── IDataRepository.ts  # Task 30 - Interface
│   │   ├── LocalRepository.ts  # Task 30 - Dexie wrapper
│   │   ├── RemoteRepository.ts # Task 31 - Supabase wrapper
│   │   ├── SyncRepository.ts   # Task 41 - Hybrid
│   │   ├── SyncEngine.ts       # Task 40 - Sync orchestration
│   │   ├── syncTypes.ts
│   │   └── __tests__/          # All repository tests
│   ├── supabase/
│   │   └── client.ts           # Task 30 - Supabase client
│   ├── auth/
│   │   ├── types.ts
│   │   ├── MockAuthService.ts  # Existing
│   │   ├── SupabaseAuthService.ts  # Task 21
│   │   └── AuthFactory.ts      # Task 23
│   └── database/
│       └── index.ts            # Updated in Task 40 (add sync tables)
├── hooks/
│   └── useSyncStatus.ts        # Task 42 - Sync status hook
└── components/
    └── SyncStatusIndicator.tsx # Task 61 - Sync UI

supabase/
├── migrations/
│   ├── 20251025000000_initial_schema.sql  # Task 10
│   └── 20251025000100_rls_policies.sql    # Task 10
├── seed.sql                    # Task 11
└── config.toml                 # Task 12

.env.local                      # Task 01 - Local development
.env.production.example         # Task 01 - Production template
```

## Key Principles Emphasized

1. **Local-First Architecture**
   - All reads from local (instant)
   - All writes to local first (optimistic UI)
   - Sync happens in background

2. **Test-Driven Development**
   - Write tests before implementation
   - Red → Green → Refactor cycle
   - High test coverage

3. **Incremental Migration**
   - No big-bang rewrites
   - One service at a time
   - Preserve existing functionality

4. **Mode Awareness**
   - Support local dev without Supabase
   - Support production with sync
   - Automatic mode detection

5. **Graceful Degradation**
   - App works offline
   - App works if Supabase is down
   - Queued changes sync when back online

## Success Metrics

After completing all tasks:

- [ ] App works 100% offline
- [ ] Changes sync to cloud when online
- [ ] Multiple devices can sync same band
- [ ] Local dev works without Supabase credentials
- [ ] Deployed to Vercel with Supabase integration
- [ ] Google OAuth working in production
- [ ] 70%+ test coverage
- [ ] Zero TypeScript errors
- [ ] All critical path tasks complete

## Next Steps for Implementation

### Immediate Actions:
1. Review `00-OVERVIEW.md`
2. Complete `01-environment-setup.md`
3. Set up Supabase project (dev account)
4. Complete `10-supabase-schema-design.md`

### This Week:
1. Complete all infrastructure tasks (01, 10-12)
2. Create auth task files (20-26)
3. Complete authentication implementation

### This Month:
1. Complete repository layer (30-38)
2. Complete sync engine (40-47)
3. Begin service migration (50+)

## Resources

### Documentation
- Deployment Plan: `.claude/artifacts/2025-10-24T00:43_deployment-plan-local-first-sync.md`
- Task Index: `.claude/instructions/TASK-INDEX.md`
- Overview: `.claude/instructions/00-OVERVIEW.md`

### External Resources
- [Supabase Documentation](https://supabase.com/docs)
- [Dexie Documentation](https://dexie.org/)
- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)

### Current Codebase References
- Current Database: `src/services/database/index.ts`
- Current Auth: `src/contexts/AuthContext.tsx`
- Example Service: `src/services/PracticeSessionService.ts`
- Models: `src/models/*.ts`

## Conclusion

These task instructions provide a complete, test-driven roadmap for implementing the Supabase offline sync architecture. Each task is designed to be:

- **Self-contained**: Can be completed independently
- **Testable**: Clear acceptance criteria
- **Incremental**: Small, safe changes
- **Reversible**: Can be rolled back if needed

The critical path is clearly defined, with estimated times and dependencies. Agents can follow these instructions sequentially to transform Rock On from a local-only app to a production-ready, cloud-synced, offline-capable band management system.

---

**Total Tasks**: 80+
**Complete**: 5 tasks (critical foundation)
**Estimated Effort**: 4-5 weeks full-time
**Next Action**: Start with `01-environment-setup.md`
