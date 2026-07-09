---
timestamp: 2026-07-09T19:57
prompt_summary: >
  Capture the empirically-discovered CI/CD gaps found while triaging the
  "over half the e2e suite failing" report during the 0.4.x patch release,
  plus a proposed GitHub Actions gate to enforce the release-metadata policy
  (changelog + version bump + tag) that currently lives only as prose in
  CLAUDE.md.
status: Backlog — captured, not scheduled. Release focus stays on getting the
  e2e suite running + green first.
---

# CI/CD Pipeline — Empirical Gaps & Release Gates (discovered 2026-07-09)

This document records **what we found is actually true today** (as opposed to
the aspirational design in the sibling `*_research.md` / `*_implementation-plan.md`).
These gaps were surfaced while investigating a report that "over half of our e2e
tests are failing" during the v0.4.x patch cycle. They are the concrete,
prioritized backlog for `ci-cd-pipeline`.

## Context: why this surfaced

Three releases (v0.4.0 / v0.4.1 / v0.4.2) shipped from this container yesterday.
None of their gates ran a browser, so a total inability to launch WebKit went
undetected. See "Finding 2" — this is the important one.

---

## Finding 1 — Devcontainer never provisioned the full browser matrix

- `playwright.config.ts` runs **5 projects** across 3 engines: chromium
  (Desktop + Mobile/Pixel 5), firefox (Desktop), **webkit (Desktop Safari +
  Mobile Safari/iPhone 12)**.
- The committed `.devcontainer/setup.sh` ran **only** `npx playwright install
firefox`. Git history confirms chromium and webkit were **never** in the
  committed setup (`git log -S "install webkit"` / `"install chromium"` → zero
  commits). chromium existed in this long-lived container only from ad-hoc
  manual installs; webkit was never installed here at all.
- Result: on a fresh container build, 2 of 5 projects (both webkit) — ~40% of
  every e2e run — fail instantly with
  `Executable doesn't exist at .../webkit-*/pw_run.sh`. A _truly_ fresh build
  would be worse: Firefox-only, ~80% of the matrix unable to launch.

**Fix (applied in working tree, part of this release):**

```bash
npx playwright install --with-deps chromium firefox webkit
```

`--with-deps` installs each browser plus its apt system libraries
(libwebpmux/libenchant/libhyphen/libwoff2/libmanette) in the one
root-privileged `postCreateCommand` step. Verified webkit launches + passes
after this change.

## Finding 2 — There is NO enforced e2e gate anywhere (the real problem)

Traced every gate end-to-end. None of them run Playwright:

| Gate                              | Runs                                                                   | Playwright e2e?          |
| --------------------------------- | ---------------------------------------------------------------------- | ------------------------ |
| `.husky/pre-commit`               | `lint-staged` + conditional ER-diagram check                           | ❌ no tests              |
| CI (`.github/workflows/ci.yml`)   | eslint, type-check, prettier, ER-diagram, `npm test` (vitest)          | ❌ **no Playwright job** |
| `npm run test:all` / `start:test` | `npm run test && npm run test:db` (vitest + pgTAP)                     | ❌ not chained           |
| `/finalize`                       | type-check, lint, `npm test`, `npm run test:e2e` **"(if applicable)"** | ⚠️ discretionary only    |
| `/release`                        | version bump, changelog, tag, GH release                               | ❌ no tests              |

So the webkit gap (Finding 1) was **structurally invisible** — the browser
suite is not wired into any blocking gate. The only reference is the
`/finalize` checklist line `finalize.md:32`, qualified "(if applicable)", i.e.
a human/agent judgment call that is trivially skipped, especially given the
suite "has a tendency to time out."

**Even with webkit fixed, the next release could regress any browser-facing
behavior and every automated check would still go green.** This is the item
that most needs fixing.

**Proposed fix:**

- Add a CI job that boots Supabase (CLI + Docker) + edge functions + dev
  server and runs Playwright on PRs to `main`. Start with **chromium +
  webkit** (the two engines) to bound runtime; shard for speed.
- Make `npm run test:e2e` a **required** (not "if applicable") step in
  `/finalize`, and add a `test:release` script that chains it so `/release`
  can't skip it.
- Only turn the CI job into a required status check **after** the suite is
  reliably green (see "Prerequisite" below) — a flaky required gate trains
  everyone to click through it, which is how we got here.

## Finding 3 — `test:all` is misleadingly named

`"test:all": "npm run test && npm run test:db"` = vitest + pgTAP only. It reads
as "everything" but excludes e2e. Either rename, or make it genuinely include
e2e once the suite is trustworthy. Low-effort, high-clarity.

## Finding 4 — Release-metadata policy is prose-only, not enforced

`CLAUDE.md` "Versioning & Release Policy (REQUIRED)" mandates, for every
prod-bound PR: (1) `package.json` version bump, (2) dated `CHANGELOG.md`
`## [x.y.z]` section, (3) a `release_notes` row, (4) an annotated `vX.Y.Z`
tag on the merge commit. This bit us across the 0.4 launch (three same-day
hotfixes shipped while `package.json` stayed `0.4.0`, no tags cut). It is
currently enforced by **discipline only**.

**Proposed GitHub Actions gate (user-requested 2026-07-09):** a
`release-metadata` job on `pull_request` → `main` that fails unless:

1. **Version bumped** — `package.json` `version` on the PR head differs from
   `origin/main`, and is a valid SemVer increment (never a reused shipped
   version). Cheap check:
   ```bash
   base=$(git show origin/main:package.json | jq -r .version)
   head=$(jq -r .version package.json)
   [ "$base" != "$head" ] || { echo "::error::version not bumped"; exit 1; }
   ```
2. **Changelog updated** — `CHANGELOG.md` contains a `## [<head-version>]`
   section (dated), and that section is part of the PR diff.
3. **Migration ⇒ release-bound** — if the PR touches
   `supabase/migrations/`, treat it as prod-bound and require 1 + 2
   (strong signal per CLAUDE.md). Otherwise allow a `skip-release` PR label
   for non-prod chores (docs, tests-only) to bypass.
4. **Tagging + `release_notes` row** — tag creation happens on the merge
   commit, so it can't be a PR precondition. Enforce via a **post-merge**
   `push: main` job that verifies a `v<version>` tag exists for the merged
   `package.json` version (and optionally that a `release_notes` upsert for
   that version is present in the migration), failing loudly / opening an
   issue if missing. This is the backstop for the "forgot to tag" failure
   mode we actually hit.

Notes:

- Items 1–3 are PR-time preconditions (block merge). Item 4 is a post-merge
  audit (can't block a tag that only exists after merge, but catches the miss
  immediately).
- Reuse existing `npm run lint:migrations` as the model for "parse repo state,
  exit 1 on violation."

---

## Prerequisite / sequencing (agreed 2026-07-09)

Order of operations, so we don't ship a gate everyone ignores:

1. **This release (now):** get the e2e suite _running_ (webkit install — done)
   and _green_ (triage the genuine chromium/firefox/webkit failures currently
   failing: auth protected-routes + join-band, practices crud, bands
   manage-members, jam save-setlist + view-anon). This is the active focus.
2. **Next (this PR or fast-follow):** add the CI e2e job + required
   `test:e2e` in `/finalize` (Finding 2), and the `release-metadata` gate
   (Finding 4). The devcontainer change (Finding 1) already lands with the
   release.
3. Fold Finding 3 rename in whenever convenient.

These supersede/sharpen the generic "PR validation workflow" bullet in the
original `2025-11-21T23:44_research.md`, which predates production existing and
predates the empirical discovery that the e2e suite was never gated.
