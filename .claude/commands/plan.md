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

**Research must exist first!** Run `/research <feature-name>` before `/plan`.

The plan-agent expects to find:

- `.claude/features/<feature-name>/*_research.md`

## Examples

```
/plan improved-auth-flow
/plan dark-mode
```

## What This Does

1. **Reads research document** from `.claude/features/<feature-name>/`
2. **Designs architecture**: Component hierarchy, data flow, state management
3. **Creates implementation plan**: `YYYY-MM-DDTHH:MM_plan.md` with:
   - Architecture overview (ASCII diagrams)
   - File structure (what to create/modify)
   - Component specifications
   - Database changes (if any)
   - Testing strategy
4. **Creates task breakdown**: `tasks.md` with:
   - Ordered, dependency-aware tasks
   - TDD approach (tests before implementation)
   - Parallel execution markers [P]
   - Clear acceptance criteria

## Process

The plan-agent will:

1. **Review Research**
   - Load research document
   - Read `CLAUDE.md` for project conventions
   - Check database schema and design guides
   - Verify all open questions are answered

2. **Design Architecture**
   - Sketch component hierarchy
   - Define data flow
   - Plan state management
   - Identify integration points

3. **Plan File Structure**
   - List files to create
   - List files to modify (with specific sections)
   - Follow existing project patterns

4. **Create Task Breakdown**
   - Order by dependencies
   - Group by phase (Setup → Tests → Core → Integration → Polish)
   - Mark parallelizable tasks with [P]
   - Include clear file paths and acceptance criteria

5. **Generate Artifacts**
   - `YYYY-MM-DDTHH:MM_plan.md` - Architecture and design
   - `tasks.md` - Executable task list

## Task Format

Tasks in `tasks.md` follow this format:

```markdown
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
