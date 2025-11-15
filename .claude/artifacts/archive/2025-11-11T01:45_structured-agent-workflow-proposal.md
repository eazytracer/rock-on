---
created: 2025-11-11T01:45
updated: 2025-11-11T06:00
type: proposal
status: phase-1-complete
priority: high
---

# Structured Agent Workflow Proposal: Research → Plan → Execute → Test Loop

> **Status Update (2025-11-11T06:00):** ✅ **Phase 1 Complete!** All 7 agent definition files have been created with MCP tool integration documented. See Implementation Checklist below for progress.

### Completed Deliverables (Phase 1)

**Agent Definition Files:**
1. `.claude/agents/research-agent.md` - Gather context and requirements
2. `.claude/agents/plan-agent.md` - Create implementation plans
3. `.claude/agents/execute-agent.md` - Orchestrate TDD implementation
4. `.claude/agents/supabase-agent.md` - Database specialist (migrations, RLS, pgTAP)
5. `.claude/agents/test-agent.md` - Integration & E2E testing
6. `.claude/agents/diagnose-agent.md` - Root cause analysis for failures
7. `.claude/agents/finalize-agent.md` - Documentation cleanup & git workflow

**MCP Integration:**
- `.claude/artifacts/2025-11-11T04:57_mcp-integration-plan.md` - Comprehensive MCP integration plan with registration commands (`claude mcp add`)

**Features:**
- All agents have MCP tool documentation (which tools, when to use, why)
- No CLI invocation references (tools accessed automatically after registration)
- Quality gates and error handling for each agent
- Workflow decision trees and loop-back patterns
- TODO pattern for documentation during development

## Executive Summary

This proposal outlines a structured, repeatable agent workflow for the Rock-On project that transforms the current ad-hoc development process into a formalized research → plan → execute → test loop. The system uses specialized agents with clear handoffs via markdown documents, enforces TDD during execution, and automatically loops back to research when tests fail.

**Key Benefits:**
1. **Repeatable Process:** Every feature follows the same proven workflow
2. **Clear Handoffs:** Each agent produces standardized markdown outputs for the next stage
3. **Quality Gates:** Tests must pass before moving to the next feature
4. **Context Preservation:** Full traceability from initial research through deployment
5. **Failure Recovery:** Automatic loop-back to research when issues are discovered

---

## Current State Analysis

### What's Working Well

From analyzing `.claude/` structure:

**✅ Documentation Practices:**
- Timestamped artifacts for tracking completed work
- Comprehensive specifications (testing, database schema, workflows)
- Detailed instruction files with numbered tasks
- Slash commands for common operations

**✅ Testing Infrastructure:**
- 336 pgTAP database tests (schema, RLS, triggers)
- 73 unit tests with Vitest
- Playwright E2E framework configured
- Clear testing strategy document

**✅ Existing Agents:**
- `project-orchestrator` - Breaks down complex features into work units
- `nextjs-react-developer` - Creates/modifies React components

### What Needs Improvement

**❌ Process Gaps:**
- No formal research phase (agents jump straight to coding)
- Planning happens ad-hoc, not consistently documented
- TDD mentioned in CLAUDE.md but not enforced in workflow
- Integration/E2E testing done manually, not by dedicated agent
- No formal feedback loop from test failures to research

**❌ Context Handoffs:**
- Agents don't produce standardized handoff documents
- Hard to resume work if interrupted
- Context scattered across artifacts, specs, and instructions
- No single source of truth for "current feature state"

---

## Documentation TODO Pattern

### Problem
Specifications need to be updated as work progresses, but we don't want work-in-progress markers committed to the repository. Agents need a way to track planned changes without creating messy final documentation.

### Solution: TODO Markers During Development

**Rule:** Any agent modifying specification files during active development must use TODO markers for planned changes.

**Pattern:**
```markdown
## Database Schema

### Songs Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| title | TEXT | Song title |
<!-- TODO: Add 'favorite_count' column (INTEGER) - tracks how many users favorited -->
| created_date | TIMESTAMP | Creation timestamp |

<!-- TODO: Document new 'song_favorites' table:
- id (UUID)
- song_id (UUID, FK to songs)
- user_id (UUID, FK to users)
- created_date (TIMESTAMP)
-->
```

**Checklist Pattern:**
```markdown
## Implementation Status

- [x] Create migration file
- [x] Add song_favorites table
- [ ] Update RemoteRepository field mappings
- [ ] Add useFavorites hook
- [ ] Update SongsPage UI

<!-- TODO: Remove this checklist before finalization -->
```

### Agent Responsibilities

**Plan Agent:**
- Adds TODO comments to specs for planned changes
- Marks sections with `<!-- TODO: Update after implementation -->`
- Documents what WILL change, not what HAS changed

**Supabase Agent:**
- Resolves database-related TODOs as migrations are created
- Updates unified-database-schema.md, removing TODOs and adding actual schema
- Adds new TODOs if schema evolves during implementation

**Execute Agent:**
- Updates specs as features are implemented
- Resolves TODOs when corresponding code is written
- Adds new TODOs if implementation reveals additional needed changes

**Finalize Agent (CRITICAL):**
- Scans ALL specification files for remaining TODOs
- Ensures all TODOs are resolved or removed
- Removes all checklists and work-in-progress markers
- Ensures final committed documentation is clean and professional
- **BLOCKS merge if TODOs remain in specs**

### Example Workflow

**Initial (Plan Agent):**
```markdown
## Songs API

### Endpoints

- GET /songs - List all songs
- POST /songs - Create new song
<!-- TODO: Add GET /songs/favorites endpoint -->

<!-- TODO: Document favorites data model -->
```

**During Implementation (Execute Agent):**
```markdown
## Songs API

### Endpoints

- GET /songs - List all songs
- POST /songs - Create new song
- GET /songs/favorites - List user's favorite songs ✓

### Data Models

#### SongFavorite
```typescript
interface SongFavorite {
  id: string
  songId: string
  userId: string
  createdDate: Date
}
```

<!-- TODO: Remove this section marker before finalization -->
```

**Final (Finalize Agent):**
```markdown
## Songs API

### Endpoints

- GET /songs - List all songs
- POST /songs - Create new song
- GET /songs/favorites - List user's favorite songs

### Data Models

#### SongFavorite
```typescript
interface SongFavorite {
  id: string
  songId: string
  userId: string
  createdDate: Date
}
```
```

### Finalize Agent TODO Scan

The Finalize Agent must run this check:

```bash
# Scan all specification files for TODOs
grep -r "TODO" .claude/specifications/

# If any found, report and block finalization
# Agent must either:
# 1. Resolve the TODO (complete the work)
# 2. Remove the TODO if no longer relevant
# 3. Move TODO to backlog/future work document
```

**Finalize Agent Cleanup Checklist:**
- [ ] Scan `.claude/specifications/` for `<!-- TODO -->`
- [ ] Scan `.claude/specifications/` for `- [ ]` (incomplete checklists)
- [ ] Remove work-in-progress markers
- [ ] Remove implementation status sections
- [ ] Ensure all code examples are accurate
- [ ] Verify all links work
- [ ] Ensure consistent formatting
- [ ] **BLOCK finalization if any TODOs remain**

### Benefits

1. **Work-in-Progress Transparency:** TODOs show what's planned vs implemented
2. **Clean Final Docs:** Finalize Agent ensures professional, complete documentation
3. **Audit Trail:** Git history shows evolution of specs through TODO resolution
4. **Quality Gate:** Can't merge with unresolved TODOs
5. **Clear Ownership:** Each agent knows when to add/resolve TODOs

---

## Proposed Agent Workflow Architecture

### Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                       FEATURE REQUEST                            │
│                  (User describes new feature)                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │  1. RESEARCH   │
                    │     AGENT      │
                    └────────┬───────┘
                             │ Produces: research.md
                             ▼
                    ┌────────────────┐
                    │   2. PLAN      │
                    │     AGENT      │
                    └────────┬───────┘
                             │ Produces: plan.md, tasks.md
                             ▼
                    ┌────────────────┐
                    │  3. EXECUTE    │
                    │     AGENT      │
                    └────────┬───────┘
                             │ Produces: implementation.md + code
                             ▼
                    ┌────────────────┐
                    │   4. TEST      │
                    │     AGENT      │
                    └────────┬───────┘
                             │ Produces: test-report.md
                             ▼
                    ┌────────────────┐
                    │  Tests Pass?   │
                    └────────┬───────┘
                          ┌──┴──┐
                      YES │     │ NO
                          │     │
                          │     └──────┐
                          │            ▼
                          │   ┌────────────────┐
                          │   │  5. DIAGNOSE   │
                          │   │     AGENT      │
                          │   └────────┬───────┘
                          │            │ Updates research.md
                          │            │
                          │            └──────> Back to PLAN
                          │
                          ▼
                 ┌────────────────┐
                 │  DONE - Ready  │
                 │  for next      │
                 │  feature       │
                 └────────────────┘
```

---

## Agent Definitions

### 1. Research Agent

**Purpose:** Gather context, understand requirements, identify constraints and risks

**Inputs:**
- Feature request from user
- Existing specifications
- Codebase analysis
- Test failure reports (if looping back)

**Responsibilities:**
1. Search codebase for related functionality
2. Read relevant specifications and artifacts
3. Identify affected components and files
4. Document dependencies and constraints
5. Flag potential risks and edge cases
6. Suggest technical approaches
7. List open questions for user clarification

**Output:** `research.md` containing:

```markdown
---
feature: [Feature Name]
created: [Timestamp]
status: research-complete
---

# Research: [Feature Name]

## Feature Request Summary
[Concise description of what user wants]

## Codebase Analysis
### Related Components
- [Component path] - [What it does]

### Affected Files
- [File path] - [What needs to change]

### Dependencies
- [Dependency] - [Why it matters]

## Technical Context
### Existing Patterns
[How similar features are implemented]

### Database Schema
[Relevant tables and relationships from unified-database-schema.md]

### Testing Requirements
[What types of tests are needed]

## Risk Analysis
### High Risk
- [Risk] - [Mitigation strategy]

### Medium Risk
- [Risk] - [Mitigation strategy]

## Open Questions
1. [Question for user]
2. [Question for user]

## Recommended Approach
[Suggested implementation strategy]

## Next Steps
Ready for planning phase: [Yes/No]
If No: [What clarification is needed]
```

**Agent Configuration:**
```markdown
---
name: research-agent
description: Gather context and analyze requirements for new features
model: sonnet
---

You are a Research Agent specialized in understanding feature requirements and analyzing codebases. Your goal is to provide comprehensive context for planning and implementation.

## Your Process

1. **Understand the Request:**
   - Read the user's feature request carefully
   - Identify core requirements vs nice-to-haves
   - Clarify ambiguities with AskUserQuestion tool

2. **Search the Codebase:**
   - Use Explore agent for related components
   - Grep for relevant patterns and similar features
   - Read database schema specifications
   - Check existing tests for context

3. **Analyze Dependencies:**
   - Map affected components
   - Identify database table changes
   - Flag breaking changes
   - Check for integration points

4. **Document Findings:**
   - Create research.md with standardized format
   - Include file paths with line numbers
   - Document risks and mitigation strategies
   - List open questions requiring clarification

5. **Quality Gates:**
   - All open questions answered before marking complete
   - At least 3 related components identified
   - Database impact documented
   - Testing approach outlined

## Output Requirements

Your research.md must include:
- Clear feature summary
- List of affected files with line numbers
- Database schema changes (reference unified-database-schema.md)
- Risk analysis (high, medium, low)
- Open questions for user
- Recommended approach
- Ready for planning: Yes/No

Never proceed to planning if significant ambiguity remains.
```

---

### 2. Plan Agent

**Purpose:** Create detailed implementation plan with architecture, file structure, and task breakdown

**Inputs:**
- `research.md` from Research Agent
- User answers to open questions
- Existing specifications

**Responsibilities:**
1. Design architecture and data flow
2. Define file structure (new files, modified files)
3. Create API contracts if needed
4. Break down work into discrete tasks
5. Order tasks by dependencies
6. Identify parallel vs sequential work
7. Specify test requirements for each task

**Output:**
- `plan.md` - Architecture and design decisions
- `tasks.md` - Actionable task breakdown

**plan.md Format:**

```markdown
---
feature: [Feature Name]
created: [Timestamp]
status: plan-complete
based-on: [research.md filename]
---

# Implementation Plan: [Feature Name]

## Architecture Overview
[High-level design with ASCII diagrams]

## Tech Stack
- Frontend: [Technologies]
- Backend/Services: [Technologies]
- Database: [Changes needed]
- Testing: [Test types]

## File Structure

### New Files
```
src/
  ├── components/[Component].tsx - [Purpose]
  └── services/[Service].ts - [Purpose]
tests/
  ├── unit/[Test].test.ts - [What it tests]
  └── e2e/[E2E Test].spec.ts - [User flow]
```

### Modified Files
- `src/path/to/file.ts:123` - [What changes]
- `supabase/migrations/[timestamp]_[name].sql` - [Schema change]

## Data Model Changes

### Database Tables
[Reference to unified-database-schema.md]

### New Columns
| Table | Column | Type | Purpose |
|-------|--------|------|---------|

### Migrations
- Migration file: `[timestamp]_[description].sql`
- Changes: [What it modifies]

## API Contracts

### New Endpoints/Functions
[If applicable]

## Component Architecture

### Component Tree
```
[ParentComponent]
  ├── [ChildComponent] - [Props]
  └── [ChildComponent] - [Props]
```

### State Management
[How state flows through components]

## Testing Strategy

