---
description: Create implementation plan from research - generates architecture and task breakdown
---

# Implementation Planning

Create a detailed implementation plan from existing research. This command spawns the plan-agent to design architecture and break down the feature into executable tasks.

## Usage

```
/plan <feature-name>
```

## Prerequisites

**Research should exist first!** Run `/research <feature-name>` before `/plan`.

The plan-agent looks for research in:

1. `.claude/backlog/<feature-name>/` (will be moved to features/)
2. `.claude/features/<feature-name>/` (already active)

## Examples

```
/plan improved-auth-flow
/plan dark-mode
```

## What This Does

1. **Activates the feature**: Moves from `backlog/` to `features/` if needed
2. **Reads research document** from the feature directory
3. **Designs architecture**: Component hierarchy, data flow, state management
4. **Creates implementation plan**: `YYYY-MM-DDTHH:MM_plan.md` with:
   - Architecture overview (ASCII diagrams)
   - File structure (what to create/modify)
   - Component specifications
   - Database changes (if any)
   - Testing strategy
5. **Creates task breakdown**: `tasks.md` with:
   - Ordered, dependency-aware tasks
   - TDD approach (tests before implementation)
   - Parallel execution markers [P]
   - Clear acceptance criteria

## Process

The plan-agent will:

1. **Locate and Activate Feature**
   - Check `.claude/features/<feature-name>/` first
   - If not found, check `.claude/backlog/<feature-name>/`
   - Move backlog contents to `features/` to mark as active
   - Log: "Activating feature: moving from backlog to features"

2. **Review Research**
   - Load research document
   - Read `CLAUDE.md` for project conventions
   - Check database schema and design guides
   - Verify all open questions are answered

3. **Design Architecture**
   - Sketch component hierarchy
   - Define data flow
   - Plan state management
   - Identify integration points

4. **Plan File Structure**
   - List files to create
   - List files to modify (with specific sections)
   - Follow existing project patterns

5. **Create Task Breakdown**
   - Order by dependencies
   - Group by phase (Setup -> Tests -> Core -> Integration -> Polish)
   - Mark parallelizable tasks with [P]
   - Include clear file paths and acceptance criteria

6. **Generate Artifacts**
   - `YYYY-MM-DDTHH:MM_plan.md` - Architecture and design
   - `tasks.md` - Executable task list

## Directory Structure

Planning **activates** a feature by moving it to the features directory:

```
.claude/
├── backlog/           <- Research lives here initially
│   └── <feature>/
│       └── *_research.md
│
├── features/          <- /plan moves feature here (active work)
│   └── <feature>/
│       ├── *_research.md   (moved from backlog)
│       ├── *_plan.md       (created by /plan)
│       └── tasks.md        (created by /plan)
│
└── completed/         <- /finalize moves feature here when done
```

## Task Format

Tasks in `tasks.md` follow this format:

```markdown
---
feature: <Feature Name>
created: YYYY-MM-DDTHH:MM
status: in-progress
based-on: <plan-filename>
---

## Phase 1: Setup

- [ ] T001: Initialize feature structure
  - Files: `src/features/auth/`
  - Acceptance: Directory exists with index.ts

## Phase 2: Tests [TDD]

- [ ] T002: [P] Write unit tests for useAuthCheck hook
  - Files: `tests/unit/hooks/useAuthCheck.test.ts`
  - Acceptance: Tests define expected behavior

## Phase 3: Core Implementation

- [ ] T003: Implement useAuthCheck hook
  - Files: `src/hooks/useAuthCheck.ts`
  - Depends: T002
  - Acceptance: All tests pass
```

## Next Steps After Planning

Once planning is complete, proceed to implementation:

```
/implement <feature-name>
```

## User Input

$ARGUMENTS
