---
description: Finalize feature - runs quality checks, updates docs, prepares for merge
---

# Finalize Feature

Complete a feature implementation with final quality checks, documentation updates, and git workflow. This command spawns the finalize-agent for final validation.

## Usage

```
/finalize <feature-name>
```

## Prerequisites

**Implementation should be complete!** All tasks in `tasks.md` should be marked done.

## Examples

```
/finalize improved-auth-flow
/finalize dark-mode
```

## What This Does

1. **Runs quality checks**:
   - `npm run type-check` - TypeScript validation
   - `npm run lint` - Code style
   - `npm test` - All unit/integration tests
   - `npm run test:e2e` - E2E tests (if applicable)

2. **Validates completeness**:
   - All tasks in `tasks.md` marked complete
   - No TODO comments left in new code
   - No console.log statements (except intentional)
   - Tests cover new functionality

3. **Updates documentation**:
   - Updates `CLAUDE.md` if new patterns introduced
   - Creates/updates relevant specs in `.claude/specifications/`
   - Adds JSDoc comments where needed

4. **Archives feature documentation**:
   - Creates `SUMMARY.md` with consolidated feature overview
   - Archives all `.md` files to `archive.tar` (gitignored)
   - Summary includes: branch/commits, plan overview, changes made
   - Documents: pages, schemas, and user flows altered

5. **Prepares git workflow**:
   - Shows `git status` summary
   - Suggests commit message
   - Optionally creates commit
   - Optionally creates PR

## Quality Checklist

The finalize-agent verifies:

```
Code Quality
- [ ] TypeScript compiles without errors
- [ ] ESLint passes
- [ ] No unused imports or variables
- [ ] Consistent code style

Testing
- [ ] All existing tests pass
- [ ] New tests added for new functionality
- [ ] Edge cases covered
- [ ] No skipped tests without reason

Documentation
- [ ] Code comments where logic is complex
- [ ] JSDoc for public functions/components
- [ ] README/CLAUDE.md updated if needed

Security
- [ ] No secrets or credentials in code
- [ ] Input validation where needed
- [ ] RLS policies if database changes

Accessibility (for UI changes)
- [ ] Keyboard navigation works
- [ ] ARIA labels present
- [ ] Color contrast sufficient
```

## Output

Creates a finalization report:

```markdown
# Finalization Report: <feature-name>

## Quality Checks

- [x] TypeScript: PASS
- [x] Lint: PASS
- [x] Tests: 142 passed, 0 failed
- [ ] E2E: SKIPPED (no new E2E tests)

## Task Completion

- Total tasks: 12
- Completed: 12
- Remaining: 0

## Files Changed

- 8 files modified
- 3 files created
- 0 files deleted

## Suggested Commit Message

feat(auth): implement unified auth check for protected routes

- Add useAuthCheck hook for session validation
- Update ProtectedRoute to use auth context
- Redirect to login on session expiry
- Add unit tests for auth flow

## Next Steps

- [ ] Review changes: `git diff`
- [ ] Create commit: `git add . && git commit`
- [ ] Push branch: `git push -u origin feature/improved-auth-flow`
- [ ] Create PR: `gh pr create`
```

## Git Workflow Options

After finalization, you can:

**Option 1: Manual Review**

```bash
git status
git diff
# Review changes, then commit manually
```

**Option 2: Auto-Commit**
Ask the agent to create the commit with the suggested message.

**Option 3: Create PR**
Ask the agent to push and create a pull request.

## Handling Issues

If quality checks fail:

- Agent will report specific failures
- Suggest running `/diagnose` for test failures
- List files needing fixes

If tasks incomplete:

- Agent will list remaining tasks
- Suggest continuing with `/implement`

## Feature Archiving

When finalization completes, feature documentation is archived to keep `.claude/features/` clean:

**What gets archived:**

- All timestamped `.md` files (research, plans, progress notes)
- `tasks.md` task breakdown file

**What remains:**

- `SUMMARY.md` - Consolidated summary for future reference

**Archive location:**

- `.claude/features/<feature-name>/archive.tar` (gitignored)

**SUMMARY.md includes:**

```markdown
# Feature Name - Feature Summary

**Branch:** feature/<name>
**Base Commit:** <hash>
**Completed Date:** <date>

## Overview

Brief description of what was implemented

## Original Plan

Summary of initial plan

## Plan Changes

What changed during implementation

## Database Schema Changes

Tables, columns, RLS policies added/modified

## Pages Modified

Table of pages and changes

## Components Created

New components added

## User Flows Altered

Before/after descriptions

## Key Commits

Important commits with descriptions

## Archive Contents

List of archived files
```

## User Input

$ARGUMENTS
