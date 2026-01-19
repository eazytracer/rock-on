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

4. **Completes feature**:
   - Creates `SUMMARY.md` with consolidated feature overview
   - **Deletes** research, plan, and tasks files (no archive.tar)
   - Moves directory to `.claude/completed/<feature-name>/`
   - Updates `CHANGELOG.md` with feature entry

5. **Handles versioning** (optional):
   - Prompts for version bump if warranted
   - Updates `package.json` version
   - Suggests GitHub release tag

6. **Prepares git workflow**:
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

## Feature Completion

When finalization completes, the feature is moved to `.claude/completed/`:

**What gets deleted:**

- All timestamped `.md` files (research, plans)
- `tasks.md` task breakdown file
- `archive.tar` (if exists from old workflow)

**What gets created:**

- `SUMMARY.md` - Technical reference for the feature

**Final location:**

- `.claude/completed/<feature-name>/SUMMARY.md`

**Why no archive.tar?**

- Git history preserves actual code changes
- SUMMARY.md captures key technical decisions
- Research/plans have diminishing value once implemented
- Reduces repository bloat

## SUMMARY.md Format

```markdown
# <Feature Name> - Summary

**Completed:** YYYY-MM-DD
**Version:** 0.2.0 (if version was bumped)
**PR:** #123

## Overview

Brief description of what was implemented and why.

## Key Changes

### New Files

- `src/components/NewComponent.tsx` - Description
- `src/hooks/useNewHook.ts` - Description

### Modified Files

- `src/App.tsx` - What changed and why

### Deleted Files

- `src/components/OldComponent.tsx` - Why removed

## Database Changes

Tables, columns, RLS policies added/modified (if any).

## Testing

- Unit tests: X new tests
- E2E tests: X new tests
- Coverage: Key areas tested

## Breaking Changes

List any breaking changes (or "None").

## Related

- Depends on: <other-feature> (if applicable)
- Enables: <future-feature> (if applicable)
```

## CHANGELOG.md Entry

The finalize command adds an entry to the project's `CHANGELOG.md`:

```markdown
## [Unreleased]

### Added

- Persistent layout architecture - eliminates white screen flicker (#6)

### Fixed

- Delete song sync issue - songs no longer reappear after deletion
```

## Version Bump (Optional)

For features that warrant a version bump, the finalize command prompts:

```
Feature complete! Does this warrant a version bump?

1. No version change (internal refactor, tests only)
2. Patch (0.1.1) - Bug fixes only
3. Minor (0.2.0) - New feature, backward compatible
4. Major (1.0.0) - Breaking changes

Select [1-4]:
```

If a version bump is selected:

1. Updates `package.json` version
2. Moves CHANGELOG [Unreleased] items to new version section
3. Suggests creating a GitHub release tag

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

**Option 4: Create Release** (after merging)

```bash
git tag v0.2.0
git push origin v0.2.0
gh release create v0.2.0 --generate-notes
```

## Handling Issues

If quality checks fail:

- Agent will report specific failures
- Suggest running `/diagnose` for test failures
- List files needing fixes

If tasks incomplete:

- Agent will list remaining tasks
- Suggest continuing with `/implement`

## Directory Structure

```
.claude/
├── backlog/           <- Researched but not started
│   └── future-feature/
│
├── features/          <- Active work
│   └── current-feature/
│       ├── *_research.md
│       ├── *_plan.md
│       └── tasks.md
│
└── completed/         <- Done (SUMMARY.md only)
    ├── persistent-layout/
    │   └── SUMMARY.md
    └── improved-auth-sync/
        └── SUMMARY.md
```

## User Input

$ARGUMENTS