### Unit Tests Required
1. [Component/Service] - [What behavior to test]

### Integration Tests Required
1. [Integration point] - [What to validate]

### E2E Tests Required
1. [User flow] - [Steps to automate]

## Implementation Notes
[Design decisions, trade-offs, patterns to follow]

## Non-Goals
[What we're explicitly NOT doing]
```

**tasks.md Format:**

```markdown
---
feature: [Feature Name]
created: [Timestamp]
status: ready-for-execution
based-on: [plan.md filename]
---

# Task Breakdown: [Feature Name]

## Execution Rules
1. Tasks marked [P] can run in parallel
2. Tasks without [P] must run sequentially
3. Test tasks must run BEFORE implementation tasks
4. All unit tests must pass before moving to next phase
5. Mark tasks with [X] when complete

---

## Phase 1: Setup (Sequential)

### Task 1.1: Database Migration
- [ ] Create migration file: `supabase/migrations/[timestamp]_[name].sql`
- [ ] Add table/column definitions
- [ ] Run `supabase db reset` to test locally
- [ ] Run `npm run test:db` to validate schema
- **Files:** `supabase/migrations/`
- **Acceptance:** pgTAP tests pass

### Task 1.2: Update Schema Documentation
- [ ] Update `unified-database-schema.md` with new fields
- [ ] Document IndexedDB ↔ Supabase mappings
- **Files:** `.claude/specifications/unified-database-schema.md`
- **Acceptance:** Schema doc matches migration

---

## Phase 2: Tests (TDD Approach)

### Task 2.1: Write Unit Tests [P]
- [ ] Create test file: `tests/unit/[path]/[Component].test.ts`
- [ ] Test case 1: [Description]
- [ ] Test case 2: [Description]
- [ ] Run `npm test -- [test file]` to verify they fail
- **Files:** `tests/unit/`
- **Acceptance:** Tests written and fail (no implementation yet)

### Task 2.2: Write Integration Test Contracts [P]
- [ ] Create test file: `tests/integration/[Feature].test.ts`
- [ ] Define integration test scenarios
- [ ] Run tests to verify they fail
- **Files:** `tests/integration/`
- **Acceptance:** Tests written and fail

---

## Phase 3: Core Implementation (Sequential unless marked [P])

### Task 3.1: Implement Service Layer
- [ ] Create/modify service file: `src/services/[Service].ts`
- [ ] Implement function 1: [Name]
- [ ] Implement function 2: [Name]
- [ ] Run unit tests: `npm test -- [test file]`
- **Files:** `src/services/`
- **Acceptance:** Unit tests pass

### Task 3.2: Implement Component [P]
- [ ] Create component: `src/components/[Component].tsx`
- [ ] Add testability attributes (data-testid, id, name)
- [ ] Implement props and state
- [ ] Run component tests
- **Files:** `src/components/`
- **Acceptance:** Component renders, tests pass

### Task 3.3: Wire up Repository Layer
- [ ] Update `RemoteRepository.ts` with new field mappings
- [ ] Update `LocalRepository.ts` with IndexedDB schema
- [ ] Run integration tests
- **Files:** `src/services/data/`
- **Acceptance:** Integration tests pass

---

## Phase 4: Integration (Sequential)

### Task 4.1: Connect Components to Services
- [ ] Wire component to service layer
- [ ] Add error handling
- [ ] Add loading states
- [ ] Test manually in browser
- **Files:** [Component files]
- **Acceptance:** Feature works in dev environment

### Task 4.2: Update Navigation/Routing
- [ ] Add route if needed
- [ ] Update navigation components
- [ ] Test navigation flow
- **Files:** `src/pages/`, `src/components/layout/`
- **Acceptance:** User can access feature

---

## Phase 5: Polish (Parallel OK)

### Task 5.1: Add Loading/Error States [P]
- [ ] Implement skeleton loaders
- [ ] Add error boundaries
- [ ] Test error scenarios
- **Files:** [Component files]
- **Acceptance:** UX handles edge cases gracefully

### Task 5.2: Accessibility & Testability [P]
- [ ] Verify all inputs have id, name, data-testid
- [ ] Add aria labels
- [ ] Test keyboard navigation
- **Files:** [Component files]
- **Acceptance:** Meets testability standards (see CLAUDE.md)

### Task 5.3: Update Documentation [P]
- [ ] Create artifact: `[timestamp]_[feature]_implementation-summary.md`
- [ ] Update CLAUDE.md if needed (new patterns, commands)
- **Files:** `.claude/artifacts/`
- **Acceptance:** Work is documented

---

## Phase 6: Ready for Test Agent

All tasks above must be complete and unit tests passing before handing off to Test Agent.

**Handoff Checklist:**
- [X] All tasks marked complete
- [X] `npm test` passes (unit tests)
- [X] `npm run test:db` passes (database tests)
- [X] `npm run build` succeeds
- [X] Feature works in local dev environment
- [X] Implementation summary artifact created

**Next Step:** Test Agent runs integration and E2E tests
```

**Agent Configuration:**

```markdown
---
name: plan-agent
description: Create detailed implementation plans with architecture and task breakdown
model: sonnet
---

You are a Planning Agent specialized in software architecture and breaking down features into executable tasks.

## Your Process

1. **Review Research:**
   - Read research.md thoroughly
   - Understand constraints and dependencies
   - Review recommended approach

2. **Design Architecture:**
   - Sketch component hierarchy
   - Define data flow
   - Plan database changes
   - Design API contracts

3. **Create File Structure:**
   - List all new files needed
   - List all files to modify with line numbers
   - Verify against project structure conventions

4. **Break Down Tasks:**
   - Create discrete, testable tasks
   - Order by dependencies
   - Mark parallel tasks with [P]
   - Follow TDD: tests before implementation

5. **Quality Gates:**
   - Every task has clear acceptance criteria
   - Database changes include migration file name
   - Testing requirements specified for each phase
   - File paths are absolute and accurate

## Output Requirements

You must produce TWO files:

### plan.md
- Architecture diagrams (ASCII art)
- File structure (new + modified files)
- Database schema changes
- Testing strategy
- Design decisions documented

### tasks.md
- 6 phases: Setup → Tests → Core → Integration → Polish → Handoff
- Tasks ordered by dependencies
- Parallel tasks marked [P]
- Each task has file paths and acceptance criteria
- Follows TDD approach (tests before implementation)

## Constraints

- Follow testability standards from CLAUDE.md
- Reference unified-database-schema.md for database work
- Use existing design patterns from design-style-guide.md
- Pre-1.0: Modify baseline migration, don't create new ones
- All form inputs need: id, name, data-testid

Never create vague tasks like "implement feature". Tasks must be concrete and verifiable.
```

---

### 3. Execute Agent (TDD Developer)

**Purpose:** Implement the feature following TDD practices, executing tasks from tasks.md

**Inputs:**
- `plan.md` - Architecture and design
- `tasks.md` - Ordered task list
- `research.md` - Context and constraints

**Responsibilities:**
1. Execute tasks in order from tasks.md
2. Write tests BEFORE writing implementation code (TDD)
3. Mark tasks as complete ([X]) in tasks.md
4. Run tests after each task completion
5. Document implementation decisions
6. Handle errors and unexpected issues
7. Create implementation summary artifact

**Output:**
- Code changes (new files, modified files)
- Updated `tasks.md` with [X] marks
- `implementation.md` - Summary of work done

**implementation.md Format:**

```markdown
---
feature: [Feature Name]
created: [Timestamp]
status: implementation-complete
based-on: [tasks.md filename]
---

# Implementation Summary: [Feature Name]

## Overview
[What was implemented]

## Tasks Completed

### Phase 1: Setup
- [X] Task 1.1: Database Migration
  - Created: `supabase/migrations/[timestamp]_[name].sql`
  - Added columns: [list]
  - pgTAP tests: ✅ Passing

### Phase 2: Tests (TDD)
- [X] Task 2.1: Unit Tests
  - File: `tests/unit/[path]/[name].test.ts`
  - Test cases: 5
  - Initial status: ❌ All failing (expected)
  - After implementation: ✅ All passing

### Phase 3: Core Implementation
- [X] Task 3.1: Service Layer
  - File: `src/services/[Service].ts`
  - Functions: [list]
  - Tests: ✅ Passing

[Continue for all phases...]

## Files Changed

### New Files (5)
1. `src/components/[Component].tsx` - [Purpose]
2. `src/services/[Service].ts` - [Purpose]
3. `tests/unit/[Test].test.ts` - [Tests]
4. `tests/e2e/[E2E].spec.ts` - [E2E tests]
5. `supabase/migrations/[timestamp]_[name].sql` - [Migration]

### Modified Files (3)
1. `src/services/data/RemoteRepository.ts:245` - Added [field] mapping
2. `src/pages/[Page].tsx:123` - Integrated [component]
3. `.claude/specifications/unified-database-schema.md` - Updated schema

## Test Results

### Unit Tests
```
✅ 78 passing (was 73)
❌ 0 failing
Time: 2.5s
```

### Database Tests
```
✅ 336 passing
Time: 35s
```

### Build
```
✅ Build successful
Time: 12s
```

## Implementation Decisions

### Decision 1: [Title]
**Context:** [Why decision was needed]
**Options Considered:**
- Option A: [Pros/Cons]
- Option B: [Pros/Cons]
**Decision:** [What was chosen]
**Rationale:** [Why]

## Issues Encountered

### Issue 1: [Description]
**Problem:** [What went wrong]
**Root Cause:** [Why it happened]
**Solution:** [How it was fixed]
**Files Affected:** [List]

## Known Limitations

1. [Limitation] - [Why it exists] - [Future work needed]

## Manual Testing Checklist

Tested in local dev environment:
- [X] Feature renders without errors
- [X] Happy path works (primary use case)
- [X] Error handling works
- [X] Loading states appear correctly
- [X] Mobile responsive
- [ ] Edge cases (need E2E tests)
- [ ] Multi-user scenarios (need E2E tests)

## Handoff to Test Agent

**Status:** Ready for integration and E2E testing

**Test Scenarios Needed:**
1. [User flow 1] - [What to test]
2. [User flow 2] - [What to test]

**Risk Areas:**
1. [Area] - [Why it's risky]

**Next Steps:** Test Agent to run full integration and E2E test suite
```

**Agent Configuration:**

```markdown
---
name: execute-agent
description: Implement features using TDD, following task breakdown from plan
model: sonnet
---

You are an Execute Agent specialized in Test-Driven Development (TDD) and implementing features according to detailed plans.

## Your Process

1. **Load Context:**
   - Read tasks.md for complete task list
   - Read plan.md for architecture decisions
   - Read research.md for constraints
   - Check CLAUDE.md for project conventions

2. **Execute Tasks in Order:**
   - Start with Phase 1 (Setup)
   - Follow dependency order
   - Execute parallel tasks [P] together when possible
   - Mark tasks [X] as you complete them

3. **TDD Workflow:**
   ```
   For each feature:
   1. Write failing test first
   2. Run test to verify it fails
   3. Write minimal code to pass test
   4. Run test to verify it passes
   5. Refactor if needed
   6. Move to next test
   ```

4. **Quality Gates:**
   - Run `npm test` after each implementation task
   - Run `npm run test:db` after schema changes
   - Run `npm run build` periodically to catch integration issues
   - Never mark task complete if tests fail

5. **Document as You Go:**
   - Update tasks.md with [X] marks
   - Track issues encountered
   - Document implementation decisions
   - Note deviations from plan

6. **Create Implementation Summary:**
   - Produce implementation.md at end
   - List all files changed
   - Document test results
   - Identify areas needing E2E tests

## Coding Standards

### Testability (CRITICAL)
Every form input must have:
- `id` attribute (kebab-case, for label association)
- `name` attribute (camelCase, for form functionality)
- `data-testid` attribute (format: `{context}-{field}-{type}`)

Every button must have:
- `data-testid` attribute

### Testing Requirements
- Unit tests go in `tests/unit/` mirroring `src/` structure
- Integration tests go in `tests/integration/`
- E2E tests go in `tests/e2e/`
- Database tests go in `supabase/tests/`

### Database Rules (Pre-1.0)
- Modify baseline migration directly: `20251106000000_baseline_schema.sql`
- Don't create new migration files
- Update unified-database-schema.md to match
- Run `supabase db reset` to test
- Run `npm run test:db` to validate

## Error Handling

If a task fails:
1. Document the failure in implementation.md
2. Try to fix (up to 2 attempts)
3. If unfixable, mark task as blocked
4. Continue with non-dependent tasks
5. Flag for Diagnose Agent if pattern unclear

## Output Requirements

You must produce:
1. **Code changes** (new/modified files)
2. **Updated tasks.md** with [X] marks
3. **implementation.md** with:
   - Tasks completed
   - Files changed (with line numbers)
   - Test results
   - Issues encountered
   - Manual testing done
   - Handoff checklist

## Success Criteria

Before handing off to Test Agent:
- ✅ All tasks marked complete [X]
- ✅ `npm test` passes (unit tests)
- ✅ `npm run test:db` passes (database tests)
- ✅ `npm run build` succeeds
- ✅ Manual testing shows feature works
- ✅ implementation.md created

Never hand off broken code to Test Agent. Fix issues or document blockers.
```

---

### 4. Test Agent (Integration & E2E)

**Purpose:** Run comprehensive integration and E2E tests, validate feature works end-to-end

**Inputs:**
- `implementation.md` - What was built
- `plan.md` - Testing strategy
- `tasks.md` - Test requirements

**Responsibilities:**
1. Run integration tests
2. Run E2E tests with Playwright
3. Test cross-browser compatibility
4. Validate RLS policies with real user flows
5. Check for console errors
6. Verify mobile responsiveness
7. Document test results
8. Identify failures and root causes

**Output:** `test-report.md`

**test-report.md Format:**

```markdown
---
feature: [Feature Name]
created: [Timestamp]
status: [passing / failing / blocked]
based-on: [implementation.md filename]
---

# Test Report: [Feature Name]

## Test Summary

**Overall Status:** [✅ PASSING / ❌ FAILING / ⚠️ PARTIAL]

| Test Type | Total | Passed | Failed | Skipped |
|-----------|-------|--------|--------|---------|
| Integration | 5 | 5 | 0 | 0 |
| E2E | 8 | 6 | 2 | 0 |
| **Total** | **13** | **11** | **2** | **0** |

---

## Integration Tests

### Passing Tests (5)

#### Test 1: [Service Integration]
- **File:** `tests/integration/[Test].test.ts`
- **Description:** [What it tests]
- **Result:** ✅ PASSED
- **Duration:** 250ms

[Continue for all passing tests...]

### Failing Tests (0)
None

---

## E2E Tests (Playwright)

### Configuration
- **Browsers:** Chromium, Firefox, WebKit
- **Base URL:** http://localhost:5173
- **Supabase:** Local (http://localhost:54321)
- **Screenshot on Fail:** Yes
- **Video on Fail:** Yes

### Passing Tests (6)

#### Test 1: New User Sign Up → Create Band
- **File:** `tests/e2e/auth/create-band.spec.ts`
- **User Flow:**
  1. Navigate to /auth
  2. Sign up with email/password
  3. Redirected to /get-started
  4. Enter band name
  5. Click "Create Band"
  6. Verify band created
  7. Verify user is owner
- **Browsers Tested:** ✅ Chrome ✅ Firefox ✅ Safari
- **Result:** ✅ PASSED
- **Duration:** 3.2s

[Continue for all passing tests...]

### Failing Tests (2)

#### Test 7: Admin Removes Member
- **File:** `tests/e2e/band-members/remove-member.spec.ts`
- **User Flow:**
  1. Admin navigates to Band Members
  2. Clicks on member to remove
  3. Clicks "Remove from Band"
  4. ❌ **FAILED HERE:** Confirmation dialog doesn't appear
- **Browsers Tested:** ❌ Chrome ❌ Firefox ❌ Safari
- **Result:** ❌ FAILED
- **Error:**
  ```
  TimeoutError: Waiting for selector `[data-testid="remove-member-confirm-dialog"]` failed: timeout 5000ms exceeded
  ```
- **Screenshot:** `test-results/remove-member-fail.png`
- **Root Cause Analysis:**
  - Dialog component missing data-testid attribute
  - File: `src/components/modals/ConfirmDialog.tsx:45`
  - Fix needed: Add `data-testid="confirm-dialog"` to dialog root

#### Test 8: Multi-User Realtime Sync
- **File:** `tests/e2e/sync/multi-user-sync.spec.ts`
- **User Flow:**
  1. User A creates song
  2. User B should see song appear in real-time
  3. ❌ **FAILED:** User B doesn't see update
- **Browsers Tested:** ❌ Chrome ❌ Firefox ❌ Safari
- **Result:** ❌ FAILED
- **Error:**
  ```
  Timeout: Song "Test Song" never appeared in User B's song list after 10s
  ```
- **Console Errors:**
  ```
  RealtimeManager.ts:123 - Subscription not established for songs table
  ```
- **Root Cause Analysis:**
  - Realtime subscription not triggered for new band members
  - Possible issue in RealtimeManager.subscribeToTable()
  - Needs investigation by Diagnose Agent

---

## Cross-Browser Results

| Test | Chrome | Firefox | Safari (WebKit) |
|------|--------|---------|-----------------|
| Create Band | ✅ | ✅ | ✅ |
| Join Band | ✅ | ✅ | ✅ |
| Add Song | ✅ | ✅ | ✅ |
| Edit Song | ✅ | ✅ | ✅ |
| Create Setlist | ✅ | ✅ | ✅ |
| Schedule Show | ✅ | ✅ | ✅ |
| Remove Member | ❌ | ❌ | ❌ |
| Realtime Sync | ❌ | ❌ | ❌ |

---

## Mobile Testing

### Responsive Breakpoints
- **Mobile:** 375px (iPhone SE)
- **Tablet:** 768px (iPad)
- **Desktop:** 1920px

### Mobile Test Results

#### Test: Create Band on Mobile
- **Device:** iPhone 12 Emulation
- **Result:** ✅ PASSED
- **Notes:**
  - Modal displays full-screen (correct)
  - Touch targets meet 44px minimum
  - Keyboard doesn't overlap inputs

#### Test: Remove Member on Mobile
- **Device:** iPhone 12 Emulation
- **Result:** ❌ FAILED (same issue as desktop)

---

## Performance Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Time to Interactive | <3s | 1.8s | ✅ |
| First Contentful Paint | <1.5s | 0.9s | ✅ |
| Largest Contentful Paint | <2.5s | 2.1s | ✅ |
| API Response Time (avg) | <200ms | 145ms | ✅ |

---

## Security Validation

### RLS Policy Testing

#### Test: Band Isolation
- **Scenario:** User A should not see User B's band data
- **Test File:** `tests/e2e/security/band-isolation.spec.ts`
- **Result:** ✅ PASSED
- **Validation:**
  - User A created band "Band A"
  - User B created band "Band B"
  - User A cannot see "Band B" in band selector
  - User A's song list doesn't show User B's songs
  - Network tab confirms 0 requests return data from "Band B"

#### Test: Role-Based Permissions
- **Scenario:** Member cannot delete songs
- **Test File:** `tests/e2e/security/role-permissions.spec.ts`
- **Result:** ✅ PASSED
- **Validation:**
  - Member user cannot see "Delete Song" button
  - Direct API call to delete endpoint returns 403
  - RLS policy correctly blocks unauthorized deletion

---

## Console Errors

### Critical Errors (2)
1. **RealtimeManager.ts:123**
   ```
   Subscription not established for songs table
   ```
   - Impact: Realtime sync doesn't work
   - Affects: Multi-user scenarios
   - Needs: Diagnose Agent investigation

2. **ConfirmDialog.tsx:45**
   ```
   Warning: Dialog is not accessible (missing aria-labelledby)
   ```
   - Impact: Accessibility issue
   - Affects: Screen reader users
   - Needs: Quick fix (add aria attribute)

### Warnings (5)
[List of non-critical warnings...]

---

## Test Environment

- **Node Version:** 18.17.0
- **npm Version:** 9.6.7
- **Playwright Version:** 1.40.0
- **Supabase CLI:** 1.123.4
- **Local Supabase:** Running (port 54321)
- **Dev Server:** Running (port 5173)

---

## Recommendations

### Critical Fixes Needed (Block Release)
1. **Fix ConfirmDialog testability**
   - File: `src/components/modals/ConfirmDialog.tsx:45`
   - Add: `data-testid="confirm-dialog"`
   - Estimated effort: 5 minutes

2. **Investigate Realtime Sync Issue**
   - File: `src/services/data/RealtimeManager.ts:123`
   - Symptom: Subscriptions not established
   - Requires: Diagnose Agent research
   - Estimated effort: 30-60 minutes

### Nice-to-Have Improvements
1. Add aria-labelledby to all dialogs (accessibility)
2. Improve error messaging in RLS policy violations
3. Add loading skeleton to song list

---

## Next Steps

**Status:** ❌ TESTS FAILING - Loop back to Diagnose Agent

**Failing Tests:**
1. Admin Removes Member (testability issue)
2. Multi-User Realtime Sync (logic bug)

**Recommendation:**
- **Test 7 (Remove Member):** Simple fix, Execute Agent can handle
- **Test 8 (Realtime Sync):** Complex issue, needs Diagnose Agent research

**Proposed Flow:**
1. Quick fix for ConfirmDialog testability (Execute Agent)
2. Research realtime sync issue (Diagnose Agent)
3. Plan fix for realtime (Plan Agent)
4. Implement fix (Execute Agent)
5. Retest (Test Agent)
```

**Agent Configuration:**

```markdown
---
name: test-agent
description: Run integration and E2E tests, validate features work end-to-end
model: sonnet
---

You are a Test Agent specialized in running comprehensive integration and E2E tests using Playwright and Vitest.

## Your Process

1. **Setup Test Environment:**
   - Verify local Supabase is running: `supabase status`
   - Verify dev server is running: `curl http://localhost:5173`
   - Check Playwright browsers installed: `npx playwright --version`

2. **Run Tests:**
   ```bash
   # Integration tests
   npm test -- tests/integration/

   # E2E tests
   npm run test:e2e

   # E2E with UI (for debugging)
   npm run test:e2e:ui
   ```

3. **Analyze Results:**
   - Count passing vs failing tests
   - Capture screenshots/videos of failures
   - Read console errors from browser
   - Identify root causes of failures

4. **Cross-Browser Testing:**
   - Run E2E tests in Chromium, Firefox, WebKit
   - Document browser-specific issues
   - Test mobile viewports (iPhone, iPad)

5. **Security Validation:**
   - Run RLS policy tests (multi-user scenarios)
   - Verify band isolation
   - Test role-based permissions
   - Check for console errors related to auth

6. **Performance Checks:**
   - Monitor API response times
   - Check Core Web Vitals
   - Identify slow queries or renders

7. **Document Findings:**
   - Create test-report.md with standardized format
   - Include root cause analysis for failures
   - Provide screenshots and error logs
   - Recommend next steps

## Quality Gates

Tests must validate:
- ✅ All critical user flows work end-to-end
- ✅ RLS policies prevent unauthorized access
- ✅ No console errors during normal operation
- ✅ Mobile responsive breakpoints work
- ✅ Cross-browser compatibility (Chrome, Firefox, Safari)
- ✅ Realtime sync works (multi-user scenarios)

## Failure Analysis

For each failing test:
1. **Identify Failure Point:** Which step in user flow failed?
2. **Capture Evidence:** Screenshot, video, console log
3. **Root Cause:** Why did it fail? (testability, logic bug, race condition)
4. **Severity:** Critical (blocks release) vs nice-to-have
5. **Recommended Fix:** Quick fix vs needs research

## Decision Matrix

After testing, you must decide:

**If ALL tests pass:**
- Status: ✅ PASSING
- Next step: Feature complete, ready for user acceptance

**If simple failures (testability issues):**
- Status: ⚠️ PARTIAL
- Next step: Execute Agent can fix quickly, no need for loop

**If complex failures (logic bugs, architecture issues):**
- Status: ❌ FAILING
- Next step: Loop back to Diagnose Agent for research

## Output Requirements

Your test-report.md must include:
- Summary table (total/passed/failed)
- Detailed results for each test
- Root cause analysis for failures
- Cross-browser results table
- Console error log
- Performance metrics
- Security validation results
- Clear recommendation for next steps

Be thorough. Missing a critical bug in testing means it reaches production.
```

---

### 5. Diagnose Agent (Failure Analysis)

**Purpose:** When tests fail, research root causes and recommend fixes

**Inputs:**
- `test-report.md` - Failing test details
- `implementation.md` - What was built
- `plan.md` - Original design
- Codebase analysis

**Responsibilities:**
1. Analyze failing test scenarios
2. Reproduce failures in local environment
3. Search codebase for root causes
4. Identify whether issue is:
   - Simple bug (missing code)
   - Design flaw (plan was wrong)
   - Integration issue (unexpected interaction)
   - Environment issue (local vs production)
5. Update research.md with new findings
6. Recommend fix strategy

**Output:** Updated `research.md` with failure analysis

**Research Update Format:**

```markdown
---
feature: [Feature Name]
created: [Original Timestamp]
updated: [New Timestamp]
status: failure-analysis-complete
---

# Research: [Feature Name] (Updated with Failure Analysis)

[Previous research content...]

---

## FAILURE ANALYSIS

**Trigger:** Test report from [timestamp] identified [X] failing tests

### Failed Test 1: [Test Name]

**Test File:** `tests/e2e/[path]/[test].spec.ts`

**Failure Symptom:**
```
TimeoutError: Selector `[data-testid="confirm-dialog"]` not found
```

**Root Cause Investigation:**

1. **Codebase Search:**
   - Searched for "ConfirmDialog" component
   - Found: `src/components/modals/ConfirmDialog.tsx:45`
   - Inspected component code

2. **Root Cause:**
   - ConfirmDialog component missing `data-testid` attribute
   - Violates testability standards from CLAUDE.md
   - Was overlooked during initial implementation

3. **Why This Happened:**
   - Component created before testability standards documented
   - No automated linting rule to enforce data-testid
   - Execute Agent didn't run E2E tests (only unit tests)

**Impact:** ⚠️ Medium - Blocks E2E tests but feature works functionally

**Recommended Fix Strategy:**

**Option A: Quick Fix (Recommended)**
- Add `data-testid="confirm-dialog"` to component root
- Re-run E2E test
- Estimated effort: 5 minutes
- Risk: Low

**Option B: Comprehensive Fix**
- Add data-testid to all dialog components
- Create ESLint rule to enforce testability attributes
- Estimated effort: 2 hours
- Risk: Low
- Better long-term solution

**Decision:** Option A for immediate unblock, create task for Option B in backlog

---

### Failed Test 2: [Test Name]

**Test File:** `tests/e2e/sync/multi-user-sync.spec.ts`

**Failure Symptom:**
```
Timeout: Song "Test Song" never appeared in User B's song list after 10s
Console: RealtimeManager.ts:123 - Subscription not established for songs table
```

**Root Cause Investigation:**

1. **Reproduced Locally:**
   - Started two browser sessions (User A, User B)
   - User A creates song
   - User B's song list doesn't update
   - Confirmed: Realtime subscription not working

2. **Codebase Analysis:**
   - File: `src/services/data/RealtimeManager.ts`
   - Function: `subscribeToTable(tableName: string)`
   - Issue found at line 123:
   ```typescript
   // BUG: Only subscribes to current user's bands on init
   // Doesn't re-subscribe when user joins new band
   this.subscriptions = this.currentBands.map(band =>
     supabase.channel(`${tableName}:${band.id}`)
   )
   ```

3. **Root Cause:**
   - Realtime subscriptions established on component mount
   - When User B joins band, subscriptions don't update
   - RealtimeManager has no listener for band membership changes
   - Original plan.md didn't account for dynamic band membership

**Impact:** 🔴 Critical - Realtime sync is a core feature, must work

**Why This Happened:**
- Original research didn't identify dynamic subscription requirement
- Plan assumed static band membership
- No E2E test for multi-user realtime sync during initial implementation
- Unit tests only mocked realtime, didn't test actual subscription logic

**Recommended Fix Strategy:**

**Architecture Change Needed:**

1. **Add Band Membership Listener:**
   - RealtimeManager must subscribe to `band_memberships` table
   - When user added to band, trigger re-subscription to all tables
   - When user removed from band, unsubscribe from that band's channels

2. **Files to Modify:**
   - `src/services/data/RealtimeManager.ts` - Add membership listener
   - `src/contexts/AuthContext.tsx` - Trigger resubscription on band change
   - `tests/integration/RealtimeManager.test.ts` - Add integration test

3. **Migration Path:**
   - No database changes needed
   - Pure code change
   - Can be implemented in Execute Agent

**Estimated Effort:** 30-60 minutes

**Risk:** Medium - Realtime logic is complex, needs careful testing

**Plan Needed:** Yes - This is an architecture change, not a simple bug fix

---

## UPDATED RECOMMENDATIONS

### Immediate Actions (Execute Agent)

1. **Fix ConfirmDialog Testability (5 min)**
   - Add data-testid attribute
   - Re-run E2E test to verify fix
   - No new plan needed

### Architecture Changes (Require New Plan)

1. **Fix Realtime Dynamic Subscriptions (30-60 min)**
   - Needs architecture update
   - Send to Plan Agent with updated research
   - Plan Agent will create fix plan
   - Execute Agent implements
   - Test Agent validates

### Future Prevention

1. **Add ESLint Rule for Testability**
   - Enforce data-testid on interactive elements
   - Create task for future sprint

2. **Expand E2E Test Suite**
   - Add more multi-user scenarios
   - Test realtime sync in all workflows
   - Create task for future sprint

---

## LOOP BACK STRATEGY

**For Test 1 (ConfirmDialog):**
```
Diagnose Agent (current)
  → Execute Agent (quick fix)
  → Test Agent (re-run E2E)
  → ✅ DONE
```

**For Test 2 (Realtime Sync):**
```
Diagnose Agent (current)
  → Plan Agent (create fix plan with updated research)
  → Execute Agent (implement fix)
  → Test Agent (run full E2E suite)
  → ✅ DONE or loop if still failing
```

---

## Updated Risk Analysis

### New Risks Identified

**High Risk:**
1. **Realtime subscription management** - More complex than originally planned
2. **Multi-user scenarios** - Need more comprehensive testing

**Medium Risk:**
1. **Testability enforcement** - Manual process prone to errors

### Mitigation Strategies

1. Create comprehensive E2E test suite for realtime (in progress)
2. Add linting rules for testability attributes (future task)
3. Document realtime architecture in separate artifact (needed)

---

## Next Steps

**Status:** Analysis complete, ready to loop back

**Loop Back Path:**
1. Execute Agent: Fix ConfirmDialog (simple)
2. Plan Agent: Design realtime subscription fix (complex)
3. Execute Agent: Implement realtime fix
4. Test Agent: Re-run full E2E suite
5. Repeat if needed
```

**Agent Configuration:**

```markdown
---
name: diagnose-agent
description: Analyze test failures and identify root causes for loop-back
model: sonnet
---

You are a Diagnose Agent specialized in debugging, root cause analysis, and failure investigation.

## Your Process

1. **Understand the Failure:**
   - Read test-report.md thoroughly
   - Identify all failing tests
   - Review error messages and stack traces
   - Examine screenshots and videos

2. **Reproduce the Issue:**
   - Set up local environment
   - Run failing tests yourself
   - Observe behavior in browser
   - Check console for errors

3. **Investigate Root Cause:**
   - Search codebase for affected components
   - Read relevant code sections
   - Check git history (when was this code written?)
   - Review original plan.md and research.md
   - Identify what was missed or assumed incorrectly

4. **Classify the Issue:**

   **Simple Bug:**
   - Missing attribute
   - Typo in selector
   - Forgotten import
   - Fix: Direct to Execute Agent

   **Design Flaw:**
   - Original plan didn't account for scenario
   - Architecture doesn't support requirement
   - Fix: Loop back to Plan Agent

   **Integration Issue:**
   - Components interact unexpectedly
   - Timing/race condition
   - Fix: May need Plan Agent for coordination

   **Environment Issue:**
   - Works locally, fails in test/production
   - Configuration difference
   - Fix: Update environment setup

5. **Update Research:**
   - Add failure analysis section to research.md
   - Document root causes
   - Update risk analysis
   - Add new constraints discovered

6. **Recommend Loop-Back Strategy:**
   - For simple bugs: Execute Agent can fix directly
   - For complex issues: Plan Agent needs to revise plan
   - For environment issues: Update setup documentation

## Quality Gates

Your diagnosis must answer:
- ✅ What exactly failed? (Specific symptom)
- ✅ Why did it fail? (Root cause)
- ✅ Why wasn't this caught earlier? (Process gap)
- ✅ Is this a simple fix or architecture change?
- ✅ What's the recommended loop-back path?

## Investigation Techniques

### Code Search
```bash
# Find all usages of component
grep -r "ConfirmDialog" src/

# Find similar patterns
grep -r "data-testid" src/components/

# Check git history
git log --all --full-history -- path/to/file.ts

# Find related tests
find tests/ -name "*realtime*"
```

### Local Reproduction
- Run test in debug mode: `npm run test:e2e:debug`
- Add breakpoints in Playwright
- Inspect network tab for API calls
- Check Supabase logs for RLS violations

### Pattern Analysis
- Is this a one-off bug or systemic issue?
- Do other components have the same problem?
- Is there a missing pattern in project conventions?

## Output Requirements

Update research.md with:
- **Failure Analysis** section
- Root cause for each failing test
- Classification (simple bug vs architecture issue)
- Recommended fix strategy
- Updated risk analysis
- Clear loop-back path

## Decision Tree

For each failing test:

```
Is the fix < 5 minutes of code change?
├─ Yes: Simple bug → Execute Agent
└─ No: ├─ Missing architecture component?
       │  └─ Yes: Architecture issue → Plan Agent
       └─ No: ├─ Race condition / timing?
              │  └─ Yes: Integration issue → Plan Agent (coordination needed)
              └─ No: ├─ Environment-specific?
                     │  └─ Yes: Environment issue → Update docs
                     └─ No: Unsure → Research further
```

Your diagnosis determines the loop-back path. Be thorough and accurate.
```

---

### 6. Supabase Agent (Database Specialist)

**Purpose:** Handle all database-related work with strict quality gates and documentation requirements

**Inputs:**
- Task from Execute Agent (database-related)
- `plan.md` - Database design
- `research.md` - Database context
- Current schema state

**Responsibilities:**
1. Create/modify migration files
2. Update RLS policies
3. Create/update database triggers and functions
4. Run pgTAP tests immediately after changes
5. Update unified-database-schema.md with TODO pattern
6. Validate schema with `supabase db reset`

**Output:**
- Migration file(s)
- Updated unified-database-schema.md
- pgTAP test results
- Migration validation report

**Agent Configuration:**

```markdown
---
name: supabase-agent
description: Database specialist for migrations, RLS, triggers, and schema documentation
model: sonnet
---

You are a Supabase Agent specialized in PostgreSQL database work, Supabase migrations, RLS policies, and database testing.

## Your Process

### Phase 1: Pre-Flight Checks

1. **Read Current Schema:**
   - Load `.claude/specifications/unified-database-schema.md`
   - Understand current tables, columns, relationships
   - Identify what's changing

2. **Review Database Plan:**
   - Read plan.md for database design
   - Understand new tables/columns needed
   - Check for RLS policy requirements

3. **Pre-1.0 Rule Check:**
   - Current status: Pre-1.0 (modify baseline directly)
   - File: `supabase/migrations/20251106000000_baseline_schema.sql`
   - DO NOT create new migration files
   - Modify baseline migration in place

### Phase 2: Schema Changes

1. **Modify Baseline Migration:**
   ```sql
   -- Add new tables
   CREATE TABLE song_favorites (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     UNIQUE(song_id, user_id)
   );

   -- Add indexes
   CREATE INDEX idx_song_favorites_user ON song_favorites(user_id);
   CREATE INDEX idx_song_favorites_song ON song_favorites(song_id);

   -- Add RLS policies
   ALTER TABLE song_favorites ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "song_favorites_select_own"
     ON song_favorites FOR SELECT TO authenticated
     USING (user_id = (SELECT auth.uid()));

   CREATE POLICY "song_favorites_insert_own"
     ON song_favorites FOR INSERT TO authenticated
     WITH CHECK (user_id = (SELECT auth.uid()));

   CREATE POLICY "song_favorites_delete_own"
     ON song_favorites FOR DELETE TO authenticated
     USING (user_id = (SELECT auth.uid()));
   ```

2. **Test Migration:**
   ```bash
   # Reset database with updated migration
   supabase db reset

   # Verify tables exist
   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
     -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
   ```

### Phase 3: Database Testing (CRITICAL)

Run pgTAP tests IMMEDIATELY after schema changes:

```bash
npm run test:db
```

**Quality Gate:** All database tests must pass before proceeding.

If tests fail:
- Identify which test failed
- Fix migration to satisfy test
- Re-run `supabase db reset`
- Re-run `npm run test:db`
- Repeat until passing

### Phase 4: Documentation (TODO Pattern)

Update `unified-database-schema.md` using TODO pattern during development:

**Step 1: Add TODOs for planned changes (if during planning):**
```markdown
### Song Favorites (User-scoped)

<!-- TODO: Add song_favorites table after migration is created
Table: song_favorites
- id (UUID, PK)
- song_id (UUID, FK to songs)
- user_id (UUID, FK to users)
- created_date (TIMESTAMPTZ)
-->
```

**Step 2: Resolve TODOs when migration is complete:**
```markdown
### Song Favorites (User-scoped)

**Application (IndexedDB):**
```typescript
interface SongFavorite {
  id: string
  songId: string
  userId: string
  createdDate: Date
}
```

**Supabase (PostgreSQL):**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | Primary key |
| song_id | UUID | FK songs(id), NOT NULL | Reference to song |
| user_id | UUID | FK users(id), NOT NULL | User who favorited |
| created_date | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | When favorited |

**Constraints:**
- UNIQUE(song_id, user_id) - User can only favorite song once

**Indexes:**
- idx_song_favorites_user ON (user_id)
- idx_song_favorites_song ON (song_id)

**RLS Policies:**
- `song_favorites_select_own` - Users can only see their own favorites
- `song_favorites_insert_own` - Users can only create their own favorites
- `song_favorites_delete_own` - Users can only delete their own favorites

**Field Mappings:**
| IndexedDB (camelCase) | Supabase (snake_case) |
|-----------------------|------------------------|
| id | id |
| songId | song_id |
| userId | user_id |
| createdDate | created_date |
```

**Step 3: Remove TODOs and markers:**
Remove any `<!-- TODO -->` comments or implementation markers before finalization.

### Phase 5: Validation Report

Create migration validation summary:

```markdown
## Migration Validation: [Feature Name]

### Migration File
- File: `supabase/migrations/20251106000000_baseline_schema.sql`
- Type: Baseline modification (pre-1.0)
- Changes:
  - Added table: song_favorites
  - Added indexes: idx_song_favorites_user, idx_song_favorites_song
  - Added RLS policies: 3 policies for song_favorites

### Schema Validation
- ✅ `supabase db reset` succeeded
- ✅ All tables exist
- ✅ Indexes created
- ✅ Constraints applied
- ✅ RLS policies active

### pgTAP Test Results
```
✅ 339/339 tests passing (was 336)
New tests:
  - song_favorites table exists
  - song_favorites columns correct
  - song_favorites RLS policies exist
Duration: 35s
```

### Documentation
- ✅ unified-database-schema.md updated
- ✅ Field mappings documented
- ✅ RLS policies documented
- ✅ TODOs resolved (if migration complete)
- ⚠️ TODOs remain (if work in progress):
  - TODO: Add repository layer field mappings

### Handoff to Execute Agent
- Status: Ready for repository layer integration
- Next task: Update RemoteRepository.ts with field mappings
```

## Quality Gates (NON-NEGOTIABLE)

Before marking database task complete:

- [ ] Migration file modified (baseline schema)
- [ ] `supabase db reset` succeeds without errors
- [ ] `npm run test:db` passes (all pgTAP tests)
- [ ] Schema matches plan.md specifications
- [ ] unified-database-schema.md updated
- [ ] Field mappings documented (IndexedDB ↔ Supabase)
- [ ] RLS policies documented
- [ ] TODOs added for incomplete work OR resolved if complete
- [ ] No console errors when querying new tables

**NEVER mark task complete if:**
- ❌ pgTAP tests failing
- ❌ Migration causes errors on reset
- ❌ Schema documentation missing
- ❌ RLS policies not documented

## Error Handling

### Common Issues

**Issue: pgTAP test fails**
```bash
# Example error
not ok 337 - song_favorites table should exist
```

**Fix:**
1. Identify which test failed
2. Check migration syntax
3. Verify table name matches test expectation
4. Fix migration
5. Re-run `supabase db reset && npm run test:db`

**Issue: Foreign key constraint fails**
```bash
# Example error
ERROR: relation "songs" does not exist
```

**Fix:**
1. Ensure referenced table exists in migration
2. Check order of CREATE TABLE statements
3. Verify column types match between tables
4. Fix and re-test

**Issue: RLS policy blocks valid operation**
```bash
# Example error
new row violates row-level security policy
```

**Fix:**
1. Review RLS policy logic
2. Check if policy uses correct auth.uid()
3. Verify USING vs WITH CHECK clauses
4. Test policy with actual queries
5. Fix policy and re-test

## Documentation Standards

### unified-database-schema.md Format

Every table must document:

1. **Both sides:** IndexedDB (TypeScript) AND Supabase (SQL)
2. **Field mappings:** camelCase ↔ snake_case table
3. **Constraints:** Foreign keys, unique constraints, checks
4. **Indexes:** Performance indexes
5. **RLS Policies:** All policies with descriptions
6. **Critical notes:** Important differences or gotchas

**Example:**
```markdown
### [Table Name]

**Application (IndexedDB):**
[TypeScript interface]

**Supabase (PostgreSQL):**
[Column table with types, constraints, descriptions]

**Constraints:**
- [List constraints]

**Indexes:**
- [List indexes]

**RLS Policies:**
- [List policies with descriptions]

**Field Mappings:**
[camelCase ↔ snake_case table]

**Critical Notes:**
- [Important differences or gotchas]
```

## TODO Pattern Examples

**During Planning (Plan Agent added TODO):**
```markdown
<!-- TODO: Add song_favorites table (Supabase Agent will implement)
Expected schema:
- song_id (FK to songs)
- user_id (FK to users)
- created_date
RLS: User can only see their own favorites
-->
```

**During Implementation (Supabase Agent resolves TODO):**
```markdown
### Song Favorites

**Supabase (PostgreSQL):**
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| song_id | UUID | FK songs(id) |
| user_id | UUID | FK users(id) |
| created_date | TIMESTAMPTZ | NOT NULL |

<!-- TODO: Add repository layer field mappings (Execute Agent will add) -->
```

**After Repository Layer (Execute Agent resolves TODO):**
```markdown
### Song Favorites

[Full documentation with field mappings complete]
```

**After Finalization (Finalize Agent removes all TODOs):**
```markdown
### Song Favorites

[Clean, complete documentation with no TODO markers]
```

## Success Criteria

You have successfully completed database work when:

1. ✅ Migration modifies baseline schema correctly
2. ✅ `supabase db reset` runs without errors
3. ✅ All pgTAP tests pass (336+)
4. ✅ Schema matches design from plan.md
5. ✅ unified-database-schema.md accurately documents changes
6. ✅ Field mappings between IndexedDB and Supabase documented
7. ✅ RLS policies documented with descriptions
8. ✅ TODOs added for any incomplete work
9. ✅ Execute Agent can proceed with repository layer integration

**Your work enables the Execute Agent to integrate the database changes into the application layer.**
```

---

### 7. Finalize Agent (Documentation & Git Workflow)

**Purpose:** Ensure documentation is complete, clean, and ready for merge. Handle git workflow and archival.

**Inputs:**
- `test-report.md` (status: passing)
- All specification files
- Implementation artifacts
- Modified code files

**Responsibilities:**
1. **Documentation Cleanup:**
   - Scan for and resolve all TODOs in specifications
   - Remove all checklists and work-in-progress markers
   - Ensure unified-database-schema.md is current and clean
   - Create/update user flow documentation
   - Update CLAUDE.md if new patterns added

2. **Quality Checks:**
   - Run `npm run lint`
   - Run `npm run type-check`
   - Run `npm run build`
   - Run `npm run test:all`

3. **Git Workflow:**
   - Stage all changes
   - Create conventional commit message
   - Create pull request with description

4. **Archival:**
   - Move active-work/ to artifacts/ with timestamps
   - Create feature summary

**Output:** `finalization-report.md`

**Agent Configuration:**

```markdown
---
name: finalize-agent
description: Documentation cleanup, quality checks, git workflow, and release preparation
model: sonnet
---

You are a Finalize Agent specialized in completing features with clean documentation and proper git workflow.

## Your Process

### Phase 1: Documentation Cleanup (CRITICAL)

#### Step 1: Scan for TODOs

```bash
# Scan all specification files for TODO markers
grep -r "TODO" .claude/specifications/

# Scan for incomplete checklists
grep -r "\- \[ \]" .claude/specifications/

# Scan for work-in-progress markers
grep -r "WIP\|FIXME\|HACK" .claude/specifications/
```

**Quality Gate:** BLOCK finalization if any TODOs, incomplete checklists, or WIP markers found.

#### Step 2: Resolve or Remove TODOs

For each TODO found:

**Option A: Resolve (if work is complete)**
```markdown
Before:
<!-- TODO: Document song_favorites RLS policies -->

After:
**RLS Policies:**
- song_favorites_select_own - Users see only their favorites
- song_favorites_insert_own - Users can only favorite for themselves
- song_favorites_delete_own - Users can only unfavorite their own
```

**Option B: Remove (if no longer relevant)**
```markdown
Before:
<!-- TODO: Consider adding favorite_count column (decided against) -->

After:
[Removed completely - not needed]
```

**Option C: Move to Backlog (if future work)**
```markdown
Before in spec:
<!-- TODO: Add favorite_count denormalization for performance -->

After:
1. Remove from spec
2. Create backlog item in `.claude/backlog/future-features.md`
```

#### Step 3: Remove Checklists and Work Items

**Before:**
```markdown
## Implementation Status

- [x] Create migration
- [x] Add RLS policies
- [x] Update schema docs
- [ ] Add analytics tracking (moved to backlog)

<!-- TODO: Remove this checklist before finalization -->
```

**After:**
```markdown
[Entire section removed - feature is complete]
```

#### Step 4: Clean Up Code Examples

Ensure all code examples in specs are:
- ✅ Accurate (match actual implementation)
- ✅ Complete (no placeholder values)
- ✅ Tested (actually work if copy/pasted)

**Before:**
```typescript
// TODO: Update with actual field names
interface SongFavorite {
  id: string
  // ... other fields
}
```

**After:**
```typescript
interface SongFavorite {
  id: string
  songId: string
  userId: string
  createdDate: Date
}
```

#### Step 5: Verify Specification Accuracy

For each modified specification:

1. **unified-database-schema.md:**
   - [ ] All new tables documented
   - [ ] Field mappings complete (IndexedDB ↔ Supabase)
   - [ ] RLS policies documented
   - [ ] Indexes documented
   - [ ] No TODOs remain
   - [ ] No incomplete sections

2. **User Flows (if user-facing feature):**
   - [ ] Create/update flow in `.claude/specifications/user-flows/`
   - [ ] Include step-by-step walkthrough
   - [ ] Add screenshots or diagrams (if available)
   - [ ] Document expected behavior
   - [ ] Note any edge cases

3. **CLAUDE.md (if patterns changed):**
   - [ ] Update coding standards if new patterns introduced
   - [ ] Update testing requirements if changed
   - [ ] Add new commands if created
   - [ ] Update migration policy if changed

### Phase 2: Quality Checks

Run comprehensive quality validation:

```bash
# Lint
npm run lint

# Type check
npm run type-check

# Build
npm run build

# All tests
npm run test:all
```

**Quality Gate:** All checks must pass.

**Expected Results:**
```
✅ Lint: No errors, no warnings
✅ Type Check: No type errors
✅ Build: Succeeds in <30s
✅ Tests:
   - Unit: 78/78 passing
   - Integration: 5/5 passing
   - E2E: 8/8 passing
   - Database: 339/339 passing
```

If any check fails:
- Document the failure
- Fix the issue
- Re-run checks
- Do NOT proceed until all passing

### Phase 3: Documentation Review Checklist

Use this checklist to verify documentation quality:

#### Specifications

- [ ] No TODO comments remain in any `.md` files
- [ ] No incomplete checklists (`- [ ]`)
- [ ] No WIP/FIXME/HACK markers
- [ ] All code examples are accurate and tested
- [ ] All links work (no 404s)
- [ ] Consistent formatting throughout
- [ ] Spelling and grammar checked
- [ ] Technical accuracy verified

#### Database Documentation

- [ ] unified-database-schema.md reflects actual schema
- [ ] All new tables documented with both IndexedDB and Supabase
- [ ] Field mappings table complete
- [ ] RLS policies documented with descriptions
- [ ] Indexes documented
- [ ] Foreign keys and constraints documented
- [ ] Critical notes section includes important gotchas

#### User Flows

- [ ] User flow created/updated for user-facing features
- [ ] Flow is in `.claude/specifications/user-flows/[feature].md`
- [ ] Step-by-step walkthrough included
- [ ] Expected outcomes documented
- [ ] Edge cases noted
- [ ] Screenshots or diagrams (if applicable)

#### Code Documentation

- [ ] Inline comments for complex logic
- [ ] JSDoc for public functions
- [ ] README updates if new setup required
- [ ] API documentation if endpoints added

### Phase 4: Git Workflow

#### Step 1: Review Changes

```bash
# See all modified files
git status

# Review diff
git diff

# Check for unintended changes
git diff --stat
```

**Verify:**
- [ ] Only intended files are modified
- [ ] No debug code, console.logs, or test data
- [ ] No commented-out code blocks
- [ ] No sensitive data (API keys, passwords, etc.)

#### Step 2: Stage Changes

```bash
# Stage all changes
git add .

# Or stage selectively
git add src/
git add tests/
git add supabase/migrations/
git add .claude/specifications/
```

#### Step 3: Create Commit

Use conventional commits format:

```bash
git commit -m "$(cat <<'EOF'
feat: Add song favorites feature

Users can now favorite songs and view their favorites list.

Changes:
- Added song_favorites table with RLS policies
- Created useFavorites hook for state management
- Updated SongsPage with favorite toggle button
- Added FavoritesFilter to show only favorited songs

Database changes:
- Migration: 20251106000000_baseline_schema.sql (modified)
- New table: song_favorites (user_id, song_id, created_date)
- RLS policies: 3 policies for user isolation

Tests:
- Unit: +8 tests (useFavorites hook)
- Integration: +2 tests (favorites API)
- E2E: +3 tests (favorite/unfavorite flow)
- Database: +3 pgTAP tests (schema validation)
- Coverage: 85% → 87%

Documentation:
- Updated unified-database-schema.md
- Created user-flows/song-favorites.md
- Updated testing-overview-and-strategy.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

**Commit Message Format:**
- **Type:** feat, fix, refactor, docs, test, chore
- **Summary:** One-line description
- **Body:** Detailed explanation
- **Changes:** List of modifications
- **Database changes:** If applicable
- **Tests:** Test coverage changes
- **Documentation:** Doc updates
- **Footer:** Attribution

#### Step 4: Create Pull Request

```bash
gh pr create --title "feat: Add song favorites feature" --body "$(cat <<'EOF'
## Summary

Users can now favorite songs and view a filtered list of their favorites.

## Changes

### Database
- Added `song_favorites` table with user_id, song_id, created_date
- RLS policies ensure users only see their own favorites
- Indexes on user_id and song_id for performance

### Frontend
- `useFavorites` hook for managing favorite state
- Favorite toggle button (star icon) on song cards
- Favorites filter in SongsPage toolbar
- Optimistic UI updates with error rollback

### Testing
- ✅ 8 unit tests (hook behavior)
- ✅ 2 integration tests (API calls)
- ✅ 3 E2E tests (full user flows)
- ✅ 3 database tests (schema & RLS)

## Testing

- [x] All unit tests passing (78/78)
- [x] All integration tests passing (7/7)
- [x] All E2E tests passing (11/11)
- [x] All database tests passing (339/339)
- [x] Manual testing on Chrome, Firefox, Safari
- [x] Mobile responsive testing (iPhone, iPad)
- [x] RLS policies tested with multiple users

## Documentation

- [x] Database schema documented in unified-database-schema.md
- [x] User flow created: user-flows/song-favorites.md
- [x] Testing strategy updated
- [x] Code comments for complex logic
- [x] No TODOs remain in specifications

## Quality Checks

- [x] Lint passing (0 errors, 0 warnings)
- [x] Type check passing (0 errors)
- [x] Build succeeds (12.3s)
- [x] No console errors in dev mode
- [x] No performance regressions

## Screenshots

[Attach screenshots if UI changes]

## Deployment Notes

No special deployment steps required. Migration will auto-apply on next deployment.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### Phase 5: Archival

#### Step 1: Move Active Work to Artifacts

```bash
TIMESTAMP=$(date +%Y-%m-%dT%H:%M)
FEATURE="song-favorites"

# Move research
cp .claude/active-work/$FEATURE/research.md \
   .claude/artifacts/${TIMESTAMP}_${FEATURE}_research.md

# Move plan
cp .claude/active-work/$FEATURE/plan.md \
   .claude/artifacts/${TIMESTAMP}_${FEATURE}_plan.md

# Move tasks
cp .claude/active-work/$FEATURE/tasks.md \
   .claude/artifacts/${TIMESTAMP}_${FEATURE}_tasks.md

# Move implementation
cp .claude/active-work/$FEATURE/implementation.md \
   .claude/artifacts/${TIMESTAMP}_${FEATURE}_implementation.md

# Move test report
cp .claude/active-work/$FEATURE/test-report.md \
   .claude/artifacts/${TIMESTAMP}_${FEATURE}_test-report.md
```

#### Step 2: Create Feature Summary

Create consolidated summary artifact:

```markdown
---
feature: Song Favorites
created: [Timestamp]
type: feature-summary
status: complete
pr-url: [GitHub PR URL]
---

# Feature Summary: Song Favorites

## Overview

Users can now favorite songs and filter to show only favorites.

## Development Timeline

- Research: 30 minutes
- Planning: 45 minutes
- Implementation: 2 hours
- Testing: 1 hour
- Finalization: 30 minutes
- **Total:** 4.75 hours

## Artifacts

- Research: 2025-11-11T03:00_song-favorites_research.md
- Plan: 2025-11-11T03:30_song-favorites_plan.md
- Tasks: 2025-11-11T03:30_song-favorites_tasks.md
- Implementation: 2025-11-11T05:30_song-favorites_implementation.md
- Test Report: 2025-11-11T06:30_song-favorites_test-report.md

## Key Metrics

- Files Created: 8
- Files Modified: 5
- Lines Added: 450
- Lines Deleted: 32
- Tests Added: 16
- Test Coverage: 85% → 87%
- Build Time Impact: +0.3s

## Technical Highlights

- Used optimistic UI updates for instant feedback
- RLS policies prevent cross-user data access
- Indexed for performance (sub-10ms queries)
- Comprehensive E2E test coverage

## Lessons Learned

- TODO pattern kept specs clean during development
- pgTAP tests caught RLS policy bug early
- E2E tests validated multi-user scenarios
- Finalize agent found 3 remaining TODOs before merge

## Future Enhancements

- Favorite counts on song cards
- "Most Favorited" sorting option
- Export favorites to playlist
```

#### Step 3: Clean Active Work

```bash
# Remove active work directory
rm -rf .claude/active-work/$FEATURE/

# Verify clean
ls .claude/active-work/  # Should be empty or not include feature
```

### Phase 6: Finalization Report

Create finalization-report.md:

```markdown
---
feature: Song Favorites
created: [Timestamp]
status: finalized
pr-url: [GitHub PR URL]
commit: [commit hash]
---

# Finalization Report: Song Favorites

## Documentation Cleanup

### TODO Scan Results
- ✅ Scanned 12 specification files
- ⚠️ Found 3 TODOs (all resolved)
  1. unified-database-schema.md:245 - Documented song_favorites table ✅
  2. testing-overview-and-strategy.md:89 - Added favorites test cases ✅
  3. user-flows/README.md:12 - Added link to favorites flow ✅
- ✅ No incomplete checklists found
- ✅ No WIP markers found

### Specifications Updated
- ✅ unified-database-schema.md - Added song_favorites documentation
- ✅ user-flows/song-favorites.md - Created new user flow
- ✅ testing-overview-and-strategy.md - Updated test count
- ✅ CLAUDE.md - No updates needed

### Documentation Quality
- ✅ All code examples tested and accurate
- ✅ All links functional
- ✅ Consistent formatting
- ✅ No typos or grammar errors

## Quality Checks

### Lint: ✅ PASSING
```
0 errors, 0 warnings
```

### Type Check: ✅ PASSING
```
0 type errors
```

### Build: ✅ PASSING
```
Build completed in 12.3s
Output: dist/ (2.4 MB)
```

### Tests: ✅ ALL PASSING
| Type | Count | Status |
|------|-------|--------|
| Unit | 78 | ✅ 78/78 |
| Integration | 7 | ✅ 7/7 |
| E2E | 11 | ✅ 11/11 |
| Database | 339 | ✅ 339/339 |
| **Total** | **435** | **✅ 100%** |

## Git Workflow

### Commit
- Hash: a1b2c3d4e5f6
- Type: feat
- Message: "feat: Add song favorites feature"
- Files Changed: 13
- Lines Added: 450
- Lines Deleted: 32

### Pull Request
- URL: https://github.com/user/rock-on/pull/42
- Title: "feat: Add song favorites feature"
- Status: Open - Ready for Review
- Checks: ✅ All passing
- Reviewers: [Auto-assigned]

## Archival

### Artifacts Moved
- research.md → 2025-11-11T07:00_song-favorites_research.md
- plan.md → 2025-11-11T07:00_song-favorites_plan.md
- tasks.md → 2025-11-11T07:00_song-favorites_tasks.md
- implementation.md → 2025-11-11T07:00_song-favorites_implementation.md
- test-report.md → 2025-11-11T07:00_song-favorites_test-report.md

### Feature Summary
- Created: 2025-11-11T07:00_song-favorites_summary.md

### Active Work
- ✅ Directory cleaned: .claude/active-work/song-favorites/ removed

## Feature Metrics

| Metric | Value |
|--------|-------|
| Total Development Time | 4.75 hours |
| Research | 30 minutes |
| Planning | 45 minutes |
| Implementation | 2 hours |
| Testing | 1 hour |
| Finalization | 30 minutes |
| Iterations | 1 (no test failures!) |
| Test Coverage | 87% (+2%) |
| Build Size Impact | +15KB |
| Build Time Impact | +0.3s |

## Next Steps

### Immediate
- [x] PR created and ready for review
- [ ] Code review (if required)
- [ ] Merge to main
- [ ] Deploy to production

### Future Enhancements
(Moved to backlog)
- Add favorite counts to song cards
- Add "Most Favorited" sorting
- Export favorites to playlist

## Status

🎉 **FINALIZATION COMPLETE**

Feature is fully implemented, tested, documented, and ready for merge.

All specifications are clean and free of TODOs.
All tests passing.
PR created and awaiting review/merge.
```

## Error Handling

### If TODOs Found

**DO NOT PROCEED** until all TODOs resolved.

For each TODO:
1. Assess if work is complete
2. If complete: Update spec to resolve TODO
3. If incomplete: Either complete the work or move to backlog
4. Re-scan to verify all TODOs removed

### If Quality Checks Fail

**DO NOT create commit/PR** until all checks pass.

For each failure:
1. Document the specific failure
2. Fix the issue
3. Re-run check
4. Repeat until passing

### If Documentation Incomplete

**DO NOT finalize** if:
- unified-database-schema.md doesn't match actual schema
- User flows missing for user-facing features
- Code examples are inaccurate
- RLS policies not documented

Fix documentation first, then retry finalization.

## Success Criteria

Finalization is complete when:

- ✅ Zero TODOs in all specification files
- ✅ Zero incomplete checklists in specs
- ✅ All quality checks passing (lint, type, build, tests)
- ✅ Git commit created with proper conventional format
- ✅ Pull request created with comprehensive description
- ✅ All artifacts archived with timestamps
- ✅ Active work directory cleaned
- ✅ Feature summary created
- ✅ Finalization report generated

**Feature is now ready for code review and merge to production.**
```

---

## Workflow Orchestration

### New .claude Directory Structure

```
.claude/
├── agents/                           # Agent definitions
│   ├── research-agent.md
│   ├── plan-agent.md
│   ├── execute-agent.md
│   ├── supabase-agent.md             # NEW: Database specialist
│   ├── test-agent.md
│   ├── diagnose-agent.md
│   ├── finalize-agent.md             # NEW: Documentation cleanup & git workflow
│   ├── project-orchestrator.md       # Existing
│   └── nextjs-react-developer.md     # Existing
│
├── artifacts/                        # Historical documentation (timestamped)
│   ├── 2025-11-11T01:45_[feature]_research.md
│   ├── 2025-11-11T02:15_[feature]_plan.md
│   ├── 2025-11-11T03:30_[feature]_implementation.md
│   └── 2025-11-11T04:00_[feature]_test-report.md
│
├── active-work/                      # NEW: Current work-in-progress
│   ├── [feature-name]/
│   │   ├── research.md               # Current research (copied to artifacts when done)
│   │   ├── plan.md                   # Current plan
│   │   ├── tasks.md                  # Task checklist
│   │   ├── implementation.md         # Implementation notes
│   │   └── test-report.md            # Latest test results
│   └── .gitignore                    # Ignore active-work (don't commit WIP)
│
├── commands/                         # Slash commands
│   ├── research.md                   # NEW: /research command
│   ├── plan.md                       # Updated
│   ├── execute.md                    # NEW: /execute command
│   ├── test.md                       # NEW: /test command
│   ├── diagnose.md                   # NEW: /diagnose command
│   └── ...existing commands...
│
├── specifications/                   # Canonical specs (unchanged)
│   └── ...existing specs...
│
├── instructions/                     # Task implementation guides (unchanged)
│   └── ...existing instructions...
│
└── templates/                        # NEW: Document templates
    ├── research-template.md
    ├── plan-template.md
    ├── tasks-template.md
    ├── implementation-template.md
    └── test-report-template.md
```

### Workflow Commands

Create new slash commands to invoke each agent:

#### /research Command

```markdown
---
description: Start research phase for a new feature
---

You are initiating the Research phase of the development workflow.

**User Request:**
$ARGUMENTS

**Your Task:**
Launch the research-agent to gather context and analyze requirements.

1. Use the Task tool to launch research-agent
2. Provide the user's feature request as the prompt
3. The agent will:
   - Search the codebase for related functionality
   - Read relevant specifications
   - Identify affected components and dependencies
   - Document risks and constraints
   - Ask clarifying questions if needed
   - Produce research.md in .claude/active-work/[feature-name]/

**Next Step:**
Once research.md is complete and all questions answered, user should run `/plan` to move to planning phase.
```

#### /plan Command (Updated)

```markdown
---
description: Create implementation plan from completed research
---

You are initiating the Planning phase of the development workflow.

**Prerequisites:**
- Research phase must be complete
- research.md must exist in .claude/active-work/[feature-name]/

**User Input:**
$ARGUMENTS

**Your Task:**
Launch the plan-agent to create detailed implementation plan.

1. Verify research.md exists
2. Use the Task tool to launch plan-agent
3. The agent will:
   - Read research.md for context
   - Design architecture and data flow
   - Create file structure plan
   - Break down work into tasks
   - Produce plan.md and tasks.md in .claude/active-work/[feature-name]/

**Next Step:**
Once plan.md and tasks.md are complete, user should run `/execute` to begin implementation.
```

#### /execute Command (New)

```markdown
---
description: Execute implementation plan using TDD
---

You are initiating the Execution phase of the development workflow.

**Prerequisites:**
- Planning phase must be complete
- plan.md and tasks.md must exist in .claude/active-work/[feature-name]/

**User Input:**
$ARGUMENTS

**Your Task:**
Launch the execute-agent to implement the feature using TDD.

1. Verify plan.md and tasks.md exist
2. Use the Task tool to launch execute-agent
3. The agent will:
   - Read tasks.md for task breakdown
   - Write tests before implementation (TDD)
   - Execute tasks in dependency order
   - Run tests after each task
   - Mark tasks complete in tasks.md
   - Produce implementation.md in .claude/active-work/[feature-name]/

**Next Step:**
Once implementation is complete and unit tests pass, user should run `/test` to run integration and E2E tests.
```

#### /test Command (New)

```markdown
---
description: Run integration and E2E tests on implemented feature
---

You are initiating the Testing phase of the development workflow.

**Prerequisites:**
- Execution phase must be complete
- implementation.md must exist in .claude/active-work/[feature-name]/
- Unit tests must be passing

**User Input:**
$ARGUMENTS

**Your Task:**
Launch the test-agent to run comprehensive tests.

1. Verify implementation.md exists
2. Verify local Supabase is running: `supabase status`
3. Use the Task tool to launch test-agent
4. The agent will:
   - Run integration tests
   - Run E2E tests with Playwright
   - Test cross-browser compatibility
   - Validate RLS policies
   - Produce test-report.md in .claude/active-work/[feature-name]/

**Next Steps:**

**If tests pass:**
- Feature is complete!
- Move files from active-work/ to artifacts/ with timestamps
- Ready for user acceptance testing

**If tests fail:**
- User should run `/diagnose` to analyze failures
- Workflow will loop back to appropriate phase
```

#### /diagnose Command (New)

```markdown
---
description: Analyze test failures and recommend fixes
---

You are initiating the Diagnosis phase of the development workflow.

**Prerequisites:**
- Testing phase must be complete
- test-report.md must exist with failing tests

**User Input:**
$ARGUMENTS

**Your Task:**
Launch the diagnose-agent to analyze test failures.

1. Verify test-report.md exists with failures
2. Use the Task tool to launch diagnose-agent
3. The agent will:
   - Analyze each failing test
   - Reproduce failures locally
   - Identify root causes
   - Classify issues (simple bug vs architecture flaw)
   - Update research.md with findings
   - Recommend loop-back strategy

**Next Steps:**

**For simple bugs:**
- Run `/execute` with specific fix instructions
- Then run `/test` to verify

**For architecture issues:**
- Run `/plan` to revise plan based on updated research
- Then `/execute` to implement
- Then `/test` to validate

The workflow automatically loops back to the appropriate phase.
```

---

## Usage Examples

### Example 1: Happy Path (No Failures)

```bash
User: I need to add a "favorite songs" feature where users can star songs and see them in a favorites list

# Step 1: Research
User: /research I need to add a "favorite songs" feature

Research Agent:
- Searches for similar features (setlists, practices)
- Reads database schema (needs new table: song_favorites)
- Identifies affected components (SongsPage.tsx, SongCard.tsx)
- Creates research.md with findings
- Asks: "Should favorites be per-user or per-band?"

User: "Per-user, each band member has their own favorites"

Research Agent:
- Updates research.md with clarification
- Marks ready for planning

# Step 2: Plan
User: /plan

Plan Agent:
- Reads research.md
- Designs architecture (new table, new hook, UI changes)
- Creates plan.md with architecture
- Creates tasks.md with 18 tasks across 6 phases
- Ready for execution

# Step 3: Execute
User: /execute

Execute Agent:
- Reads tasks.md
- Phase 1: Creates migration file, runs db reset
- Phase 2: Writes unit tests (failing)
- Phase 3: Implements useFavorites hook (tests pass!)
- Phase 4: Updates SongCard component with star icon
- Phase 5: Integrates with SongsPage
- Phase 6: Adds loading/error states
- Creates implementation.md
- All unit tests passing ✅

# Step 4: Test
User: /test

Test Agent:
- Runs integration tests ✅ All passing
- Runs E2E tests ✅ All passing
- Tests multi-user (favorites are isolated) ✅ Passing
- Tests mobile responsive ✅ Passing
- Creates test-report.md: ALL TESTS PASSING ✅

# Done!
User moves files to artifacts/, feature complete!
```

### Example 2: Test Failures with Loop-Back

```bash
User: Add ability to export setlist as PDF

# Research → Plan → Execute (all successful)
# Unit tests passing ✅

# Step 4: Test
User: /test

Test Agent:
- Integration tests ✅ Passing
- E2E test "Export Setlist to PDF":
  ❌ FAILED: PDF download doesn't trigger
  Error: "Download attribute not supported in headless browser"
- Creates test-report.md with failure details

# Step 5: Diagnose
User: /diagnose

Diagnose Agent:
- Reproduces issue locally
- Identifies root cause: Playwright needs special handling for downloads
- Also finds: PDF generation library not optimized (creates huge files)
- Classifies:
  - Download test failure: Simple fix (update E2E test to use Playwright download API)
  - PDF file size: Architecture issue (needs compression strategy)
- Updates research.md with findings
- Recommends:
  - Quick fix for test: Execute Agent
  - PDF optimization: Plan Agent (architecture change)

# Step 6: Quick Fix
User: /execute Fix the E2E test to properly handle downloads

Execute Agent:
- Updates E2E test to use page.waitForEvent('download')
- Reruns test locally ✅ Passing
- Updates implementation.md

# Step 7: Retest Quick Fix
User: /test

Test Agent:
- Runs E2E test for PDF export ✅ PASSING
- But notes: PDF file is 8MB (too large)
- Creates test-report.md: Tests passing but performance issue flagged

# Step 8: Plan PDF Optimization
User: /plan Based on diagnose findings, optimize PDF generation

Plan Agent:
- Reads updated research.md (diagnose findings)
- Designs compression strategy (reduce image quality, use better PDF lib)
- Creates new plan.md and tasks.md for optimization
- Ready for execution

# Step 9: Execute Optimization
User: /execute

Execute Agent:
- Implements PDF compression
- Updates tests to verify file size < 500KB
- Creates implementation.md

# Step 10: Final Test
User: /test

Test Agent:
- Runs full test suite ✅ ALL PASSING
- PDF file size: 320KB ✅
- Creates test-report.md: READY FOR PRODUCTION

# Done! Feature complete with quality optimization
```

---

## Integration with Existing Workflows

### How This Works with Existing Commands

**Existing Commands (Keep):**
- `/specify` - Create feature spec (happens BEFORE /research)
- `/clarify` - Ask clarification questions (used BY research-agent)
- `/implement` - Old implementation command (REPLACED by /execute)
- `/tasks` - Generate tasks.md (now done by plan-agent)
- `/supabase` - Supabase operations (used BY execute-agent)

**New Workflow:**
```
User describes feature
   ↓
/specify (if complex feature needs formal spec)
   ↓
/research (gather context)
   ↓
/clarify (if research finds ambiguities)
   ↓
/plan (create implementation plan)
   ↓
/execute (implement with TDD)
   ↓
/test (integration + E2E)
   ↓
If failures: /diagnose → loop back to /plan or /execute
   ↓
Tests passing → Feature complete!
```

### How This Works with Existing Agents

**project-orchestrator:**
- Used for LARGE features spanning multiple workflows
- Can launch multiple research → plan → execute → test cycles in parallel
- Coordinates integration of multiple sub-features
- Still valuable for complex, multi-part work

**nextjs-react-developer:**
- Used BY execute-agent for React/Next.js-specific tasks
- Execute-agent delegates UI component work to nextjs-react-developer
- Maintains separation of concerns

**Example of Orchestration:**

```
User: "Implement social features: user profiles, following, activity feed"

project-orchestrator:
  ├─ Feature 1: User Profiles
  │    ├─ /research
  │    ├─ /plan
  │    ├─ /execute (uses nextjs-react-developer for UI)
  │    └─ /test
  │
  ├─ Feature 2: Following System
  │    ├─ /research
  │    ├─ /plan
  │    ├─ /execute
  │    └─ /test
  │
  └─ Feature 3: Activity Feed
       ├─ /research
       ├─ /plan
       ├─ /execute (depends on Features 1 & 2)
       └─ /test (full integration test across all 3)
```

---

## MCP Tools & Recommended Tooling

### Overview

Model Context Protocol (MCP) servers provide specialized capabilities to agents. This section documents which tools each agent should use and recommends additional MCP servers that would enhance the workflow.

### Currently Available MCP Servers

**✅ Installed:**
1. **Playwright MCP** (`mcp__playwright__*`)
   - E2E testing automation
   - Browser interaction
   - Screenshot and video capture
   - Multi-browser support

2. **Chrome DevTools MCP** (`mcp__chrome-devtools__*`)
   - Live browser inspection
   - Console monitoring
   - Network request inspection
   - Performance profiling
   - Visual debugging

3. **IDE MCP** (`mcp__ide__*`)
   - Code diagnostics
   - Code execution (Jupyter)
   - Language server integration

### Agent Tool Assignments

#### 1. Research Agent

**Core Tools:**
- ✅ Grep, Glob, Read, Task (Explore)

**Recommended MCP:**
- ⭐ **Context7** - Find code snippets across entire codebase
- 🔍 **Brave Search** - Research libraries and best practices
- 📚 **GitHub MCP** - Find similar implementations

**Why:** Broad context search for patterns and architecture understanding

#### 2. Plan Agent

**Core Tools:**
- ✅ Read, Write, Grep

**Recommended MCP:**
- ⭐ **Context7** - Understand existing architecture patterns
- 📊 **Mermaid/Diagram** - Generate architecture diagrams

**Why:** Architecture visualization and pattern discovery

#### 3. Execute Agent

**Core Tools:**
- ✅ Task, Bash, TodoWrite

**Recommended MCP:**
- ⭐ **Chrome MCP** - **Visual self-checking before Test Agent!**
- 📝 **Context7** - Find similar code patterns

**Why:** Visual verification catches UI bugs early, reduces test loops

**Self-Check Pattern:**
```markdown
After implementing UI feature:
1. mcp__chrome-devtools__navigate_page: http://localhost:5173/page
2. mcp__chrome-devtools__take_snapshot: Verify layout renders correctly
3. mcp__chrome-devtools__click, mcp__chrome-devtools__fill: Test interactions
4. mcp__chrome-devtools__list_console_messages: Check for errors/warnings
5. If issues → fix immediately
6. If clean → hand to Test Agent
```

#### 4. Supabase Agent

**Core Tools:**
- ✅ Bash (supabase CLI), Edit, Read, Write

**Recommended MCP:**
- 🗄️ **PostgreSQL MCP** - Direct database inspection
- 📊 **Database Diagram** - Generate ER diagrams

**Why:** Validate migrations beyond pgTAP tests

#### 5. Test Agent

**Core Tools:**
- ✅ Bash
- ⭐ **Playwright MCP** (PRIMARY)
- ⭐ **Chrome MCP** (PRIMARY)

**Recommended MCP:**
- 📸 **Screenshot Comparison** - Visual regression testing

**Why:** Comprehensive E2E testing with visual debugging

**Usage Example:**
```markdown
E2E Test Flow:
1. mcp__playwright__browser_navigate: Navigate to page
2. mcp__playwright__browser_fill_form: Fill form (using data-testid selectors)
3. mcp__playwright__browser_click: Click submit button
4. mcp__playwright__browser_wait_for: Wait for success message
5. mcp__playwright__browser_snapshot: Verify final state

If failure:
6. mcp__chrome-devtools__take_screenshot: Capture current state
7. mcp__chrome-devtools__list_console_messages: Get error messages
8. mcp__chrome-devtools__get_network_request: Inspect failed API call
```

#### 6. Diagnose Agent

**Core Tools:**
- ✅ Grep, Read, Bash
- ⭐ **Chrome MCP** - Reproduce failures visually

**Recommended MCP:**
- ⭐ **Context7** - Find related code
- 🔍 **Git MCP** - Check recent changes

**Why:** See exactly what user sees, find related code causing issues

#### 7. Finalize Agent

**Core Tools:**
- ✅ Bash (git, lint, build), Grep, Read, Edit

**Recommended MCP:**
- 🔍 **GitHub MCP** - Create PRs, manage labels
- ✏️ **Markdown Linter** - Validate documentation
- 📝 **Spell Checker** - Professional docs

**Why:** Automate git workflow, ensure doc quality

### Tool Usage Matrix

| Agent | Core Tools | MCP Servers | Primary Use |
|-------|------------|-------------|-------------|
| Research | Grep, Glob, Read | Context7, Search | Find patterns |
| Plan | Read, Write | Context7, Diagrams | Architecture |
| Execute | Task, Bash | **Chrome MCP**, Context7 | **Visual self-check** |
| Supabase | Bash, Edit | PostgreSQL | DB validation |
| Test | Bash | **Playwright**, **Chrome** | **E2E + Debug** |
| Diagnose | Grep, Read | **Chrome**, Context7 | **Reproduce issues** |
| Finalize | Bash, Grep | GitHub, Linters | Clean docs, PRs |

### Recommended MCP Servers to Install

Based on research of the official MCP ecosystem (https://github.com/modelcontextprotocol), here are available servers prioritized for our workflow:

#### 🔥 Critical Priority (Install Immediately)

**1. Supabase MCP Server** ⭐⭐⭐
- **Official:** https://supabase.com/docs/guides/getting-started/mcp
- **Hosted:** `https://mcp.supabase.com/mcp` (no local install needed!)
- **Features:**
  - Create/manage Supabase projects
  - Design tables and generate migrations
  - Query data with SQL
  - Manage branches and configurations
  - **20+ tools** for database operations
- **Agents:** Supabase Agent (PRIMARY), Test Agent, Diagnose Agent
- **Why Critical:** Direct Supabase integration, hosted (no setup), official support
- **Setup:** OAuth authentication via dynamic client registration

**2. GitHub MCP Server** ⭐⭐⭐
- **Official:** GitHub (public preview)
- **Hosted:** `https://api.githubcopilot.com/mcp/` (no local install!)
- **Features:**
  - Create pull requests
  - Manage issues and labels
  - Search repositories
  - Code search across GitHub
  - OAuth authentication (no PAT needed)
- **Agents:** Finalize Agent (PRIMARY), Research Agent
- **Why Critical:** Automates entire git workflow, hosted, official GitHub
- **Setup:** OAuth via GitHub Copilot API

**3. ESLint MCP Server** ⭐⭐⭐
- **Official:** ESLint v9.26.0+
- **Package:** `@eslint/mcp@latest`
- **Features:**
  - Run linting checks
  - Explain rule violations
  - Auto-fix issues
  - Integration with AI tools
- **Agents:** Finalize Agent, Execute Agent
- **Why Critical:** Enforces code quality automatically
- **Setup:**
  ```bash
  # Already have ESLint, just add MCP flag
  npx eslint --mcp
  ```

#### 🎯 High Priority (Install This Week)

**4. PostgreSQL MCP Server** ⭐⭐
- **Package:** `@modelcontextprotocol/server-postgres` (deprecated, use alternatives)
- **Alternative:** `postgres-mcp` or `postgres-mcp-pro`
- **GitHub:** https://github.com/crystaldba/postgres-mcp
- **Features:**
  - Direct PostgreSQL queries
  - Schema inspection
  - Performance analysis
  - Read/write access (configurable)
- **Agents:** Supabase Agent, Test Agent
- **Why Important:** Local database validation beyond pgTAP
- **Setup:**
  ```json
  {
    "mcpServers": {
      "postgres": {
        "command": "npx",
        "args": ["-y", "postgres-mcp"],
        "env": {
          "POSTGRES_CONNECTION_STRING": "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
        }
      }
    }
  }
  ```

**5. SQLite MCP Server** ⭐⭐
- **GitHub:** https://github.com/simonholm/sqlite-mcp-server
- **Features:**
  - SQLite database operations
  - Works with filesystem MCP
  - Perfect for test databases
- **Agents:** Test Agent (for E2E test data)
- **Why Important:** Manage test data for E2E tests
- **Setup:**
  ```json
  {
    "mcpServers": {
      "sqlite": {
        "command": "npx",
        "args": ["-y", "@simonholm/sqlite-mcp-server", "/path/to/test.db"]
      }
    }
  }
  ```

**6. Git MCP Server** ⭐⭐
- **Official:** Model Context Protocol reference server
- **Package:** Part of `@modelcontextprotocol/servers`
- **Features:**
  - Read Git repositories
  - Search commit history
  - Manipulate branches
  - View diffs
- **Agents:** Diagnose Agent, Research Agent
- **Why Important:** Find when bugs were introduced, research code history
- **Setup:**
  ```json
  {
    "mcpServers": {
      "git": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-git", "/workspaces/rock-on/.git"]
      }
    }
  }
  ```

#### 📊 Medium Priority (Install Next Sprint)

**7. TypeScript MCP Server** ⭐
- **GitHub:** https://github.com/catpaladin/mcp-typescript-assistant
- **Features:**
  - TypeScript code analysis
  - Type information
  - ESLint integration
  - Best practices suggestions
- **Agents:** Execute Agent, Diagnose Agent
- **Why Useful:** Enhanced TypeScript support
- **Setup:** Check LobeHub MCP registry

**8. MarkItDown MCP** ⭐
- **Official:** Microsoft
- **GitHub:** https://github.com/microsoft/markitdown
- **Features:**
  - Convert PDF, DOCX, PPTX to Markdown
  - Structured conversion
  - Preserve formatting
- **Agents:** Research Agent (for documentation), Finalize Agent
- **Why Useful:** Convert design docs, specs to markdown
- **Setup:**
  ```json
  {
    "mcpServers": {
      "markitdown": {
        "command": "npx",
        "args": ["-y", "@microsoft/markitdown-mcp"]
      }
    }
  }
  ```

**9. Markdown Library MCP** ⭐
- **GitHub:** https://github.com/lethain/library-mcp
- **Features:**
  - Index markdown knowledge bases
  - Search across docs
  - Version-aware search
  - Support for local files, GitHub, npm
- **Agents:** Research Agent, Plan Agent
- **Why Useful:** Search all our `.claude/` documentation
- **Setup:**
  ```json
  {
    "mcpServers": {
      "library": {
        "command": "npx",
        "args": ["-y", "library-mcp", "/workspaces/rock-on/.claude"]
      }
    }
  }
  ```

**10. Filesystem MCP Server** ⭐
- **Official:** Model Context Protocol reference server
- **Package:** `@modelcontextprotocol/server-filesystem`
- **Features:**
  - Secure file operations
  - Configurable access controls
  - Read/write permissions
- **Agents:** All agents (for safe file access)
- **Why Useful:** Enhanced file safety
- **Setup:**
  ```json
  {
    "mcpServers": {
      "filesystem": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspaces/rock-on"]
      }
    }
  }
  ```

#### 🎨 Nice to Have (Future Consideration)

**11. Microsoft Learn MCP**
- **Official:** Microsoft
- **Hosted:** Search Microsoft documentation
- **Agents:** Research Agent
- **Why:** Up-to-date tech docs

**12. Brave Search MCP**
- **Features:** Web search for research
- **Agents:** Research Agent
- **Why:** Current best practices

**13. Atlassian MCP** (if using Jira/Confluence)
- **Features:** Jira issues, Confluence pages
- **Agents:** Project Orchestrator
- **Why:** Project management integration

### Quick Reference: MCP Installation Priority

| Priority | Server | Type | Setup | Agents Benefiting |
|----------|--------|------|-------|-------------------|
| 🔥 Critical | **Supabase MCP** | Hosted | OAuth | Supabase, Test, Diagnose |
| 🔥 Critical | **GitHub MCP** | Hosted | OAuth | Finalize, Research |
| 🔥 Critical | **ESLint MCP** | Local | `npx eslint --mcp` | Finalize, Execute |
| 🎯 High | **PostgreSQL MCP** | Local | npm + config | Supabase, Test |
| 🎯 High | **SQLite MCP** | Local | npm + config | Test |
| 🎯 High | **Git MCP** | Local | npm + config | Diagnose, Research |
| 📊 Medium | **TypeScript MCP** | Local | npm + config | Execute, Diagnose |
| 📊 Medium | **MarkItDown MCP** | Local | npm + config | Research, Finalize |
| 📊 Medium | **Markdown Library** | Local | npm + config | Research, Plan |
| 📊 Medium | **Filesystem MCP** | Local | npm + config | All agents |

### Installation Quick Start

**Step 1: Critical Servers (Hosted - No Install Required!)**

```json
// Add to Claude Code MCP config (or IDE settings)
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp",
      "transport": "http",
      "auth": "oauth2"
    },
    "github": {
      "url": "https://api.githubcopilot.com/mcp/",
      "transport": "http",
      "auth": "oauth2"
    }
  }
}
```

**Step 2: ESLint MCP (Already Have ESLint)**

```bash
# Test that ESLint MCP works
npx eslint --mcp --help

# No installation needed if ESLint v9.26.0+
```

**Step 3: High Priority Local Servers**

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "postgres-mcp"],
      "env": {
        "POSTGRES_CONNECTION_STRING": "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
      }
    },
    "git": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-git", "/workspaces/rock-on/.git"]
    },
    "sqlite": {
      "command": "npx",
      "args": ["-y", "@simonholm/sqlite-mcp-server", "/workspaces/rock-on/tests/test-data.db"]
    }
  }
}
```

**Step 4: Test Installation**

```bash
# Verify servers are accessible
# (Commands depend on your IDE/CLI tool)

