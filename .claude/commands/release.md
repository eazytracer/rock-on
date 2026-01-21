---
description: Cut a release - bump version, update changelog, create git tag and GitHub release
---

# Release

Cut a new release after a PR has been merged to main. Handles version bumping, changelog updates, git tagging, and GitHub release creation.

## Usage

```
/release [patch|minor|major]
```

## Arguments

- `patch` - Bug fixes, backwards compatible (0.2.1 → 0.2.2)
- `minor` - New features, backwards compatible (0.2.1 → 0.3.0)
- `major` - Breaking changes (0.2.1 → 1.0.0)

If no argument provided, you'll be prompted to choose.

## Prerequisites

- Must be on `main` branch
- Working tree must be clean (no uncommitted changes)
- PR should already be merged

## Examples

```
/release patch    # Bug fix release
/release minor    # Feature release
/release major    # Breaking change release
/release          # Prompt for release type
```

## What This Does

### Step 1: Pre-flight Checks

```bash
# Verify on main branch
git branch --show-current  # Must be "main"

# Verify clean working tree
git status --porcelain     # Must be empty

# Pull latest changes
git pull origin main
```

### Step 2: Determine Version

```bash
# Get current version
cat package.json | grep '"version"'

# Calculate new version based on argument:
# - patch: 0.2.1 → 0.2.2
# - minor: 0.2.1 → 0.3.0
# - major: 0.2.1 → 1.0.0
```

### Step 3: Check CHANGELOG

Verify `CHANGELOG.md` has content in `[Unreleased]` section:

```markdown
## [Unreleased]

### Added

- New feature X

### Fixed

- Bug Y
```

If `[Unreleased]` is empty, warn and ask if release should proceed.

### Step 4: Update Version

```bash
# Bump version in package.json (and package-lock.json)
npm version <patch|minor|major> --no-git-tag-version
```

### Step 5: Update CHANGELOG

Move `[Unreleased]` content to new version section:

```markdown
## [Unreleased]

## [0.2.2] - 2026-01-21

### Added

- New feature X

### Fixed

- Bug Y

## [0.2.1] - 2026-01-21

...
```

### Step 6: Commit Release

```bash
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore: release v0.2.2

Release 0.2.2 includes:
- [Summary of changes from CHANGELOG]

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Step 7: Create Tag

```bash
git tag v0.2.2
```

### Step 8: Push

```bash
git push origin main
git push origin v0.2.2
```

### Step 9: Create GitHub Release

```bash
gh release create v0.2.2 \
  --title "v0.2.2 - [Release Title]" \
  --notes "[Notes from CHANGELOG]"
```

## Release Notes Format

The GitHub release notes are generated from the CHANGELOG section:

```markdown
## What's Changed

### Added

- New feature X

### Fixed

- Bug Y (#123)

### Changed

- Updated Z

**Full Changelog**: https://github.com/owner/repo/compare/v0.2.1...v0.2.2
```

## Error Handling

### Not on main branch

```
Error: Must be on main branch to release.
Current branch: feature/xyz

Run: git checkout main && git pull origin main
```

### Uncommitted changes

```
Error: Working tree has uncommitted changes.

Run: git status
Then commit or stash changes before releasing.
```

### Empty CHANGELOG

```
Warning: [Unreleased] section in CHANGELOG.md is empty.

This usually means:
1. Changes weren't documented in CHANGELOG
2. Release was already cut

Proceed anyway? [y/N]
```

### Tag already exists

```
Error: Tag v0.2.2 already exists.

This version may have already been released.
Check: gh release view v0.2.2
```

## Relationship to /finalize

| `/finalize`                 | `/release`                         |
| --------------------------- | ---------------------------------- |
| Runs BEFORE PR merge        | Runs AFTER PR merge                |
| Quality checks (lint, test) | No quality checks (already passed) |
| Prepares PR                 | Cuts release                       |
| Suggests version bump       | Performs version bump              |
| Updates docs                | Updates CHANGELOG                  |
| Creates PR                  | Creates GitHub release             |

**Typical workflow:**

```
1. /implement feature-x     # Build the feature
2. /finalize feature-x      # Quality checks, create PR
3. [Merge PR on GitHub]
4. /release patch           # Cut the release
```

## User Input

$ARGUMENTS
