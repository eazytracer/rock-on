#!/usr/bin/env node
/**
 * Release-metadata gate — PR-time preconditions (Phase 1 of the release policy).
 *
 * Enforces CLAUDE.md "Versioning & Release Policy" so prod-bound PRs can't merge
 * without the version bump + dated CHANGELOG section that the merge commit needs
 * (so /release can later just tag it — Phase 2 — with no extra commit).
 *
 * Checks (all must pass, unless bypassed):
 *   1. package.json `version` on HEAD differs from the base ref's version
 *      (i.e. the PR bumped it), AND is a valid SemVer that is strictly greater.
 *   2. CHANGELOG.md contains a dated `## [<head-version>] - YYYY-MM-DD` section.
 *
 * Bypass: set SKIP_RELEASE=true (the CI job sets this when the PR carries the
 * `skip-release` label) for non-prod chores (docs, tests-only).
 *
 * Usage:
 *   BASE_REF=origin/main node scripts/check-release-metadata.mjs
 *   SKIP_RELEASE=true node scripts/check-release-metadata.mjs   # bypass
 *
 * Exit code 1 on any violation. Modeled on scripts/lint-migrations.mjs.
 */

import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const BASE_REF = process.env.BASE_REF || 'origin/main'
const SKIP = /^(1|true|yes)$/i.test(process.env.SKIP_RELEASE || '')

function fail(msg, fix) {
  console.error(`\u2717 release-metadata: ${msg}`)
  if (fix) console.error(`  fix: ${fix}`)
  process.exit(1)
}

function parseSemver(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v.trim())
  if (!m) return null
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

/** a > b for [major, minor, patch] tuples. */
function isGreater(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true
    if (a[i] < b[i]) return false
  }
  return false
}

function headVersion() {
  return JSON.parse(readFileSync('package.json', 'utf8')).version
}

function baseVersion() {
  try {
    const json = execSync(`git show ${BASE_REF}:package.json`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return JSON.parse(json).version
  } catch {
    // Base ref or file unavailable (e.g. brand-new repo) — can't compare.
    return null
  }
}

function main() {
  if (SKIP) {
    console.log(
      '\u26a0 release-metadata: SKIP_RELEASE set (skip-release label) — bypassing Phase 1 checks.'
    )
    process.exit(0)
  }

  const head = headVersion()
  const headSem = parseSemver(head)
  if (!headSem) {
    fail(
      `package.json version "${head}" is not valid SemVer (x.y.z).`,
      'Set a valid version, e.g. `npm version minor --no-git-tag-version`.'
    )
  }

  const base = baseVersion()
  if (base === null) {
    console.warn(
      `\u26a0 release-metadata: could not read ${BASE_REF}:package.json — skipping the bump comparison (version present & valid).`
    )
  } else {
    const baseSem = parseSemver(base)
    if (head === base) {
      fail(
        `version not bumped — package.json is still ${base} on both ${BASE_REF} and HEAD.`,
        'Bump it in the PR: `npm version <patch|minor|major> --no-git-tag-version` (or add the `skip-release` label for a non-prod chore).'
      )
    }
    if (baseSem && !isGreater(headSem, baseSem)) {
      fail(
        `version ${head} is not greater than ${BASE_REF}'s ${base} (never reuse or lower a shipped version).`,
        'Choose a higher SemVer.'
      )
    }
  }

  // Dated CHANGELOG section for the head version.
  const changelog = readFileSync('CHANGELOG.md', 'utf8')
  const escaped = head.replace(/[.]/g, '\\.')
  const dated = new RegExp(`^## \\[${escaped}\\] - \\d{4}-\\d{2}-\\d{2}`, 'm')
  if (!dated.test(changelog)) {
    fail(
      `CHANGELOG.md has no dated "## [${head}] - YYYY-MM-DD" section.`,
      `Move the [Unreleased] items into a dated ## [${head}] section.`
    )
  }

  console.log(
    `\u2713 release-metadata: version ${base ? `${base} \u2192 ` : ''}${head} bumped and CHANGELOG.md has a dated [${head}] section.`
  )
  process.exit(0)
}

main()