# Test Supabase MCP
mcp list-tools supabase

# Test GitHub MCP
mcp list-tools github

# Test local servers
mcp list-tools postgres
mcp list-tools git
```

### Benefits Summary

**With These MCP Servers:**

1. **Supabase MCP** → Supabase Agent can:
   - Create migrations directly via chat
   - Query database to validate pgTAP tests
   - Inspect schema without manual SQL
   - **Eliminates "shotgun fixes" - agent queries actual DB state**

2. **GitHub MCP** → Finalize Agent can:
   - Create PRs with one command
   - Assign reviewers automatically
   - Search code across entire GitHub
   - No more manual git commands!

3. **ESLint MCP** → Execute/Finalize Agents can:
   - Run linting during implementation
   - Auto-fix issues before commit
   - Explain violations in context
   - Enforces quality automatically

4. **PostgreSQL MCP** → Supabase/Test Agents can:
   - Validate RLS policies with real queries
   - Inspect actual vs expected schema
   - Performance analysis
   - Direct DB access for debugging

5. **Git MCP** → Diagnose Agent can:
   - Find when bugs were introduced
   - See what changed in related files
   - Analyze commit history
   - **Root cause analysis with git blame**

6. **Markdown Library MCP** → Research/Plan Agents can:
   - Search all `.claude/` documentation instantly
   - Find relevant specs and artifacts
   - Version-aware search
   - **No more manual grep through docs**

### Real-World Usage Examples

**Example 1: Supabase Agent with Supabase MCP**

```markdown
Agent: "I need to add a favorites table"

