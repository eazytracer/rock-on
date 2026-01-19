---
description: Execute implementation tasks from plan - implements feature following TDD approach
---

# Feature Implementation

Execute the implementation plan by working through tasks in `tasks.md`. This command coordinates implementation using the appropriate specialized agents.

## Usage

```
/implement <feature-name>
```

## Prerequisites

**Plan and tasks must exist first!** Run `/research` then `/plan` before `/implement`.

The implement workflow expects to find in `.claude/features/<feature-name>/`:

- `*_research.md` - Background research
- `*_plan.md` - Architecture and design decisions
- `tasks.md` - Task breakdown with acceptance criteria

Note: If your feature is still in `.claude/backlog/`, run `/plan` first to activate it.

## Examples

```
/implement improved-auth-flow
/implement dark-mode
```

## What This Does

1. **Loads implementation context**:
   - Reads `tasks.md` for task list
   - Reads `*_plan.md` for architecture decisions
   - Reads `*_research.md` for constraints and risks

2. **Executes tasks in order**:
   - Respects dependencies between tasks
   - Runs parallel tasks [P] concurrently when possible
   - Follows TDD: writes tests before implementation
   - Marks tasks complete as they finish

3. **Uses specialized agents**:
   - `nextjs-react-developer` - For React/UI components
   - `supabase-agent` - For database changes, migrations, RLS
   - `test-agent` - For E2E and integration tests

4. **Validates progress**:
   - Runs tests after each phase
   - Checks type errors with `npm run type-check`
   - Verifies acceptance criteria

## Execution Flow

```
Phase 1: Setup
  └─ Create directories, install deps, configure

Phase 2: Tests [TDD]
  └─ Write failing tests that define expected behavior
  └─ Tasks marked [P] can run in parallel

Phase 3: Core Implementation
  └─ Implement features to make tests pass
  └─ Follow architecture from plan.md

Phase 4: Integration
  └─ Connect components, wire up services
  └─ Database migrations if needed

Phase 5: Polish
  └─ Additional tests, documentation, cleanup
```

## Task Progress Tracking

As tasks complete, they're marked in `tasks.md`:

```markdown
## Phase 2: Tests

- [x] T002: Write unit tests for useAuthCheck hook ✓
- [x] T003: Write unit tests for ProtectedRoute ✓
- [ ] T004: Write E2E test for session expiry redirect <- Current

## Phase 3: Core Implementation

- [ ] T005: Implement useAuthCheck hook
- [ ] T006: Update ProtectedRoute component
```

## Handling Failures

If a task fails:

1. **Stop execution** (for sequential tasks)
2. **Log the error** with context
3. **Suggest running `/diagnose`** to investigate

For parallel tasks [P]:

- Continue with other parallel tasks
- Report failures at phase end
- Block dependent tasks

## Commands During Implementation

While implementing, you may need:

```
/diagnose <feature-name>  # If tests fail or bugs appear
npm run type-check        # Verify TypeScript
npm test                  # Run test suite
npm run lint              # Check code style
```

## Next Steps After Implementation

Once all tasks complete:

```
/finalize <feature-name>
```

This will:

- Run final quality checks
- Create SUMMARY.md
- Move feature to `.claude/completed/`
- Optionally bump version and update CHANGELOG.md

## User Input

$ARGUMENTS
