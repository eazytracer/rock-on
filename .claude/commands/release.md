---
description: Cut a release AFTER merge - tag the merge commit and create the GitHub release (Phase 2, no version bump, no new commit)
---

# Release (Phase 2 — post-merge)

Cut a release **after** a PR has merged to `main`. This is **Phase 2** of the
two-phase release policy in `CLAUDE.md`: the version bump, CHANGELOG section, and
`release_notes` row were already done **in the PR** (Phase 1, via `/finalize`) and
are part of the merge commit. `/release` therefore **only tags the merge commit
and publishes the GitHub release** — it does NOT bump the version and does NOT
create any new commit.

## Why no version bump here

A git tag must point at the merge commit, which doesn't exist until the PR
merges. Because Phase 1 already put the correct `version` in the merge commit,
tagging is a pure pointer operation: no "release commit", no file changes, no
chicken-and-egg. If `package.json` on `main` still shows the _previous_ version,
Phase 1 was skipped — STOP and fix the PR flow, do not bump on `main`.

## Usage

```
/release
```

No version argument: the version to release is read from `package.json` on
`main` (set during Phase 1). `/release` never computes or changes it.

## Prerequisites

- On `main`, working tree clean, and `git pull origin main` done.
- The merge commit carries the intended `package.json` version (Phase 1 landed).
- `CHANGELOG.md` has a dated `## [<version>]` section for that version.
- No `v<version>` tag exists yet.

## What This Does

### Step 1: Pre-flight

```bash
git branch --show-current            # must be "main"
git status --porcelain               # must be empty
git pull origin main
VERSION=$(node -p "require('./package.json').version")
echo "Releasing v$VERSION (read from package.json — NOT computed)"
```

### Step 2: Verify Phase 1 landed (fail fast if not)

```bash
# The version on main must differ from the latest existing tag, i.e. Phase 1
# bumped it in the merged PR. If they match, the bump was skipped.
LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "none")
echo "latest tag: $LATEST_TAG  |  package.json: v$VERSION"
if [ "$LATEST_TAG" = "v$VERSION" ]; then
  echo "ERROR: v$VERSION already tagged — this version was already released."
  exit 1
fi

# CHANGELOG must have a dated section for this version.
grep -qE "^## \[$VERSION\] - [0-9]{4}-[0-9]{2}-[0-9]{2}" CHANGELOG.md \
  || { echo "ERROR: no dated ## [$VERSION] section in CHANGELOG.md (Phase 1 incomplete)"; exit 1; }
```

If either check fails, the PR did not complete Phase 1. Do NOT paper over it by
bumping on `main` — go back and fix the PR (or the next PR), then re-run.

### Step 3: Tag the merge commit (annotated)

```bash
git tag -a "v$VERSION" -m "Release v$VERSION"
```

### Step 4: Push the tag

```bash
git push origin "v$VERSION"
```

(`main` itself needs no push — nothing changed on `main`.)

### Step 5: Create the GitHub release

Extract the CHANGELOG section for this version as the notes body:

```bash
# Notes = the lines between "## [$VERSION]" and the next "## [" header.
awk "/^## \[$VERSION\]/{f=1;next} /^## \[/{f=0} f" CHANGELOG.md > /tmp/release-notes.md
gh release create "v$VERSION" \
  --title "v$VERSION" \
  --notes-file /tmp/release-notes.md \
  --verify-tag
```

## Error Handling

### Not on main

```
Error: Must be on main to release. Run: git checkout main && git pull origin main
```

### package.json version not bumped (Phase 1 skipped)

```
Error: package.json on main still shows the last-released version.
Phase 1 (version bump + CHANGELOG + release_notes) was not done in the PR.
Fix: open a follow-up PR that performs Phase 1, merge it, then /release.
Do NOT bump the version directly on main.
```

### Tag already exists

```
Error: Tag v<version> already exists — this version was already released.
Check: gh release view v<version>
```

## Relationship to /finalize

| `/finalize` (Phase 1)               | `/release` (Phase 2)                  |
| ----------------------------------- | ------------------------------------- |
| Runs BEFORE PR merge, on the branch | Runs AFTER PR merge, on `main`        |
| Quality checks (lint/test/e2e)      | No quality checks (CI already passed) |
| **Bumps `package.json` version**    | **Reads** the version (never bumps)   |
| **Writes dated CHANGELOG section**  | Reads CHANGELOG for release notes     |
| **Adds `release_notes` row**        | —                                     |
| Creates the PR                      | Tags merge commit + GitHub release    |

**Typical workflow:**

```
1. /implement feature-x     # Build the feature
2. /finalize feature-x      # Phase 1: bump + CHANGELOG + release_notes, create PR
3. [Review + merge PR on GitHub]   # merge commit carries the version
4. /release                 # Phase 2: tag the merge commit + GH release
```

The `release-metadata` GitHub Actions gate enforces this split automatically
(Phase 1 on PRs, Phase 2 audit on push to main) — see CLAUDE.md.

## User Input

$ARGUMENTS