With Supabase MCP:
1. supabase-mcp: create_table
   - name: "song_favorites"
   - columns: {song_id, user_id, created_date}
   - constraints: UNIQUE(song_id, user_id)

2. supabase-mcp: create_rls_policy
   - table: "song_favorites"
   - operation: SELECT
   - using: "user_id = auth.uid()"

3. supabase-mcp: query
   - "SELECT * FROM song_favorites WHERE user_id = $1"
   - Validates policy works!

Agent marks task complete with confidence - DB state verified!
```

**Example 2: Finalize Agent with GitHub MCP + ESLint MCP**

```markdown
Agent: "Finalize feature and create PR"

With GitHub + ESLint MCP:
1. eslint-mcp: check_files
   - Finds 3 linting errors

2. eslint-mcp: auto_fix
   - Fixes all 3 errors

3. github-mcp: create_pull_request
   - title: "feat: Add song favorites"
   - body: [auto-generated description]
   - labels: ["feature", "ready-for-review"]
   - assignees: ["tech-lead"]

4. github-mcp: get_pr_url
   - Returns: https://github.com/user/repo/pull/42

Agent completes in seconds - no manual git commands!
```

**Example 3: Diagnose Agent with Git MCP + Chrome MCP**

```markdown
Agent: "E2E test failing - investigate"

With Git + Chrome MCP:
1. chrome-mcp: reproduce failure
   - Navigate, click, see error

2. chrome-mcp: get_console_messages
   - Error: "API endpoint /api/v2/songs not found"

3. git-mcp: search_commits
   - pattern: "/api/v1/songs"
   - Found: Commit abc123 changed endpoint

4. git-mcp: show_diff
   - commit: abc123
   - Shows: /api/v1/songs → /api/v2/songs

5. git-mcp: blame
   - file: AuthContext.tsx:89
   - Shows: Old endpoint still used here!

Agent identifies exact cause in minutes - git history analysis automated!
```

### Custom MCP Server Ideas

**Rock-On Specific:**
1. **Supabase Testing MCP** - Local Supabase connection, RLS testing
2. **Design System MCP** - Validate against design-style-guide.md
3. **Test Data MCP** - Generate realistic multi-user scenarios

---

## Implementation Checklist

To implement this workflow, these steps are needed:

### Phase 1: Agent Definitions (Day 1) ✅ COMPLETE
- [X] Create `.claude/agents/research-agent.md`
- [X] Create `.claude/agents/plan-agent.md`
- [X] Create `.claude/agents/execute-agent.md`
- [X] Create `.claude/agents/supabase-agent.md`
- [X] Create `.claude/agents/test-agent.md`
- [X] Create `.claude/agents/diagnose-agent.md`
- [X] Create `.claude/agents/finalize-agent.md`
- [X] Create `.claude/artifacts/2025-11-11T04:57_mcp-integration-plan.md`

### Phase 2: Templates (Day 1)
- [ ] Create `.claude/templates/research-template.md`
- [ ] Create `.claude/templates/plan-template.md`
- [ ] Create `.claude/templates/tasks-template.md`
- [ ] Create `.claude/templates/implementation-template.md`
- [ ] Create `.claude/templates/test-report-template.md`

### Phase 3: Commands (Day 2)
- [ ] Create `.claude/commands/research.md`
- [ ] Update `.claude/commands/plan.md`
- [ ] Create `.claude/commands/execute.md`
- [ ] Create `.claude/commands/test.md`
- [ ] Create `.claude/commands/diagnose.md`

### Phase 4: Directory Structure (Day 2)
- [ ] Create `.claude/active-work/` directory
- [ ] Create `.claude/active-work/.gitignore` (ignore WIP files)
- [ ] Create `.claude/templates/` directory

### Phase 5: Documentation (Day 2)
- [ ] Update `CLAUDE.md` with new workflow
- [ ] Create `.claude/specifications/agent-workflow-guide.md`
- [ ] Add workflow diagram to documentation

### Phase 6: Testing the Workflow (Day 3)
- [ ] Pick a small feature to test workflow
- [ ] Run through: /research → /plan → /execute → /test
- [ ] Identify gaps or improvements
- [ ] Refine agent prompts based on real usage

### Phase 7: Team Onboarding (Day 4)
- [ ] Create quick-start guide for developers
- [ ] Document when to use which command
- [ ] Create troubleshooting guide
- [ ] Update contribution guidelines

---

## Benefits Summary

### For Development Velocity
- ✅ **Repeatable Process:** Every feature follows proven workflow
- ✅ **Parallel Work:** Multiple features can be in different phases
- ✅ **Context Preservation:** Work can be paused and resumed easily
- ✅ **Clear Handoffs:** Each agent knows exactly what the previous agent did

### For Code Quality
- ✅ **TDD Enforced:** Tests written before implementation
- ✅ **Comprehensive Testing:** Integration and E2E tests mandatory
- ✅ **Root Cause Analysis:** Diagnose agent ensures we understand failures
- ✅ **Architecture Reviews:** Plan agent validates design before coding

### For Project Management
- ✅ **Traceability:** Full history from research → implementation → testing
- ✅ **Progress Tracking:** tasks.md shows exactly what's done
- ✅ **Risk Management:** Research phase identifies risks early
- ✅ **Quality Gates:** Can't skip testing or planning phases

### For Team Collaboration
- ✅ **Standardized Docs:** Everyone uses same markdown formats
- ✅ **Clear Responsibility:** Each agent has specific role
- ✅ **Audit Trail:** Artifacts show why decisions were made
- ✅ **Onboarding:** New developers see clear process to follow

---

## Next Steps

**Recommendation:** Implement in phases

1. **Week 1:** Create agents and templates
2. **Week 2:** Test workflow with 1-2 small features
3. **Week 3:** Refine based on learnings
4. **Week 4:** Full adoption across all new work

**Pilot Feature Suggestion:**
- Choose a small, well-defined feature
- Run it through the full workflow
- Document pain points and improvements
- Iterate on agent prompts

**Success Metrics:**
- Features complete with fewer iterations
- Test coverage increases
- Fewer production bugs
- Faster onboarding for new contributors

---

## Questions for Discussion

1. **Active Work Directory:** Should `.claude/active-work/` be in `.gitignore`, or should WIP be committed?

2. **Agent Model Selection:** Should all agents use `sonnet`, or should some use `haiku` for speed?

3. **Automation:** Should workflow commands automatically trigger the next phase, or require explicit user commands?

4. **Integration with CI/CD:** How should this workflow integrate with automated deployments?

5. **Artifact Storage:** Should timestamped artifacts eventually be archived to prevent `.claude/artifacts/` from growing too large?

---

**Created:** 2025-11-11T01:45
**Updated:** 2025-11-11T06:00
**Status:** Phase 1 Complete - Agent Definitions Created
**Next Step:**
1. Register MCP servers (Phase 1: PostgreSQL, ESLint)
2. Test workflow with small feature
3. Create templates (Phase 2)
